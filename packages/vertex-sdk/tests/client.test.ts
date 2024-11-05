import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import Anthropic from '@anthropic-ai/sdk';

test('body params are not mutated', async () => {
  const client = new AnthropicVertex({
    baseURL: 'http://localhost:5000/',
    accessToken: 'placeholder',
    region: 'us-east-2',
    projectId: 'placeholder',
    fetch: (url) => {
      return Promise.resolve(
        new Response(JSON.stringify({ url, custom: true }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    },
  });

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: 'claude-3-opus-latest',
    messages: [],
    max_tokens: 100,
  };
  const original = JSON.stringify(params);

  await client.messages.create(params);

  expect(JSON.stringify(params)).toEqual(original);
});
