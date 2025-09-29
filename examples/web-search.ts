#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function main() {
  console.log('Web Search Example');
  console.log('=================');

  // Create a message with web search enabled
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content:
          "What's the current weather in San Francisco? Please search the web for up-to-date information.",
      },
    ],
    tools: [
      {
        name: 'web_search',
        type: 'web_search_20250305',
      },
    ],
  });

  // Print the full response
  console.log('\nFull response:');
  console.dir(message, { depth: 4 });

  // Extract and print the content
  console.log('\nResponse content:');
  for (const contentBlock of message.content) {
    if (contentBlock.type === 'text') {
      console.log(contentBlock.text);
    }
  }

  // Print usage information
  console.log('\nUsage statistics:');
  console.log(`Input tokens: ${message.usage.input_tokens}`);
  console.log(`Output tokens: ${message.usage.output_tokens}`);

  if (message.usage.server_tool_use) {
    console.log(`Web search requests: ${message.usage.server_tool_use.web_search_requests}`);
  }
}

main().catch(console.error);
