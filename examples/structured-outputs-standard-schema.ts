#!/usr/bin/env -S npm run tsn -T

import { betaStandardSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/beta/standard-schema';
import Anthropic from '@anthropic-ai/sdk';
import * as v from 'valibot';
import { toStandardJsonSchema } from '@valibot/to-json-schema';

// Any library implementing Standard Schema works here (Valibot, ArkType, Zod, ...).
const NumbersResponse = toStandardJsonSchema(
  v.object({
    primes: v.array(v.number()),
  }),
);

async function main() {
  const client = new Anthropic();

  const message = await client.beta.messages.parse({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'What are the first 3 prime numbers?' }],
    output_config: {
      format: betaStandardSchemaOutputFormat(NumbersResponse),
    },
  });

  console.log('=== Full Message ===');
  console.log(JSON.stringify(message, null, 2));
  console.log('=== Parsed Output ===');
  console.log('\nPrime numbers:', message.parsed_output!.primes);
}

main();
