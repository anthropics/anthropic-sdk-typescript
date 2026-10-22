/** A Messages endpoint mock for driving `toolRunner` with scripted assistant turns. */
import Anthropic from '@anthropic-ai/sdk';
import type { BetaContentBlock, BetaMessage, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta';
import { mockFetch } from '../../../lib/mock-fetch';

export function assistantMessage(...content: BetaContentBlock[]): BetaMessage {
  const hasToolUse = content.some((block) => block.type === 'tool_use');
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    content,
    model: 'claude-sonnet-4-5',
    stop_details: null,
    stop_reason: hasToolUse ? 'tool_use' : 'end_turn',
    stop_sequence: null,
    container: null,
    context_management: null,
    diagnostics: null,
    usage: {
      input_tokens: 10,
      output_tokens: 20,
      output_tokens_details: null,
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      fallback_credit: null,
      server_tool_use: null,
      service_tier: null,
      inference_geo: null,
      iterations: null,
      speed: null,
    },
  };
}

/**
 * A `toolRunner` over a mocked Messages endpoint. Each `respondWith` scripts the assistant turn that answers the next
 * request, and `requests` records each request as it goes out (its JSON body as parsed, so untyped).
 */
export function setupRunner(
  tools: Anthropic.Beta.Messages.BetaToolRunnerParams['tools'],
  options: { messages?: BetaMessageParam[]; signal?: AbortSignal } = {},
) {
  const { handleRequest, fetch } = mockFetch();
  const requests: Array<{ body: any; headers: Headers }> = [];
  const respondWith = (...content: BetaContentBlock[]) =>
    handleRequest(async (_req, init) => {
      requests.push({ body: JSON.parse(String(init!.body)), headers: new Headers(init!.headers) });
      return new Response(JSON.stringify(assistantMessage(...content)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
  const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });
  const runner = client.beta.messages.toolRunner(
    {
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: options.messages ?? [{ role: 'user', content: 'Open example.com' }],
      tools,
    },
    options.signal ? { signal: options.signal } : undefined,
  );
  return { runner, respondWith, requests };
}
