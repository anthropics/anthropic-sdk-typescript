import Anthropic from '@anthropic-ai/sdk';
import { AnthropicError } from '@anthropic-ai/sdk/error';
import {
  type Fetch,
  type RequestInfo,
  type RequestInit,
  type Response,
} from '@anthropic-ai/sdk/internal/builtin-types';
import { PassThrough } from 'stream';

function mockFetch(): {
  fetch: Fetch;
  handleRequest: (handle: Fetch) => void;
  handleStreamEvents: (events: any[]) => void;
} {
  const queue: Promise<typeof fetch>[] = [];
  const readResolvers: ((handler: typeof fetch) => void)[] = [];

  let index = 0;

  async function fetch(req: string | RequestInfo, init?: RequestInit): Promise<Response> {
    const idx = index++;
    if (!queue[idx]) {
      queue.push(new Promise((resolve) => readResolvers.push(resolve)));
    }

    const handler = await queue[idx]!;
    return await handler(req, init);
  }

  function handleRequest(handler: typeof fetch): void {
    if (readResolvers.length) {
      const resolver = readResolvers.shift()!;
      resolver(handler);
      return;
    }
    queue.push(Promise.resolve(handler));
  }

  function handleStreamEvents(events: any[]) {
    handleRequest(async () => {
      const stream = new PassThrough();
      (async () => {
        for (const event of events) {
          stream.write(`event: ${event.type}\n`);
          stream.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        stream.end(`done: [DONE]\n\n`);
      })();
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Transfer-Encoding': 'chunked',
        },
      });
    });
  }

  return { fetch: fetch as any, handleRequest, handleStreamEvents };
}

describe('BetaMessageStream handling invalid JSON', () => {
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
});
