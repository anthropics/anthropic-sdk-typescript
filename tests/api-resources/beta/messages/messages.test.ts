// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource messages', () => {
  // prism validates based on the non-beta endpoint
  test.skip('create: only required params', async () => {
    const responsePromise = client.beta.messages.create({
      max_tokens: 1024,
      messages: [{ content: 'Hello, world', role: 'user' }],
      model: 'claude-sonnet-4-20250514',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // prism validates based on the non-beta endpoint
  test.skip('create: required and optional params', async () => {
    const response = await client.beta.messages.create({
      max_tokens: 1024,
      messages: [{ content: 'Hello, world', role: 'user' }],
      model: 'claude-sonnet-4-20250514',
      container: 'container',
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
      metadata: { user_id: '13803d75-b4b5-4c3e-b2a2-6f21399b021b' },
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
            properties: {
              location: { description: 'The city and state, e.g. San Francisco, CA', type: 'string' },
              unit: { description: 'Unit for the output - one of (celsius, fahrenheit)', type: 'string' },
            },
            required: ['location'],
          },
          name: 'name',
          cache_control: { type: 'ephemeral', ttl: '5m' },
          description: 'Get the current weather in a given location',
          type: 'custom',
        },
      ],
      top_k: 5,
      top_p: 0.7,
      betas: ['string'],
    });
  });

  // prism validates based on the non-beta endpoint
  test.skip('countTokens: only required params', async () => {
    const responsePromise = client.beta.messages.countTokens({
      messages: [{ content: 'string', role: 'user' }],
      model: 'claude-3-7-sonnet-latest',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // prism validates based on the non-beta endpoint
  test.skip('countTokens: required and optional params', async () => {
    const response = await client.beta.messages.countTokens({
      messages: [{ content: 'string', role: 'user' }],
      model: 'claude-3-7-sonnet-latest',
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
            properties: {
              location: { description: 'The city and state, e.g. San Francisco, CA', type: 'string' },
              unit: { description: 'Unit for the output - one of (celsius, fahrenheit)', type: 'string' },
            },
            required: ['location'],
          },
          name: 'name',
          cache_control: { type: 'ephemeral', ttl: '5m' },
          description: 'Get the current weather in a given location',
          type: 'custom',
        },
      ],
      betas: ['string'],
    });
  });
});
