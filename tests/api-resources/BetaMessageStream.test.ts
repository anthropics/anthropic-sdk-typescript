import Anthropic, { APIConnectionError, APIUserAbortError } from '@anthropic-ai/sdk';
import { AnthropicError } from '@anthropic-ai/sdk/error';
import { BetaMessage, BetaRawMessageStreamEvent } from '@anthropic-ai/sdk/resources/beta/messages';
import * as partialJsonParser from '@anthropic-ai/sdk/_vendor/partial-json-parser/parser';
import { mockFetch } from '../lib/mock-fetch';
import { loadFixture, parseSSEFixture } from '../lib/sse-helpers';

// The swc-compiled module exports are non-configurable, so `jest.spyOn` can't patch
// `partialParse`; wrap the real implementation in a `jest.fn` to count calls instead.
jest.mock('@anthropic-ai/sdk/_vendor/partial-json-parser/parser', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk/_vendor/partial-json-parser/parser');
  return { ...actual, partialParse: jest.fn(actual.partialParse) };
});

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

const EXPECTED_INCOMPLETE_MESSAGE = {
  id: 'msg_01UdjYBBipA9omjYhicnevgq',
  model: 'claude-sonnet-4-5',
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
  parsed_output: null,
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
          model: 'claude-opus-4-8',
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
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'Use the test tool' }],
    });

    const errors: AnthropicError[] = [];
    stream.on('error', (error) => {
      errors.push(error);
    });

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

    const fixtureContent = loadFixture('incomplete_partial_json_response.txt');
    const streamEvents = await parseSSEFixture(fixtureContent);
    handleStreamEvents(streamEvents);

    const stream = anthropic.beta.messages.stream({
      max_tokens: 1024,
      model: 'claude-sonnet-4-5',
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

    await stream.done();
    const finalMessage = await stream.finalMessage();

    expect(events).toEqual(EXPECTED_INCOMPLETE_EVENT_TYPES);

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

    const fixtureContent = loadFixture('basic_response.txt');
    const streamEvents = await parseSSEFixture(fixtureContent);
    handleStreamEvents(streamEvents);

    const stream = anthropic.beta.messages.stream({
      max_tokens: 1024,
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'Say hello there!' }],
    });

    const events: any[] = [];
    stream.on('streamEvent', (event) => {
      events.push(event);
    });

    await stream.done();
    const finalMessage = await stream.finalMessage();
    const finalText = await stream.finalText();

    assertBasicResponse(events, finalMessage);
    expect(finalText).toBe('Hello there!');
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

    const fixtureContent = loadFixture('tool_use_response.txt');
    const streamEvents = await parseSSEFixture(fixtureContent);
    handleStreamEvents(streamEvents);

    const stream = anthropic.beta.messages.stream({
      max_tokens: 1024,
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
    });

    const events: any[] = [];
    stream.on('streamEvent', (event) => {
      events.push(event);
    });

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
    const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

    handleStreamEvents(await parseSSEFixture(loadFixture('tool_use_response.txt')));

    const stream = anthropic.beta.messages.stream({
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
    expect(Object.getOwnPropertyDescriptor(finalMessage.content[1], 'input')?.get).toBeUndefined();
    // Fixture has five input_json_delta events; only the content_block_stop parse runs.
    expect(partialParse).toHaveBeenCalledTimes(1);
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
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'Say hello there!' }],
    });

    const fixtureContent = loadFixture('basic_response.txt');
    const streamEvents = await parseSSEFixture(fixtureContent);
    handleStreamEvents(streamEvents);

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

  it('carries stop_details from message_delta into the final message', async () => {
    const { fetch, handleStreamEvents } = mockFetch();

    const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

    handleStreamEvents([
      {
        type: 'message_start',
        message: {
          id: 'msg_refusal_01',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-opus-4-8',
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 15, output_tokens: 1 },
        },
      },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'I cannot help' } },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: {
          stop_reason: 'refusal',
          stop_sequence: null,
          stop_details: {
            type: 'refusal',
            category: 'cyber',
            explanation: 'Declined by a streaming policy classifier.',
          },
        },
        usage: { output_tokens: 8 },
      },
      { type: 'message_stop' },
    ]);

    const stream = anthropic.beta.messages.stream({
      max_tokens: 1024,
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'Do something disallowed.' }],
    });

    const finalMessage = await stream.finalMessage();

    expect(finalMessage.stop_reason).toBe('refusal');
    expect(finalMessage.stop_details).toEqual({
      type: 'refusal',
      category: 'cyber',
      explanation: 'Declined by a streaming policy classifier.',
    });
  });

  it('relabels the snapshot model from fallback content blocks', async () => {
    const { fetch, handleStreamEvents } = mockFetch();

    const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

    handleStreamEvents([
      {
        type: 'message_start',
        message: {
          id: 'msg_fallback_01',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-opus-4-8',
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 1 },
        },
      },
      {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'fallback',
          from: { model: 'claude-opus-4-8' },
          to: { model: 'claude-sonnet-4-5' },
          trigger: { type: 'refusal', category: null },
        },
      },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Hello there!' } },
      { type: 'content_block_stop', index: 1 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 6 },
      },
      { type: 'message_stop' },
    ]);

    const stream = anthropic.beta.messages.stream({
      max_tokens: 1024,
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'Say hello there!' }],
    });

    const finalMessage = await stream.finalMessage();

    expect(finalMessage.model).toBe('claude-sonnet-4-5');
    expect(finalMessage.content).toMatchObject([
      {
        type: 'fallback',
        from: { model: 'claude-opus-4-8' },
        to: { model: 'claude-sonnet-4-5' },
      },
      { type: 'text', text: 'Hello there!' },
    ]);
  });
});
