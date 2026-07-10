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

// `evaluatedPermission` is typed `string` (not the known union) so tests can
// exercise how the runner treats a permission value it does not recognize.
function toolUse(
  id: string,
  name: string,
  input: Record<string, unknown> = {},
  evaluatedPermission?: string,
): AnyEvent {
  const ev: AnyEvent = { type: 'agent.tool_use', id, name, input };
  if (evaluatedPermission !== undefined) ev['evaluated_permission'] = evaluatedPermission;
  return ev;
}

// The user's answer to a tool call that is waiting for approval: only `allow`
// lets it run; any other verdict drops it. `result` is typed `string` (not the
// known union) so tests can exercise verdict values this SDK doesn't recognize.
function toolConfirmation(id: string, toolUseId: string, result: string): AnyEvent {
  return { type: 'user.tool_confirmation', id, tool_use_id: toolUseId, result };
}

function customToolUse(id: string, name: string, input: Record<string, unknown> = {}): AnyEvent {
  return { type: 'agent.custom_tool_use', id, name, input };
}

function idleEndTurn(): AnyEvent {
  return { type: 'session.status_idle', id: 'ev_idle', stop_reason: { type: 'end_turn' } };
}

/** A `session.status_idle` with `stop_reason: requires_action` — the server
 *  parks here waiting on the listed events (tool confirmations, tool results). */
function idleRequiresAction(eventIds: string[]): AnyEvent {
  return {
    type: 'session.status_idle',
    id: 'ev_idle_ra',
    stop_reason: { type: 'requires_action', event_ids: eventIds },
  };
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

  // A skipped (unanswered) unowned tool_use stays OUT of the end-turn
  // accounting: reconcile sees history ending on an `end_turn` idle but with
  // the unowned tool_use still unanswered, so it must NOT arm the countdown —
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

  // ===== tool calls that need user approval =====
  //
  // The server marks each `agent.tool_use` with `evaluated_permission`. Only
  // "allow" (or no mark) runs on arrival; "ask" waits for the user's
  // `user.tool_confirmation`; "deny" and unrecognized values never run.

  // A denied call is still an outcome the consumer needs to observe: the
  // agent tried to invoke a tool and was blocked. Dropping it silently
  // makes "the agent called nothing" indistinguishable from "the agent
  // called five tools and the user denied every one", which breaks audit
  // trails and any UI that surfaces per-call outcomes. So a denied call —
  // whether the server evaluated permission to `deny` or the user's
  // confirmation verdict was a deny — must be yielded with
  // `DispatchedToolCall.confirmation === 'deny'` (`posted=false`,
  // `isError=false`, no result), and an ask-then-allow call must carry
  // `confirmation === 'allow'` so the consumer can tell it was gated.
  test('denied calls are yielded with confirmation="deny"', async () => {
    const ran: string[] = [];
    const echo = makeOkTool('echo', async (input) => (ran.push((input as { id: string }).id), 'ok'));
    const { client, calls } = makeFake({
      list: [
        [
          toolUse('srv_deny', 'echo', { id: 'srv_deny' }, 'deny'),
          toolUse('usr_deny', 'echo', { id: 'usr_deny' }, 'ask'),
          toolUse('usr_allow', 'echo', { id: 'usr_allow' }, 'ask'),
          idleRequiresAction(['usr_deny', 'usr_allow']),
        ],
      ],
      streams: [
        [
          toolConfirmation('c1', 'usr_deny', 'deny'),
          toolConfirmation('c2', 'usr_allow', 'allow'),
          idleEndTurn(),
        ],
      ],
    });
    const runner = new SessionToolRunner('s', { client, tools: [echo], maxIdleMs: 200 });
    const got = new Map<string, DispatchedToolCall>();
    for await (const c of runner) got.set(c.toolUseId, c);

    expect(got.has('srv_deny')).toBe(true); // server-denied call was not yielded
    expect(got.has('usr_deny')).toBe(true); // user-denied call was not yielded
    expect(got.has('usr_allow')).toBe(true);

    for (const id of ['srv_deny', 'usr_deny']) {
      const c = got.get(id)!;
      expect(c.confirmation).toBe('deny');
      expect(c.posted).toBe(false);
      expect(c.isError).toBe(false);
      expect(c.result).toBeUndefined();
    }
    expect(got.get('usr_allow')!.confirmation).toBe('allow');
    expect(got.get('usr_allow')!.posted).toBe(true);

    expect(ran).toEqual(['usr_allow']);
    expect(calls.send).toHaveLength(1);
  });

  test('only tools the server or user allowed ever run', async () => {
    const ran: string[] = [];
    const echo = makeOkTool('echo', async (input) => (ran.push((input as { id: string }).id), 'ok'));
    const use = (id: string, permission?: string) => toolUse(id, 'echo', { id }, permission);

    const { client, calls } = makeFake({
      // From the history endpoint (read once when the runner connects):
      list: [
        [use('ask_answered_in_history', 'ask'), toolConfirmation('h1', 'ask_answered_in_history', 'allow')],
      ],
      // From the live event stream:
      streams: [
        [
          use('marked_allow', 'allow'),
          use('marked_deny', 'deny'),
          use('ask_then_allowed', 'ask'),
          use('ask_then_denied', 'ask'),
          use('ask_never_answered', 'ask'),
          use('ask_verdict_unrecognized', 'ask'),
          use('unrecognized_mark', 'something_new'),
          toolConfirmation('c1', 'ask_then_allowed', 'allow'),
          toolConfirmation('c2', 'ask_then_denied', 'deny'),
          toolConfirmation('c3', 'ask_verdict_unrecognized', 'escalate'),
          TERMINATED,
        ],
      ],
    });

    const got = new Map<string, DispatchedToolCall>();
    for await (const c of new SessionToolRunner('s', { client, tools: [echo], maxIdleMs: 0 }))
      got.set(c.toolUseId, c);

    const allowed = ['ask_answered_in_history', 'ask_then_allowed', 'marked_allow'];
    expect(ran.sort()).toEqual(allowed);
    expect(calls.send.flat().filter((e) => e.type === 'user.tool_result')).toHaveLength(3);

    // Every routed call is yielded — allowed with its confirmation, denied
    // with confirmation="deny". Only calls still held when the session
    // terminates (never answered / unrecognized permission) are not.
    expect([...got.keys()].sort()).toEqual([
      'ask_answered_in_history',
      'ask_then_allowed',
      'ask_then_denied',
      'ask_verdict_unrecognized',
      'marked_allow',
      'marked_deny',
    ]);
    expect(got.get('marked_allow')!.confirmation).toBeUndefined();
    expect(got.get('ask_answered_in_history')!.confirmation).toBe('allow');
    expect(got.get('ask_then_allowed')!.confirmation).toBe('allow');
    for (const id of ['marked_deny', 'ask_then_denied', 'ask_verdict_unrecognized']) {
      const c = got.get(id)!;
      expect(c.confirmation).toBe('deny');
      expect(c.posted).toBe(false);
      expect(c.result).toBeUndefined();
    }
  });

  test('an open approval keeps the runner alive; once answered the runner stops on its own', async () => {
    const drive = (list: AnyEvent[], stream: AnyEvent[]) => {
      const { client } = makeFake({ list: [list], streams: [stream] });
      const runner = new SessionToolRunner('s', { client, tools: [], maxIdleMs: 50 });
      let done = false;
      const loop = (async () => {
        for await (const _ of runner) {
        }
        done = true;
      })();
      return { runner, loop, done: () => done };
    };

    // History shows a held call and the turn ending; the answer has not
    // arrived. The runner must not stop.
    const waiting = drive([toolUse('tu', 'echo', {}, 'ask'), idleEndTurn()], []);
    await new Promise((r) => setTimeout(r, 300));
    expect(waiting.done()).toBe(false);
    waiting.runner.abort();
    await waiting.loop;

    // Same history, then the user's answer closes the approval on the live
    // stream — a deny, or an unrecognized verdict resolved as one (fail closed
    // without wedging the runner open). Nothing is pending and the turn is
    // over: the runner stops.
    for (const verdict of ['deny', 'not_a_verdict']) {
      const answered = drive(
        [toolUse('tu', 'echo', {}, 'ask'), idleEndTurn()],
        [toolConfirmation('c', 'tu', verdict)],
      );
      await new Promise((r) => setTimeout(r, 300));
      expect(answered.done()).toBe(true);
      await answered.loop;
    }
  });

  test('an end_turn idle on the live stream while a call is held does not stop the runner', async () => {
    // The live-stream counterpart of the reconcile case above. The server
    // up-converts a legacy idle event to `end_turn` unconditionally, so an
    // `end_turn` can land while a call sits on a human's approval — arming the
    // countdown then would drop the call once its verdict finally arrives.
    let runs = 0;
    const echo = makeOkTool('echo', async () => (runs++, 'ok'));
    const { client, calls } = makeFake({
      streams: [[toolUse('tu', 'echo', {}, 'ask'), idleEndTurn()]],
    });
    const runner = new SessionToolRunner('s', { client, tools: [echo], maxIdleMs: 100 });

    let done = false;
    const loop = (async () => {
      for await (const _ of runner) {
      }
      done = true;
    })();
    // Well past maxIdleMs: the runner must still be waiting with the approver.
    await new Promise((r) => setTimeout(r, 500));
    expect(done).toBe(false);
    expect(runs).toBe(0);
    expect(calls.send).toHaveLength(0);

    runner.abort();
    await loop;
  });

  test('a deny after a live end_turn resumes the idle stop', async () => {
    // The session went idle while the call was held, so the deferred arm is all
    // the runner has left — the denial itself produces no further events. It
    // must apply that arm and stop on its own instead of waiting forever.
    let runs = 0;
    const echo = makeOkTool('echo', async () => (runs++, 'ok'));
    const { client, calls } = makeFake({
      streams: [[toolUse('tu', 'echo', {}, 'ask'), idleEndTurn(), toolConfirmation('c', 'tu', 'deny')]],
    });
    const runner = new SessionToolRunner('s', { client, tools: [echo], maxIdleMs: 50 });

    const out: DispatchedToolCall[] = [];
    let done = false;
    const loop = (async () => {
      for await (const c of runner) out.push(c);
      done = true;
    })();
    await new Promise((r) => setTimeout(r, 600));
    expect(done).toBe(true);
    await loop;

    expect(runs).toBe(0);
    expect(calls.send).toHaveLength(0);
    expect(out.map((c) => c.confirmation)).toEqual(['deny']);
  });

  test('a released call is not cut short by the idle countdown it deferred', async () => {
    // A held call released by the reconcile pass (its allow verdict only shows
    // up in history after a reconnect) is in-flight work: the `end_turn` idle
    // ending that same history must not run the countdown while the released
    // tool is still executing. Only once the call is fully dispatched does the
    // deferred countdown start — a fresh grace window for the events the posted
    // result will produce.
    const maxIdleMs = 400;
    let runs = 0;
    const slow = makeOkTool('gated', async () => {
      runs++;
      await new Promise((r) => setTimeout(r, 600));
      return 'ran';
    });
    const { client, calls } = makeFake({
      // The gated call arrives live (and is held), then the stream drops.
      streams: [[toolUse('tu', 'gated', {}, 'ask')], []],
      streamErrors: [0],
      // The reconcile after the reconnect sees only the verdict and the idle —
      // the tool_use itself has scrolled out of the listed window.
      list: [[], [toolConfirmation('c', 'tu', 'allow'), idleEndTurn()]],
    });
    const runner = new SessionToolRunner('s', { client, tools: [slow], maxIdleMs });

    const out: DispatchedToolCall[] = [];
    const loop = (async () => {
      for await (const c of runner) out.push(c);
    })();
    while (calls.send.length === 0) await new Promise((r) => setTimeout(r, 10));
    const postedAt = Date.now();
    await loop;
    const stoppedAt = Date.now();

    expect(runs).toBe(1);
    expect(out.map((c) => c.confirmation)).toEqual(['allow']);
    expect(out[0]!.posted).toBe(true);
    // A countdown armed during the reconcile has already expired by the time
    // the slow tool finishes (600ms > maxIdleMs), stopping the runner the
    // moment it posts. The deferred countdown instead starts once the call is
    // dispatched, so the runner stays up for roughly a full grace window.
    expect(stoppedAt - postedAt).toBeGreaterThan(maxIdleMs * 0.6);
  });

  test('a deferred arm cancels the stale pre-disconnect countdown', async () => {
    // An end_turn armed the countdown, then the stream dropped. The reconciled
    // history ends with a held ask-gated call and its end_turn, so the arm
    // defers — but the pre-disconnect countdown is now stale evidence and must
    // be cancelled, or the runner stops maxIdleMs after the *old* stamp while
    // the confirmation is still pending on a human.
    const { client } = makeFake({
      // The agent finishes a turn (end_turn arms the countdown)… then the
      // now-quiet SSE connection is dropped — exactly what load balancers do
      // to idle streams. The second connection stays silent: the approver
      // has stepped away.
      streams: [[idleEndTurn()], []],
      streamErrors: [0],
      // While the runner was reconnecting, the user sent a follow-up from
      // another client (the product UI); the agent hit a tool the policy
      // gates on approval, and its turn ended parked on that ask. The
      // reconnect's reconcile is how the runner learns all of this.
      list: [[], [toolUse('tu', 'echo', {}, 'ask'), idleEndTurn()]],
    });
    // maxIdleMs must outlast the 500ms reconnect backoff so the held call is
    // known before the stale stamp expires.
    const runner = new SessionToolRunner('s', { client, tools: [], maxIdleMs: 800 });

    let done = false;
    const loop = (async () => {
      for await (const _ of runner) {
      }
      done = true;
    })();
    // Well past the stale stamp's expiry (backoff 500ms + maxIdleMs 800ms):
    // the runner must still be waiting with the approver, deferring on the
    // held call.
    await new Promise((r) => setTimeout(r, 2500));
    expect(done).toBe(false);
    runner.abort();
    await loop;
  });

  test('a reconciled verdict releases a held call whose tool_use fell out of the history window', async () => {
    // The call is held from the live stream, the stream drops, and the allow
    // verdict is posted during the disconnect. By the time reconcile lists
    // history, the tool_use itself has scrolled out of the listed window — the
    // verdict must still release the held copy, exactly once.
    const ran: string[] = [];
    const echo = makeOkTool('echo', async (input) => (ran.push((input as { id: string }).id), 'ok'));
    const { client, calls } = makeFake({
      // Stream 1 yields the gated call (held) then disconnects; stream 2 terminates.
      streams: [[toolUse('tu', 'echo', { id: 'tu' }, 'ask')], [TERMINATED]],
      streamErrors: [0],
      // The reconcile after the reconnect sees only the verdict.
      list: [[], [toolConfirmation('c', 'tu', 'allow')]],
    });

    const out: DispatchedToolCall[] = [];
    for await (const c of new SessionToolRunner('s', { client, tools: [echo], maxIdleMs: 0 })) out.push(c);

    expect(ran).toEqual(['tu']);
    expect(out.map((c) => c.toolUseId)).toEqual(['tu']);
    expect(calls.send.flat().filter((e) => e.type === 'user.tool_result')).toHaveLength(1);
  });

  test('a reconciled deny for a held call missing from the history window still lets the runner stop', async () => {
    // Deny flavor of the window-eviction case: the verdict must resolve the
    // held copy (nothing runs, nothing posts) and clear the hold so the
    // end_turn idle in the same history can stop the runner — instead of the
    // occupied hold deferring idle-out forever.
    let runs = 0;
    const echo = makeOkTool('echo', async () => (runs++, 'ok'));
    const { client, calls } = makeFake({
      streams: [[toolUse('tu', 'echo', {}, 'ask')], []],
      streamErrors: [0],
      list: [[], [toolConfirmation('c', 'tu', 'deny'), idleEndTurn()]],
    });
    const runner = new SessionToolRunner('s', { client, tools: [echo], maxIdleMs: 50 });

    let done = false;
    const loop = (async () => {
      for await (const _ of runner) {
      }
      done = true;
    })();
    // Reconnect backoff (500ms) + idle grace (50ms), with headroom.
    await new Promise((r) => setTimeout(r, 1200));
    expect(done).toBe(true);
    await loop;

    expect(runs).toBe(0);
    expect(calls.send.flat()).toHaveLength(0);
  });
});
