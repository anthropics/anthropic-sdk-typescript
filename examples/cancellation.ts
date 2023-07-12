#!/usr/bin/env yarn tsn -T

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

  const stream = await client.completions.create({
    prompt: `${Anthropic.HUMAN_PROMPT}${question}${Anthropic.AI_PROMPT}:`,
    model: 'claude-2',
    stream: true,
    max_tokens_to_sample: 500,
  });

  // If you need to, you can cancel a stream from outside the iterator
  // by calling "stream.controller.abort()"
  const timeout = setTimeout(() => {
    console.log('\nCancelling after 1.5 seconds.');
    stream.controller.abort();
  }, 1500);

  for await (const completion of stream) {
    process.stdout.write(completion.completion);

    // Most typically, you can cancel the stream by using "break"
    if (completion.completion.includes('unwrap')) {
      console.log('\nCancelling after seeing "unwrap".');
      clearTimeout(timeout);
      break;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
