#!/usr/bin/env -S npm run tsn -T

import AnthropicFoundry from '@anthropic-ai/foundry-sdk';

// Make sure to set the ANTHROPIC_FOUNDRY_API_KEY and ANTHROPIC_FOUNDRY_RESOURCE
// environment variables before running this example.
const anthropic = new AnthropicFoundry({});

async function main() {
  const message = await anthropic.messages.create({
    model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    messages: [
      {
        role: 'user',
        content: 'Hello!',
      },
    ],
    max_tokens: 1024,
  });
  console.log(message);
}

main();
