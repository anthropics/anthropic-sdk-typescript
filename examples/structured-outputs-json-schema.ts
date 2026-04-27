#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';

const NumbersResponse = {
  type: 'object',
  properties: {
    primes: {
      type: 'array',
      items: {
        type: 'number',
      },
    },
  },
  required: ['primes'],
} as const;

async function main() {
  const client = new Anthropic();

  const message = await client.messages.parse({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'What are the first 3 prime numbers?' }],
    output_config: {
      format: jsonSchemaOutputFormat(NumbersResponse),
    },
  });

  console.log('=== Full Message ===');
  console.log(JSON.stringify(message, null, 2));
  console.log('=== Parsed Output ===');
  console.log('\nPrime numbers:', message.parsed_output?.primes);
}

main().catch(console.error);
