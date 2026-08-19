import Anthropic from '@anthropic-ai/sdk';
import { EnvironmentWorker } from '@anthropic-ai/sdk/lib/environments';
import { sessionsTokenFromSecret } from '@anthropic-ai/sdk/lib/environments/worker';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { APIError } from '@anthropic-ai/sdk/core/error';

/**
 * Build a work-item `secret` the way the control plane does: URL-safe base64
 * of a JSON payload, without padding.
 */
function encodeSecret(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function loggedText(calls: WorkerCalls): string {
  return calls.logs.map(([, line]) => line).join('\n');
}

/**
 * The 412 the control plane answers a heartbeat with once the item's lease was
 * cleared (re-queued) or is held by another worker.
 */
function leaseLostError(): APIError {
  return new APIError(
    412,
    {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'Heartbeat precondition failed: expected hb-1, actual was NULL',
        details: {
          error_code: 'heartbeat_precondition_failed',
          error_visibility: 'user_facing',
          current_state: {
            state: 'queued',
            last_heartbeat: null,
            lease_updated_at: null,
            lease_extended: false,
            ttl_seconds: 120,
          },
        },
      },
    },
    undefined,
    new Headers(),
  );
}

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
  // `[level, line]` for everything the worker logged; `line` is the message and
  // structured args flattened, so tests can assert on wording per level and on
  // the absence of credential material anywhere in the output.
  logs: Array<[string, string]>;
}

type HeartbeatResponse = {
  last_heartbeat: string;
  ttl_seconds: number;
  state: string;
  lease_extended: boolean;
};

/**
 * Answers the fake lease heartbeat per call (1-based). `serving` resolves once
 * the runner has opened the session's event stream.
 */
type HeartbeatScript = (
  call: number,
  options: { signal?: AbortSignal } | undefined,
  serving: Promise<void>,
) => Promise<HeartbeatResponse>;

function makeFake(opts: {
  sessionStream: AnyEvent[];
  /** Script the lease heartbeat; defaults to a healthy 60 s lease. */
  heartbeat?: HeartbeatScript;
  /** Script `events.send` per call (1-based); defaults to success. */
  send?: (call: number) => Promise<unknown>;
  secret?: string | null;
  failStop?: boolean;
  workType?: string;
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
  let markServing!: () => void;
  const serving = new Promise<void>((resolve) => {
    markServing = () => resolve();
  });

  const work = {
    id: 'work_1',
    environment_id: 'env_1',
    ...(opts.secret !== undefined ? { secret: opts.secret } : {}),
    data: { type: opts.workType ?? 'session', id: 'sesn_1' },
  };

  const logAt =
    (level: string) =>
    (...args: unknown[]) =>
      calls.logs.push([level, args.map((a) => JSON.stringify(a)).join(' ')]);

  const fake = {
    // The per-item handler scopes a client to the environment key via
    // `copyClientForHelper`, which calls `withOptions` with the bearer
    // override, `apiKey: null` to clear the parent's `X-Api-Key`, and the
    // helper-telemetry default header. The fake records each `withOptions`
    // override and reuses itself so the rest of the surface stays wired up.
    _options: { defaultHeaders: undefined },
    logLevel: 'debug',
    logger: { error: logAt('error'), warn: logAt('warn'), info: logAt('info'), debug: logAt('debug') },
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
            if (opts.heartbeat) return opts.heartbeat(calls.heartbeat, options, serving);
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
            if (opts.failStop) return Promise.reject(new Error('force-stop exploded'));
            return Promise.resolve(work);
          },
        },
      },
      sessions: {
        retrieve: () => {
          calls.retrieve++;
          return Promise.resolve({ agent: { skills: [] }, resources: [] });
        },
        events: {
          list: (_sessionId: string, _params: unknown, options?: unknown) => {
            calls.opts['list']!.push(options);
            return makeAsyncIterable<AnyEvent>([]);
          },
          send: (_sessionId: string, body: { events: AnyEvent[] }, options?: unknown) => {
            calls.send.push(body.events);
            calls.opts['send']!.push(options);
            if (opts.send) return opts.send(calls.send.length);
            return Promise.resolve({});
          },
          stream: (_sessionId: string, _params: unknown, options?: { signal?: AbortSignal }) => {
            calls.opts['stream']!.push(options);
            markServing();
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
      await aborted(signal);
    },
  };
}

/** Resolves once `signal` aborts; never without one. */
function aborted(signal: AbortSignal | undefined): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!signal) return;
    if (signal.aborted) resolve();
    else signal.addEventListener('abort', () => resolve(), { once: true });
  });
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
  // A leftover per-item secret on the host must not bleed into tests that
  // exercise the environment-key paths.
  const savedWorkSecret = process.env['ANTHROPIC_WORK_SECRET'];
  beforeEach(() => {
    delete process.env['ANTHROPIC_WORK_SECRET'];
  });
  afterAll(() => {
    if (savedWorkSecret !== undefined) process.env['ANTHROPIC_WORK_SECRET'] = savedWorkSecret;
  });

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

  test('a memory sync interval under the minimum is refused at construction', () => {
    const { client } = makeFake({ sessionStream: [TERMINATED] });
    const base = { client, environmentId: 'env_1', environmentKey: 'env_key', workdir: '/tmp' };
    for (const memorySyncIntervalMs of [0, 4_999, -1, Number.NaN]) {
      expect(() => new EnvironmentWorker({ ...base, memorySyncIntervalMs })).toThrow(
        /memorySyncIntervalMs must be at least 5000ms/,
      );
    }
    // `null` (sync off) and an unset interval (the default) are both fine.
    expect(() => new EnvironmentWorker({ ...base, memorySyncIntervalMs: null })).not.toThrow();
    expect(() => new EnvironmentWorker({ ...base, memorySyncIntervalMs: 5_000 })).not.toThrow();
    expect(() => new EnvironmentWorker(base)).not.toThrow();
  });

  test('skips a non-session item but still stops it', async () => {
    // The queue hands the worker a health check instead of a session. There
    // is no session to look up or serve, but the item must still be stopped
    // so the queue gets it back.
    const { client, calls, signal } = makeFake({ sessionStream: [TERMINATED], workType: 'healthcheck' });
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

    // No session was fetched or served...
    expect(calls.retrieve).toBe(0);
    expect(calls.opts['stream']).toHaveLength(0);
    // ...but the item was still stopped.
    expect(calls.stop).toEqual([{ force: true }]);
  });

  test('a failing work item does not take the poll loop down with it', async () => {
    // A store directory left behind by a killed worker makes every item for
    // that session fail. If run() propagated, the process would crashloop:
    // restart, claim, die, restart. The item fails; the worker keeps polling.
    const { client, calls, signal } = makeFake({
      sessionStream: [TERMINATED],
    });
    const worker = new EnvironmentWorker({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
      // A tool factory that throws stands in for any per-item failure.
      tools: () => {
        throw new Error('per-item boom');
      },
      workdir: '/tmp',
      maxIdleMs: 0,
      signal,
    });

    await expect(worker.run()).resolves.toBeUndefined();

    // The item was claimed and force-stopped; the loop moved on rather than
    // rethrowing.
    expect(calls.ack).toBe(1);
    expect(calls.stop.some((s) => s.force === true)).toBe(true);
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

  test('prefers the sessions token from the work item secret for per-item calls', async () => {
    // A claimed item carrying a per-item `secret` payload authenticates that
    // item's heartbeat / force-stop / skill-download / session-runner calls
    // with the sessions token extracted from it; polling stays on the
    // environment key. Neither the payload nor the token ever reaches the logs.
    const secret = encodeSecret({
      sessions_token: 'sessions-token-item-1',
      session_ingress_token: 'ingress-token-1',
    });
    const { client, calls, signal } = makeFake({
      sessionStream: [{ type: 'agent.tool_use', id: 'tu_1', name: 'echo', input: {} }, TERMINATED],
      secret,
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

    // Polling keeps the environment key; the per-item client switches to the
    // sessions token carried inside the work item's secret payload — and that
    // client also carries the session tool runner and the skill download.
    expect(calls.withOptions.map((o) => o['authToken'])).toEqual(['env_key', 'sessions-token-item-1']);
    expect(calls.withOptions[1]).toEqual(expect.objectContaining({ apiKey: null }));
    expect(calls.retrieve).toBe(1);
    // The work item was still heartbeated and force-stopped as usual.
    expect(calls.heartbeat).toBeGreaterThanOrEqual(1);
    expect(calls.stop.some((s) => s.force === true)).toBe(true);
    // The credentials are opaque — neither the payload nor the extracted token
    // may appear in log output.
    const logText = loggedText(calls);
    expect(logText).not.toContain(secret);
    expect(logText).not.toContain('sessions-token-item-1');
  });

  test('falls back to the environment key when the secret is undecodable', async () => {
    // A secret payload that doesn't decode (or carries no sessions token)
    // falls back to the environment key, with a warning that doesn't include
    // the payload itself.
    const { client, calls, signal } = makeFake({
      sessionStream: [TERMINATED],
      secret: 'not-a-valid-payload',
    });

    const worker = new EnvironmentWorker({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
      tools: [],
      workdir: '/tmp',
      maxIdleMs: 0,
      signal,
    });
    await worker.run();

    expect(calls.withOptions.map((o) => o['authToken'])).toEqual(['env_key', 'env_key']);
    const logText = loggedText(calls);
    expect(logText).toContain('no sessions token could be extracted');
    expect(logText).not.toContain('not-a-valid-payload');
  });

  test('sessionsTokenFromSecret decodes padded and unpadded payloads and rejects the rest', () => {
    // The secret payload decodes from URL-safe base64 JSON (with or without
    // padding); anything malformed or token-less resolves to null.
    const payload = {
      sessions_token: 'sessions-token-abc',
      auth: [{ type: 'anthropic_oauth', token: 'oauth' }],
    };
    const unpadded = encodeSecret(payload);
    const padded = Buffer.from(JSON.stringify(payload)).toString('base64url') + '==';

    expect(sessionsTokenFromSecret(unpadded)).toBe('sessions-token-abc');
    expect(sessionsTokenFromSecret(Buffer.from(JSON.stringify(payload)).toString('base64'))).toBe(
      'sessions-token-abc',
    );
    expect(sessionsTokenFromSecret(padded)).toBe('sessions-token-abc');
    expect(sessionsTokenFromSecret(null)).toBeNull();
    expect(sessionsTokenFromSecret(undefined)).toBeNull();
    expect(sessionsTokenFromSecret('')).toBeNull();
    expect(sessionsTokenFromSecret('!!! not base64 !!!')).toBeNull();
    // Valid base64 but not JSON / not an object / missing or empty token.
    expect(sessionsTokenFromSecret(Buffer.from('plain text').toString('base64'))).toBeNull();
    expect(sessionsTokenFromSecret(Buffer.from('[1, 2]').toString('base64'))).toBeNull();
    expect(sessionsTokenFromSecret(encodeSecret({ session_ingress_token: 'ingress-token-1' }))).toBeNull();
    expect(sessionsTokenFromSecret(encodeSecret({ sessions_token: '' }))).toBeNull();
  });

  test('does not log the secret on error paths', async () => {
    // Error-path logging (heartbeat shutdown, force-stop failure) must not
    // leak the per-item secret payload or its sessions token.
    const secret = encodeSecret({ sessions_token: 'sessions-token-err' });
    const { client, calls, signal } = makeFake({
      sessionStream: [TERMINATED],
      secret,
      heartbeat: (call) =>
        Promise.resolve({
          last_heartbeat: `hb_${call}`,
          ttl_seconds: 60,
          state: 'stopping',
          lease_extended: true,
        }),
      failStop: true,
    });

    const worker = new EnvironmentWorker({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
      tools: [],
      workdir: '/tmp',
      maxIdleMs: 0,
      signal,
    });
    await worker.run();

    // The error branches actually ran (heartbeat signalled shutdown, the
    // force-stop failure was logged) ...
    expect(calls.stop.length).toBeGreaterThanOrEqual(1);
    const logText = loggedText(calls);
    expect(logText).toContain('force-stop on exit failed');
    // ... and none of them leaked the payload or the token inside it.
    expect(logText).not.toContain(secret);
    expect(logText).not.toContain('sessions-token-err');
  });

  test('handleItem uses the workSecret option as the per-item credential', async () => {
    // An explicit workSecret payload supplies the per-item Bearer credential
    // (its sessions token); environmentKey is still required but only used as
    // the fallback.
    const secret = encodeSecret({ sessions_token: 'sessions-token-arg' });
    const { client, calls } = makeFake({ sessionStream: [TERMINATED] });

    await new EnvironmentWorker({
      client,
      tools: [],
      workdir: '/tmp',
      maxIdleMs: 0,
    }).handleItem({
      workId: 'work_1',
      environmentId: 'env_1',
      sessionId: 'sesn_1',
      environmentKey: 'env_key',
      workSecret: secret,
    });

    expect(calls.withOptions.map((o) => o['authToken'])).toEqual(['sessions-token-arg']);
  });

  test('handleItem falls back to ANTHROPIC_WORK_SECRET', async () => {
    // workSecret falls back to ANTHROPIC_WORK_SECRET (the env var the
    // `worker poll --on-work` command sets alongside the others); when neither
    // is present the environment key is used — the other handleItem cases
    // cover that path.
    const secret = encodeSecret({ sessions_token: 'sessions-token-env' });
    const { client, calls } = makeFake({ sessionStream: [TERMINATED] });
    process.env['ANTHROPIC_WORK_SECRET'] = secret;
    try {
      await new EnvironmentWorker({
        client,
        environmentKey: 'env_key',
        tools: [],
        workdir: '/tmp',
        maxIdleMs: 0,
      }).handleItem({ workId: 'work_env', environmentId: 'env_1', sessionId: 'sesn_1' });
    } finally {
      delete process.env['ANTHROPIC_WORK_SECRET'];
    }

    expect(calls.withOptions.map((o) => o['authToken'])).toEqual(['sessions-token-env']);
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

  test.each([true, false])('unrestrictedPaths=%s is rejected at construction', (unrestrictedPaths) => {
    const { client } = makeFake({ sessionStream: [TERMINATED] });
    expect(() => new EnvironmentWorker({ client, unrestrictedPaths })).toThrow(
      /unrestrictedPaths[\s\S]*is no longer supported/,
    );
    expect(() => new Anthropic({ apiKey: 'x' }).beta.environments.work.worker({ unrestrictedPaths })).toThrow(
      /unrestrictedPaths[\s\S]*is no longer supported/,
    );
  });

  describe('lease heartbeat', () => {
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
    /**
     * Answer each heartbeat only once the runner is serving the session, so the
     * answer (not skill setup or session completion) decides how the run ends.
     */
    const onceServing =
      (answer: (call: number) => Promise<HeartbeatResponse>): HeartbeatScript =>
      async (call, options, serving) => {
        await Promise.race([serving, aborted(options?.signal)]);
        options?.signal?.throwIfAborted();
        return answer(call);
      };

    // The session stream never terminates on its own in these tests, so the
    // run only ends when the heartbeat loop aborts the session.
    async function runOneSession(
      heartbeat: HeartbeatScript,
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

    const expectReleasedWithoutStop = (calls: WorkerCalls): void => {
      expect(calls.stop).toEqual([]);
      const released =
        '"lease lost; released without stopping it" {"session_id":"sesn_1","work_id":"work_1"}';
      expect(calls.logs.filter(([level, line]) => level === 'info' && line === released)).toHaveLength(1);
    };

    test('a heartbeat 412 releases the item without stopping it', async () => {
      // A 412 on the heartbeat means the server cleared this worker's lease
      // (re-queued the item, or another worker holds it): the run ends, the item
      // is not force-stopped, and the worker goes back to polling.
      const { calls } = await runOneSession(onceServing(() => Promise.reject(leaseLostError())));

      // The session was set up and the runner was serving it when the 412 landed.
      expect(calls.retrieve).toBe(1);
      expect(calls.opts['stream']).toHaveLength(1);
      expect(calls.heartbeat).toBe(1);
      // Released, not stopped; run() then went back to the poller.
      expectReleasedWithoutStop(calls);
      expect(calls.poll).toBe(2);
      expect(calls.logs).toContainEqual([
        'error',
        '"lease lost: heartbeat precondition failed" ' +
          '{"work_id":"work_1","server_state":"queued","server_ttl_seconds":120,"server_last_heartbeat":null}',
      ]);
      const logText = loggedText(calls);
      expect(logText).not.toContain('permanent heartbeat failure');
      expect(logText).not.toContain('heartbeat loop failed');
      expect(logText).not.toContain('work item failed');
    });

    test('a control-plane stop still force-stops the item', async () => {
      // A heartbeat reporting `state === "stopped"` ends the run and the item is
      // still force-stopped on the way out — only a *lost* lease skips that.
      const { calls } = await runOneSession(
        onceServing(async (call) => ({ ...(await healthy(call, 60)), state: 'stopped' })),
      );

      expect(calls.opts['stream']).toHaveLength(1);
      expect(calls.logs).toContainEqual([
        'info',
        '"heartbeat signals shutdown" {"work_id":"work_1","state":"stopped"}',
      ]);
      expect(calls.stop).toEqual([{ force: true }]);
      expect(loggedText(calls)).not.toContain('without stopping it');
    });

    test('a heartbeat rejected with another 4xx still force-stops the item', async () => {
      // Only a 412 hands the item to someone else. Any other 4xx the heartbeat
      // cannot recover from ends the run, and the item is force-stopped as usual.
      const { calls } = await runOneSession(onceServing(() => Promise.reject(apiError(403))));

      expect(calls.opts['stream']).toHaveLength(1);
      expect(calls.heartbeat).toBe(1);
      const logText = loggedText(calls);
      expect(logText).toContain('permanent heartbeat failure');
      expect(calls.stop).toEqual([{ force: true }]);
      expect(logText).not.toContain('without stopping it');
      expect(logText).not.toContain('heartbeat loop failed');
      expect(logText).not.toContain('work item failed');
    });

    test('a 409 is retried, and the session is given up once the lease ttl passes without a successful beat', async () => {
      const { calls, elapsedMs } = await runOneSession((call) =>
        call === 1 ? healthy(call, 2) : Promise.reject(apiError(409)),
      );
      expect(calls.heartbeat).toBeGreaterThanOrEqual(3);
      expect(calls.logs).not.toContainEqual([
        'error',
        expect.stringContaining('permanent heartbeat failure'),
      ]);
      expect(calls.logs).toContainEqual(['warn', expect.stringContaining('transient heartbeat failure')]);
      expect(calls.logs).toContainEqual([
        'error',
        expect.stringContaining('lease assumed lost: no successful heartbeat in ttl'),
      ]);
      expect(calls.opts['stream']).toHaveLength(1);
      expectReleasedWithoutStop(calls);
      expect(elapsedMs).toBeLessThan(8_000);
    }, 10_000);

    test('a heartbeat call that never answers is cut off each interval and the stale lease ends the session', async () => {
      const { calls, elapsedMs } = await runOneSession((call, options) =>
        call === 1 ? healthy(call, 1) : hang(options),
      );
      expect(calls.heartbeat).toBeGreaterThanOrEqual(2);
      expect(calls.logs).toContainEqual([
        'error',
        expect.stringContaining('lease assumed lost: no successful heartbeat in ttl'),
      ]);
      expect(calls.opts['stream']).toHaveLength(1);
      expectReleasedWithoutStop(calls);
      expect(elapsedMs).toBeLessThan(8_000);
    }, 10_000);

    test('the lease ttl bounds how long a failing tool-result send is retried', async () => {
      // The send never succeeds. The stream only reaches TERMINATED once the
      // send gives up, so under the runner's standalone 5-minute window this
      // would hang; the 1s ttl the heartbeat reports must cut it short.
      const { client, calls, signal } = makeFake({
        sessionStream: [{ type: 'agent.tool_use', id: 'tu_1', name: 'echo', input: {} }, TERMINATED],
        heartbeat: (call) => healthy(call, 1),
        send: () => Promise.reject(apiError(503)),
      });
      const started = Date.now();
      await new EnvironmentWorker({
        client,
        environmentId: 'env_1',
        environmentKey: 'env_key',
        tools: [okTool('echo')],
        workdir: '/tmp',
        maxIdleMs: 0,
        signal,
      }).run();
      expect(calls.send.length).toBeGreaterThanOrEqual(2);
      expect(calls.logs).toContainEqual(['error', expect.stringContaining('failed to send tool result')]);
      expect(calls.stop.some((s) => s.force === true)).toBe(true);
      expect(Date.now() - started).toBeLessThan(5_000);
    }, 10_000);

    test('a 401 is permanent: the session is cancelled on the first failure', async () => {
      const { calls, elapsedMs } = await runOneSession(() => Promise.reject(apiError(401)));
      expect(calls.heartbeat).toBe(1);
      expect(calls.logs).toContainEqual(['error', expect.stringContaining('permanent heartbeat failure')]);
      expect(calls.stop.some((s) => s.force === true)).toBe(true);
      expect(elapsedMs).toBeLessThan(2_000);
    }, 10_000);
  });
});
