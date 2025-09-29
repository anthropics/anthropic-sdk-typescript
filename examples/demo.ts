#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY

async function main() {
  const result = await client.messages.create({
    messages: [
      {
        role: 'user',
        content: 'Hey Claude!?',
      },
    ],
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
  });
  console.dir(result);
}

main();
