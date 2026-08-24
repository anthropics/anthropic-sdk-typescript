// What noUncheckedIndexedAccess adds; the common checks are in shared/type-tests.ts.
import Anthropic from '@anthropic-ai/sdk';

export async function uncheckedIndexedAccess() {
  const message = await new Anthropic().messages.create({
    model: 'mock-model',
    max_tokens: 1,
    messages: [{ role: 'user', content: 'Hi' }],
  });
  // @ts-expect-error noUncheckedIndexedAccess: content may be empty
  message.content[0].type;
}
