import Anthropic, { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { castToError, isAbortError } from '@anthropic-ai/sdk/internal/errors';
import vm from 'node:vm';

// undici rejects an aborted fetch with a `DOMException` from Node's own realm; callers with
// vm-isolated globals (e.g. under jest) get an object that is not `instanceof` their `Error`.
// A fresh vm context reproduces that whatever the test runner's isolation.
const crossRealmAbortError = () =>
  vm.runInNewContext(
    `Object.defineProperty(
      Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }),
      Symbol.toStringTag,
      { value: 'DOMException' },
    )`,
  );

describe('castToError', () => {
  test('returns real Errors as-is', () => {
    const err = new TypeError('boom');
    expect(castToError(err)).toBe(err);
  });

  test('wraps primitives', () => {
    expect(castToError('oops').message).toBe('oops');
  });

  test('JSON-stringifies plain objects', () => {
    expect(castToError({ foo: 'bar' }).message).toBe('{"foo":"bar"}');
  });

  test('preserves name and message of cross-realm DOMException abort errors', () => {
    const raw = crossRealmAbortError();
    expect(raw instanceof Error).toBe(false);

    const err = castToError(raw);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AbortError');
    expect(err.message).toBe('This operation was aborted');
    expect(isAbortError(err)).toBe(true);
  });
});

describe('request timeout rejected with a cross-realm abort error', () => {
  test('surfaces as APIConnectionTimeoutError', async () => {
    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      baseURL: 'http://localhost:5000/',
      timeout: 5,
      maxRetries: 0,
      fetch: (_url, { signal } = {}) =>
        new Promise((_, reject) => signal?.addEventListener('abort', () => reject(crossRealmAbortError()))),
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(APIConnectionTimeoutError);
  });
});
