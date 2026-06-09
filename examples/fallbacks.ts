#!/usr/bin/env -S npm run tsn -T

import { Anthropic, BetaFallbackState, betaRefusalFallbackMiddleware } from '@anthropic-ai/sdk';

async function main() {
  // 1. Server-side fallbacks (preferred): the API retries a refusal itself —
  // one request, a plain client, no client-side logic. Use this when talking
  // to the API directly.
  const client = new Anthropic();
  const served = await client.beta.messages.create({
    model: 'claude-fable-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Some prompt that triggers a refusal' }],
    fallbacks: [{ model: 'claude-opus-4-8' }],
    betas: ['server-side-fallback-2026-06-01'],
  });
  console.log('server-side, served by:', served.model);

  // If your provider doesn't support server-side fallbacks, register the
  // client-side middleware instead:
  const fallbackClient = new Anthropic({
    middleware: [betaRefusalFallbackMiddleware([{ model: 'claude-opus-4-8' }])],
  });
  const state = new BetaFallbackState(); // pins follow-ups to the model that accepted

  // 2. Streaming: on a refusal the middleware retries and splices the
  // fallback's events onto the open stream — one continuous message, with a
  // `fallback` content block marking the model boundary.
  const stream = fallbackClient.beta.messages.stream(
    {
      model: 'claude-fable-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Some prompt that triggers a refusal' }],
    },
    { fallbackState: state },
  );
  stream.on('text', (text) => process.stdout.write(text));
  stream.on('streamEvent', (event) => {
    if (event.type === 'content_block_start' && event.content_block.type === 'fallback') {
      const { from, to } = event.content_block;
      console.log(`\n--- fell back: ${from.model} -> ${to.model} ---`);
    }
  });
  console.log('\nstreaming, served by:', (await stream.finalMessage()).model);

  // 3. Non-streaming: same middleware, the retry just happens before you
  // get the message back.
  const message = await fallbackClient.beta.messages.create(
    {
      model: 'claude-fable-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Some prompt that triggers a refusal' }],
    },
    { fallbackState: state }, // reusing the state keeps the conversation pinned
  );
  console.log('non-streaming, served by:', message.model);
}

main();
