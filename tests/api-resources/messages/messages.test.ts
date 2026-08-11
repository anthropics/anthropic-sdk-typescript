// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource messages', () => {
  test('create: only required params', async () => {
    const responsePromise = client.messages.create({
      max_tokens: 1024,
      messages: [{ content: 'Hello, world', role: 'user' }],
      model: 'claude-opus-4-6',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('create: required and optional params', async () => {
    const response = await client.messages.create({
      max_tokens: 1024,
      messages: [{ content: 'Hello, world', role: 'user' }],
      model: 'claude-opus-4-6',
      cache_control: { type: 'ephemeral', ttl: '5m' },
      container: 'container',
      inference_geo: 'inference_geo',
      metadata: { user_id: '13803d75-b4b5-4c3e-b2a2-6f21399b021b' },
      output_config: {
        effort: 'low',
        format: {
          schema: { foo: 'bar' },
          type: 'json_schema',
        },
      },
      service_tier: 'auto',
      stop_sequences: ['string'],
      stream: false,
      system: [
        {
          text: "Today's date is 2024-06-01.",
          type: 'text',
          cache_control: { type: 'ephemeral', ttl: '5m' },
          citations: [
            {
              cited_text: 'The grass is green. The sky is blue.',
              document_index: 0,
              document_title: 'x',
              end_char_index: 0,
              start_char_index: 0,
              type: 'char_location',
            },
          ],
        },
      ],
      temperature: 1,
      thinking: { type: 'adaptive', display: 'summarized' },
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      tools: [
        {
          input_schema: {
            type: 'object',
            properties: { location: 'bar', unit: 'bar' },
            required: ['location'],
          },
          name: 'name',
          allowed_callers: ['direct'],
          cache_control: { type: 'ephemeral', ttl: '5m' },
          defer_loading: true,
          description: 'Get the current weather in a given location',
          eager_input_streaming: true,
          input_examples: [{ foo: 'bar' }],
          strict: true,
          type: 'custom',
        },
      ],
      top_k: 5,
      top_p: 0.7,
      user_profile_id: 'anthropic-user-profile-id',
    });
  });

  test('countTokens: only required params', async () => {
    const responsePromise = client.messages.countTokens({
      messages: [{ content: 'Hello, world', role: 'user' }],
      model: 'claude-opus-4-6',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('countTokens: required and optional params', async () => {
    const response = await client.messages.countTokens({
      messages: [{ content: 'Hello, world', role: 'user' }],
      model: 'claude-opus-4-6',
      cache_control: { type: 'ephemeral', ttl: '5m' },
      output_config: {
        effort: 'low',
        format: {
          schema: { foo: 'bar' },
          type: 'json_schema',
        },
      },
      system: [
        {
          text: "Today's date is 2024-06-01.",
          type: 'text',
          cache_control: { type: 'ephemeral', ttl: '5m' },
          citations: [
            {
              cited_text: 'The grass is green. The sky is blue.',
              document_index: 0,
              document_title: 'x',
              end_char_index: 0,
              start_char_index: 0,
              type: 'char_location',
            },
          ],
        },
      ],
      thinking: { type: 'adaptive', display: 'summarized' },
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      tools: [
        {
          input_schema: {
            type: 'object',
            properties: { location: 'bar', unit: 'bar' },
            required: ['location'],
          },
          name: 'name',
          allowed_callers: ['direct'],
          cache_control: { type: 'ephemeral', ttl: '5m' },
          defer_loading: true,
          description: 'Get the current weather in a given location',
          eager_input_streaming: true,
          input_examples: [{ foo: 'bar' }],
          strict: true,
          type: 'custom',
        },
      ],
      user_profile_id: 'anthropic-user-profile-id',
    });
  });
});

test('create: does not warn for non-deprecated models', async () => {
  const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

  await client.messages.create({
    max_tokens: 1024,
    messages: [{ content: 'Hello, world', role: 'user' }],
    model: 'claude-opus-4-6',
  });

  expect(consoleSpy).not.toHaveBeenCalled();

  consoleSpy.mockRestore();
});

describe('create: non-streaming timeout', () => {
  const message = {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-5',
    content: [{ type: 'text', text: 'hi' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };

  function makeClient(opts: { timeout?: number } = {}) {
    const requests: RequestInit[] = [];
    const fetch = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requests.push(init ?? {});
      return new Response(JSON.stringify(message), { headers: { 'Content-Type': 'application/json' } });
    };
    const client = new Anthropic({ apiKey: 'test-key', fetch, ...opts });
    return { client, requests };
  }

  const sentTimeoutSeconds = (init: RequestInit | undefined) =>
    new Headers(init?.headers).get('x-stainless-timeout');

  // max_tokens large enough that the estimated non-streaming duration exceeds the 10 minute default
  const longParams = {
    model: 'claude-sonnet-4-5',
    max_tokens: 128_000,
    messages: [{ role: 'user' as const, content: 'hi' }],
  };

  test('throws for long requests when no timeout is configured', async () => {
    const { client, requests } = makeClient();
    await expect(async () => client.messages.create(longParams)).rejects.toThrow(/Streaming is required/);
    expect(requests).toHaveLength(0);
  });

  test('a per-request timeout bypasses the long-request check', async () => {
    const { client, requests } = makeClient();
    await client.messages.create(longParams, { timeout: 20 * 60 * 1000 });
    expect(requests).toHaveLength(1);
    expect(sentTimeoutSeconds(requests[0])).toBe('1200');
  });

  test('a client-level timeout bypasses the long-request check', async () => {
    const { client, requests } = makeClient({ timeout: 20 * 60 * 1000 });
    await client.messages.create(longParams);
    expect(requests).toHaveLength(1);
    expect(sentTimeoutSeconds(requests[0])).toBe('1200');
  });

  test('short requests still get the computed default timeout', async () => {
    const { client, requests } = makeClient();
    await client.messages.create({ ...longParams, max_tokens: 1024 });
    expect(sentTimeoutSeconds(requests[0])).toBe('600');
  });
});
