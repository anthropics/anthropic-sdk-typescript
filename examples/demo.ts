#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY

async function main() {
  const result = await client.completions.create({
    prompt: `${Anthropic.HUMAN_PROMPT} how does a court case get to the Supreme Court? ${Anthropic.AI_PROMPT}`,
    model: 'claude-3-opus-20240229',
    max_tokens_to_sample: 300,
  });
  console.log(result.completion);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
