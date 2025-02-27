// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource batches', () => {
  test('create: only required params', async () => {
    const responsePromise = client.beta.messages.batches.create({
      requests: [
        {
          custom_id: 'my-custom-id-1',
          params: {
            max_tokens: 1024,
            messages: [{ content: 'Hello, world', role: 'user' }],
            model: 'claude-3-7-sonnet-latest',
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
    const response = await client.beta.messages.batches.create({
      requests: [
        {
          custom_id: 'my-custom-id-1',
          params: {
            max_tokens: 1024,
            messages: [{ content: 'Hello, world', role: 'user' }],
            model: 'claude-3-7-sonnet-latest',
            metadata: { user_id: '13803d75-b4b5-4c3e-b2a2-6f21399b021b' },
            stop_sequences: ['string'],
            stream: false,
            system: [
              {
                text: "Today's date is 2024-06-01.",
                type: 'text',
                cache_control: { type: 'ephemeral' },
                citations: [
                  {
                    cited_text: 'cited_text',
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
            thinking: { budget_tokens: 1024, type: 'enabled' },
            tool_choice: { type: 'auto', disable_parallel_tool_use: true },
            tools: [
              {
                input_schema: {
                  type: 'object',
                  properties: {
                    location: { description: 'The city and state, e.g. San Francisco, CA', type: 'string' },
                    unit: {
                      description: 'Unit for the output - one of (celsius, fahrenheit)',
                      type: 'string',
                    },
                  },
                },
                name: 'name',
                cache_control: { type: 'ephemeral' },
                description: 'Get the current weather in a given location',
                type: 'custom',
              },
            ],
            top_k: 5,
            top_p: 0.7,
          },
        },
      ],
      betas: ['string'],
    });
  });

  test('retrieve', async () => {
    const responsePromise = client.beta.messages.batches.retrieve('message_batch_id');
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
      client.beta.messages.batches.retrieve(
        'message_batch_id',
        { betas: ['string'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('list', async () => {
    const responsePromise = client.beta.messages.batches.list();
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
      client.beta.messages.batches.list(
        { after_id: 'after_id', before_id: 'before_id', limit: 1, betas: ['string'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('delete', async () => {
    const responsePromise = client.beta.messages.batches.delete('message_batch_id');
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
      client.beta.messages.batches.delete(
        'message_batch_id',
        { betas: ['string'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('cancel', async () => {
    const responsePromise = client.beta.messages.batches.cancel('message_batch_id');
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
      client.beta.messages.batches.cancel(
        'message_batch_id',
        { betas: ['string'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  // Prism doesn't support JSONL responses yet
  test.skip('results: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.messages.batches.results(
        'message_batch_id',
        { betas: ['string'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });
});
