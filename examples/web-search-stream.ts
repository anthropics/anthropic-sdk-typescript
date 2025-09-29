#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function main() {
  console.log('Claude with Web Search (Streaming)');
  console.log('==================================');

  // Create a stream with web search enabled
  const stream = client.messages
    .stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: "What's the weather in New York?",
        },
      ],
      tools: [
        {
          name: 'web_search',
          type: 'web_search_20250305',
        },
      ],
    })
    .on('text', (text) => {
      // Print text as it arrives
      process.stdout.write(text);
    })
    .on('streamEvent', (event) => {
      // Track when web search is being used
      if (event.type === 'content_block_start' && event.content_block.type === 'web_search_tool_result') {
        process.stdout.write('\n[Web search started...]');
      }
    });

  // Wait for the stream to complete
  const message = await stream.finalMessage();

  console.log('\n\nFinal usage statistics:');
  console.log(`Input tokens: ${message.usage.input_tokens}`);
  console.log(`Output tokens: ${message.usage.output_tokens}`);

  if (message.usage.server_tool_use) {
    console.log(`Web search requests: ${message.usage.server_tool_use.web_search_requests}`);
  } else {
    console.log('No web search requests recorded in usage');
  }

  // Display message content types for debugging
  console.log('\nMessage Content Types:');
  message.content.forEach((block, i) => {
    console.log(`Content Block ${i + 1}: Type = ${block.type}`);
  });

  // Show full message for debugging
  console.log('\nComplete message structure:');
  console.dir(message, { depth: 4 });
}

main().catch(console.error);
