import { propagation, type Span, type TextMapPropagator, type TracerProvider } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { BasicTracerProvider, type Sampler, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import Anthropic, { type OpenTelemetryOptions } from '@anthropic-ai/sdk';
import { makeClient, json, sse, MESSAGE, PARAMS, STREAM_EVENTS, setUpTracing } from './utils';

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
  'messages.stream': async (options) => {
    const { client, requests } = makeClient([sse(STREAM_EVENTS)], options);
    return { message: await client.messages.stream(PARAMS).finalMessage(), requests: requests.length };
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
});
