#!/usr/bin/env -S npm run tsn -T

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const WeatherResponse = z.object({
  city: z.string(),
  temperature: z.number(),
  conditions: z.array(z.string()),
  forecast: z.array(
    z.object({
      day: z.string(),
      high: z.number(),
      low: z.number(),
      condition: z.string(),
    }),
  ),
});

async function main() {
  const client = new Anthropic();

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Provide a weather report for San Francisco.' }],
    output_config: {
      format: zodOutputFormat(WeatherResponse),
    },
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
    }
  }

  // Get the final parsed result
  const finalMessage = await stream.finalMessage();

  console.log('\n\n=== Final Parsed Results ===');
  console.log('City:', finalMessage.parsed_output?.city);
  console.log('Temperature:', finalMessage.parsed_output?.temperature);
  console.log('Conditions:', finalMessage.parsed_output?.conditions);
  console.log('Forecast:', finalMessage.parsed_output?.forecast);
}

main().catch(console.error);
