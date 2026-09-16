import { Readable } from 'node:stream';
import { EventStreamMarshaller } from '@smithy/eventstream-serde-node';
import { APIError } from '@anthropic-ai/sdk';
import { Stream } from '@anthropic-ai/sdk/streaming';
import type { Middleware } from '@anthropic-ai/sdk';
import { eventStreamToSSEResponse, fromUtf8, toUtf8 } from '../src/core/streaming';
import { AnthropicBedrock } from '../src';

type Frame =
  | { eventType: 'chunk'; payload: unknown }
  | { exceptionType: string; payload: { message: string } }
  | { errorCode: string; errorMessage: string };

function encodeFrame(frame: Frame) {
  const header = (value: string) => ({ type: 'string', value });
  if ('exceptionType' in frame) {
    return {
      headers: {
        ':message-type': header('exception'),
        ':exception-type': header(frame.exceptionType),
        ':content-type': header('application/json'),
      },
      body: fromUtf8(JSON.stringify(frame.payload)),
    };
  }
  if ('errorCode' in frame) {
    return {
      headers: {
        ':message-type': header('error'),
        ':error-code': header(frame.errorCode),
        ':error-message': header(frame.errorMessage),
      },
      body: new Uint8Array(),
    };
  }
  return {
    headers: {
      ':message-type': header('event'),
      ':event-type': header(frame.eventType),
      ':content-type': header('application/json'),
    },
    body: fromUtf8(JSON.stringify({ bytes: Buffer.from(JSON.stringify(frame.payload)).toString('base64') })),
  };
}

function encodeFrames(frames: Frame[]): ReadableStream {
  const marshaller = new EventStreamMarshaller({ utf8Encoder: toUtf8, utf8Decoder: fromUtf8 });
  const messages = frames.map(encodeFrame);
  const serialized = marshaller.serialize(
    (async function* () {
      yield* messages;
    })(),
    (msg: any) => msg,
  );
  return Readable.toWeb(Readable.from(serialized)) as ReadableStream;
}

function eventStreamResponse(frames: Frame[], init: ResponseInit = {}): Response {
  return new Response(encodeFrames(frames), {
    status: 200,
    headers: { 'content-type': 'application/vnd.amazon.eventstream' },
    ...init,
  });
}

async function consume(response: Response): Promise<{ events: any[]; caught: unknown }> {
  const events: any[] = [];
  try {
    for await (const event of Stream.fromSSEResponse<any>(response, new AbortController())) {
      events.push(event);
    }
  } catch (caught) {
    return { events, caught };
  }
  return { events, caught: undefined };
}

describe('eventStreamToSSEResponse', () => {
  test('transcodes chunk frames into SSE frames named by the payload type', async () => {
    const response = eventStreamToSSEResponse(
      eventStreamResponse([
        { eventType: 'chunk', payload: { type: 'message_start', message: { id: 'msg_1' } } },
        { eventType: 'chunk', payload: { type: 'message_stop' } },
      ]),
    );

    const text = await response.text();
    expect(text).toEqual(
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1"}}\n\n' +
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    );
  });

  test('the core SSE Stream consumes the transcoded response', async () => {
    const response = eventStreamToSSEResponse(
      eventStreamResponse([
        {
          eventType: 'chunk',
          payload: { type: 'message_start', message: { id: 'msg_1', role: 'assistant' } },
        },
        { eventType: 'chunk', payload: { type: 'message_stop' } },
      ]),
    );

    const events: any[] = [];
    for await (const event of Stream.fromSSEResponse<any>(response, new AbortController())) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(['message_start', 'message_stop']);
  });

  test('throws APIError when a chunk frame contains an Anthropic error payload', async () => {
    const response = eventStreamToSSEResponse(
      eventStreamResponse([
        {
          eventType: 'chunk',
          payload: { type: 'error', error: { type: 'overloaded_error', message: 'test' } },
        },
      ]),
    );
    const stream = Stream.fromSSEResponse(response, new AbortController());

    let caught: unknown;
    try {
      for await (const _ of stream) {
        // consume
      }
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(APIError);
    expect(String(caught)).not.toContain('Unexpected event order');
    expect((caught as APIError).type).toBe('overloaded_error');
  });

  test('drops chunk frames without a type instead of failing the stream', async () => {
    const response = eventStreamToSSEResponse(
      eventStreamResponse([
        { eventType: 'chunk', payload: {} },
        { eventType: 'chunk', payload: { type: 'message_stop' } },
      ]),
    );

    const text = await response.text();
    expect(text).toEqual('event: message_stop\ndata: {"type":"message_stop"}\n\n');
  });

  test.each([
    'internalServerException',
    'modelStreamErrorException',
    'validationException',
    'throttlingException',
    'modelTimeoutException',
    'serviceUnavailableException',
  ])('throws APIError after the preceding events on a %s frame', async (exceptionType) => {
    const response = eventStreamToSSEResponse(
      eventStreamResponse([
        { eventType: 'chunk', payload: { type: 'message_start', message: { id: 'msg_1' } } },
        { exceptionType, payload: { message: 'Too many requests' } },
      ]),
    );

    const { events, caught } = await consume(response);

    expect(events.map((event) => event.type)).toEqual(['message_start']);
    expect(caught).toBeInstanceOf(APIError);
    expect((caught as APIError).type).toBe(exceptionType);
    expect((caught as APIError).error).toEqual({
      type: 'error',
      error: { type: exceptionType, message: 'Too many requests' },
    });
  });

  test('throws APIError after the preceding events on an error frame', async () => {
    const response = eventStreamToSSEResponse(
      eventStreamResponse([
        { eventType: 'chunk', payload: { type: 'message_start', message: { id: 'msg_1' } } },
        { errorCode: 'InternalFailure', errorMessage: 'Something went wrong' },
      ]),
    );

    const { events, caught } = await consume(response);

    expect(events.map((event) => event.type)).toEqual(['message_start']);
    expect(caught).toBeInstanceOf(APIError);
    expect((caught as APIError).type).toBe('InternalFailure');
    expect((caught as APIError).error).toEqual({
      type: 'error',
      error: { type: 'InternalFailure', message: 'Something went wrong' },
    });
  });

  test('rethrows errors that do not come from a frame', async () => {
    const wire = eventStreamResponse([{ eventType: 'chunk', payload: { type: 'message_stop' } }]);
    const truncated = (await wire.arrayBuffer()).slice(0, -4);

    const { caught } = await consume(eventStreamToSSEResponse(new Response(truncated)));

    expect(caught).not.toBeInstanceOf(APIError);
    expect(String(caught)).toContain('Truncated event message received');
  });

  test('preserves status, headers, and url, and sets an SSE content type', () => {
    const wireResponse = eventStreamResponse([], { headers: { 'request-id': 'req_1' } });
    Object.defineProperty(wireResponse, 'url', {
      value: 'https://bedrock-runtime.us-east-1.amazonaws.com/x',
    });

    const response = eventStreamToSSEResponse(wireResponse);

    expect(response.status).toBe(200);
    expect(response.url).toBe('https://bedrock-runtime.us-east-1.amazonaws.com/x');
    expect(response.headers.get('request-id')).toBe('req_1');
    expect(response.headers.get('content-type')).toContain('text/event-stream');
  });
});

describe('streaming through the Bedrock client', () => {
  test('middleware and the caller both observe normalized SSE events', async () => {
    const chunkFrames: Frame[] = [
      { eventType: 'chunk', payload: { type: 'message_start', message: { id: 'msg_1', role: 'assistant' } } },
      { eventType: 'chunk', payload: { type: 'message_stop' } },
    ];
    const observed: { contentType?: string | null; events?: any[] } = {};
    const middleware: Middleware = async (request, next, ctx) => {
      const response = await next(request);
      observed.contentType = response.headers.get('content-type');
      observed.events = [];
      for await (const event of await ctx.parse<AsyncIterable<any>>(response)) {
        observed.events.push(event);
      }
      return response;
    };

    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
      skipAuth: true,
      fetch: async () => eventStreamResponse(chunkFrames),
      middleware: [middleware],
    });

    const stream = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ content: 'Hello', role: 'user' }],
      stream: true,
    });
    const events: any[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(observed.contentType).toContain('text/event-stream');
    expect(observed.events!.map((event) => event.type)).toEqual(['message_start', 'message_stop']);
    expect(events.map((event) => event.type)).toEqual(['message_start', 'message_stop']);
  });
});
