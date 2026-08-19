/**
 * Memory-store sync driven end to end through the real `EnvironmentWorker`.
 *
 * Real: the worker, the `SessionToolRunner`, `SessionMemoryStores`,
 * `FileStore`, and the filesystem. Faked: the network (an in-memory
 * `MemoryServer` plus stub heartbeat/stop and a scripted session event
 * stream) and the clock. So the chain worker → gate on the sessions token →
 * download → `syncIfDue` per tool call → `finish` → `dispose` runs for
 * real against a fake server; assertions read the server and the disk.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EnvironmentWorker } from '@anthropic-ai/sdk/lib/environments';
import {
  SessionMemoryStores,
  type AgentToolContext,
  type MemoryDeleteMode,
} from '@anthropic-ai/sdk/tools/agent-toolset/node';
import * as agentToolset from '@anthropic-ai/sdk/tools/agent-toolset/node';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { MemoryServer, created, updated, fakeAnthropic } from './fake-anthropic';

// Make `setupSkills` and `MEMORY_FLUSH_TIMEOUT_MS` mockable — worker.ts loads
// them from this module lazily.
jest.mock('@anthropic-ai/sdk/tools/agent-toolset/node', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk/tools/agent-toolset/node');
  return { __esModule: true, ...actual, setupSkills: jest.fn(actual.setupSkills) };
});

const REAL_MEMORY_FLUSH_TIMEOUT_MS = agentToolset.MEMORY_FLUSH_TIMEOUT_MS;
let tmp: string;
let dateNow: jest.SpyInstance<number, []>;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-memory-'));
  dateNow = jest.spyOn(Date, 'now');
});
afterEach(() => {
  dateNow.mockRestore();
  setMemoryFlushTimeoutMs(REAL_MEMORY_FLUSH_TIMEOUT_MS);
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Override the worker's bound on each teardown pass for the rest of the test; `afterEach` restores it. */
function setMemoryFlushTimeoutMs(ms: number): void {
  (agentToolset as any).MEMORY_FLUSH_TIMEOUT_MS = ms;
}

/** Encode the token the way the poll response carries it: base64url JSON. */
function encodeSecret(token: string): string {
  return Buffer.from(JSON.stringify({ sessions_token: token })).toString('base64url');
}

function waitUntil(cond: () => boolean, timeoutMs = 5_000): Promise<void> {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (cond()) return resolve();
      if (performance.now() - start > timeoutMs) return reject(new Error('waitUntil timed out'));
      setTimeout(tick, 5);
    };
    tick();
  });
}

/** Run to completion and return the wall-clock milliseconds it took. */
async function runTimed(run: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await run();
  return performance.now() - start;
}

/**
 * An `EnvironmentWorker` pointed at a fake client; one claimed work item's
 * session scripted to dispatch `toolCalls` calls of the `note` tool, which
 * edits the note on disk and jumps the (mocked) clock past the sync interval —
 * so every worker `syncIfDue` poll is due. The stream releases the next tool
 * call only after the previous cadence sync landed, keeping the
 * edit → sync → edit order deterministic.
 */
function fakeSession(opts: {
  token: string | null;
  toolCalls: number;
  intervalMs?: number | null;
  abortAfterFirstSync?: boolean;
  syncDeletions?: MemoryDeleteMode;
  onCall?: (i: number, advance: (ms: number) => void) => void;
  onCtx?: (ctx: AgentToolContext) => void;
  heartbeat?: (workId: string, params: unknown, o?: { signal?: AbortSignal }) => Promise<unknown>;
}): {
  worker: EnvironmentWorker;
  server: MemoryServer;
  local: string;
  logs: string[];
  run: () => Promise<void>;
} {
  const { client: memoryClient, server, logs } = fakeAnthropic({ 'note.md': 'v1' });
  const local = path.join(tmp, 'memory', 'notes');
  const externalAbort = new AbortController();

  let now = 0;
  const advance = (ms: number) => (now += ms);
  dateNow.mockImplementation(() => now);

  const noteTool: BetaRunnableTool = {
    type: 'custom',
    name: 'note',
    description: 'note',
    input_schema: { type: 'object', properties: {} },
    parse: (x: unknown) => x as never,
    run: async (input: unknown) => {
      const i = (input as { i: number }).i;
      if (opts.onCall) {
        opts.onCall(i, advance);
      } else {
        // The agent edits its note, then a long gap passes before the worker's
        // syncIfDue poll — so every poll is due.
        fs.writeFileSync(path.join(local, 'note.md'), `edit ${i}`);
        now += 400_000;
      }
      return 'ok';
    },
  };

  async function* stream(signal?: AbortSignal): AsyncGenerator<unknown> {
    for (let i = 0; i < opts.toolCalls; i++) {
      yield { type: 'agent.tool_use', id: `tu_${i}`, name: 'note', input: { i } };
      // Hold the next call until the worker's cadence sync for this one landed
      // (memory off → nothing to wait for).
      if (opts.token !== null && opts.intervalMs !== null && !opts.onCall) {
        await waitUntil(() => server.received.length === i + 1);
      }
    }
    if (opts.abortAfterFirstSync) {
      // A post-sync edit still on disk when the run is aborted, before any
      // further sync could fire — only the shutdown flush can rescue it.
      fs.writeFileSync(path.join(local, 'note.md'), 'edit after last sync');
      externalAbort.abort();
      if (signal && !signal.aborted) {
        await new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => resolve(), { once: true }),
        );
      }
      return;
    }
    yield { type: 'session.status_terminated', id: 'ev_term' };
  }

  const fake: any = {
    _options: { defaultHeaders: undefined },
    logger: (memoryClient as any).logger,
    logLevel: 'debug',
    withOptions: () => fake,
    beta: {
      sessions: {
        retrieve: (memoryClient as any).beta.sessions.retrieve,
        events: {
          list: () => ({ async *[Symbol.asyncIterator]() {} }),
          send: async () => ({}),
          stream: async (_s: string, _p: unknown, o?: { signal?: AbortSignal }) => stream(o?.signal),
        },
      },
      memoryStores: (memoryClient as any).beta.memoryStores,
      environments: {
        work: {
          heartbeat:
            opts.heartbeat ??
            (async () => ({
              last_heartbeat: 'hb',
              ttl_seconds: 60,
              state: 'running',
              lease_extended: true,
            })),
          stop: async () => ({}),
        },
      },
    },
  };

  const worker = new EnvironmentWorker({
    client: fake,
    workdir: tmp,
    maxIdleMs: 0,
    tools: (ctx) => {
      opts.onCtx?.(ctx);
      return [noteTool];
    },
    ...(opts.intervalMs !== undefined ? { memorySyncIntervalMs: opts.intervalMs } : {}),
    ...(opts.syncDeletions !== undefined ? { memorySyncDeletions: opts.syncDeletions } : {}),
    signal: externalAbort.signal,
  });
  const run = () =>
    worker.handleItem({
      workId: 'w1',
      environmentId: 'e1',
      sessionId: 's1',
      environmentKey: 'ek',
      ...(opts.token !== null ? { workSecret: encodeSecret(opts.token) } : {}),
    });
  return { worker, server, local, logs, run };
}

/** The error for a session whose memories cannot be mounted because the item carried no sessions token. */
const NO_TOKEN_ERROR = 'the work item carried no sessions token';

test('worker syncs on cadence, finishes, and disposes', async () => {
  const { server, local, run } = fakeSession({ token: 'tok', toolCalls: 3 });

  await run();

  // One session fetch, shared by the skills and memory downloads.
  expect(server.retrieves).toEqual(['s1']);
  // Download happened (the file landed on disk before any edit); three
  // cadence syncs pushed edits 0/1/2; the final sync had nothing new.
  expect(server.received).toEqual([
    updated('note.md', 'edit 0', 'v1'),
    updated('note.md', 'edit 1', 'edit 0'),
    updated('note.md', 'edit 2', 'edit 1'),
  ]);
  // Dispose removed the store dir the download created.
  expect(fs.existsSync(local)).toBe(false);
});

test('worker lists the store folders as allowed roots', async () => {
  let seen: AgentToolContext | undefined;
  const { local, run } = fakeSession({ token: 'tok', toolCalls: 1, onCtx: (ctx) => (seen = ctx) });

  await run();

  expect(seen?.allowedRoots).toEqual([local]);
  expect(seen?.readOnlyRoots).toEqual([]);
});

test('worker leaves the allowed roots unset when memory is off', async () => {
  let seen: AgentToolContext | undefined;
  const { run } = fakeSession({ token: 'tok', toolCalls: 1, intervalMs: null, onCtx: (ctx) => (seen = ctx) });

  await run();

  expect(seen).toBeDefined();
  expect(seen?.allowedRoots).toBeUndefined();
});

test('worker fails the item when the sessions token is missing', async () => {
  // The session has a memory store attached but the item carried no sessions
  // token, so its memories cannot be mounted. The item fails before a single
  // tool call is served — running it anyway would give the session amnesia,
  // where a hosted sandbox refuses to start.
  const calls: number[] = [];
  const { server, local, run } = fakeSession({ token: null, toolCalls: 2, onCall: (i) => calls.push(i) });

  await expect(run()).rejects.toThrow(NO_TOKEN_ERROR);

  // The one shared session fetch still happened; no tool call ran, and
  // memory was never touched: no download, no sync, no store dir.
  expect(server.retrieves).toEqual(['s1']);
  expect(calls).toEqual([]);
  expect(server.received).toEqual([]);
  expect(fs.existsSync(local)).toBe(false);
});

test('worker skips memory when the interval is null', async () => {
  const { server, local, run } = fakeSession({ token: 'tok', toolCalls: 2, intervalMs: null });

  await run();

  // Even with a sessions token, memorySyncIntervalMs: null turns memory off
  // entirely: the run resolves and touches no store.
  expect(server.received).toEqual([]);
  expect(fs.existsSync(local)).toBe(false);
});

test('worker stays silent about a missing token when the interval turns memory off', async () => {
  // Both reasons to skip memory at once. The interval knob is the deliberate
  // opt-out and it wins: there is nothing to warn the operator about.
  const { server, local, run } = fakeSession({ token: null, toolCalls: 2, intervalMs: null });

  await run();

  expect(server.received).toEqual([]);
  expect(fs.existsSync(local)).toBe(false);
});

test('worker fails the item when a memory store cannot be downloaded', async () => {
  // A folder already at the store's path is debris from a run that died. The
  // download refuses it and the work item fails, rather than serving a session
  // whose system prompt names a memory folder holding someone else's files.
  const debris = path.join(tmp, 'memory', 'notes');
  fs.mkdirSync(debris, { recursive: true });
  fs.writeFileSync(path.join(debris, 'left-behind.md'), 'from a dead run');

  const { server, run } = fakeSession({ token: 'tok', toolCalls: 2 });

  await expect(run()).rejects.toThrow(/already exists/);

  // Nothing was pushed, and the debris is exactly as it was found.
  expect(server.received).toEqual([]);
  expect(fs.readFileSync(path.join(debris, 'left-behind.md'), 'utf-8')).toBe('from a dead run');
});

test('worker flushes writes when the run is aborted mid-stream', async () => {
  const { server, local, run } = fakeSession({ token: 'tok', toolCalls: 1, abortAfterFirstSync: true });

  await run();

  // The abort skipped the final sync, but the shutdown flush pushed the
  // pending edit before dispose removed the folder.
  expect(server.received).toEqual([
    updated('note.md', 'edit 0', 'v1'),
    updated('note.md', 'edit after last sync', 'edit 0'),
  ]);
  // Dispose still ran on the aborted path.
  expect(fs.existsSync(local)).toBe(false);
});

test('worker clean end syncs once and the flush adds nothing', async () => {
  const { server, local, logs, run } = fakeSession({
    token: 'tok',
    toolCalls: 1,
    onCall: () => fs.writeFileSync(path.join(local, 'note.md'), 'last edit'),
  });

  await run();

  // The clean-end final sync pushed the edit — exactly once. The teardown
  // flush runs after it but finds nothing dirty, so nothing more is sent.
  expect(server.received).toEqual([updated('note.md', 'last edit', 'v1')]);
  // Neither teardown pass hit its time bound.
  expect(logs.join('\n')).not.toContain('cut off');
  expect(fs.existsSync(local)).toBe(false);
});

test('worker flushes after a clean final sync that failed', async () => {
  // finish() swallows its own failures, so a clean stream end whose final
  // sync broke would silently lose the last edits — the teardown flush is
  // their second chance.
  const spy = jest.spyOn(SessionMemoryStores.prototype, 'finish').mockImplementation(async () => {}); // a store-level failure inside the last sync: logged, nothing pushed
  try {
    const { server, local, run } = fakeSession({
      token: 'tok',
      toolCalls: 1,
      onCall: () => fs.writeFileSync(path.join(local, 'note.md'), 'last edit'),
    });

    await run();

    expect(server.files['note.md']).toBe('last edit');
    expect(fs.existsSync(local)).toBe(false);
  } finally {
    spy.mockRestore();
  }
});

test('worker flushes and disposes even when skill teardown throws', async () => {
  // A throwing skill cleanup must not skip the flush or leave the folder
  // behind for the next work item to trip over.
  (agentToolset.setupSkills as jest.Mock).mockImplementationOnce(async () => async () => {
    throw new Error('teardown burp');
  });
  const { server, local, logs, run } = fakeSession({
    token: 'tok',
    toolCalls: 1,
    onCall: () => fs.writeFileSync(path.join(local, 'note.md'), 'edit before burp'),
  });

  await run();

  expect(server.files['note.md']).toBe('edit before burp');
  expect(fs.existsSync(local)).toBe(false);
  expect(logs.join('\n')).toContain('teardown burp');
});

test('worker flush is bounded and teardown still runs', async () => {
  // A flush that hangs is cut off at MEMORY_FLUSH_TIMEOUT_MS and says so; dispose still runs.
  let flushStarted = false;
  const flushSpy = jest.spyOn(SessionMemoryStores.prototype, 'flushWrites').mockImplementation(async () => {
    flushStarted = true;
    await new Promise<void>((r) => setTimeout(r, 5_000).unref());
  });
  try {
    setMemoryFlushTimeoutMs(50);
    const { local, logs, run } = fakeSession({ token: 'tok', toolCalls: 1, abortAfterFirstSync: true });

    const elapsedMs = await runTimed(run);

    expect(flushStarted).toBe(true);
    // Without the timeout the hung flush would hold teardown the full 5s.
    expect(elapsedMs).toBeLessThan(2_000);
    expect(logs.join('\n')).toContain('memory flush cut off after');
    expect(fs.existsSync(local)).toBe(false);
  } finally {
    flushSpy.mockRestore();
  }
});

test('worker final sync is bounded and the flush still runs', async () => {
  // A final sync that hangs is cut off at MEMORY_FLUSH_TIMEOUT_MS and says so;
  // the flush after it still uploads the last edit.
  const finishSpy = jest.spyOn(SessionMemoryStores.prototype, 'finish').mockImplementation(async () => {
    await new Promise<void>((r) => setTimeout(r, 5_000).unref());
  });
  try {
    // The same bound covers the real flush that follows, which must finish
    // inside it even on a loaded CI machine.
    setMemoryFlushTimeoutMs(500);
    const { server, local, logs, run } = fakeSession({
      token: 'tok',
      toolCalls: 1,
      onCall: () => fs.writeFileSync(path.join(local, 'note.md'), 'last edit'),
    });

    const elapsedMs = await runTimed(run);

    expect(elapsedMs).toBeLessThan(2_000);
    expect(logs.join('\n')).toContain('final memory sync cut off after');
    // The flush finished in time, so only the final sync reports a cut-off.
    expect(logs.join('\n')).not.toContain('memory flush cut off after');
    expect(server.files['note.md']).toBe('last edit');
    expect(fs.existsSync(local)).toBe(false);
  } finally {
    finishSpy.mockRestore();
  }
});

test('worker logs what a cut off flush left behind', async () => {
  // One upload never completes: the flush is cut off, the store logs that one
  // of its two changed files did not make it, and the other one did.
  setMemoryFlushTimeoutMs(500);
  const { server, local, logs, run } = fakeSession({
    token: 'tok',
    toolCalls: 1,
    abortAfterFirstSync: true,
    onCall: () => fs.writeFileSync(path.join(local, 'stuck.md'), 'only copy'),
  });
  server.uploadHook = async (p) => {
    if (p === 'stuck.md') await new Promise<void>(() => {});
  };

  const elapsedMs = await runTimed(run);

  expect(elapsedMs).toBeLessThan(3_000);
  expect(server.files['note.md']).toBe('edit after last sync');
  expect(server.files).not.toHaveProperty(['stuck.md']);
  const storeLine = logs.find((l) => l.includes('cut off part-way'));
  expect(storeLine).toContain('1 of 2 changed files had not finished uploading');
  expect(storeLine).toContain('memstore_notes');
  expect(logs.join('\n')).toContain('memory flush cut off after');
  expect(fs.existsSync(local)).toBe(false);
});

test('the last sync runs after the skill teardown', async () => {
  // finish() skips the delete waiting window, so it must only run once
  // nothing can still be rewriting files — after the skill teardown.
  const order: string[] = [];
  (agentToolset.setupSkills as jest.Mock).mockImplementationOnce(async () => async () => {
    order.push('env_teardown');
  });
  const realFinish = SessionMemoryStores.prototype.finish;
  const finishSpy = jest.spyOn(SessionMemoryStores.prototype, 'finish').mockImplementation(async function (
    this: SessionMemoryStores,
  ) {
    order.push('finish');
    return realFinish.call(this);
  });
  try {
    const { server, local, run } = fakeSession({
      token: 'tok',
      toolCalls: 1,
      onCall: () => fs.writeFileSync(path.join(local, 'note.md'), 'last edit'),
    });

    await run();

    expect(order).toEqual(['env_teardown', 'finish']);
    expect(server.files['note.md']).toBe('last edit');
    expect(fs.existsSync(local)).toBe(false);
  } finally {
    finishSpy.mockRestore();
  }
});

test('the lease is heartbeated until the memory teardown is done', async () => {
  // The lease must not lapse while the final sync, flush and dispose still
  // hold the folder.
  const order: string[] = [];
  const realDispose = SessionMemoryStores.prototype.dispose;
  const disposeSpy = jest.spyOn(SessionMemoryStores.prototype, 'dispose').mockImplementation(async function (
    this: SessionMemoryStores,
  ) {
    await realDispose.call(this);
    order.push('folder removed');
  });
  try {
    const { run } = fakeSession({
      token: 'tok',
      toolCalls: 1,
      // A heartbeat held open until the worker ends the lease, which is when
      // it stops heartbeating.
      heartbeat: (_id, _params, o) =>
        new Promise(
          (_, reject) =>
            o?.signal?.addEventListener('abort', () => {
              order.push('heartbeat stopped');
              reject(o.signal?.reason);
            }),
        ),
    });

    await run();

    expect(order).toEqual(['folder removed', 'heartbeat stopped']);
  } finally {
    disposeSpy.mockRestore();
  }
});

test('worker can turn remote deletes off', async () => {
  // `memorySyncDeletions: "disabled"` reaches the stores: a local deletion
  // never propagates however many syncs run, while uploads still do.
  const { server, local, run } = fakeSession({
    token: 'tok',
    toolCalls: 3,
    syncDeletions: 'disabled',
    onCall: (i, advance) => {
      if (i === 0) {
        fs.unlinkSync(path.join(local, 'note.md'));
        fs.writeFileSync(path.join(local, 'new.md'), 'survives');
      }
      // Every gap dwarfs both the sync interval and the corroboration window.
      advance(400_000);
    },
  });

  await run();

  expect(server.files['note.md']).toBe('v1');
  expect(server.received).toEqual([created('new.md', 'survives')]);
});
