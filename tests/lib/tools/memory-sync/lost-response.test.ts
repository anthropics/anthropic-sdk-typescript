/**
 * An upload whose response never arrives.
 *
 * The server can save a create or update and the response still be lost — a
 * timeout, a dropped connection. The sync then cannot tell whether the bytes
 * landed. If they did, the server's copy is the sync's own upload, not
 * another writer's edit, and a newer local edit must go out over it.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { APIConnectionError } from '@anthropic-ai/sdk/core/error';
import { SessionMemoryStores } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { runSync } from './clock';
import { MemoryServer, created, deleted, updated, fakeAnthropic, retrieveSession } from './fake-anthropic';

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

type Memories = ReturnType<typeof fakeAnthropic>['memories'];

/** A `SessionMemoryStores` with one store already downloaded to disk. */
async function downloaded(initial: Record<string, string>): Promise<{
  local: string;
  server: MemoryServer;
  stores: SessionMemoryStores;
  logs: string[];
  memories: Memories;
}> {
  const { client, server, logs, memories } = fakeAnthropic(initial);
  const stores = new SessionMemoryStores(client, { workdir: tmp });
  await stores.download(await retrieveSession(client));
  return { local: path.join(tmp, 'memory', 'notes'), server, stores, logs, memories };
}

/**
 * While `run` is in flight every create and update throws a connection
 * error — after the server has saved the write (the response was lost) or
 * before it arrived at all.
 */
async function withUploadsFailing(
  memories: Memories,
  opts: { afterSaving: boolean },
  run: () => Promise<void>,
): Promise<void> {
  const realCreate = memories.create.bind(memories);
  const realUpdate = memories.update.bind(memories);
  const failing =
    <A extends unknown[]>(send: (...args: A) => Promise<unknown>) =>
    async (...args: A): Promise<unknown> => {
      if (opts.afterSaving) await send(...args);
      throw new APIConnectionError({ message: 'Connection error.' });
    };
  memories.create = failing(realCreate);
  memories.update = failing(realUpdate);
  try {
    await run();
  } finally {
    memories.create = realCreate;
    memories.update = realUpdate;
  }
}

test('an edit made after a lost upload response still reaches the server', async () => {
  const { local, server, stores, memories } = await downloaded({ 'note.md': 'v0' });

  write(local, 'note.md', 'v1');
  write(local, 'new.md', 'v1');
  await withUploadsFailing(memories, { afterSaving: true }, () => runSync(stores));
  // The server holds both writes; the sync never heard back.
  expect(server.files).toEqual({ 'note.md': 'v1', 'new.md': 'v1' });

  write(local, 'note.md', 'v2');
  write(local, 'new.md', 'v2');
  await runSync(stores);

  // The server's v1 was this sync's own upload, so v2 goes out over it.
  expect(server.files).toEqual({ 'note.md': 'v2', 'new.md': 'v2' });
  expect(read(local, 'note.md')).toBe('v2');
  expect(read(local, 'new.md')).toBe('v2');
  expect(server.received).toEqual([
    created('new.md', 'v1'),
    updated('note.md', 'v1', 'v0'),
    updated('new.md', 'v2', 'v1'),
    updated('note.md', 'v2', 'v1'),
  ]);

  // Settled: nothing more to send.
  await runSync(stores);
  expect(server.received).toHaveLength(4);
});

test('a retry whose response is lost is remembered too', async () => {
  const { local, server, stores, memories } = await downloaded({ 'note.md': 'v0' });

  write(local, 'note.md', 'v1');
  await withUploadsFailing(memories, { afterSaving: false }, () => runSync(stores));
  // The retry sends the same bytes; this time they land and the response is lost.
  await withUploadsFailing(memories, { afterSaving: true }, () => runSync(stores));
  expect(server.files['note.md']).toBe('v1');

  write(local, 'note.md', 'v2');
  await runSync(stores);

  expect(server.files['note.md']).toBe('v2');
  expect(read(local, 'note.md')).toBe('v2');
});

test('a client retry refused because the first attempt landed is remembered', async () => {
  // The client's own retry re-sends the update with the old precondition; the
  // first attempt already moved the server, so the retry gets a 409.
  const { local, server, stores, memories } = await downloaded({ 'note.md': 'v0' });
  const realUpdate = memories.update.bind(memories);

  write(local, 'note.md', 'v1');
  memories.update = async (...args: Parameters<typeof realUpdate>) => {
    await realUpdate(...args);
    return realUpdate(...args);
  };
  await runSync(stores);
  memories.update = realUpdate;
  expect(server.files['note.md']).toBe('v1');
  expect(server.received).toEqual([updated('note.md', 'v1', 'v0'), updated('note.md', 'v1', 'v0')]);

  write(local, 'note.md', 'v2');
  await runSync(stores);

  expect(server.files['note.md']).toBe('v2');
  expect(read(local, 'note.md')).toBe('v2');
});

test('a deletion made after a lost upload response still reaches the server', async () => {
  const { local, server, stores, memories } = await downloaded({ 'note.md': 'v0', 'keep.md': 'v0' });

  write(local, 'note.md', 'v1');
  write(local, 'new.md', 'v1');
  await withUploadsFailing(memories, { afterSaving: true }, () => runSync(stores));
  fs.rmSync(path.join(local, 'note.md'));
  fs.rmSync(path.join(local, 'new.md'));

  await stores.finish();

  // The server's copies are this sync's own uploads, so the deletions go out,
  // guarded by the content that was sent.
  expect(server.files).toEqual({ 'keep.md': 'v0' });
  expect(server.received.slice(-2)).toEqual([deleted('new.md', 'v1'), deleted('note.md', 'v1')]);
});

test('a folder wiped after a lost create response is rebuilt, not read as deletions', async () => {
  const { local, server, stores, memories } = await downloaded({ 'note.md': 'v0' });

  write(local, 'new.md', 'v1');
  await withUploadsFailing(memories, { afterSaving: true }, () => runSync(stores));
  // Both files vanish at once; the marker stays.
  fs.rmSync(path.join(local, 'note.md'));
  fs.rmSync(path.join(local, 'new.md'));

  // The final sync waives the delete window, so a misread wipe would delete at once.
  await stores.finish();

  // Two known files gone together is a wipe: re-downloaded, nothing deleted.
  expect(server.files).toEqual({ 'note.md': 'v0', 'new.md': 'v1' });
  expect(read(local, 'note.md')).toBe('v0');
  expect(read(local, 'new.md')).toBe('v1');
  expect(server.received).toEqual([created('new.md', 'v1')]);
});

test('the shutdown flush pushes a revert made after a lost upload response', async () => {
  const { local, server, stores, memories } = await downloaded({ 'note.md': 'v0' });

  write(local, 'note.md', 'v1');
  await withUploadsFailing(memories, { afterSaving: true }, () => runSync(stores));
  // Back to the last content the sync knows it saved — but the server moved on.
  write(local, 'note.md', 'v0');

  await stores.flushWrites();

  expect(server.files['note.md']).toBe('v0');
  expect(server.received.at(-1)).toEqual(updated('note.md', 'v0', 'v1'));
});

test('the shutdown flush sends nothing for a revert whose upload never landed', async () => {
  const { local, server, stores, memories } = await downloaded({ 'note.md': 'v0', 'keep.md': 'v0' });

  write(local, 'note.md', 'v1');
  await withUploadsFailing(memories, { afterSaving: false }, () => runSync(stores));
  write(local, 'note.md', 'v0');
  // Another writer deletes the memory; the file holds no edit to save.
  server.delete('note.md');

  await stores.flushWrites();

  expect(server.files).toEqual({ 'keep.md': 'v0' });
  expect(server.received).toEqual([]);
});

test('the shutdown flush pushes an edit made after a lost upload response', async () => {
  const { local, server, stores, memories } = await downloaded({ 'note.md': 'v0' });

  write(local, 'note.md', 'v1');
  await withUploadsFailing(memories, { afterSaving: true }, () => runSync(stores));
  write(local, 'note.md', 'v2');

  await stores.flushWrites();

  expect(server.files['note.md']).toBe('v2');
  expect(server.received.at(-1)).toEqual(updated('note.md', 'v2', 'v1'));
});

test("another writer's edit after a lost upload response still wins", async () => {
  const { local, server, stores, logs, memories } = await downloaded({ 'note.md': 'v0' });

  write(local, 'note.md', 'v1');
  await withUploadsFailing(memories, { afterSaving: true }, () => runSync(stores));
  server.write('note.md', 'theirs');
  write(local, 'note.md', 'v2');

  await runSync(stores);

  // The server's copy is not what this sync sent, so the usual conflict rule holds.
  expect(server.files['note.md']).toBe('theirs');
  expect(read(local, 'note.md')).toBe('theirs');
  expect(logs.join('\n')).toContain('changed both locally and remotely');
});

test('a send is forgotten once a later sync has seen the server', async () => {
  // A remembered send must not outlive the next completed sync: kept longer,
  // it would mistake another writer's identical bytes for this sync's upload
  // and overwrite them.
  const { local, server, stores, logs, memories } = await downloaded({ 'note.md': 'v0' });

  write(local, 'note.md', 'v1');
  await withUploadsFailing(memories, { afterSaving: false }, () => runSync(stores));
  expect(server.files['note.md']).toBe('v0');

  // The agent reverts, so the next sync has nothing to send — its listing
  // shows the v1 upload never landed.
  write(local, 'note.md', 'v0');
  await runSync(stores);

  // Another writer now saves the very bytes that failed upload carried.
  server.write('note.md', 'v1');
  write(local, 'note.md', 'v2');
  await runSync(stores);

  expect(server.files['note.md']).toBe('v1');
  expect(read(local, 'note.md')).toBe('v1');
  expect(logs.join('\n')).toContain('changed both locally and remotely');
  expect(server.received).toEqual([]);
});
