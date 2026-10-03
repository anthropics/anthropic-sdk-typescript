import { AnthropicError } from '@anthropic-ai/sdk/core/error';
import { JSONLDecoder } from '@anthropic-ai/sdk/internal/decoders/jsonl';
import { ReadableStreamFrom } from '@anthropic-ai/sdk/internal/shims';

function decodeResponse(): JSONLDecoder<{ n: number }> {
  const chunks = ['{"n":0}\n', '{"n":1}\n', '{"n":2}\n'].map((line) => Buffer.from(line));
  return JSONLDecoder.fromResponse(new Response(ReadableStreamFrom(chunks)), new AbortController());
}

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const item of items) {
    collected.push(item);
  }
  return collected;
}

describe('a second iteration throws', () => {
  const consumed = new AnthropicError('Cannot iterate over a consumed stream.');

  test('after the first one read to the end', async () => {
    const decoder = decodeResponse();
    expect(await collect(decoder)).toEqual([{ n: 0 }, { n: 1 }, { n: 2 }]);

    await expect(collect(decoder)).rejects.toThrow(consumed);
  });

  test('after the first one stopped early', async () => {
    const decoder = decodeResponse();
    for await (const item of decoder) {
      expect(item).toEqual({ n: 0 });
      break;
    }

    await expect(collect(decoder)).rejects.toThrow(consumed);
  });

  test('while the first one is still open', async () => {
    const decoder = decodeResponse();
    const first = decoder[Symbol.asyncIterator]();
    expect(await first.next()).toEqual({ done: false, value: { n: 0 } });

    await expect(collect(decoder)).rejects.toThrow(consumed);
    expect(await first.next()).toEqual({ done: false, value: { n: 1 } });
  });
});
