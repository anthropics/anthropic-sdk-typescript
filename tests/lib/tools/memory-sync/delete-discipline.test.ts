/**
 * Server-delete discipline: a locally deleted file is deleted on the server
 * only after a second sync confirms it, at a bounded rate per sync, and only
 * when server deletes are enabled at all.
 *
 * The first sync that sees the file missing records it; a later sync — after
 * {@link DELETE_CORROBORATION_MS} (skipped on the session's final `finish()`,
 * the session's last sync) and a re-check that the file is still gone and the
 * marker still intact — sends the DELETE. Each sync sends a bounded number
 * of deletes; `syncDeletions: "log_only"` only logs them, and
 * `"disabled"` sends none, ever.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SessionMemoryStores, type MemoryDeleteMode } from '@anthropic-ai/sdk/tools/agent-toolset/node';
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

const ELAPSED = DELETE_CORROBORATION_MS + 1;

let tmp: string;
let clock: Clock;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-sync-'));
  clock = new Clock();
});
afterEach(() => {
  clock.restore();
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** A `SessionMemoryStores` with one store already downloaded to disk. */
async function downloaded(
  initial: Record<string, string>,
  syncDeletions: MemoryDeleteMode = 'enabled',
): Promise<{
  local: string;
  server: MemoryServer;
  stores: SessionMemoryStores;
  logs: string[];
  memories: ReturnType<typeof fakeAnthropic>['memories'];
}> {
  const { client, server, logs, memories } = fakeAnthropic(initial);
  const stores = new SessionMemoryStores(client, { workdir: tmp, syncDeletions });
  await stores.download(await retrieveSession(client));
  return { local: path.join(tmp, 'memory', 'notes'), server, stores, logs, memories };
}

test('a local deletion is confirmed before it reaches the server', async () => {
  const { local, server, stores } = await downloaded({ 'a.md': 'v1', 'keep.md': 'v1' });
  fs.unlinkSync(path.join(local, 'a.md'));

  // The first pass only records the absence.
  await runSync(stores);
  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'a.md': 'v1', 'keep.md': 'v1' });

  // Still inside the window: nothing goes out.
  clock.now = DELETE_CORROBORATION_MS - 1;
  await runSync(stores);
  expect(server.received).toEqual([]);

  // Window elapsed and the file is still gone: the guarded delete is sent.
  clock.now = ELAPSED;
  await runSync(stores);
  expect(server.received).toEqual([deleted('a.md', 'v1')]);
  expect(server.files).toEqual({ 'keep.md': 'v1' });
});

test('a file that reappears is not deleted and leaves pending', async () => {
  const { local, server, stores } = await downloaded({ 'a.md': 'v1' });
  fs.unlinkSync(path.join(local, 'a.md'));
  await runSync(stores);

  fs.writeFileSync(path.join(local, 'a.md'), 'v1');
  clock.now = ELAPSED;
  await runSync(stores);
  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'a.md': 'v1' });

  // The reappearance cleared the pending entry: deleting again starts a
  // fresh window instead of firing on the stale observation.
  fs.unlinkSync(path.join(local, 'a.md'));
  await runSync(stores);
  expect(server.received).toEqual([]);
  clock.now = 2 * ELAPSED;
  await runSync(stores);
  expect(server.received).toEqual([deleted('a.md', 'v1')]);
});

test('disabled mode never deletes but still syncs', async () => {
  const { local, server, stores, logs } = await downloaded(
    { 'gone.md': 'v1', 'push.md': 'v1', 'pull.md': 'v1' },
    'disabled',
  );
  fs.unlinkSync(path.join(local, 'gone.md'));
  fs.writeFileSync(path.join(local, 'push.md'), 'v2 from agent');
  server.write('pull.md', 'v2 from server');

  await runSync(stores);
  clock.now = ELAPSED;
  await runSync(stores);
  clock.now = 2 * ELAPSED;
  await runSync(stores);

  // Uploads and pulls still flow; the deletion never does.
  expect(server.received).toEqual([updated('push.md', 'v2 from agent', 'v1')]);
  expect(server.files).toEqual({
    'gone.md': 'v1',
    'push.md': 'v2 from agent',
    'pull.md': 'v2 from server',
  });
  expect(fs.readFileSync(path.join(local, 'pull.md'), 'utf-8')).toBe('v2 from server');
  expect(logs.join('\n')).toContain('remote deletes are disabled');
});

test('the per-pass cap spreads deletes over passes', async () => {
  const files: Record<string, string> = {};
  for (let i = 0; i < 14; i++) files[`f${String(i).padStart(2, '0')}.md`] = 'v1';
  const { local, server, stores, logs } = await downloaded(files);
  const doomed = Object.keys(files).sort().slice(0, 12);
  for (const name of doomed) fs.unlinkSync(path.join(local, name));

  await runSync(stores);
  expect(server.received).toEqual([]);

  // cap = max(8, min(50, 14 // 4)) = 8: the first confirming sync stops there.
  clock.now = ELAPSED;
  await runSync(stores);
  expect(server.received).toEqual(doomed.slice(0, 8).map((name) => deleted(name, 'v1')));
  expect(logs.join('\n')).toContain('delete cap reached: sent 8 deletes, held 4 for later syncs');

  // The held-back deletions confirm on the next pass.
  await runSync(stores);
  expect(server.received).toEqual(doomed.map((name) => deleted(name, 'v1')));
  const survivors = Object.keys(files).sort().slice(12);
  expect(server.files).toEqual(Object.fromEntries(survivors.map((name) => [name, 'v1'])));
});

test('the final sync waives the window but still re-checks', async () => {
  // A deletion made in a session shorter than the waiting window still
  // goes through: the final sync skips the wait, and the re-check just
  // before the delete stands in for the second observation.
  const { local, server, stores } = await downloaded({ 'a.md': 'v1', 'keep.md': 'v1' });
  fs.unlinkSync(path.join(local, 'a.md'));

  await stores.finish();

  expect(server.received).toEqual([deleted('a.md', 'v1')]);
  expect(server.files).toEqual({ 'keep.md': 'v1' });
});

test('a folder destroyed mid-sync sends no deletes', async () => {
  // The directory scan saw an intact folder, then the folder vanished
  // while the server listing was in flight: the re-check just before the
  // delete must notice the marker is gone and hold every delete.
  const { local, server, stores, memories } = await downloaded({ 'a.md': 'v1', 'keep.md': 'v1' });
  fs.unlinkSync(path.join(local, 'a.md'));
  await runSync(stores);
  clock.now = ELAPSED;

  await listingInterruptedBy(
    memories,
    () => fs.rmSync(local, { recursive: true, force: true }),
    () => runSync(stores),
  );

  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'a.md': 'v1', 'keep.md': 'v1' });
});

test('an unreadable subdirectory fails the pass instead of reading as deletions', async () => {
  // Files under a directory the scan cannot enter are not treated as deleted.
  if (process.getuid?.() === 0) return; // directory modes do not bind root
  const { local, server, stores, logs } = await downloaded({
    'sub/a.md': 'v1',
    'sub/b.md': 'v1',
    'top.md': 'v1',
  });
  fs.writeFileSync(path.join(local, 'top.md'), 'v2');
  fs.chmodSync(path.join(local, 'sub'), 0o000);
  try {
    await runSync(stores);
    clock.now = ELAPSED;
    await runSync(stores);
  } finally {
    fs.chmodSync(path.join(local, 'sub'), 0o700);
  }
  expect(server.received).toEqual([]);
  expect(logs.filter((l) => l.includes('memory sync failed'))).toHaveLength(2);

  // Readable again: the edit goes out and nothing is deleted.
  clock.now = 2 * ELAPSED;
  await runSync(stores);
  expect(server.received).toEqual([updated('top.md', 'v2', 'v1')]);
  expect(server.files).toEqual({ 'sub/a.md': 'v1', 'sub/b.md': 'v1', 'top.md': 'v2' });
});

test('a recovery re-download clears pending deletes', async () => {
  // The re-download rebuilt the disk, so an absence observed before it says
  // nothing about the rebuilt folder.
  const { local, server, stores } = await downloaded({ 'a.md': 'v1' });
  fs.unlinkSync(path.join(local, 'a.md'));
  await runSync(stores);

  clock.now = ELAPSED;
  fs.rmSync(local, { recursive: true, force: true });
  await runSync(stores);
  expect(fs.readFileSync(path.join(local, 'a.md'), 'utf-8')).toBe('v1');

  // A fresh deletion starts a fresh window — the pre-recovery observation
  // must not corroborate it.
  fs.unlinkSync(path.join(local, 'a.md'));
  await runSync(stores);
  expect(server.received).toEqual([]);
  clock.now = 2 * ELAPSED;
  await runSync(stores);
  expect(server.received).toEqual([deleted('a.md', 'v1')]);
});

test('log-only mode logs the delete but never sends it', async () => {
  // The dry-run setting: the full pipeline runs — window, re-checks, cap —
  // but the confirmed delete is logged instead of sent, on every sync while
  // the file stays missing.
  const { local, server, stores, logs } = await downloaded({ 'a.md': 'v1', 'keep.md': 'v1' }, 'log_only');
  fs.unlinkSync(path.join(local, 'a.md'));

  await runSync(stores);
  expect(logs.join('\n')).not.toContain('log-only'); // still inside the waiting window

  clock.now = ELAPSED;
  await runSync(stores);
  await runSync(stores);

  expect(server.received).toEqual([]);
  expect(server.files).toEqual({ 'a.md': 'v1', 'keep.md': 'v1' });
  const wouldDelete = logs.filter(
    (l) => l.includes('log-only: sync would delete this memory on the server') && l.includes('a.md'),
  );
  expect(wouldDelete).toHaveLength(2);
});

test('finish runs once and a second call throws', async () => {
  const { local, server, stores } = await downloaded({ 'a.md': 'v1' });
  fs.writeFileSync(path.join(local, 'a.md'), 'v2');

  await stores.finish();
  expect(server.files).toEqual({ 'a.md': 'v2' });

  await expect(stores.finish()).rejects.toThrow(/finish/);
});
