#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY

const main = async () => {
  const stream = anthropic.beta.messages.stream(
    {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      mcp_servers: [
        {
          type: 'url',
          url: 'http://example-server.modelcontextprotocol.io/sse',
          name: 'example',
          authorization_token: 'YOUR_TOKEN',
          tool_configuration: {
            // Optional, defaults to allowing all tools
            enabled: true, // Optional
            allowed_tools: ['echo', 'add'], // Optional
          },
        },
      ],
      messages: [
        {
          role: 'user',
          content: 'Calculate 1+2',
        },
      ],
    },
    {
      headers: {
        'anthropic-beta': 'mcp-client-2025-04-04',
      },
    },
  );
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
    }
  }
  process.stdout.write('\n');
};
main();
