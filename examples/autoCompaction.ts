#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY

async function main() {
  const search = {
    name: 'search',
    description: 'Search for information.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string' as const,
        },
      },
      required: ['query'],
    },
    run: async (input: { query: string }) => {
      return JSON.stringify({
        results: [
          { title: `Result for ${input.query}`, content: 'Lorem ipsum '.repeat(100) },
          { title: `More on ${input.query}`, content: 'Detailed info '.repeat(100) },
        ],
      });
    },
  };

  const done = {
    name: 'done',
    description: 'Call when finished.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: {
          type: 'string' as const,
        },
      },
      required: ['summary'],
    },
    run: async (_input: { summary: string }) => {
      return 'Complete';
    },
  };

  const runner = client.beta.messages.toolRunner({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    tools: [search, done],
    messages: [
      {
        role: 'user',
        content:
          'You MUST search for EACH of these animals ONE BY ONE: dogs, cats, birds, fish, horses, elephants, lions, tigers, bears, wolves. ' +
          'After searching for ALL of them, call done.',
      },
    ],
    compactionControl: {
      enabled: true,
      contextTokenThreshold: 3000, // Even lower threshold
    },
  });

  let prevMsgCount = 0;
  let i = 0;
  for await (const message of runner) {
    i++;
    const currMsgCount = runner.params.messages.length;
    console.log(`Turn ${i}: ${message.usage.input_tokens} input tokens, ${currMsgCount} messages`);

    if (currMsgCount < prevMsgCount) {
      console.log('='.repeat(70));
      console.log('🔄 COMPACTION OCCURRED!');
      console.log('='.repeat(70));
      console.log(`Messages went from ${prevMsgCount} → ${currMsgCount}`);
      console.log(`Input tokens: ${message.usage.input_tokens}`);
      console.log('\nNEW MESSAGES LIST:');
      console.log('-'.repeat(70));

      for (const msg of runner.params.messages) {
        const role = msg.role || '?';
        const content = msg.content;

        if (Array.isArray(content)) {
          for (const block of content) {
            if (typeof block === 'object' && block.type === 'text') {
              console.log(`\n[${role}] TEXT BLOCK:`);
              console.log(block.text);
            }
          }
        } else if (typeof content === 'string') {
          console.log(`\n[${role}]:`);
          console.log(content);
        }
      }

      console.log('-'.repeat(70));
    }

    prevMsgCount = currMsgCount;
  }

  console.log('\n✅ Done!');
}

main();
