#!/usr/bin/env node

import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';

const client = new Anthropic();

const lookupOrder = betaTool({
  name: 'lookup_order',
  description: 'Look up the shipping status of an order',
  inputSchema: { type: 'object', properties: { order_id: { type: 'string' } }, required: ['order_id'] },
  run: ({ order_id }) => `Order ${order_id} shipped two days ago and arrives tomorrow.`,
});

async function main() {
  const thread = client.beta.messages.thread({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: 'You are a support agent for Acme. Keep replies short.',
    tools: [lookupOrder],
  });

  // Each turn sends only the new messages; the server holds the rest of the conversation.
  const first = await thread.send({ role: 'user', content: 'Hi! I have a question about an order.' });
  console.dir(first.content, { depth: null });

  // `stream()` sends a turn the same way and streams the reply as it arrives.
  const stream = thread.stream({
    role: 'user',
    content: 'Before I find the order number: how long does standard shipping usually take?',
  });
  stream.on('text', (text) => process.stdout.write(text));
  await stream.done();
  console.log();

  // A turn that may call `lookup_order` goes through the tool runner, which continues the same thread and answers
  // the tool calls.
  thread.append({
    role: 'user',
    content: "It's order #4821 and it hasn't arrived. Can you check where it is?",
  });
  const final = await thread.toolRunner().runUntilDone();
  console.dir(final.content, { depth: null });

  // The streaming runner yields one stream per turn and still answers any tool calls in between.
  thread.append({ role: 'user', content: "Thanks. What should I do if it isn't here by then?" });
  for await (const stream of thread.toolRunner({ stream: true })) {
    stream.on('text', (text) => process.stdout.write(text));
    await stream.done();
    console.log();
  }

  // `fork()` copies the thread. The fork's first turn starts a new server-side thread from the same history, and the
  // two continue independently from then on.
  const cancellation = thread.fork();
  cancellation.append({
    role: 'user',
    content: "Actually, I'd rather cancel the order and get a refund.",
  });
  console.dir((await cancellation.toolRunner().runUntilDone()).content, { depth: null });
  console.dir((await thread.send({ role: 'user', content: "Great, I'll wait for it. Thanks!" })).content, {
    depth: null,
  });

  // `model`, `system`, `tools`, ... are fixed for a thread's lifetime; start a new one from the history to change them.
  const escalation = client.beta.messages.thread({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: 'You are a senior support agent for Acme. Decide whether to refund, and say why in one sentence.',
    tools: [lookupOrder],
    messages: cancellation.messages,
  });
  const decision = await escalation.send({ role: 'user', content: 'Can you approve the refund?' });
  console.dir(decision.content, { depth: null });
}

main();
