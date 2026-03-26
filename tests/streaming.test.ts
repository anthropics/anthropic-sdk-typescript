import assert from 'assert';
import { Stream, _iterSSEMessages } from '@anthropic-ai/sdk/core/streaming';
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

// =====================================================================
// Tests for empty SSE data handling (fixes #292 regression, #861)
//
// In edge/cloud environments (Vercel Edge, Cloudflare Workers), network
// proxies and CDNs can split SSE chunks so that an event line arrives
// without its corresponding data line. The SSEDecoder correctly produces
// an event with data='', but Stream.fromSSEResponse must not crash when
// trying to JSON.parse('').
// =====================================================================

describe('Stream.fromSSEResponse — empty data resilience', () => {
  /**
   * Helper: collects all items from a Stream into an array.
   */
  async function collect<T>(stream: Stream<T>): Promise<T[]> {
    const items: T[] = [];
    for await (const item of stream) {
      items.push(item);
    }
    return items;
  }

  // -- Per-event-type tests: each Anthropic event type with empty data --

  const messageEventTypes = [
    'message_start',
    'message_delta',
    'message_stop',
    'content_block_start',
    'content_block_delta',
    'content_block_stop',
  ] as const;

  test.each(messageEventTypes)(
    'skips %s event with empty data without crashing',
    async (eventType) => {
      async function* body(): AsyncGenerator<Buffer> {
        // Event with no data line — SSEDecoder will produce data=''
        yield Buffer.from(`event: ${eventType}\n`);
        yield Buffer.from('\n');
      }

      const stream = Stream.fromSSEResponse(
        new Response(ReadableStreamFrom(body())),
        new AbortController(),
      );

      const items = await collect(stream);
      expect(items).toHaveLength(0);
    },
  );

  test('skips completion event with empty data without crashing', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: completion\n');
      yield Buffer.from('\n');
    }

    const stream = Stream.fromSSEResponse(
      new Response(ReadableStreamFrom(body())),
      new AbortController(),
    );

    const items = await collect(stream);
    expect(items).toHaveLength(0);
  });

  // -- Stream continues after empty-data events --

  test('stream continues processing valid events after empty-data event', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      // First: empty content_block_delta (should be skipped)
      yield Buffer.from('event: content_block_delta\n');
      yield Buffer.from('\n');
      // Second: valid content_block_delta (should be yielded)
      yield Buffer.from('event: content_block_delta\n');
      yield Buffer.from('data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n');
      yield Buffer.from('\n');
    }

    const stream = Stream.fromSSEResponse(
      new Response(ReadableStreamFrom(body())),
      new AbortController(),
    );

    const items = await collect(stream);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Hi' },
    });
  });

  test('multiple empty-data events interleaved with valid events', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      // valid message_start
      yield Buffer.from('event: message_start\n');
      yield Buffer.from('data: {"type":"message_start","message":{"id":"msg_1"}}\n');
      yield Buffer.from('\n');
      // empty content_block_start (skip)
      yield Buffer.from('event: content_block_start\n');
      yield Buffer.from('\n');
      // empty content_block_delta (skip)
      yield Buffer.from('event: content_block_delta\n');
      yield Buffer.from('\n');
      // valid content_block_delta
      yield Buffer.from('event: content_block_delta\n');
      yield Buffer.from('data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"OK"}}\n');
      yield Buffer.from('\n');
      // empty message_stop (skip)
      yield Buffer.from('event: message_stop\n');
      yield Buffer.from('\n');
    }

    const stream = Stream.fromSSEResponse(
      new Response(ReadableStreamFrom(body())),
      new AbortController(),
    );

    const items = await collect(stream);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ type: 'message_start', message: { id: 'msg_1' } });
    expect(items[1]).toEqual({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'OK' },
    });
  });

  // -- Full realistic stream with some empty events --

  test('realistic stream with empty events from edge environment', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      // Simulate what Vercel Edge / Cloudflare Workers might produce:
      // Some events arrive correctly, others lose their data due to chunking

      yield Buffer.from('event: message_start\n');
      yield Buffer.from('data: {"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","content":[],"model":"claude-3-5-sonnet-20241022","stop_reason":null}}\n');
      yield Buffer.from('\n');

      yield Buffer.from('event: content_block_start\n');
      yield Buffer.from('data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n');
      yield Buffer.from('\n');

      // Empty delta from network split
      yield Buffer.from('event: content_block_delta\n');
      yield Buffer.from('\n');

      // Valid delta
      yield Buffer.from('event: content_block_delta\n');
      yield Buffer.from('data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n');
      yield Buffer.from('\n');

      yield Buffer.from('event: content_block_stop\n');
      yield Buffer.from('data: {"type":"content_block_stop","index":0}\n');
      yield Buffer.from('\n');

      // Empty message_delta from network split
      yield Buffer.from('event: message_delta\n');
      yield Buffer.from('\n');

      yield Buffer.from('event: message_stop\n');
      yield Buffer.from('data: {"type":"message_stop"}\n');
      yield Buffer.from('\n');
    }

    const stream = Stream.fromSSEResponse(
      new Response(ReadableStreamFrom(body())),
      new AbortController(),
    );

    const items = await collect(stream);
    // Should have 5 valid events (2 empty ones skipped)
    expect(items).toHaveLength(5);
    expect(items.map((i: any) => i.type)).toEqual([
      'message_start',
      'content_block_start',
      'content_block_delta',
      'content_block_stop',
      'message_stop',
    ]);
  });

  // -- Ping events still work --

  test('ping events with empty data are handled correctly', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: ping\n');
      yield Buffer.from('\n');
      yield Buffer.from('event: content_block_delta\n');
      yield Buffer.from('data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n');
      yield Buffer.from('\n');
    }

    const stream = Stream.fromSSEResponse(
      new Response(ReadableStreamFrom(body())),
      new AbortController(),
    );

    const items = await collect(stream);
    expect(items).toHaveLength(1);
    expect((items[0] as any).type).toBe('content_block_delta');
  });

  // -- Error events still work correctly --

  test('error event with empty data still throws', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: error\n');
      yield Buffer.from('data: {"type":"error","error":{"type":"api_error","message":"test"}}\n');
      yield Buffer.from('\n');
    }

    const stream = Stream.fromSSEResponse(
      new Response(ReadableStreamFrom(body())),
      new AbortController(),
    );

    await expect(collect(stream)).rejects.toBeInstanceOf(APIError);
  });

  test('error event with empty data throws with empty message', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: error\n');
      yield Buffer.from('\n');
    }

    const stream = Stream.fromSSEResponse(
      new Response(ReadableStreamFrom(body())),
      new AbortController(),
    );

    await expect(collect(stream)).rejects.toBeInstanceOf(APIError);
  });

  // -- Abort / break still works with empty events --

  test('abort controller works mid-stream with empty events', async () => {
    const controller = new AbortController();

    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: content_block_delta\n');
      yield Buffer.from('\n'); // empty, skipped
      yield Buffer.from('event: content_block_delta\n');
      yield Buffer.from('data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"A"}}\n');
      yield Buffer.from('\n');
      // Simulate more data that won't be consumed
      yield Buffer.from('event: content_block_delta\n');
      yield Buffer.from('data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"B"}}\n');
      yield Buffer.from('\n');
    }

    const stream = Stream.fromSSEResponse(
      new Response(ReadableStreamFrom(body())),
      controller,
    );

    // Abort should not crash the stream even when empty events are present.
    // Note: due to async buffering, the stream may process events that were
    // already yielded before the abort signal propagates.
    const items: any[] = [];
    for await (const item of stream) {
      items.push(item);
      if (items.length >= 1) {
        controller.abort();
      }
    }

    // At minimum, the first valid event was received; the stream did not crash
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].delta.text).toBe('A');
  });

  // -- Stream with only empty events --

  test('stream with only empty events completes without error', async () => {
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: message_start\n');
      yield Buffer.from('\n');
      yield Buffer.from('event: content_block_start\n');
      yield Buffer.from('\n');
      yield Buffer.from('event: content_block_delta\n');
      yield Buffer.from('\n');
      yield Buffer.from('event: content_block_stop\n');
      yield Buffer.from('\n');
      yield Buffer.from('event: message_stop\n');
      yield Buffer.from('\n');
    }

    const stream = Stream.fromSSEResponse(
      new Response(ReadableStreamFrom(body())),
      new AbortController(),
    );

    const items = await collect(stream);
    expect(items).toHaveLength(0);
  });

  // -- Many rapid events (stress test) --

  test('handles many events with intermittent empty data (stress)', async () => {
    const count = 100;
    async function* body(): AsyncGenerator<Buffer> {
      yield Buffer.from('event: message_start\n');
      yield Buffer.from('data: {"type":"message_start","message":{"id":"msg_stress"}}\n');
      yield Buffer.from('\n');

      for (let i = 0; i < count; i++) {
        if (i % 3 === 0) {
          // Every 3rd event has empty data
          yield Buffer.from('event: content_block_delta\n');
          yield Buffer.from('\n');
        } else {
          yield Buffer.from('event: content_block_delta\n');
          yield Buffer.from(`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"${i}"}}\n`);
          yield Buffer.from('\n');
        }
      }

      yield Buffer.from('event: message_stop\n');
      yield Buffer.from('data: {"type":"message_stop"}\n');
      yield Buffer.from('\n');
    }

    const stream = Stream.fromSSEResponse(
      new Response(ReadableStreamFrom(body())),
      new AbortController(),
    );

    const items = await collect(stream);
    // message_start + non-empty deltas + message_stop
    // Non-empty: count - Math.ceil(count/3) = 100 - 34 = 66
    const expectedDeltas = count - Math.ceil(count / 3);
    expect(items).toHaveLength(1 + expectedDeltas + 1); // message_start + deltas + message_stop
  });
});
