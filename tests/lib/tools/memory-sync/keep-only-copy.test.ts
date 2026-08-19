/**
 * Never destroy the only copy of a local edit: a memory deleted remotely
 * while its file holds an un-pushed edit keeps the file — a writable store
 * re-creates the memory from it, a read-only store keeps it on disk unsynced.
 * Only an unedited file follows the remote delete off the disk.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SessionMemoryStores } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { FileStore, LocalFileStore } from '@anthropic-ai/sdk/internal/file-store';
import { runSync } from './clock';
import {
  MemoryServer,
  created,
  updated,
  fakeAnthropic,
  listingInterruptedBy,
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

test('an edited file survives a remote delete and is re-created', async () => {
  const { local, server, stores, logs } = await downloaded({ 'edited.md': 'v1', 'plain.md': 'v1' });
  fs.writeFileSync(path.join(local, 'edited.md'), 'v2 from agent');
  server.delete('edited.md');
  server.delete('plain.md');

  await runSync(stores);

  // The edit's only copy survives and the memory is re-created from it;
  // the unedited file follows the remote delete off the disk.
  expect(fs.readFileSync(path.join(local, 'edited.md'), 'utf-8')).toBe('v2 from agent');
  expect(server.files).toEqual({ 'edited.md': 'v2 from agent' });
  expect(server.received).toEqual([created('edited.md', 'v2 from agent')]);
  expect(fs.existsSync(path.join(local, 'plain.md'))).toBe(false);
  expect(logs.join('\n')).toContain('re-creating it from the file');

  // Settled: nothing more goes out.
  await runSync(stores);
  expect(server.received).toEqual([created('edited.md', 'v2 from agent')]);

  // The upload's sha became the baseline: the next edit is a guarded update.
  fs.writeFileSync(path.join(local, 'edited.md'), 'v3');
  await runSync(stores);
  expect(server.received[server.received.length - 1]).toEqual(updated('edited.md', 'v3', 'v2 from agent'));
});

test('a read-only store keeps the edited file without pushing', async () => {
  const { local, server, stores, logs } = await downloaded(
    { 'edited.md': 'v1', 'plain.md': 'v1' },
    { access: 'read_only' },
  );
  fs.writeFileSync(path.join(local, 'edited.md'), 'v2 from agent');
  server.delete('edited.md');
  server.delete('plain.md');

  await runSync(stores);

  expect(fs.readFileSync(path.join(local, 'edited.md'), 'utf-8')).toBe('v2 from agent');
  expect(fs.existsSync(path.join(local, 'plain.md'))).toBe(false);
  expect(server.received).toEqual([]);
  expect(logs.filter((l) => l.includes('cannot push'))).toHaveLength(1);

  // Later passes see a local-only file in a read-only store: a quiet no-op.
  await runSync(stores);
  await runSync(stores);
  expect(server.received).toEqual([]);
  expect(fs.readFileSync(path.join(local, 'edited.md'), 'utf-8')).toBe('v2 from agent');
  expect(logs.filter((l) => l.includes('cannot push'))).toHaveLength(1);
});

test('a refused edit survives a remote delete without a retry', async () => {
  // The server already refused this content, so the remote delete neither
  // removes the file nor triggers a re-create the server would refuse again.
  const { local, server, stores } = await downloaded({ 'big.md': 'v1' });
  server.maxContentBytes = 64;

  fs.writeFileSync(path.join(local, 'big.md'), 'x'.repeat(100));
  await runSync(stores);
  expect(server.received).toHaveLength(1); // the one refused update

  server.delete('big.md');
  await runSync(stores);
  await runSync(stores);

  expect(fs.readFileSync(path.join(local, 'big.md'), 'utf-8')).toBe('x'.repeat(100));
  expect(server.received).toHaveLength(1);
  expect(server.files).not.toHaveProperty(['big.md']);
});

test('a memory deleted between the listing and the update is re-created', async () => {
  // An update that meets a 404 re-creates the memory in the same pass.
  const { local, server, stores } = await downloaded({ 'note.md': 'v1' });
  fs.writeFileSync(path.join(local, 'note.md'), 'v2 from agent');

  server.uploadHook = (p) => {
    server.delete(p);
    server.uploadHook = null;
  };
  await runSync(stores);

  expect(server.files).toEqual({ 'note.md': 'v2 from agent' });
  expect(server.received).toEqual([
    updated('note.md', 'v2 from agent', 'v1'),
    created('note.md', 'v2 from agent'),
  ]);

  // The create's sha is the new baseline.
  fs.writeFileSync(path.join(local, 'note.md'), 'v3');
  await runSync(stores);
  expect(server.received.at(-1)).toEqual(updated('note.md', 'v3', 'v2 from agent'));
});

test('an edit written mid-sync still survives a remote delete', async () => {
  // The directory scan saw the file unedited; an edit is written while
  // the server listing is in flight. The removal must re-read the file
  // instead of destroying the edit based on the stale scan.
  const { local, server, stores, memories } = await downloaded({ 'z.md': 'v1', 'keep.md': 'v1' });
  server.delete('z.md');

  await listingInterruptedBy(
    memories,
    () => fs.writeFileSync(path.join(local, 'z.md'), 'late edit'),
    () => runSync(stores),
  );

  expect(fs.readFileSync(path.join(local, 'z.md'), 'utf-8')).toBe('late edit');
  expect(server.files['z.md']).toBe('late edit');
});

test('a read-only pull over a local edit is warned', async () => {
  // Read-only stores always take the server version, but overwriting a
  // local edit must leave a trace instead of happening silently.
  const { local, server, stores, logs } = await downloaded({ 'pull.md': 'v1' }, { access: 'read_only' });
  fs.writeFileSync(path.join(local, 'pull.md'), 'local edit');
  server.write('pull.md', 'v2 from server');

  await runSync(stores);

  expect(fs.readFileSync(path.join(local, 'pull.md'), 'utf-8')).toBe('v2 from server');
  expect(server.received).toEqual([]);
  expect(logs.join('\n')).toContain('changed both locally and remotely');
});

test('a failed re-read does not resurrect a server-deleted memory', async () => {
  // The re-read before removal can fail (a transient I/O error). That must
  // mean "retry next sync", not "file gone": dropping the entry would make
  // the next sync upload the file as new, re-creating the memory the server
  // just deleted.
  const { local, server, stores } = await downloaded({ 'z.md': 'v1', 'keep.md': 'v1' });
  server.delete('z.md');

  const realHashFile = LocalFileStore.prototype.hashFile;
  const flakyHashFile = jest.spyOn(LocalFileStore.prototype, 'hashFile').mockImplementation(async function (
    this: FileStore,
    rel: string,
  ) {
    if (rel === 'z.md') throw Object.assign(new Error('I/O error'), { code: 'EIO' });
    return realHashFile.call(this, rel);
  });
  await runSync(stores);
  flakyHashFile.mockRestore();

  // The error held everything: file still on disk, nothing pushed.
  expect(fs.readFileSync(path.join(local, 'z.md'), 'utf-8')).toBe('v1');
  expect(server.received).toEqual([]);

  // With the error gone, the next sync completes the server delete.
  await runSync(stores);
  expect(fs.existsSync(path.join(local, 'z.md'))).toBe(false);
  expect(server.files).not.toHaveProperty(['z.md']);
  expect(server.received).toEqual([]);
});
