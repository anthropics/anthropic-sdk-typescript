import Anthropic, { APIConnectionError, APIUserAbortError } from '@anthropic-ai/sdk';
import { AnthropicError } from '@anthropic-ai/sdk/error';
import { BetaMessage, BetaRawMessageStreamEvent } from '@anthropic-ai/sdk/resources/beta/messages';
import { mockFetch } from '../lib/mock-fetch';
import { loadFixture, parseSSEFixture } from '../lib/sse-helpers';

function assertNever(x: never): never {
  throw new Error(`unreachable: ${x}`);
}

// Expected message fixtures
const EXPECTED_BASIC_MESSAGE = {
  id: 'msg_4QpJur2dWWDjF6C758FbBw5vm12BaVipnK',
  model: 'claude-3-opus-20240229',
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

const EXPECTED_INCOMPLETE_MESSAGE = {
  id: 'msg_01UdjYBBipA9omjYhicnevgq',
  model: 'claude-3-7-sonnet-20250219',
  role: 'assistant',
  stop_reason: 'max_tokens',
  stop_sequence: null,
  type: 'message',
  content: [
    {
      type: 'text',
      text: "I'll create a comprehensive tax guide for someone with multiple W2s and save it in a file called taxes.txt. Let me do that for you now.",
    },
    {
      type: 'tool_use',
      id: 'toolu_01EKqbqmZrGRXy18eN7m9kvY',
      name: 'make_file',
      input: {
        filename: 'taxes.txt',
        lines_of_text: ['# COMPREHENSIVE TAX GUIDE FOR INDIVIDUALS WITH MULTIPLE W-2s'],
      },
    },
  ],
  usage: {
    input_tokens: 450,
    output_tokens: 124,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    service_tier: 'standard',
  },
};

const EXPECTED_INCOMPLETE_EVENT_TYPES = [
  'message_start',
  'content_block_start',
  'content_block_delta',
  'content_block_delta',
  'content_block_delta',
  'content_block_delta',
  'content_block_delta',
  'content_block_stop',
  'content_block_start',
  'content_block_delta',
  'content_block_delta',
  'content_block_delta',
  'content_block_delta',
  'message_delta',
  'message_stop',
];

function assertBasicResponse(events: BetaRawMessageStreamEvent[], message: BetaMessage) {
  expect(events.map((e) => e.type)).toEqual(EXPECTED_BASIC_EVENT_TYPES);
  expect(message).toMatchObject(EXPECTED_BASIC_MESSAGE);
}

function assertToolUseResponse(events: BetaRawMessageStreamEvent[], message: BetaMessage) {
  expect(events.map((e) => e.type)).toEqual(EXPECTED_TOOL_USE_EVENT_TYPES);
  expect(message).toMatchObject(EXPECTED_TOOL_USE_MESSAGE);
}

async function* betaMessageIterable(message: BetaMessage): AsyncGenerator<BetaRawMessageStreamEvent> {
  yield {
    type: 'message_start',
    // @ts-ignore
    message: { ...message, content: [], stop_reason: null, stop_sequence: null },
  };

  for (let idx = 0; idx < message.content.length; idx++) {
    const content = message.content[idx]!;
    yield {
      type: 'content_block_start',
      content_block:
        content.type === 'text' ? { type: 'text', text: '' }
        : content.type === 'tool_use' ?
          {
            type: 'tool_use',
            id: 'toolu_01Up7oRoHeGvhded7n66nPzP',
            name: 'get_weather',
            input: {},
          }
        : content.type === 'thinking' ? { type: 'thinking', thinking: '', signature: '' }
        : content.type === 'redacted_thinking' ? { type: 'redacted_thinking', data: '' }
        : content.type === 'server_tool_use' ?
          {
            type: 'server_tool_use',
            id: 'toolu_01Up7oRoHeGvhded7n66nPzP',
            name: 'web_search',
            input: {},
          }
        : content.type === 'web_search_tool_result' ?
          {
            type: 'web_search_tool_result',
            tool_use_id: 'toolu_01Up7oRoHeGvhded7n66nPzP',
            content: [],
          }
        : assertNever(content),
      index: idx,
    };

    if (content.type === 'text') {
      for (let chunk = 0; chunk * 5 < content.text.length; chunk++) {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: content.text.slice(chunk * 5, (chunk + 1) * 5) },
          index: idx,
        };
      }
    } else if (content.type === 'tool_use') {
      const jsonString = JSON.stringify(content.input);

      for (let chunk = 0; chunk * 5 < jsonString.length; chunk++) {
        yield {
          type: 'content_block_delta',
          delta: { type: 'input_json_delta', partial_json: jsonString.slice(chunk * 5, (chunk + 1) * 5) },
          index: idx,
        };
      }
    } else if (content.type === 'thinking') {
      throw new Error('thinking not implemented yet');
    } else if (content.type === 'redacted_thinking') {
      throw new Error('redacted_thinking not implemented yet');
    } else if (content.type === 'server_tool_use') {
      throw new Error('server_tool_use not implemented yet');
    } else if (content.type === 'web_search_tool_result') {
      throw new Error('web_search_tool_result not implemented yet');
    } else {
      assertNever(content);
    }

    yield {
      type: 'content_block_stop',
      index: idx,
    };
  }

  yield {
    type: 'message_delta',
    usage: {
      output_tokens: 6,
      input_tokens: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      server_tool_use: null,
    },
    // @ts-ignore
    delta: { stop_reason: message.stop_reason, stop_sequence: message.stop_sequence },
  };

  yield {
    type: 'message_stop',
  };
}

describe('BetaMessageStream class', () => {
  it('handles partial JSON parsing errors in input_json_delta events', async () => {
    const { fetch, handleStreamEvents } = mockFetch();

    const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

    const streamEvents = [
      {
        type: 'message_start',
        message: {
          type: 'message',
          id: 'msg_test',
          role: 'assistant',
          content: [],
          model: 'claude-3-opus-20240229',
          stop_reason: null,
          stop_sequence: null,
          usage: { output_tokens: 0, input_tokens: 10 },
        },
      },
      {
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'toolu_test',
          name: 'test_tool',
          input: {},
        },
        index: 0,
      },
      {
        type: 'content_block_delta',
        delta: {
          type: 'input_json_delta',
          partial_json: '{"foo": "bar", "baz": ', // valid JSON but incomplete
        },
        index: 0,
      },
      {
        type: 'content_block_delta',
        delta: {
          type: 'input_json_delta',
          partial_json: '"qux": "quux"}', // valid JSON but not complete
        },
        index: 0,
      },
      {
        type: 'content_block_delta',
        delta: {
          type: 'input_json_delta',
          partial_json: 'invalid malformed json with syntax errors}', // Invalid JSON
        },
        index: 0,
      },
      {
        type: 'content_block_stop',
        index: 0,
      },
      {
        type: 'message_delta',
        usage: { output_tokens: 5 },
        delta: { stop_reason: 'end_turn', stop_sequence: null },
      },
      {
        type: 'message_stop',
      },
    ];

    handleStreamEvents(streamEvents);

    const stream = anthropic.beta.messages.stream({
      max_tokens: 1024,
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'Use the test tool' }],
    });

    // Collect errors emitted by the stream
    const errors: AnthropicError[] = [];
    stream.on('error', (error) => {
      errors.push(error);
    });

    // Process the stream to completion
    try {
      await stream.done();
    } catch (error) {
      // Stream processing may throw the error
    }

    // Verify that an error was caught and handled
    expect(errors.length).toBe(1);
    expect(errors[0]).toBeInstanceOf(AnthropicError);
    expect(errors[0]!.message).toContain('Unable to parse tool parameter JSON from model');
    expect(errors[0]!.message).toContain('{"foo": "bar", "baz": "qux": "quux"}');
  });

  it('handles incomplete partial JSON responses gracefully', async () => {
    const { fetch, handleStreamEvents } = mockFetch();

    const anthropic = new Anthropic({
      apiKey: 'test-key',
      fetch,
      defaultHeaders: {
        'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
      },
    });

    // Load and parse the fixture that contains incomplete partial JSON
    const fixtureContent = loadFixture('incomplete_partial_json_response.txt');
    const streamEvents = parseSSEFixture(fixtureContent);
    handleStreamEvents(streamEvents);

    const stream = anthropic.beta.messages.stream({
      max_tokens: 1024,
      model: 'claude-3-7-sonnet-20250219',
      messages: [{ role: 'user', content: 'Create a tax guide' }],
    });

    const events: any[] = [];
    const contentBlocks: any[] = [];

    stream.on('streamEvent', (event) => {
      events.push(event.type);
    });

    stream.on('contentBlock', (block) => {
      contentBlocks.push(block);
    });

    // Process the stream to completion
    await stream.done();
    const finalMessage = await stream.finalMessage();

    // Verify the event types match expected
    expect(events).toEqual(EXPECTED_INCOMPLETE_EVENT_TYPES);

    // Verify the final message structure matches expected
    const actualMessage = JSON.parse(JSON.stringify(finalMessage));
    expect(actualMessage).toEqual(EXPECTED_INCOMPLETE_MESSAGE);
  });

  it('handles basic response fixture', async () => {
    const { fetch, handleStreamEvents } = mockFetch();

    const anthropic = new Anthropic({
      apiKey: 'test-key',
      fetch,
      defaultHeaders: {
        'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
      },
    });

    // Load and parse the fixture
    const fixtureContent = loadFixture('basic_response.txt');
    const streamEvents = parseSSEFixture(fixtureContent);
    handleStreamEvents(streamEvents);

    const stream = anthropic.beta.messages.stream({
      max_tokens: 1024,
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'Say hello there!' }],
    });

    const events: any[] = [];
    stream.on('streamEvent', (event) => {
      events.push(event);
    });

    // Process the stream to completion
    await stream.done();
    const finalMessage = await stream.finalMessage();

    // Verify the event types and final message match expected
    assertBasicResponse(events, finalMessage);
  });

  it('handles tool use response fixture', async () => {
    const { fetch, handleStreamEvents } = mockFetch();

    const anthropic = new Anthropic({
      apiKey: 'test-key',
      fetch,
      defaultHeaders: {
        'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
      },
    });

    // Load and parse the fixture
    const fixtureContent = loadFixture('tool_use_response.txt');
    const streamEvents = parseSSEFixture(fixtureContent);
    handleStreamEvents(streamEvents);

    const stream = anthropic.beta.messages.stream({
      max_tokens: 1024,
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
    });

    const events: any[] = [];
    stream.on('streamEvent', (event) => {
      events.push(event);
    });

    // Process the stream to completion
    await stream.done();
    const finalMessage = await stream.finalMessage();

    // Verify the event types and final message match expected
    assertToolUseResponse(events, finalMessage);
  });

  it('aborts on break', async () => {
    const { fetch, handleStreamEvents } = mockFetch();

    const anthropic = new Anthropic({
      apiKey: 'test-key',
      fetch,
      defaultHeaders: {
        'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
      },
    });

    const stream = anthropic.beta.messages.stream({
      max_tokens: 1024,
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'Say hello there!' }],
    });

    const events = [];
    for await (const event of betaMessageIterable({
      type: 'message',
      id: 'msg_01hhptzfxdaeehfxfv070yb6b8',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello there!' }],
      model: 'claude-3-opus-20240229',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        output_tokens: 6,
        input_tokens: 10,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        server_tool_use: null,
        service_tier: 'standard',
      },
    })) {
      events.push(event);
    }

    handleStreamEvents(events);

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

    const anthropic = new Anthropic({
      apiKey: 'test-key',
      fetch,
      defaultHeaders: {
        'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
      },
    });

    const stream = anthropic.beta.messages.stream(
      {
        max_tokens: 1024,
        model: 'claude-3-7-sonnet-20250219',
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

    const anthropic = new Anthropic({
      apiKey: 'test-key',
      fetch,
      defaultHeaders: {
        'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
      },
    });

    const stream = anthropic.beta.messages.stream(
      {
        max_tokens: 1024,
        model: 'claude-3-7-sonnet-20250219',
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
});
