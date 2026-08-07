import { EnvironmentWorker } from '@anthropic-ai/sdk/lib/environments';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { APIError } from '@anthropic-ai/sdk/core/error';

// =====
// Test fakes
//
// EnvironmentWorker = WorkPoller (claim work) + per-session SessionToolRunner
// + a parallel lease heartbeat + force-stop on exit. We fake the whole client
// surface those touch so we can drive one claimed session end-to-end.
// =====

type AnyEvent = Record<string, unknown> & { type: string };

interface WorkerCalls {
  poll: number;
  ack: number;
  heartbeat: number;
  stop: { force?: boolean }[];
  send: AnyEvent[][];
  retrieve: number;
  withOptions: Array<Record<string, unknown>>;
  // The `options` (last) argument captured per control-plane / session method.
  opts: Record<string, unknown[]>;
  // `[level, message]` for every warn/error the worker logged.
  logs: Array<[string, string]>;
}

type HeartbeatResponse = {
  last_heartbeat: string;
  ttl_seconds: number;
  state: string;
  lease_extended: boolean;
};

function makeFake(opts: {
  sessionStream: AnyEvent[];
  /** Script the lease heartbeat per call (1-based); defaults to a healthy 60 s lease. */
  heartbeat?: (call: number, options?: { signal?: AbortSignal }) => Promise<HeartbeatResponse>;
}) {
  const calls: WorkerCalls = {
    poll: 0,
    ack: 0,
    heartbeat: 0,
    stop: [],
    send: [],
    retrieve: 0,
    withOptions: [],
    opts: { poll: [], ack: [], heartbeat: [], stop: [], send: [], stream: [], list: [] },
    logs: [],
  };
  const externalAbort = new AbortController();

  const work = {
    id: 'work_1',
    environment_id: 'env_1',
    data: { type: 'session', id: 'sesn_1' },
  };

  const fake = {
    // The per-item handler scopes a client to the environment key via
    // `copyClientForHelper`, which calls `withOptions` with the bearer
    // override, `apiKey: null` to clear the parent's `X-Api-Key`, and the
    // helper-telemetry default header. The fake records each `withOptions`
    // override and reuses itself so the rest of the surface stays wired up.
    _options: { defaultHeaders: undefined },
    logLevel: 'warn',
    logger: {
      error: (msg: string) => calls.logs.push(['error', msg]),
      warn: (msg: string) => calls.logs.push(['warn', msg]),
      info: () => {},
      debug: () => {},
    },
    withOptions: (options: Record<string, unknown>) => {
      calls.withOptions.push(options);
      return fake;
    },
    beta: {
      environments: {
        work: {
          poll: (_envId: string, _params: unknown, options?: unknown) => {
            calls.poll++;
            calls.opts['poll']!.push(options);
            if (calls.poll === 1) return Promise.resolve(work);
            // Second poll: end the run.
            externalAbort.abort();
            return Promise.reject(new Error('aborted'));
          },
          ack: (_workId: string, _params: unknown, options?: unknown) => {
            calls.ack++;
            calls.opts['ack']!.push(options);
            return Promise.resolve(work);
          },
          heartbeat: (_workId: string, _params: unknown, options?: { signal?: AbortSignal }) => {
            calls.heartbeat++;
            calls.opts['heartbeat']!.push(options);
            if (opts.heartbeat) return opts.heartbeat(calls.heartbeat, options);
            return Promise.resolve({
              last_heartbeat: `hb_${calls.heartbeat}`,
              ttl_seconds: 60,
              state: 'running',
              lease_extended: true,
            });
          },
          stop: (_workId: string, params: { force?: boolean }, options?: unknown) => {
            calls.stop.push({ ...(params.force !== undefined ? { force: params.force } : {}) });
            calls.opts['stop']!.push(options);
            return Promise.resolve(work);
          },
        },
      },
      sessions: {
        retrieve: () => {
          calls.retrieve++;
          return Promise.resolve({ agent: { skills: [] } });
        },
        events: {
          list: (_sessionId: string, _params: unknown, options?: unknown) => {
            calls.opts['list']!.push(options);
            return makeAsyncIterable<AnyEvent>([]);
          },
          send: (_sessionId: string, body: { events: AnyEvent[] }, options?: unknown) => {
            calls.send.push(body.events);
            calls.opts['send']!.push(options);
            return Promise.resolve({});
          },
          stream: (_sessionId: string, _params: unknown, options?: { signal?: AbortSignal }) => {
            calls.opts['stream']!.push(options);
            return Promise.resolve(makeAbortableAsyncIterable(opts.sessionStream, options?.signal));
          },
        },
      },
    },
  };
  return { client: fake as never, calls, signal: externalAbort.signal };
}

function makeAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const it of items) yield it;
    },
  };
}

function makeAbortableAsyncIterable<T>(items: T[], signal?: AbortSignal): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const it of items) yield it;
      if (!signal || signal.aborted) return;
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
    },
  };
}

function okTool(name: string): BetaRunnableTool {
  return {
    type: 'custom',
    name,
    description: name,
    input_schema: { type: 'object', properties: {} },
    parse: (x: unknown) => x as never,
    run: async () => 'ok',
  };
}

const TERMINATED: AnyEvent = { type: 'session.status_terminated', id: 'ev_term' };

describe('EnvironmentWorker', () => {
  test('claims a session, dispatches its tools, heartbeats the lease, and force-stops on exit', async () => {
    const { client, calls, signal } = makeFake({
      sessionStream: [{ type: 'agent.tool_use', id: 'tu_1', name: 'echo', input: {} }, TERMINATED],
    });

    const worker = new EnvironmentWorker({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
      tools: [okTool('echo')],
      workdir: '/tmp',
      maxIdleMs: 0,
      signal,
    });
    await worker.run();

    // Claimed + ack'd the work item.
    expect(calls.poll).toBeGreaterThanOrEqual(1);
    expect(calls.ack).toBe(1);
    // Set up the workdir/skills for the session.
    expect(calls.retrieve).toBe(1);
    // Heartbeated the lease at least once while the session ran.
    expect(calls.heartbeat).toBeGreaterThanOrEqual(1);
    // Posted the tool result back to the session.
    const sentResults = calls.send.flat().filter((e) => e.type === 'user.tool_result');
    expect(sentResults).toHaveLength(1);
    expect(sentResults[0]!['tool_use_id']).toBe('tu_1');
    // Force-stopped the work item on exit.
    expect(calls.stop.some((s) => s.force === true)).toBe(true);
    // The per-session calls were scoped to the environment key, with the
    // parent's `apiKey` cleared so `X-Api-Key` doesn't ride alongside the
    // bearer credential.
    expect(calls.withOptions).toContainEqual(expect.objectContaining({ apiKey: null, authToken: 'env_key' }));
  });

  test('forwards requestOptions custom headers to poll/ack/heartbeat/stop and the session calls', async () => {
    const { client, calls, signal } = makeFake({
      sessionStream: [{ type: 'agent.tool_use', id: 'tu_1', name: 'echo', input: {} }, TERMINATED],
    });

    const worker = new EnvironmentWorker({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
      tools: [okTool('echo')],
      workdir: '/tmp',
      maxIdleMs: 0,
      signal,
      requestOptions: { headers: { 'x-proxy-token': 'tok-abc' } },
    });
    await worker.run();

    const header = (opt: unknown): string | null | undefined =>
      (opt as { headers?: { values?: Headers } } | undefined)?.headers?.values?.get('x-proxy-token');

    for (const method of ['poll', 'ack', 'heartbeat', 'stop', 'stream', 'list', 'send'] as const) {
      const captured = calls.opts[method]!;
      expect(captured.length).toBeGreaterThanOrEqual(1);
      for (const opt of captured) {
        expect(header(opt)).toBe('tok-abc');
      }
    }
  });

  test('run() requires environmentId and environmentKey', async () => {
    const { client } = makeFake({ sessionStream: [TERMINATED] });
    await expect(new EnvironmentWorker({ client, environmentId: 'env_1' }).run()).rejects.toThrow(
      /environmentId and environmentKey are required/,
    );
    await expect(new EnvironmentWorker({ client, environmentKey: 'env_key' }).run()).rejects.toThrow(
      /environmentId and environmentKey are required/,
    );
  });

  test('handleItem resolves the environment key from the worker or an explicit option', async () => {
    const { client, calls } = makeFake({ sessionStream: [TERMINATED] });

    // From the worker's own environmentKey.
    await new EnvironmentWorker({
      client,
      environmentKey: 'worker_key',
      tools: [],
      workdir: '/tmp',
      maxIdleMs: 0,
    }).handleItem({ workId: 'work_1', environmentId: 'env_1', sessionId: 'sesn_1' });
    expect(calls.withOptions).toContainEqual(
      expect.objectContaining({ apiKey: null, authToken: 'worker_key' }),
    );

    // An explicit option wins over the worker's key.
    await new EnvironmentWorker({
      client,
      environmentKey: 'worker_key',
      tools: [],
      workdir: '/tmp',
      maxIdleMs: 0,
    }).handleItem({
      workId: 'work_1',
      environmentId: 'env_1',
      sessionId: 'sesn_1',
      environmentKey: 'explicit_key',
    });
    expect(calls.withOptions).toContainEqual(
      expect.objectContaining({ apiKey: null, authToken: 'explicit_key' }),
    );
  });

  test('handleItem throws when the environment key cannot be resolved', async () => {
    const { client } = makeFake({ sessionStream: [TERMINATED] });
    const saved = process.env['ANTHROPIC_ENVIRONMENT_KEY'];
    delete process.env['ANTHROPIC_ENVIRONMENT_KEY'];
    try {
      await expect(
        new EnvironmentWorker({ client, tools: [], workdir: '/tmp' }).handleItem({
          workId: 'work_1',
          environmentId: 'env_1',
          sessionId: 'sesn_1',
        }),
      ).rejects.toThrow(/environmentKey is required/);
    } finally {
      if (saved !== undefined) process.env['ANTHROPIC_ENVIRONMENT_KEY'] = saved;
    }
  });

  describe('lease heartbeat bounds', () => {
    const apiError = (status: number): APIError =>
      Object.assign(Object.create(APIError.prototype) as APIError, { status });
    const healthy = (call: number, ttlSeconds: number): Promise<HeartbeatResponse> =>
      Promise.resolve({
        last_heartbeat: `hb_${call}`,
        ttl_seconds: ttlSeconds,
        state: 'running',
        lease_extended: true,
      });
    /** A heartbeat call that never answers; it settles only when the worker gives up on it. */
    const hang = (options?: { signal?: AbortSignal }): Promise<HeartbeatResponse> =>
      new Promise((_, reject) => {
        const signal = options?.signal;
        if (!signal) return;
        if (signal.aborted) return reject(signal.reason);
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });

    // The session stream never terminates on its own in these tests, so the
    // run only ends when the heartbeat loop aborts the session.
    async function runOneSession(
      heartbeat: (call: number, options?: { signal?: AbortSignal }) => Promise<HeartbeatResponse>,
    ): Promise<{ calls: WorkerCalls; elapsedMs: number }> {
      const { client, calls, signal } = makeFake({ sessionStream: [], heartbeat });
      const started = Date.now();
      await new EnvironmentWorker({
        client,
        environmentId: 'env_1',
        environmentKey: 'env_key',
        tools: [],
        workdir: '/tmp',
        maxIdleMs: 0,
        signal,
      }).run();
      return { calls, elapsedMs: Date.now() - started };
    }

    test('a 409 is retried, and the session is given up once the lease ttl passes without a successful beat', async () => {
      const { calls, elapsedMs } = await runOneSession((call) =>
        call === 1 ? healthy(call, 2) : Promise.reject(apiError(409)),
      );
      expect(calls.heartbeat).toBeGreaterThanOrEqual(3);
      expect(calls.logs).not.toContainEqual(['error', 'permanent heartbeat failure']);
      expect(calls.logs).toContainEqual(['warn', 'transient heartbeat failure']);
      expect(calls.logs).toContainEqual(['error', 'lease assumed lost: no successful heartbeat in ttl']);
      expect(calls.stop.some((s) => s.force === true)).toBe(true);
      expect(elapsedMs).toBeLessThan(8_000);
    }, 10_000);

    test('a heartbeat call that never answers is cut off each interval and the stale lease ends the session', async () => {
      const { calls, elapsedMs } = await runOneSession((call, options) =>
        call === 1 ? healthy(call, 1) : hang(options),
      );
      expect(calls.heartbeat).toBeGreaterThanOrEqual(2);
      expect(calls.logs).toContainEqual(['error', 'lease assumed lost: no successful heartbeat in ttl']);
      expect(calls.stop.some((s) => s.force === true)).toBe(true);
      expect(elapsedMs).toBeLessThan(8_000);
    }, 10_000);

    test('a 401 is permanent: the session is cancelled on the first failure', async () => {
      const { calls, elapsedMs } = await runOneSession(() => Promise.reject(apiError(401)));
      expect(calls.heartbeat).toBe(1);
      expect(calls.logs).toContainEqual(['error', 'permanent heartbeat failure']);
      expect(calls.stop.some((s) => s.force === true)).toBe(true);
      expect(elapsedMs).toBeLessThan(2_000);
    }, 10_000);
  });
});
