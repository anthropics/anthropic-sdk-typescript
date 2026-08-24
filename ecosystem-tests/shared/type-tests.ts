// Copied into every project as ./shared/ and only ever type-checked, under that project's compiler
// and tsconfig. An unused `@ts-expect-error` is itself a compile error, so each one asserts that
// the SDK's published types reject the misuse below it.
import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages';

const client = new Anthropic();
const messages = [{ role: 'user' as const, content: 'Hi' }];

export async function typeTests() {
  // @ts-expect-error max_tokens is required
  await client.messages.create({ model: 'mock-model', messages });

  await client.messages.create({
    model: 'mock-model',
    max_tokens: 1,
    // @ts-expect-error 'robot' is not a valid role
    messages: [{ role: 'robot', content: 'Hi' }],
  });

  // @ts-expect-error model must be a string
  await client.messages.create({ model: 123, max_tokens: 1, messages });

  // @ts-expect-error unknown top-level parameter
  await client.messages.create({ model: 'mock-model', max_tokens: 1, messages, temperatur: 0.5 });

  const message: Message = await client.messages.create({ model: 'mock-model', max_tokens: 1, messages });
  const block = message.content[0]!;
  // @ts-expect-error content is a union of block types; `.text` needs narrowing on `.type`
  block.text.toUpperCase();
  if (block.type === 'text') block.text.toUpperCase();

  const role: 'assistant' = message.role;
  void role;

  const stream = await client.messages.create({ model: 'mock-model', max_tokens: 1, messages, stream: true });
  for await (const event of stream) {
    // @ts-expect-error not a real event type
    if (event.type === 'content_block_bogus') break;
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta')
      event.delta.text.toUpperCase();
  }
}
