// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';
import { Response } from 'node-fetch';

const anthropic = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource messages', () => {
  test('create: only required params', async () => {
    const responsePromise = anthropic.beta.tools.messages.create({
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello, world' }],
      model: 'claude-3-opus-20240229',
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
    const response = await anthropic.beta.tools.messages.create({
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello, world' }],
      model: 'claude-3-opus-20240229',
      metadata: { user_id: '13803d75-b4b5-4c3e-b2a2-6f21399b021b' },
      stop_sequences: ['string', 'string', 'string'],
      stream: false,
      system: "Today's date is 2024-01-01.",
      temperature: 1,
      tools: [
        {
          description: 'Get the current weather in a given location',
          name: 'x',
          input_schema: {
            type: 'object',
            properties: {
              location: { description: 'The city and state, e.g. San Francisco, CA', type: 'string' },
              unit: { description: 'Unit for the output - one of (celsius, fahrenheit)', type: 'string' },
            },
          },
        },
        {
          description: 'Get the current weather in a given location',
          name: 'x',
          input_schema: {
            type: 'object',
            properties: {
              location: { description: 'The city and state, e.g. San Francisco, CA', type: 'string' },
              unit: { description: 'Unit for the output - one of (celsius, fahrenheit)', type: 'string' },
            },
          },
        },
        {
          description: 'Get the current weather in a given location',
          name: 'x',
          input_schema: {
            type: 'object',
            properties: {
              location: { description: 'The city and state, e.g. San Francisco, CA', type: 'string' },
              unit: { description: 'Unit for the output - one of (celsius, fahrenheit)', type: 'string' },
            },
          },
        },
      ],
      top_k: 5,
      top_p: 0.7,
    });
  });
});
