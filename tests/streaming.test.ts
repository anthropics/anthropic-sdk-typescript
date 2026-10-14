import assert from 'assert';
import { Stream, _iterSSEMessages } from '@anthropic-ai/sdk/core/streaming';
import { APIError, InternalServerError, RateLimitError } from '@anthropic-ai/sdk/core/error';
import { ReadableStreamFrom } from '@anthropic-ai/sdk/internal/shims';

describe('streaming decoding', () => {
  test('basic', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: completion\n');
      yield Buffer.from('data: {"foo":true}\n');
      yield Buffer.from('\n');
    }

    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), new AbortController())[
      Symbol.asyncIterator
    ]();

    let event = await stream.next();
    assert(event.value);
    expect(JSON.parse(event.value.data)).toEqual({ foo: true });

    event = await stream.next();
    expect(event.done).toBeTruthy();
  });

  test('data without event', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('data: {"foo":true}\n');
      yield Buffer.from('\n');
    }

    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), new AbortController())[
      Symbol.asyncIterator
    ]();

    let event = await stream.next();
    assert(event.value);
    expect(event.value.event).toBeNull();
    expect(JSON.parse(event.value.data)).toEqual({ foo: true });

    event = await stream.next();
    expect(event.done).toBeTruthy();
  });

  test('event without data', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: foo\n');
      yield Buffer.from('\n');
    }

    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), new AbortController())[
      Symbol.asyncIterator
    ]();

    let event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('foo');
    expect(event.value.data).toEqual('');

    event = await stream.next();
    expect(event.done).toBeTruthy();
  });

  test('multiple events', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: foo\n');
      yield Buffer.from('\n');
      yield Buffer.from('event: ping\n');
      yield Buffer.from('\n');
    }

    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), new AbortController())[
      Symbol.asyncIterator
    ]();

    let event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('foo');
    expect(event.value.data).toEqual('');

    event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('ping');
    expect(event.value.data).toEqual('');

    event = await stream.next();
    expect(event.done).toBeTruthy();
  });

  test('multiple events with data', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: foo\n');
      yield Buffer.from('data: {"foo":true}\n');
      yield Buffer.from('\n');
      yield Buffer.from('event: ping\n');
      yield Buffer.from('data: {"bar":false}\n');
      yield Buffer.from('\n');
    }

    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), new AbortController())[
      Symbol.asyncIterator
    ]();

    let event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('foo');
    expect(JSON.parse(event.value.data)).toEqual({ foo: true });

    event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('ping');
    expect(JSON.parse(event.value.data)).toEqual({ bar: false });

    event = await stream.next();
    expect(event.done).toBeTruthy();
  });

  test('multiple events in one chunk', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: a\ndata: {"i":1}\n\nevent: b\ndata: {"i":2}\n\nevent: c\n');
      yield Buffer.from('data: {"i":3}\n\n');
    }

    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), new AbortController())[
      Symbol.asyncIterator
    ]();

    let event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('a');
    expect(JSON.parse(event.value.data)).toEqual({ i: 1 });

    event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('b');
    expect(JSON.parse(event.value.data)).toEqual({ i: 2 });

    event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('c');
    expect(JSON.parse(event.value.data)).toEqual({ i: 3 });

    event = await stream.next();
    expect(event.done).toBeTruthy();
  });

  test('multiple data lines with empty line', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: ping\n');
      yield Buffer.from('data: {\n');
      yield Buffer.from('data: "foo":\n');
      yield Buffer.from('data: \n');
      yield Buffer.from('data:\n');
      yield Buffer.from('data: true}\n');
      yield Buffer.from('\n\n');
    }

    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), new AbortController())[
      Symbol.asyncIterator
    ]();

    let event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('ping');
    expect(JSON.parse(event.value.data)).toEqual({ foo: true });
    expect(event.value.data).toEqual('{\n"foo":\n\n\ntrue}');

    event = await stream.next();
    expect(event.done).toBeTruthy();
  });

  test('data json escaped double new line', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: ping\n');
      yield Buffer.from('data: {"foo": "my long\\n\\ncontent"}');
      yield Buffer.from('\n\n');
    }

    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), new AbortController())[
      Symbol.asyncIterator
    ]();

    let event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('ping');
    expect(JSON.parse(event.value.data)).toEqual({ foo: 'my long\n\ncontent' });

    event = await stream.next();
    expect(event.done).toBeTruthy();
  });

  test('special new line characters', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('data: {"content": "culpa "}\n');
      yield Buffer.from('\n');
      yield Buffer.from('data: {"content": "');
      yield Buffer.from([0xe2, 0x80, 0xa8]);
      yield Buffer.from('"}\n');
      yield Buffer.from('\n');
      yield Buffer.from('data: {"content": "foo"}\n');
      yield Buffer.from('\n');
    }

    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), new AbortController())[
      Symbol.asyncIterator
    ]();

    let event = await stream.next();
    assert(event.value);
    expect(JSON.parse(event.value.data)).toEqual({ content: 'culpa ' });

    event = await stream.next();
    assert(event.value);
    expect(JSON.parse(event.value.data)).toEqual({ content: Buffer.from([0xe2, 0x80, 0xa8]).toString() });

    event = await stream.next();
    assert(event.value);
    expect(JSON.parse(event.value.data)).toEqual({ content: 'foo' });

    event = await stream.next();
    expect(event.done).toBeTruthy();
  });

  test('multi-byte characters across chunks', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: completion\n');
      yield Buffer.from('data: {"content": "');
      // bytes taken from the string 'известни' and arbitrarily split
      // so that some multi-byte characters span multiple chunks
      yield Buffer.from([0xd0]);
      yield Buffer.from([0xb8, 0xd0, 0xb7, 0xd0]);
      yield Buffer.from([0xb2, 0xd0, 0xb5, 0xd1, 0x81, 0xd1, 0x82, 0xd0, 0xbd, 0xd0, 0xb8]);
      yield Buffer.from('"}\n');
      yield Buffer.from('\n');
    }

    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), new AbortController())[
      Symbol.asyncIterator
    ]();

    let event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('completion');
    expect(JSON.parse(event.value.data)).toEqual({ content: 'известни' });

    event = await stream.next();
    expect(event.done).toBeTruthy();
  });
});

test('error handling', async () => {
  async function* body(): AsyncGenerator<Buffer> {
    yield Buffer.from('event: error\n');
    yield Buffer.from('data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}');
    yield Buffer.from('\n\n');
  }

  const stream = Stream.fromSSEResponse(
    new Response(await ReadableStreamFrom(body())),
    new AbortController(),
  );

  const err = expect(
    (async () => {
      for await (const _event of stream) {
      }
    })(),
  ).rejects;

  await err.toMatchInlineSnapshot(
    `[Error: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}]`,
  );
  await err.toBeInstanceOf(APIError);
});

test('APIError.generate() exposes error type', () => {
  const error = APIError.generate(
    400,
    { type: 'error', error: { type: 'invalid_request_error', message: 'Bad request' } },
    undefined,
    new Headers({ 'request-id': 'req_123' }),
  );
  expect(error.type).toBe('invalid_request_error');
  expect(error.status).toBe(400);
});

test('APIError.generate() sets type to null when absent', () => {
  const error = APIError.generate(500, { message: 'Internal error' }, undefined, new Headers());
  expect(error.type).toBeNull();
});

test('error event exposes error type', async () => {
  async function* body(): AsyncGenerator<Buffer> {
    yield Buffer.from('event: error\n');
    yield Buffer.from('data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}');
    yield Buffer.from('\n\n');
  }

  const stream = Stream.fromSSEResponse(
    new Response(await ReadableStreamFrom(body())),
    new AbortController(),
  );

  try {
    for await (const _event of stream) {
    }
    throw new Error('Expected stream to throw');
  } catch (err) {
    expect(err).toBeInstanceOf(APIError);
    if (err instanceof APIError) {
      expect(err.type).toBe('overloaded_error');
    }
  }
});

test('in-stream error maps error type to HTTP status and specific APIError subclass', async () => {
  async function* body(): AsyncGenerator<Buffer> {
    yield Buffer.from('event: error\n');
    yield Buffer.from('data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}');
    yield Buffer.from('\n\n');
  }

  const stream = Stream.fromSSEResponse(
    new Response(await ReadableStreamFrom(body())),
    new AbortController(),
  );

  try {
    for await (const _event of stream) {
    }
    throw new Error('Expected stream to throw');
  } catch (err: any) {
    expect(err).toBeInstanceOf(InternalServerError);
    expect(err.status).toBe(529);
    expect(err.type).toBe('overloaded_error');
    expect(err.message).toBe(
      '529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
    );
  }
});

test('in-stream error maps rate_limit_error to RateLimitError with status 429', async () => {
  async function* body(): AsyncGenerator<Buffer> {
    yield Buffer.from('event: error\n');
    yield Buffer.from(
      'data: {"type":"error","error":{"type":"rate_limit_error","message":"Rate limit exceeded"}}',
    );
    yield Buffer.from('\n\n');
  }

  const stream = Stream.fromSSEResponse(
    new Response(await ReadableStreamFrom(body())),
    new AbortController(),
  );

  try {
    for await (const _event of stream) {
    }
    throw new Error('Expected stream to throw');
  } catch (err: any) {
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.status).toBe(429);
    expect(err.type).toBe('rate_limit_error');
    expect(err.message).toBe(
      '429 {"type":"error","error":{"type":"rate_limit_error","message":"Rate limit exceeded"}}',
    );
  }
});

test('in-stream error with unrecognized type falls back to base APIError with status undefined', async () => {
  async function* body(): AsyncGenerator<Buffer> {
    yield Buffer.from('event: error\n');
    yield Buffer.from(
      'data: {"type":"error","error":{"type":"unknown_custom_error","message":"Something went wrong"}}',
    );
    yield Buffer.from('\n\n');
  }

  const stream = Stream.fromSSEResponse(
    new Response(await ReadableStreamFrom(body())),
    new AbortController(),
  );

  try {
    for await (const _event of stream) {
    }
    throw new Error('Expected stream to throw');
  } catch (err: any) {
    expect(err).toBeInstanceOf(APIError);
    expect(err.status).toBeUndefined();
    expect(err.type).toBe('unknown_custom_error');
    expect(err.message).toBe(
      '{"type":"error","error":{"type":"unknown_custom_error","message":"Something went wrong"}}',
    );
  }
});
