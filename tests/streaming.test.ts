import assert from 'assert';
import { Stream, _iterSSEMessages, StreamIdleTimeoutError } from '@anthropic-ai/sdk/core/streaming';
import { APIError } from '@anthropic-ai/sdk/core/error';
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
    `[Error: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}]`,
  );
  await err.toBeInstanceOf(APIError);
});

describe('idle timeout', () => {
  test('throws StreamIdleTimeoutError when stream stalls', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: message_start\n');
      yield Buffer.from('data: {"type":"message_start"}\n');
      yield Buffer.from('\n');
      // Simulate a stall — no more data arrives
      await new Promise((resolve) => setTimeout(resolve, 5000));
      yield Buffer.from('event: message_delta\n');
      yield Buffer.from('data: {"type":"message_delta"}\n');
      yield Buffer.from('\n');
    }

    const controller = new AbortController();
    const stream = Stream.fromSSEResponse<any>(
      new Response(ReadableStreamFrom(body())),
      controller,
      undefined,
      { idleTimeout: 100 },
    );

    const items: any[] = [];
    await expect(
      (async () => {
        for await (const item of stream) {
          items.push(item);
        }
      })(),
    ).rejects.toThrow(StreamIdleTimeoutError);

    // Should have received the first event before the stall
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('message_start');
    // Controller should be aborted
    expect(controller.signal.aborted).toBe(true);
  });

  test('does not time out when data arrives within threshold', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: message_start\n');
      yield Buffer.from('data: {"type":"message_start"}\n');
      yield Buffer.from('\n');
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield Buffer.from('event: content_block_start\n');
      yield Buffer.from('data: {"type":"content_block_start"}\n');
      yield Buffer.from('\n');
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield Buffer.from('event: message_stop\n');
      yield Buffer.from('data: {"type":"message_stop"}\n');
      yield Buffer.from('\n');
    }

    const controller = new AbortController();
    const stream = Stream.fromSSEResponse<any>(
      new Response(ReadableStreamFrom(body())),
      controller,
      undefined,
      { idleTimeout: 500 },
    );

    const items: any[] = [];
    for await (const item of stream) {
      items.push(item);
    }

    expect(items).toHaveLength(3);
    expect(controller.signal.aborted).toBe(false);
  });

  test('works without idleTimeout (default behavior unchanged)', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: completion\n');
      yield Buffer.from('data: {"foo":true}\n');
      yield Buffer.from('\n');
    }

    const controller = new AbortController();
    const stream = Stream.fromSSEResponse<any>(
      new Response(ReadableStreamFrom(body())),
      controller,
    );

    const items: any[] = [];
    for await (const item of stream) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ foo: true });
  });

  test('StreamIdleTimeoutError is an instance of AnthropicError', () => {
    const err = new StreamIdleTimeoutError(5000);
    expect(err).toBeInstanceOf(StreamIdleTimeoutError);
    expect(err.message).toBe('Stream timed out: no data received for 5000ms');
  });
});
