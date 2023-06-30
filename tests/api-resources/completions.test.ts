// File generated from our OpenAPI spec by Stainless.

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: 'something1234',
  baseURL: 'http://127.0.0.1:4010',
  authToken: 'my-auth-token',
});

describe('resource completions', () => {
  test('create: only required params', async () => {
    const response = await anthropic.completions.create({
      max_tokens_to_sample: 256,
      model: 'claude-1',
      prompt: '\n\nHuman: Hello, world!\n\nAssistant:',
    });
  });

  test('create: required and optional params', async () => {
    const response = await anthropic.completions.create({
      max_tokens_to_sample: 256,
      model: 'claude-1',
      prompt: '\n\nHuman: Hello, world!\n\nAssistant:',
      metadata: { user_id: '13803d75-b4b5-4c3e-b2a2-6f21399b021b' },
      stop_sequences: ['string', 'string', 'string'],
      stream: false,
      temperature: 0.7,
      top_k: 5,
      top_p: 0.7,
    });
  });
});
