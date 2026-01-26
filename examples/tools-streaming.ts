#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';
import { inspect } from 'util';

// gets API Key from environment variable ANTHROPIC_API_KEY
const client = new Anthropic();

async function main() {
  const stream = client.messages
    .stream({
      messages: [
        {
          role: 'user',
          content: `What is the weather in SF?`,
        },
      ],
      tools: [
        {
          name: 'get_weather',
          description: 'Get the weather at a specific location',
          input_schema: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'The city and state, e.g. San Francisco, CA' },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'Unit for the output',
              },
            },
            required: ['location'],
          },
        },
      ],
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
    })
    // When a JSON content block delta is encountered this
    // event will be fired with the delta and the currently accumulated object
    .on('inputJson', (delta, snapshot) => {
      console.log(`delta: ${delta}`);
      console.log(`snapshot: ${inspect(snapshot)}`);
      console.log();
    });

  await stream.done();
}

main();
