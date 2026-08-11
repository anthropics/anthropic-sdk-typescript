import Anthropic, { APIConnectionError, APIUserAbortError } from '@anthropic-ai/sdk';
import { Message, MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';
import * as partialJsonParser from '@anthropic-ai/sdk/_vendor/partial-json-parser/parser';
import { mockFetch } from '../lib/mock-fetch';
import { loadFixture, parseSSEFixture } from '../lib/sse-helpers';

// The swc-compiled module exports are non-configurable, so `jest.spyOn` can't patch
// `partialParse`; wrap the real implementation in a `jest.fn` to count calls instead.
jest.mock('@anthropic-ai/sdk/_vendor/partial-json-parser/parser', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk/_vendor/partial-json-parser/parser');
  return { ...actual, partialParse: jest.fn(actual.partialParse) };
});

function assertNever(x: never): never {
  throw new Error(`unreachable: ${x}`);
}

const EXPECTED_BASIC_MESSAGE = {
  id: 'msg_4QpJur2dWWDjF6C758FbBw5vm12BaVipnK',
  model: 'claude-opus-4-8',
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
  model: 'claude-opus-4-8',
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
      model: 'claude-opus-4-8',
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
      model: 'claude-opus-4-8',
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
      model: 'claude-opus-4-8',
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

  it('parses tool input lazily — once per block, not per delta', async () => {
    const partialParse = jest.mocked(partialJsonParser.partialParse);
    partialParse.mockClear();
    const { fetch, handleStreamEvents } = mockFetch();
    const anthropic = new Anthropic({ apiKey: '...', fetch });

    handleStreamEvents(await parseSSEFixture(loadFixture('tool_use_response.txt')));

    const stream = anthropic.messages.stream({
      max_tokens: 1024,
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
    });

    const finalMessage = await stream.finalMessage();

    expect(finalMessage.content[1]).toEqual({
      type: 'tool_use',
      id: 'toolu_01NRLabsLyVHZPKxbKvkfSMn',
      name: 'get_weather',
      input: { location: 'Paris' },
    });
    // `.input` is a plain data property on the finished block, not a getter.
    expect(Object.getOwnPropertyDescriptor(finalMessage.content[1], 'input')?.get).toBeUndefined();
    // Fixture has five input_json_delta events; only the content_block_stop parse runs.
    expect(partialParse).toHaveBeenCalledTimes(1);
  });

  it('still emits per-delta inputJson snapshots when subscribed', async () => {
    const partialParse = jest.mocked(partialJsonParser.partialParse);
    partialParse.mockClear();
    const { fetch, handleStreamEvents } = mockFetch();
    const anthropic = new Anthropic({ apiKey: '...', fetch });

    handleStreamEvents(await parseSSEFixture(loadFixture('tool_use_response.txt')));

    const stream = anthropic.messages.stream({
      max_tokens: 1024,
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
    });

    const snapshots: unknown[] = [];
    stream.on('inputJson', (_delta, snapshot) => snapshots.push(snapshot));

    await stream.finalMessage();

    expect(snapshots).toHaveLength(5);
    expect(snapshots).toMatchInlineSnapshot(`
[
  {},
  {},
  {},
  {},
  {
    "location": "Paris",
  },
]
`);
    expect(snapshots.at(-1)).toEqual({ location: 'Paris' });
    // Four non-empty deltas parsed; the final block's cached getter is reused
    // at content_block_stop, so no extra parse there.
    expect(partialParse).toHaveBeenCalledTimes(4);
  });

  it('applies every message_delta field onto the accumulated message', async () => {
    const { fetch, handleStreamEvents } = mockFetch();
    const anthropic = new Anthropic({ apiKey: '...', fetch });

    handleStreamEvents([
      {
        type: 'message_start',
        message: {
          id: 'msg_delta_01',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-opus-4-8',
          stop_reason: null,
          stop_sequence: null,
          container: null,
          usage: {
            input_tokens: 10,
            output_tokens: 1,
            cache_creation_input_tokens: 2,
            cache_read_input_tokens: 3,
            cache_creation: { ephemeral_5m_input_tokens: 2, ephemeral_1h_input_tokens: 0 },
            service_tier: 'standard',
          },
        },
      },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Done.' } },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: {
          stop_reason: 'end_turn',
          stop_sequence: null,
          stop_details: null,
          container: { id: 'container_01', expires_at: '2026-01-01T00:00:00Z' },
        },
        usage: {
          input_tokens: 42,
          output_tokens: 99,
          cache_creation_input_tokens: 7,
          cache_read_input_tokens: 8,
          server_tool_use: { web_search_requests: 1, web_fetch_requests: 2 },
          output_tokens_details: { thinking_tokens: 30 },
        },
      },
      { type: 'message_stop' },
    ]);

    const stream = anthropic.messages.stream({
      max_tokens: 1024,
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'Run some code.' }],
    });

    const finalMessage = await stream.finalMessage();

    expect(finalMessage.container).toEqual({ id: 'container_01', expires_at: '2026-01-01T00:00:00Z' });
    expect(finalMessage.usage).toMatchObject({
      input_tokens: 42,
      output_tokens: 99,
      cache_creation_input_tokens: 7,
      cache_read_input_tokens: 8,
      server_tool_use: { web_search_requests: 1, web_fetch_requests: 2 },
      output_tokens_details: { thinking_tokens: 30 },
      // never re-sent on message_delta
      cache_creation: { ephemeral_5m_input_tokens: 2, ephemeral_1h_input_tokens: 0 },
      service_tier: 'standard',
    });
  });

  it('keeps message_start usage when message_delta omits the optional keys', async () => {
    const { fetch, handleStreamEvents } = mockFetch();
    const anthropic = new Anthropic({ apiKey: '...', fetch });

    handleStreamEvents([
      {
        type: 'message_start',
        message: {
          id: 'msg_delta_02',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-opus-4-8',
          stop_reason: null,
          stop_sequence: null,
          container: null,
          usage: {
            input_tokens: 10,
            output_tokens: 1,
            cache_creation_input_tokens: 2,
            cache_read_input_tokens: 3,
            cache_creation: { ephemeral_5m_input_tokens: 2, ephemeral_1h_input_tokens: 0 },
            service_tier: 'standard',
          },
        },
      },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi.' } },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 12 },
      },
      { type: 'message_stop' },
    ]);

    const stream = anthropic.messages.stream({
      max_tokens: 1024,
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'Say hi.' }],
    });

    const finalMessage = await stream.finalMessage();

    expect(finalMessage.usage).toMatchObject({
      input_tokens: 10,
      output_tokens: 12,
      cache_creation_input_tokens: 2,
      cache_read_input_tokens: 3,
      cache_creation: { ephemeral_5m_input_tokens: 2, ephemeral_1h_input_tokens: 0 },
      service_tier: 'standard',
    });
    expect(finalMessage.container).toBeNull();
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
          model: 'claude-opus-4-8',
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
});
