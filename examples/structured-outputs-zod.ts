#!/usr/bin/env -S npm run tsn -T

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const NumbersResponse = z.object({
  primes: z.array(z.number()),
});

async function main() {
  const client = new Anthropic();

  const message = await client.messages.parse({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'What are the first 3 prime numbers?' }],
    output_config: {
      format: zodOutputFormat(NumbersResponse),
    },
  });

  console.log('=== Full Message ===');
  console.log(JSON.stringify(message, null, 2));
  console.log('=== Parsed Output ===');
  console.log('\nPrime numbers:', message.parsed_output!.primes);
}

main().catch(console.error);
