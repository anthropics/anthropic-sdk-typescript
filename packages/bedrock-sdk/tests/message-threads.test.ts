import { AnthropicBedrock, AnthropicBedrockMantle } from '../src';

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

const CLIENTS: Array<[string, (fetch: never) => AnthropicBedrock | AnthropicBedrockMantle]> = [
  [
    'AnthropicBedrock',
    (fetch) => new AnthropicBedrock({ awsRegion: 'us-east-1', skipAuth: true, fetch, maxRetries: 0 }),
  ],
  [
    'AnthropicBedrockMantle',
    (fetch) => new AnthropicBedrockMantle({ awsRegion: 'us-east-1', skipAuth: true, fetch, maxRetries: 0 }),
  ],
];

describe.each(CLIENTS)('%s and message threads', (_name, makeClient) => {
  test('the tool runner sends no thread', async () => {
    const { fetch, requests } = recordingFetch();

    const final = await makeClient(fetch).beta.messages.toolRunner(PARAMS).runUntilDone();

    expect(final.id).toBe('msg_a');
    expect(requests.map((request) => 'thread' in request.body)).toEqual([false]);
    expect(requests[0]!.betas).toBeNull();
  });

  test('the tool runner sends a system and tools changed during the run', async () => {
    const { fetch, requests } = recordingFetch();
    const tools = [{ name: 'get_time', input_schema: { type: 'object' as const } }];
    const runner = makeClient(fetch).beta.messages.toolRunner({
      ...PARAMS,
      system: 'Be brief.',
      max_iterations: 2,
    });

    for await (const _reply of runner) {
      runner.pushMessages({ role: 'user', content: 'And in NYC?' });
      runner.setMessagesParams((params) => ({ ...params, system: 'Be very brief.', tools }));
    }

    expect(requests.map(({ body }) => [body['system'], body['tools'], 'thread' in body])).toEqual([
      ['Be brief.', [], false],
      ['Be very brief.', tools, false],
    ]);
  });

  test('there is no thread helper', () => {
    const { fetch, requests } = recordingFetch();
    const { tools, messages, ...params } = PARAMS;

    expect(() => makeClient(fetch).beta.messages.thread(params)).toThrow(
      'Message threads are not available on this client',
    );
    expect(requests).toEqual([]);
  });
});
