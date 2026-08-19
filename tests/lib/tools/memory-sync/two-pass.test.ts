/**
 * The sync's two passes: a content-free listing, then targeted fetches.
 *
 * A sync lists shas only (`basic` view) and fetches a memory's body just
 * before writing it to disk; only the download takes `full` pages, since it
 * needs every memory anyway. These tests pin that fetch discipline: a sync
 * that writes nothing fetches nothing, a changed path fetches exactly itself,
 * fetches fan out rather than queue, and a fetch that fails — or races a
 * server-side delete — leaves the old state for the next sync.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SessionMemoryStores } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { runSync } from './clock';
import { MemoryServer, updated, fakeAnthropic, retrieveSession, statusError } from './fake-anthropic';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-sync-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), 'utf-8');
const write = (dir: string, rel: string, content: string) => fs.writeFileSync(path.join(dir, rel), content);

/** A `SessionMemoryStores` with one store already downloaded to disk. */
async function downloaded(initial: Record<string, string>): Promise<{
  local: string;
  server: MemoryServer;
  stores: SessionMemoryStores;
  memories: ReturnType<typeof fakeAnthropic>['memories'];
}> {
  const { client, server, memories } = fakeAnthropic(initial);
  const stores = new SessionMemoryStores(client, { workdir: tmp });
  await stores.download(await retrieveSession(client));
  return { local: path.join(tmp, 'memory', 'notes'), server, stores, memories };
}

test('a sync that pulls nothing fetches no content', async () => {
  const { local, server, stores } = await downloaded({ 'a.md': 'v1', 'b.md': 'v1', 'c.md': 'v1' });
  // The download took full listing pages: no single-memory fetches at all.
  expect(server.contentFetches).toEqual([]);

  write(local, 'a.md', 'v2 from agent'); // a push needs no remote content
  await runSync(stores);

  expect(server.contentFetches).toEqual([]);
  expect(server.files['a.md']).toBe('v2 from agent');
});

test('only the changed memory is fetched', async () => {
  const { local, server, stores } = await downloaded({ 'a.md': 'v1', 'b.md': 'v1' });
  server.contentFetches.length = 0;

  server.write('a.md', 'v2 from server');
  await runSync(stores);

  expect(server.contentFetches).toEqual(['a.md']);
  expect(read(local, 'a.md')).toBe('v2 from server');
  expect(read(local, 'b.md')).toBe('v1');
});

test('a file already holding the remote content is adopted without a fetch', async () => {
  const { local, server, stores } = await downloaded({ 'a.md': 'v1' });
  server.contentFetches.length = 0;

  // Both sides landed on the same bytes independently.
  write(local, 'a.md', 'v2 on both');
  server.write('a.md', 'v2 on both');
  await runSync(stores);

  expect(server.contentFetches).toEqual([]);
  expect(server.received).toEqual([]);

  // The baseline advanced to the adopted sha: the next edit pushes guarded by it.
  write(local, 'a.md', 'v3 from agent');
  await runSync(stores);
  expect(server.received).toEqual([updated('a.md', 'v3 from agent', 'v2 on both')]);
});

test('content fetches fan out within a store', async () => {
  // The first memory's fetch completes only after the second's starts — only
  // parallel fetches satisfy that; serial ones would time out.
  const { local, server, stores, memories } = await downloaded({ 'a.md': 'v1', 'b.md': 'v1' });
  server.write('a.md', 'v2 from server');
  server.write('b.md', 'v2 from server');

  let secondStarted: () => void;
  const started = new Promise<void>((resolve) => (secondStarted = resolve));
  let timer: NodeJS.Timeout;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('second fetch never started')), 10_000);
  });

  const realRetrieve = memories.retrieve.bind(memories);
  memories.retrieve = async (memoryId, params) => {
    if (memoryId === 'mem:a.md') {
      await Promise.race([started, timedOut]);
    } else {
      secondStarted();
    }
    return realRetrieve(memoryId, params);
  };
  await runSync(stores);
  clearTimeout(timer!);

  expect(read(local, 'a.md')).toBe('v2 from server');
  expect(read(local, 'b.md')).toBe('v2 from server');
}, 20_000);

test('a failed fetch keeps the old state and the next sync retries', async () => {
  const { local, server, stores } = await downloaded({ 'a.md': 'v1' });
  server.write('a.md', 'v2 from server');

  server.fetchHook = () => {
    throw statusError(500);
  };
  await runSync(stores);
  expect(read(local, 'a.md')).toBe('v1');

  server.fetchHook = null;
  await runSync(stores);
  expect(read(local, 'a.md')).toBe('v2 from server');
  // The stale baseline drove no uploads or deletes along the way.
  expect(server.received).toEqual([]);
});

test('a memory deleted between listing and fetch waits for the next sync', async () => {
  const { local, server, stores } = await downloaded({ 'a.md': 'v1', 'keep.md': 'v1' });
  server.write('a.md', 'v2 from server');

  server.fetchHook = (p) => {
    delete server.files[p];
  };
  await runSync(stores);
  // The fetch 404ed: disk and baseline keep the old version for now.
  expect(read(local, 'a.md')).toBe('v1');

  server.fetchHook = null;
  await runSync(stores);
  // The next sync saw the server-side delete and took the local copy with it.
  expect(fs.existsSync(path.join(local, 'a.md'))).toBe(false);
  expect(server.received).toEqual([]);
});
