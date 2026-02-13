#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY

async function main() {
  console.log('Structured Output Examples');
  console.log('==========================');
  console.log();

  // Non-streaming example
  console.log('Non-streaming structured output:');
  console.log('--------------------------------');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'What are the ingredients for a vegetarian lasagna recipe for 4 people?',
      },
    ],
    tools: [
      {
        name: 'json',
        description: 'Respond with a JSON object',
        input_schema: {
          type: 'object',
          properties: {
            ingredients: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['ingredients'],
          additionalProperties: false,
        },
      },
    ],
    // Force the model to use the json tool - this is the key to structured output
    tool_choice: { type: 'tool', name: 'json' },
  });

  // Extract the structured output from the tool_use block
  const toolUseBlock = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );

  if (toolUseBlock && toolUseBlock.name === 'json') {
    console.log('\nStructured output:');
    console.dir(toolUseBlock.input, { depth: 4 });
  }

  console.log();
  console.log();

  // Streaming example
  console.log('Streaming structured output:');
  console.log('---------------------------');

  const stream = client.messages
    .stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: 'List 5 famous landmarks in Paris with their construction years.',
        },
      ],
      tools: [
        {
          name: 'json',
          description: 'Respond with a JSON object',
          input_schema: {
            type: 'object',
            properties: {
              landmarks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    year: { type: 'number' },
                  },
                  required: ['name', 'year'],
                },
              },
            },
            required: ['landmarks'],
            additionalProperties: false,
          },
        },
      ],
      // Force the model to use the json tool
      tool_choice: { type: 'tool', name: 'json' },
    })
    // When a JSON content block delta is encountered this
    // event will be fired with the delta and the currently accumulated object
    .on('inputJson', (delta, snapshot) => {
      console.log('Delta:', delta);
      console.log('Current snapshot:', snapshot);
      console.log();
    });

  await stream.done();

  const finalMessage = await stream.finalMessage();
  const streamingToolBlock = finalMessage.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );

  if (streamingToolBlock && streamingToolBlock.name === 'json') {
    console.log('\nFinal structured output:');
    console.dir(streamingToolBlock.input, { depth: 4 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
