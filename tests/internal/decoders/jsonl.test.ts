import http from 'node:http';
import type { AddressInfo } from 'node:net';
import v8 from 'node:v8';
import vm from 'node:vm';
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

test('garbage collection closes an unread decoder that was dropped, not one that is held', async () => {
  v8.setFlagsFromString('--expose-gc');
  const gc: () => void = vm.runInNewContext('gc');

  // Left open, so that only the client can close them.
  const responses: http.ServerResponse[] = [];
  const server = http.createServer((_, res) => {
    responses.push(res);
    res.write('{"n":0}\n');
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  onTestFinished(() => server.close().closeAllConnections());

  const { port } = server.address() as AddressInfo;
  const request = async () =>
    JSONLDecoder.fromResponse(await fetch(`http://localhost:${port}`), new AbortController());

  const held = await request();
  // In its own frame, so that this one cannot keep the decoder alive.
  await (async () => void (await request()))();
  await expect.poll(() => (gc(), responses[1]!.destroyed), { timeout: 20_000 }).toBe(true);

  responses[0]!.end('{"n":1}\n');
  expect(await collect(held)).toEqual([{ n: 0 }, { n: 1 }]);
}, 30_000);
