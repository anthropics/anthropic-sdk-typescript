import assert from 'assert';
import { Stream, _iterSSEMessages } from '@anthropic-ai/sdk/core/streaming';
import { APIError, StreamIdleTimeoutError } from '@anthropic-ai/sdk/core/error';
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
    // Create a stream that sends one event then stalls forever
    async function* stalledBody(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: message_start\n');
      yield Buffer.from('data: {"type":"message_start"}\n');
      yield Buffer.from('\n');
      // Stream stalls here - never sends more data
      await new Promise(() => {}); // Never resolves
    }

    const controller = new AbortController();
    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(stalledBody())), controller, {
      idleTimeout: 50, // 50ms timeout for test speed
    })[Symbol.asyncIterator]();

    // First event should come through
    const event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('message_start');

    // Second call should timeout
    const startTime = Date.now();
    await expect(stream.next()).rejects.toThrow(StreamIdleTimeoutError);
    const elapsed = Date.now() - startTime;

    // Should have waited approximately the idle timeout
    expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    expect(elapsed).toBeLessThan(200); // But not too long
  });

  test('timeout resets on each chunk received', async () => {
    // Create a stream that sends events slowly but consistently
    async function* slowBody(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: message_start\n');
      yield Buffer.from('data: {"type":"message_start"}\n');
      yield Buffer.from('\n');
      await new Promise((resolve) => setTimeout(resolve, 30));
      yield Buffer.from('event: content_block_start\n');
      yield Buffer.from('data: {"type":"content_block_start"}\n');
      yield Buffer.from('\n');
      await new Promise((resolve) => setTimeout(resolve, 30));
      yield Buffer.from('event: message_stop\n');
      yield Buffer.from('data: {"type":"message_stop"}\n');
      yield Buffer.from('\n');
    }

    const controller = new AbortController();
    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(slowBody())), controller, {
      idleTimeout: 100, // 100ms timeout - longer than each individual delay
    })[Symbol.asyncIterator]();

    // All events should come through since we reset timeout on each
    let event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('message_start');

    event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('content_block_start');

    event = await stream.next();
    assert(event.value);
    expect(event.value.event).toEqual('message_stop');

    event = await stream.next();
    expect(event.done).toBeTruthy();
  });

  test('StreamIdleTimeoutError contains diagnostic information', async () => {
    async function* stalledBody(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: message_start\n');
      yield Buffer.from('data: {"type":"message_start"}\n');
      yield Buffer.from('\n');
      yield Buffer.from('event: content_block_start\n');
      yield Buffer.from('data: {"type":"content_block_start"}\n');
      yield Buffer.from('\n');
      // Stall after 2 events
      await new Promise(() => {});
    }

    const controller = new AbortController();
    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(stalledBody())), controller, {
      idleTimeout: 50,
    })[Symbol.asyncIterator]();

    // Consume the two events
    await stream.next();
    await stream.next();

    // Third call should timeout
    try {
      await stream.next();
      fail('Expected StreamIdleTimeoutError');
    } catch (err) {
      expect(err).toBeInstanceOf(StreamIdleTimeoutError);
      const timeoutErr = err as StreamIdleTimeoutError;
      expect(timeoutErr.idleTimeoutMs).toBe(50);
      expect(timeoutErr.eventCount).toBe(2); // We received 2 chunks before timeout
      expect(timeoutErr.lastEventTime).toBeInstanceOf(Date);
      expect(timeoutErr.message).toContain('50ms');
    }
  });

  test('no timeout when idleTimeout is not set', async () => {
    // This test verifies the feature doesn't break existing behavior
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: completion\n');
      yield Buffer.from('data: {"foo":true}\n');
      yield Buffer.from('\n');
    }

    const controller = new AbortController();
    // No idleTimeout option passed
    const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), controller)[
      Symbol.asyncIterator
    ]();

    const event = await stream.next();
    assert(event.value);
    expect(JSON.parse(event.value.data)).toEqual({ foo: true });

    const done = await stream.next();
    expect(done.done).toBeTruthy();
  });

  test('Stream.fromSSEResponse passes idleTimeout through', async () => {
    async function* stalledBody(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: message_start\n');
      yield Buffer.from(
        'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[],"model":"claude","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n',
      );
      yield Buffer.from('\n');
      await new Promise(() => {}); // Stall
    }

    const controller = new AbortController();
    const stream = Stream.fromSSEResponse(
      new Response(ReadableStreamFrom(stalledBody())),
      controller,
      undefined,
      { idleTimeout: 50 },
    );

    const iterator = stream[Symbol.asyncIterator]();
    // First event comes through
    const first = await iterator.next();
    expect(first.done).toBeFalsy();

    // Second call should timeout
    await expect(iterator.next()).rejects.toThrow(StreamIdleTimeoutError);
  });
});
