// TypeScript 5.0 syntax against the SDK's types; the common checks are in shared/type-tests.ts.
import Anthropic from '@anthropic-ai/sdk';
import type {
  Message,
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
} from '@anthropic-ai/sdk/resources/messages';

const client = new Anthropic();
const messages = [{ role: 'user' as const, content: 'Hi' }];

// `satisfies` against the exported param types keeps literal inference for `stream`
export async function satisfiesParams() {
  const nonStreaming = {
    model: 'mock-model',
    max_tokens: 1,
    messages,
  } satisfies MessageCreateParamsNonStreaming;
  const reply: Message = await client.messages.create(nonStreaming);
  const streaming = { ...nonStreaming, stream: true } satisfies MessageCreateParamsStreaming;
  // @ts-expect-error the streaming overload returns a Stream, not a Message
  const notAMessage: Message = await client.messages.create(streaming);
  void [reply, notAMessage];
}
