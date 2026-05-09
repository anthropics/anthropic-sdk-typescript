import Anthropic, { APIConnectionError, APIUserAbortError } from '@anthropic-ai/sdk';
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

  describe('state cleanup and caching after end', () => {
    it('finalMessage() resolves via cache after receivedMessages is cleared', async () => {
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

      await stream.done();

      // receivedMessages is cleared after end — finalMessage() must use the cache
      expect(stream.receivedMessages).toHaveLength(0);
      const msg = await stream.finalMessage();
      expect(msg).toMatchObject(EXPECTED_BASIC_MESSAGE);
    });

    it('finalText() resolves via cache after end fires', async () => {
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

      await stream.done();
      expect(await stream.finalText()).toBe('Hello there!');
    });

    it('clears receivedMessages and messages after end to prevent memory leaks', async () => {
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

      // Capture array lengths from within the finalMessage listener (fires before end cleanup)
      let messagesLengthBeforeCleanup = -1;
      let receivedMessagesLengthBeforeCleanup = -1;
      stream.on('finalMessage', () => {
        messagesLengthBeforeCleanup = stream.messages.length;
        receivedMessagesLengthBeforeCleanup = stream.receivedMessages.length;
      });

      await stream.done();

      // Arrays were populated before cleanup fired
      expect(messagesLengthBeforeCleanup).toBeGreaterThan(0);
      expect(receivedMessagesLengthBeforeCleanup).toBeGreaterThan(0);

      // Arrays are cleared after end fires
      expect(stream.messages).toHaveLength(0);
      expect(stream.receivedMessages).toHaveLength(0);
    });

    it('finalMessage listener receives message before arrays are cleared', async () => {
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

      let messageInListener: Message | undefined;
      stream.on('finalMessage', (msg) => {
        messageInListener = msg;
      });

      await stream.done();

      expect(messageInListener).toMatchObject(EXPECTED_BASIC_MESSAGE);
      // Cache still works after end
      expect(await stream.finalMessage()).toMatchObject(EXPECTED_BASIC_MESSAGE);
    });
  });
});
