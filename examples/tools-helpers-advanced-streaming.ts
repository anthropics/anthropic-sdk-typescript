#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { BetaToolUseBlock } from '@anthropic-ai/sdk/resources/beta';
import { z } from 'zod';

const client = new Anthropic();

async function main() {
  const runner = client.beta.messages.toolRunner({
    messages: [
      {
        role: 'user',
        content: `I'm planning a trip to San Francisco and I need some information. Can you help me with the weather, current time, and currency exchange rates (from EUR)? Please use parallel tool use`,
      },
    ],
    tools: [
      betaZodTool({
        name: 'getWeather',
        description: 'Get the weather at a specific location',
        inputSchema: z.object({
          location: z.string().describe('The city and state, e.g. San Francisco, CA'),
        }),
        run: ({ location }) => {
          return `The weather is sunny with a temperature of 20°C in ${location}.`;
        },
      }),
      betaZodTool({
        name: 'getTime',
        description: 'Get the current time in a specific timezone',
        inputSchema: z.object({
          timezone: z.string().describe('The timezone, e.g. America/Los_Angeles'),
        }),
        run: ({ timezone }) => {
          return `The current time in ${timezone} is 3:00 PM.`;
        },
      }),
      betaZodTool({
        name: 'getCurrencyExchangeRate',
        description: 'Get the exchange rate between two currencies',
        inputSchema: z.object({
          from_currency: z.string().describe('The currency to convert from, e.g. USD'),
          to_currency: z.string().describe('The currency to convert to, e.g. EUR'),
        }),
        run: ({ from_currency, to_currency }) => {
          return `The exchange rate from ${from_currency} to ${to_currency} is 0.85.`;
        },
      }),
    ],
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 1024,
    // This limits the conversation to at most 10 back and forth between the API.
    max_iterations: 10,
    stream: true,
  });

  console.log(`\n🚀 Running tools...\n`);

  for await (const messageStream of runner) {
    for await (const event of messageStream) {
      switch (event.type) {
        case 'message_start':
          console.log(`┌─ Message ${event.message.id} `.padEnd(process.stdout.columns, '─'));
          console.log();
          break;

        case 'content_block_start':
          switch (event.content_block.type) {
            case 'text':
              // do nothing
              break;
            case 'tool_use':
              process.stdout.write(event.content_block.name + ' ');
              break;
          }
          break;
        case 'content_block_delta':
          switch (event.delta.type) {
            case 'text_delta':
              process.stdout.write(event.delta.text);
              break;
            case 'input_json_delta':
              process.stdout.write(event.delta.partial_json);
              break;
          }
          break;
        case 'content_block_stop':
          process.stdout.write('\n\n');
          break;

        case 'message_stop':
          console.log(`└─`.padEnd(process.stdout.columns, '─'));
          console.log();
          console.log();
          break;
      }
    }

    const message = await messageStream.finalMessage();
    const defaultResponse = await runner.generateToolResponse();
    if (defaultResponse && typeof defaultResponse.content !== 'string') {
      console.log(`┌─ Response `.padEnd(process.stdout.columns, '─'));
      console.log();

      for (const block of defaultResponse.content) {
        if (block.type === 'tool_result') {
          const toolUseBlock = message.content.find((b): b is BetaToolUseBlock => {
            return b.type === 'tool_use' && b.id === block.tool_use_id;
          })!;
          console.log(`${toolUseBlock.name}: ${block.content}`);
        }
      }

      console.log();
      console.log(`└─`.padEnd(process.stdout.columns, '─'));
      console.log();
      console.log();
    }
  }
}

main();
