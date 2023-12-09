// File generated from our OpenAPI spec by Stainless.

import Anthropic from '@anthropic-ai/sdk';
import { Response } from 'node-fetch';

const anthropic = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource completions', () => {
  test('create: only required params', async () => {
    const responsePromise = anthropic.completions.create({
      max_tokens_to_sample: 256,
      model: 'claude-2.1',
      prompt: '\n\nHuman: Hello, world!\n\nAssistant:',
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
    const response = await anthropic.completions.create({
      max_tokens_to_sample: 256,
      model: 'claude-2.1',
      prompt: '\n\nHuman: Hello, world!\n\nAssistant:',
      metadata: { user_id: '13803d75-b4b5-4c3e-b2a2-6f21399b021b' },
      stop_sequences: ['string', 'string', 'string'],
      stream: false,
      temperature: 1,
      top_k: 5,
      top_p: 0.7,
    });
  });
});
