import { WorkPoller, POLL_BLOCK_MS } from '@anthropic-ai/sdk/lib/environments';
import { APIError } from '@anthropic-ai/sdk/core/error';

// Minimal fake `client.beta.environments.work` resource. Tests script
// poll/ack/stop responses; we record how each was called for assertions.
//
// The poller now scopes a sub-client via `copyClientForHelper` and
// routes every poll/ack/stop through it, so the fake exposes
// `withOptions` and `_options`; the sub-client reuses the same recorder
// so call-shape assertions still work as before.

interface RecordedCall {
  method: 'poll' | 'ack' | 'stop';
  args: unknown[];
}

interface PollResponse {
  type: 'work' | 'null' | 'throw';
  value?: unknown;
  err?: unknown;
}

function makeFakeClient(opts: {
  poll: PollResponse[];
  ack?: { type: 'ok' | 'throw'; err?: unknown }[];
  stop?: { type: 'ok' | 'throw'; err?: unknown }[];
}) {
  const calls: RecordedCall[] = [];
  const withOptionsCalls: Array<Record<string, unknown>> = [];
  let pollIdx = 0;
  let ackIdx = 0;
  let stopIdx = 0;
  const fake: Record<string, unknown> = {
    // `copyClientForHelper` reads `_options.defaultHeaders` to merge
    // them onto the sub-client; provide a minimal shape so the util doesn't
    // throw on the fake.
    _options: { defaultHeaders: undefined },
    withOptions: (options: Record<string, unknown>) => {
      withOptionsCalls.push(options);
      return fake;
    },
    beta: {
      environments: {
        work: {
          poll: (...args: unknown[]) => {
            calls.push({ method: 'poll', args });
            const r = opts.poll[pollIdx++] ?? { type: 'null' };
            if (r.type === 'throw') return Promise.reject(r.err);
            if (r.type === 'null') return Promise.resolve(null);
            return Promise.resolve(r.value);
          },
          ack: (...args: unknown[]) => {
            calls.push({ method: 'ack', args });
            const r = opts.ack?.[ackIdx++] ?? { type: 'ok' };
            if (r.type === 'throw') return Promise.reject(r.err);
            return Promise.resolve({});
          },
          stop: (...args: unknown[]) => {
            calls.push({ method: 'stop', args });
            const r = opts.stop?.[stopIdx++] ?? { type: 'ok' };
            if (r.type === 'throw') return Promise.reject(r.err);
            return Promise.resolve({});
          },
        },
      },
    },
  };
  return { client: fake as never, calls, withOptionsCalls };
}

function makeWork(id = 'work_1', dataType = 'session'): Record<string, unknown> {
  return {
    id,
    state: 'queued',
    environment_id: 'env_1',
    data: { type: dataType, id: 'sesn_1' },
  };
}

describe('WorkPoller', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('yields the work item and posts ack before yield, stop after consumer body', async () => {
    const work = makeWork();
    const { client, calls } = makeFakeClient({ poll: [{ type: 'work', value: work }] });

    const iter = new WorkPoller({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
    });

    const items: Array<{ workId: string }> = [];
    const consumer = (async () => {
      for await (const work of iter) {
        items.push({ workId: work.id });
        // Stop after first item.
        iter.abort();
        break;
      }
    })();

    await jest.advanceTimersByTimeAsync(5_000);
    await consumer;

    expect(items).toEqual([{ workId: 'work_1' }]);

    const order = calls.map((c) => c.method);
    // poll then ack then stop, in order.
    expect(order.slice(0, 3)).toEqual(['poll', 'ack', 'stop']);
  });

  test('scopes a sub-client to the environment key and routes all calls through it', async () => {
    // Previously every poll/ack/stop carried a per-request `Authorization:
    // Bearer <env_key>` header. The poller now scopes a sub-client via
    // `copyClientForHelper`, which clears the parent's `apiKey` so
    // `X-Api-Key` doesn't ride alongside the bearer credential on the wire.
    const work = makeWork();
    const { client, withOptionsCalls } = makeFakeClient({ poll: [{ type: 'work', value: work }] });

    const iter = new WorkPoller({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
    });

    const consumer = (async () => {
      for await (const _ of iter) {
        iter.abort();
        break;
      }
    })();
    await jest.advanceTimersByTimeAsync(5_000);
    await consumer;

    expect(withOptionsCalls).toContainEqual(
      expect.objectContaining({ apiKey: null, authToken: 'env_key', credentials: undefined }),
    );
  });

  test('stops the work item even when the consumer breaks immediately', async () => {
    const work = makeWork();
    const { client, calls } = makeFakeClient({ poll: [{ type: 'work', value: work }] });

    const iter = new WorkPoller({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
    });

    const consumer = (async () => {
      for await (const _ of iter) {
        iter.abort();
        break;
      }
    })();
    await jest.advanceTimersByTimeAsync(5_000);
    await consumer;

    expect(calls.some((c) => c.method === 'stop')).toBe(true);
  });

  test('backs off on poll errors using setTimeout-based delay', async () => {
    const err = Object.assign(Object.create(APIError.prototype) as APIError, { status: 503 });
    const work = makeWork();
    const { client, calls } = makeFakeClient({
      poll: [
        { type: 'throw', err },
        { type: 'work', value: work },
      ],
    });

    const iter = new WorkPoller({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
    });

    const consumer = (async () => {
      for await (const _ of iter) {
        iter.abort();
        break;
      }
    })();
    // Drive past the initial 1s backoff window.
    await jest.advanceTimersByTimeAsync(2_000);
    await consumer;

    const polls = calls.filter((c) => c.method === 'poll').length;
    expect(polls).toBe(2);
  });

  test('honors externally provided AbortSignal', async () => {
    const abortCtl = new AbortController();
    const { client } = makeFakeClient({ poll: [] });

    const iter = new WorkPoller({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
      signal: abortCtl.signal,
    });

    const consumer = (async () => {
      for await (const _ of iter) {
        // never yields — poll always returns null
      }
    })();
    abortCtl.abort();
    await jest.advanceTimersByTimeAsync(5_000);
    await consumer;
    // Reaching here without timeout is the assertion.
    expect(iter.signal.aborted).toBe(true);
  });

  test('throws when iterated twice', async () => {
    const { client } = makeFakeClient({ poll: [] });
    const iter = new WorkPoller({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
    });
    iter.abort();
    // First iteration drains the (already aborted) generator.
    for await (const _ of iter) {
      // unreachable
    }
    // Second iteration must throw the consumed-stream guard.
    await expect(
      (async () => {
        for await (const _ of iter) {
          // unreachable
        }
      })(),
    ).rejects.toThrow(/consumed/);
  });

  test('default poll passes block_ms = POLL_BLOCK_MS and no reclaim_older_than_ms', async () => {
    const work = makeWork();
    const { client, calls } = makeFakeClient({ poll: [{ type: 'work', value: work }] });

    const iter = new WorkPoller({ client, environmentId: 'env_1', environmentKey: 'env_key' });
    const consumer = (async () => {
      for await (const _ of iter) {
        iter.abort();
        break;
      }
    })();
    await jest.advanceTimersByTimeAsync(5_000);
    await consumer;

    const poll = calls.find((c) => c.method === 'poll')!;
    const params = poll.args[1] as Record<string, unknown>;
    expect(params['block_ms']).toBe(POLL_BLOCK_MS);
    expect('reclaim_older_than_ms' in params).toBe(false);
  });

  test('blockMs: null omits block_ms; reclaimOlderThanMs is forwarded', async () => {
    const work = makeWork();
    const { client, calls } = makeFakeClient({ poll: [{ type: 'work', value: work }] });

    const iter = new WorkPoller({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
      blockMs: null,
      reclaimOlderThanMs: 7_000,
    });
    const consumer = (async () => {
      for await (const _ of iter) {
        iter.abort();
        break;
      }
    })();
    await jest.advanceTimersByTimeAsync(5_000);
    await consumer;

    const poll = calls.find((c) => c.method === 'poll')!;
    const params = poll.args[1] as Record<string, unknown>;
    expect('block_ms' in params).toBe(false);
    expect(params['reclaim_older_than_ms']).toBe(7_000);
  });

  test('explicit blockMs is forwarded as block_ms', async () => {
    const work = makeWork();
    const { client, calls } = makeFakeClient({ poll: [{ type: 'work', value: work }] });

    const iter = new WorkPoller({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
      blockMs: 250,
    });
    const consumer = (async () => {
      for await (const _ of iter) {
        iter.abort();
        break;
      }
    })();
    await jest.advanceTimersByTimeAsync(5_000);
    await consumer;

    const poll = calls.find((c) => c.method === 'poll')!;
    expect((poll.args[1] as Record<string, unknown>)['block_ms']).toBe(250);
  });

  test('drain ends iteration when the queue is empty instead of long-polling', async () => {
    // poll always returns null; without `drain` this would loop forever.
    const { client, calls } = makeFakeClient({ poll: [{ type: 'null' }] });

    const iter = new WorkPoller({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
      drain: true,
    });

    const items: unknown[] = [];
    const consumer = (async () => {
      for await (const work of iter) items.push(work);
    })();
    await jest.advanceTimersByTimeAsync(5_000);
    await consumer;

    expect(items).toEqual([]);
    // Returned after a single empty poll — no backoff sleep, no re-poll.
    expect(calls.filter((c) => c.method === 'poll').length).toBe(1);
  });

  test('without drain, an empty queue is retried (default long-poll behavior)', async () => {
    const work = makeWork();
    const { client, calls } = makeFakeClient({
      poll: [{ type: 'null' }, { type: 'work', value: work }],
    });

    const iter = new WorkPoller({ client, environmentId: 'env_1', environmentKey: 'env_key' });
    const consumer = (async () => {
      for await (const _ of iter) {
        iter.abort();
        break;
      }
    })();
    // Advance past the empty-poll jittered wait (1-3s) so the second poll runs.
    await jest.advanceTimersByTimeAsync(5_000);
    await consumer;

    expect(calls.filter((c) => c.method === 'poll').length).toBe(2);
  });

  test('does not auto-post stop when autoStop is false (the consumer owns it)', async () => {
    const work = makeWork();
    const { client, calls } = makeFakeClient({ poll: [{ type: 'work', value: work }] });

    const iter = new WorkPoller({
      client,
      environmentId: 'env_1',
      environmentKey: 'env_key',
      autoStop: false,
    });

    const consumer = (async () => {
      for await (const _ of iter) {
        iter.abort();
        break;
      }
    })();
    await jest.advanceTimersByTimeAsync(5_000);
    await consumer;

    // poll + ack happened, but the poller left the stop to the consumer.
    expect(calls.some((c) => c.method === 'ack')).toBe(true);
    expect(calls.some((c) => c.method === 'stop')).toBe(false);
  });
});
