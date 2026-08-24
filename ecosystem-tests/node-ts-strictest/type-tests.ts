// What the extra strictness flags change for SDK users; the common checks are in shared/type-tests.ts.
import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';

const client = new Anthropic();
const messages = [{ role: 'user' as const, content: 'Hi' }];

export async function strictFlags() {
  const message = await client.messages.create({ model: 'mock-model', max_tokens: 1, messages });
  // @ts-expect-error noUncheckedIndexedAccess: content[0] is possibly undefined
  message.content[0].type;
  const block = message.content[0];
  if (block?.type === 'text') block.text.toUpperCase();

  try {
    await client.messages.create({ model: 'mock-error', max_tokens: 1, messages });
  } catch (err) {
    // @ts-expect-error useUnknownInCatchVariables: must narrow before reading APIError fields
    err.status;
    if (err instanceof Anthropic.APIError) void (err.status satisfies number | undefined);
  }
}

// exactOptionalPropertyTypes: `prop: undefined` is only allowed where the declaration says `?: T | undefined`.
// ClientOptions are declared that way, so forwarding possibly-undefined config compiles:
export const configured = new Anthropic({
  apiKey: 'type-tests',
  baseURL: undefined,
  maxRetries: undefined,
  timeout: undefined,
  fetch: undefined,
  defaultHeaders: undefined,
});

// ...but generated request params and per-request options are plain `?: T`, so the common
// `{ system: maybeSystem }` pattern does not; callers must omit the key (or spread conditionally).
export async function exactOptionalPropertyTypes(system: string | undefined) {
  // @ts-expect-error `system?: string | Array<TextBlockParam>` does not admit an explicit undefined
  await client.messages.create({ model: 'mock-model', max_tokens: 1, messages, system });
  // @ts-expect-error nor does `temperature?: number`
  await client.messages.create({ model: 'mock-model', max_tokens: 1, messages, temperature: undefined });
  // @ts-expect-error RequestOptions `maxRetries?: number`, unlike ClientOptions `maxRetries?: number | undefined`
  await client.messages.create({ model: 'mock-model', max_tokens: 1, messages }, { maxRetries: undefined });
  // @ts-expect-error RequestOptions `timeout?: number`
  await client.messages.create({ model: 'mock-model', max_tokens: 1, messages }, { timeout: undefined });
  // these RequestOptions are declared `| undefined | null`
  await client.messages.create(
    { model: 'mock-model', max_tokens: 1, messages },
    { signal: undefined, headers: undefined },
  );

  const params: MessageCreateParamsNonStreaming = {
    model: 'mock-model',
    max_tokens: 1,
    messages,
    ...(system !== undefined && { system }),
  };
  await client.messages.create(params);
}
