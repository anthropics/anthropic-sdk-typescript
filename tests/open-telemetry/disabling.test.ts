import {
  context,
  propagation,
  trace,
  SpanStatusCode,
  TraceFlags,
  type SpanContext,
  type TextMapPropagator,
} from '@opentelemetry/api';
import { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  AlwaysOffSampler,
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import type Anthropic from '@anthropic-ai/sdk';
import type { OpenTelemetryOptions } from '@anthropic-ai/sdk';
import { Messages } from '@anthropic-ai/sdk/resources/messages/messages';
import { Messages as BetaMessages } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { Sessions } from '@anthropic-ai/sdk/resources/beta/sessions/sessions';
import {
  exporter,
  provider,
  tracer,
  makeClient,
  json,
  type Handler,
  sse,
  MESSAGE,
  PARAMS,
  STREAM_EVENTS,
  spans,
  onlySpan,
  parentId,
  setUpTracing,
} from './utils';

setUpTracing();

describe('OpenTelemetry spans', () => {
  describe('disabling', () => {
    test('openTelemetry: false emits no span and no trace headers', async () => {
      const { client, requests } = makeClient([json(MESSAGE)], { openTelemetry: false });

      await tracer.startActiveSpan('parent', async (parent) => {
        await client.messages.create(PARAMS);
        parent.end();
      });

      expect(spans('anthropic.messages.create')).toHaveLength(0);
      expect(requests[0]!.headers.get('traceparent')).toBeNull();
    });

    test.each<[string, OpenTelemetryOptions]>([
      ['traces: false', { traces: false }],
      ['traces.enabled: false', { traces: { enabled: false } }],
      [
        'traces.enabled: false beside other settings',
        { traces: { enabled: false, contentMode: 'content', maxContentBytes: 100 } },
      ],
    ])('%s emits no span and no trace headers', async (_name, openTelemetry) => {
      const { client, requests } = makeClient([json(MESSAGE)], { openTelemetry });

      await tracer.startActiveSpan('parent', async (parent) => {
        await client.messages.create(PARAMS);
        parent.end();
      });

      expect(spans('anthropic.messages.create')).toHaveLength(0);
      expect(requests[0]!.headers.get('traceparent')).toBeNull();
    });

    test.each<[string, OpenTelemetryOptions]>([
      ['traces: true', { traces: true }],
      ['traces.enabled: true', { traces: { enabled: true } }],
    ])('%s emits spans', async (_name, openTelemetry) => {
      const { client } = makeClient([json(MESSAGE)], { openTelemetry });

      await client.messages.create(PARAMS);

      expect(spans('anthropic.messages.create')).toHaveLength(1);
    });

    test('traces.enabled: false emits no span from the stream helper', async () => {
      const { client, requests } = makeClient([sse(STREAM_EVENTS)], {
        openTelemetry: { traces: { enabled: false, contentMode: 'content' } },
      });

      const message = await client.messages.stream(PARAMS).finalMessage();

      expect(message.content).toEqual([{ type: 'text', text: 'hello' }]);
      expect(spans()).toHaveLength(0);
      expect(requests[0]!.headers.get('traceparent')).toBeNull();
    });

    describe('a client whose spans are disabled computes nothing for one', () => {
      // Getters that count their reads say how often the SDK goes over the request.
      function countedRequest() {
        const reads = { header: 0, body: 0 };
        const params = {
          ...PARAMS,
          thinking: {
            get type() {
              reads.body++;
              return 'disabled' as const;
            },
          },
        };
        const options = {
          headers: {
            get 'x-app'() {
              reads.header++;
              return 'a';
            },
          },
        };
        return { reads, params, options };
      }
      type Counted = ReturnType<typeof countedRequest>;

      test.each([
        [
          'messages.create',
          (client: Anthropic, { params, options }: Counted) => client.messages.create(params, options),
        ],
        [
          'beta.messages.create',
          (client: Anthropic, { params, options }: Counted) => client.beta.messages.create(params, options),
        ],
        [
          'messages.stream',
          (client: Anthropic, { params, options }: Counted) =>
            client.messages.stream(params, options).finalMessage(),
        ],
        [
          'beta.messages.stream',
          (client: Anthropic, { params, options }: Counted) =>
            client.beta.messages.stream(params, options).finalMessage(),
        ],
      ])(
        '%s reads the request once: its headers to build them, and its body to send it',
        async (name, call) => {
          const { client, requests } = makeClient(
            [name.endsWith('stream') ? sse(STREAM_EVENTS) : json(MESSAGE)],
            { openTelemetry: false },
          );
          const request = countedRequest();

          await call(client, request);

          expect(request.reads).toEqual({ header: 1, body: 1 });
          expect(requests[0]!.headers.get('x-app')).toBe('a');
          expect(requests[0]!.body.thinking).toEqual({ type: 'disabled' });
        },
      );

      test.each([
        ['messages.create', (client: never) => new Messages(client).create(PARAMS)],
        ['messages.countTokens', (client: never) => new Messages(client).countTokens(PARAMS)],
        ['beta.messages.create', (client: never) => new BetaMessages(client).create(PARAMS)],
        ['beta.messages.countTokens', (client: never) => new BetaMessages(client).countTokens(PARAMS)],
        [
          'beta.sessions.create',
          (client: never) => new Sessions(client).create({ agent: 'agent_1', environment_id: 'env_1' }),
        ],
      ])('%s returns the request of the client as it is', (_name, call) => {
        // A client without a tracer, whose request is no `APIPromise`: the method adds nothing to it.
        const request = Promise.resolve(undefined);
        const client = { post: () => request, _options: { timeout: 1000 } };

        expect(call(client as never)).toBe(request);
      });
    });

    test('the environment variable disables a client without the option', async () => {
      process.env['ANTHROPIC_OPEN_TELEMETRY'] = 'FALSE';
      const { client } = makeClient([json(MESSAGE)]);

      await client.messages.create(PARAMS);

      expect(spans()).toHaveLength(0);
    });

    test.each<[string, OpenTelemetryOptions]>([
      ['an empty option', {}],
      ['an empty traces', { traces: {} }],
      ['a traces with other settings', { traces: { contentMode: 'content', maxContentBytes: 100 } }],
      ['traces: true', { traces: true }],
      ['traces.enabled: true', { traces: { enabled: true } }],
    ])('the environment variable does not disable a client with %s', async (_name, openTelemetry) => {
      process.env['ANTHROPIC_OPEN_TELEMETRY'] = 'false';
      const { client } = makeClient([json(MESSAGE)], { openTelemetry });

      await client.messages.create(PARAMS);

      expect(spans('anthropic.messages.create')).toHaveLength(1);
    });

    test('a client reads the environment variable once, when it is constructed', async () => {
      const enabled = makeClient([json(MESSAGE)]).client;
      process.env['ANTHROPIC_OPEN_TELEMETRY'] = 'false';
      const disabled = makeClient([json(MESSAGE)]).client;

      await enabled.messages.create(PARAMS);
      expect(spans('anthropic.messages.create')).toHaveLength(1);
      exporter.reset();

      delete process.env['ANTHROPIC_OPEN_TELEMETRY'];
      await disabled.messages.create(PARAMS);
      expect(spans()).toHaveLength(0);
    });

    describe('propagation', () => {
      const TRACE_HEADERS = ['traceparent', 'tracestate', 'baggage'];
      const sentTraceHeaders = (headers: Headers) => TRACE_HEADERS.filter((name) => headers.has(name));
      /** Calls `messages.create` under a parent span with a trace state, and with baggage. */
      const createInTrace = (client: Anthropic) =>
        tracer.startActiveSpan('parent', async (parent) => {
          const traced = trace.setSpanContext(context.active(), {
            ...parent.spanContext(),
            traceState: { serialize: () => 'vendor=value' } as any,
          });
          const baggage = propagation.createBaggage({ tenant: { value: 'acme' } });
          await context.with(propagation.setBaggage(traced, baggage), () => client.messages.create(PARAMS));
          parent.end();
          return parent;
        });

      beforeEach(() => {
        propagation.disable();
        propagation.setGlobalPropagator(
          new CompositePropagator({
            propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
          }),
        );
      });
      afterEach(() => {
        delete process.env['ANTHROPIC_OPEN_TELEMETRY_PROPAGATION'];
        propagation.disable();
        propagation.setGlobalPropagator(new W3CTraceContextPropagator());
      });

      test('sends the trace headers by default', async () => {
        const { client, requests } = makeClient([json(MESSAGE)]);

        await createInTrace(client);

        const { traceId, spanId } = onlySpan('anthropic.messages.create').spanContext();
        expect(requests[0]!.headers.get('traceparent')).toBe(`00-${traceId}-${spanId}-01`);
        expect(requests[0]!.headers.get('tracestate')).toBe('vendor=value');
        expect(requests[0]!.headers.get('baggage')).toBe('tenant=acme');
      });

      test('propagation: false sends none of them, also with a retry, and emits the same span', async () => {
        const { client, requests } = makeClient([json({}, 500), json(MESSAGE)], {
          maxRetries: 1,
          openTelemetry: { propagation: false },
        });

        const parent = await createInTrace(client);

        expect(requests.map((request) => sentTraceHeaders(request.headers))).toEqual([[], []]);
        const span = onlySpan('anthropic.messages.create');
        expect(span.status.code).toBe(SpanStatusCode.OK);
        expect(parentId(span)).toBe(parent.spanContext().spanId);
        expect(span.attributes['http.request.resend_count']).toBe(1);
        expect(span.attributes['gen_ai.response.id']).toBe('msg_1');
      });

      test.each<[string, OpenTelemetryOptions | undefined, string[]]>([
        ['no option', undefined, []],
        ['an option that leaves propagation unset', { traces: true }, TRACE_HEADERS],
        ['propagation: true', { propagation: true }, TRACE_HEADERS],
      ])('ANTHROPIC_OPEN_TELEMETRY_PROPAGATION=false and %s', async (_name, openTelemetry, expected) => {
        process.env['ANTHROPIC_OPEN_TELEMETRY_PROPAGATION'] = 'false';
        const { client, requests } = makeClient([json(MESSAGE)], { openTelemetry });

        await createInTrace(client);

        expect(sentTraceHeaders(requests[0]!.headers)).toEqual(expected);
        expect(spans('anthropic.messages.create')).toHaveLength(1);
      });

      test("propagation: false leaves the caller's own trace headers as they are", async () => {
        const { client, requests } = makeClient([json(MESSAGE)], { openTelemetry: { propagation: false } });
        const traceparent = '00-11111111111111111111111111111111-2222222222222222-01';

        await client.messages.create(PARAMS, { headers: { traceparent, baggage: 'k=v' } });

        expect(requests[0]!.headers.get('traceparent')).toBe(traceparent);
        expect(requests[0]!.headers.get('baggage')).toBe('k=v');
        expect(spans('anthropic.messages.create')).toHaveLength(1);
      });

      test('propagation: false with no tracer provider sends no baggage either', async () => {
        trace.disable();
        try {
          const { client, requests } = makeClient([json(MESSAGE)], { openTelemetry: { propagation: false } });
          const baggage = propagation.createBaggage({ tenant: { value: 'acme' } });

          await context.with(propagation.setBaggage(context.active(), baggage), () =>
            client.messages.create(PARAMS),
          );

          expect(sentTraceHeaders(requests[0]!.headers)).toEqual([]);
        } finally {
          trace.setGlobalTracerProvider(provider);
        }
      });

      describe('propagation: false and a span that does not record', () => {
        /** What each attempt has inside `fetch`: its trace headers and the active span's context. */
        function recordedAttempts() {
          const attempts: Array<{ traceHeaders: string[]; active: SpanContext | undefined }> = [];
          const recording =
            (respond: Handler): Handler =>
            (url, init) => {
              attempts.push({
                traceHeaders: sentTraceHeaders(new Headers(init.headers)),
                active: trace.getActiveSpan()?.spanContext(),
              });
              return respond(url, init);
            };
          return { attempts, handlers: [recording(json({}, 500)), recording(json(MESSAGE))] };
        }

        test('a span that the sampler drops is the active span of every attempt, and is not injected', async () => {
          const w3c = new W3CTraceContextPropagator();
          let injections = 0;
          const counting: TextMapPropagator = {
            inject: (...args) => {
              injections++;
              w3c.inject(...args);
            },
            extract: (...args) => w3c.extract(...args),
            fields: () => w3c.fields(),
          };
          propagation.disable();
          propagation.setGlobalPropagator(counting);
          const { attempts, handlers } = recordedAttempts();
          const { client } = makeClient(handlers, {
            maxRetries: 1,
            openTelemetry: {
              tracerProvider: new BasicTracerProvider({ sampler: new AlwaysOffSampler() }),
              propagation: false,
            },
          });

          const message = await client.messages.create(PARAMS);

          expect(message.id).toBe('msg_1');
          expect(injections).toBe(0);
          expect(attempts.map((attempt) => attempt.traceHeaders)).toEqual([[], []]);
          for (const { active } of attempts) {
            expect(active && trace.isSpanContextValid(active)).toBe(true);
            expect(active?.traceFlags).toBe(TraceFlags.NONE);
          }
          expect(attempts[1]!.active?.spanId).toBe(attempts[0]!.active?.spanId);
        });

        test('with no tracer provider no attempt has an active span', async () => {
          trace.disable();
          try {
            const { attempts, handlers } = recordedAttempts();
            const { client } = makeClient(handlers, {
              maxRetries: 1,
              openTelemetry: { propagation: false },
            });

            await client.messages.create(PARAMS);

            expect(attempts).toEqual([
              { traceHeaders: [], active: undefined },
              { traceHeaders: [], active: undefined },
            ]);
          } finally {
            trace.setGlobalTracerProvider(provider);
          }
        });
      });
    });

    describe('with no tracer provider', () => {
      beforeEach(() => trace.disable());
      afterEach(() => trace.setGlobalTracerProvider(provider));

      test('a stream keeps its own iterator', async () => {
        const { client } = makeClient([sse(STREAM_EVENTS)]);

        const stream = await client.messages.create({ ...PARAMS, stream: true });

        expect(Object.prototype.toString.call(stream[Symbol.asyncIterator]())).toBe(
          '[object AsyncGenerator]',
        );
      });

      test('an HTTP request still carries the current trace context', async () => {
        const { client, requests } = makeClient([json(MESSAGE)]);
        const remote = trace.setSpanContext(context.active(), {
          traceId: '11111111111111111111111111111111',
          spanId: '2222222222222222',
          traceFlags: 1,
          isRemote: true,
        });

        await context.with(remote, () => client.messages.create(PARAMS));

        expect(requests[0]!.headers.get('traceparent')).toBe(
          '00-11111111111111111111111111111111-2222222222222222-01',
        );
      });
    });

    test('tracerProvider replaces the registered provider', async () => {
      const ownExporter = new InMemorySpanExporter();
      const own = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(ownExporter)] });
      const { client } = makeClient([json(MESSAGE)], { openTelemetry: { tracerProvider: own } });

      await client.messages.create(PARAMS);

      expect(spans()).toHaveLength(0);
      expect(ownExporter.getFinishedSpans().map((span) => span.name)).toEqual(['anthropic.messages.create']);
    });
  });
});
