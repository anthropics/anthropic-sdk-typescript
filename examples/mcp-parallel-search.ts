#!/usr/bin/env node

// Run after pnpm install && ./scripts/build: ANTHROPIC_API_KEY=... node examples/mcp-parallel-search.ts
// Parallel Search MCP is free for light use, with no Parallel account or API key:
// https://docs.parallel.ai/integrations/mcp/search-mcp

import Anthropic from '@anthropic-ai/sdk';
import { mcpTools } from '@anthropic-ai/sdk/helpers/beta/mcp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function main() {
  const anthropic = new Anthropic();
  const mcpClient = new Client({ name: 'anthropic-sdk-typescript-parallel-search', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('https://search.parallel.ai/mcp'), {
    requestInit: {
      headers: { 'User-Agent': 'anthropic-sdk-typescript/parallel-search-example' },
    },
  });

  try {
    await mcpClient.connect(transport);
    const { tools } = await mcpClient.listTools();
    const message = await anthropic.beta.messages.toolRunner({
      model: 'claude-sonnet-5-5',
      max_tokens: 1024,
      max_iterations: 6,
      tools: mcpTools(tools, mcpClient),
      messages: [
        {
          role: 'user',
          content:
            'Search for the official Anthropic TypeScript SDK documentation, then fetch a result and summarize how to install the SDK and use its MCP tool helpers. Include source URLs.',
        },
      ],
    });

    for (const block of message.content) {
      if (block.type === 'text') console.log(block.text);
    }
  } finally {
    await mcpClient.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
