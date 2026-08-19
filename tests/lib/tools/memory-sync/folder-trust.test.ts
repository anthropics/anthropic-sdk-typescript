/**
 * Folder-trust gating: a missing, emptied, or swapped store folder is never
 * trusted as a basis for deletions or uploads.
 *
 * `download` stamps {@link MARKER_PATH} (holding the store's id) into the
 * folder. A sync pass that finds the folder destroyed re-downloads it and
 * pushes nothing; a sync that finds files without a matching marker leaves
 * the folder as found and syncs nothing at all.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MARKER_PATH, SessionMemoryStores } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { DELETE_CORROBORATION_MS } from '@anthropic-ai/sdk/tools/agent-toolset/memories';
import { Clock, runSync } from './clock';
import {
  MemoryServer,
  deleted,
  updated,
  fakeAnthropic,
  listingInterruptedBy,
  retrieveSession,
} from './fake-anthropic';

const STORE_ID = 'memstore_notes';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-sync-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function markerStamp(local: string): string {
  return fs.readFileSync(path.join(local, MARKER_PATH), 'utf-8');
}

/** A `SessionMemoryStores` with one store already downloaded to disk. */
async function downloaded(initial: Record<string, string>): Promise<{
  local: string;
  server: MemoryServer;
  stores: SessionMemoryStores;
  logs: string[];
  memories: ReturnType<typeof fakeAnthropic>['memories'];
}> {
  const { client, server, logs, memories } = fakeAnthropic(initial);
  const stores = new SessionMemoryStores(client, { workdir: tmp });
  await stores.download(await retrieveSession(client));
  return { local: path.join(tmp, 'memory', 'notes'), server, stores, logs, memories };
}

test('a deleted folder issues no deletes and is rebuilt', async () => {
  // rm -rf of the whole folder between syncs: the next sync must not read
  // the emptiness as "the agent deleted everything" and wipe the server.
  const clock = new Clock();
  const { local, server, stores, logs } = await downloaded({ 'a.md': 'v1', 'b.md': 'v1' });
  fs.rmSync(local, { recursive: true, force: true });

  await runSync(stores);

  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'a.md': 'v1', 'b.md': 'v1' });
  expect(fs.readFileSync(path.join(local, 'a.md'), 'utf-8')).toBe('v1');
  expect(fs.readFileSync(path.join(local, 'b.md'), 'utf-8')).toBe('v1');
  expect(markerStamp(local)).toBe(`version 1\n${STORE_ID}`);
  expect(logs.join('\n')).toContain('the folder or its marker is gone; re-downloading');

  // The rebuilt folder syncs normally: an edit and a deletion both propagate
  // (the deletion after its waiting window).
  fs.writeFileSync(path.join(local, 'a.md'), 'v2');
  fs.unlinkSync(path.join(local, 'b.md'));
  await runSync(stores);
  clock.now = DELETE_CORROBORATION_MS + 1;
  await runSync(stores);
  expect(server.received).toEqual([updated('a.md', 'v2', 'v1'), deleted('b.md', 'v1')]);
  expect(server.files).toEqual({ 'a.md': 'v2' });
  clock.restore();
});

test('an emptied folder issues no deletes and is repopulated', async () => {
  const clock = new Clock();
  const { local, server, stores, logs } = await downloaded({ 'a.md': 'v1', 'b.md': 'v1' });
  for (const child of fs.readdirSync(local)) {
    fs.unlinkSync(path.join(local, child));
  }

  await runSync(stores);

  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'a.md': 'v1', 'b.md': 'v1' });
  expect(fs.readFileSync(path.join(local, 'a.md'), 'utf-8')).toBe('v1');
  expect(markerStamp(local)).toBe(`version 1\n${STORE_ID}`);
  expect(logs.join('\n')).toContain('the folder or its marker is gone; re-downloading');

  fs.unlinkSync(path.join(local, 'a.md'));
  await runSync(stores);
  clock.now = DELETE_CORROBORATION_MS + 1;
  await runSync(stores);
  expect(server.received).toEqual([deleted('a.md', 'v1')]);
  clock.restore();
});

test('an emptied folder with the marker left behind issues no deletes', async () => {
  // `rm <mount>/*`: shell globs skip dotfiles, so the marker survives the
  // wipe — an intact marker alone must not clear a folder whose every
  // memory file vanished at once.
  const clock = new Clock();
  const { local, server, stores, logs } = await downloaded({ 'a.md': 'v1', 'b.md': 'v1' });
  for (const child of fs.readdirSync(local)) {
    if (child !== MARKER_PATH) fs.unlinkSync(path.join(local, child));
  }

  await runSync(stores);

  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'a.md': 'v1', 'b.md': 'v1' });
  expect(fs.readFileSync(path.join(local, 'a.md'), 'utf-8')).toBe('v1');
  expect(logs.join('\n')).toContain('every memory file is gone at once; re-downloading');

  // With files present again, an ordinary single deletion still propagates
  // (after its waiting window).
  fs.unlinkSync(path.join(local, 'a.md'));
  await runSync(stores);
  clock.now = DELETE_CORROBORATION_MS + 1;
  await runSync(stores);
  expect(server.received).toEqual([deleted('a.md', 'v1')]);
  clock.restore();
});

test('a swapped folder neither deletes nor uploads, ever', async () => {
  // A folder carrying another store's marker is foreign: the pass must not
  // adopt it — no deletes, no uploads, no restamp — on this pass or any later
  // one, or the foreign files leak into the customer's store one pass later.
  const { local, server, stores, logs } = await downloaded({ 'a.md': 'v1' });
  fs.rmSync(local, { recursive: true, force: true });
  fs.mkdirSync(local);
  fs.writeFileSync(path.join(local, MARKER_PATH), 'memstore_other');
  fs.writeFileSync(path.join(local, 'foreign.md'), "someone else's notes");

  await runSync(stores);
  await runSync(stores);

  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'a.md': 'v1' });
  expect(fs.readFileSync(path.join(local, MARKER_PATH), 'utf-8')).toBe('memstore_other');
  expect(fs.readFileSync(path.join(local, 'foreign.md'), 'utf-8')).toBe("someone else's notes");
  expect(fs.existsSync(path.join(local, 'a.md'))).toBe(false);
  expect(logs.join('\n')).toContain(
    'the marker file does not match this store; leaving the memory store folder as found',
  );
});

test('files without a marker are neither pushed nor pulled over', async () => {
  // Only the marker was deleted (a dotfile cleanup): the remaining files may
  // hold un-pushed edits, so the pass must neither upload them, nor delete by
  // them, nor destroy them by re-downloading over the folder.
  const { local, server, stores, logs } = await downloaded({ 'a.md': 'v1', 'b.md': 'v1' });
  fs.unlinkSync(path.join(local, MARKER_PATH));
  fs.writeFileSync(path.join(local, 'a.md'), 'un-pushed edit');
  fs.unlinkSync(path.join(local, 'b.md'));

  await runSync(stores);

  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'a.md': 'v1', 'b.md': 'v1' });
  expect(fs.readFileSync(path.join(local, 'a.md'), 'utf-8')).toBe('un-pushed edit');
  expect(fs.existsSync(path.join(local, MARKER_PATH))).toBe(false);
  expect(logs.join('\n')).toContain('the marker file is gone; leaving the memory store folder as found');
});

test('a single local deletion with the marker intact still propagates', async () => {
  const clock = new Clock();
  const { local, server, stores } = await downloaded({ 'a.md': 'v1', 'b.md': 'v1' });
  fs.unlinkSync(path.join(local, 'a.md'));

  await runSync(stores);
  clock.now = DELETE_CORROBORATION_MS + 1;
  await runSync(stores);

  expect(server.received).toEqual([deleted('a.md', 'v1')]);
  expect(server.files).toEqual({ 'b.md': 'v1' });
  expect(markerStamp(local)).toBe(`version 1\n${STORE_ID}`);
  clock.restore();
});

test('the marker never syncs in either direction', async () => {
  const { local, server, stores, logs } = await downloaded({ 'a.md': 'v1' });

  // The marker sits in the folder yet is never uploaded or remote-deleted.
  await runSync(stores);
  expect(server.received).toEqual([]);

  // A marker path the server lists is refused: skipped with a warning,
  // never written over the real marker on disk.
  server.write(MARKER_PATH, 'not a store id');
  await runSync(stores);
  expect(server.received).toEqual([]);
  expect(markerStamp(local)).toBe(`version 1\n${STORE_ID}`);
  expect(logs.join('\n')).toContain('reserved marker path');
});

test('dispose tolerates an already-deleted folder', async () => {
  const { local, stores } = await downloaded({ 'a.md': 'v1' });
  fs.rmSync(local, { recursive: true, force: true });

  await stores.dispose();

  expect(fs.existsSync(local)).toBe(false);
});

test('dispose keeps a folder that fails the marker check', async () => {
  // Sync left the folder as found after a failed marker check; teardown
  // must not then delete the files sync refused to touch.
  const { local, stores, logs } = await downloaded({ 'a.md': 'v1' });
  fs.unlinkSync(path.join(local, MARKER_PATH));
  fs.writeFileSync(path.join(local, 'a.md'), 'un-pushed edit');

  await stores.dispose();

  expect(fs.readFileSync(path.join(local, 'a.md'), 'utf-8')).toBe('un-pushed edit');
  expect(logs.join('\n')).toContain('leaving the memory store folder on disk');
});

test('dispose never throws when a store root is replaced by a file', async () => {
  // The worker calls dispose() from its teardown: a store whose folder
  // something replaced with a regular file must log and be skipped, not
  // throw out of the teardown.
  const { local, stores } = await downloaded({ 'a.md': 'v1' });
  fs.rmSync(local, { recursive: true, force: true });
  fs.writeFileSync(local, 'a file where the folder was');

  await stores.dispose();

  expect(fs.readFileSync(local, 'utf-8')).toBe('a file where the folder was');
});

test('a marker from an older format no longer clears the folder', async () => {
  // The marker carries a format version so an SDK upgrade can retire every
  // folder written before it: a marker in the old format (the bare store id)
  // must fail the check, and the folder is left as found.
  const { local, server, stores, logs } = await downloaded({ 'a.md': 'v1', 'b.md': 'v1' });
  fs.writeFileSync(path.join(local, MARKER_PATH), STORE_ID);
  fs.writeFileSync(path.join(local, 'a.md'), 'edit under the old marker');
  fs.unlinkSync(path.join(local, 'b.md'));

  await runSync(stores);

  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'a.md': 'v1', 'b.md': 'v1' });
  expect(fs.readFileSync(path.join(local, 'a.md'), 'utf-8')).toBe('edit under the old marker');
  expect(logs.join('\n')).toContain('the marker file does not match this store');
});

test.each(['z.md', 'sub/z.md'])(
  'a folder wiped while a pull is in flight is rebuilt, not distrusted: %s',
  async (rel) => {
    // rm -rf lands between a sync's scan and its content write: the write must
    // not bring the folder back without its marker, or every later sync reads
    // the folder as foreign and the session's memory writes are lost.
    const { local, server, stores, logs } = await downloaded({ 'x.md': 'v1', 'y.md': 'v1', [rel]: 'v1' });
    server.write(rel, 'v2');
    server.fetchHook = () => fs.rmSync(local, { recursive: true, force: true });

    await runSync(stores);

    expect(fs.existsSync(local)).toBe(false);
    expect(server.received).toEqual([]);

    server.fetchHook = null;
    await runSync(stores);

    expect(markerStamp(local)).toBe(`version 1\n${STORE_ID}`);
    expect(fs.readFileSync(path.join(local, 'x.md'), 'utf-8')).toBe('v1');
    expect(fs.readFileSync(path.join(local, rel), 'utf-8')).toBe('v2');
    expect(logs.join('\n')).toContain('re-downloading the memory store folder');
    expect(logs.join('\n')).not.toContain('leaving the memory store folder as found');

    await stores.finish();
    await stores.flushWrites();
    await stores.dispose();
    expect(fs.existsSync(local)).toBe(false);
    expect(server.received).toEqual([]);
    expect(server.files).toEqual({ 'x.md': 'v1', 'y.md': 'v1', [rel]: 'v2' });
  },
);

test('a folder wiped while a locally deleted memory is being restored is rebuilt', async () => {
  // A memory deleted locally but changed remotely is restored by the next sync;
  // an rm -rf landing mid-restore must leave no folder behind, the sync after
  // it must rebuild the store, and the absence must never become a server delete.
  const clock = new Clock();
  const { local, server, stores, logs } = await downloaded({ 'x.md': 'v1', 'y.md': 'v1', 'z.md': 'v1' });
  fs.unlinkSync(path.join(local, 'z.md'));
  server.write('z.md', 'v2');
  server.fetchHook = () => fs.rmSync(local, { recursive: true, force: true });

  await runSync(stores);
  expect(fs.existsSync(local)).toBe(false);

  server.fetchHook = null;
  await runSync(stores);
  expect(markerStamp(local)).toBe(`version 1\n${STORE_ID}`);
  expect(fs.readFileSync(path.join(local, 'x.md'), 'utf-8')).toBe('v1');
  expect(fs.readFileSync(path.join(local, 'y.md'), 'utf-8')).toBe('v1');
  expect(fs.readFileSync(path.join(local, 'z.md'), 'utf-8')).toBe('v2');

  clock.now = DELETE_CORROBORATION_MS + 1;
  await runSync(stores);
  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'x.md': 'v1', 'y.md': 'v1', 'z.md': 'v2' });
  expect(logs.join('\n')).not.toContain('leaving the memory store folder as found');
  clock.restore();
});

test('a folder wiped again mid-recovery is rebuilt by the next sync', async () => {
  // A re-download writes the marker first and the memories after it; a second
  // rm -rf between those writes must not leave memories on disk without a
  // marker — the next sync re-downloads once more instead.
  const { local, server, stores, logs, memories } = await downloaded({
    'a.md': 'v1',
    'b.md': 'v1',
    'c.md': 'v1',
  });
  fs.rmSync(local, { recursive: true, force: true });

  await listingInterruptedBy(
    memories,
    () => fs.rmSync(local, { recursive: true, force: true }),
    () => runSync(stores),
    { afterItems: 1 },
  );

  expect(fs.existsSync(local)).toBe(false);
  expect(logs.filter((l) => l.includes('failed to write memory'))).toHaveLength(2);
  expect(server.received).toEqual([]);

  await runSync(stores);

  expect(markerStamp(local)).toBe(`version 1\n${STORE_ID}`);
  for (const name of ['a.md', 'b.md', 'c.md']) {
    expect(fs.readFileSync(path.join(local, name), 'utf-8')).toBe('v1');
  }
  expect(logs.filter((l) => l.includes('re-downloading the memory store folder'))).toHaveLength(2);
  expect(logs.join('\n')).not.toContain('leaving the memory store folder as found');
  expect(server.received).toEqual([]);

  await stores.dispose();
  expect(fs.existsSync(local)).toBe(false);
});
