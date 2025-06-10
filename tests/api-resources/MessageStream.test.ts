import Anthropic, { APIConnectionError, APIUserAbortError } from '@anthropic-ai/sdk';
import { Message, MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';
import { mockFetch } from '../lib/mock-fetch';

function assertNever(x: never): never {
  throw new Error(`unreachable: ${x}`);
}

async function* messageIterable(message: Message): AsyncGenerator<MessageStreamEvent> {
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
        content.type === 'text' ? { type: 'text', text: '', citations: null }
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

describe('MessageStream class', () => {
  it('matches snapshot', async () => {
    const { fetch, handleMessageStreamEvents } = mockFetch();

    const anthropic = new Anthropic({ apiKey: '...', fetch });

    handleMessageStreamEvents(
      messageIterable({
        type: 'message',
        id: 'msg_01hhptzfxdaeehfxfv070yb6b8',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello there!', citations: null }],
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
      }),
    );

    const stream = anthropic.messages.stream({
      max_tokens: 1024,
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'Say hello there!' }],
    });

    const events: any[] = [];
    const addEvent = (type: string, ...args: any[]) => {
      events.push({ type, args: args.map((arg) => JSON.stringify(arg)) });
    };

    for (const eventType of [
      'connect',
      'streamEvent',
      'text',
      'message',
      'contentBlock',
      'finalMessage',
      'error',
      'abort',
      'end',
    ] as const) {
      stream.on(eventType, addEvent.bind(null, eventType));
    }

    await stream.done();

    expect(events.map((event) => event.type)).toMatchInlineSnapshot(`
           [
             "connect",
             "streamEvent",
             "streamEvent",
             "streamEvent",
             "text",
             "streamEvent",
             "text",
             "streamEvent",
             "text",
             "streamEvent",
             "contentBlock",
             "streamEvent",
             "streamEvent",
             "message",
             "finalMessage",
             "end",
           ]
        `);

    expect(events).toMatchInlineSnapshot(`
      [
        {
          "args": [],
          "type": "connect",
        },
        {
          "args": [
            "{"type":"message_start","message":{"type":"message","id":"msg_01hhptzfxdaeehfxfv070yb6b8","role":"assistant","content":[],"model":"claude-3-opus-20240229","stop_reason":null,"stop_sequence":null,"usage":{"output_tokens":6,"input_tokens":10,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null,"service_tier":"standard"}}}",
            "{"type":"message","id":"msg_01hhptzfxdaeehfxfv070yb6b8","role":"assistant","content":[],"model":"claude-3-opus-20240229","stop_reason":null,"stop_sequence":null,"usage":{"output_tokens":6,"input_tokens":10,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null,"service_tier":"standard"}}",
          ],
          "type": "streamEvent",
        },
        {
          "args": [
            "{"type":"content_block_start","content_block":{"type":"text","text":"","citations":null},"index":0}",
            "{"type":"message","id":"msg_01hhptzfxdaeehfxfv070yb6b8","role":"assistant","content":[{"type":"text","text":"","citations":null}],"model":"claude-3-opus-20240229","stop_reason":null,"stop_sequence":null,"usage":{"output_tokens":6,"input_tokens":10,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null,"service_tier":"standard"}}",
          ],
          "type": "streamEvent",
        },
        {
          "args": [
            "{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"},"index":0}",
            "{"type":"message","id":"msg_01hhptzfxdaeehfxfv070yb6b8","role":"assistant","content":[{"type":"text","text":"Hello","citations":null}],"model":"claude-3-opus-20240229","stop_reason":null,"stop_sequence":null,"usage":{"output_tokens":6,"input_tokens":10,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null,"service_tier":"standard"}}",
          ],
          "type": "streamEvent",
        },
        {
          "args": [
            ""Hello"",
            ""Hello"",
          ],
          "type": "text",
        },
        {
          "args": [
            "{"type":"content_block_delta","delta":{"type":"text_delta","text":" ther"},"index":0}",
            "{"type":"message","id":"msg_01hhptzfxdaeehfxfv070yb6b8","role":"assistant","content":[{"type":"text","text":"Hello ther","citations":null}],"model":"claude-3-opus-20240229","stop_reason":null,"stop_sequence":null,"usage":{"output_tokens":6,"input_tokens":10,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null,"service_tier":"standard"}}",
          ],
          "type": "streamEvent",
        },
        {
          "args": [
            "" ther"",
            ""Hello ther"",
          ],
          "type": "text",
        },
        {
          "args": [
            "{"type":"content_block_delta","delta":{"type":"text_delta","text":"e!"},"index":0}",
            "{"type":"message","id":"msg_01hhptzfxdaeehfxfv070yb6b8","role":"assistant","content":[{"type":"text","text":"Hello there!","citations":null}],"model":"claude-3-opus-20240229","stop_reason":null,"stop_sequence":null,"usage":{"output_tokens":6,"input_tokens":10,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null,"service_tier":"standard"}}",
          ],
          "type": "streamEvent",
        },
        {
          "args": [
            ""e!"",
            ""Hello there!"",
          ],
          "type": "text",
        },
        {
          "args": [
            "{"type":"content_block_stop","index":0}",
            "{"type":"message","id":"msg_01hhptzfxdaeehfxfv070yb6b8","role":"assistant","content":[{"type":"text","text":"Hello there!","citations":null}],"model":"claude-3-opus-20240229","stop_reason":null,"stop_sequence":null,"usage":{"output_tokens":6,"input_tokens":10,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null,"service_tier":"standard"}}",
          ],
          "type": "streamEvent",
        },
        {
          "args": [
            "{"type":"text","text":"Hello there!","citations":null}",
          ],
          "type": "contentBlock",
        },
        {
          "args": [
            "{"type":"message_delta","usage":{"output_tokens":6,"input_tokens":null,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null},"delta":{"stop_reason":"end_turn","stop_sequence":null}}",
            "{"type":"message","id":"msg_01hhptzfxdaeehfxfv070yb6b8","role":"assistant","content":[{"type":"text","text":"Hello there!","citations":null}],"model":"claude-3-opus-20240229","stop_reason":"end_turn","stop_sequence":null,"usage":{"output_tokens":6,"input_tokens":10,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null,"service_tier":"standard"}}",
          ],
          "type": "streamEvent",
        },
        {
          "args": [
            "{"type":"message_stop"}",
            "{"type":"message","id":"msg_01hhptzfxdaeehfxfv070yb6b8","role":"assistant","content":[{"type":"text","text":"Hello there!","citations":null}],"model":"claude-3-opus-20240229","stop_reason":"end_turn","stop_sequence":null,"usage":{"output_tokens":6,"input_tokens":10,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null,"service_tier":"standard"}}",
          ],
          "type": "streamEvent",
        },
        {
          "args": [
            "{"type":"message","id":"msg_01hhptzfxdaeehfxfv070yb6b8","role":"assistant","content":[{"type":"text","text":"Hello there!","citations":null}],"model":"claude-3-opus-20240229","stop_reason":"end_turn","stop_sequence":null,"usage":{"output_tokens":6,"input_tokens":10,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null,"service_tier":"standard"}}",
          ],
          "type": "message",
        },
        {
          "args": [
            "{"type":"message","id":"msg_01hhptzfxdaeehfxfv070yb6b8","role":"assistant","content":[{"type":"text","text":"Hello there!","citations":null}],"model":"claude-3-opus-20240229","stop_reason":"end_turn","stop_sequence":null,"usage":{"output_tokens":6,"input_tokens":10,"cache_creation_input_tokens":null,"cache_read_input_tokens":null,"server_tool_use":null,"service_tier":"standard"}}",
          ],
          "type": "finalMessage",
        },
        {
          "args": [],
          "type": "end",
        },
      ]
    `);

    expect(await stream.finalText()).toMatchInlineSnapshot(`"Hello there!"`);

    expect(await stream.finalMessage()).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "citations": null,
            "text": "Hello there!",
            "type": "text",
          },
        ],
        "id": "msg_01hhptzfxdaeehfxfv070yb6b8",
        "model": "claude-3-opus-20240229",
        "role": "assistant",
        "stop_reason": "end_turn",
        "stop_sequence": null,
        "type": "message",
        "usage": {
          "cache_creation_input_tokens": null,
          "cache_read_input_tokens": null,
          "input_tokens": 10,
          "output_tokens": 6,
          "server_tool_use": null,
          "service_tier": "standard",
        },
      }
    `);
  });

  it('aborts on break', async () => {
    const { fetch, handleMessageStreamEvents } = mockFetch();

    const anthropic = new Anthropic({ apiKey: '...', fetch });

    const stream = anthropic.messages.stream({
      max_tokens: 1024,
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'Say hello there!' }],
    });

    handleMessageStreamEvents(
      messageIterable({
        type: 'message',
        id: 'msg_01hhptzfxdaeehfxfv070yb6b8',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello there!', citations: null }],
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
      }),
    );

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

    const anthropic = new Anthropic({ apiKey: '...', fetch });

    const stream = anthropic.messages.stream(
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
