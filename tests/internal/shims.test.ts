import http from 'node:http';
import type { AddressInfo } from 'node:net';
import v8 from 'node:v8';
import vm from 'node:vm';
import Anthropic from '@anthropic-ai/sdk';
import type { APIPromise } from '@anthropic-ai/sdk/core/api-promise';
import { Stream } from '@anthropic-ai/sdk/core/streaming';
import { JSONLDecoder } from '@anthropic-ai/sdk/internal/decoders/jsonl';

type Item = { n: number };

type Streamed = AsyncIterable<Item> & { controller: AbortController };

// The server's end of a response: it sends item 0 right away, then stays open.
type Connection = { closed: boolean; send: () => void };

v8.setFlagsFromString('--expose-gc');
const gc: () => void = vm.runInNewContext('gc');

describe('dropped streams', { timeout: 60_000 }, () => {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);
  let server: http.Server;
  let client: Anthropic;
  let lastConnection: Connection;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let n = 0;
      const connection: Connection = {
        closed: false,
        send: () => {
          const item = JSON.stringify({ n: n++ });
          res.write(req.url === '/jsonl' ? item + '\n' : 'event: unhandled\ndata: ' + item + '\n\n');
        },
      };
      res.on('close', () => (connection.closed = true));
      lastConnection = connection;
      connection.send();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    client = new Anthropic({
      baseURL: `http://localhost:${(server.address() as AddressInfo).port}`,
      apiKey: 'my-anthropic-api-key',
    });
    process.on('unhandledRejection', onRejection);
  });

  afterAll(() => {
    process.off('unhandledRejection', onRejection);
    server.closeAllConnections();
    server.close();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    expect(rejections.splice(0)).toEqual([]);
  });

  const requestStream = () => client.get('/sse', { stream: true }) as APIPromise<Stream<Item>>;

  const requestJSONL = () =>
    client
      .get('/jsonl', { stream: true, __binaryResponse: true })
      ._thenUnwrap((_, props) => JSONLDecoder.fromResponse<Item>(props.response, props.controller));

  const text = (chunk: { value?: Uint8Array | undefined }) => new TextDecoder().decode(chunk.value);

  // Opens the stream itself so that no caller's frame can keep it alive.
  async function readOneThenDrop(open: () => PromiseLike<AsyncIterable<Item>>): Promise<void> {
    expect(await (await open())[Symbol.asyncIterator]().next()).toEqual({ done: false, value: { n: 0 } });
  }

  const expectClosedAfterGC = (connection: Connection) =>
    expect.poll(() => (gc(), connection.closed), { timeout: 20_000, interval: 10 }).toBe(true);

  // Once a stream that was dropped here is closed, whatever was dropped earlier has been collected too.
  async function collectGarbage(): Promise<void> {
    await readOneThenDrop(requestStream);
    await expectClosedAfterGC(lastConnection);
  }

  test('can be read where there is no FinalizationRegistry', async () => {
    // Made first: Node 20 loads its fetch at the first use, which needs the global.
    const { body } = new Response('body');
    vi.stubGlobal('FinalizationRegistry', undefined);
    vi.resetModules();
    const { ReadableStreamToAsyncIterable } = await import('@anthropic-ai/sdk/internal/shims');

    const chunks = ReadableStreamToAsyncIterable<Uint8Array>(body);
    expect(text(await chunks.next())).toBe('body');
    expect(await chunks.next()).toEqual({ done: true, value: undefined });
  });

  test('an error response is read to the end, and left alone once its error is dropped', async () => {
    let pulls = 0;
    let cancels = 0;
    const body = new ReadableStream({
      pull: (controller) =>
        pulls++ ? controller.close() : controller.enqueue(new TextEncoder().encode('{}')),
      cancel: () => void cancels++,
    });
    const failing = client.withOptions({
      fetch: async (url, init) =>
        String(url).endsWith('/error') ? new Response(body, { status: 400 }) : fetch(url, init),
    });
    await expect(failing.get('/error', { stream: true })).rejects.toThrow(Anthropic.BadRequestError);
    expect([pulls, cancels]).toEqual([2, 0]);

    await collectGarbage();
    expect([pulls, cancels]).toEqual([2, 0]);
  });

  describe.each<[string, () => APIPromise<Streamed>, (body: ReadableStream) => Streamed]>([
    ['Stream', requestStream, (body) => Stream.fromReadableStream(body, new AbortController())],
    [
      'JSONLDecoder',
      requestJSONL,
      (body) => JSONLDecoder.fromResponse({ body } as Response, new AbortController()),
    ],
  ])('%s', (_, request, fromBody) => {
    test.each<[string, () => Promise<void>]>([
      ['before it is read', async () => void (await request())],
      ['as a raw response, before it is read', async () => void (await request().asResponse())],
      ['part-way', () => readOneThenDrop(request)],
      [
        'part-way, if its body is not async iterable',
        () =>
          readOneThenDrop(async () => {
            const { body } = await fetch(`${client.baseURL}/jsonl`);
            return fromBody(Object.assign(body!, { [Symbol.asyncIterator]: undefined }));
          }),
      ],
    ])('is closed once it is dropped %s', async (_, drop) => {
      await drop();
      await expectClosedAfterGC(lastConnection);
    });

    test('is closed once its iterator is dropped, and cannot be iterated again', async () => {
      const stream = await request();
      await readOneThenDrop(async () => stream);
      await expectClosedAfterGC(lastConnection);
      expect(stream.controller.signal.aborted).toBe(false);

      const again = stream[Symbol.asyncIterator]().next();
      await expect(again).rejects.toThrow(Anthropic.AnthropicError);
      await expect(again).rejects.toThrow('Cannot iterate over a consumed stream');
    });

    test('is closed by the next item if it is dropped while a read is pending', async () => {
      await (async () => {
        const iterator = (await request())[Symbol.asyncIterator]();
        await iterator.next();
        void iterator.next();
      })();
      const connection = lastConnection;
      await collectGarbage();

      connection.send();
      await expectClosedAfterGC(connection);
    });

    test('stays open while it is held, before it is read', async () => {
      const stream = await request();
      const connection = lastConnection;
      await collectGarbage();

      connection.send();
      const iterator = stream[Symbol.asyncIterator]();
      expect(await iterator.next()).toEqual({ done: false, value: { n: 0 } });
      expect(await iterator.next()).toEqual({ done: false, value: { n: 1 } });
    });

    test('stays open while its iterator is held', async () => {
      const iterator = (await request())[Symbol.asyncIterator]();
      const connection = lastConnection;
      await iterator.next();
      await collectGarbage();

      connection.send();
      expect(await iterator.next()).toEqual({ done: false, value: { n: 1 } });
    });

    test('stays open while a read is pending', async () => {
      const { read } = await (async () => {
        const iterator = (await request())[Symbol.asyncIterator]();
        await iterator.next();
        return { read: iterator.next() };
      })();
      const connection = lastConnection;
      await collectGarbage();

      connection.send();
      expect(await read).toEqual({ done: false, value: { n: 1 } });
    });

    test('leaves the body to a caller that kept only the response', async () => {
      const { response } = await request().withResponse();
      const connection = lastConnection;
      await collectGarbage();

      const reader = response.body!.getReader();
      expect(text(await reader.read())).toContain('{"n":0}');
      await collectGarbage();

      connection.send();
      expect(text(await reader.read())).toContain('{"n":1}');
    });

    test('is closed at once by an abort, and left alone once it is dropped', async () => {
      const stream = await request();
      await readOneThenDrop(async () => stream);
      stream.controller.abort();
      await expect.poll(() => lastConnection.closed, { timeout: 20_000 }).toBe(true);
      await collectGarbage();
    });

    test.each([
      ['it is read to the end', 0, '{"n":0}\n', false],
      ['the loop is left', 1, '{"n":0}\n', true],
      ['an item is malformed', 1, '{\n', false],
    ])(
      'when %s, its body has been cancelled %i times, and is not cancelled again',
      async (_, expected, chunk, leave) => {
        let cancels = 0;
        const chunks = [chunk].values();
        const body: AsyncIterable<string> = {
          [Symbol.asyncIterator]: () => ({
            next: async () => chunks.next(),
            return: async () => {
              cancels++;
              return { done: true, value: undefined };
            },
          }),
        };
        try {
          for await (const _ of fromBody(body as ReadableStream)) if (leave) break;
        } catch {}
        expect(cancels).toBe(expected);

        await collectGarbage();
        expect(cancels).toBe(expected);
      },
    );
  });

  describe('Stream methods', () => {
    test('stays open while both halves of tee() are held', async () => {
      const [left, right] = (await requestStream()).tee().map((half) => half[Symbol.asyncIterator]());
      const connection = lastConnection;
      await left!.next();
      await collectGarbage();

      connection.send();
      expect(await left!.next()).toEqual({ done: false, value: { n: 1 } });
      expect(await right!.next()).toEqual({ done: false, value: { n: 0 } });
      expect(await right!.next()).toEqual({ done: false, value: { n: 1 } });
    });

    test('stays open while one half of tee() is held', async () => {
      const right = await (async () => {
        const [left, right] = (await requestStream()).tee();
        await readOneThenDrop(async () => left);
        return right;
      })();
      const connection = lastConnection;
      await collectGarbage();

      connection.send();
      const iterator = right[Symbol.asyncIterator]();
      expect(await iterator.next()).toEqual({ done: false, value: { n: 0 } });
      expect(await iterator.next()).toEqual({ done: false, value: { n: 1 } });
    });

    test('is closed once both halves of tee() are dropped', async () => {
      await readOneThenDrop(async () => (await requestStream()).tee()[0]);
      await expectClosedAfterGC(lastConnection);
    });

    test('stays open while its toReadableStream() is held', async () => {
      const reader = (await requestStream()).toReadableStream().getReader();
      const connection = lastConnection;
      expect(text(await reader.read())).toBe('{"n":0}\n');
      await collectGarbage();

      connection.send();
      expect(text(await reader.read())).toBe('{"n":1}\n');
    });

    test('is closed by the next item once its toReadableStream() is dropped, as that reads ahead', async () => {
      await (async () => {
        const reader = (await requestStream()).toReadableStream().getReader();
        expect(text(await reader.read())).toBe('{"n":0}\n');
      })();
      const connection = lastConnection;
      await collectGarbage();

      connection.send();
      await expectClosedAfterGC(connection);
    });
  });
});
