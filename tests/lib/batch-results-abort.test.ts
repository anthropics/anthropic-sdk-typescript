import { getEventListeners } from 'node:events';
import Anthropic from '@anthropic-ai/sdk';

const first = { custom_id: 'first', result: { type: 'canceled' } };
const second = { custom_id: 'second', result: { type: 'expired' } };
const listenerCount = (signal: AbortSignal) => getEventListeners(signal, 'abort').length;

describe.each([
  ['messages.batches', (client: Anthropic) => client.messages.batches],
  ['beta.messages.batches', (client: Anthropic) => client.beta.messages.batches],
] as const)('%s results abort listener cleanup', (_name, resource) => {
  let caller: AbortController;
  // Keep response bodies alive until after the assertions: cleanup must not depend on GC timing.
  let responses: Response[];

  beforeEach(() => {
    caller = new AbortController();
    responses = [];
  });

  afterEach(() => {
    caller.abort();
    responses = [];
  });

  async function results(tail: string | null, empty = false) {
    const cancel = jest.fn();
    let bodyController: ReadableStreamDefaultController<Uint8Array>;
    let requestSignal: AbortSignal | null | undefined;
    const fetch = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      // The metadata request must have released its own listener before the results request starts.
      expect(listenerCount(caller.signal)).toBe(1);
      expect(init?.method).toBe('GET');
      let response: Response;
      if (new URL(String(input)).pathname === '/v1/messages/batches/batch_fixture') {
        response = Response.json({
          id: 'batch_fixture',
          results_url: 'https://example.invalid/results.jsonl',
        });
      } else {
        expect(String(input)).toBe('https://example.invalid/results.jsonl');
        requestSignal = init?.signal;
        response = new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              bodyController = controller;
              if (!empty) controller.enqueue(new TextEncoder().encode(JSON.stringify(first) + '\n'));
              if (tail !== null) {
                if (tail) controller.enqueue(new TextEncoder().encode(tail));
                controller.close();
              } else {
                requestSignal?.addEventListener(
                  'abort',
                  () => controller.error(new DOMException('aborted', 'AbortError')),
                  { once: true },
                );
              }
            },
            cancel,
          }),
          { headers: { 'Content-Type': 'application/x-jsonl' } },
        );
      }
      responses.push(response);
      return response;
    });
    const client = new Anthropic({
      apiKey: 'test-key',
      authToken: null,
      webhookKey: null,
      baseURL: 'https://example.invalid',
      fetch,
      maxRetries: 0,
    });

    expect(listenerCount(caller.signal)).toBe(0);
    const decoder = await resource(client).results('batch_fixture', {}, { signal: caller.signal });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(responses).toHaveLength(2);
    expect(decoder.controller.signal).toBe(requestSignal);
    expect(listenerCount(caller.signal)).toBe(1);
    return { decoder, cancel, errorBody: (error: Error) => bodyController.error(error) };
  }

  test('releases after EOF, including a final line without a newline', async () => {
    const { decoder } = await results(JSON.stringify(second));
    const rows = [];
    for await (const row of decoder) {
      expect(listenerCount(caller.signal)).toBe(1);
      rows.push(row);
    }
    expect(rows).toEqual([first, second]);
    expect(decoder.controller.signal.aborted).toBe(false);
    expect(listenerCount(caller.signal)).toBe(0);
  });

  test('releases after an empty body', async () => {
    const { decoder } = await results('', true);
    expect(await decoder[Symbol.asyncIterator]().next()).toEqual({ done: true, value: undefined });
    expect(decoder.controller.signal.aborted).toBe(false);
    expect(listenerCount(caller.signal)).toBe(0);
  });

  test('releases and cancels the body on early break', async () => {
    const { decoder, cancel } = await results(null);
    for await (const row of decoder) {
      expect(row).toEqual(first);
      expect(listenerCount(caller.signal)).toBe(1);
      break;
    }
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(decoder.controller.signal.aborted).toBe(false);
    expect(listenerCount(caller.signal)).toBe(0);
  });

  test.each(['{invalid}\n', '{invalid}'])('releases on invalid JSON %j', async (tail) => {
    const { decoder } = await results(tail);
    const iterator = decoder[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ done: false, value: first });
    expect(listenerCount(caller.signal)).toBe(1);
    await expect(iterator.next()).rejects.toBeInstanceOf(SyntaxError);
    expect(decoder.controller.signal.aborted).toBe(false);
    expect(listenerCount(caller.signal)).toBe(0);
  });

  test('releases on return after iteration starts, including repeated return', async () => {
    const { decoder, cancel } = await results(null);
    const iterator = decoder[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ done: false, value: first });
    expect(listenerCount(caller.signal)).toBe(1);
    expect(await iterator.return!()).toEqual({ done: true, value: undefined });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(decoder.controller.signal.aborted).toBe(false);
    expect(listenerCount(caller.signal)).toBe(0);
    await iterator.return!();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(listenerCount(caller.signal)).toBe(0);
  });

  test.each([false, true])('keeps an unconsumed body abortable (unstarted return: %s)', async (close) => {
    const { decoder, cancel } = await results(null);
    if (close) await decoder[Symbol.asyncIterator]().return!();
    // An unstarted generator does not execute finally. This patch does not change abandonment cleanup.
    expect(listenerCount(caller.signal)).toBe(1);
    expect(cancel).not.toHaveBeenCalled();
    expect(decoder.controller.signal.aborted).toBe(false);
    caller.abort();
    expect(decoder.controller.signal.aborted).toBe(true);
    expect(listenerCount(caller.signal)).toBe(0);
  });

  test('releases on body read failure without changing the error', async () => {
    const { decoder, errorBody } = await results(null);
    const iterator = decoder[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ done: false, value: first });
    const pending = iterator.next();
    expect(listenerCount(caller.signal)).toBe(1);
    const error = new Error('fixture read failure');
    const rejected = expect(pending).rejects.toBe(error);
    errorBody(error);
    await rejected;
    expect(decoder.controller.signal.aborted).toBe(false);
    expect(listenerCount(caller.signal)).toBe(0);
  });

  test('caller abort still reaches a pending body read', async () => {
    const { decoder } = await results(null);
    const iterator = decoder[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ done: false, value: first });
    const pending = iterator.next();
    expect(listenerCount(caller.signal)).toBe(1);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    caller.abort();
    await rejected;
    expect(decoder.controller.signal.aborted).toBe(true);
    expect(listenerCount(caller.signal)).toBe(0);
  });
});
