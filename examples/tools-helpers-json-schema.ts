#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';

const client = new Anthropic();

async function main() {
  const message = await client.beta.messages.toolRunner({
    messages: [
      {
        role: 'user',
        content: `What is the weather in SF?`,
      },
    ],
    tools: [
      betaTool({
        name: 'getWeather',
        description: 'Get the weather at a specific location',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
          },
          required: ['location'],
        },
        run: ({ location }) => {
          return `The weather is foggy with a temperature of 20°C in ${location}.`;
        },
      }),
    ],
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 1024,
    // the maximum number of iterations to run the tool
    max_iterations: 10,
  });

  console.log('Final response:', message.content);
}

main();
