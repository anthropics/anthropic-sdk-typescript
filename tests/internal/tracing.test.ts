import { AsyncLocalStorage } from 'node:async_hooks';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import v8 from 'node:v8';
import vm from 'node:vm';
import {
  context,
  propagation,
  trace,
  ROOT_CONTEXT,
  TraceFlags,
  type Context,
  type ContextManager,
  type Span,
  type SpanContext,
  type TextMapPropagator,
  type TextMapSetter,
  type Tracer,
  type TracerProvider,
} from '@opentelemetry/api';
import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk';
import { AbstractPage } from '@anthropic-ai/sdk/core/pagination';
import type { Stream } from '@anthropic-ai/sdk/core/streaming';
import { startApiCallSpan } from '@anthropic-ai/sdk/internal/tracing';
import { multipartFormRequestOptions } from '@anthropic-ai/sdk/internal/uploads';

const BASE_URL = 'http://localhost:5000/';
const SAMPLED_CONTEXT: SpanContext = {
  traceId: '0af7651916cd43dd8448eb211c80319c',
  spanId: 'b7ad6b7169203331',
  traceFlags: TraceFlags.SAMPLED,
};
const UNSAMPLED_CONTEXT: SpanContext = { ...SAMPLED_CONTEXT, traceFlags: TraceFlags.NONE };

const failing = (where: string) => () => {
  throw new Error("the application's " + where + ' failed');
};

class RecordingSpan implements Span {
  ended = false;

  spanContext(): SpanContext {
    return SAMPLED_CONTEXT;
  }
  setAttribute(): this {
    return this;
  }
  setAttributes(): this {
    return this;
  }
  addEvent(): this {
    return this;
  }
  addLink(): this {
    return this;
  }
  addLinks(): this {
    return this;
  }
  setStatus(): this {
    return this;
  }
  updateName(): this {
    return this;
  }
  end(): void {
    this.ended = true;
  }
  isRecording(): boolean {
    return !this.ended;
  }
  recordException(): void {}
}

/** A tracer provider that the application wrote, whose spans are what `startSpan` returns, each kept in `spans`. */
function provider<S extends Span>(startSpan: () => S): { tracerProvider: TracerProvider; spans: S[] } {
  const spans: S[] = [];
  const tracer: Tracer = {
    startSpan: () => {
      const span = startSpan();
      spans.push(span);
      return span;
    },
    startActiveSpan: () => {
      throw new Error('The SDK starts no active span.');
    },
  };
  return { tracerProvider: { getTracer: () => tracer }, spans };
}

/** A provider whose spans record, and throw from `method`. */
function providerOfSpansFailingIn(method: keyof Span): TracerProvider {
  return provider(() => Object.assign(new RecordingSpan(), { [method]: failing('span.' + method) }))
    .tracerProvider;
}

const writingPropagator = (inject: TextMapPropagator['inject']): TextMapPropagator => ({
  inject,
  extract: (context) => context,
  fields: () => ['traceparent'],
});

const WORKING_PROPAGATOR = writingPropagator((_context, carrier, setter) =>
  setter.set(carrier, 'traceparent', 'from-the-propagator'),
);

function traceparent({ traceId, spanId, traceFlags }: SpanContext): string {
  return '00-' + traceId + '-' + spanId + '-0' + traceFlags;
}

class CountingPropagator implements TextMapPropagator {
  injected = 0;

  inject(context: Context, carrier: unknown, setter: TextMapSetter): void {
    this.injected++;
    const spanContext = trace.getSpanContext(context);
    if (spanContext && trace.isSpanContextValid(spanContext)) {
      setter.set(carrier, 'traceparent', traceparent(spanContext));
    }
  }

  extract(context: Context): Context {
    return context;
  }

  fields(): string[] {
    return ['traceparent'];
  }
}

/** Keeps the active context across the awaits of an API call, as an application's context manager does. */
class AsyncContextManager implements ContextManager {
  #storage = new AsyncLocalStorage<Context>();

  active(): Context {
    return this.#storage.getStore() ?? ROOT_CONTEXT;
  }

  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    context: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    return this.#storage.run(context, () => fn.call(thisArg, ...args));
  }

  bind<T>(_context: Context, target: T): T {
    return target;
  }

  enable(): this {
    return this;
  }

  disable(): this {
    this.#storage.disable();
    return this;
  }
}

/**
 * Where the application's OpenTelemetry code throws. A sampler or a span processor that throws
 * when a span starts makes `startSpan` throw, and a span processor that throws when a span ends
 * makes `end` throw.
 */
const FAILURES: Record<
  string,
  { tracerProvider: () => TracerProvider; propagator?: () => TextMapPropagator }
> = {
  "the tracer provider's getTracer": { tracerProvider: () => ({ getTracer: failing('getTracer') }) },
  "the tracer's startSpan": { tracerProvider: () => provider(failing('startSpan')).tracerProvider },
  "a span's setAttribute": { tracerProvider: () => providerOfSpansFailingIn('setAttribute') },
  "a span's setStatus": { tracerProvider: () => providerOfSpansFailingIn('setStatus') },
  "a span's end": { tracerProvider: () => providerOfSpansFailingIn('end') },
  "the propagator's inject": {
    tracerProvider: () => provider(() => new RecordingSpan()).tracerProvider,
    propagator: () => writingPropagator(failing('inject')),
  },
};

const makeClient = (option?: ClientOptions['openTelemetry']) =>
  new Anthropic({ apiKey: 'my-anthropic-api-key', openTelemetry: option });

type Handler = () => Response | Promise<Response>;

/** A client with `options` whose requests `handlers` answer, in order. */
function makeStubbedClient(handlers: Handler[], { openTelemetry, ...options }: Partial<ClientOptions>) {
  const requests: Headers[] = [];
  const fetch = async (_url: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const handler = handlers[requests.length];
    requests.push(new Headers(init.headers));
    if (!handler) {
      throw new Error('The test expects no such request.');
    }
    return handler();
  };
  return {
    client: makeClient(openTelemetry).withOptions({ baseURL: BASE_URL, maxRetries: 0, fetch, ...options }),
    requests,
  };
}

interface Attempt {
  traceparent: string | null;
  /** The context of the span that is active while the request is sent. */
  activeSpanContext: SpanContext | undefined;
}

/** A client whose first attempt fails, so that a call makes two. `attempts` gets what each one sent. */
function makeRetriedClient(openTelemetry: ClientOptions['openTelemetry']) {
  const attempts: Attempt[] = [];
  const fetch = async (_url: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    attempts.push({
      traceparent: new Headers(init.headers).get('traceparent'),
      activeSpanContext: trace.getActiveSpan()?.spanContext(),
    });
    if (attempts.length === 1) {
      return new Response(undefined, { status: 500, headers: { 'Retry-After': '0.01' } });
    }
    return new Response(JSON.stringify({ token: 'tok_1' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return {
    client: makeClient(openTelemetry).withOptions({ baseURL: BASE_URL, maxRetries: 1, fetch }),
    attempts,
  };
}

/** Makes an API call the way a generated method does. */
const get = <Rsp>(client: Anthropic, options?: Anthropic.RequestOptions) =>
  client.get<Rsp>('/cards/card_1', { ...options, __span: startApiCallSpan(client, 'test', options) });

const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sse = (events: unknown[]) => () =>
  new Response(events.map((event) => 'data: ' + JSON.stringify(event) + '\n\n').join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });

type Card = { id: string };

class CardsPage extends AbstractPage<Card> {
  getPaginatedItems() {
    return (this.body as { data: Card[] }).data;
  }
  nextPageRequestOptions() {
    return this.options;
  }
}

/** What the application sees of a call that failed. */
const seen = (error: unknown) => ({ error: (error as Error).constructor.name, message: String(error) });

/** Each makes one kind of API call with a client that has `options`, and returns what the application sees of it. */
const CALLS: Record<string, (options: Partial<ClientOptions>) => Promise<unknown>> = {
  'a call': async (options) => {
    const { client, requests } = makeStubbedClient([json({ token: 'tok_1' })], options);
    return { card: await get(client), requests: requests.length };
  },
  'withResponse()': async (options) => {
    const { client, requests } = makeStubbedClient([json({ token: 'tok_1' })], options);
    const { data, response } = await get(client).withResponse();
    return { data, status: response.status, requests: requests.length };
  },
  'asResponse()': async (options) => {
    const { client, requests } = makeStubbedClient([json({ token: 'tok_1' })], options);
    const response = await get(client).asResponse();
    return { body: await response.json(), requests: requests.length };
  },
  'a stream that the application reads': async (options) => {
    const { client, requests } = makeStubbedClient([sse([{ message: 'a' }, { message: 'b' }])], options);
    const events = [];
    for await (const event of await get<Stream<unknown>>(client, { stream: true })) {
      events.push(event);
    }
    return { events, requests: requests.length };
  },
  'every page of a list': async (options) => {
    const pages = [{ data: [{ id: 'a' }] }, { data: [{ id: 'b' }] }, { data: [] }];
    const { client, requests } = makeStubbedClient(
      pages.map((page) => json(page)),
      options,
    );
    const ids = [];
    for await (const card of client.getAPIList<Card, CardsPage>('/cards', CardsPage, {
      __span: startApiCallSpan(client, 'test'),
    })) {
      ids.push(card.id);
    }
    return { ids, requests: requests.length };
  },
  'a call that the API answers with 400': async (options) => {
    const { client, requests } = makeStubbedClient(
      [json({ error: { type: 'invalid_request' } }, 400)],
      options,
    );
    const error = await get(client).catch((error) => error);
    return {
      ...seen(error),
      isBadRequest: error instanceof Anthropic.BadRequestError,
      requests: requests.length,
    };
  },
  'a call that the API answers with 500 after a retry': async (options) => {
    const handlers = [json({}, 500), json({}, 500)];
    const { client, requests } = makeStubbedClient(handlers, { ...options, maxRetries: 1 });
    const error = await get(client).catch((error) => error);
    return {
      ...seen(error),
      isInternalServerError: error instanceof Anthropic.InternalServerError,
      requests: requests.length,
    };
  },
  'a call whose response does not parse': async (options) => {
    const body = () => new Response('{', { headers: { 'Content-Type': 'application/json' } });
    const { client, requests } = makeStubbedClient([body], options);
    const error = await get(client).catch((error) => error);
    return { ...seen(error), requests: requests.length };
  },
  'a call that the application aborted': async (options) => {
    const { client, requests } = makeStubbedClient([json({ token: 'tok_1' })], options);
    const error = await get(client, { signal: AbortSignal.abort() }).catch((error) => error);
    return {
      ...seen(error),
      isAbort: error instanceof Anthropic.APIUserAbortError,
      requests: requests.length,
    };
  },
  'a call whose request fails': async (options) => {
    const { client, requests } = makeStubbedClient([failing('fetch')], options);
    const error = await get(client).catch((error) => error);
    return { ...seen(error), cause: String((error as Error).cause), requests: requests.length };
  },
  'an upload whose form cannot be built': async (options) => {
    const { client, requests } = makeStubbedClient([], options);
    const error = await client
      .post(
        '/files',
        multipartFormRequestOptions(
          { body: { file: null }, __span: startApiCallSpan(client, 'test') },
          client,
        ),
      )
      .catch((error) => error);
    return { ...seen(error), requests: requests.length };
  },
};

const PROPAGATION_ENV = 'ANTHROPIC_OPEN_TELEMETRY_PROPAGATION';
const env = process.env;

beforeEach(() => {
  process.env = { ...env };
  delete process.env[PROPAGATION_ENV];
});

afterEach(() => {
  process.env = env;
  propagation.disable();
  context.disable();
});

/** The client options of an application whose OpenTelemetry code throws at `failure`, with its propagator registered. */
const failingTracing = (failure: string): Partial<ClientOptions> => {
  const { tracerProvider, propagator } = FAILURES[failure]!;
  propagation.setGlobalPropagator(propagator?.() ?? WORKING_PROPAGATOR);
  return { openTelemetry: { tracerProvider: tracerProvider() } };
};

describe.each(Object.keys(FAILURES))('when %s throws', (failure) => {
  test.each(Object.keys(CALLS))('%s is as it is without tracing', async (call) => {
    const withoutTracing = await CALLS[call]!({ logLevel: 'off', openTelemetry: false });

    const outcome = await CALLS[call]!({ logLevel: 'off', ...failingTracing(failure) });

    expect(outcome).toEqual(withoutTracing);
  });

  test("the client's logger gets what it threw", async () => {
    const debug = vi.fn();
    const logger = { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await CALLS['a call']!({ logger, logLevel: 'debug', ...failingTracing(failure) });

    expect(debug).toHaveBeenCalledWith(
      'could not record telemetry',
      expect.objectContaining({ message: expect.stringMatching(/^the application's .* failed$/) }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

test('a request without the trace context of a propagator that throws still has its span', async () => {
  const { tracerProvider, spans } = provider(() => new RecordingSpan());
  propagation.setGlobalPropagator(writingPropagator(failing('inject')));
  const { client, requests } = makeStubbedClient([json({ token: 'tok_1' })], {
    logLevel: 'off',
    openTelemetry: { tracerProvider },
  });

  await get(client);

  expect(requests[0]!.has('traceparent')).toBe(false);
  expect(spans.map((span) => span.ended)).toEqual([true]);
});

test('tracing that does not throw sends the trace context that the propagator writes', async () => {
  propagation.setGlobalPropagator(WORKING_PROPAGATOR);
  const { client, requests } = makeStubbedClient([json({ token: 'tok_1' })], {
    logLevel: 'off',
    openTelemetry: { tracerProvider: provider(() => new RecordingSpan()).tracerProvider },
  });

  await get(client);

  expect(requests[0]!.get('traceparent')).toBe('from-the-propagator');
});

describe('propagation', () => {
  let propagator: CountingPropagator;

  beforeEach(() => {
    propagator = new CountingPropagator();
    propagation.setGlobalPropagator(propagator);
    context.setGlobalContextManager(new AsyncContextManager());
  });

  describe.each([
    ['a recording span', () => new RecordingSpan(), SAMPLED_CONTEXT],
    ['a span that the sampler dropped', () => trace.wrapSpanContext(UNSAMPLED_CONTEXT), UNSAMPLED_CONTEXT],
  ])('with %s', (_name, startSpan, spanContext) => {
    test('each attempt carries the trace context by default', async () => {
      const { tracerProvider } = provider(startSpan);
      const { client, attempts } = makeRetriedClient({ tracerProvider });

      await get(client);

      expect(attempts.map((attempt) => attempt.traceparent)).toEqual([
        traceparent(spanContext),
        traceparent(spanContext),
      ]);
    });

    test('with propagation off no attempt carries it, the propagator is never called, and the span is still active', async () => {
      const { tracerProvider } = provider(startSpan);
      const { client, attempts } = makeRetriedClient({ tracerProvider, propagation: false });

      await get(client);

      expect(attempts).toEqual([
        { traceparent: null, activeSpanContext: spanContext },
        { traceparent: null, activeSpanContext: spanContext },
      ]);
      expect(propagator.injected).toBe(0);
    });
  });

  test('with propagation off and no tracer provider a call has no span, and the propagator is never called', async () => {
    const { client, attempts } = makeRetriedClient({ propagation: false });

    await get(client);

    expect(attempts).toEqual([
      { traceparent: null, activeSpanContext: undefined },
      { traceparent: null, activeSpanContext: undefined },
    ]);
    expect(propagator.injected).toBe(0);
  });

  test('with propagation off a recording span ends as usual', async () => {
    const { tracerProvider, spans } = provider(() => new RecordingSpan());
    const { client } = makeRetriedClient({ tracerProvider, propagation: false });

    await get(client);

    expect(spans.map((span) => span.ended)).toEqual([true]);
  });

  test('with propagation off the trace headers of the caller are sent as they are', async () => {
    const { tracerProvider } = provider(() => new RecordingSpan());
    const { client, attempts } = makeRetriedClient({ tracerProvider, propagation: false });

    await get(client, { headers: { traceparent: 'the-callers-own' } });

    expect(attempts.map((attempt) => attempt.traceparent)).toEqual(['the-callers-own', 'the-callers-own']);
  });
});

describe('the environment variable', () => {
  test.each([
    ['false', false],
    ['FALSE', false],
    ['False', false],
    ['true', true],
    ['0', true],
    ['', true],
  ])('set to %j gives a client without the option propagation %j', (value, expected) => {
    process.env[PROPAGATION_ENV] = value;

    const client = makeClient();

    expect(client.openTelemetry.propagation).toBe(expected);
  });

  test.each<[string, ClientOptions['openTelemetry']]>([
    ['an option that leaves propagation unset', {}],
    ['the option false', false],
    ['an option that sets propagation', { propagation: true }],
  ])('set to false does not apply to %s', (_name, openTelemetry) => {
    process.env[PROPAGATION_ENV] = 'false';

    const client = makeClient(openTelemetry);

    expect(client.openTelemetry.propagation).toBe(true);
  });

  test('changed later affects neither the client nor a copy without its own option', () => {
    const client = makeClient();

    process.env[PROPAGATION_ENV] = 'false';

    expect(client.openTelemetry.propagation).toBe(true);
    expect(client.withOptions({ maxRetries: 0 }).openTelemetry.propagation).toBe(true);
  });

  test('is not read by a copy with its own option', () => {
    const client = makeClient();
    process.env[PROPAGATION_ENV] = 'false';

    const copy = client.withOptions({ openTelemetry: {} });

    expect(copy.openTelemetry.propagation).toBe(true);
  });
});

describe('the environment variables, all set', () => {
  beforeEach(() => {
    process.env['ANTHROPIC_OPEN_TELEMETRY'] = 'false';
    process.env[PROPAGATION_ENV] = 'false';
    process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'] = 'content';
    process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES'] = '300';
  });

  test('all apply to a client without the option, and to its copy without one', () => {
    const client = makeClient();

    const settled = {
      tracerProvider: undefined,
      propagation: false,
      traces: { enabled: false, contentMode: 'content', maxContentBytes: 300 },
    };
    expect(client.openTelemetry).toEqual(settled);
    expect(client.withOptions({ maxRetries: 0 }).openTelemetry).toEqual(settled);
  });

  test.each<[string, ClientOptions['openTelemetry'], boolean]>([
    ['an empty option', {}, true],
    ['the option false', false, false],
    ['traces: true', { traces: true }, true],
    ['an option that sets one field', { traces: { contentMode: 'metadata_only' } }, true],
  ])('none applies to a client with %s', (_name, openTelemetry, enabled) => {
    const settled = {
      tracerProvider: undefined,
      propagation: true,
      traces: { enabled, contentMode: 'metadata_only', maxContentBytes: 750_000 },
    };

    expect(makeClient(openTelemetry).openTelemetry).toEqual(settled);
    expect(makeClient().withOptions({ openTelemetry }).openTelemetry).toEqual(settled);
  });
});

test('garbage collection closes an unread stream that was dropped, not one that is held', async () => {
  v8.setFlagsFromString('--expose-gc');
  const gc: () => void = vm.runInNewContext('gc');

  // Left open, so that only the client can close them.
  const responses: http.ServerResponse[] = [];
  const server = http.createServer((_, res) => {
    responses.push(res);
    res.write('data: {}\n\n');
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  onTestFinished(() => server.close().closeAllConnections());

  const { tracerProvider } = provider(() => new RecordingSpan());
  const client = makeClient({ tracerProvider }).withOptions({
    baseURL: `http://localhost:${(server.address() as AddressInfo).port}`,
  });
  const request = () => get<Stream<unknown>>(client, { stream: true });

  const held = await request();
  // In its own frame, so that this one cannot keep the stream alive.
  await (async () => void (await request()))();
  await expect.poll(() => (gc(), responses[1]!.destroyed), { timeout: 20_000 }).toBe(true);

  expect(responses[0]!.destroyed).toBe(false);
  held.controller.abort();
}, 30_000);
