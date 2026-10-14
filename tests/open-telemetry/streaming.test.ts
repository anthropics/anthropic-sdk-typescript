import http from 'node:http';
import type { AddressInfo } from 'node:net';
import v8 from 'node:v8';
import vm from 'node:vm';
import { trace, SpanStatusCode, type Span } from '@opentelemetry/api';
import Anthropic from '@anthropic-ai/sdk';
import {
  tracer,
  makeClient,
  json,
  sse,
  PARAMS,
  STREAM_EVENTS,
  SESSION_EVENT,
  spans,
  onlySpan,
  openSpans,
  parentId,
  setUpTracing,
  type Handler,
} from './utils';

setUpTracing();

// tripwire: a new MessageDeltaUsage or BetaMessageDeltaUsage field must be handled, or left out on
// purpose, in endMessagesCreateSpanWhenStreamEnds (src/lib/internal/tracing/streaming.ts), then listed here
// (missing key -> required-property error, extra key -> excess-property error);
// enforced at compile time by tsc via ./scripts/lint, not by the test runner
const _recordedDeltaUsageKeys: Record<
  keyof Anthropic.MessageDeltaUsage | keyof Anthropic.Beta.BetaMessageDeltaUsage,
  true
> = {
  cache_creation_input_tokens: true,
  cache_read_input_tokens: true,
  fallback_credit: true,
  input_tokens: true,
  iterations: true,
  output_tokens: true,
  output_tokens_details: true,
  server_tool_use: true,
};
void _recordedDeltaUsageKeys;

describe('OpenTelemetry spans', () => {
  test('a streaming API call ends its span when the stream has been read', async () => {
    const { client } = makeClient([sse(STREAM_EVENTS)]);

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    expect(spans()).toHaveLength(0);
    for await (const _ of stream) {
    }

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(span.attributes).toMatchObject({
      'gen_ai.request.stream': true,
      'gen_ai.response.id': 'msg_1',
      'gen_ai.response.model': 'model-served',
      'anthropic.message.stop_reason': 'end_turn',
      'gen_ai.usage.input_tokens': 15,
      'gen_ai.usage.output_tokens': 20,
      'gen_ai.usage.reasoning.output_tokens': 7,
      'anthropic.usage.cache_creation.ephemeral_5m_input_tokens': 2,
      'anthropic.request.id': 'req_stream',
    });
    expect(span.attributes['gen_ai.response.time_to_first_chunk']).toEqual(expect.any(Number));
  });

  test('time to first chunk counts from the start of the API call, across attempts', async () => {
    const { client } = makeClient(
      [
        json({ type: 'error', error: { type: 'api_error' } }, 500, { 'retry-after-ms': '60' }),
        sse(STREAM_EVENTS),
      ],
      { maxRetries: 1 },
    );

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    for await (const _ of stream) {
    }

    const span = onlySpan('anthropic.messages.create');
    expect(span.attributes['gen_ai.response.time_to_first_chunk']).toBeGreaterThanOrEqual(0.05);
  });

  /** A streamed response that sends `first` at once and `rest` after `delayMs`. */
  const pausedSse =
    (first: Array<Record<string, any>>, rest: Array<Record<string, any>>, delayMs: number): Handler =>
    () => {
      const encode = (events: Array<Record<string, any>>) =>
        new TextEncoder().encode(
          events.map((e) => `event: ${e['type']}\ndata: ${JSON.stringify(e)}\n\n`).join(''),
        );
      const body = new ReadableStream({
        start(stream) {
          stream.enqueue(encode(first));
          setTimeout(() => {
            stream.enqueue(encode(rest));
            stream.close();
          }, delayMs);
        },
      });
      return new Response(body, {
        headers: { 'content-type': 'text/event-stream', 'request-id': 'req_stream' },
      });
    };

  test.each([
    ['messages', { type: 'text', text: '' }, { type: 'text_delta', text: 'hello' }],
    [
      'messages',
      { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: {} },
      { type: 'input_json_delta', partial_json: '{"city"' },
    ],
    [
      'beta.messages',
      { type: 'thinking', thinking: '', signature: '' },
      { type: 'thinking_delta', thinking: 'hm' },
    ],
    [
      'beta.messages',
      { type: 'thinking', thinking: '', signature: '' },
      { type: 'signature_delta', signature: 'sig' },
    ],
  ] as const)(
    'time to first chunk of %s runs to the first content_block_delta, not to an earlier event',
    async (resource, content_block, delta) => {
      // `ping`, `message_start` and `content_block_start` arrive at once, the delta 60 ms later.
      const { client } = makeClient([
        pausedSse(
          [{ type: 'ping' }, STREAM_EVENTS[0]!, { type: 'content_block_start', index: 0, content_block }],
          [{ type: 'content_block_delta', index: 0, delta }, ...STREAM_EVENTS.slice(3)],
          60,
        ),
      ]);

      const stream: AsyncIterable<unknown> =
        resource === 'messages' ?
          await client.messages.create({ ...PARAMS, stream: true })
        : await client.beta.messages.create({ ...PARAMS, stream: true });
      for await (const _ of stream) {
      }

      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.OK);
      expect(span.attributes['gen_ai.response.time_to_first_chunk']).toBeGreaterThanOrEqual(0.05);
    },
  );

  test.each(['messages', 'beta.messages'] as const)(
    'a stream of %s without a content_block_delta has no time to first chunk',
    async (resource) => {
      // The block arrives whole in its `content_block_start`.
      const { client } = makeClient([
        sse([
          { type: 'ping' },
          STREAM_EVENTS[0]!,
          {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'tool_use', id: 'toolu_1', name: 'get_time', input: {} },
          },
          ...STREAM_EVENTS.slice(3),
        ]),
      ]);

      const stream: AsyncIterable<unknown> =
        resource === 'messages' ?
          await client.messages.create({ ...PARAMS, stream: true })
        : await client.beta.messages.create({ ...PARAMS, stream: true });
      for await (const _ of stream) {
      }

      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.OK);
      expect(span.attributes['gen_ai.usage.output_tokens']).toBe(20);
      expect(span.attributes).not.toHaveProperty('gen_ai.response.time_to_first_chunk');
    },
  );

  test('the stream helper emits the same span', async () => {
    const { client } = makeClient([sse(STREAM_EVENTS)]);

    await client.messages.stream(PARAMS).finalMessage();

    const span = onlySpan('anthropic.messages.create');
    expect(span.attributes['gen_ai.usage.output_tokens']).toBe(20);
    expect(span.attributes['anthropic.message.stop_reason']).toBe('end_turn');
    expect(span.attributes).not.toHaveProperty('gen_ai.response.finish_reasons');
  });

  test('a streamed response that fell back to another model reports the model that served it', async () => {
    const { client } = makeClient([
      sse([
        STREAM_EVENTS[0]!,
        {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'fallback',
            from: { model: 'model-served' },
            to: { model: 'model-fallback' },
            trigger: { type: 'refusal', category: 'cyber' },
          } satisfies Anthropic.Beta.BetaFallbackBlock,
        },
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'hello' } },
        { type: 'content_block_stop', index: 1 },
        ...STREAM_EVENTS.slice(4),
      ]),
    ]);

    const message = await client.beta.messages.stream(PARAMS).finalMessage();

    expect(message.model).toBe('model-fallback');
    expect(onlySpan('anthropic.messages.create').attributes['gen_ai.response.model']).toBe('model-fallback');
  });

  describe('a streamed response with a compaction', () => {
    const iterations = [
      {
        type: 'compaction',
        input_tokens: 100,
        cache_read_input_tokens: 10,
        cache_creation_input_tokens: 5,
        cache_creation: null,
        output_tokens: 30,
      },
    ] satisfies Array<Anthropic.Beta.BetaCompactionIterationUsage>;
    // The last `message_delta` has the iterations.
    const events = STREAM_EVENTS.map((event) =>
      event.type === 'message_delta' ? { ...event, usage: { ...event.usage, iterations } } : event,
    );
    const compactionTokens = () => {
      const { attributes } = onlySpan('anthropic.messages.create');
      return [
        attributes['anthropic.usage.compaction.input_tokens'],
        attributes['anthropic.usage.compaction.output_tokens'],
      ];
    };

    test.each(['metadata_only', 'content'] as const)(
      'has the tokens of the compaction, with contentMode %s',
      async (contentMode) => {
        const { client } = makeClient([sse(events), sse(events)], {
          openTelemetry: { traces: { contentMode } },
        });

        for await (const _ of await client.beta.messages.create({ ...PARAMS, stream: true })) {
        }
        expect(compactionTokens()).toEqual([115, 30]);
        expect(onlySpan('anthropic.messages.create').attributes['gen_ai.usage.input_tokens']).toBe(15);
      },
    );

    test('has them when the stream helper reads it', async () => {
      const { client } = makeClient([sse(events)]);

      const message = await client.beta.messages.stream(PARAMS).finalMessage();

      expect(message.usage.iterations).toEqual(iterations);
      expect(compactionTokens()).toEqual([115, 30]);
    });

    test.each([
      ['has them when the stream ends after message_delta, before message_stop', -1, [115, 30]],
      ['has none when the stream ends before message_delta', -2, [undefined, undefined]],
    ])('%s', async (_name, end, tokens) => {
      const { client } = makeClient([sse(events.slice(0, end))]);

      for await (const _ of await client.beta.messages.create({ ...PARAMS, stream: true })) {
      }

      expect(onlySpan('anthropic.messages.create').status.code).toBe(SpanStatusCode.ERROR);
      expect(compactionTokens()).toEqual(tokens);
    });
  });

  test.each(['messages', 'beta.messages'] as const)(
    'the span of %s.stream starts when it is called, and the request carries its context',
    async (resource) => {
      const { client, requests } = makeClient([sse(STREAM_EVENTS)]);
      // The helper sends the request later, outside of the span that is current here.
      const stream = tracer.startActiveSpan('parent', (parent) => {
        const stream =
          resource === 'messages' ? client.messages.stream(PARAMS) : client.beta.messages.stream(PARAMS);
        parent.end();
        return stream;
      });
      await stream.finalMessage();

      const span = onlySpan('anthropic.messages.create');
      expect(parentId(span)).toBe(onlySpan('parent').spanContext().spanId);
      expect(requests[0]!.headers.get('traceparent')).toBe(
        `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01`,
      );
      expect(span.status.code).toBe(SpanStatusCode.OK);
    },
  );

  describe.each(['messages', 'beta.messages'] as const)(
    'application code that reads %s.stream',
    (resource) => {
      const EVENTS = [
        'connect',
        'streamEvent',
        'text',
        'contentBlock',
        'message',
        'finalMessage',
        'end',
      ] as const;
      type Listen = (event: (typeof EVENTS)[number]) => () => void;

      const current = () => trace.getActiveSpan()?.spanContext().spanId;

      /** Starts the stream helper with a listener for each of `EVENTS`. */
      function streamWithListeners(client: Anthropic, listen: Listen) {
        if (resource === 'messages') {
          const stream = client.messages.stream(PARAMS);
          EVENTS.forEach((event) => stream.on(event, listen(event)));
          return stream;
        }
        const stream = client.beta.messages.stream(PARAMS);
        EVENTS.forEach((event) => stream.on(event, listen(event)));
        return stream;
      }

      test("an event listener and a loop over the helper run with the application's span current, not the API call's", async () => {
        const { client } = makeClient([sse(STREAM_EVENTS), sse(STREAM_EVENTS)]);
        const seen: Record<string, string | undefined> = {};
        const endedDuringText: number[] = [];

        await tracer.startActiveSpan('app', async (app) => {
          const appId = app.spanContext().spanId;

          const listened = streamWithListeners(client, (event) => () => {
            seen[event] = current();
            tracer.startSpan(`app.on_${event}`).end();
            if (event === 'text') {
              endedDuringText.push(spans('anthropic.messages.create').length);
            }
          });
          await listened.finalMessage();
          expect(seen).toEqual(Object.fromEntries(EVENTS.map((event) => [event, appId])));

          const looped =
            resource === 'messages' ? client.messages.stream(PARAMS) : client.beta.messages.stream(PARAMS);
          for await (const _ of looped) {
            expect(current()).toBe(appId);
            tracer.startSpan('app.in_loop').end();
          }
          expect(current()).toBe(appId);
          app.end();
        });

        const appId = onlySpan('app').spanContext().spanId;
        const calls = spans('anthropic.messages.create');
        expect(calls).toHaveLength(2);
        const callIds = calls.map((call) => call.spanContext().spanId);
        for (const event of EVENTS) {
          expect(callIds).not.toContain(seen[event]);
          expect(new Set(spans(`app.on_${event}`).map(parentId))).toEqual(new Set([appId]));
        }
        expect(new Set(spans('app.in_loop').map(parentId))).toEqual(new Set([appId]));

        // The span stays open while the listeners run and ends once the stream has been read.
        expect(endedDuringText).toEqual([0]);
        expect(calls.map(parentId)).toEqual([appId, appId]);
        expect(calls.map((call) => call.status.code)).toEqual([SpanStatusCode.OK, SpanStatusCode.OK]);
      });

      test('a span that an event listener starts is a root span when the application has no span', async () => {
        const { client } = makeClient([sse(STREAM_EVENTS)]);
        const active = new Map<string, Span | undefined>();

        const stream = streamWithListeners(client, (event) => () => {
          active.set(event, trace.getActiveSpan());
          tracer.startSpan(`app.on_${event}`).end();
        });
        await stream.finalMessage();

        expect([...active.keys()].sort()).toEqual([...EVENTS].sort());
        expect([...active.values()].every((span) => span === undefined)).toBe(true);

        const call = onlySpan('anthropic.messages.create');
        expect(call.status.code).toBe(SpanStatusCode.OK);
        for (const event of EVENTS) {
          const started = spans(`app.on_${event}`);
          expect(started.length).toBeGreaterThan(0);
          expect(new Set(started.map(parentId))).toEqual(new Set([undefined]));
          expect(started.map((span) => span.spanContext().traceId)).not.toContain(call.spanContext().traceId);
        }
      });
    },
  );

  test('a stream the application closes early leaves the status unset', async () => {
    const { client } = makeClient([sse(STREAM_EVENTS)]);

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    for await (const _ of stream) {
      break;
    }

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.attributes['error.type']).toBeUndefined();
    expect(span.attributes['gen_ai.usage.input_tokens']).toBe(15);
    expect(span.attributes['gen_ai.response.id']).toBe('msg_1');
    expect(span.attributes['anthropic.response.service_tier']).toBe('standard');
    expect(span.attributes['gen_ai.usage.output_tokens']).toBeUndefined();
    expect(span.attributes['anthropic.message.stop_reason']).toBeUndefined();
    // It was closed after `message_start`, before any `content_block_delta`.
    expect(span.attributes).not.toHaveProperty('gen_ai.response.time_to_first_chunk');
  });

  test.each(['messages', 'beta.messages'] as const)(
    'a stream of %s the application closes right after message_stop leaves the status unset',
    async (resource) => {
      const { client } = makeClient([sse(STREAM_EVENTS)]);

      const stream: AsyncIterable<{ type: string }> =
        resource === 'messages' ?
          await client.messages.create({ ...PARAMS, stream: true })
        : await client.beta.messages.create({ ...PARAMS, stream: true });
      for await (const event of stream) {
        if (event.type === 'message_stop') {
          break;
        }
      }

      // The application closed the stream before the API did, whatever it had read of it.
      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.UNSET);
      expect(span.attributes['error.type']).toBeUndefined();
      expect(span.attributes).toMatchObject({
        'gen_ai.response.id': 'msg_1',
        'anthropic.message.stop_reason': 'end_turn',
        'gen_ai.usage.output_tokens': 20,
      });
      expect(span.attributes['gen_ai.response.time_to_first_chunk']).toEqual(expect.any(Number));
    },
  );

  test('an API call the application aborts while its body is read leaves the status unset', async () => {
    const controller = new AbortController();
    const { client } = makeClient([
      (_url, init) => {
        const body = new ReadableStream({
          start(stream) {
            init.signal?.addEventListener('abort', () =>
              stream.error(new DOMException('aborted', 'AbortError')),
            );
          },
        });
        setTimeout(() => controller.abort(), 0);
        return new Response(body, { headers: { 'content-type': 'application/json' } });
      },
    ]);

    await expect(client.messages.create(PARAMS, { signal: controller.signal })).rejects.toThrow();

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.attributes['error.type']).toBeUndefined();
  });

  test('a stream the application aborts while reading it leaves the status unset', async () => {
    const { client } = makeClient([
      (_url, init) => {
        const body = new ReadableStream({
          start(stream) {
            const event = `event: message_start\ndata: ${JSON.stringify(STREAM_EVENTS[0])}\n\n`;
            stream.enqueue(new TextEncoder().encode(event));
            init.signal?.addEventListener('abort', () =>
              stream.error(new DOMException('aborted', 'AbortError')),
            );
          },
        });
        return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
      },
    ]);

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    for await (const _ of stream) {
      stream.controller.abort();
    }

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.attributes['error.type']).toBeUndefined();
    expect(span.attributes['gen_ai.response.id']).toBe('msg_1');
  });

  test('a stream the application aborts without reading it ends its span with the status unset', async () => {
    const { client } = makeClient([sse(STREAM_EVENTS)]);

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    expect(spans()).toHaveLength(0);
    stream.controller.abort();

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.attributes['http.response.status_code']).toBe(200);
    // A read after that leaves the ended span alone.
    for await (const _ of stream) {
    }
    expect(spans()).toHaveLength(1);
  });

  test.each([
    ['its iterator is returned', (stream: any) => stream[Symbol.asyncIterator]().return()],
    ['its ReadableStream is canceled', (stream: any) => stream.toReadableStream().cancel()],
  ])(
    'a stream closed before its first read, when %s, ends its span once with the status unset',
    async (_, close) => {
      const { client } = makeClient([sse(STREAM_EVENTS)]);

      const stream = await client.messages.create({ ...PARAMS, stream: true });
      await close(stream);
      stream.controller.abort();

      expect(spans()).toHaveLength(1);
      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.UNSET);
      expect(span.attributes['error.type']).toBeUndefined();
    },
  );

  test.each([
    ['messages.create', (client: Anthropic) => client.messages.create({ ...PARAMS, stream: true })],
    ['beta.messages.create', (client: Anthropic) => client.beta.messages.create({ ...PARAMS, stream: true })],
  ])(
    'garbage collection closes an unread %s stream that was dropped, not one that is held',
    async (_, request) => {
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

      const client = new Anthropic({
        baseURL: `http://localhost:${(server.address() as AddressInfo).port}`,
        apiKey: 'test-key',
      });

      const held = await request(client);
      // In its own frame, so that this one cannot keep the stream alive.
      await (async () => void (await request(client)))();
      await expect.poll(() => (gc(), responses[1]!.destroyed), { timeout: 20_000 }).toBe(true);

      expect(responses[0]!.destroyed).toBe(false);
      held.controller.abort();
    },
    30_000,
  );

  test('an error event fails the span with its type', async () => {
    const { client } = makeClient([
      sse([STREAM_EVENTS[0]!, { type: 'error', error: { type: 'overloaded_error', message: 'busy' } }]),
    ]);

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    await expect(async () => {
      for await (const _ of stream) {
      }
    }).rejects.toBeInstanceOf(Anthropic.APIError);

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes['error.type']).toBe('overloaded_error');
  });

  describe.each([
    [
      'no stream helper',
      async (client: Anthropic) => {
        for await (const _ of await client.messages.create({ ...PARAMS, stream: true })) {
        }
      },
    ],
    [
      'the stream helper',
      (client: Anthropic) => expect(client.messages.stream(PARAMS).finalMessage()).rejects.toThrow(),
    ],
    [
      'the beta stream helper',
      (client: Anthropic) => expect(client.beta.messages.stream(PARAMS).finalMessage()).rejects.toThrow(),
    ],
  ])('a stream the server ends before message_stop, read with %s', (_reader, read) => {
    // The stop reason and the output usage are the Message's from `message_delta` on.
    const FROM_MESSAGE_DELTA = [
      'anthropic.message.stop_reason',
      'gen_ai.usage.output_tokens',
      'gen_ai.usage.reasoning.output_tokens',
    ];

    test('fails the span, without what message_delta has when it ends before it', async () => {
      const { client } = makeClient([sse(STREAM_EVENTS.slice(0, 4))]);

      await read(client);

      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.ERROR);
      expect(span.attributes['error.type']).toBe('api_error');
      expect(span.attributes).toMatchObject({
        'gen_ai.response.id': 'msg_1',
        'gen_ai.response.model': 'model-served',
        'gen_ai.usage.input_tokens': 15,
      });
      for (const name of FROM_MESSAGE_DELTA) {
        expect(span.attributes).not.toHaveProperty(name);
      }
    });

    test('fails the span, with what message_delta has when it ends after it', async () => {
      const { client } = makeClient([sse(STREAM_EVENTS.slice(0, 5))]);

      await read(client);

      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.ERROR);
      expect(span.attributes['error.type']).toBe('api_error');
      expect(span.attributes).toMatchObject({
        'gen_ai.response.id': 'msg_1',
        'gen_ai.usage.input_tokens': 15,
        'anthropic.message.stop_reason': 'end_turn',
        'gen_ai.usage.output_tokens': 20,
        'gen_ai.usage.reasoning.output_tokens': 7,
      });
    });
  });

  test('a stream the application closes after message_delta has what message_delta has', async () => {
    const { client } = makeClient([sse(STREAM_EVENTS)]);

    for await (const event of await client.messages.create({ ...PARAMS, stream: true })) {
      if (event.type === 'message_delta') break;
    }

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.attributes).toMatchObject({
      'anthropic.message.stop_reason': 'end_turn',
      'gen_ai.usage.output_tokens': 20,
    });
  });

  test.each([
    ['the stream helper', (client: Anthropic) => client.messages.stream(PARAMS)],
    ['the beta stream helper', (client: Anthropic) => client.beta.messages.stream(PARAMS)],
  ])('an event that %s cannot handle fails the span as a client error', async (_helper, start) => {
    // A second `message_start` before `message_stop` is out of order, which the helper throws on.
    const { client } = makeClient([sse([STREAM_EVENTS[0]!, ...STREAM_EVENTS])]);

    await expect(start(client).finalMessage()).rejects.toThrow('Unexpected event order');

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes['error.type']).toBe('client_error');
  });

  test.each([
    ['the stream helper', (client: Anthropic) => client.messages.stream(PARAMS)],
    ['the beta stream helper', (client: Anthropic) => client.beta.messages.stream(PARAMS)],
  ])(
    'an event that %s skips or passes through leaves the span as the stream made it',
    async (_helper, start) => {
      // The helper skips an event before `message_start`, and passes on one of an unknown type.
      const unknown = { type: 'future_event', usage: { output_tokens: 99 } };
      const events = [STREAM_EVENTS[3]!, unknown, STREAM_EVENTS[0]!, unknown, ...STREAM_EVENTS.slice(1)];
      const { client } = makeClient([sse(events)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      const message = await start(client).finalMessage();

      expect(message.content).toEqual([{ type: 'text', text: 'hello' }]);
      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.OK);
      expect(span.attributes['error.type']).toBeUndefined();
      expect(span.attributes).toMatchObject({
        'gen_ai.response.id': 'msg_1',
        'anthropic.message.stop_reason': 'end_turn',
        'gen_ai.usage.input_tokens': 15,
        'gen_ai.usage.output_tokens': 20,
      });
      expect(JSON.parse(String(span.attributes['gen_ai.output.messages']))).toEqual([
        { role: 'assistant', parts: [{ type: 'text', content: 'hello' }] },
      ]);
    },
  );

  const failingListener = () => {
    throw new Error('the listener failed');
  };
  test.each([
    [
      'the stream helper',
      (client: Anthropic) => client.messages.stream(PARAMS).on('message', failingListener).done(),
    ],
    [
      'the beta stream helper',
      (client: Anthropic) => client.beta.messages.stream(PARAMS).on('message', failingListener).done(),
    ],
  ])(
    'a failure of %s on message_stop fails the span too, with what the stream recorded',
    async (_helper, run) => {
      const { client } = makeClient([sse(STREAM_EVENTS)]);

      await expect(run(client)).rejects.toThrow('the listener failed');

      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.ERROR);
      expect(span.attributes['error.type']).toBe('client_error');
      expect(span.attributes['gen_ai.usage.output_tokens']).toBe(20);
    },
  );

  test.each([
    [
      'the stream helper',
      (client: Anthropic) => client.messages.stream(PARAMS).on('connect', failingListener).done(),
    ],
    [
      'the beta stream helper',
      (client: Anthropic) => client.beta.messages.stream(PARAMS).on('connect', failingListener).done(),
    ],
  ])('a failure of %s on connect aborts the request and fails the span', async (_helper, run) => {
    let signal: AbortSignal | null | undefined;
    const { client } = makeClient([
      (_url, init) => {
        signal = init.signal;
        return new Response(new ReadableStream(), { headers: { 'content-type': 'text/event-stream' } });
      },
    ]);

    await expect(run(client)).rejects.toThrow('the listener failed');

    expect([...openSpans.values()]).toEqual([]);
    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes['error.type']).toBe('client_error');
    expect(signal?.aborted).toBe(true);
  });

  test('a stream event that cannot be recorded still reaches the application', async () => {
    const events = [STREAM_EVENTS[0]!, { type: 'message_delta' }, STREAM_EVENTS[5]!];
    const { client } = makeClient([sse(events)]);

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    const types: string[] = [];
    for await (const event of stream) {
      types.push(event.type);
    }

    expect(types).toEqual(['message_start', 'message_delta', 'message_stop']);
    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(span.attributes['gen_ai.response.id']).toBe('msg_1');
  });

  test('an event stream the server ends leaves the status unset', async () => {
    const { client } = makeClient([sse([SESSION_EVENT])]);

    const stream = await client.beta.sessions.events.stream('sesn_1');
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    const span = onlySpan('anthropic.sessions.events.stream');
    expect(span.ended).toBe(true);
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.attributes['error.type']).toBeUndefined();
    expect(span.attributes['http.response.status_code']).toBe(200);
    expect(span.attributes['server.address']).toBe('localhost');
    expect(span.attributes['gen_ai.provider.name']).toBe('anthropic');
  });

  test('an event stream the application closes leaves the status unset', async () => {
    const { client } = makeClient([sse([SESSION_EVENT, SESSION_EVENT])]);

    const stream = await client.beta.sessions.events.stream('sesn_1');
    for await (const _ of stream) {
      break;
    }

    const span = onlySpan('anthropic.sessions.events.stream');
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.attributes['error.type']).toBeUndefined();
  });

  test('the stream iterator is iterable and forwards throw', async () => {
    const { client, requests } = makeClient([sse(STREAM_EVENTS)], { logLevel: 'off' });

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    const iterator = stream[Symbol.asyncIterator]() as AsyncIterableIterator<unknown>;
    expect(iterator[Symbol.asyncIterator]()).toBe(iterator);

    async function* forward() {
      yield* iterator;
    }
    const forwarded = forward();
    await forwarded.next();
    const error = new Error('stop');
    await expect(forwarded.throw(error)).rejects.toBe(error);

    // The application closed the stream, so the status stays unset.
    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.attributes['error.type']).toBeUndefined();
    expect(requests).toHaveLength(1);
  });

  test('a second iterator of a stream does not end the span of the first', async () => {
    const { client } = makeClient([sse(STREAM_EVENTS)]);

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    const first = stream[Symbol.asyncIterator]();
    await first.next();
    await expect(stream[Symbol.asyncIterator]().next()).rejects.toBeInstanceOf(Anthropic.AnthropicError);
    expect(spans()).toHaveLength(0);
    while (!(await first.next()).done) {}

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(span.attributes['gen_ai.usage.output_tokens']).toBe(20);
  });

  test('a teed stream stays open when both branches stop early, and ends its span when it is read to its end', async () => {
    const { client } = makeClient([sse(STREAM_EVENTS)]);

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    const [left, right] = stream.tee();
    for await (const _ of left) {
      break;
    }
    for await (const _ of right) {
      break;
    }
    // Neither branch closes the request, so the span stays open with it.
    expect(stream.controller.signal.aborted).toBe(false);
    expect(spans()).toHaveLength(0);

    const rest: string[] = [];
    for await (const event of left) {
      rest.push(event.type);
    }
    expect(rest).toEqual(STREAM_EVENTS.slice(1).map((event) => event.type));

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(span.attributes['gen_ai.usage.output_tokens']).toBe(20);
  });

  test('a teed stream read through both branches ends its span once', async () => {
    const { client } = makeClient([sse(STREAM_EVENTS)]);

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    const [left, right] = stream.tee();
    for await (const _ of left) {
    }
    for await (const _ of right) {
    }

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(span.attributes['gen_ai.usage.output_tokens']).toBe(20);
  });

  test('a stream read through toReadableStream ends its span', async () => {
    const { client } = makeClient([sse(STREAM_EVENTS)]);

    const stream = await client.messages.create({ ...PARAMS, stream: true });
    const reader = stream.toReadableStream().getReader();
    while (!(await reader.read()).done) {}

    const span = onlySpan('anthropic.messages.create');
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(span.attributes['anthropic.message.stop_reason']).toBe('end_turn');
  });
});
