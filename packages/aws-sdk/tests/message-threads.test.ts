import { AnthropicAws } from '../src';

const REPLY = {
  id: 'msg_a',
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-5',
  content: [{ type: 'text', text: 'Sunny.' }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
};

const PARAMS = {
  model: 'claude-sonnet-5',
  max_tokens: 1024,
  tools: [],
  messages: [{ role: 'user' as const, content: 'What is the weather in SF?' }],
};

/** A `fetch` that answers every request with `REPLY` and keeps the JSON body and headers of each. */
function recordingFetch() {
  const requests: Array<{ body: Record<string, unknown>; betas: string | null }> = [];
  const fetch = async (_url: unknown, init?: { body?: unknown; headers?: unknown }) => {
    requests.push({
      body: JSON.parse(String(init?.body)),
      betas: new Headers(init?.headers as Record<string, string>).get('anthropic-beta'),
    });
    return new Response(JSON.stringify(REPLY), { headers: { 'content-type': 'application/json' } });
  };
  return { fetch: fetch as never, requests };
}

const makeClient = (fetch: never) =>
  new AnthropicAws({
    apiKey: 'test-key',
    awsRegion: 'us-east-1',
    workspaceId: 'ws-test',
    fetch,
    maxRetries: 0,
  });

describe('AnthropicAws and message threads', () => {
  test('the tool runner runs over a thread', async () => {
    const { fetch, requests } = recordingFetch();

    const final = await makeClient(fetch).beta.messages.toolRunner(PARAMS).runUntilDone();

    expect(final.id).toBe('msg_a');
    expect(requests.map((request) => request.body['thread'])).toEqual([{ type: 'create' }]);
    expect(requests[0]!.betas).toContain('message-threads-2026-08-12');
  });

  test('the tool runner goes without a thread when told to', async () => {
    const { fetch, requests } = recordingFetch();

    await makeClient(fetch)
      .beta.messages.toolRunner({ ...PARAMS, thread: false })
      .runUntilDone();

    expect(requests.map((request) => 'thread' in request.body)).toEqual([false]);
    expect(requests[0]!.betas).toBeNull();
  });
});
