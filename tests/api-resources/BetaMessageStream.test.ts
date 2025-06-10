import Anthropic from '@anthropic-ai/sdk';
import { AnthropicError } from '@anthropic-ai/sdk/error';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mockFetch } from '../lib/mock-fetch';

function loadFixture(filename: string): string {
  const fixturePath = join(__dirname, '..', 'lib', 'fixtures', filename);
  return readFileSync(fixturePath, 'utf-8');
}

function parseSSEFixture(sseContent: string): any[] {
  const events: any[] = [];
  const lines = sseContent.split('\n');
  let currentEvent: any = {};

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      // If we have a complete event, push it
      if (currentEvent.type && currentEvent.data) {
        events.push(currentEvent.data);
      }
      currentEvent = { type: line.substring(7) };
    } else if (line.startsWith('data: ')) {
      const dataStr = line.substring(6).trim();
      if (dataStr) {
        try {
          currentEvent.data = JSON.parse(dataStr);
        } catch (e) {
          // Skip malformed JSON data lines
        }
      }
    } else if (line.trim() === '') {
      // Empty line indicates end of event
      if (currentEvent.type && currentEvent.data) {
        events.push(currentEvent.data);
        currentEvent = {};
      }
    }
  }

  // Push the last event if it exists
  if (currentEvent.type && currentEvent.data) {
    events.push(currentEvent.data);
  }

  return events;
}

// Expected message fixtures
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
});
