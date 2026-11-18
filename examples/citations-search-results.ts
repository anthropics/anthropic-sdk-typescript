#!/usr/bin/env node

import Anthropic from '@anthropic-ai/sdk';
import assert from 'node:assert';

async function main() {
  const client = new Anthropic();

  const userMessage: Anthropic.MessageParam = {
    role: 'user',
    content:
      'Use the knowledge base to answer: how do I authenticate API requests, and what are the rate limits?',
  };
  const tools: Anthropic.Tool[] = [
    {
      name: 'search_knowledge_base',
      description: 'Search the company knowledge base and return the matching articles',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  ];

  const message = await client.messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: 1024,
    messages: [userMessage],
    tools,
  });

  // This turn only hands off to the tool; the cited answer arrives in the turn after the tool results.
  assert(message.stop_reason === 'tool_use');
  // Claude can search several times in parallel, and every tool_use block needs its own tool_result.
  const toolResults = message.content
    .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
    .map(
      (toolUse): Anthropic.ToolResultBlockParam => ({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: knowledgeBaseResults,
      }),
    );

  const answer = await client.messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: 1024,
    messages: [
      userMessage,
      { role: message.role, content: message.content },
      { role: 'user', content: toolResults },
    ],
    tools,
  });

  for (const block of answer.content) {
    if (block.type !== 'text') continue;

    console.log(block.text);
    for (const citation of block.citations ?? []) {
      if (citation.type === 'search_result_location') {
        console.log(`  - "${citation.cited_text}" (${citation.source})`);
      }
    }
  }
}

// Citations are all-or-nothing: every search_result in a request must enable them, or none may.
const knowledgeBaseResults: Anthropic.SearchResultBlockParam[] = [
  {
    type: 'search_result',
    source: 'https://docs.example.com/api/authentication',
    title: 'API Reference - Authentication',
    content: [
      { type: 'text', text: 'All API requests must include an API key in the x-api-key header.' },
      { type: 'text', text: 'Keys can be generated from the dashboard.' },
    ],
    citations: { enabled: true },
  },
  {
    type: 'search_result',
    source: 'https://docs.example.com/api/rate-limits',
    title: 'API Reference - Rate Limits',
    content: [
      { type: 'text', text: 'The standard tier allows 1,000 requests per hour.' },
      { type: 'text', text: 'The premium tier allows 10,000 requests per hour.' },
    ],
    citations: { enabled: true },
  },
];

main();
