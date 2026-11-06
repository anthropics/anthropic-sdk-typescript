import assert from 'assert';
import { Stream, _iterSSEMessages, type ServerSentEvent } from '@anthropic-ai/sdk/core/streaming';
import { APIError } from '@anthropic-ai/sdk/core/error';
import { ReadableStreamFrom } from '@anthropic-ai/sdk/internal/shims';

async function decode(body: AsyncGenerator<Buffer>): Promise<ServerSentEvent[]> {
  const events = [];
  for await (const event of _iterSSEMessages(new Response(ReadableStreamFrom(body)), new AbortController())) {
    events.push(event);
  }
  return events;
}

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

  test.each<{ name: string; chunks: string[]; events: ServerSentEvent[] }>([
    {
      name: 'carriage return line ends',
      chunks: ['event: a\rdata: 1\r\r'],
      events: [{ event: 'a', data: '1', raw: ['event: a', 'data: 1'] }],
    },
    {
      name: 'a line end split across chunks',
      chunks: ['event: a\r', '\ndata: 1\r', '\n\r', '\n'],
      events: [{ event: 'a', data: '1', raw: ['event: a', 'data: 1'] }],
    },
    {
      name: 'mixed line ends',
      chunks: ['event: a\r\ndata: 1\rdata: 2\n\r\nevent: b\ndata: 3\n\r'],
      events: [
        { event: 'a', data: '1\n2', raw: ['event: a', 'data: 1', 'data: 2'] },
        { event: 'b', data: '3', raw: ['event: b', 'data: 3'] },
      ],
    },
    {
      name: 'a byte order mark at the start of a line',
      chunks: ['\ufeffdata: 1\n\ufeffdata: 2\n\n'],
      events: [{ event: null, data: '1\n2', raw: ['data: 1', 'data: 2'] }],
    },
    {
      name: 'a field without a colon',
      chunks: ['data\ndata: 1\n\n'],
      events: [{ event: null, data: '\n1', raw: ['data', 'data: 1'] }],
    },
    {
      name: 'a comment before an event',
      chunks: [': keepalive\n\n', 'data: 1\n\n'],
      events: [{ event: null, data: '1', raw: [': keepalive', 'data: 1'] }],
    },
    {
      name: 'unknown fields',
      chunks: ['id: 7\nretry: 10\ndata: 1\n\n'],
      events: [{ event: null, data: '1', raw: ['id: 7', 'retry: 10', 'data: 1'] }],
    },
    {
      name: 'only one leading space is dropped',
      chunks: ['data:  1\ndata:2\n\n'],
      events: [{ event: null, data: ' 1\n2', raw: ['data:  1', 'data:2'] }],
    },
    {
      name: 'an event with no blank line after it',
      chunks: ['data: 1\n\ndata: 2\n'],
      events: [{ event: null, data: '1', raw: ['data: 1'] }],
    },
    {
      name: 'a last line with no line end',
      chunks: ['data: 1\n\ndata: 2'],
      events: [{ event: null, data: '1', raw: ['data: 1'] }],
    },
  ])('$name', async ({ chunks, events }) => {
    async function* body(): AsyncGenerator<Buffer> {
      for (const chunk of chunks) yield Buffer.from(chunk);
    }

    expect(await decode(body())).toEqual(events);
  });

  test('one byte per chunk', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      const bytes = Buffer.from(
        ': известни\r\nevent: a\rdata: {"content": "известни"}\ndata: 2\r\n\r\ndata: 3\n\n',
      );
      for (const byte of bytes) yield Buffer.from([byte]);
    }

    expect(await decode(body())).toEqual([
      {
        event: 'a',
        data: '{"content": "известни"}\n2',
        raw: [': известни', 'event: a', 'data: {"content": "известни"}', 'data: 2'],
      },
      { event: null, data: '3', raw: ['data: 3'] },
    ]);
  });
});

test('skips events without data', async () => {
  async function* body(): AsyncGenerator<Buffer> {
    yield Buffer.from('event: foo\n');
    yield Buffer.from('data: {"foo":true}\n');
    yield Buffer.from('\n');
    yield Buffer.from('event: foo\n');
    yield Buffer.from('\n');
    yield Buffer.from('event: foo\n');
    yield Buffer.from('data:\n');
    yield Buffer.from('\n');
    yield Buffer.from('event: foo\n');
    yield Buffer.from('data: {"bar":false}\n');
    yield Buffer.from('\n');
  }

  const stream = Stream.fromSSEResponse(
    new Response(await ReadableStreamFrom(body())),
    new AbortController(),
  );

  const events: unknown[] = [];
  for await (const event of stream) {
    events.push(event);
  }

  expect(events).toEqual([{ foo: true }, { bar: false }]);
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
    `[APIError: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}]`,
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

test('breaking out of both tee branches leaves the request open and the branches readable', async () => {
  async function* body(): AsyncGenerator<Buffer> {
    yield Buffer.from('event: completion\ndata: {"n":1}\n\n');
    yield Buffer.from('event: completion\ndata: {"n":2}\n\n');
  }

  const controller = new AbortController();
  const [left, right] = Stream.fromSSEResponse<{ n: number }>(
    new Response(await ReadableStreamFrom(body())),
    controller,
  ).tee();
  for await (const _item of left) {
    break;
  }
  for await (const _item of right) {
    break;
  }
  expect(controller.signal.aborted).toBe(false);

  const rest: Array<{ n: number }> = [];
  for await (const item of left) {
    rest.push(item);
  }
  expect(rest).toEqual([{ n: 2 }]);
});
