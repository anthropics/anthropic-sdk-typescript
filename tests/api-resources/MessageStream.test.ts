import Anthropic, { APIConnectionError, APIUserAbortError, StreamIdleTimeoutError } from '@anthropic-ai/sdk';
import { Message, MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';
import { mockFetch } from '../lib/mock-fetch';
import { loadFixture, parseSSEFixture } from '../lib/sse-helpers';

function assertNever(x: never): never {
  throw new Error(`unreachable: ${x}`);
}

const EXPECTED_BASIC_MESSAGE = {
  id: 'msg_4QpJur2dWWDjF6C758FbBw5vm12BaVipnK',
  model: 'claude-opus-4-20250514',
  role: 'assistant',
  stop_reason: 'end_turn',
  stop_sequence: null,
  type: 'message',
  content: [{ type: 'text', text: 'Hello there!' }],
  usage: { input_tokens: 11, output_tokens: 6 },
};

const EXPECTED_BASIC_EVENT_TYPES = [
  'message_start',
  'content_block_start',
  'content_block_delta',
  'content_block_delta',
  'content_block_delta',
  'content_block_stop',
  'message_delta',
  'message_stop',
];

const EXPECTED_TOOL_USE_MESSAGE = {
  id: 'msg_019Q1hrJbZG26Fb9BQhrkHEr',
  model: 'claude-sonnet-4-20250514',
  role: 'assistant',
  stop_reason: 'tool_use',
  stop_sequence: null,
  type: 'message',
  content: [
    { type: 'text', text: "I'll check the current weather in Paris for you." },
    {
      type: 'tool_use',
      id: 'toolu_01NRLabsLyVHZPKxbKvkfSMn',
      name: 'get_weather',
      input: { location: 'Paris' },
    },
  ],
  usage: {
    input_tokens: 377,
    output_tokens: 65,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    service_tier: 'standard',
  },
};

const EXPECTED_TOOL_USE_EVENT_TYPES = [
  'message_start',
  'content_block_start',
  'content_block_delta',
  'content_block_delta',
  'content_block_stop',
  'content_block_start',
  'content_block_delta',
  'content_block_delta',
  'content_block_delta',
  'content_block_delta',
  'content_block_delta',
  'content_block_stop',
  'message_delta',
  'message_stop',
];

function assertBasicResponse(events: MessageStreamEvent[], message: Message) {
  expect(events.map((e) => e.type)).toEqual(EXPECTED_BASIC_EVENT_TYPES);
  expect(message).toMatchObject(EXPECTED_BASIC_MESSAGE);
}

function assertToolUseResponse(events: MessageStreamEvent[], message: Message) {
  expect(events.map((e) => e.type)).toEqual(EXPECTED_TOOL_USE_EVENT_TYPES);
  expect(message).toMatchObject(EXPECTED_TOOL_USE_MESSAGE);
}

describe('MessageStream class', () => {
  it('aborts on break', async () => {
    const { fetch, handleStreamEvents } = mockFetch();

    const anthropic = new Anthropic({ apiKey: '...', fetch });

    const fixtureContent = loadFixture('basic_response.txt');
    const streamEvents = await parseSSEFixture(fixtureContent);
    handleStreamEvents(streamEvents);

    const stream = anthropic.messages.stream({
      max_tokens: 1024,
      model: 'claude-opus-4-20250514',
      messages: [{ role: 'user', content: 'Say hello there!' }],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type == 'text_delta' &&
        event.delta.text.includes('He')
      ) {
        break;
      }
    }

    await expect(async () => stream.done()).rejects.toThrow(APIUserAbortError);

    expect(stream.aborted).toBe(true);
  });

  it('handles network errors', async () => {
    const { fetch, handleRequest } = mockFetch();

    const anthropic = new Anthropic({ apiKey: '...', fetch });

    const stream = anthropic.messages.stream(
      {
        max_tokens: 1024,
        model: 'claude-sonnet-4-5',
        messages: [{ role: 'user', content: 'Say hello there!' }],
      },
      { maxRetries: 0 },
    );

    handleRequest(async () => {
      throw new Error('mock request error');
    });

    async function runStream() {
      await stream.done();
    }

    await expect(runStream).rejects.toThrow(APIConnectionError);
  });

  it('handles network errors on async iterator', async () => {
    const { fetch, handleRequest } = mockFetch();

    const anthropic = new Anthropic({ apiKey: '...', fetch });

    const stream = anthropic.messages.stream(
      {
        max_tokens: 1024,
        model: 'claude-sonnet-4-5',
        messages: [{ role: 'user', content: 'Say hello there!' }],
      },
      { maxRetries: 0 },
    );

    handleRequest(async () => {
      throw new Error('mock request error');
    });

    async function runStream() {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta' &&
          event.delta.text.includes('He')
        ) {
          break;
        }
      }
    }

    await expect(runStream).rejects.toThrow(APIConnectionError);
  });

  it('handles basic response fixture', async () => {
    const { fetch, handleStreamEvents } = mockFetch();

    const anthropic = new Anthropic({ apiKey: '...', fetch });

    const fixtureContent = loadFixture('basic_response.txt');
    const streamEvents = await parseSSEFixture(fixtureContent);
    handleStreamEvents(streamEvents);

    const stream = anthropic.messages.stream({
      max_tokens: 1024,
      model: 'claude-opus-4-20250514',
      messages: [{ role: 'user', content: 'Say hello there!' }],
    });

    const events: MessageStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    await stream.done();
    const finalMessage = await stream.finalMessage();
    const finalText = await stream.finalText();

    assertBasicResponse(events, finalMessage);
    expect(finalText).toBe('Hello there!');
  });

  it('handles tool use response fixture', async () => {
    const { fetch, handleStreamEvents } = mockFetch();

    const anthropic = new Anthropic({ apiKey: '...', fetch });

    const fixtureContent = loadFixture('tool_use_response.txt');
    const streamEvents = await parseSSEFixture(fixtureContent);
    handleStreamEvents(streamEvents);

    const stream = anthropic.messages.stream({
      max_tokens: 1024,
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
    });

    const events: MessageStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    await stream.done();
    const finalMessage = await stream.finalMessage();
    const finalText = await stream.finalText();

    assertToolUseResponse(events, finalMessage);
    expect(finalText).toBe("I'll check the current weather in Paris for you.");
  });

  it('does not throw unhandled rejection with withResponse()', async () => {
    const { fetch, handleRequest } = mockFetch();
    const anthropic = new Anthropic({
      apiKey: 'test-key',
      fetch,
      defaultHeaders: {
        'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
      },
    });
    const stream = anthropic.messages
      .stream(
        {
          max_tokens: 1024,
          model: 'claude-sonnet-4-0',
          messages: [{ role: 'user', content: 'Say hello there!' }],
        },
        { maxRetries: 0 },
      )
      .withResponse();

    handleRequest(async () => {
      throw new Error('mock request error');
    });
    await expect(stream).rejects.toThrow(APIConnectionError);
  });

  describe('idle timeout integration', () => {
    it('throws StreamIdleTimeoutError when stream stalls via request options', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      // Create a stream that sends one event then stalls
      handleRequest(async () => {
        const { PassThrough } = await import('stream');
        const stream = new PassThrough();

        // Send one event then stall
        stream.write('event: message_start\n');
        stream.write(
          'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[],"model":"claude","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n\n',
        );
        // Don't end the stream - it will stall

        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });

      const stream = anthropic.messages.stream(
        {
          max_tokens: 1024,
          model: 'claude-opus-4-20250514',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        { idleTimeout: 50 }, // 50ms timeout
      );

      await expect(stream.finalMessage()).rejects.toThrow(StreamIdleTimeoutError);
    });

    it('throws StreamIdleTimeoutError when stream stalls via client default', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({
        apiKey: 'test-key',
        fetch,
        idleTimeout: 50, // Default idle timeout for all requests
      });

      // Create a stream that sends one event then stalls
      handleRequest(async () => {
        const { PassThrough } = await import('stream');
        const stream = new PassThrough();

        stream.write('event: message_start\n');
        stream.write(
          'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[],"model":"claude","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n\n',
        );
        // Stall

        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });

      const stream = anthropic.messages.stream({
        max_tokens: 1024,
        model: 'claude-opus-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      await expect(stream.finalMessage()).rejects.toThrow(StreamIdleTimeoutError);
    });

    it('request idleTimeout overrides client default', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({
        apiKey: 'test-key',
        fetch,
        idleTimeout: 10, // Very short default that would timeout
      });

      // Create a slow but completing stream
      handleRequest(async () => {
        const { PassThrough } = await import('stream');
        const stream = new PassThrough();

        (async () => {
          stream.write('event: message_start\n');
          stream.write(
            'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[],"model":"claude","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n\n',
          );
          await new Promise((r) => setTimeout(r, 30)); // 30ms delay
          stream.write('event: message_stop\n');
          stream.write('data: {"type":"message_stop"}\n\n');
          stream.end();
        })();

        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });

      // Override with longer timeout
      const stream = anthropic.messages.stream(
        {
          max_tokens: 1024,
          model: 'claude-opus-4-20250514',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        { idleTimeout: 100 }, // Override with longer timeout
      );

      // Should complete successfully despite client's short default
      const events: MessageStreamEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }
      expect(events.length).toBe(2);
    });

    it('stream completes normally when data arrives before timeout', async () => {
      const { fetch, handleStreamEvents } = mockFetch();
      const anthropic = new Anthropic({
        apiKey: 'test-key',
        fetch,
        idleTimeout: 1000, // Long timeout
      });

      const fixtureContent = loadFixture('basic_response.txt');
      const streamEvents = await parseSSEFixture(fixtureContent);
      handleStreamEvents(streamEvents);

      const stream = anthropic.messages.stream({
        max_tokens: 1024,
        model: 'claude-opus-4-20250514',
        messages: [{ role: 'user', content: 'Say hello there!' }],
      });

      const events: MessageStreamEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      const message = await stream.finalMessage();
      assertBasicResponse(events, message);
    });
  });
});
