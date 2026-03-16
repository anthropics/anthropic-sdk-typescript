#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';
import { betaMemoryTool } from '@anthropic-ai/sdk/helpers/beta/memory';
import type { BetaContextManagementConfig } from '@anthropic-ai/sdk/resources/beta';
import { BetaLocalFilesystemMemoryTool } from '@anthropic-ai/sdk/tools/memory/node';

const client = new Anthropic();

const MESSAGE = 'Remember that I like TypeScript';
const CONTEXT_MANAGEMENT = {
  edits: [
    {
      type: 'clear_tool_uses_20250919',
      // The below parameters are OPTIONAL:
      // Trigger clearing when threshold is exceeded
      trigger: { type: 'input_tokens', value: 30000 },
      // Number of tool uses to keep after clearing
      keep: { type: 'tool_uses', value: 3 },
      // Optional: Clear at least this many tokens
      clear_at_least: { type: 'input_tokens', value: 5000 },
      // Exclude these tools uses from being cleared
      exclude_tools: ['web_search'],
    },
  ],
} satisfies BetaContextManagementConfig;

async function main() {
  const fs = await BetaLocalFilesystemMemoryTool.init('./memory');
  const memory = betaMemoryTool(fs);

  const runner = client.beta.messages.toolRunner({
    messages: [
      {
        role: 'user',
        content: MESSAGE,
      },
    ],
    tools: [memory],
    model: 'claude-sonnet-4-20250514',
    context_management: CONTEXT_MANAGEMENT,
    betas: ['context-management-2025-06-27'],
    max_tokens: 1024,
    // the maximum number of iterations to run the tool
    max_iterations: 10,
  });

  for await (const message of runner) {
    console.dir(message, { depth: 4 });
    console.log(await runner.generateToolResponse());
    console.log('---');
  }

  console.log(await runner.runUntilDone());
}

main();
