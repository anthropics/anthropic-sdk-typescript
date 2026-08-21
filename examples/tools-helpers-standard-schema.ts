#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';
import { betaStandardSchemaTool } from '@anthropic-ai/sdk/helpers/beta/standard-schema';
import * as v from 'valibot';
import { toStandardJsonSchema } from '@valibot/to-json-schema';

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
      // Any library implementing Standard Schema works here (Valibot, ArkType, Zod, ...).
      betaStandardSchemaTool({
        name: 'getWeather',
        description: 'Get the weather at a specific location',
        inputSchema: toStandardJsonSchema(
          v.object({
            location: v.pipe(v.string(), v.description('The city and state, e.g. San Francisco, CA')),
          }),
        ),
        run: ({ location }) => {
          return `The weather is foggy with a temperature of 20°C in ${location}.`;
        },
      }),
    ],
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    // the maximum number of iterations to run the tool
    max_iterations: 10,
  });

  console.log('Final response:', message.content);
}

main();
