// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource messages', () => {
  test('create: only required params', async () => {
    const responsePromise = client.beta.messages.create({
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
    const response = await client.beta.messages.create({
      max_tokens: 1024,
      messages: [{ content: 'Hello, world', role: 'user' }],
      model: 'claude-opus-4-6',
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
      context_management: {
        edits: [
          {
            type: 'clear_tool_uses_20250919',
            clear_at_least: { type: 'input_tokens', value: 0 },
            clear_tool_inputs: true,
            exclude_tools: ['string'],
            keep: { type: 'tool_uses', value: 0 },
            trigger: { type: 'input_tokens', value: 1 },
          },
        ],
      },
      inference_geo: 'inference_geo',
      mcp_servers: [
        {
          name: 'name',
          type: 'url',
          url: 'url',
          authorization_token: 'authorization_token',
          tool_configuration: { allowed_tools: ['string'], enabled: true },
        },
      ],
      metadata: { user_id: '13803d75-b4b5-4c3e-b2a2-6f21399b021b' },
      output_config: {
        effort: 'low',
        format: {
          schema: { foo: 'bar' },
          type: 'json_schema',
        },
      },
      service_tier: 'auto',
      speed: 'standard',
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
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('countTokens: only required params', async () => {
    const responsePromise = client.beta.messages.countTokens({
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
    const response = await client.beta.messages.countTokens({
      messages: [{ content: 'Hello, world', role: 'user' }],
      model: 'claude-opus-4-6',
      cache_control: { type: 'ephemeral', ttl: '5m' },
      context_management: {
        edits: [
          {
            type: 'clear_tool_uses_20250919',
            clear_at_least: { type: 'input_tokens', value: 0 },
            clear_tool_inputs: true,
            exclude_tools: ['string'],
            keep: { type: 'tool_uses', value: 0 },
            trigger: { type: 'input_tokens', value: 1 },
          },
        ],
      },
      mcp_servers: [
        {
          name: 'name',
          type: 'url',
          url: 'url',
          authorization_token: 'authorization_token',
          tool_configuration: { allowed_tools: ['string'], enabled: true },
        },
      ],
      output_config: {
        effort: 'low',
        format: {
          schema: { foo: 'bar' },
          type: 'json_schema',
        },
      },
      speed: 'standard',
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
      betas: ['message-batches-2024-09-24'],
    });
  });
});
