import { context, trace, ROOT_CONTEXT, type Context, type ContextManager } from '@opentelemetry/api';
import { SessionToolRunner } from '@anthropic-ai/sdk/lib/tools/SessionToolRunner';
import {
  exporter,
  openSpans,
  provider,
  tracer,
  makeClient,
  json,
  sse,
  MESSAGE,
  PARAMS,
  STREAM_EVENTS,
  spans,
  onlySpan,
  parentId,
} from './utils';

/**
 * A context manager that does not follow promises, as the one of a browser: a context is active
 * only while the callback of `with()` runs, so not after the first `await` in an async callback.
 */
class SyncContextManager implements ContextManager {
  #stack: Context[] = [];

  active(): Context {
    return this.#stack.at(-1) ?? ROOT_CONTEXT;
  }

  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    activeContext: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    this.#stack.push(activeContext);
    try {
      return fn.call(thisArg, ...args);
    } finally {
      this.#stack.pop();
    }
  }

  bind<T>(_context: Context, target: T): T {
    return target;
  }

  enable(): this {
    return this;
  }

  disable(): this {
    this.#stack = [];
    return this;
  }
}

beforeAll(() => {
  context.setGlobalContextManager(new SyncContextManager());
  trace.setGlobalTracerProvider(provider);
});

afterEach(() => {
  exporter.reset();
  openSpans.clear();
});

afterAll(() => {
  trace.disable();
  context.disable();
});

/** Runs `fn` with a new span of `name` current, only until `fn` returns, and ends the span. */
function withCurrentSpan<T>(name: string, fn: () => T): T {
  const span = tracer.startSpan(name);
  try {
    return context.with(trace.setSpan(context.active(), span), fn);
  } finally {
    span.end();
  }
}

function weatherTool(run: () => Promise<string>) {
  return {
    type: 'custom' as const,
    name: 'get_weather',
    input_schema: { type: 'object' as const, properties: {} },
    parse: (input: unknown) => input,
    run,
  };
}

const toolUseMessage = {
  ...MESSAGE,
  id: 'msg_tool',
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: {} }],
};

describe('OpenTelemetry spans with a context manager that does not follow promises', () => {
  test('an API call is under the span that is current where the application makes it', async () => {
    const { client } = makeClient([json(MESSAGE)]);

    await withCurrentSpan('app', () => client.messages.create(PARAMS));

    expect(parentId(onlySpan('anthropic.messages.create'))).toBe(onlySpan('app').spanContext().spanId);
  });

  test('the tool runner span is under the span that is current where the loop starts, and contains each API call and each tool execution', async () => {
    const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);
    let currentInTool: string | undefined;
    const tool = weatherTool(async () => {
      currentInTool = trace.getActiveSpan()?.spanContext().spanId;
      return 'sunny';
    });

    await withCurrentSpan('app', () =>
      client.beta.messages.toolRunner({ ...PARAMS, tools: [tool] }).runUntilDone(),
    );

    const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
    expect(parentId(toolRunnerSpan)).toBe(onlySpan('app').spanContext().spanId);
    const calls = spans('anthropic.messages.create');
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(parentId(call)).toBe(toolRunnerSpan.spanContext().spanId);
    }
    const toolSpan = onlySpan('anthropic.custom_tool_use get_weather');
    expect(parentId(toolSpan)).toBe(toolRunnerSpan.spanContext().spanId);
    expect(currentInTool).toBe(toolSpan.spanContext().spanId);
  });

  test('a tool the application runs with generateToolResponse() is under the span that is current where it calls the method', async () => {
    const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);
    const runner = client.beta.messages.toolRunner({ ...PARAMS, tools: [weatherTool(async () => 'sunny')] });
    const messages = runner[Symbol.asyncIterator]();

    await messages.next();
    await withCurrentSpan('app.during', () => runner.generateToolResponse());
    await messages.next();
    await messages.next();

    expect(parentId(onlySpan('anthropic.custom_tool_use get_weather'))).toBe(
      onlySpan('app.during').spanContext().spanId,
    );
  });

  test('with runToolsEagerly, a tool that starts while the reply streams is under the tool runner span, as its request is', async () => {
    const toolUseEvents = [
      { type: 'message_start', message: { ...toolUseMessage, content: [] } },
      { type: 'content_block_start', index: 0, content_block: toolUseMessage.content[0] },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'tool_use', stop_sequence: null },
        usage: { output_tokens: 5 },
      },
      { type: 'message_stop' },
    ];
    const { client } = makeClient([sse(toolUseEvents), sse(STREAM_EVENTS)]);

    await withCurrentSpan('app', () =>
      client.beta.messages
        .toolRunner({
          ...PARAMS,
          stream: true,
          runToolsEagerly: true,
          tools: [weatherTool(async () => 'sunny')],
        })
        .runUntilDone(),
    );

    const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
    expect(parentId(toolRunnerSpan)).toBe(onlySpan('app').spanContext().spanId);
    const calls = spans('anthropic.messages.create');
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(parentId(call)).toBe(toolRunnerSpan.spanContext().spanId);
    }
    expect(parentId(onlySpan('anthropic.custom_tool_use get_weather'))).toBe(
      toolRunnerSpan.spanContext().spanId,
    );
  });

  test('a Sessions tool span is under the span that is current where the loop starts', async () => {
    const { client } = makeClient([json({})]);
    const fake = {
      openTelemetry: client.openTelemetry,
      _tracer: provider.getTracer('test'),
      beta: {
        sessions: {
          events: {
            list: async function* () {},
            send: client.beta.sessions.events.send.bind(client.beta.sessions.events),
            stream: async () =>
              (async function* () {
                yield { type: 'agent.custom_tool_use', id: 'sevt_1', name: 'get_weather', input: {} };
                yield { type: 'session.status_terminated', id: 'sevt_2' };
              })(),
          },
        },
      },
    };
    let currentInTool: string | undefined;
    const tool = weatherTool(async () => {
      currentInTool = trace.getActiveSpan()?.spanContext().spanId;
      return 'sunny';
    });
    const calls = new SessionToolRunner('sesn_1', {
      client: fake as never,
      maxIdleMs: 0,
      tools: [{ ...tool, description: 'weather' }],
    })[Symbol.asyncIterator]();

    let next = await withCurrentSpan('app', () => calls.next());
    while (!next.done) {
      next = await calls.next();
    }

    const toolSpan = onlySpan('anthropic.custom_tool_use get_weather');
    expect(parentId(toolSpan)).toBe(onlySpan('app').spanContext().spanId);
    expect(currentInTool).toBe(toolSpan.spanContext().spanId);
  });

  test('the span of a Work item is under the span that is current where the application asks the work poller for the item', async () => {
    const work = (id: string) =>
      json({
        id,
        type: 'work',
        environment_id: 'env_1',
        data: { type: 'session', id: 'sesn_1' },
        secret: null,
      });
    // For each item: the poll, the acknowledgment, and the stop once the application is done with it.
    const { client } = makeClient([work('work_1'), json({}), json({}), work('work_2'), json({}), json({})]);
    const items = client.beta.environments.work
      .poller({ environmentId: 'env_1', environmentKey: 'env_key' })
      [Symbol.asyncIterator]();

    await withCurrentSpan('app.first', () => items.next());
    await withCurrentSpan('app.second', () => items.next());
    await items.return?.();

    const [first, second] = spans('anthropic.environment.work');
    expect(spans('anthropic.environment.work')).toHaveLength(2);
    expect(parentId(first!)).toBe(onlySpan('app.first').spanContext().spanId);
    expect(parentId(second!)).toBe(onlySpan('app.second').spanContext().spanId);
    expect(openSpans.size).toBe(0);
  });
});
