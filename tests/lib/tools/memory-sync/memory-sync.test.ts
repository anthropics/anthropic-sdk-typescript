/**
 * The memory-store sync contract.
 *
 * An agent keeps a folder of notes on disk. The same folder lives on the
 * server. Each sync makes the two agree: each side gets the other's changes,
 * and when both changed the same file the server wins.
 *
 * Each test tells one story with two actors — `local` is the agent's folder
 * on disk, `server` is the remote copy. Paths are the same string on both
 * sides. `server.received` holds only what the sync sent; arranging remote
 * state never touches it.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  MIN_MEMORY_SYNC_INTERVAL_MS,
  SessionMemoryError,
  SessionMemoryStores,
} from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { DELETE_CORROBORATION_MS } from '@anthropic-ai/sdk/tools/agent-toolset/memories';
import { FileStore, LocalFileStore } from '@anthropic-ai/sdk/internal/file-store';
import { Clock, runSync } from './clock';
import {
  MemoryServer,
  created,
  deleted,
  updated,
  fakeAnthropic,
  retrieveSession,
  statusError,
  type Received,
} from './fake-anthropic';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-sync-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const read = (local: string, rel: string) => fs.readFileSync(path.join(local, rel), 'utf-8');
const write = (local: string, rel: string, content: string) =>
  fs.writeFileSync(path.join(local, rel), content);
const exists = (local: string, rel: string) => fs.existsSync(path.join(local, rel));

/** An fs error the store's own guards catch, rather than an unexpected throw. */
const ioError = () => Object.assign(new Error('I/O error'), { code: 'EIO' });

/** A `SessionMemoryStores` with one store already downloaded to disk. */
async function downloaded(
  initial: Record<string, string>,
  opts?: { access?: 'read_only' | 'read_write' | null },
): Promise<{
  local: string;
  server: MemoryServer;
  stores: SessionMemoryStores;
  logs: string[];
  memories: ReturnType<typeof fakeAnthropic>['memories'];
}> {
  const { client, server, logs, memories } = fakeAnthropic(initial, opts);
  const stores = new SessionMemoryStores(client, { workdir: tmp });
  await stores.download(await retrieveSession(client));
  return { local: path.join(tmp, 'memory', 'notes'), server, stores, logs, memories };
}

test('edits flow both ways and the server wins conflicts', async () => {
  const { local, server, stores, logs } = await downloaded({
    'push.md': 'v1',
    'pull.md': 'v1',
    'both.md': 'v1',
    'gone.md': 'v1',
  });

  write(local, 'push.md', 'v2 from agent');
  write(local, 'new.md', 'new from agent');
  server.write('pull.md', 'v2 from server');
  write(local, 'both.md', 'v2 from agent');
  server.write('both.md', 'v2 from server');
  server.delete('gone.md');

  await runSync(stores);

  // Each side has the other's change; the server won the conflict; the
  // server's deletion took the local copy with it.
  expect(server.files['push.md']).toBe('v2 from agent');
  expect(server.files['new.md']).toBe('new from agent');
  expect(read(local, 'pull.md')).toBe('v2 from server');
  expect(read(local, 'both.md')).toBe('v2 from server');
  expect(exists(local, 'gone.md')).toBe(false);
  expect(server.files).not.toHaveProperty(['gone.md']);
  expect(logs.join('\n')).toContain('changed both locally and remotely');

  // The push was guarded: overwrite only if the server still had v1.
  const sent = [created('new.md', 'new from agent'), updated('push.md', 'v2 from agent', 'v1')];
  expect(server.received).toEqual(sent);

  // Settled: a second sync sends nothing more.
  await runSync(stores);
  expect(server.received).toEqual(sent);
});

test('local deletions reach the server unless it changed', async () => {
  const clock = new Clock();
  // One memory's download write fails, so it is never on disk to begin with —
  // that absence is not a deletion.
  const realPut = LocalFileStore.prototype.put;
  const flakyPut = jest.spyOn(LocalFileStore.prototype, 'put').mockImplementation(async function (
    this: FileStore,
    rel,
    data,
    opts,
  ) {
    if (rel === 'never.md') throw ioError();
    return realPut.call(this, rel, data, opts);
  });
  // keep.md survives on disk so the pass is not an all-files-gone wipe.
  const { local, server, stores } = await downloaded({
    'drop.md': 'v1',
    'raced.md': 'v1',
    'never.md': 'v1',
    'keep.md': 'v1',
  });
  flakyPut.mockRestore();

  fs.unlinkSync(path.join(local, 'drop.md'));
  fs.unlinkSync(path.join(local, 'raced.md'));
  server.write('raced.md', 'v2 from server');

  await runSync(stores);
  // The first pass only records the deletion; a corroborating pass after
  // the window sends it.
  expect(server.files).toHaveProperty(['drop.md']);
  clock.now = DELETE_CORROBORATION_MS + 1;
  await runSync(stores);

  // Only the un-raced deletion went out, guarded by the last-synced content.
  const sent = [deleted('drop.md', 'v1')];
  expect(server.received).toEqual(sent);
  expect(server.files).not.toHaveProperty(['drop.md']);
  // The raced deletion lost — the server's edit came back to disk instead.
  expect(read(local, 'raced.md')).toBe('v2 from server');
  // The never-downloaded file was pulled, not deleted.
  expect(read(local, 'never.md')).toBe('v1');
  expect(server.files['never.md']).toBe('v1');

  await runSync(stores);
  expect(server.received).toEqual(sent);
  clock.restore();
});

test('read-only stores are never written', async () => {
  const { local, server, stores } = await downloaded(
    { 'edit.md': 'v1', 'drop.md': 'v1', 'pull.md': 'v1' },
    { access: 'read_only' },
  );
  // Reachable by the file tools, but write-protected.
  expect(stores.roots).toEqual([local]);
  expect(stores.readOnlyRoots).toEqual([local]);

  write(local, 'edit.md', 'v2 from agent');
  fs.unlinkSync(path.join(local, 'drop.md'));
  write(local, 'new.md', 'new from agent');
  server.write('pull.md', 'v2 from server');

  await runSync(stores);

  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'edit.md': 'v1', 'drop.md': 'v1', 'pull.md': 'v2 from server' });
  // Pulls still happen.
  expect(read(local, 'pull.md')).toBe('v2 from server');
});

test('paths that escape the store are refused', async () => {
  const { local, server, stores, logs } = await downloaded({ '../evil.md': 'boom', 'ok.md': 'fine' });

  await runSync(stores);

  expect(read(local, 'ok.md')).toBe('fine');
  expect(fs.existsSync(path.join(tmp, 'memory', 'evil.md'))).toBe(false);
  expect(fs.existsSync(path.join(tmp, 'evil.md'))).toBe(false);
  expect(server.received).toEqual([]);
  expect(logs.join('\n')).toContain('escapes');
});

test('worker lifecycle cadence and dispose', async () => {
  // The worker's call sequence: download → syncIfDue per call → finish →
  // dispose. The worker polls syncIfDue after each tool call and runs one
  // final sync on a clean end. A fake clock makes the cadence observable.
  const clock = new Clock();
  try {
    const { client, server } = fakeAnthropic({ 'note.md': 'v1' });
    const stores = new SessionMemoryStores(client, { workdir: tmp, syncIntervalMs: 300_000 });
    await stores.download(await retrieveSession(client));
    const local = path.join(tmp, 'memory', 'notes');

    write(local, 'note.md', 'edit 1');
    await stores.syncIfDue();
    expect(server.received).toEqual([]);

    // One long gap fires exactly once, and not again until another interval.
    clock.now = 2_000_000;
    await stores.syncIfDue();
    await stores.syncIfDue();
    expect(server.received).toEqual([updated('note.md', 'edit 1', 'v1')]);
    clock.now = 2_299_000;
    await stores.syncIfDue();
    expect(server.received).toHaveLength(1);

    // The last sync is finish(): unconditional, once.
    write(local, 'note.md', 'edit 2');
    await stores.finish();
    expect(server.received[server.received.length - 1]).toEqual(updated('note.md', 'edit 2', 'edit 1'));

    // Dispose removes the store dir the download created.
    expect(fs.existsSync(local)).toBe(true);
    await stores.dispose();
    expect(fs.existsSync(local)).toBe(false);
  } finally {
    clock.restore();
  }
});

test('a sync interval under the minimum is refused at construction', () => {
  const { client } = fakeAnthropic({});
  for (const syncIntervalMs of [0, 4_999, -1, Number.NaN]) {
    expect(() => new SessionMemoryStores(client, { workdir: tmp, syncIntervalMs })).toThrow(
      /syncIntervalMs must be at least 5000ms/,
    );
  }
  expect(
    () => new SessionMemoryStores(client, { workdir: tmp, syncIntervalMs: MIN_MEMORY_SYNC_INTERVAL_MS }),
  ).not.toThrow();
});

test('write and edit tools refuse read-only roots', async () => {
  const { betaEditTool, betaWriteTool } = await import('@anthropic-ai/sdk/tools/agent-toolset/node');
  const { ToolError } = await import('@anthropic-ai/sdk/lib/tools/ToolError');

  const ro = path.join(tmp, 'memory', 'notes');
  fs.mkdirSync(ro, { recursive: true });
  write(ro, 'facts.md', 'immutable');

  // The root is recorded un-canonicalized and through a symlink (the worker
  // records whatever path the store was opened at); the guard must still hold
  // against the tools' fully resolved write target.
  fs.symlinkSync(path.join(tmp, 'memory'), path.join(tmp, 'memory-alias'));
  const ctx = { workdir: tmp, readOnlyRoots: [path.join(tmp, 'memory-alias', 'notes')] };
  const writeTool = betaWriteTool(ctx);
  const editTool = betaEditTool(ctx);

  await expect(
    writeTool.run({ file_path: path.join(ro, 'facts.md'), content: 'overwritten' }),
  ).rejects.toThrow(/read-only/);
  await expect(writeTool.run({ file_path: path.join(ro, 'new.md'), content: 'new' })).rejects.toThrow(
    ToolError,
  );
  await expect(
    editTool.run({ file_path: path.join(ro, 'facts.md'), old_string: 'immutable', new_string: 'x' }),
  ).rejects.toThrow(/read-only/);
  expect(read(ro, 'facts.md')).toBe('immutable');
  expect(fs.existsSync(path.join(ro, 'new.md'))).toBe(false);

  // Paths outside the read-only root are unaffected.
  await writeTool.run({ file_path: 'scratch.txt', content: 'ok' });
  expect(read(tmp, 'scratch.txt')).toBe('ok');
});

test('a binary local file never blocks the other files', async () => {
  // The store is utf-8-restricted, so a binary file the agent drops in the
  // folder is refused at read — warned once and skipped until it changes —
  // while every other file keeps syncing.
  const { local, server, stores, logs } = await downloaded({ 'note.md': 'v1' });

  fs.writeFileSync(path.join(local, 'blob.bin'), Buffer.from([0xff, 0xfe, 0x00, 0x20]));
  write(local, 'note.md', 'v2');

  await runSync(stores);
  await runSync(stores);

  expect(server.received).toEqual([updated('note.md', 'v2', 'v1')]);
  expect(server.files).not.toHaveProperty(['blob.bin']);
  const skips = logs.filter(
    (l) => l.includes('stays un-synced until its content changes') && l.includes('blob.bin'),
  );
  expect(skips).toHaveLength(1);
});

test('an oversized file is skipped until it shrinks', async () => {
  // A file the server refuses as too large is warned once and skipped — not
  // retried while unchanged, never blocking the other files — and syncs as
  // soon as an edit brings it under the cap.
  const { local, server, stores, logs } = await downloaded({ 'note.md': 'v1' });
  server.maxContentBytes = 64;

  write(local, 'big.md', 'x'.repeat(100));
  write(local, 'note.md', 'v2');

  await runSync(stores);
  await runSync(stores);

  // The small edit landed; the big file was attempted exactly once.
  expect(server.received).toContainEqual(updated('note.md', 'v2', 'v1'));
  expect(server.received.filter((r) => r[0] === 'create')).toHaveLength(1);
  expect(server.files).not.toHaveProperty(['big.md']);
  const skips = logs.filter(
    (l) => l.includes('stays un-synced until its content changes') && l.includes('big.md'),
  );
  expect(skips).toHaveLength(1);

  write(local, 'big.md', 'small now');
  await runSync(stores);
  expect(server.files['big.md']).toBe('small now');
});

test.each([401, 403, 404])(
  'a refusal that says nothing about the content is retried next sync (%i)',
  async (status) => {
    // Anything but a content refusal is retried by the next sync.
    const { local, server, stores, logs } = await downloaded({ 'note.md': 'v1' });
    write(local, 'note.md', 'v2');
    write(local, 'new.md', 'fresh');

    server.uploadHook = () => {
      throw statusError(status);
    };
    await runSync(stores);
    server.uploadHook = null;
    await runSync(stores);

    expect(server.files).toEqual({ 'note.md': 'v2', 'new.md': 'fresh' });
    expect(logs.join('\n')).not.toContain('stays un-synced');
  },
);

test('a broken store fails the whole download', async () => {
  // A store that cannot be materialised fails the download outright. A session
  // served without a folder its system prompt names would run with amnesia;
  // the worker turns this into a failed work item.
  const { client, server } = fakeAnthropic({ 'note.md': 'v1', 'empty.md': null }, { brokenStore: true });
  const stores = new SessionMemoryStores(client, { workdir: tmp });

  // The listing blew up with a plain Error; it reaches the caller wrapped,
  // named, and with the original attached.
  const err = await stores.download(await retrieveSession(client)).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(SessionMemoryError);
  expect(String(err)).toContain('memstore_broken');
  expect((err as { cause?: unknown }).cause).toBeInstanceOf(Error);

  // The half-downloaded folder self-destructed; nothing is tracked, and the
  // healthy store queued behind it was never even opened.
  expect(fs.existsSync(path.join(tmp, 'memory', 'broken'))).toBe(false);
  expect(fs.existsSync(path.join(tmp, 'memory', 'notes'))).toBe(false);
  expect(stores.readOnlyRoots).toEqual([]);
  expect(server.received).toEqual([]);
});

test('a store directory that already exists is refused', async () => {
  // Nothing but a dead run leaves a folder at the store's path. Syncing into
  // it would fold that run's debris into the customer's store, so refuse — and
  // leave the folder exactly as it was found.
  const stale = path.join(tmp, 'memory', 'notes');
  fs.mkdirSync(stale, { recursive: true });
  write(stale, 'debris.md', 'left by another session');

  const { client, server } = fakeAnthropic({ 'note.md': 'v1' });
  const stores = new SessionMemoryStores(client, { workdir: tmp });

  await expect(stores.download(await retrieveSession(client))).rejects.toThrow(/already exists/);

  // Refused, not adopted and not deleted.
  expect(read(stale, 'debris.md')).toBe('left by another session');
  expect(exists(stale, 'note.md')).toBe(false);
  expect(server.received).toEqual([]);
  expect(stores.readOnlyRoots).toEqual([]);
});

test("a sibling directory beside the store's root is none of our business", async () => {
  // Only the store's own root must not pre-exist. Its parent, and whatever
  // else lives there, is somebody else's business.
  const wd = path.join(tmp, 'wd');
  fs.mkdirSync(path.join(wd, 'memory', 'sibling'), { recursive: true });
  fs.writeFileSync(path.join(wd, 'memory', 'sibling', 'other.md'), 'not ours');

  const { client } = fakeAnthropic({ 'note.md': 'v1' });
  const stores = new SessionMemoryStores(client, { workdir: wd });
  await stores.download(await retrieveSession(client));

  expect(read(path.join(wd, 'memory', 'notes'), 'note.md')).toBe('v1');
  expect(read(path.join(wd, 'memory', 'sibling'), 'other.md')).toBe('not ours');
});

test('an upload that loses the race pulls the winner next sync', async () => {
  // The server changes between this sync's list and its update: the
  // content_sha256 precondition rejects the push (409), and the next sync
  // applies the conflict rule — the winning remote edit is pulled, the local
  // edit is never re-pushed.
  const { client, server, logs } = fakeAnthropic({ 'note.md': 'v1' });
  const stores = new SessionMemoryStores(client, { workdir: tmp });
  await stores.download(await retrieveSession(client));
  const local = path.join(tmp, 'memory', 'notes');

  write(local, 'note.md', 'local edit');
  const memories = (client as any).beta.memoryStores.memories;
  const realUpdate = memories.update.bind(memories);
  memories.update = async (memoryId: string, params: unknown) => {
    // Race: the remote changes after this sync's list, before its update.
    server.write('note.md', 'raced remote edit');
    return realUpdate(memoryId, params);
  };
  await runSync(stores);
  memories.update = realUpdate;

  // The precondition rejected the push (one guarded attempt, no retry) and
  // the server kept its raced edit. The log says what actually happened: the
  // push was dropped and the local copy is stale, not "the remote was kept".
  expect(server.received).toEqual([updated('note.md', 'local edit', 'v1')]);
  expect(server.files['note.md']).toBe('raced remote edit');
  expect(logs.join('\n')).toContain('the upload was refused and the local edit loses');
  // ...and it is indeed still stale at this point.
  expect(read(local, 'note.md')).toBe('local edit');

  // The next sync pulls the winner instead of re-pushing.
  await runSync(stores);
  expect(read(local, 'note.md')).toBe('raced remote edit');
  expect(server.received).toHaveLength(1);
});

test('a legal mount path is honored verbatim', async () => {
  // mount_path is the location the agent's system prompt names, so a clean
  // absolute one is honored verbatim — and dispose removes it when the
  // download created it.
  const mount = path.join(tmp, 'mnt', 'notes');
  const { client } = fakeAnthropic({ 'note.md': 'v1' }, { mountPath: mount });
  const stores = new SessionMemoryStores(client, { workdir: path.join(tmp, 'wd') });

  await stores.download(await retrieveSession(client));

  expect(read(mount, 'note.md')).toBe('v1');
  expect(stores.roots).toEqual([path.resolve(mount)]);
  await stores.dispose();
  expect(fs.existsSync(mount)).toBe(false);
});

test('an unwritable mount path fails the download', async () => {
  // A mount the host cannot provide is an environment failure: the download
  // throws loudly (failing the work item) instead of degrading to a session
  // with silently-empty memory.
  if (process.getuid?.() === 0) return; // directory modes do not bind root
  const parent = path.join(tmp, 'mnt');
  fs.mkdirSync(parent);
  await fs.promises.chmod(parent, 0o500); // the worker may not create the store's folder here
  try {
    const { client, server } = fakeAnthropic({ 'note.md': 'v1' }, { mountPath: path.join(parent, 'notes') });
    const stores = new SessionMemoryStores(client, { workdir: path.join(tmp, 'wd') });

    await expect(stores.download(await retrieveSession(client))).rejects.toThrow(/writable/);
    expect(server.received).toEqual([]);
  } finally {
    await fs.promises.chmod(parent, 0o700);
  }
});

// `null` means the resource carries no mount_path at all — that one is allowed
// and falls back to the workdir, because nothing pointed the agent anywhere.
// The rest cannot be used verbatim, and a store the agent will never look in is
// worse than no session at all: it would read an empty folder at the path it
// was told about and write notes where nothing will look for them.
test.each([['/mnt/../../etc/cron.d'], ['relative/notes'], ['notes'], [null]])(
  'an unclean mount path fails the download: %p',
  async (bad: string | null) => {
    const { client, server } = fakeAnthropic({ 'note.md': 'v1' }, { mountPath: bad });
    const wd = path.join(tmp, 'wd');
    const stores = new SessionMemoryStores(client, { workdir: wd });

    if (bad === null) {
      await stores.download(await retrieveSession(client));
      expect(read(path.join(wd, 'memory', 'notes'), 'note.md')).toBe('v1');
      return;
    }

    await expect(stores.download(await retrieveSession(client))).rejects.toThrow(SessionMemoryError);

    // Nothing was written anywhere, and no store is tracked.
    expect(fs.existsSync(wd)).toBe(false);
    expect(server.received).toEqual([]);
    expect(stores.readOnlyRoots).toEqual([]);
  },
);

test('the unclean mount path error names the path', async () => {
  const { client } = fakeAnthropic({ 'note.md': 'v1' }, { mountPath: 'relative/notes' });
  const stores = new SessionMemoryStores(client, { workdir: path.join(tmp, 'wd') });

  await expect(stores.download(await retrieveSession(client))).rejects.toThrow(
    /not a clean absolute path.*relative\/notes/,
  );
});

test('prefix items and foreign resources leave no trace', async () => {
  // Only `memory_store` resources are downloaded and only `memory` items
  // carry content — a `file` resource and `memory_prefix` rollups pass
  // through without touching the disk or the server.
  const { client, server } = fakeAnthropic({ 'ok.md': 'fine' }, { noise: true });
  const stores = new SessionMemoryStores(client, { workdir: tmp });
  await stores.download(await retrieveSession(client));
  const local = path.join(tmp, 'memory', 'notes');

  expect(read(local, 'ok.md')).toBe('fine');
  expect(fs.readdirSync(path.join(tmp, 'memory'))).toEqual(['notes']);
  expect(fs.existsSync(path.join(local, 'projects'))).toBe(false);
  await runSync(stores);
  expect(server.received).toEqual([]);
});

// ---- the sync matrix -------------------------------------------------------
//
// Every combination of (remote moved?, local moved?) for a path the store has
// already downloaded. `local` and `remote` say what happened since the last
// sync; `disk` and `store` are the state both sides must agree on afterwards,
// and `sent` is exactly what went over the wire.

/** The file is gone from that side — distinct from `null`, "nothing happened". */
const MISSING = Symbol('missing');
type Move = string | typeof MISSING | null;

type Row = {
  name: string;
  local: Move;
  remote: Move;
  disk: string | typeof MISSING;
  store: string | typeof MISSING;
  sent: Received[];
};

const MATRIX: Row[] = [
  // baseline "v1" on both sides unless the row says otherwise
  { name: 'untouched', local: null, remote: null, disk: 'v1', store: 'v1', sent: [] },
  {
    name: 'local edit',
    local: 'v2',
    remote: null,
    disk: 'v2',
    store: 'v2',
    sent: [updated('f.md', 'v2', 'v1')],
  },
  { name: 'remote edit', local: null, remote: 'v2', disk: 'v2', store: 'v2', sent: [] },
  {
    name: 'both edit, server wins',
    local: 'v2 local',
    remote: 'v2 remote',
    disk: 'v2 remote',
    store: 'v2 remote',
    sent: [],
  },
  {
    name: 'local delete',
    local: MISSING,
    remote: null,
    disk: MISSING,
    store: MISSING,
    sent: [deleted('f.md', 'v1')],
  },
  { name: 'remote delete', local: null, remote: MISSING, disk: MISSING, store: MISSING, sent: [] },
  { name: 'both delete', local: MISSING, remote: MISSING, disk: MISSING, store: MISSING, sent: [] },
  { name: 'local delete, remote edit', local: MISSING, remote: 'v2', disk: 'v2', store: 'v2', sent: [] },
  {
    name: 'local edit, remote delete',
    local: 'v2',
    remote: MISSING,
    disk: 'v2',
    store: 'v2',
    sent: [created('f.md', 'v2')],
  },
];

test.each(MATRIX)('sync matrix: $name', async ({ name, local, remote, disk, store, sent }) => {
  const clock = new Clock();
  const { local: dir, server, stores } = await downloaded({ 'f.md': 'v1' });

  if (local === MISSING) fs.unlinkSync(path.join(dir, 'f.md'));
  else if (local !== null) write(dir, 'f.md', local);

  if (remote === MISSING) server.delete('f.md');
  else if (remote !== null) server.write('f.md', remote);

  // Two passes: a local deletion is only sent after its corroboration window.
  await runSync(stores);
  clock.now = DELETE_CORROBORATION_MS + 1;
  await runSync(stores);

  if (disk === MISSING) expect(exists(dir, 'f.md')).toBe(false);
  else expect(read(dir, 'f.md')).toBe(disk);

  if (store === MISSING) expect(server.files).not.toHaveProperty(['f.md']);
  else expect(server.files['f.md']).toBe(store);

  expect(server.received).toEqual(sent);

  // Settled: a second pass sends nothing more and changes nothing.
  await runSync(stores);
  expect(server.received).toEqual(sent);
  if (disk === MISSING) expect(exists(dir, 'f.md')).toBe(false);
  else expect(read(dir, 'f.md')).toBe(disk);
  void name;
  clock.restore();
});

// ---- the failure column ----------------------------------------------------
//
// Same matrix, one operation broken. A failed operation must leave disk and
// server in a state the next sync can still reconcile — never one where the
// retry does the opposite of what was asked.

test('a failed upload keeps the local edit and retries', async () => {
  const { local, server, stores, memories } = await downloaded({ 'f.md': 'v1' });
  write(local, 'f.md', 'v2 from agent');

  const real = memories.update.bind(memories);
  memories.update = async () => {
    throw new Error('upload exploded');
  };
  await runSync(stores);

  // The agent's edit survives; the server is untouched.
  expect(read(local, 'f.md')).toBe('v2 from agent');
  expect(server.files['f.md']).toBe('v1');

  // The baseline still says v1, so the next (working) sync retries the push.
  memories.update = real;
  await runSync(stores);
  expect(server.files['f.md']).toBe('v2 from agent');
});

test('a failed pull leaves the old file and retries', async () => {
  const { local, server, stores } = await downloaded({ 'f.md': 'v1' });
  server.write('f.md', 'v2 from server');

  const flakyPut = jest.spyOn(LocalFileStore.prototype, 'put').mockImplementation(async () => {
    throw ioError();
  });
  await runSync(stores);
  flakyPut.mockRestore();

  // The stale file is still there and the baseline never advanced...
  expect(read(local, 'f.md')).toBe('v1');
  expect(server.received).toEqual([]);

  // ...so the next sync pulls it, rather than mistaking v1 for a local edit
  // and pushing it back over the server's v2.
  await runSync(stores);
  expect(read(local, 'f.md')).toBe('v2 from server');
  expect(server.received).toEqual([]);
});

test('a failed local removal never re-uploads the deleted memory', async () => {
  // The server deleted the memory; removing our copy fails. The baseline must
  // stay put — dropping it would read the leftover file as a new local file
  // and create the memory the server just deleted.
  const { local, server, stores, logs } = await downloaded({ 'f.md': 'v1' });
  server.delete('f.md');

  const flakyRemove = jest.spyOn(LocalFileStore.prototype, 'remove').mockImplementation(async () => {
    throw ioError();
  });
  await runSync(stores);
  flakyRemove.mockRestore();

  expect(read(local, 'f.md')).toBe('v1');
  expect(server.received).toEqual([]);
  expect(server.files).not.toHaveProperty(['f.md']);
  expect(logs.join('\n')).toContain('failed to remove memory deleted remotely');

  // The retry deletes it locally; it is never pushed back.
  await runSync(stores);
  expect(exists(local, 'f.md')).toBe(false);
  expect(server.received).toEqual([]);
  expect(server.files).not.toHaveProperty(['f.md']);
});

test('a read-only store still applies a remote deletion', async () => {
  // Removing a file the server dropped is a pull, not a push, so read-only is
  // no exception.
  const { local, server, stores } = await downloaded({ 'f.md': 'v1' }, { access: 'read_only' });
  server.delete('f.md');

  await runSync(stores);

  expect(exists(local, 'f.md')).toBe(false);
  expect(server.received).toEqual([]);
});

test('stores sync in parallel and one failure spares the rest', async () => {
  // The slow store's listing waits for the fast store's listing to start —
  // only a parallel sync satisfies that — then explodes. A serial sync times
  // the wait out instead (a different error message), and the fast store's
  // edit must land either way.
  const slow = fakeAnthropic({ 'a.md': 'v1' });
  const fast = fakeAnthropic({ 'b.md': 'v1' });
  const byId = { memstore_slow: slow.memories, memstore_fast: fast.memories };
  let fastListStarted: () => void;
  const fastStarted = new Promise<void>((resolve) => (fastListStarted = resolve));
  let timer: NodeJS.Timeout;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('fast store never started')), 10_000);
  });
  let syncing = false;

  const logs: string[] = [];
  const logAll = (...args: unknown[]) => logs.push(args.map((a) => JSON.stringify(a)).join(' '));
  const client = {
    logger: { error: logAll, warn: logAll, info: logAll, debug: logAll },
    logLevel: 'debug',
    beta: {
      memoryStores: {
        memories: {
          list(id: keyof typeof byId, params?: { view?: string }) {
            const inner = byId[id].list(id, params);
            return {
              async *[Symbol.asyncIterator]() {
                if (syncing) {
                  if (id === 'memstore_fast') {
                    fastListStarted();
                  } else {
                    // Hangs until the timeout under a serial sync (fast hasn't run yet).
                    await Promise.race([fastStarted, timedOut]);
                    throw new Error('slow store exploded');
                  }
                }
                yield* inner;
              },
            };
          },
          retrieve: (memoryId: string, params: { memory_store_id: keyof typeof byId }) =>
            byId[params.memory_store_id].retrieve(memoryId, params),
          create: (id: keyof typeof byId, params: never) => byId[id].create(id, params),
          update: (memoryId: string, params: { memory_store_id: keyof typeof byId }) =>
            byId[params.memory_store_id].update(memoryId, params as never),
          delete: (memoryId: string, params: { memory_store_id: keyof typeof byId }) =>
            byId[params.memory_store_id].delete(memoryId, params as never),
        },
      },
    },
  };

  const session = {
    agent: { skills: [] },
    resources: (['slow', 'fast'] as const).map((name) => ({
      type: 'memory_store',
      memory_store_id: `memstore_${name}`,
      mount_path: null,
      name,
      access: null,
    })),
  };
  const stores = new SessionMemoryStores(client as never, { workdir: tmp });
  await stores.download(session as never);

  syncing = true;
  write(path.join(tmp, 'memory', 'fast'), 'b.md', 'v2 from agent');
  await runSync(stores);
  clearTimeout(timer!);

  // The slow store failed *after* seeing the fast store's listing start —
  // proof the two ran concurrently — and the fast store still pushed.
  expect(logs.join('\n')).toContain('slow store exploded');
  expect(fast.server.received).toEqual([updated('b.md', 'v2 from agent', 'v1')]);
  // The failed store's baseline was kept, so nothing is re-uploaded once it heals.
  expect(read(path.join(tmp, 'memory', 'slow'), 'a.md')).toBe('v1');
}, 20_000);
