// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource batches', () => {
  test('create: only required params', async () => {
    const responsePromise = client.messages.batches.create({
      requests: [
        {
          custom_id: 'my-custom-id-1',
          params: {
            max_tokens: 1024,
            messages: [{ content: 'Hello, world', role: 'user' }],
            model: 'claude-opus-5',
          },
        },
      ],
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
    const response = await client.messages.batches.create({
      requests: [
        {
          custom_id: 'my-custom-id-1',
          params: {
            max_tokens: 1024,
            messages: [{ content: 'Hello, world', role: 'user' }],
            model: 'claude-opus-5',
            cache_control: { type: 'ephemeral', ttl: '5m' },
            container: {
              id: 'id',
              skills: [
                {
                  skill_id: 'pdf',
                  type: 'anthropic',
                  version: 'latest',
                },
              ],
            },
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
          },
        },
      ],
      user_profile_id: 'anthropic-user-profile-id',
      workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy',
    });
  });

  test('retrieve', async () => {
    const responsePromise = client.messages.batches.retrieve('message_batch_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('retrieve: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.messages.batches.retrieve(
        'message_batch_id',
        { workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('list', async () => {
    const responsePromise = client.messages.batches.list();
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('list: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.messages.batches.list(
        {
          after_id: 'after_id',
          before_id: 'before_id',
          limit: 1,
          workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy',
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('delete', async () => {
    const responsePromise = client.messages.batches.delete('message_batch_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('delete: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.messages.batches.delete(
        'message_batch_id',
        { workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('cancel', async () => {
    const responsePromise = client.messages.batches.cancel('message_batch_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('cancel: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.messages.batches.cancel(
        'message_batch_id',
        { workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('results', async () => {
    const responsePromise = client.messages.batches.results('message_batch_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('results: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.messages.batches.results(
        'message_batch_id',
        { workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });
});
