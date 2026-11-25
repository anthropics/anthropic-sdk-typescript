import Anthropic, { APIConnectionError, APIUserAbortError } from '@anthropic-ai/sdk';
import { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import {
  Message,
  MessageDeltaUsage,
  MessageStreamEvent,
  RawMessageDeltaEvent,
} from '@anthropic-ai/sdk/resources/messages';
import * as partialJsonParser from '@anthropic-ai/sdk/_vendor/partial-json-parser/parser';
import { mockFetch } from '../lib/mock-fetch';
import { loadFixture, parseSSEFixture } from '../lib/sse-helpers';

// Wrap the real `partialParse` in a `vi.fn` so tests can count calls.
vi.mock('@anthropic-ai/sdk/_vendor/partial-json-parser/parser', async () => {
  const actual = await vi.importActual<typeof import('@anthropic-ai/sdk/_vendor/partial-json-parser/parser')>(
    '@anthropic-ai/sdk/_vendor/partial-json-parser/parser',
  );
  return { ...actual, partialParse: vi.fn(actual.partialParse) };
});

// tripwire: a new RawMessageDeltaEvent field must be handled in MessageStream#accumulateMessage,
// then listed here (missing key -> required-property error, extra key -> excess-property error);
// enforced at compile time by tsc via ./scripts/lint, not by the test runner
const _accumulatedDeltaEventKeys: Record<keyof RawMessageDeltaEvent, true> = {
  type: true,
  delta: true,
  usage: true,
};
const _accumulatedDeltaKeys: Record<keyof RawMessageDeltaEvent.Delta, true> = {
  container: true,
  stop_details: true,
  stop_reason: true,
  stop_sequence: true,
};
const _accumulatedDeltaUsageKeys: Record<keyof MessageDeltaUsage, true> = {
  cache_creation_input_tokens: true,
  cache_read_input_tokens: true,
  input_tokens: true,
  output_tokens: true,
  output_tokens_details: true,
  server_tool_use: true,
};
void _accumulatedDeltaEventKeys;
void _accumulatedDeltaKeys;
void _accumulatedDeltaUsageKeys;

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

const UNKNOWN_EVENT = { type: 'future_event', usage: { output_tokens: 1 } };

function assertBasicResponse(events: MessageStreamEvent[], message: Message) {
  expect(events.map((e) => e.type)).toEqual(EXPECTED_BASIC_EVENT_TYPES);
  expect(message).toMatchObject(EXPECTED_BASIC_MESSAGE);
}

function assertToolUseResponse(events: MessageStreamEvent[], message: Message) {
  expect(events.map((e) => e.type)).toEqual(EXPECTED_TOOL_USE_EVENT_TYPES);
  expect(message).toMatchObject(EXPECTED_TOOL_USE_MESSAGE);
}

describe.each(['messages', 'beta.messages'])('%s stream callbacks', (api) => {
  function mockStream(events: unknown[]) {
    const { fetch, handleStreamEvents } = mockFetch();
    handleStreamEvents(events);
    const client = new Anthropic({ apiKey: '...', fetch });
    const params = {
      max_tokens: 128,
      model: 'claude-opus-4-8',
      messages: [{ role: 'user' as const, content: 'Check the weather in Paris and Tokyo.' }],
      tools: [
        {
          name: 'weather',
          input_schema: { type: 'object' as const, properties: { city: { type: 'string' } } },
        },
      ],
    };
    return { client, params };
  }

  it('dispatches overlapping tool callbacks by block index', async () => {
    const frames = await parseSSEFixture(loadFixture('tool_use_response.txt'));
    const tool = (id: string) => ({ type: 'tool_use', id, name: 'weather', input: {} });
    const { client, params } = mockStream([
      frames[0],
      { type: 'content_block_start', index: 0, content_block: tool('first') },
      { type: 'content_block_start', index: 1, content_block: tool('second') },
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{"city":"Tokyo"}' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"city":"Paris"}' },
      },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_stop', index: 1 },
      ...frames.slice(-2),
    ]);
    const onInput = vi.fn();
    const onBlock = vi.fn();
    const stream =
      api === 'messages' ?
        client.messages.stream(params).on('inputJson', onInput).on('contentBlock', onBlock)
      : client.beta.messages.stream(params).on('inputJson', onInput).on('contentBlock', onBlock);
    await stream.done();

    expect(onInput.mock.calls).toEqual([
      ['{"city":"Tokyo"}', { city: 'Tokyo' }],
      ['{"city":"Paris"}', { city: 'Paris' }],
    ]);
    expect(onBlock.mock.calls).toEqual([
      [{ type: 'tool_use', id: 'first', name: 'weather', input: { city: 'Paris' } }],
      [{ type: 'tool_use', id: 'second', name: 'weather', input: { city: 'Tokyo' } }],
    ]);
  });

  it('passes through events for a missing block without dispatching its callbacks', async () => {
    const [messageStart, blockStart, ...rest] = await parseSSEFixture(loadFixture('basic_response.txt'));
    const missing = [
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'unmatched' } },
      { type: 'content_block_stop', index: 1 },
    ];
    const { client, params } = mockStream([messageStart, blockStart, ...missing, ...rest]);
    const onText = vi.fn();
    const onBlock = vi.fn();
    const stream =
      api === 'messages' ?
        client.messages.stream(params).on('text', onText).on('contentBlock', onBlock)
      : client.beta.messages.stream(params).on('text', onText).on('contentBlock', onBlock);
    const observed = [];
    for await (const event of stream) {
      if ('index' in event && event.index === 1) observed.push(event);
    }

    expect(observed).toEqual(missing);
    expect(onText.mock.calls).toEqual([
      ['Hello', 'Hello'],
      [' there', 'Hello there'],
      ['!', 'Hello there!'],
    ]);
    expect(onBlock.mock.calls).toEqual([[{ type: 'text', text: 'Hello there!' }]]);
  });
});

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
        model: 'claude-sonnet-5-5',
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
        model: 'claude-sonnet-5-5',
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

  it('passes unknown events through with the current snapshot', async () => {
    const [messageStart, ...rest] = await parseSSEFixture(loadFixture('basic_response.txt'));
    const early = [UNKNOWN_EVENT, { type: 'content_block_stop', index: 0 }];
    const lines = [...early, messageStart, UNKNOWN_EVENT, ...rest, UNKNOWN_EVENT].map((event) =>
      JSON.stringify(event),
    );

    const stream = MessageStream.fromReadableStream(new Response(lines.join('\n')).body!);

    const events: MessageStreamEvent[] = [];
    const snapshotIDs: string[] = [];
    stream.on('streamEvent', (event, snapshot) => {
      events.push(event);
      snapshotIDs.push(snapshot?.id);
    });
    const afterMessageStart: MessageStreamEvent[] = [];
    const loopEnded = new Promise<void>((resolve) =>
      stream.once('streamEvent', async () => {
        for await (const event of stream) {
          afterMessageStart.push(event);
        }
        resolve();
      }),
    );
    const iterated: MessageStreamEvent[] = [];
    for await (const event of MessageStream.fromReadableStream(stream.toReadableStream())) {
      iterated.push(event);
    }

    expect(await stream.finalMessage()).toMatchObject(EXPECTED_BASIC_MESSAGE);
    expect(iterated.slice(0, early.length)).toEqual(early);
    expect(iterated.slice(early.length).map((e) => e.type)).toEqual(events.map((e) => e.type));
    await loopEnded;
    expect(afterMessageStart).toEqual(events.slice(1));
    expect(snapshotIDs).toEqual(events.map(() => EXPECTED_BASIC_MESSAGE.id));
    expect(events.map((e) => e.type)).toEqual([
      'message_start',
      UNKNOWN_EVENT.type,
      ...EXPECTED_BASIC_EVENT_TYPES.slice(1),
      UNKNOWN_EVENT.type,
    ]);
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
    const partialParse = vi.mocked(partialJsonParser.partialParse);
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
    const partialParse = vi.mocked(partialJsonParser.partialParse);
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

  it('exposes request_id and workspace_id from response headers', async () => {
    const { fetch, handleRequest } = mockFetch();
    const anthropic = new Anthropic({ apiKey: '...', fetch });

    handleRequest(
      async () =>
        new Response(loadFixture('basic_response.txt'), {
          headers: {
            'content-type': 'text/event-stream',
            'request-id': 'req_xxx',
            'anthropic-workspace-id': 'wrkspc_xxx',
          },
        }),
    );

    const stream = anthropic.messages.stream({
      max_tokens: 1024,
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'Say hello there!' }],
    });

    const { request_id, workspace_id } = await stream.withResponse();
    expect(request_id).toBe('req_xxx');
    expect(workspace_id).toBe('wrkspc_xxx');
    expect(stream.request_id).toBe('req_xxx');
    expect(stream.workspace_id).toBe('wrkspc_xxx');
    await stream.done();
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
