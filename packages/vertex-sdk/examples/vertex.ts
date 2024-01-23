#!/usr/bin/env -S npm run tsn -T

import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';

// Reads from the `CLOUD_ML_REGION` & `ANTHROPIC_VERTEX_PROJECT_ID`
// environment variables.
const client = new AnthropicVertex();

async function main() {
  const result = await client.beta.messages.create({
    messages: [
      {
        role: 'user',
        content: 'Hello!',
      },
    ],
    model: 'claude-instant-1p2',
    max_tokens: 300,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
