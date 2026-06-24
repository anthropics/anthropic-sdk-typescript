import { SessionToolRunner } from '@anthropic-ai/sdk/lib/tools/SessionToolRunner';
import type { DispatchedToolCall } from '@anthropic-ai/sdk/lib/tools/SessionToolRunner';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { APIError } from '@anthropic-ai/sdk/core/error';

// =====
// Test fakes
//
// We don't need SSE plumbing here — the runner orchestration is what we want
// to test, so we feed event sequences through a synchronous fake of
// `client.beta.sessions.events.stream()` and a fake of `events.list()`.
// =====

type AnyEvent = Record<string, unknown> & { type: string };

interface RunnerCalls {
  send: AnyEvent[][];
  list: number;
  streams: number;
  // The `options` (3rd) argument captured from each stream/list/send call.
  options: Array<unknown>;
}

interface FakeOpts {
  // Sequence of streams the runner will see when it calls events.stream().
  // Each stream yields an array of events. After the last stream, subsequent
  // calls block forever (or until the controller aborts).
  streams: AnyEvent[][];
  // Optional: events that events.list() will yield on each invocation.
  list?: AnyEvent[][];
  // Optional: `events.send` failures, by call index.
  sendErrors?: Array<{ at: number; err: unknown }>;
  // Optional: stream indices that throw (disconnect) after yielding their
  // scripted events, forcing the runner to reconnect + reconcile.
  streamErrors?: number[];
}

function makeFake(opts: FakeOpts) {
  const calls: RunnerCalls = { send: [], list: 0, streams: 0, options: [] };

  let listIdx = 0;
  let streamIdx = 0;
  let sendIdx = 0;

  const fake = {
    beta: {
      sessions: {
        events: {
          list: (_sessionId: string, _params: unknown, options?: unknown) => {
            calls.list++;
            calls.options.push(options);
            const items = opts.list?.[listIdx++] ?? [];
            return makeAsyncIterable(items);
          },
          send: (_sessionId: string, body: { events: AnyEvent[] }, options?: unknown) => {
            const i = sendIdx++;
            calls.send.push(body.events);
            calls.options.push(options);
            const fail = opts.sendErrors?.find((e) => e.at === i);
            if (fail) return Promise.reject(fail.err);
            return Promise.resolve({});
          },
          stream: (_sessionId: string, _params: unknown, options?: { signal?: AbortSignal }) => {
            calls.streams++;
            calls.options.push(options);
            const i = streamIdx++;
            const events = opts.streams[i] ?? [];
            // Mirror APIPromise<Stream<...>>: a thenable that resolves to an
            // AsyncIterable. The real Stream tears down on abort; the fake
            // does the same so tests don't rely on TERMINATED to end.
            return Promise.resolve(
              makeAbortableAsyncIterable(events, options?.signal, opts.streamErrors?.includes(i) ?? false),
            );
          },
        },
      },
    },
  };
  return { client: fake as never, calls };
}

function makeAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const it of items) yield it;
    },
  };
}

// Yields each item, then (if no items remain) either throws to mimic a
// disconnect, or parks until the signal aborts. Mirrors how the real Stream<T>
// tears down on abort / errors out on a dropped connection.
function makeAbortableAsyncIterable<T>(
  items: T[],
  signal?: AbortSignal,
  throwAfter = false,
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const it of items) yield it;
      // A scripted disconnect: the runner should reconnect + reconcile.
      if (throwAfter) throw new Error('stream disconnected');
      // After the scripted items, idle until aborted. Lets the runner exit
      // cleanly via the idle watchdog or an external abort.
      if (!signal) return;
      if (signal.aborted) return;
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true });
      });
    },
  };
}

function makeOkTool(name: string, output: string | BetaRunnableTool['run']): BetaRunnableTool {
  const run: BetaRunnableTool['run'] = typeof output === 'string' ? async () => output : output;
  return {
    type: 'custom',
    name,
    description: name,
    input_schema: { type: 'object', properties: {} },
    parse: (x: unknown) => x as never,
    run,
  };
}

function toolUse(id: string, name: string, input: Record<string, unknown> = {}): AnyEvent {
  return { type: 'agent.tool_use', id, name, input };
}

function customToolUse(id: string, name: string, input: Record<string, unknown> = {}): AnyEvent {
  return { type: 'agent.custom_tool_use', id, name, input };
}

function idleEndTurn(): AnyEvent {
  return { type: 'session.status_idle', id: 'ev_idle', stop_reason: { type: 'end_turn' } };
}

const TERMINATED: AnyEvent = { type: 'session.status_terminated', id: 'ev_term' };

// =====

describe('SessionToolRunner', () => {
  test('yields DispatchedToolCall for a successful tool execution and posts the result', async () => {
    const tool = makeOkTool('current_time', 'noon');
    const { client, calls } = makeFake({
      streams: [[toolUse('tu_1', 'current_time', { tz: 'UTC' }), TERMINATED]],
    });
    const runner = new SessionToolRunner('sesn_1', { client, tools: [tool], maxIdleMs: 0 });

    const items: DispatchedToolCall[] = [];
    for await (const c of runner) items.push(c);

    expect(items).toHaveLength(1);
    const call = items[0]!;
    expect(call.toolUseId).toBe('tu_1');
    expect(call.name).toBe('current_time');
    expect(call.event.input).toEqual({ tz: 'UTC' });
    expect(call.isError).toBe(false);
    expect(call.posted).toBe(true);
    expect(call.result!.content).toEqual([{ type: 'text', text: 'noon' }]);

    // The send carried a user.tool_result with matching tool_use_id.
    const sentResults = calls.send.flat().filter((e) => e.type === 'user.tool_result');
    expect(sentResults).toHaveLength(1);
    expect(sentResults[0]!['tool_use_id']).toBe('tu_1');
    expect(sentResults[0]!['is_error']).toBe(false);
  });

  test('yields isError=true when the tool throws', async () => {
    const tool = makeOkTool('boom', async () => {
      throw new Error('kaboom');
    });
    const { client } = makeFake({ streams: [[toolUse('tu_x', 'boom'), TERMINATED]] });
    const runner = new SessionToolRunner('s', { client, tools: [tool], maxIdleMs: 0 });
    const calls: DispatchedToolCall[] = [];
    for await (const c of runner) calls.push(c);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.isError).toBe(true);
    expect(JSON.stringify(calls[0]!.result!.content)).toMatch(/kaboom/);
  });

  // Default (skip-by-default): a self-hosted session is serviced by two
  // clients — this runner (sandbox tools) and the customer's app backend
  // (custom tools). A tool-use whose name this runner is not registered for
  // belongs to the other client: the runner must post NO result, claim
  // nothing, and leave the id pending — while still yielding the dispatched
  // call so the consumer can observe it. A registered tool still runs.
  test('skips a tool name it does not own (builtin and custom) and still runs a registered tool', async () => {
    let echoRuns = 0;
    const echo = makeOkTool('echo', async () => {
      echoRuns++;
      return 'ran';
    });
    const { client, calls } = makeFake({
      streams: [
        [
          toolUse('tu_x', 'not_ours'),
          customToolUse('ctu_y', 'app_backend_tool'),
          toolUse('tu_ok', 'echo'),
          TERMINATED,
        ],
      ],
    });
    const runner = new SessionToolRunner('s', { client, tools: [echo], maxIdleMs: 0 });
    const out: DispatchedToolCall[] = [];
    // Must not throw on the registry miss.
    for await (const c of runner) out.push(c);

    expect(out).toHaveLength(3);

    const unownedBuiltin = out[0]!;
    expect(unownedBuiltin.name).toBe('not_ours');
    expect(unownedBuiltin.event.type).toBe('agent.tool_use');
    expect(unownedBuiltin.isError).toBe(false);
    expect(unownedBuiltin.posted).toBe(false);
    expect(unownedBuiltin.result).toBeUndefined();

    const unownedCustom = out[1]!;
    expect(unownedCustom.name).toBe('app_backend_tool');
    expect(unownedCustom.event.type).toBe('agent.custom_tool_use');
    expect(unownedCustom.isError).toBe(false);
    expect(unownedCustom.posted).toBe(false);
    expect(unownedCustom.result).toBeUndefined();

    const owned = out[2]!;
    expect(owned.name).toBe('echo');
    expect(owned.isError).toBe(false);
    expect(owned.posted).toBe(true);
    expect(owned.result!.content).toEqual([{ type: 'text', text: 'ran' }]);
    expect(echoRuns).toBe(1);

    // Nothing was posted for either unowned id — only the registered tool's
    // result reached the session.
    const sent = calls.send.flat();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.type).toBe('user.tool_result');
    expect(sent[0]!['tool_use_id']).toBe('tu_ok');
    expect(JSON.stringify(sent)).not.toContain('tu_x');
    expect(JSON.stringify(sent)).not.toContain('ctu_y');
  });

  // A skipped (unanswered) unowned tool_use must stay OUT of the end-turn
  // accounting: reconcile sees history ending on an end_turn idle but with the
  // unowned tool_use still unanswered, so it must NOT arm the idle countdown —
  // the runner has not handled that call, its owner still has to.
  test('a skipped unowned tool_use does not falsely trip the idle watchdog', async () => {
    const { client, calls } = makeFake({
      streams: [[]], // no live events; reconcile drives the test
      list: [[toolUse('evt_pending', 'not_ours'), idleEndTurn()]],
    });
    const runner = new SessionToolRunner('s', { client, tools: [], maxIdleMs: 50 });
    const out: DispatchedToolCall[] = [];
    let finished = false;
    const consumer = (async () => {
      for await (const c of runner) out.push(c);
      finished = true;
    })();

    // Wait well past maxIdleMs (50). A wrongly-armed idle countdown would have
    // aborted the runner ~50ms in and resolved the consumer; a correct runner
    // keeps running because the unowned id is still pending its owner.
    await new Promise((r) => setTimeout(r, 300));
    expect(finished).toBe(false);

    expect(out).toHaveLength(1);
    const call = out[0]!;
    expect(call.toolUseId).toBe('evt_pending');
    expect(call.posted).toBe(false);
    expect(call.isError).toBe(false);
    expect(call.result).toBeUndefined();
    expect(calls.send).toHaveLength(0);

    runner.abort();
    await consumer;
    expect(finished).toBe(true);
  });

  test('does not re-execute a tool whose result is already in history', async () => {
    let runs = 0;
    const tool = makeOkTool('once', async () => {
      runs++;
      return 'ran';
    });
    const { client } = makeFake({
      // Reconcile sees both the tool_use AND its prior result, so execute is skipped.
      list: [[toolUse('tu_already', 'once'), { type: 'user.tool_result', tool_use_id: 'tu_already' }]],
      streams: [[TERMINATED]],
    });
    const runner = new SessionToolRunner('s', { client, tools: [tool], maxIdleMs: 0 });
    const out: DispatchedToolCall[] = [];
    for await (const c of runner) out.push(c);

    expect(runs).toBe(0);
    expect(out).toHaveLength(0);
  });

  test('session.status_terminated ends iteration', async () => {
    const { client } = makeFake({ streams: [[TERMINATED]] });
    const runner = new SessionToolRunner('s', { client, tools: [], maxIdleMs: 0 });
    const out: DispatchedToolCall[] = [];
    for await (const c of runner) out.push(c);
    expect(out).toEqual([]);
  });

  test('runs each tool.close() once when iteration ends, even when the consumer breaks early', async () => {
    let closed = 0;
    const tool: BetaRunnableTool = {
      ...makeOkTool('first', 'ok'),
      close: () => {
        closed++;
      },
    };
    const { client } = makeFake({
      streams: [[toolUse('tu_a', 'first'), toolUse('tu_b', 'first'), TERMINATED]],
    });
    const runner = new SessionToolRunner('s', { client, tools: [tool], maxIdleMs: 0 });

    let count = 0;
    for await (const _ of runner) {
      count++;
      if (count === 1) break;
    }
    expect(count).toBe(1);
    expect(closed).toBe(1);
  });

  test('posted=false when events.send hits a permanent 4xx', async () => {
    const tool = makeOkTool('t', 'ok');
    const err = Object.assign(Object.create(APIError.prototype) as APIError, { status: 404 });
    const { client } = makeFake({
      streams: [[toolUse('tu_p', 't'), TERMINATED]],
      sendErrors: [{ at: 0, err }],
    });
    const runner = new SessionToolRunner('s', { client, tools: [tool], maxIdleMs: 0 });
    const out: DispatchedToolCall[] = [];
    for await (const c of runner) out.push(c);

    expect(out).toHaveLength(1);
    expect(out[0]!.posted).toBe(false);
    expect(out[0]!.isError).toBe(false);
  });

  test('throws when iterated twice', async () => {
    const { client } = makeFake({ streams: [[TERMINATED]] });
    const runner = new SessionToolRunner('s', { client, tools: [], maxIdleMs: 0 });
    for await (const _ of runner) {
      // unreachable
    }
    await expect(
      (async () => {
        for await (const _ of runner) {
          // unreachable
        }
      })(),
    ).rejects.toThrow(/consumed/);
  });

  test('pre-aborted external signal settles cleanup without hanging', async () => {
    // Reproducer for: a pre-aborted signal would cause idleWatchdog's
    // maxIdleMs <= 0 branch to park on a signal that never re-fires, hanging
    // the iterator's `Promise.allSettled` step forever.
    const ctl = new AbortController();
    ctl.abort();
    const { client } = makeFake({ streams: [[]] });
    const runner = new SessionToolRunner('s', {
      client,
      tools: [],
      maxIdleMs: 0,
      signal: ctl.signal,
    });
    // If the bug is back, this hangs and Jest's per-test timeout fires.
    await Promise.race([
      (async () => {
        for await (const _ of runner) {
          // unreachable
        }
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('iter hung')), 2_000)),
    ]);
  }, 5_000);

  test('idle watchdog stops the runner maxIdleMs after an end_turn idle', async () => {
    jest.useFakeTimers();
    try {
      // Session goes idle with end_turn and nothing else happens — the idle
      // watchdog should stop the runner after maxIdleMs.
      const { client } = makeFake({ streams: [[idleEndTurn()]] });

      const runner = new SessionToolRunner('s', { client, tools: [], maxIdleMs: 1_000 });

      let done = false;
      const consumer = (async () => {
        for await (const _ of runner) {
          // unreachable — no tool calls
        }
        done = true;
      })();

      await jest.advanceTimersByTimeAsync(2_000);
      await consumer;
      expect(done).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  test('a new event after end_turn resets the idle watchdog', async () => {
    const tool = makeOkTool('echo', 'ok');
    // end_turn arms the timer; the tool_use that follows resets it and is
    // dispatched; the run only ends on the terminated event.
    const { client } = makeFake({
      streams: [[idleEndTurn(), toolUse('tu_1', 'echo'), TERMINATED]],
    });
    const runner = new SessionToolRunner('s', {
      client,
      tools: [tool],
      // Generous grace — the timer must not fire between the scripted events.
      maxIdleMs: 60_000,
    });
    const out: DispatchedToolCall[] = [];
    for await (const c of runner) out.push(c);
    expect(out.map((c) => c.toolUseId)).toEqual(['tu_1']);
  });

  test('dispatches an agent.custom_tool_use and answers with a matching user.custom_tool_result', async () => {
    const tool = makeOkTool('lookup_order', 'shipped');
    const { client, calls } = makeFake({
      streams: [[customToolUse('ctu_1', 'lookup_order', { order_id: 42 }), TERMINATED]],
    });
    const runner = new SessionToolRunner('s', { client, tools: [tool], maxIdleMs: 0 });

    const out: DispatchedToolCall[] = [];
    for await (const c of runner) out.push(c);

    expect(out).toHaveLength(1);
    const call = out[0]!;
    expect(call.event.type).toBe('agent.custom_tool_use');
    expect(call.toolUseId).toBe('ctu_1');
    expect(call.name).toBe('lookup_order');
    expect(call.event.input).toEqual({ order_id: 42 });
    expect(call.isError).toBe(false);
    expect(call.posted).toBe(true);
    expect(call.result!.type).toBe('user.custom_tool_result');
    expect((call.result! as { custom_tool_use_id?: string }).custom_tool_use_id).toBe('ctu_1');
    expect(call.result!.content).toEqual([{ type: 'text', text: 'shipped' }]);

    // A custom tool call must be answered with user.custom_tool_result, never
    // user.tool_result — the wrong type leaves the session hung.
    const sent = calls.send.flat();
    expect(sent.filter((e) => e.type === 'user.tool_result')).toHaveLength(0);
    const customResults = sent.filter((e) => e.type === 'user.custom_tool_result');
    expect(customResults).toHaveLength(1);
    expect(customResults[0]!['custom_tool_use_id']).toBe('ctu_1');
  });

  test('dispatches builtin and custom tool calls in one stream, each with its matching result type', async () => {
    const { client, calls } = makeFake({
      streams: [[toolUse('tu_b', 'echo'), customToolUse('ctu_c', 'echo'), TERMINATED]],
    });
    const runner = new SessionToolRunner('s', {
      client,
      tools: [makeOkTool('echo', 'ok')],
      maxIdleMs: 0,
    });

    const out: DispatchedToolCall[] = [];
    for await (const c of runner) out.push(c);

    expect(out.map((c) => [c.event.type, c.toolUseId])).toEqual([
      ['agent.tool_use', 'tu_b'],
      ['agent.custom_tool_use', 'ctu_c'],
    ]);
    const sent = calls.send.flat();
    expect(sent.filter((e) => e.type === 'user.tool_result').map((e) => e['tool_use_id'])).toEqual(['tu_b']);
    expect(
      sent.filter((e) => e.type === 'user.custom_tool_result').map((e) => e['custom_tool_use_id']),
    ).toEqual(['ctu_c']);
  });

  test('reconcile does not re-execute a custom tool whose user.custom_tool_result is already in history', async () => {
    let runs = 0;
    const tool = makeOkTool('once_custom', async () => {
      runs++;
      return 'ran';
    });
    const { client } = makeFake({
      // Reconcile sees the custom tool_use AND its prior custom result.
      list: [
        [
          customToolUse('ctu_done', 'once_custom'),
          { type: 'user.custom_tool_result', custom_tool_use_id: 'ctu_done' },
        ],
      ],
      streams: [[TERMINATED]],
    });
    const runner = new SessionToolRunner('s', { client, tools: [tool], maxIdleMs: 0 });
    const out: DispatchedToolCall[] = [];
    for await (const c of runner) out.push(c);

    expect(runs).toBe(0);
    expect(out).toHaveLength(0);
  });

  test('passes a search_result tool-result block through as a search_result event, not stringified', async () => {
    const tool = makeOkTool('web_search', async () => [
      {
        type: 'search_result',
        source: 'https://example.com/doc',
        title: 'Example Doc',
        content: [{ type: 'text', text: 'the answer is 42' }],
        citations: { enabled: true },
      },
    ]);
    const { client, calls } = makeFake({
      streams: [[toolUse('tu_s', 'web_search'), TERMINATED]],
    });
    const runner = new SessionToolRunner('s', { client, tools: [tool], maxIdleMs: 0 });
    const out: DispatchedToolCall[] = [];
    for await (const c of runner) out.push(c);

    expect(out).toHaveLength(1);
    // Mapped to the Sessions search_result block shape, NOT a text block with
    // a JSON.stringify of the original block.
    expect(out[0]!.result!.content).toEqual([
      {
        type: 'search_result',
        source: 'https://example.com/doc',
        title: 'Example Doc',
        content: [{ type: 'text', text: 'the answer is 42' }],
        citations: { enabled: true },
      },
    ]);
    const sent = calls.send.flat().filter((e) => e.type === 'user.tool_result');
    expect(sent).toHaveLength(1);
    const content = sent[0]!['content'] as Array<{ type: string }>;
    expect(content[0]!.type).toBe('search_result');
    // Must not have been buried inside a stringified text block.
    expect(JSON.stringify(content)).not.toContain('\\"type\\":\\"search_result\\"');
  });

  test('citations defaults to { enabled: false } when the producer omits it', async () => {
    const tool = makeOkTool('web_search', async () => [
      {
        type: 'search_result',
        source: 'https://example.com',
        title: 'No citations',
        content: [{ type: 'text', text: 'body' }],
      },
    ]);
    const { client } = makeFake({ streams: [[toolUse('tu_s2', 'web_search'), TERMINATED]] });
    const runner = new SessionToolRunner('s', { client, tools: [tool], maxIdleMs: 0 });
    const out: DispatchedToolCall[] = [];
    for await (const c of runner) out.push(c);

    expect(out[0]!.result!.content).toEqual([
      {
        type: 'search_result',
        source: 'https://example.com',
        title: 'No citations',
        content: [{ type: 'text', text: 'body' }],
        citations: { enabled: false },
      },
    ]);
  });

  test('forwards requestOptions custom headers to stream/list/send (alongside the helper header)', async () => {
    const tool = makeOkTool('echo', 'ok');
    const { client, calls } = makeFake({
      streams: [[toolUse('tu_h', 'echo')]],
      list: [[]],
    });
    const runner = new SessionToolRunner('s', {
      client,
      tools: [tool],
      maxIdleMs: 0,
      requestOptions: { headers: { 'x-proxy-token': 'secret-123' } },
    });
    const consume = (async () => {
      for await (const _ of runner) runner.abort();
    })();
    await consume;

    // stream, list (reconcile) and send were all called and each carried the
    // custom proxy header plus the helper telemetry header.
    expect(calls.options.length).toBeGreaterThanOrEqual(3);
    for (const opt of calls.options) {
      const headers = (opt as { headers?: { values?: Headers } }).headers;
      expect(headers?.values?.get('x-proxy-token')).toBe('secret-123');
      expect(headers?.values?.get('x-stainless-helper')).toBe('session-tool-runner');
    }
  });

  test('retries a tool_use whose result post failed on the next reconcile instead of dropping it', async () => {
    let runs = 0;
    const tool = makeOkTool('retry_me', async () => {
      runs++;
      return 'ok';
    });
    const fatal = Object.assign(Object.create(APIError.prototype) as APIError, { status: 400 });
    const { client, calls } = makeFake({
      // Stream 1 yields the tool_use then disconnects; stream 2 terminates.
      streams: [[toolUse('tu_r', 'retry_me')], [TERMINATED]],
      streamErrors: [0],
      // Reconcile on reconnect still sees the tool_use with no result event —
      // because the first post failed — so it must be retried, not dropped.
      list: [[], [toolUse('tu_r', 'retry_me')]],
      // The first post fails permanently; the retry after reconnect succeeds.
      sendErrors: [{ at: 0, err: fatal }],
    });
    const runner = new SessionToolRunner('s', { client, tools: [tool], maxIdleMs: 0 });
    const out: DispatchedToolCall[] = [];
    for await (const c of runner) out.push(c);

    // Re-executed (and re-posted) once the failed post was retried.
    expect(runs).toBe(2);
    expect(calls.send.flat().filter((e) => e.type === 'user.tool_result')).toHaveLength(2);
    expect(out.map((c) => c.posted)).toEqual([false, true]);
  });
});
