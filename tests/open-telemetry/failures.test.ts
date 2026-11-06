import { isDeepStrictEqual } from 'node:util';
import {
  propagation,
  SpanStatusCode,
  type AttributeValue,
  type Span,
  type TextMapPropagator,
  type TracerProvider,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  BasicTracerProvider,
  type ReadableSpan,
  type Sampler,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import Anthropic, { type OpenTelemetryOptions } from '@anthropic-ai/sdk';
import {
  exporter,
  makeClient,
  json,
  sse,
  openSpans,
  MESSAGE,
  PARAMS,
  SESSION_EVENT,
  STREAM_EVENTS,
  setUpTracing,
} from './utils';

setUpTracing();

const failing = (where: string) => () => {
  throw new Error(`the application's ${where} failed`);
};

const processor = (hooks: Partial<SpanProcessor>): SpanProcessor => ({
  onStart: () => {},
  onEnd: () => {},
  forceFlush: async () => {},
  shutdown: async () => {},
  ...hooks,
});

/** A tracer provider that the application wrote, whose spans throw from `method`. */
function providerOfSpansFailingIn(method: keyof Span): TracerProvider {
  const provider = new BasicTracerProvider();
  return {
    getTracer: (name, version) => {
      const tracer = provider.getTracer(name, version);
      return Object.assign(Object.create(tracer), {
        startSpan: (...args: Parameters<typeof tracer.startSpan>) =>
          Object.assign(Object.create(tracer.startSpan(...args)), { [method]: failing(`span.${method}`) }),
      });
    },
  };
}

/**
 * A tracer provider that the application wrote, whose spans throw on the attribute `refused`, and
 * those of its spans that ended.
 */
function providerOfSpansRefusing(refused: string): {
  tracerProvider: TracerProvider;
  ended: ReadableSpan[];
} {
  const ended: ReadableSpan[] = [];
  const provider = new BasicTracerProvider({
    spanProcessors: [processor({ onEnd: (span) => void ended.push(span) })],
  });
  const tracerProvider: TracerProvider = {
    getTracer: (name, version) => {
      const tracer = provider.getTracer(name, version);
      return Object.assign(Object.create(tracer), {
        startSpan: (...args: Parameters<typeof tracer.startSpan>) => {
          const span = tracer.startSpan(...args);
          return Object.assign(Object.create(span), {
            setAttribute(this: Span, key: string, value: AttributeValue) {
              return key === refused ?
                  failing('span.setAttribute')()
                : span.setAttribute.call(this, key, value);
            },
          });
        },
      });
    },
  };
  return { tracerProvider, ended };
}

/**
 * Where the application's OpenTelemetry code throws: in what it gave the OpenTelemetry SDK (a
 * sampler, a span processor, a propagator), or in a tracer provider of its own.
 */
const FAILURES: Record<
  string,
  { option?: () => OpenTelemetryOptions; propagator?: () => TextMapPropagator }
> = {
  'the sampler': {
    option: () => ({
      tracerProvider: new BasicTracerProvider({
        sampler: { shouldSample: failing('sampler'), toString: () => 'failing' } satisfies Sampler,
      }),
    }),
  },
  "a span processor's onStart": {
    option: () => ({
      tracerProvider: new BasicTracerProvider({
        spanProcessors: [processor({ onStart: failing('onStart') })],
      }),
    }),
  },
  "a span processor's onEnd": {
    option: () => ({
      tracerProvider: new BasicTracerProvider({ spanProcessors: [processor({ onEnd: failing('onEnd') })] }),
    }),
  },
  "the propagator's inject": {
    propagator: () => Object.assign(new W3CTraceContextPropagator(), { inject: failing('inject') }),
  },
  "the propagator's fields": {
    propagator: () => Object.assign(new W3CTraceContextPropagator(), { fields: failing('fields') }),
  },
  "the tracer provider's getTracer": {
    option: () => ({ tracerProvider: { getTracer: failing('getTracer') } }),
  },
  "a span's setAttribute": { option: () => ({ tracerProvider: providerOfSpansFailingIn('setAttribute') }) },
  "a span's setStatus": { option: () => ({ tracerProvider: providerOfSpansFailingIn('setStatus') }) },
  "a span's end": { option: () => ({ tracerProvider: providerOfSpansFailingIn('end') }) },
};

type ClientOptions = Parameters<typeof makeClient>[1];

const errorResponse = (status: number, type: string) =>
  json({ type: 'error', error: { type, message: 'no' } }, status, { 'retry-after-ms': '1' });

const modelsPage = (id: string, hasMore: boolean) =>
  json({ data: [{ id, type: 'model' }], has_more: hasMore, first_id: id, last_id: id });

const toolUseMessage = {
  ...MESSAGE,
  id: 'msg_tool',
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: {} }],
};

/** What the application sees of a call that failed. */
const seen = (error: unknown) => ({ error: (error as Error).constructor.name, message: String(error) });

/** Each makes one kind of API call with a client that has `options`, and returns what the application sees of it. */
const CALLS: Record<string, (options: ClientOptions) => Promise<unknown>> = {
  'messages.create': async (options) => {
    const { client, requests } = makeClient([json(MESSAGE)], options);
    const message = await client.messages.create(PARAMS);
    return { message, requests: requests.length };
  },
  'messages.create with stream: true': async (options) => {
    const { client, requests } = makeClient([sse(STREAM_EVENTS)], options);
    const events = [];
    for await (const event of await client.messages.create({ ...PARAMS, stream: true })) {
      events.push(event);
    }
    return { events, requests: requests.length };
  },
  'beta.messages.create with stream: true': async (options) => {
    const { client, requests } = makeClient([sse(STREAM_EVENTS)], options);
    const events = [];
    for await (const event of await client.beta.messages.create({ ...PARAMS, stream: true })) {
      events.push(event);
    }
    return { events, requests: requests.length };
  },
  'messages.stream': async (options) => {
    const { client, requests } = makeClient([sse(STREAM_EVENTS)], options);
    return { message: await client.messages.stream(PARAMS).finalMessage(), requests: requests.length };
  },
  'beta.messages.stream': async (options) => {
    const { client, requests } = makeClient([sse(STREAM_EVENTS)], options);
    return { message: await client.beta.messages.stream(PARAMS).finalMessage(), requests: requests.length };
  },
  'beta.sessions.events.stream': async (options) => {
    const { client, requests } = makeClient([sse([SESSION_EVENT])], options);
    const events = [];
    for await (const event of await client.beta.sessions.events.stream('sesn_1')) {
      events.push(event);
    }
    return { events, requests: requests.length };
  },
  'every page of models.list': async (options) => {
    const { client, requests } = makeClient([modelsPage('a', true), modelsPage('b', false)], options);
    const models = [];
    for await (const model of client.models.list()) {
      models.push(model.id);
    }
    return { models, requests: requests.length };
  },
  'messages.countTokens': async (options) => {
    const { client, requests } = makeClient([json({ input_tokens: 42 })], options);
    const count = await client.messages.countTokens({ model: 'model-a', messages: PARAMS.messages });
    return { count, requests: requests.length };
  },
  'withResponse()': async (options) => {
    const { client, requests } = makeClient([json(MESSAGE)], options);
    const { data, response, request_id } = await client.messages.create(PARAMS).withResponse();
    return { data, status: response.status, request_id, requests: requests.length };
  },
  'a call that the API answers with 400': async (options) => {
    const { client, requests } = makeClient([errorResponse(400, 'invalid_request_error')], options);
    const error = await client.messages.create(PARAMS).catch((error) => error);
    return {
      ...seen(error),
      isBadRequest: error instanceof Anthropic.BadRequestError,
      requests: requests.length,
    };
  },
  'a call whose response is not JSON': async (options) => {
    const notJSON = () => new Response('{', { headers: { 'content-type': 'application/json' } });
    const { client, requests } = makeClient([notJSON], options);
    const error = await client.messages.create(PARAMS).catch((error) => error);
    return { ...seen(error), requests: requests.length };
  },
  'a call that the API answers with 500 after every retry': async (options) => {
    const handlers = [1, 2, 3].map(() => errorResponse(500, 'api_error'));
    const { client, requests } = makeClient(handlers, { ...options, maxRetries: 2 });
    const error = await client.messages.create(PARAMS).catch((error) => error);
    return {
      ...seen(error),
      isInternalServerError: error instanceof Anthropic.InternalServerError,
      requests: requests.length,
    };
  },
  'a call that the application aborted': async (options) => {
    const { client, requests } = makeClient([json(MESSAGE)], options);
    const error = await client.messages
      .create(PARAMS, { signal: AbortSignal.abort() })
      .catch((error) => error);
    return {
      ...seen(error),
      isAbort: error instanceof Anthropic.APIUserAbortError,
      requests: requests.length,
    };
  },
  'a call whose request fails': async (options) => {
    const { client, requests } = makeClient([failing('fetch')], options);
    const error = await client.messages.create(PARAMS).catch((error) => error);
    return { ...seen(error), cause: String(error.cause), requests: requests.length };
  },
  'an upload whose form cannot be built': async (options) => {
    const { client, requests } = makeClient([], options);
    const error = await client.files.upload({ file: null as never }).catch((error) => error);
    return { ...seen(error), requests: requests.length };
  },
  'the tool runner, whose tool throws': async (options) => {
    const { client, requests } = makeClient([json(toolUseMessage), json(MESSAGE)], options);
    const message = await client.beta.messages
      .toolRunner({
        ...PARAMS,
        tools: [
          {
            type: 'custom' as const,
            name: 'get_weather',
            input_schema: { type: 'object' as const, properties: {} },
            run: failing('tool'),
          },
        ],
      })
      .runUntilDone();
    return { message, toolResult: requests[1]?.body.messages.at(-1), requests: requests.length };
  },
};

describe('OpenTelemetry spans', () => {
  describe("a failure of the application's OpenTelemetry code never fails an API call", () => {
    afterEach(() => {
      propagation.disable();
      propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    });

    /** The client options of an application whose OpenTelemetry code throws at `failure`, with its propagator registered. */
    const failingTracing = (failure: string): ClientOptions => {
      const { option, propagator } = FAILURES[failure]!;
      if (propagator) {
        propagation.disable();
        propagation.setGlobalPropagator(propagator());
      }
      return option ? { openTelemetry: option() } : {};
    };

    describe.each(Object.keys(FAILURES))('when %s throws', (failure) => {
      test.each(Object.keys(CALLS))('%s is as it is without tracing', async (call) => {
        const withoutTracing = await CALLS[call]!({ logLevel: 'off', openTelemetry: false });

        const outcome = await CALLS[call]!({ logLevel: 'off', ...failingTracing(failure) });

        expect(outcome).toEqual(withoutTracing);
      });
    });

    // A signer reads the propagator's fields with no client at hand, so that failure goes to the default logger.
    test.each(Object.keys(FAILURES).filter((failure) => failure !== "the propagator's fields"))(
      "the client's logger gets what %s threw",
      async (failure) => {
        const debug = vi.fn();
        const logger = { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn() };

        await CALLS['messages.create']!({ logger, logLevel: 'debug', ...failingTracing(failure) });

        expect(debug).toHaveBeenCalledWith(
          'could not record telemetry',
          expect.objectContaining({ message: expect.stringMatching(/^the application's .* failed$/) }),
        );
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      },
    );

    test("the client's logger gets what a span processor's onEnd threw when the application has read a stream", async () => {
      const debug = vi.fn();
      const logger = { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      await CALLS['messages.create with stream: true']!({
        logger,
        logLevel: 'debug',
        ...failingTracing("a span processor's onEnd"),
      });

      expect(debug).toHaveBeenCalledWith(
        'could not record telemetry',
        expect.objectContaining({ message: "the application's onEnd failed" }),
      );
    });

    test.each([
      ['messages.create', 'anthropic.request.id', SpanStatusCode.OK],
      ['messages.create', 'gen_ai.response.id', SpanStatusCode.OK],
      ['messages.create with stream: true', 'anthropic.request.id', SpanStatusCode.OK],
      ['messages.stream', 'anthropic.request.id', SpanStatusCode.OK],
      ['messages.countTokens', 'anthropic.message.count_tokens.input_tokens', SpanStatusCode.OK],
      ['a call that the API answers with 400', 'anthropic.request.id', SpanStatusCode.ERROR],
      // The status comes after this attribute.
      ['messages.create', 'http.response.status_code', SpanStatusCode.UNSET],
    ])('the span of %s ends when it throws on %s', async (call, refused, status) => {
      const { tracerProvider, ended } = providerOfSpansRefusing(refused);

      await CALLS[call]!({ logLevel: 'off', openTelemetry: { tracerProvider } });

      expect(ended.map((span) => span.status.code)).toEqual([status]);
    });

    test('an attribute of the response that the span throws on costs that attribute alone', async () => {
      const { tracerProvider, ended } = providerOfSpansRefusing('gen_ai.response.id');

      await CALLS['messages.create']!({ logLevel: 'off', openTelemetry: { tracerProvider } });

      expect(ended[0]!.attributes).toMatchObject({
        'anthropic.request.id': 'req_1',
        'gen_ai.response.model': 'model-served',
        'anthropic.message.stop_reason': 'end_turn',
      });
      expect(ended[0]!.attributes).not.toHaveProperty('gen_ai.response.id');
    });

    test('a request without the trace context of a propagator that throws still has its span', async () => {
      propagation.disable();
      propagation.setGlobalPropagator(
        Object.assign(new W3CTraceContextPropagator(), { inject: failing('inject') }),
      );
      const ended: string[] = [];
      const tracerProvider = new BasicTracerProvider({
        spanProcessors: [processor({ onEnd: (span) => void ended.push(span.name) })],
      });
      const { client, requests } = makeClient([json(MESSAGE)], {
        logLevel: 'off',
        openTelemetry: { tracerProvider },
      });

      await client.messages.create(PARAMS);

      expect(requests[0]!.headers.has('traceparent')).toBe(false);
      expect(ended).toEqual(['anthropic.messages.create']);
    });
  });

  describe('a header of the response that throws when the span reads it', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    test.each([
      'messages.create',
      'messages.create with stream: true',
      'messages.stream',
      'every page of models.list',
      'a call that the API answers with 400',
    ])('%s is as it is without tracing, and its spans end', async (call) => {
      const withoutTracing = await CALLS[call]!({ logLevel: 'off', openTelemetry: false });
      const get = Headers.prototype.get;
      // Only the span reads this header.
      const read = vi.spyOn(Headers.prototype, 'get').mockImplementation(function (this: Headers, name) {
        return name === 'anthropic-organization-id' ? failing('fetch')() : get.call(this, name);
      });

      const outcome = await CALLS[call]!({ logLevel: 'off' });

      expect(read).toHaveBeenCalledWith('anthropic-organization-id');
      expect(outcome).toEqual(withoutTracing);
      expect([...openSpans.values()]).toEqual([]);
    });
  });

  describe('the headers of the response, which throw when the span reads them', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const headers = Object.getOwnPropertyDescriptor(Response.prototype, 'headers')!.get!;

    /** What the application and the spans have of `call` when read number `unreadable` of a response's headers throws. */
    const run = async (call: string, unreadable?: number) => {
      exporter.reset();
      openSpans.clear();
      let reads = 0;
      vi.spyOn(Response.prototype, 'headers', 'get').mockImplementation(function (this: Response) {
        return ++reads === unreadable ? failing('fetch')() : headers.call(this);
      });
      const outcome = await CALLS[call]!({ logLevel: 'off' }).catch(seen);
      const spans = exporter.getFinishedSpans().map(({ name, status, attributes }) => {
        // What the headers give, and what no two runs have alike.
        const { 'anthropic.request.id': _, 'gen_ai.response.time_to_first_chunk': __, ...rest } = attributes;
        return { name, status, attributes: rest };
      });
      return { outcome, spans, open: [...openSpans.values()], reads };
    };

    test.each([
      ['messages.create', 1],
      ['a call whose response is not JSON', 1],
      ['messages.create with stream: true', 1],
      ['beta.messages.create with stream: true', 1],
      ['messages.stream', 1],
      ['beta.messages.stream', 1],
      ['beta.sessions.events.stream', 1],
      ['every page of models.list', 2],
    ])('the spans of %s lack only what the headers give', async (call, responses) => {
      const { outcome, spans, reads } = await run(call);

      const unnoticed = [];
      for (let unreadable = 1; unreadable <= reads; unreadable++) {
        const faulty = await run(call, unreadable);
        // The application sees every read but the span's fail.
        if (isDeepStrictEqual(faulty.outcome, outcome)) {
          unnoticed.push({ spans: faulty.spans, open: faulty.open });
        }
      }

      expect(unnoticed).toEqual(Array(responses).fill({ spans, open: [] }));
    });
  });
});
