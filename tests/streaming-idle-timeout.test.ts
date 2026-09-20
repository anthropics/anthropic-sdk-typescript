import Anthropic from '@anthropic-ai/sdk';
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk/core/error';
import { mockFetch } from './lib/mock-fetch';

describe('MessageStream idle timeout', () => {
  it('throws APIConnectionTimeoutError when stream is idle longer than idleTimeoutMs', async () => {
    const { fetch, handleMessageStreamEvents } = mockFetch();
    const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

    async function* stalledStream() {
      yield {
        type: 'message_start',
        message: {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-sonnet-5',
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 1 },
        },
      };

      // Simulate a network hang / stalled response longer than idle timeout
      await new Promise((resolve) => setTimeout(resolve, 300));

      yield {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      };
    }

    handleMessageStreamEvents(stalledStream());

    const stream = anthropic.messages.stream(
      {
        max_tokens: 1024,
        model: 'claude-sonnet-5',
        messages: [{ role: 'user', content: 'hello' }],
      },
      // Pass idleTimeoutMs: 100ms
      { idleTimeoutMs: 100 } as any,
    );

    let caughtError: any;
    try {
      for await (const _chunk of stream) {
        // reading chunks
      }
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(APIConnectionTimeoutError);
    expect(caughtError?.message).toContain('idle');
  });

  it('completes successfully when chunks arrive within idleTimeoutMs window', async () => {
    const { fetch, handleMessageStreamEvents } = mockFetch();
    const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

    async function* activeStream() {
      yield {
        type: 'message_start',
        message: {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-sonnet-5',
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 1 },
        },
      };

      // Delay is 30ms, which is well within 150ms idleTimeoutMs
      await new Promise((resolve) => setTimeout(resolve, 30));

      yield {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      };

      yield {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello!' },
      };

      yield {
        type: 'content_block_stop',
        index: 0,
      };

      yield {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 2 },
      };

      yield {
        type: 'message_stop',
      };
    }

    handleMessageStreamEvents(activeStream());

    const stream = anthropic.messages.stream(
      {
        max_tokens: 1024,
        model: 'claude-sonnet-5',
        messages: [{ role: 'user', content: 'hello' }],
      },
      { idleTimeoutMs: 150 } as any,
    );

    const receivedTexts: string[] = [];
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        receivedTexts.push(chunk.delta.text);
      }
    }

    expect(receivedTexts.join('')).toBe('Hello!');
  });
});
