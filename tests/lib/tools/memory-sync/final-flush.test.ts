/**
 * `flushWrites` — the push-only shutdown pass.
 *
 * A session that ends on an error or cancel gets no full reconcile, but the
 * writes already on disk are the only copy of the agent's edits.
 * `flushWrites` pushes those and does nothing else: no remote deletes, no
 * local removals, no pulls.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MARKER_PATH, SessionMemoryStores } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { UPLOAD_CONCURRENCY } from '@anthropic-ai/sdk/tools/agent-toolset/memories';
import { runSync } from './clock';
import {
  MemoryServer,
  type Received,
  created,
  updated,
  fakeAnthropic,
  retrieveSession,
} from './fake-anthropic';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-sync-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

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

const byPath = (a: Received, b: Received) => String(a[1]).localeCompare(String(b[1]));

test('flush pushes new and changed files and nothing else', async () => {
  const { local, server, stores, logs } = await downloaded({
    'a-pull.md': 'v1',
    'b-push.md': 'v1',
    'd-local-gone.md': 'v1',
    'e-remote-gone.md': 'v1',
    'f-remote-gone-edited.md': 'v1',
    'g-both.md': 'v1',
  });

  fs.writeFileSync(path.join(local, 'b-push.md'), 'v2 from agent');
  fs.writeFileSync(path.join(local, 'c-new.md'), 'new from agent');
  fs.unlinkSync(path.join(local, 'd-local-gone.md'));
  fs.writeFileSync(path.join(local, 'f-remote-gone-edited.md'), 'v2 from agent');
  fs.writeFileSync(path.join(local, 'g-both.md'), 'v2 from agent');
  server.write('a-pull.md', 'v2 from server');
  server.delete('e-remote-gone.md');
  server.delete('f-remote-gone-edited.md');
  server.write('g-both.md', 'v2 from server');

  await stores.flushWrites();

  // Only additions went out: the update, the new file, and the re-created
  // edited file whose remote copy was deleted.
  const sent = [
    updated('b-push.md', 'v2 from agent', 'v1'),
    created('c-new.md', 'new from agent'),
    created('f-remote-gone-edited.md', 'v2 from agent'),
  ];
  expect([...server.received].sort(byPath)).toEqual(sent);
  // A locally missing file was not deleted remotely.
  expect(server.files['d-local-gone.md']).toBe('v1');
  // A remotely deleted, locally unedited memory was not re-uploaded — and
  // its file was not removed from disk either.
  expect(server.files).not.toHaveProperty(['e-remote-gone.md']);
  expect(fs.readFileSync(path.join(local, 'e-remote-gone.md'), 'utf-8')).toBe('v1');
  // Remote changes were not pulled.
  expect(fs.readFileSync(path.join(local, 'a-pull.md'), 'utf-8')).toBe('v1');
  // The conflict was left to the server, and logged.
  expect(server.files['g-both.md']).toBe('v2 from server');
  expect(fs.readFileSync(path.join(local, 'g-both.md'), 'utf-8')).toBe('v2 from agent');
  expect(logs.join('\n')).toContain('changed both locally and remotely');

  // Settled: a second flush pushes nothing more.
  await stores.flushWrites();
  expect([...server.received].sort(byPath)).toEqual(sent);
});

test('flush uploads several files at once up to the bound', async () => {
  const { local, server, stores } = await downloaded({});
  for (let i = 0; i < UPLOAD_CONCURRENCY + 3; i++) {
    fs.writeFileSync(path.join(local, `f${i}.md`), `file ${i}`);
  }

  let inFlight = 0;
  let peak = 0;
  let release: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let timer: NodeJS.Timeout;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('uploads never reached the bound')), 10_000);
  });
  server.uploadHook = async () => {
    peak = Math.max(peak, ++inFlight);
    // Hold the full set briefly so a flush that ignored the bound has time to overshoot.
    if (inFlight === UPLOAD_CONCURRENCY) setTimeout(release, 100);
    try {
      await Promise.race([released, timedOut]);
    } finally {
      inFlight--;
    }
  };
  await stores.flushWrites();
  clearTimeout(timer!);

  expect(peak).toBe(UPLOAD_CONCURRENCY);
  expect(Object.keys(server.files)).toHaveLength(UPLOAD_CONCURRENCY + 3);
}, 20_000);

test('a flush cut off part-way logs how many files it had not uploaded', async () => {
  const { local, server, stores, logs } = await downloaded({});
  for (const name of ['a.md', 'b.md', 'c.md', 'y.md', 'z.md']) {
    fs.writeFileSync(path.join(local, name), `content of ${name}`);
  }

  const cutOff = new AbortController();
  let arrived = 0;
  server.uploadHook = async (p) => {
    // Cut once every upload has reached the server: three went through, two are held open.
    if (++arrived === 5) setImmediate(() => cutOff.abort());
    if (p === 'y.md' || p === 'z.md') await new Promise<void>(() => {});
  };
  await stores.flushWrites(cutOff.signal);

  const cutOffLines = () => logs.filter((l) => l.includes('cut off'));
  expect(cutOffLines()).toHaveLength(1);
  expect(cutOffLines()[0]).toContain(
    'memory flush cut off part-way; 2 of 5 changed files had not finished uploading',
  );
  expect(cutOffLines()[0]).toContain('memstore_notes');
  expect(Object.keys(server.files).sort()).toEqual(['a.md', 'b.md', 'c.md']);

  // The three that made it are not sent again; the two that did not are.
  // A flush that finishes in time adds no cut-off line.
  server.uploadHook = null;
  await stores.flushWrites();
  expect(Object.keys(server.files).sort()).toEqual(['a.md', 'b.md', 'c.md', 'y.md', 'z.md']);
  expect(server.received.map((r) => r[1]).sort()).toEqual(['a.md', 'b.md', 'c.md', 'y.md', 'z.md']);
  expect(cutOffLines()).toHaveLength(1);
});

test('a flush cut off while still listing the store counts every changed file as not uploaded', async () => {
  const { local, server, stores, logs, memories } = await downloaded({});
  fs.writeFileSync(path.join(local, 'a.md'), 'content of a.md');
  fs.writeFileSync(path.join(local, 'b.md'), 'content of b.md');

  const cutOff = new AbortController();
  memories.list = () => ({
    async *[Symbol.asyncIterator]() {
      cutOff.abort();
      await new Promise<void>(() => {});
    },
  });
  await stores.flushWrites(cutOff.signal);

  expect(logs.join('\n')).toContain(
    'memory flush cut off part-way; 2 of 2 changed files had not finished uploading',
  );
  expect(server.received).toEqual([]);
});

test('flush adopts a file the server already holds', async () => {
  // A final sync cut off after uploading a file leaves the baseline stale; the
  // flush sees the server already has those bytes and records that instead of
  // reporting a conflict.
  const { local, server, stores, logs } = await downloaded({ 'n.md': 'v1' });
  fs.writeFileSync(path.join(local, 'n.md'), 'v2');
  server.write('n.md', 'v2');

  await stores.flushWrites();

  expect(server.received).toEqual([]);
  expect(logs.join('\n')).not.toContain('changed both locally and remotely');

  fs.writeFileSync(path.join(local, 'n.md'), 'v3');
  await stores.flushWrites();
  expect(server.received).toEqual([updated('n.md', 'v3', 'v2')]);
});

test('flush never pushes a read-only store', async () => {
  const { local, server, stores } = await downloaded({ 'edit.md': 'v1' }, { access: 'read_only' });

  fs.writeFileSync(path.join(local, 'edit.md'), 'v2 from agent');
  fs.writeFileSync(path.join(local, 'new.md'), 'new from agent');

  await stores.flushWrites();

  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'edit.md': 'v1' });
});

test('flush skips files the server already refused', async () => {
  const { local, server, stores } = await downloaded({ 'note.md': 'v1' });
  server.maxContentBytes = 64;

  fs.writeFileSync(path.join(local, 'big.md'), 'x'.repeat(100));
  await runSync(stores);
  expect(server.received.filter((r) => r[0] === 'create')).toHaveLength(1);

  await stores.flushWrites();

  // The refused file was not retried; nothing else needed pushing.
  expect(server.received.filter((r) => r[0] === 'create')).toHaveLength(1);
  expect(server.files).not.toHaveProperty(['big.md']);
});

test('flush pushes nothing when the marker check fails', async () => {
  const { local, server, stores, logs } = await downloaded({ 'a.md': 'v1' });

  fs.unlinkSync(path.join(local, MARKER_PATH));
  fs.writeFileSync(path.join(local, 'foreign.md'), "someone else's notes");

  await stores.flushWrites();

  expect(server.received).toEqual([]);
  expect(server.files).not.toHaveProperty(['foreign.md']);
  // Unlike sync's recovery, the flush does not re-download the folder.
  expect(fs.existsSync(path.join(local, MARKER_PATH))).toBe(false);
  expect(logs.join('\n')).toContain('not uploading anything from the memory store folder');
});

test('flush never throws', async () => {
  const { local, server, stores, logs, memories } = await downloaded({ 'a.md': 'v1' });
  fs.writeFileSync(path.join(local, 'a.md'), 'v2 from agent');

  memories.list = () => {
    throw new Error('listing exploded');
  };
  await stores.flushWrites();

  expect(server.received).toEqual([]);
  expect(logs.join('\n')).toContain('memory flush failed');
});
