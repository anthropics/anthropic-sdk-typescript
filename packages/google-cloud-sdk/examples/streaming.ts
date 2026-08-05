#!/usr/bin/env -S npm run tsn -T

import AnthropicGoogleCloud from '@anthropic-ai/google-cloud-sdk';

// Authenticates with Application Default Credentials (e.g. after
// `gcloud auth application-default login`). The project comes from
// ANTHROPIC_GOOGLE_CLOUD_PROJECT or, when unset, is resolved from the
// Google credentials. Requires ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID in the
// environment before running this example.
// `location` is optional and defaults to 'global'.
const anthropic = new AnthropicGoogleCloud({});

async function main() {
  const stream = anthropic.messages.stream({
    model: 'claude-haiku-4-5',
    messages: [
      {
        role: 'user',
        content: 'Hello!',
      },
    ],
    max_tokens: 300,
  });
  stream.on('text', (text) => {
    process.stdout.write(text);
  });

  const message = await stream.finalMessage();
  console.log('\n', message);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
