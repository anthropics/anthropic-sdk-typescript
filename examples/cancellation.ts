#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

/**
 * This script demonstrates two ways of cancelling a stream,
 * by racing to see whether some Rust code prints "unwrap"
 * before 1.5 seconds or not.
 *
 * The most common is simply to `break` from the loop,
 * but you can also call `stream.controller.abort()` from outside the loop
 * if you need to.
 */
async function main() {
  const question = 'Hey Claude! How can I recursively list all files in a directory in Rust?';

  const stream = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    stream: true,
    max_tokens: 500,
    messages: [{ role: 'user', content: question }],
  });

  // If you need to, you can cancel a stream from outside the iterator
  // by calling "stream.controller.abort()"
  const timeout = setTimeout(() => {
    console.log('\nCancelling after 1.5 seconds.');
    stream.controller.abort();
  }, 1500);

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);

      // Most typically, you can cancel the stream by using "break"
      if (event.delta.text.includes('unwrap')) {
        console.log('\nCancelling after seeing "unwrap".');
        clearTimeout(timeout);
        break;
      }
    }
  }
}

main();
