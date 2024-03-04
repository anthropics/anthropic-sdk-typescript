#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY

async function main() {
  const question = 'Hey Claude! How can I recursively list all files in a directory in Rust?';

  const stream = await client.completions.create({
    prompt: `${Anthropic.HUMAN_PROMPT}${question}${Anthropic.AI_PROMPT}:`,
    model: 'claude-3-opus-20240229',
    stream: true,
    max_tokens_to_sample: 500,
  });

  for await (const completion of stream) {
    process.stdout.write(completion.completion);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
