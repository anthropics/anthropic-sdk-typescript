#!/usr/bin/env -S npm run tsn -T

import { AnthropicVertexWeb } from '@anthropic-ai/vertex-sdk/web';

// Reads from the `CLOUD_ML_REGION` & `ANTHROPIC_VERTEX_PROJECT_ID`
// environment variables.
const client = new AnthropicVertexWeb({
  region: '<CLOUD_ML_REGION>',
  projectId: '<ANTHROPIC_VERTEX_PROJECT_ID>',
  clientEmail: '<GOOGLE_SA_CLIENT_EMAIL>',
  privateKey: '<GOOGLE_SA_PRIVATE_KEY>',
});

async function main() {
  const result = await client.messages.create({
    messages: [
      {
        role: 'user',
        content: 'Hello!',
      },
    ],
    model: 'claude-3-sonnet@20240229',
    max_tokens: 300,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
