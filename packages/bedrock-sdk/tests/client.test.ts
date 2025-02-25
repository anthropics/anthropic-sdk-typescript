import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';

test('body params are not mutated', async () => {
  const client = new AnthropicBedrock({
    baseURL: 'http://localhost:5000/',
    awsRegion: 'us-east-1',
    awsAccessKey: 'placeholder',
    awsSecretKey: 'placeholder',
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
