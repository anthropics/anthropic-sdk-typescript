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
    model: 'claude-3-opus-20240229',
    max_tokens: 1024,
  });
  console.dir(result);
}

main();
