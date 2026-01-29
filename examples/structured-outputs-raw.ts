#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

async function main() {
  const client = new Anthropic();

  const message = await client.messages.parse({
    model: 'claude-sonnet-4-5',
    max_tokens: 100,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            answer: { type: 'string', description: 'The final answer' },
          },
          required: ['answer'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'user',
        content: 'What is bigger: 738 * 5678 or 98123 - 2711?',
      },
    ],
  });
  console.log(JSON.stringify(message.parsed_output, null, 2));
}

main().catch(console.error);
