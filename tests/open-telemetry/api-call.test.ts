import { context, propagation, trace, SpanKind, SpanStatusCode, type Attributes } from '@opentelemetry/api';
import { BasicTracerProvider, SamplingDecision } from '@opentelemetry/sdk-trace-base';
import { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } from '@opentelemetry/core';
import Anthropic, {
  type Middleware,
  type OpenTelemetryOptions,
  type OpenTelemetryRequestOptions,
  type OpenTelemetryTracesOptions,
  type ResolvedOpenTelemetryOptions,
} from '@anthropic-ai/sdk';
import { VERSION } from '@anthropic-ai/sdk/version';
import {
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
  type Handler,
  setUpTracing,
  pathID,
  createdID,
  openSpans,
} from './utils';

setUpTracing();

describe('OpenTelemetry spans', () => {
  test('messages.create emits a CLIENT span with the request and response attributes', async () => {
    const { client, requests } = makeClient([
      json(MESSAGE, 200, {
        'anthropic-organization-id': 'org-uuid',
        'anthropic-workspace-id': 'wrkspc_1',
      }),
    ]);

    await client.messages.create(
      {
        ...PARAMS,
        service_tier: 'auto',
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
      },
      { openTelemetry: { conversationId: 'conv-1' } },
    );

    const span = onlySpan('anthropic.messages.create');
    expect(span.kind).toBe(SpanKind.CLIENT);
    expect(span.instrumentationScope).toMatchObject({
      name: 'com.anthropic.sdk.typescript',
      version: VERSION,
    });
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(span.attributes).toEqual({
      'gen_ai.provider.name': 'anthropic',
      'gen_ai.conversation.id': 'conv-1',
      'gen_ai.operation.name': 'chat',
      'gen_ai.request.model': 'model-a',
      'gen_ai.request.max_tokens': 100,
      'gen_ai.request.reasoning.level': 'low',
      'anthropic.request.service_tier': 'auto',
      'anthropic.thinking.type': 'disabled',
      'server.address': 'localhost',
      'server.port': 4010,
      'http.request.method': 'POST',
      'http.route': '/v1/messages',
      'url.scheme': 'http',
      'url.path': '/v1/messages',
      'url.full': 'http://localhost:4010/v1/messages',
      'http.response.status_code': 200,
      'anthropic.request.id': 'req_1',
      'anthropic.organization.id': 'org-uuid',
      'anthropic.workspace.id': 'wrkspc_1',
      'gen_ai.response.id': 'msg_1',
      'gen_ai.response.model': 'model-served',
      'anthropic.message.stop_reason': 'end_turn',
      'gen_ai.usage.input_tokens': 15,
      'gen_ai.usage.output_tokens': 20,
      'gen_ai.usage.cache_write.input_tokens': 2,
      'gen_ai.usage.cache_read.input_tokens': 3,
      'anthropic.usage.cache_creation.ephemeral_5m_input_tokens': 2,
      'anthropic.usage.cache_creation.ephemeral_1h_input_tokens': 0,
      'gen_ai.usage.reasoning.output_tokens': 7,
      'anthropic.response.service_tier': 'standard',
    });
    // The request option is not sent to the API.
    expect(requests[0]!.body).not.toHaveProperty('openTelemetry');
  });

  test('the option types are exported by name', async () => {
    const traces: OpenTelemetryTracesOptions = { enabled: true, contentMode: 'metadata_only' };
    const clientOption: OpenTelemetryOptions = { traces };
    const requestOption: OpenTelemetryRequestOptions = { conversationId: 'conv-1' };
    const { client } = makeClient([json(MESSAGE)], { openTelemetry: clientOption });
    const resolved: ResolvedOpenTelemetryOptions = client.openTelemetry;

    await client.messages.create(PARAMS, { openTelemetry: requestOption });

    expect(resolved.traces.enabled).toBe(true);

    expect(onlySpan('anthropic.messages.create').attributes['gen_ai.conversation.id']).toBe('conv-1');
  });

  describe.each(['metadata_only', 'content'] as const)('compactions, with contentMode %s', (contentMode) => {
    const compaction = (input: number, read: number, written: number, output: number) =>
      ({
        type: 'compaction',
        input_tokens: input,
        cache_read_input_tokens: read,
        cache_creation_input_tokens: written,
        cache_creation: null,
        output_tokens: output,
      }) satisfies Anthropic.Beta.BetaCompactionIterationUsage;
    const sampling = { ...compaction(10, 3, 2, 20), type: 'message', model: 'model-served' } as const;
    const withIterations = (iterations: unknown, usage = MESSAGE.usage) =>
      json({ ...MESSAGE, usage: { ...usage, iterations } });
    const compactionTokens = () => {
      const { attributes } = onlySpan('anthropic.messages.create');
      return [
        attributes['anthropic.usage.compaction.input_tokens'],
        attributes['anthropic.usage.compaction.output_tokens'],
      ];
    };

    test('a response has the tokens of its compactions, apart from its own usage', async () => {
      const { client } = makeClient(
        [withIterations([compaction(100, 10, 5, 30), sampling, compaction(200, 0, 0, 40)])],
        { openTelemetry: { traces: { contentMode } } },
      );

      await client.beta.messages.create(PARAMS);

      expect(compactionTokens()).toEqual([315, 70]);
      expect(onlySpan('anthropic.messages.create').attributes).toMatchObject({
        'gen_ai.usage.input_tokens': 15,
        'gen_ai.usage.output_tokens': 20,
      });
    });

    test('a response whose own usage is zero still has the tokens of its compaction', async () => {
      const usage = { ...MESSAGE.usage, input_tokens: 0, output_tokens: 0 };
      const { client } = makeClient([withIterations([compaction(7, 2, 1, 3)], usage)], {
        openTelemetry: { traces: { contentMode } },
      });

      await client.beta.messages.create(PARAMS);

      expect(compactionTokens()).toEqual([10, 3]);
    });

    test.each([
      ['no iterations', json(MESSAGE)],
      ['null iterations', withIterations(null)],
      ['empty iterations', withIterations([])],
      ['no compaction among its iterations', withIterations([sampling])],
    ])('a response with %s has no compaction tokens', async (_, response) => {
      const { client } = makeClient([response], { openTelemetry: { traces: { contentMode } } });

      await client.beta.messages.create(PARAMS);

      const names = Object.keys(onlySpan('anthropic.messages.create').attributes);
      expect(names).not.toContain('anthropic.usage.compaction.input_tokens');
      expect(names).not.toContain('anthropic.usage.compaction.output_tokens');
    });
  });

  test('a span starts with the attributes that a sampler decides on', async () => {
    const seen: Array<{ name: string; attributes: Attributes }> = [];
    const written: string[] = [];
    const sampling = new BasicTracerProvider({
      sampler: {
        shouldSample: (_context, _traceId, name, _kind, attributes) => {
          seen.push({ name, attributes });
          return { decision: SamplingDecision.RECORD_AND_SAMPLED };
        },
        toString: () => 'a sampler that records what it is given',
      },
      spanProcessors: [
        {
          onStart: (span) => {
            const setAttribute = span.setAttribute.bind(span);
            span.setAttribute = (key, value) => (written.push(key), setAttribute(key, value));
          },
          onEnd: () => {},
          shutdown: async () => {},
          forceFlush: async () => {},
        },
      ],
    });
    const page = (id: string, hasMore: boolean) =>
      json({ data: [{ id, type: 'model' }], has_more: hasMore, first_id: id, last_id: id });
    const { client } = makeClient(
      [
        json(MESSAGE),
        json(MESSAGE),
        sse(STREAM_EVENTS),
        sse(STREAM_EVENTS),
        json({ input_tokens: 3 }),
        json({ id: 'msgbatch_1', type: 'message_batch' }),
        json({ id: 'sesn_1', type: 'session' }),
        json({ id: 'msgbatch_2', type: 'message_batch' }),
        json({ data: [], next_page: null }),
        page('a', true),
        page('b', false),
      ],
      { openTelemetry: { tracerProvider: sampling }, defaultHeaders: { 'anthropic-beta': 'beta-default' } },
    );
    const conversation = { openTelemetry: { conversationId: 'conv-1' } };

    await client.messages.create({ ...PARAMS, thinking: { type: 'disabled' } }, conversation);
    await client.beta.messages.create({ ...PARAMS, betas: ['beta-one', 'beta-two'] });
    await client.messages.stream(PARAMS, conversation).finalMessage();
    await client.beta.messages
      .stream({ ...PARAMS, betas: ['beta-one'], output_format: { type: 'json_schema', schema: {} } })
      .done();
    await client.messages.countTokens({ model: PARAMS.model, messages: PARAMS.messages }, conversation);
    await client.messages.batches.retrieve('msgbatch_1');
    await client.beta.sessions.create({ agent: { type: 'agent', id: 'agent_1' }, environment_id: 'env_1' });
    await client.messages.batches.create({ requests: [] });
    await client.beta.sessions.threads.events.list('sthr_1', { session_id: 'sesn_1' });
    await (await client.models.list({}, conversation)).getNextPage();

    const server = { 'server.address': 'localhost', 'server.port': 4010 };
    const request = {
      ...server,
      'http.route': '/v1/messages',
      'gen_ai.provider.name': 'anthropic',
      'gen_ai.operation.name': 'chat',
      'gen_ai.request.model': 'model-a',
      'gen_ai.request.max_tokens': 100,
    };
    expect(seen).toEqual([
      {
        name: 'anthropic.messages.create',
        attributes: {
          ...request,
          'gen_ai.conversation.id': 'conv-1',
          'anthropic.thinking.type': 'disabled',
          'anthropic.beta': ['beta-default'],
        },
      },
      {
        name: 'anthropic.messages.create',
        attributes: { ...request, 'anthropic.beta': ['beta-one', 'beta-two'] },
      },
      {
        name: 'anthropic.messages.create',
        attributes: {
          ...request,
          'gen_ai.conversation.id': 'conv-1',
          'gen_ai.request.stream': true,
          'anthropic.beta': ['beta-default'],
        },
      },
      {
        name: 'anthropic.messages.create',
        attributes: {
          ...request,
          'gen_ai.request.stream': true,
          'gen_ai.output.type': 'json',
          'anthropic.beta': ['beta-one'],
        },
      },
      {
        name: 'anthropic.messages.count_tokens',
        attributes: {
          ...server,
          'gen_ai.provider.name': 'anthropic',
          'gen_ai.conversation.id': 'conv-1',
          'gen_ai.request.model': 'model-a',
          'http.route': '/v1/messages/count_tokens',
        },
      },
      {
        name: 'anthropic.messages.batches.retrieve',
        attributes: {
          ...server,
          'gen_ai.provider.name': 'anthropic',
          [pathID('messages.batches.retrieve', 'message_batch_id')]: 'msgbatch_1',
          'http.route': '/v1/messages/batches/{message_batch_id}',
        },
      },
      {
        name: 'anthropic.sessions.create',
        attributes: {
          ...server,
          'gen_ai.provider.name': 'anthropic',
          'gen_ai.agent.id': 'agent_1',
          'anthropic.session.environment.id': 'env_1',
          'http.route': '/v1/sessions',
        },
      },
      {
        name: 'anthropic.messages.batches.create',
        attributes: {
          ...server,
          'gen_ai.provider.name': 'anthropic',
          'anthropic.message.batch.request_count': 0,
          'http.route': '/v1/messages/batches',
        },
      },
      {
        name: 'anthropic.sessions.threads.events.list',
        attributes: {
          ...server,
          'gen_ai.provider.name': 'anthropic',
          [pathID('beta.sessions.threads.events.list', 'session_id')]: 'sesn_1',
          [pathID('beta.sessions.threads.events.list', 'thread_id')]: 'sthr_1',
          'gen_ai.conversation.id': 'sthr_1',
          'http.route': '/v1/sessions/{session_id}/threads/{thread_id}/events',
        },
      },
      {
        name: 'anthropic.models.list',
        attributes: {
          ...server,
          'gen_ai.provider.name': 'anthropic',
          'gen_ai.conversation.id': 'conv-1',
          'http.route': '/v1/models',
        },
      },
      {
        name: 'anthropic.models.list',
        attributes: {
          ...server,
          'gen_ai.provider.name': 'anthropic',
          'gen_ai.conversation.id': 'conv-1',
          'http.route': '/v1/models',
        },
      },
    ]);
    // The server is the client's, known when the span starts: no attempt writes it again.
    expect(written).toContain('http.response.status_code');
    expect(written).not.toContain('server.address');
    expect(written).not.toContain('server.port');
  });

  test('a create of a Message Batch has the number of its requests', async () => {
    const batch = { id: 'msgbatch_1', type: 'message_batch', results_url: null };
    const request = { custom_id: 'one', params: PARAMS };
    const { client } = makeClient([
      json(batch),
      json(batch),
      json(batch),
      json({ data: [batch], has_more: false }),
    ]);

    await client.messages.batches.create({ requests: [request, { ...request, custom_id: 'two' }] });
    await client.beta.messages.batches.create({ requests: [request] });
    await client.messages.batches.retrieve('msgbatch_1');
    await client.beta.messages.batches.list();

    const counts = (name: string) =>
      spans(name).map((span) => span.attributes['anthropic.message.batch.request_count']);
    expect(counts('anthropic.messages.batches.create')).toEqual([2, 1]);
    expect(counts('anthropic.messages.batches.retrieve')).toEqual([undefined]);
    expect(counts('anthropic.messages.batches.list')).toEqual([undefined]);
  });

  test('the span is a child of the current span and its context replaces the trace headers', async () => {
    const { client, requests } = makeClient([json(MESSAGE)]);

    await tracer.startActiveSpan('parent', async (parent) => {
      await client.messages.create(PARAMS, {
        headers: { traceparent: '00-11111111111111111111111111111111-2222222222222222-01' },
      });
      parent.end();
    });

    const span = onlySpan('anthropic.messages.create');
    const parent = onlySpan('parent');
    expect(parentId(span)).toBe(parent.spanContext().spanId);
    expect(requests[0]!.headers.get('traceparent')).toBe(
      `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01`,
    );
  });

  test('the span is current while each request is sent, and only then', async () => {
    // Stands in for an HTTP instrumentation, which starts a span inside `fetch`.
    const http =
      (handler: Handler): Handler =>
      (url, init) => {
        tracer.startSpan('http').end();
        return handler(url, init);
      };
    const { client } = makeClient([http(json(MESSAGE)), http(sse(STREAM_EVENTS))]);
    const current = () => trace.getActiveSpan()?.spanContext().spanId;

    await tracer.startActiveSpan('app', async (app) => {
      const appId = app.spanContext().spanId;

      await client.messages.create(PARAMS);
      expect(current()).toBe(appId);

      const stream = await client.messages.create({ ...PARAMS, stream: true });
      expect(current()).toBe(appId);
      for await (const _ of stream) {
        expect(current()).toBe(appId);
      }
      expect(current()).toBe(appId);
      app.end();
    });

    expect(trace.getActiveSpan()).toBeUndefined();
    const calls = spans('anthropic.messages.create');
    expect(calls).toHaveLength(2);
    expect(spans('http').map(parentId)).toEqual(calls.map((call) => call.spanContext().spanId));
    expect(calls.map(parentId)).toEqual([
      onlySpan('app').spanContext().spanId,
      onlySpan('app').spanContext().spanId,
    ]);
  });

  test('concurrent API calls that share one options object each carry their own span', async () => {
    // Both API calls stay in flight until both HTTP requests have been sent.
    let release!: () => void;
    const sent = new Promise<void>((resolve) => (release = resolve));
    const held: Handler = async (url, init) => {
      if (requests.length === 2) {
        release();
      }
      await sent;
      return json(MESSAGE)(url, init);
    };
    const { client, requests } = makeClient([held, held]);
    const options = { headers: { 'x-shared': 'yes' } };

    await Promise.all([client.messages.create(PARAMS, options), client.messages.create(PARAMS, options)]);

    const found = spans('anthropic.messages.create');
    expect(found).toHaveLength(2);
    const traceparents = found.map(
      (span) => `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01`,
    );
    expect(requests.map((request) => request.headers.get('traceparent')).sort()).toEqual(traceparents.sort());
    for (const span of found) {
      expect(span.attributes['server.address']).toBe('localhost');
    }
  });

  test('a request the application makes without an SDK method has no span', async () => {
    const { client, requests } = makeClient([json(MESSAGE)]);

    await client.post('/v1/messages', { body: PARAMS });

    expect(spans()).toHaveLength(0);
    expect(requests[0]!.headers.get('traceparent')).toBeNull();
  });

  test('trace context replaces only the headers the propagator writes', async () => {
    propagation.disable();
    propagation.setGlobalPropagator(
      new CompositePropagator({ propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()] }),
    );
    try {
      const { client, requests } = makeClient([json(MESSAGE)], {
        defaultHeaders: { baggage: 'tenant=acme' },
      });

      await client.messages.create(PARAMS);

      expect(requests[0]!.headers.get('baggage')).toBe('tenant=acme');
      expect(requests[0]!.headers.get('traceparent')).toEqual(expect.any(String));
    } finally {
      propagation.disable();
      propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    }
  });

  test('trace context is set when fetchOptions replaces the headers with a plain object', async () => {
    const { client, requests } = makeClient([json(MESSAGE)], {
      fetchOptions: { headers: { 'x-custom': 'yes' } } as any,
    });

    await client.messages.create(PARAMS);

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(requests[0]!.headers.get('x-custom')).toBe('yes');
    expect(requests[0]!.headers.get('traceparent')).toBe(
      `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01`,
    );
  });

  describe('a client that signs its requests', () => {
    /** Records which header names each signing hook (`backendMiddleware`, `prepareRequest`) can see. */
    function makeSigningClient(
      handlers: Handler[],
      options: Partial<ConstructorParameters<typeof Anthropic>[0]> = {},
      hooks: { sign?: () => Promise<void>; prepare?: (request: RequestInit) => void; backend?: boolean } = {},
    ) {
      const signed: string[][] = [];
      const requests: Headers[] = [];
      class SigningClient extends Anthropic {
        protected override backendMiddleware(): ReadonlyArray<Middleware> {
          if (hooks.backend === false) return [];
          return [
            async (request, next) => {
              // Every platform client awaits while it signs.
              await new Promise((resolve) => setTimeout(resolve, 1));
              await hooks.sign?.();
              signed.push(Array.from(new Headers(request.headers).keys()));
              return next(request);
            },
          ];
        }

        protected override async prepareRequest(request: RequestInit): Promise<void> {
          signed.push(Array.from(new Headers(request.headers).keys()));
          hooks.prepare?.(request);
        }
      }
      const client = new SigningClient({
        apiKey: 'test-key',
        maxRetries: 0,
        fetch: async (url, init = {}) => {
          requests.push(new Headers(init.headers));
          return handlers.shift()!(String(url), init);
        },
        ...options,
      });
      return { client, signed, requests };
    }
    const FIRST = '00-11111111111111111111111111111111-1111111111111111-01';
    const SECOND = '00-22222222222222222222222222222222-2222222222222222-01';

    test('does not see the trace headers in either hook, and sends them', async () => {
      propagation.disable();
      propagation.setGlobalPropagator(
        new CompositePropagator({
          propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
        }),
      );
      try {
        const { client, signed, requests } = makeSigningClient([json(MESSAGE)]);
        const baggage = propagation.createBaggage({ tenant: { value: 'acme' } });

        await context.with(propagation.setBaggage(context.active(), baggage), () =>
          client.messages.create(PARAMS),
        );

        expect(signed).toHaveLength(2);
        for (const names of signed) {
          expect(names).toContain('anthropic-version');
          expect(names).not.toContain('traceparent');
          expect(names).not.toContain('baggage');
        }
        const { traceId, spanId } = onlySpan('anthropic.messages.create').spanContext();
        expect(requests[0]!.get('traceparent')).toBe(`00-${traceId}-${spanId}-01`);
        expect(requests[0]!.get('baggage')).toBe('tenant=acme');
      } finally {
        propagation.disable();
        propagation.setGlobalPropagator(new W3CTraceContextPropagator());
      }
    });

    test('does not see a header that another propagator writes, and sends it', async () => {
      propagation.disable();
      propagation.setGlobalPropagator({
        inject: (ctx, carrier, setter) =>
          setter.set(carrier, 'X-B3-TraceId', trace.getSpanContext(ctx)!.traceId),
        extract: (ctx) => ctx,
        fields: () => ['X-B3-TraceId'],
      });
      try {
        const { client, signed, requests } = makeSigningClient([json(MESSAGE)]);

        await client.messages.create(PARAMS);

        expect(signed).toHaveLength(2);
        expect(signed.flat()).not.toContain('x-b3-traceid');
        expect(requests[0]!.get('x-b3-traceid')).toBe(
          onlySpan('anthropic.messages.create').spanContext().traceId,
        );
      } finally {
        propagation.disable();
        propagation.setGlobalPropagator(new W3CTraceContextPropagator());
      }
    });

    test('sends a call whose propagator lists a field that is not a header name', async () => {
      propagation.disable();
      propagation.setGlobalPropagator({
        inject: (ctx, carrier, setter) =>
          setter.set(carrier, 'x-trace-id', trace.getSpanContext(ctx)!.traceId),
        extract: (ctx) => ctx,
        fields: () => ['x-trace-id', 'not a header name'],
      });
      try {
        const { client, signed, requests } = makeSigningClient([json(MESSAGE)]);

        await client.messages.create(PARAMS);

        expect(signed.flat()).not.toContain('x-trace-id');
        expect(requests[0]!.has('x-trace-id')).toBe(true);
      } finally {
        propagation.disable();
        propagation.setGlobalPropagator(new W3CTraceContextPropagator());
      }
    });

    test("does not see the caller's own baggage and tracestate, and sends them", async () => {
      const { client, signed, requests } = makeSigningClient([json(MESSAGE)]);

      await client.messages.create(PARAMS, { headers: { baggage: 'k=v', tracestate: 'a=b' } });

      expect(signed).toHaveLength(2);
      expect(signed.flat()).not.toContain('baggage');
      expect(signed.flat()).not.toContain('tracestate');
      expect(requests[0]!.get('baggage')).toBe('k=v');
      expect(requests[0]!.get('tracestate')).toBe('a=b');
    });

    test("sees the caller's own trace headers when tracing is off", async () => {
      const { client, signed, requests } = makeSigningClient([json(MESSAGE)], { openTelemetry: false });

      await client.messages.create(PARAMS, { headers: { traceparent: FIRST } });

      expect(signed).toHaveLength(2);
      for (const names of signed) {
        expect(names).toContain('traceparent');
      }
      expect(requests[0]!.get('traceparent')).toBe(FIRST);
    });

    test("lets the application's middleware read and replace them", async () => {
      const seen: Array<string | null> = [];
      const replace: Middleware = (request, next) => {
        seen.push(request.headers.get('traceparent'));
        request.headers.set('traceparent', FIRST);
        return next(request);
      };
      const { client, signed, requests } = makeSigningClient([json(MESSAGE)], { middleware: [replace] });

      await client.messages.create(PARAMS);

      const { traceId, spanId } = onlySpan('anthropic.messages.create').spanContext();
      expect(seen).toEqual([`00-${traceId}-${spanId}-01`]);
      expect(signed.flat()).not.toContain('traceparent');
      expect(requests[0]!.get('traceparent')).toBe(FIRST);
    });

    test('two requests that a middleware has in flight at once each keep their own', async () => {
      const hedge: Middleware = async (request, next) => {
        const send = (traceparent: string) => {
          const headers = new Headers(request.headers);
          headers.set('traceparent', traceparent);
          return next({ ...request, headers });
        };
        return (await Promise.all([send(FIRST), send(SECOND)]))[0];
      };
      const { client, requests } = makeSigningClient([json(MESSAGE), json(MESSAGE)], { middleware: [hedge] });

      await client.messages.create(PARAMS);

      expect(requests.map((headers) => headers.get('traceparent')).sort()).toEqual([FIRST, SECOND]);
    });

    test('sends them with a retry', async () => {
      const { client, signed, requests } = makeSigningClient([json({}, 500), json(MESSAGE)], {
        maxRetries: 1,
      });

      await client.messages.create(PARAMS);

      expect(requests.map((headers) => headers.has('traceparent'))).toEqual([true, true]);
      expect(signed.flat()).not.toContain('traceparent');
    });

    test("after signing failed, a middleware's retry without them is sent without them", async () => {
      let failed = false;
      const sign = async () => {
        if (!failed) {
          failed = true;
          throw new Error('no credentials yet');
        }
      };
      const again: Middleware = async (request, next) => {
        try {
          return await next(request);
        } catch {
          const headers = new Headers(request.headers);
          headers.delete('traceparent');
          return next({ ...request, headers });
        }
      };
      const { client, requests } = makeSigningClient([json(MESSAGE)], { middleware: [again] }, { sign });

      await client.messages.create(PARAMS);

      expect(requests.map((headers) => headers.has('traceparent'))).toEqual([false]);
    });

    test('sends them when prepareRequest replaces the headers with a plain object', async () => {
      const prepare = (request: RequestInit) => {
        request.headers = { ...Object.fromEntries(new Headers(request.headers)), authorization: 'signature' };
      };
      const { client, requests } = makeSigningClient([json(MESSAGE)], {}, { prepare });

      await client.messages.create(PARAMS);

      expect(requests[0]!.get('authorization')).toBe('signature');
      expect(requests[0]!.has('traceparent')).toBe(true);
    });

    test("leaves the headers of the application's middleware as they are when prepareRequest throws", async () => {
      let failed = false;
      const prepare = () => {
        if (!failed) {
          failed = true;
          throw new Error('not yet');
        }
      };
      const seen: Array<string | null> = [];
      const again: Middleware = async (request, next) => {
        try {
          return await next(request);
        } catch {
          seen.push(request.headers.get('traceparent'));
          return next(request);
        }
      };
      const { client, requests } = makeSigningClient(
        [json(MESSAGE)],
        { middleware: [again] },
        { prepare, backend: false },
      );

      await client.messages.create(PARAMS);

      expect(seen).toEqual([expect.any(String)]);
      expect(requests.map((headers) => headers.get('traceparent'))).toEqual(seen);
    });
  });

  test('a response read with withResponse keeps the body attributes', async () => {
    const { client } = makeClient([json(MESSAGE)]);

    const { response } = await client.messages.create(PARAMS).withResponse();
    expect(response.status).toBe(200);

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(span.attributes['gen_ai.response.id']).toBe('msg_1');
    expect(span.attributes['gen_ai.usage.output_tokens']).toBe(20);
  });

  test('a response read with asResponse before it is parsed ends its span there, without the body', async () => {
    const { client } = makeClient([json(MESSAGE)]);

    const promise = client.messages.create(PARAMS);
    expect((await promise.asResponse()).status).toBe(200);

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(span.attributes['http.response.status_code']).toBe(200);
    expect(span.attributes['anthropic.request.id']).toBe('req_1');
    expect(span.attributes['gen_ai.request.model']).toBe('model-a');
    expect(span.attributes['gen_ai.response.id']).toBeUndefined();

    expect((await promise).id).toBe('msg_1');
    expect(spans()).toHaveLength(1);
  });

  test('beta names come from the anthropic-beta header', async () => {
    const { client } = makeClient([json(MESSAGE)]);

    await client.beta.messages.create({ ...PARAMS, betas: ['beta-one', 'beta-two'] });

    expect(onlySpan('anthropic.messages.create').attributes['anthropic.beta']).toEqual([
      'beta-one',
      'beta-two',
    ]);
  });

  test('a request that sets a JSON output format reports the json output type', async () => {
    const format = { type: 'json_schema' as const, schema: { type: 'object' } };
    const { client, requests } = makeClient([
      json(MESSAGE),
      json(MESSAGE),
      json({ ...MESSAGE, content: [{ type: 'text', text: '{}' }] }),
      json(MESSAGE),
      json(MESSAGE),
      json(MESSAGE),
    ]);

    await client.messages.create({ ...PARAMS, output_config: { format } });
    await client.beta.messages.create({ ...PARAMS, output_format: format });
    await client.messages.parse({ ...PARAMS, output_config: { format } });
    await client.messages.create({ ...PARAMS, output_config: { effort: 'low' } });
    await client.messages.create({ ...PARAMS, output_config: { format: { type: 'other' } as never } });
    await client.beta.messages.create({ ...PARAMS, output_format: { type: 'other' } as never });

    // The beta method sends the deprecated parameter as `output_config.format`.
    expect(requests[1]!.body.output_config).toEqual({ format });
    expect(requests[5]!.body.output_config).toEqual({ format: { type: 'other' } });
    expect(spans('anthropic.messages.create').map((span) => span.attributes['gen_ai.output.type'])).toEqual([
      'json',
      'json',
      'json',
      undefined,
      undefined,
      undefined,
    ]);
  });

  test('one span covers every attempt', async () => {
    const { client, requests } = makeClient(
      [json({ type: 'error', error: { type: 'api_error' } }, 500, { 'retry-after-ms': '0' }), json(MESSAGE)],
      { maxRetries: 1 },
    );

    await client.messages.create(PARAMS);

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(span.attributes['http.response.status_code']).toBe(200);
    expect(span.attributes['error.type']).toBeUndefined();
    expect(requests).toHaveLength(2);
    expect(requests[0]!.headers.get('traceparent')).toBe(requests[1]!.headers.get('traceparent'));
  });

  test('an error response sets the error type from its envelope', async () => {
    const { client } = makeClient([
      json({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, 429),
    ]);

    await expect(client.messages.create(PARAMS)).rejects.toBeInstanceOf(Anthropic.RateLimitError);

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes['error.type']).toBe('rate_limit_error');
    expect(span.attributes['http.response.status_code']).toBe(429);
    expect(span.attributes['gen_ai.response.id']).toBeUndefined();
    expect(span.attributes).not.toHaveProperty('anthropic.message.stop_reason');
    expect(span.attributes['gen_ai.request.model']).toBe('model-a');
  });

  test('the stop reason is recorded unchanged, as a string, and no span has finish reasons', async () => {
    const { client } = makeClient([
      json({ ...MESSAGE, stop_reason: 'tool_use' }),
      json({ ...MESSAGE, stop_reason: 'stop_sequence', stop_sequence: 'END' }),
      json({ ...MESSAGE, stop_reason: null }),
    ]);

    await client.messages.create(PARAMS);
    await client.beta.messages.create(PARAMS);
    await client.messages.create(PARAMS);

    // The client records no content: the stop reason is metadata.
    const recorded = spans('anthropic.messages.create');
    expect(recorded.map((span) => span.attributes['anthropic.message.stop_reason'])).toEqual([
      'tool_use',
      'stop_sequence',
      undefined,
    ]);
    for (const span of recorded) {
      expect(span.attributes).not.toHaveProperty('gen_ai.response.finish_reasons');
    }
  });

  test('an error response without an envelope sets the status code as the error type', async () => {
    const { client } = makeClient([() => new Response('bad gateway', { status: 502 })]);

    await expect(client.messages.create(PARAMS)).rejects.toBeInstanceOf(Anthropic.APIError);

    expect(onlySpan('anthropic.messages.create').attributes['error.type']).toBe('502');
  });

  test('a connection failure sets connection_error and no status code', async () => {
    const { client } = makeClient([
      () => {
        throw new TypeError('fetch failed');
      },
    ]);

    await expect(client.messages.create(PARAMS)).rejects.toBeInstanceOf(Anthropic.APIConnectionError);

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes['error.type']).toBe('connection_error');
    expect(span.attributes['http.response.status_code']).toBeUndefined();
    expect(span.attributes['server.address']).toBe('localhost');
  });

  test('an error thrown inside the API call ends its span with an error status', async () => {
    class FailingClient extends Anthropic {
      protected override async prepareOptions(): Promise<void> {
        throw new Error('bad options');
      }
    }
    const client = new FailingClient({ apiKey: 'test-key', baseURL: 'http://localhost:4010' });

    await expect(client.messages.create(PARAMS)).rejects.toThrow('bad options');

    const span = onlySpan('anthropic.messages.create');
    expect(span.ended).toBe(true);
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes['error.type']).toBe('client_error');
  });

  test('an upload whose form cannot be built ends its span with an error status', async () => {
    const { client } = makeClient([]);

    const upload = client.files.upload({ file: null as never });
    await expect(upload).rejects.toBeInstanceOf(TypeError);
    await expect(upload).rejects.toThrow('Received null for "file"');

    expect([...openSpans.values()]).toEqual([]);
    const span = onlySpan('anthropic.files.upload');
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes['error.type']).toBe('client_error');
  });

  describe('a method that fails while it builds its request starts no span', () => {
    // A header name that `Headers` rejects makes the method throw while it builds the request's
    // headers, which every method does before it starts its span.
    const badOptions = { headers: { 'bad header': 'x' } };

    test.each([
      ['messages.create', (client: Anthropic) => client.messages.create(PARAMS, badOptions)],
      ['beta.messages.create', (client: Anthropic) => client.beta.messages.create(PARAMS, badOptions)],
      ['messages.countTokens', (client: Anthropic) => client.messages.countTokens(PARAMS, badOptions)],
      ['models.retrieve', (client: Anthropic) => client.models.retrieve('model-a', {}, badOptions)],
      [
        'beta.sessions.retrieve',
        (client: Anthropic) => client.beta.sessions.retrieve('sesn_1', {}, badOptions),
      ],
      [
        'beta.sessions.create',
        (client: Anthropic) =>
          client.beta.sessions.create({ agent: 'agent_1', environment_id: 'env_1' }, badOptions),
      ],
      ['messages.batches.list', (client: Anthropic) => client.messages.batches.list({}, badOptions)],
      ['messages.stream', (client: Anthropic) => client.messages.stream(PARAMS, badOptions).finalMessage()],
      [
        'beta.messages.stream',
        (client: Anthropic) => client.beta.messages.stream(PARAMS, badOptions).finalMessage(),
      ],
      [
        'messages.stream with a parameter that is no header value',
        (client: Anthropic) => client.messages.stream({ ...PARAMS, workspace_id: 'a\nb' }).finalMessage(),
      ],
      [
        'beta.messages.stream with a beta name that is no header value',
        (client: Anthropic) => client.beta.messages.stream({ ...PARAMS, betas: ['a\nb'] }).finalMessage(),
      ],
      [
        'beta.messages.stream with two output formats',
        (client: Anthropic) => {
          const format = { type: 'json_schema' as const, schema: {} };
          return client.beta.messages
            .stream({ ...PARAMS, output_format: format, output_config: { format } })
            .finalMessage();
        },
      ],
    ])('%s', async (_name, call) => {
      const { client, requests } = makeClient([]);

      await expect((async () => call(client))()).rejects.toThrow();

      expect(requests).toHaveLength(0);
      expect([...openSpans.values()]).toEqual([]);
      expect(spans()).toEqual([]);
    });

    test('messages.stream with messages that cannot be iterated', async () => {
      const { client } = makeClient([]);

      expect(() => client.messages.stream({ ...PARAMS, messages: 7 as never })).toThrow();

      expect([...openSpans.values()]).toEqual([]);
      expect(spans()).toEqual([]);
    });

    describe.each([
      ['on', undefined],
      ['off', false as const],
    ])(
      'a stream helper with tracing %s reports the failure as an error of the stream',
      (_, openTelemetry) => {
        const format = { type: 'json_schema' as const, schema: {} };
        type OnError = (error: unknown) => void;

        test.each([
          [
            'messages.stream with a header name that is no header name',
            (client: Anthropic, onError: OnError) =>
              client.messages.stream(PARAMS, badOptions).on('error', onError),
            TypeError,
          ],
          [
            'messages.stream with a parameter that is no header value',
            (client: Anthropic, onError: OnError) =>
              client.messages.stream({ ...PARAMS, workspace_id: 'a\nb' }).on('error', onError),
            TypeError,
          ],
          [
            'beta.messages.stream with a header name that is no header name',
            (client: Anthropic, onError: OnError) =>
              client.beta.messages.stream(PARAMS, badOptions).on('error', onError),
            TypeError,
          ],
          [
            'beta.messages.stream with a beta name that is no header value',
            (client: Anthropic, onError: OnError) =>
              client.beta.messages.stream({ ...PARAMS, betas: ['a\nb'] }).on('error', onError),
            TypeError,
          ],
          [
            'beta.messages.stream with two output formats',
            (client: Anthropic, onError: OnError) =>
              client.beta.messages
                .stream({ ...PARAMS, output_format: format, output_config: { format } })
                .on('error', onError),
            undefined,
          ],
        ])('%s', async (_name, start, cause) => {
          const { client, requests } = makeClient([], { openTelemetry });
          const errors: unknown[] = [];

          // Not thrown by `stream()`: an application that listens for `error` has no `try` around it.
          const stream = start(client, (error) => errors.push(error));
          const failure: unknown = await stream.finalMessage().then(
            () => undefined,
            (error) => error,
          );

          expect(failure).toBeInstanceOf(Anthropic.AnthropicError);
          expect(errors).toHaveLength(1);
          expect(errors[0]).toBe(failure);
          if (cause) {
            expect((failure as Error).cause).toBeInstanceOf(cause);
          } else {
            expect((failure as Error).message).toMatch('Both output_format and output_config.format');
          }
          expect(stream.errored).toBe(true);
          expect(requests).toHaveLength(0);
          expect([...openSpans.values()]).toEqual([]);
          expect(spans()).toEqual([]);
        });
      },
    );
  });

  test('count_tokens reports its count and no operation', async () => {
    const { client } = makeClient([json({ input_tokens: 42 })]);

    await client.messages.countTokens(PARAMS);

    const span = onlySpan('anthropic.messages.count_tokens');
    expect(span.attributes['anthropic.message.count_tokens.input_tokens']).toBe(42);
    expect(span.attributes['gen_ai.request.model']).toBe('model-a');
    expect(span.attributes['gen_ai.operation.name']).toBeUndefined();
    expect(span.attributes['gen_ai.usage.input_tokens']).toBeUndefined();
  });

  test('batch methods report the batch ID', async () => {
    const batch = { id: 'msgbatch_1', type: 'message_batch' };
    const { client } = makeClient([json(batch), json(batch), json({ data: [batch], has_more: false })]);

    await client.messages.batches.create({ requests: [] });
    await client.messages.batches.retrieve('msgbatch_1');
    await client.messages.batches.list();

    const batchID = pathID('messages.batches.retrieve', 'message_batch_id');
    expect(createdID('messages.batches.create')).toBe(batchID);
    expect(onlySpan('anthropic.messages.batches.create').attributes[batchID]).toBe('msgbatch_1');
    expect(onlySpan('anthropic.messages.batches.retrieve').attributes[batchID]).toBe('msgbatch_1');
    expect(onlySpan('anthropic.messages.batches.list').attributes).not.toHaveProperty(batchID);
  });

  test('other methods are named after their path, without beta', async () => {
    const { client } = makeClient([json({ id: 'model-a', type: 'model' }), json({ id: 'model-a' })]);

    await client.models.retrieve('model-a');
    await client.beta.models.retrieve('model-a');

    const named = spans('anthropic.models.retrieve');
    expect(named).toHaveLength(2);
    expect(named[0]!.attributes['gen_ai.operation.name']).toBeUndefined();
    expect(named[0]!.attributes['gen_ai.provider.name']).toBe('anthropic');
  });

  test('each page of a list has its own span, a child of the span current when it is fetched', async () => {
    const page = (id: string, hasMore: boolean) =>
      json({ data: [{ id, type: 'model' }], has_more: hasMore, first_id: id, last_id: id });
    const { client } = makeClient([page('a', true), page('b', false)]);

    const first = await client.models.list();
    await tracer.startActiveSpan('later', async (later) => {
      await first.getNextPage();
      later.end();
    });

    const [firstSpan, secondSpan] = spans('anthropic.models.list');
    expect(parentId(firstSpan!)).toBeUndefined();
    expect(parentId(secondSpan!)).toBe(onlySpan('later').spanContext().spanId);
  });

  test('each page that auto-pagination fetches has its own span', async () => {
    const page = (id: string, hasMore: boolean) =>
      json({ data: [{ id, type: 'model' }], has_more: hasMore, first_id: id, last_id: id });
    const { client, requests } = makeClient([page('a', true), page('b', true), page('c', false)]);

    const ids = [];
    for await (const model of client.models.list()) {
      ids.push(model.id);
    }

    expect(ids).toEqual(['a', 'b', 'c']);
    const found = spans('anthropic.models.list');
    expect(found).toHaveLength(3);
    expect(new Set(found.map((span) => span.spanContext().spanId)).size).toBe(3);
    expect(found.map((span) => span.status.code)).toEqual(Array(3).fill(SpanStatusCode.OK));
    expect(requests.map((request) => request.headers.get('traceparent'))).toEqual(
      found.map((span) => `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01`),
    );
  });
});
