#!/usr/bin/env node

import { createInterface } from 'node:readline/promises';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';

async function confirm(question: string): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(question);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    prompt.close();
  }
}

async function main() {
  const client = new Anthropic();

  const runner = client.beta.messages.toolRunner({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    max_iterations: 10,
    stream: true,
    runToolsEagerly: true,
    messages: [
      {
        role: 'user',
        content: 'List the files in /tmp/demo, then delete the ones that end in .log.',
      },
    ],
    tools: [
      betaZodTool({
        name: 'listFiles',
        description: 'List the files in a directory',
        inputSchema: z.object({ directory: z.string() }),
        run: ({ directory }) => `${directory}/app.log\n${directory}/notes.txt`,
      }),
      betaZodTool({
        name: 'deleteFile',
        description: 'Delete a file',
        inputSchema: z.object({ path: z.string() }),
        run: ({ path }) => `Deleted ${path}.`,
      }),
    ],
  });

  for await (const messageStream of runner) {
    // `listFiles` starts while the reply is still streaming. A `deleteFile` call waits for the answer below.
    messageStream.on('contentBlock', (block) => {
      if (block.type === 'tool_use' && block.name === 'deleteFile') {
        runner.deferToolCall(block);
      }
    });
    messageStream.on('text', (text) => process.stdout.write(text));

    await messageStream.finalMessage();

    const held = runner.deferredToolCalls;
    if (held.length === 0) continue;

    console.log('\nThe model wants to run:');
    for (const toolUse of held) {
      console.log(`  ${toolUse.name}(${JSON.stringify(toolUse.input)})`);
    }
    if (!(await confirm('Allow? [y/N] '))) {
      console.log('Stopped before running them.');
      break;
    }
    // The held calls start when this loop body ends.
  }
}

main();
