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
            properties: { location: 'bar', unit: 'bar' },
            required: ['location'],
          },
          name: 'name',
          cache_control: { type: 'ephemeral', ttl: '5m' },
          description: 'Get the current weather in a given location',
          eager_input_streaming: true,
          strict: true,
          type: 'custom',
        },
      ],
      top_k: 5,
      top_p: 0.7,
    });
  });

  test('countTokens: only required params', async () => {
    const responsePromise = client.messages.countTokens({
      messages: [{ content: 'string', role: 'user' }],
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
      messages: [{ content: 'string', role: 'user' }],
      model: 'claude-opus-4-6',
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
      thinking: { budget_tokens: 1024, type: 'enabled' },
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      tools: [
        {
          input_schema: {
            type: 'object',
            properties: { location: 'bar', unit: 'bar' },
            required: ['location'],
          },
          name: 'name',
          cache_control: { type: 'ephemeral', ttl: '5m' },
          description: 'Get the current weather in a given location',
          eager_input_streaming: true,
          strict: true,
          type: 'custom',
        },
      ],
    });
  });
});

test('create: warns when using a deprecated model', async () => {
  const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

  await client.messages.create({
    max_tokens: 1024,
    messages: [{ content: 'Hello, world', role: 'user' }],
    model: 'claude-instant-1.2',
  });

  expect(consoleSpy).toHaveBeenCalledWith(
    "The model 'claude-instant-1.2' is deprecated and will reach end-of-life on November 6th, 2024\n" +
      'Please migrate to a newer model. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.',
  );

  consoleSpy.mockRestore();
});

test('create: does not warn for non-deprecated models', async () => {
  const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

  await client.messages.create({
    max_tokens: 1024,
    messages: [{ content: 'Hello, world', role: 'user' }],
    model: 'claude-opus-4-0',
  });

  expect(consoleSpy).not.toHaveBeenCalled();

  consoleSpy.mockRestore();
});
