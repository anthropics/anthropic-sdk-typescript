#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY

async function main() {
  const stream = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    stream: true,
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: 'Hey Claude!',
      },
    ],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
    }
  }
  process.stdout.write('\n');
}

main();
