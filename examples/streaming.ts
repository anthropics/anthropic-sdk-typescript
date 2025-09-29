#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY

async function main() {
  const stream = client.messages
    .stream({
      messages: [
        {
          role: 'user',
          content: `Hey Claude! How can I recursively list all files in a directory in Rust?`,
        },
      ],
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
    })
    // Once a content block is fully streamed, this event will fire
    .on('contentBlock', (content) => console.log('contentBlock', content))
    // Once a message is fully streamed, this event will fire
    .on('message', (message) => console.log('message', message));

  for await (const event of stream) {
    console.log('event', event);
  }

  const message = await stream.finalMessage();
  console.log('finalMessage', message);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
