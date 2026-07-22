import { getEventListeners } from 'node:events';
import { runInNewContext } from 'node:vm';
import { setFlagsFromString } from 'node:v8';
import Anthropic from '@anthropic-ai/sdk';
import { APIUserAbortError } from '@anthropic-ai/sdk';

const MESSAGE = {
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  content: [{ type: 'text', text: 'ok' }],
  model: 'claude-test',
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
};

const jsonResponse = () =>
  new Response(JSON.stringify(MESSAGE), { headers: { 'Content-Type': 'application/json' } });

const sseResponse = () => {
  const events: Array<[string, object]> = [
    ['message_start', { type: 'message_start', message: { ...MESSAGE, content: [], stop_reason: null } }],
    [
      'content_block_start',
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ],
    [
      'content_block_delta',
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
    ],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    [
      'message_delta',
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 1 },
      },
    ],
    ['message_stop', { type: 'message_stop' }],
  ];
  const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
};

const listenerCount = (signal: AbortSignal) => getEventListeners(signal as any, 'abort').length;

describe('abort listener cleanup on a long-lived signal', () => {
  test('settled requests leave no listeners', async () => {
    const client = new Anthropic({ apiKey: 'sk-test', fetch: () => Promise.resolve(jsonResponse()) });
    const session = new AbortController();
    for (let i = 0; i < 3; i++) {
      await client.messages.create(
        { model: 'claude-test', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] },
        { signal: session.signal },
      );
    }
    expect(listenerCount(session.signal)).toBe(0);
  });

  test('failed requests leave no listeners', async () => {
    const client = new Anthropic({
      apiKey: 'sk-test',
      maxRetries: 0,
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { type: 'invalid_request_error', message: 'bad' } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
    });
    const session = new AbortController();
    await expect(
      client.messages.create(
        { model: 'claude-test', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] },
        { signal: session.signal },
      ),
    ).rejects.toThrow();
    expect(listenerCount(session.signal)).toBe(0);
  });

  test('connection errors leave no listeners', async () => {
    const client = new Anthropic({
      apiKey: 'sk-test',
      maxRetries: 0,
      fetch: () => Promise.reject(new Error('ECONNREFUSED')),
    });
    const session = new AbortController();
    await expect(
      client.messages.create(
        { model: 'claude-test', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] },
        { signal: session.signal },
      ),
    ).rejects.toThrow();
    expect(listenerCount(session.signal)).toBe(0);
  });

  test('retried requests release each attempt', async () => {
    let calls = 0;
    const client = new Anthropic({
      apiKey: 'sk-test',
      maxRetries: 1,
      fetch: () => {
        calls++;
        if (calls === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: { type: 'rate_limit_error', message: 'slow down' } }), {
              status: 429,
              headers: { 'Content-Type': 'application/json', 'retry-after': '0' },
            }),
          );
        }
        return Promise.resolve(jsonResponse());
      },
    });
    const session = new AbortController();
    await client.messages.create(
      { model: 'claude-test', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] },
      { signal: session.signal },
    );
    expect(calls).toBe(2);
    expect(listenerCount(session.signal)).toBe(0);
  });

  test('consumed streams leave no listeners', async () => {
    const client = new Anthropic({ apiKey: 'sk-test', fetch: () => Promise.resolve(sseResponse()) });
    const session = new AbortController();
    for (let i = 0; i < 2; i++) {
      const stream = await client.messages.create(
        { model: 'claude-test', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }], stream: true },
        { signal: session.signal },
      );
      for await (const _event of stream) {
        // drain
      }
    }
    expect(listenerCount(session.signal)).toBe(0);
  });

  test('a stream broken early releases its listener', async () => {
    const client = new Anthropic({ apiKey: 'sk-test', fetch: () => Promise.resolve(sseResponse()) });
    const session = new AbortController();
    const stream = await client.messages.create(
      { model: 'claude-test', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }], stream: true },
      { signal: session.signal },
    );
    for await (const _event of stream) {
      break;
    }
    expect(listenerCount(session.signal)).toBe(0);
  });

  test('abort still cancels an in-flight request', async () => {
    const client = new Anthropic({
      apiKey: 'sk-test',
      maxRetries: 0,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    });
    const session = new AbortController();
    const pending = client.messages.create(
      { model: 'claude-test', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] },
      { signal: session.signal },
    );
    await new Promise((r) => setTimeout(r, 0));
    session.abort();
    await expect(pending).rejects.toThrow(APIUserAbortError);
    expect(listenerCount(session.signal)).toBe(0);
  });

  test('an abandoned partially-iterated stream is released by the GC backstop', async () => {
    const session = new AbortController();
    const client = new Anthropic({ apiKey: 'sk-test', fetch: () => Promise.resolve(sseResponse()) });
    await (async () => {
      const stream = await client.messages.create(
        { model: 'claude-test', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }], stream: true },
        { signal: session.signal },
      );
      const iterator = stream[Symbol.asyncIterator]();
      await iterator.next();
    })();
    expect(listenerCount(session.signal)).toBe(1);

    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc') as () => void;
    setFlagsFromString('--no-expose-gc');
    const deadline = Date.now() + 5000;
    while (listenerCount(session.signal) > 0 && Date.now() < deadline) {
      gc();
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(listenerCount(session.signal)).toBe(0);
  });
});
