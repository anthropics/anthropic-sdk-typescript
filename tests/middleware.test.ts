import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import Anthropic from '@anthropic-ai/sdk';
import {
  AnthropicError,
  APIConnectionError,
  APIConnectionTimeoutError,
  RetryableError,
} from '@anthropic-ai/sdk';
import type { Middleware } from '@anthropic-ai/sdk';
import { BetaFallbackState, betaRefusalFallbackMiddleware } from '@anthropic-ai/sdk/lib/middleware';
import { wrapFetchWithMiddleware } from '@anthropic-ai/sdk/core/middleware';
import { Stream as SSEStream } from '@anthropic-ai/sdk/core/streaming';
import { WorkloadIdentityError } from '@anthropic-ai/sdk/lib/credentials/types';

const jsonResponse = (body: unknown = { a: 1 }, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

describe('middleware', () => {
  test('observes the request and passes through the response', async () => {
    let seenUrl: string | undefined;
    let seenMethod: string | undefined;
    let seenHeaders: Headers | undefined;
    let seenOptions: unknown;
    const middleware: Middleware = async (request, next, ctx) => {
      seenUrl = request.url;
      seenMethod = request.method;
      seenHeaders = request.headers;
      seenOptions = ctx.options;
      return next(request);
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async () => jsonResponse(),
      middleware: [middleware],
    });

    expect(await client.request({ path: '/foo', method: 'post', body: { hello: 'world' } })).toEqual({
      a: 1,
    });
    expect(seenUrl).toEqual('https://api.anthropic.com/foo');
    expect(seenMethod).toEqual('POST');
    expect(seenHeaders).toBeInstanceOf(Headers);
    expect(seenHeaders!.get('x-api-key')).toEqual('my-anthropic-api-key');
    expect(seenOptions).toMatchObject({ path: '/foo', method: 'post', body: { hello: 'world' } });
  });

  test('runs in array order, first middleware outermost', async () => {
    const order: string[] = [];
    const make = (name: string): Middleware => {
      return async (request, next) => {
        order.push(`${name}:in`);
        const response = await next(request);
        order.push(`${name}:out`);
        return response;
      };
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async () => jsonResponse(),
      middleware: [make('a'), make('b'), make('c')],
    });

    await client.request({ path: '/foo', method: 'get' });
    expect(order).toEqual(['a:in', 'b:in', 'c:in', 'c:out', 'b:out', 'a:out']);
  });

  test('can mutate request headers', async () => {
    let captured: RequestInit | undefined;
    const middleware: Middleware = (request, next) => {
      request.headers.set('x-my-middleware-header', 'hello');
      return next(request);
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async (_url: string | URL | Request, init?: RequestInit) => {
        captured = init;
        return jsonResponse();
      },
      middleware: [middleware],
    });

    await client.request({ path: '/foo', method: 'get' });
    expect((captured!.headers as Headers).get('x-my-middleware-header')).toEqual('hello');
  });

  test('can rewrite the request URL', async () => {
    let captured: string | undefined;
    const middleware: Middleware = (request, next) =>
      next({ ...request, url: request.url.replace('https://api.anthropic.com', 'http://localhost:1234') });

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async (url: string | URL | Request) => {
        captured = url.toString();
        return jsonResponse();
      },
      middleware: [middleware],
    });

    await client.request({ path: '/foo', method: 'get' });
    expect(captured).toEqual('http://localhost:1234/foo');
  });

  test('can short-circuit without calling next', async () => {
    let fetchCalls = 0;
    const middleware: Middleware = async () => jsonResponse({ cached: true });

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async () => {
        fetchCalls++;
        return jsonResponse();
      },
      middleware: [middleware],
    });

    expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ cached: true });
    expect(fetchCalls).toEqual(0);
  });

  test('can replace the response', async () => {
    const middleware: Middleware = async (request, next) => {
      const response = await next(request);
      return new Response(JSON.stringify({ wrapped: await response.json() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async () => jsonResponse({ a: 1 }),
      middleware: [middleware],
    });

    expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ wrapped: { a: 1 } });
  });

  test('consuming the response body without replacing it throws a helpful error', async () => {
    let fetchCalls = 0;
    const middleware: Middleware = async (request, next) => {
      const response = await next(request);
      await response.json(); // oops: should have cloned or replaced
      return response;
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        return jsonResponse();
      },
      middleware: [middleware],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(AnthropicError);
    expect(err.message).toMatch(/middleware consumed the response body/);
    expect(err.message).toMatch(/response\.clone\(\)/);
    // a consumed body is a deterministic programming error; it is not retried
    expect(fetchCalls).toEqual(1);
  });

  test('locking the response body stream without reading it throws a helpful error', async () => {
    let fetchCalls = 0;
    const middleware: Middleware = async (request, next) => {
      const response = await next(request);
      response.body!.getReader(); // locks the stream without consuming it
      return response;
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        return jsonResponse();
      },
      middleware: [middleware],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(AnthropicError);
    expect(err.message).toMatch(/middleware consumed the response body/);
    expect(fetchCalls).toEqual(1);
  });

  test('reading a clone of the response is fine', async () => {
    let cloned: unknown;
    const middleware: Middleware = async (request, next) => {
      const response = await next(request);
      cloned = await response.clone().json();
      return response;
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async () => jsonResponse(),
      middleware: [middleware],
    });

    expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });
    expect(cloned).toEqual({ a: 1 });
  });

  test('per-request middleware runs inside client middleware', async () => {
    const order: string[] = [];
    const make = (name: string): Middleware => {
      return async (request, next) => {
        order.push(name);
        return next(request);
      };
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async () => jsonResponse(),
      middleware: [make('client')],
    });

    await client.request({ path: '/foo', method: 'get', middleware: [make('request')] });
    expect(order).toEqual(['client', 'request']);

    // and per-request middleware only applies to its own request
    order.length = 0;
    await client.request({ path: '/foo', method: 'get' });
    expect(order).toEqual(['client']);
  });

  test('wraps each retry attempt', async () => {
    let fetchCalls = 0;
    const retryCounts: (string | null)[] = [];
    const middleware: Middleware = (request, next) => {
      retryCounts.push(request.headers.get('x-stainless-retry-count'));
      return next(request);
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 2,
      fetch: async () => {
        fetchCalls++;
        if (fetchCalls <= 2) {
          return new Response(undefined, { status: 500, headers: { 'retry-after-ms': '1' } });
        }
        return jsonResponse();
      },
      middleware: [middleware],
    });

    expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });
    expect(fetchCalls).toEqual(3);
    expect(retryCounts).toEqual(['0', '1', '2']);
  });

  test('thrown errors propagate as-is, without retries or wrapping', async () => {
    class MyError extends Error {}
    let attempts = 0;
    let fetchCalls = 0;
    const expectedError = new MyError('middleware exploded');
    const middleware: Middleware = async () => {
      attempts++;
      throw expectedError;
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        return jsonResponse();
      },
      middleware: [middleware],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(MyError);
    expect(err).toBe(expectedError);
    expect(err.message).toEqual('middleware exploded');
    // middleware errors are deterministic; the connection-error retry policy does not apply
    expect(attempts).toEqual(1);
    expect(fetchCalls).toEqual(0);
  });

  test('non-Error values thrown by middleware are normalized and not retried', async () => {
    let attempts = 0;
    let fetchCalls = 0;
    const middleware: Middleware = async () => {
      attempts++;
      return Promise.reject('middleware oops');
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        return jsonResponse();
      },
      middleware: [middleware],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    // the caller receives a castToError-normalized Error, not the raw primitive
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toEqual('middleware oops');
    expect(attempts).toEqual(1);
    expect(fetchCalls).toEqual(0);
  });

  test('connection-level errors thrown by middleware are retried', async () => {
    let attempts = 0;
    const middleware: Middleware = async () => {
      attempts++;
      throw new APIConnectionError({ cause: new Error('flaky network') });
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => jsonResponse(),
      middleware: [middleware],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(APIConnectionError);
    expect(attempts).toEqual(2);
  });

  test('a RetryableError thrown by middleware is retried, then propagates as-is', async () => {
    let attempts = 0;
    const expectedError = new RetryableError('flaky cache backend');
    const middleware: Middleware = async () => {
      attempts++;
      throw expectedError;
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => jsonResponse(),
      middleware: [middleware],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBe(expectedError);
    expect(attempts).toEqual(2);
  });

  test('an error with a RetryableError in its `cause` chain is retried', async () => {
    class MyError extends Error {}
    let attempts = 0;
    const middleware: Middleware = async () => {
      attempts++;
      // RetryableError nested two levels deep in the cause chain
      const outer = new MyError('outer');
      (outer as any).cause = new Error('inner');
      (outer as any).cause.cause = new RetryableError('flaky');
      throw outer;
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => jsonResponse(),
      middleware: [middleware],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(MyError);
    expect(attempts).toEqual(2);
  });

  test('errors from the underlying fetch keep the connection-error retry policy', async () => {
    let fetchCalls = 0;
    const passthrough: Middleware = (request, next) => next(request);

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        throw new TypeError('fetch failed');
      },
      middleware: [passthrough],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(APIConnectionError);
    expect(err.cause).toHaveProperty('message', 'fetch failed');
    expect(fetchCalls).toEqual(2);
  });

  test('non-Error values thrown by fetch are still treated as connection failures', async () => {
    let fetchCalls = 0;
    const passthrough: Middleware = (request, next) => next(request);

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        // a primitive can't be branded directly; applyMiddleware must normalize
        // it into an Error before adding it to the fetch-origin WeakSet
        return Promise.reject('socket hangup');
      },
      middleware: [passthrough],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(APIConnectionError);
    expect(err.cause).toHaveProperty('message', 'socket hangup');
    expect(fetchCalls).toEqual(2);
  });

  test('a fetch error caught and re-thrown by middleware is still a connection failure', async () => {
    let fetchCalls = 0;
    const middleware: Middleware = async (request, next) => {
      try {
        return await next(request);
      } catch (err) {
        // observed, then re-thrown untouched
        throw err;
      }
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        throw new TypeError('fetch failed');
      },
      middleware: [middleware],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(APIConnectionError);
    expect(fetchCalls).toEqual(2);
  });

  test('a fetch error wrapped by middleware with `cause` keeps retries, then propagates as-is', async () => {
    class WrappedError extends Error {}
    let fetchCalls = 0;
    const middleware: Middleware = async (request, next) => {
      try {
        return await next(request);
      } catch (err) {
        const wrapped = new WrappedError('transport failed');
        (wrapped as any).cause = err;
        throw wrapped;
      }
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        throw new TypeError('fetch failed');
      },
      middleware: [middleware],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(WrappedError);
    expect(err.cause).toHaveProperty('message', 'fetch failed');
    expect(fetchCalls).toEqual(2);
  });

  test('a fetch error replaced by middleware propagates without retries', async () => {
    class WrappedError extends Error {}
    let fetchCalls = 0;
    const middleware: Middleware = async (request, next) => {
      try {
        return await next(request);
      } catch {
        throw new WrappedError('replaced');
      }
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        throw new TypeError('fetch failed');
      },
      middleware: [middleware],
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(WrappedError);
    expect(fetchCalls).toEqual(1);
  });

  test('timeout applies to the underlying fetch, not middleware', async () => {
    // jest's sandbox realm breaks `DOMException instanceof Error`, so simulate
    // fetch's abort rejection with a plain Error carrying the AbortError name
    const abortError = () => {
      const err = new Error('This operation was aborted');
      err.name = 'AbortError';
      return err;
    };

    // slow middleware, fast fetch: middleware work doesn't count against the timeout
    const slowMiddleware: Middleware = async (request, next) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return next(request);
    };

    const fastClient = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      timeout: 5,
      maxRetries: 0,
      fetch: async (_url, { signal } = {}) => {
        if (signal?.aborted) throw abortError();
        return jsonResponse();
      },
      middleware: [slowMiddleware],
    });
    expect(await fastClient.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });

    // slow fetch through middleware: still aborts and surfaces as a timeout
    const slowClient = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      timeout: 5,
      maxRetries: 0,
      fetch: (_url, { signal } = {}) =>
        new Promise((_, reject) => signal?.addEventListener('abort', () => reject(abortError()))),
      middleware: [slowMiddleware],
    });
    const err = await slowClient.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(APIConnectionTimeoutError);
  });

  test('can call next multiple times to implement custom retries', async () => {
    let fetchCalls = 0;
    const middleware: Middleware = async (request, next) => {
      const response = await next(request);
      if (response.status === 503) {
        return next(request);
      }
      return response;
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      maxRetries: 0,
      fetch: async () => {
        fetchCalls++;
        return fetchCalls === 1 ? new Response(undefined, { status: 503 }) : jsonResponse();
      },
      middleware: [middleware],
    });

    expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });
    expect(fetchCalls).toEqual(2);
  });

  test('withOptions clones inherit middleware; passing middleware replaces them', async () => {
    const order: string[] = [];
    const make = (name: string): Middleware => {
      return async (request, next) => {
        order.push(name);
        return next(request);
      };
    };

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async () => jsonResponse(),
      middleware: [make('parent')],
    });

    const inheriting = client.withOptions({ baseURL: 'http://localhost:5000' });
    await inheriting.request({ path: '/foo', method: 'get' });
    expect(order).toEqual(['parent']);

    order.length = 0;
    const replaced = client.withOptions({ middleware: [make('replacement')] });
    await replaced.request({ path: '/foo', method: 'get' });
    expect(order).toEqual(['replacement']);

    order.length = 0;
    const appended = client.withOptions({ middleware: [...client.middleware, make('extra')] });
    await appended.request({ path: '/foo', method: 'get' });
    expect(order).toEqual(['parent', 'extra']);
  });

  test('streaming responses pass through middleware', async () => {
    let observedStatus: number | undefined;
    const middleware: Middleware = async (request, next) => {
      const response = await next(request);
      observedStatus = response.status;
      return response;
    };

    const sse = [
      `event: message_start\ndata: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-opus-4-8","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":11,"output_tokens":1}}}\n\n`,
      `event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`,
      `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello there!"}}\n\n`,
      `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`,
      `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":6}}\n\n`,
      `event: message_stop\ndata: {"type":"message_stop"}\n\n`,
    ].join('');

    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async () => {
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(sse));
              controller.close();
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        );
      },
      middleware: [middleware],
    });

    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Say hello there!' }],
    });

    const eventTypes: string[] = [];
    for await (const event of stream) {
      eventTypes.push(event.type);
    }
    const message = await stream.finalMessage();

    expect(observedStatus).toEqual(200);
    expect(eventTypes).toEqual([
      'message_start',
      'content_block_start',
      'content_block_delta',
      'content_block_stop',
      'message_delta',
      'message_stop',
    ]);
    expect(message).toMatchObject({
      model: 'claude-opus-4-8',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Hello there!' }],
    });
  });

  test('no middleware configured calls fetch directly', async () => {
    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async () => jsonResponse(),
    });
    expect(client.middleware).toEqual([]);
    expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });
  });

  describe('ctx.logger', () => {
    const makeCapturingLogger = () => {
      const logged: unknown[][] = [];
      const logger = {
        error: (...args: unknown[]) => logged.push(['error', ...args]),
        warn: (...args: unknown[]) => logged.push(['warn', ...args]),
        info: (...args: unknown[]) => logged.push(['info', ...args]),
        debug: (...args: unknown[]) => logged.push(['debug', ...args]),
      };
      return { logger, logged };
    };

    test('forwards to the client-configured logger', async () => {
      const { logger, logged } = makeCapturingLogger();
      const middleware: Middleware = async (request, next, ctx) => {
        ctx.logger.warn('from middleware', request.method);
        return next(request);
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () => jsonResponse(),
        middleware: [middleware],
        logger,
        logLevel: 'warn',
      });

      await client.request({ path: '/foo', method: 'get' });
      expect(logged).toContainEqual(['warn', 'from middleware', 'GET']);
    });

    test('respects the client log level, picking up later changes', async () => {
      const { logger, logged } = makeCapturingLogger();
      const middleware: Middleware = async (request, next, ctx) => {
        ctx.logger.debug('debug from middleware');
        return next(request);
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () => jsonResponse(),
        middleware: [middleware],
        logger,
        logLevel: 'warn',
      });

      await client.request({ path: '/foo', method: 'get' });
      expect(logged).toEqual([]);

      // the logger is resolved per request, so a level change applies
      client.logLevel = 'debug';
      await client.request({ path: '/foo', method: 'get' });
      expect(logged).toContainEqual(['debug', 'debug from middleware']);
    });

    test('is a safe no-op when logging is off', async () => {
      const { logger, logged } = makeCapturingLogger();
      const middleware: Middleware = async (request, next, ctx) => {
        ctx.logger.error('never logged');
        return next(request);
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () => jsonResponse(),
        middleware: [middleware],
        logger,
        logLevel: 'off',
      });

      expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });
      expect(logged).toEqual([]);
    });
  });

  describe('ctx.parse', () => {
    test('parses a JSON body and leaves the response readable for the client', async () => {
      let parsed: unknown;
      const middleware: Middleware = async (request, next, ctx) => {
        const response = await next(request);
        parsed = await ctx.parse(response);
        return response;
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () => jsonResponse(),
        middleware: [middleware],
      });

      expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });
      expect(parsed).toEqual({ a: 1 });
    });

    test('attaches _request_id like SDK return values', async () => {
      let parsed: { a: number; _request_id?: string | null } | undefined;
      const middleware: Middleware = async (request, next, ctx) => {
        const response = await next(request);
        parsed = await ctx.parse(response);
        return response;
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () =>
          jsonResponse(
            { a: 1 },
            { headers: { 'Content-Type': 'application/json', 'request-id': 'req_123' } },
          ),
        middleware: [middleware],
      });

      await client.request({ path: '/foo', method: 'get' });
      expect(parsed!._request_id).toEqual('req_123');
      // non-enumerable, like the SDK's own parsed values
      expect(Object.keys(parsed!)).toEqual(['a']);
    });

    test('is cached: parsing the same response across middleware costs one read', async () => {
      const seen: unknown[] = [];
      const make = (): Middleware => async (request, next, ctx) => {
        const response = await next(request);
        seen.push(await ctx.parse(response));
        seen.push(await ctx.parse(response));
        return response;
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () => jsonResponse(),
        middleware: [make(), make()],
      });

      expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });
      expect(seen).toHaveLength(4);
      // all four reads resolve to the same cached object
      expect(new Set(seen).size).toEqual(1);
    });

    test('each next() call parses independently', async () => {
      let fetchCalls = 0;
      const parses: unknown[] = [];
      const middleware: Middleware = async (request, next, ctx) => {
        const first = await next(request);
        parses.push(await ctx.parse(first));
        const second = await next(request);
        parses.push(await ctx.parse(second));
        return second;
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () => jsonResponse({ call: ++fetchCalls }),
        middleware: [middleware],
      });

      expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ call: 2 });
      expect(parses).toEqual([{ call: 1 }, { call: 2 }]);
    });

    test('non-JSON responses parse to the body text', async () => {
      let parsed: unknown;
      const middleware: Middleware = async (request, next, ctx) => {
        const response = await next(request);
        parsed = await ctx.parse(response);
        return response;
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () => new Response('plain text', { headers: { 'Content-Type': 'text/plain' } }),
        middleware: [middleware],
      });

      await client.request({ path: '/foo', method: 'get' });
      expect(parsed).toEqual('plain text');
    });

    test('parses error response bodies before the SDK throws', async () => {
      let parsed: unknown;
      const middleware: Middleware = async (request, next, ctx) => {
        const response = await next(request);
        parsed = await ctx.parse(response);
        return response;
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        maxRetries: 0,
        fetch: async () =>
          jsonResponse(
            { type: 'error', error: { type: 'invalid_request_error', message: 'bad request' } },
            { status: 400 },
          ),
        middleware: [middleware],
      });

      const err = await client.request({ path: '/foo', method: 'get' }).then(
        () => null,
        (e) => e,
      );
      // the SDK could still read the body and build its usual error
      expect(err.status).toEqual(400);
      expect(err.message).toMatch(/bad request/);
      expect(parsed).toMatchObject({ type: 'error' });
    });

    test('204 responses parse to null', async () => {
      let parsed: unknown = 'unset';
      const middleware: Middleware = async (request, next, ctx) => {
        const response = await next(request);
        parsed = await ctx.parse(response);
        return response;
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () => new Response(undefined, { status: 204 }),
        middleware: [middleware],
      });

      await client.request({ path: '/foo', method: 'get' });
      expect(parsed).toBeNull();
    });

    test('parsing a response whose body was already consumed throws a helpful error', async () => {
      const middleware: Middleware = async (request, next, ctx) => {
        const response = await next(request);
        const body = await response.text(); // consumed without cloning
        await ctx.parse(response);
        return new Response(body, response);
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        maxRetries: 0,
        fetch: async () => jsonResponse(),
        middleware: [middleware],
      });

      const err = await client.request({ path: '/foo', method: 'get' }).then(
        () => null,
        (e) => e,
      );
      expect(err).toBeInstanceOf(AnthropicError);
      expect(err.message).toMatch(/cannot ctx\.parse\(\) a response whose body was already consumed/);
    });

    test('outer middleware can parse a short-circuit response from inner middleware', async () => {
      let parsed: unknown;
      const outer: Middleware = async (request, next, ctx) => {
        const response = await next(request);
        parsed = await ctx.parse(response);
        return response;
      };
      const inner: Middleware = async () => jsonResponse({ cached: true });

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () => jsonResponse(),
        middleware: [outer, inner],
      });

      expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ cached: true });
      expect(parsed).toEqual({ cached: true });
    });

    test('parses a streaming response into a Stream without consuming the client events', async () => {
      const sse = [
        `event: message_start\ndata: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-opus-4-8","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":11,"output_tokens":1}}}\n\n`,
        `event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`,
        `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello there!"}}\n\n`,
        `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`,
        `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":6}}\n\n`,
        `event: message_stop\ndata: {"type":"message_stop"}\n\n`,
      ].join('');

      const middlewareEvents: string[] = [];
      const middleware: Middleware = async (request, next, ctx) => {
        const response = await next(request);
        expect(ctx.options?.stream).toBe(true);
        const parsed = await ctx.parse<SSEStream<Anthropic.MessageStreamEvent>>(response);
        expect(parsed).toBeInstanceOf(SSEStream);
        for await (const event of parsed) {
          middlewareEvents.push(event.type);
        }
        return response;
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () => {
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(sse));
                controller.close();
              },
            }),
            { headers: { 'Content-Type': 'text/event-stream' } },
          );
        },
        middleware: [middleware],
      });

      const stream = client.messages.stream({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Say hello there!' }],
      });

      const clientEvents: string[] = [];
      for await (const event of stream) {
        clientEvents.push(event.type);
      }
      const message = await stream.finalMessage();

      const expected = [
        'message_start',
        'content_block_start',
        'content_block_delta',
        'content_block_stop',
        'message_delta',
        'message_stop',
      ];
      // middleware iterated its own copy; the client's events are untouched
      expect(middlewareEvents).toEqual(expected);
      expect(clientEvents).toEqual(expected);
      expect(message.content).toMatchObject([{ type: 'text', text: 'Hello there!' }]);
    });

    test('stream parses are lazy and advance alongside the client stream', async () => {
      const sse = (type: string) => new TextEncoder().encode(`event: ${type}\ndata: {"type":"${type}"}\n\n`);
      let push!: ReadableStreamDefaultController;
      const mwEvents: string[] = [];
      let mwDone!: Promise<void>;

      const middleware: Middleware = async (request, next, ctx) => {
        const response = await next(request);
        const parsed = await ctx.parse<SSEStream<{ type: string }>>(response);
        mwDone = (async () => {
          for await (const event of parsed) mwEvents.push(event.type);
        })();
        return response;
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () =>
          new Response(new ReadableStream({ start: (c) => (push = c) }), {
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        middleware: [middleware],
      });

      // resolving at all proves parsing is lazy: no body chunks exist yet, so
      // a parse that buffered the whole body would deadlock here
      const stream = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      });
      const clientIter = stream[Symbol.asyncIterator]();

      // both copies receive the first event while the body is still open
      push.enqueue(sse('message_start'));
      expect((await clientIter.next()).value).toEqual({ type: 'message_start' });
      await new Promise((resolve) => setImmediate(resolve)); // let the middleware's iterator drain the chunk
      expect(mwEvents).toEqual(['message_start']);

      push.enqueue(sse('message_stop'));
      push.close();
      expect((await clientIter.next()).value).toEqual({ type: 'message_stop' });
      await mwDone;
      expect(mwEvents).toEqual(['message_start', 'message_stop']);
    });

    test('error responses to streaming requests parse as JSON, not a stream', async () => {
      let parsed: unknown;
      const middleware: Middleware = async (request, next, ctx) => {
        const response = await next(request);
        parsed = await ctx.parse(response);
        return response;
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        maxRetries: 0,
        fetch: async () =>
          jsonResponse(
            { type: 'error', error: { type: 'invalid_request_error', message: 'bad request' } },
            { status: 400 },
          ),
        middleware: [middleware],
      });

      const err = await client.messages
        .create({
          model: 'claude-opus-4-8',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'hi' }],
          stream: true,
        })
        .then(
          () => null,
          (e) => e,
        );
      expect(err.status).toEqual(400);
      expect(parsed).toMatchObject({ type: 'error' });
    });

    test('binary responses parse to the Response itself, unconsumed', async () => {
      let parsed: unknown;
      let seen: Response | undefined;
      const middleware: Middleware = async (request, next, ctx) => {
        const response = await next(request);
        seen = response;
        parsed = await ctx.parse(response);
        return response;
      };

      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async () =>
          new Response('binary bytes', { headers: { 'Content-Type': 'application/octet-stream' } }),
        middleware: [middleware],
      });

      const response: Response = await client.request({
        path: '/foo',
        method: 'get',
        __binaryResponse: true,
      });
      expect(parsed).toBe(seen);
      expect(await response.text()).toEqual('binary bytes');
    });
  });

  describe('credential token-exchange requests', () => {
    const envVars = [
      'ANTHROPIC_API_KEY',
      'ANTHROPIC_AUTH_TOKEN',
      'ANTHROPIC_BASE_URL',
      'ANTHROPIC_IDENTITY_TOKEN',
      'ANTHROPIC_IDENTITY_TOKEN_FILE',
      'ANTHROPIC_WORKSPACE_ID',
    ];
    const originalEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      for (const name of envVars) {
        originalEnv[name] = process.env[name];
        delete process.env[name];
      }
      process.env['ANTHROPIC_IDENTITY_TOKEN'] = 'my-jwt';
    });

    afterEach(() => {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value !== undefined) {
          process.env[key] = value;
        } else {
          delete process.env[key];
        }
      }
    });

    const oidcConfig = {
      organization_id: 'org-123',
      authentication: { type: 'oidc_federation' as const, federation_rule_id: 'fdrl_01abc' },
    };

    const tokenExchangeFetch = async (url: string | URL | Request) =>
      String(url).includes('/v1/oauth/token') ?
        jsonResponse({ access_token: 'minted-token', expires_in: 3600 })
      : jsonResponse();

    test('OIDC federation token exchange goes through client middleware', async () => {
      const seen: string[] = [];
      const middleware: Middleware = async (request, next, ctx) => {
        expect(request.headers).toBeInstanceOf(Headers);
        if (request.url.includes('/v1/oauth/token')) {
          // token exchanges aren't SDK API requests, so there are no options
          expect(ctx.options).toBeUndefined();
        } else {
          expect(ctx.options).toMatchObject({ path: '/foo' });
        }
        seen.push(`${request.method} ${request.url}`);
        return next(request);
      };

      const client = new Anthropic({
        apiKey: null,
        authToken: null,
        config: oidcConfig,
        fetch: tokenExchangeFetch,
        middleware: [middleware],
      });

      expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });
      expect(seen).toEqual([
        'POST https://api.anthropic.com/v1/oauth/token',
        'GET https://api.anthropic.com/foo',
      ]);
    });

    test('ctx.logger forwards to the client logger on token-exchange requests', async () => {
      const logged: unknown[][] = [];
      const middleware: Middleware = async (request, next, ctx) => {
        if (request.url.includes('/v1/oauth/token')) {
          ctx.logger.warn('token exchange seen');
        }
        return next(request);
      };

      const client = new Anthropic({
        apiKey: null,
        authToken: null,
        config: oidcConfig,
        fetch: tokenExchangeFetch,
        middleware: [middleware],
        logger: {
          error: () => {},
          warn: (...args: unknown[]) => logged.push(args),
          info: () => {},
          debug: () => {},
        },
        logLevel: 'warn',
      });

      await client.request({ path: '/foo', method: 'get' });
      expect(logged).toContainEqual(['token exchange seen']);
    });

    test('middleware-set headers reach the token endpoint', async () => {
      let tokenHeader: string | null = null;
      const middleware: Middleware = async (request, next) => {
        request.headers.set('x-trace-id', 'trace-123');
        return next(request);
      };

      const client = new Anthropic({
        apiKey: null,
        authToken: null,
        config: oidcConfig,
        fetch: async (url: string | URL | Request, init?: RequestInit) => {
          if (String(url).includes('/v1/oauth/token')) {
            tokenHeader = (init!.headers as Headers).get('x-trace-id');
            return jsonResponse({ access_token: 'minted-token', expires_in: 3600 });
          }
          return jsonResponse();
        },
        middleware: [middleware],
      });

      await client.request({ path: '/foo', method: 'get' });
      expect(tokenHeader).toEqual('trace-123');
    });

    test('per-request middleware does not apply to the token exchange', async () => {
      const clientSeen: string[] = [];
      const requestSeen: string[] = [];
      const clientMw: Middleware = async (request, next) => {
        clientSeen.push(request.url);
        return next(request);
      };
      const requestMw: Middleware = async (request, next) => {
        requestSeen.push(request.url);
        return next(request);
      };

      const client = new Anthropic({
        apiKey: null,
        authToken: null,
        config: oidcConfig,
        fetch: tokenExchangeFetch,
        middleware: [clientMw],
      });

      await client.request({ path: '/foo', method: 'get', middleware: [requestMw] });
      expect(clientSeen).toEqual([
        'https://api.anthropic.com/v1/oauth/token',
        'https://api.anthropic.com/foo',
      ]);
      expect(requestSeen).toEqual(['https://api.anthropic.com/foo']);
    });

    test('user OAuth refresh goes through client middleware', async () => {
      const dir = fs.mkdtempSync(path.join(tmpdir(), 'mw-creds-'));
      try {
        const credsPath = path.join(dir, 'credentials.json');
        fs.writeFileSync(
          credsPath,
          JSON.stringify({
            access_token: 'stale-token',
            refresh_token: 'my-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) - 60,
          }),
          { mode: 0o600 },
        );

        const seen: string[] = [];
        const middleware: Middleware = async (request, next) => {
          seen.push(`${request.method} ${request.url}`);
          return next(request);
        };

        let refreshBody: Record<string, string> | undefined;
        const client = new Anthropic({
          apiKey: null,
          authToken: null,
          config: {
            authentication: { type: 'user_oauth', client_id: 'client-123', credentials_path: credsPath },
          },
          fetch: async (url: string | URL | Request, init?: RequestInit) => {
            if (String(url).includes('/v1/oauth/token')) {
              refreshBody = JSON.parse(String(init!.body));
              return jsonResponse({ access_token: 'fresh-token', expires_in: 3600 });
            }
            return jsonResponse();
          },
          middleware: [middleware],
        });

        await client.request({ path: '/foo', method: 'get' });
        expect(refreshBody).toMatchObject({
          grant_type: 'refresh_token',
          refresh_token: 'my-refresh-token',
        });
        expect(seen).toEqual([
          'POST https://api.anthropic.com/v1/oauth/token',
          'GET https://api.anthropic.com/foo',
        ]);
      } finally {
        fs.rmSync(dir, { recursive: true });
      }
    });

    test('middleware errors during token exchange surface as WorkloadIdentityError', async () => {
      const middleware: Middleware = async () => {
        throw new Error('boom from middleware');
      };

      const client = new Anthropic({
        apiKey: null,
        authToken: null,
        config: oidcConfig,
        fetch: tokenExchangeFetch,
        middleware: [middleware],
      });

      const err = await client.request({ path: '/foo', method: 'get' }).then(
        () => {
          throw new Error('expected request to fail');
        },
        (e) => e,
      );
      expect(err).toBeInstanceOf(WorkloadIdentityError);
      expect(err.message).toMatch(/Failed to reach token endpoint/);
      expect(err.message).toMatch(/boom from middleware/);
    });

    test('middleware can short-circuit the token exchange with a synthetic response', async () => {
      let fetchCalledForToken = false;
      const middleware: Middleware = async (request, next) => {
        if (request.url.includes('/v1/oauth/token')) {
          return jsonResponse({ access_token: 'synthetic-token', expires_in: 3600 });
        }
        return next(request);
      };

      const client = new Anthropic({
        apiKey: null,
        authToken: null,
        config: oidcConfig,
        fetch: async (url: string | URL | Request, init?: RequestInit) => {
          if (String(url).includes('/v1/oauth/token')) {
            fetchCalledForToken = true;
          }
          expect((init!.headers as Headers).get('authorization')).toEqual('Bearer synthetic-token');
          return jsonResponse();
        },
        middleware: [middleware],
      });

      expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });
      expect(fetchCalledForToken).toBe(false);
    });
  });

  describe('request preparation', () => {
    /**
     * Emulates a provider that signs requests in `prepareRequest` (e.g. SigV4
     * on Bedrock): the "signature" commits to the exact url and body, so a
     * stale signature is detectable when the request is later modified.
     */
    class SigningClient extends Anthropic {
      prepared: Array<{ url: string; body: unknown }> = [];
      protected override async prepareRequest(
        request: RequestInit,
        { url, options }: { url: string; options: any },
      ): Promise<void> {
        this.prepared.push({ url, body: request.body });
        (request.headers as Headers).set('x-test-signature', `sig:${url}:${request.body}`);
        await super.prepareRequest(request, { url, options });
      }
    }

    test('prepares the request middleware modified, signing the final url and body', async () => {
      const sentSignatures: Array<string | null> = [];
      const client = new SigningClient({
        apiKey: 'my-anthropic-api-key',
        fetch: async (url, init) => {
          sentSignatures.push(new Headers(init?.headers).get('x-test-signature'));
          return jsonResponse();
        },
        middleware: [
          async (request, next) => {
            // The request must not be signed yet when middleware sees it.
            expect(request.headers.get('x-test-signature')).toBeNull();
            return next({
              ...request,
              url: 'https://api.anthropic.com/rewritten',
              body: JSON.stringify({ rewritten: true }),
            });
          },
        ],
      });

      await client.request({ path: '/foo', method: 'post', body: { hello: 'world' } });
      expect(client.prepared).toEqual([
        { url: 'https://api.anthropic.com/rewritten', body: JSON.stringify({ rewritten: true }) },
      ]);
      expect(sentSignatures).toEqual([
        `sig:https://api.anthropic.com/rewritten:${JSON.stringify({ rewritten: true })}`,
      ]);
    });

    test('prepares per next() call, so replayed and rewritten requests are re-signed', async () => {
      const sentSignatures: Array<string | null> = [];
      const client = new SigningClient({
        apiKey: 'my-anthropic-api-key',
        fetch: async (url, init) => {
          sentSignatures.push(new Headers(init?.headers).get('x-test-signature'));
          return jsonResponse();
        },
        middleware: [
          async (request, next) => {
            await next(request);
            // Retry against a different url — must be signed for the new url
            // even though the request already carries the first signature.
            return next({ ...request, url: 'https://api.anthropic.com/fallback' });
          },
        ],
      });

      await client.request({ path: '/foo', method: 'get' });
      expect(client.prepared.map((p) => p.url)).toEqual([
        'https://api.anthropic.com/foo',
        'https://api.anthropic.com/fallback',
      ]);
      expect(sentSignatures).toEqual([
        'sig:https://api.anthropic.com/foo:undefined',
        'sig:https://api.anthropic.com/fallback:undefined',
      ]);
    });

    test("debug-logs 'sending request' once per inner fetch, with the prepared headers", async () => {
      const debugMock = jest.fn();
      const client = new SigningClient({
        apiKey: 'my-anthropic-api-key',
        logLevel: 'debug',
        logger: { debug: debugMock, info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        fetch: async () => jsonResponse(),
        middleware: [
          async (request, next) => {
            await next(request);
            return next({ ...request, url: 'https://api.anthropic.com/fallback' });
          },
        ],
      });

      await client.request({ path: '/foo', method: 'get' });

      // The log must reflect the request actually sent: post-middleware url,
      // signed headers, one entry per next() call.
      const sends = debugMock.mock.calls.filter(([msg]) => String(msg).includes('sending request'));
      expect(sends.map(([, details]) => [details.url, details.headers['x-test-signature']])).toEqual([
        ['https://api.anthropic.com/foo', 'sig:https://api.anthropic.com/foo:undefined'],
        ['https://api.anthropic.com/fallback', 'sig:https://api.anthropic.com/fallback:undefined'],
      ]);
    });

    test('credential token-exchange requests are not prepared', async () => {
      const dir = fs.mkdtempSync(path.join(tmpdir(), 'mw-prep-'));
      try {
        const credsPath = path.join(dir, 'credentials.json');
        fs.writeFileSync(
          credsPath,
          JSON.stringify({
            access_token: 'stale-token',
            refresh_token: 'my-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) - 60,
          }),
          { mode: 0o600 },
        );
        const client = new SigningClient({
          apiKey: null,
          authToken: null,
          config: {
            authentication: { type: 'user_oauth', client_id: 'client-123', credentials_path: credsPath },
          },
          fetch: async (url) => {
            if (String(url).includes('/v1/oauth/token')) {
              return jsonResponse({ access_token: 'fresh-token', expires_in: 3600 });
            }
            return jsonResponse();
          },
        });

        await client.request({ path: '/foo', method: 'get' });
        // Only the API request itself is prepared — never the token exchange.
        expect(client.prepared.map((p) => new URL(p.url).pathname)).toEqual(['/foo']);
      } finally {
        fs.rmSync(dir, { recursive: true });
      }
    });
  });
});

describe('wrapFetchWithMiddleware', () => {
  test('normalizes URL objects and header maps into an APIRequest', async () => {
    const urls: string[] = [];
    const middleware: Middleware = async (request, next) => {
      urls.push(request.url);
      expect(request.headers).toBeInstanceOf(Headers);
      expect(request.headers.get('x-a')).toEqual('1');
      return next(request);
    };

    const wrapped = wrapFetchWithMiddleware(async () => jsonResponse(), [middleware]);
    await wrapped(new URL('https://example.com/path'), { headers: { 'x-a': '1' } });
    await wrapped('https://example.com/str', { headers: [['x-a', '1']] });
    expect(urls).toEqual(['https://example.com/path', 'https://example.com/str']);
  });

  test('without a client, ctx.logger falls back to console at the default level', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const originalEnv = process.env['ANTHROPIC_LOG'];
    try {
      const middleware: Middleware = async (request, next, ctx) => {
        ctx.logger.error('an error');
        ctx.logger.warn('a warning');
        ctx.logger.info('some info');
        return next(request);
      };
      const wrapped = wrapFetchWithMiddleware(async () => jsonResponse(), [middleware]);

      process.env['ANTHROPIC_LOG'] = 'error';
      await wrapped('https://example.com/path');
      expect(errorSpy).toHaveBeenCalledWith('an error');
      expect(warnSpy).not.toHaveBeenCalled();

      delete process.env['ANTHROPIC_LOG'];
      await wrapped('https://example.com/path');
      expect(warnSpy).toHaveBeenCalledWith('a warning');
    } finally {
      if (originalEnv !== undefined) {
        process.env['ANTHROPIC_LOG'] = originalEnv;
      } else {
        delete process.env['ANTHROPIC_LOG'];
      }
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  test('with no middleware passes arguments through to fetch untouched', async () => {
    let seenUrl: string | URL | Request | undefined;
    let seenInit: RequestInit | undefined;
    const wrapped = wrapFetchWithMiddleware(async (url, init) => {
      seenUrl = url;
      seenInit = init;
      return jsonResponse();
    }, []);

    const url = new URL('https://example.com/path');
    const init = { method: 'POST', headers: { 'x-a': '1' } };
    await wrapped(url, init);
    expect(seenUrl).toBe(url);
    expect(seenInit).toBe(init);
  });
});

describe('backend middleware', () => {
  const clientWithBackend = (
    backend: ReadonlyArray<Middleware>,
    options: ConstructorParameters<typeof Anthropic>[0],
  ) => {
    class BackendTestClient extends Anthropic {
      protected override backendMiddleware(): ReadonlyArray<Middleware> {
        return backend;
      }
    }
    return new BackendTestClient(options);
  };

  test('composes innermost: client middleware, then per-request middleware, then backend', async () => {
    const order: string[] = [];
    const make = (name: string): Middleware => {
      return async (request, next) => {
        order.push(`${name}:in`);
        const response = await next(request);
        order.push(`${name}:out`);
        return response;
      };
    };

    const client = clientWithBackend([make('backend')], {
      apiKey: 'my-anthropic-api-key',
      fetch: async () => jsonResponse(),
      middleware: [make('client')],
    });

    await client.request({ path: '/foo', method: 'get', middleware: [make('request')] });
    expect(order).toEqual([
      'client:in',
      'request:in',
      'backend:in',
      'backend:out',
      'request:out',
      'client:out',
    ]);
  });

  test('user middleware observes the canonical request; the wire receives the adapted request', async () => {
    let userSawUrl: string | undefined;
    let userSawSignature: string | null = null;
    let wireUrl: string | undefined;
    let wireSignature: string | null = null;

    const userMiddleware: Middleware = async (request, next) => {
      userSawUrl = request.url;
      userSawSignature = request.headers.get('x-signature');
      return next(request);
    };
    const adapt: Middleware = async (request, next) => {
      const headers = new Headers(request.headers);
      headers.set('x-signature', 'signed');
      return next({ ...request, url: request.url.replace('/foo', '/backend/foo'), headers });
    };

    const client = clientWithBackend([adapt], {
      apiKey: 'my-anthropic-api-key',
      fetch: async (url: string | URL | Request, init?: RequestInit) => {
        wireUrl = url.toString();
        wireSignature = (init!.headers as Headers).get('x-signature');
        return jsonResponse();
      },
      middleware: [userMiddleware],
    });

    await client.request({ path: '/foo', method: 'get' });
    expect(userSawUrl).toEqual('https://api.anthropic.com/foo');
    expect(userSawSignature).toBeNull();
    expect(wireUrl).toEqual('https://api.anthropic.com/backend/foo');
    expect(wireSignature).toEqual('signed');
  });

  test('observes user middleware mutations and re-runs on every next() call', async () => {
    const adaptedBodies: string[] = [];
    const adapt: Middleware = async (request, next) => {
      adaptedBodies.push(String(request.body));
      return next(request);
    };
    const mutateAndRetryOnce: Middleware = async (request, next) => {
      const mutated = { ...request, body: JSON.stringify({ mutated: true }) };
      const response = await next(mutated);
      return response.status === 503 ? next(mutated) : response;
    };

    let fetchCalls = 0;
    const client = clientWithBackend([adapt], {
      apiKey: 'my-anthropic-api-key',
      maxRetries: 0,
      fetch: async () => {
        fetchCalls++;
        return fetchCalls === 1 ? new Response(undefined, { status: 503 }) : jsonResponse();
      },
      middleware: [mutateAndRetryOnce],
    });

    await client.request({ path: '/foo', method: 'post', body: { original: true } });
    expect(adaptedBodies).toEqual(['{"mutated":true}', '{"mutated":true}']);
    expect(fetchCalls).toEqual(2);
  });

  test('the response it returns is what user middleware and the client observe', async () => {
    let userSawNormalized: boolean | undefined;
    const normalize: Middleware = async (request, next) => {
      await next(request);
      return jsonResponse({ normalized: true });
    };
    const userMiddleware: Middleware = async (request, next) => {
      const response = await next(request);
      userSawNormalized = ((await response.clone().json()) as { normalized: boolean }).normalized;
      return response;
    };

    const client = clientWithBackend([normalize], {
      apiKey: 'my-anthropic-api-key',
      fetch: async () => jsonResponse({ normalized: false }),
      middleware: [userMiddleware],
    });

    expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ normalized: true });
    expect(userSawNormalized).toBe(true);
  });

  test('errors propagate as-is without retries or wrapping, even with no user middleware', async () => {
    class SigningError extends Error {}
    let attempts = 0;
    let fetchCalls = 0;
    const expectedError = new SigningError('credentials unavailable');
    const failingBackend: Middleware = async () => {
      attempts++;
      throw expectedError;
    };

    const client = clientWithBackend([failingBackend], {
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        return jsonResponse();
      },
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBe(expectedError);
    expect(attempts).toEqual(1);
    expect(fetchCalls).toEqual(0);
  });

  test('a RetryableError is retried', async () => {
    let attempts = 0;
    const flakyBackend: Middleware = async (request, next) => {
      attempts++;
      if (attempts === 1) throw new RetryableError('credential cache miss');
      return next(request);
    };

    const client = clientWithBackend([flakyBackend], {
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => jsonResponse(),
    });

    expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });
    expect(attempts).toEqual(2);
  });

  test('fetch connection errors keep the retry policy when only backend middleware is present', async () => {
    let fetchCalls = 0;
    const passthrough: Middleware = (request, next) => next(request);

    const client = clientWithBackend([passthrough], {
      apiKey: 'my-anthropic-api-key',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        throw new TypeError('fetch failed');
      },
    });

    const err = await client.request({ path: '/foo', method: 'get' }).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(APIConnectionError);
    expect(err.cause).toHaveProperty('message', 'fetch failed');
    expect(fetchCalls).toEqual(2);
  });

  test('the request timeout does not cover backend middleware work', async () => {
    const abortError = () => {
      const err = new Error('This operation was aborted');
      err.name = 'AbortError';
      return err;
    };

    // slow backend adaptation (e.g. credential resolution), fast fetch:
    // adaptation work doesn't count against the timeout
    const slowBackend: Middleware = async (request, next) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return next(request);
    };

    const client = clientWithBackend([slowBackend], {
      apiKey: 'my-anthropic-api-key',
      timeout: 5,
      maxRetries: 0,
      fetch: async (_url, { signal } = {}) => {
        if (signal?.aborted) throw abortError();
        return jsonResponse();
      },
    });
    expect(await client.request({ path: '/foo', method: 'get' })).toEqual({ a: 1 });
  });
});

describe('betaRefusalFallbackMiddleware', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  const message = (model: string, overrides: Record<string, unknown> = {}) =>
    jsonResponse({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model,
      content: [],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
      ...overrides,
    });
  const refusal = (model: string, fallback_credit_token: string | null = null) =>
    message(model, {
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', reason: 'other', explanation: null, fallback_credit_token },
    });

  const params = {
    model: 'primary-model',
    max_tokens: 1024,
    messages: [{ role: 'user' as const, content: 'hi' }],
  };

  const makeClient = (responses: Response[], middleware: Middleware) => {
    const bodies: Record<string, unknown>[] = [];
    const helpers: (string | null)[] = [];
    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(init!.body as string));
        helpers.push((init!.headers as Headers).get('x-stainless-helper'));
        return responses.shift()!;
      },
      middleware: [middleware],
    });
    return { client, bodies, helpers };
  };

  test('retries a refusal with the fallback params and credit token', async () => {
    const { client, bodies } = makeClient(
      [refusal('primary-model', 'credit-token'), message('fallback-model')],
      betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
    );

    const result = await client.beta.messages.create(params);
    expect(result.model).toEqual('fallback-model');
    expect(result.stop_reason).toEqual('end_turn');
    expect(bodies.map((b) => b['model'])).toEqual(['primary-model', 'fallback-model']);
    expect(bodies[1]!['fallback_credit_token']).toEqual('credit-token');
  });

  test('tags the original and fallback requests', async () => {
    const { client, helpers } = makeClient(
      [refusal('primary-model', 'credit-token'), message('fallback-model')],
      betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
    );

    await client.beta.messages.create(params);
    expect(helpers).toEqual(['fallback-refusal-middleware', 'fallback-refusal-middleware']);
  });

  test('appends to a helper tag already on the request', async () => {
    const { client, helpers } = makeClient(
      [message('primary-model')],
      betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
    );

    await client.beta.messages.create(params, { headers: { 'X-Stainless-Helper': 'BetaToolRunner' } });
    expect(helpers).toEqual(['BetaToolRunner, fallback-refusal-middleware']);
  });

  test('does not tag requests it passes through', async () => {
    const { client, helpers } = makeClient(
      [message('primary-model')],
      betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
    );

    // the GA surface is not applicable to this middleware
    await client.messages.create(params);
    expect(helpers).toEqual([null]);
  });

  test('pins the conversation to the accepted fallback via fallbackState', async () => {
    const { client, bodies } = makeClient(
      [refusal('primary-model'), message('fallback-model'), message('fallback-model')],
      betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
    );

    const fallbackState = new BetaFallbackState();
    await client.beta.messages.create(params, { fallbackState });
    expect(fallbackState.index).toEqual(0);

    // the follow-up goes straight to the pinned fallback in a single request
    await client.beta.messages.create(params, { fallbackState });
    expect(bodies.map((b) => b['model'])).toEqual(['primary-model', 'fallback-model', 'fallback-model']);
    expect(warn).not.toHaveBeenCalled();
  });

  test('throws if fallbackState.index is out of bounds for the chain', async () => {
    const { client, bodies } = makeClient(
      [message('fallback-model')],
      betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
    );

    const fallbackState = new BetaFallbackState();
    fallbackState.index = 1;
    await expect(client.beta.messages.create(params, { fallbackState })).rejects.toThrow(
      'fallbackState.index 1 is out of bounds for a chain of 1 fallback(s)',
    );
    expect(bodies).toHaveLength(0);
  });

  test('warns once when falling back without a fallbackState', async () => {
    // an injected logger rather than the console.warn spy: the SDK caches
    // bound console methods across tests, so per-test console spies go stale
    const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
    const responses = [
      refusal('primary-model'),
      message('fallback-model'),
      refusal('primary-model'),
      message('fallback-model'),
    ];
    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async () => responses.shift()!,
      logger,
      middleware: [betaRefusalFallbackMiddleware([{ model: 'fallback-model' }])],
    });

    await client.beta.messages.create(params);
    await client.beta.messages.create(params);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('fallbackState'));
  });

  test('the missing-fallbackState warning respects the client logLevel', async () => {
    const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
    const responses = [refusal('primary-model'), message('fallback-model')];
    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      fetch: async () => responses.shift()!,
      logger,
      logLevel: 'off',
      middleware: [betaRefusalFallbackMiddleware([{ model: 'fallback-model' }])],
    });

    await client.beta.messages.create(params);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('a separate conversation is unaffected by another state', async () => {
    const { client, bodies } = makeClient(
      [refusal('primary-model'), message('fallback-model'), message('primary-model')],
      betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
    );

    await client.beta.messages.create(params, { fallbackState: new BetaFallbackState() });
    await client.beta.messages.create(params, { fallbackState: new BetaFallbackState() });
    expect(bodies.map((b) => b['model'])).toEqual(['primary-model', 'fallback-model', 'primary-model']);
  });

  test('leaves accepted requests and the response untouched', async () => {
    const { client, bodies } = makeClient(
      [message('primary-model')],
      betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
    );

    const fallbackState = new BetaFallbackState();
    const result = await client.beta.messages.create(params, { fallbackState });
    expect(result.model).toEqual('primary-model');
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!['fallback_credit_token']).toBeUndefined();
    expect(fallbackState.index).toBeUndefined();
  });

  test('throws when the request carries a server-side fallbacks param', async () => {
    const { client, bodies } = makeClient(
      [message('primary-model')],
      betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
    );

    await expect(
      client.beta.messages.create({ ...params, fallbacks: [{ model: 'server-fallback-model' }] }),
    ).rejects.toThrow(
      'Sending the `fallbacks:` request param is not supported when using the `betaRefusalFallbackMiddleware`.',
    );
    expect(bodies).toHaveLength(0);
  });

  test('ignores the non-beta client.messages endpoint', async () => {
    const { client, bodies } = makeClient(
      [refusal('primary-model', 'credit-token'), message('fallback-model')],
      betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
    );

    // client.messages posts to /v1/messages (no ?beta=true); the refusal must
    // pass through untouched rather than walk the fallback chain.
    const result = await client.messages.create(params);
    expect(result.stop_reason).toEqual('refusal');
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!['fallback_credit_token']).toBeUndefined();
  });

  test('walks each hop through the chain until a model accepts', async () => {
    const { client, bodies } = makeClient(
      [
        refusal('primary-model'),
        refusal('mid-model'),
        message('last-model', { content: [{ type: 'text', text: 'ok' }] }),
      ],
      betaRefusalFallbackMiddleware([{ model: 'mid-model' }, { model: 'last-model' }]),
    );

    const fallbackState = new BetaFallbackState();
    const result = await client.beta.messages.create(params, { fallbackState });
    expect(result.model).toEqual('last-model');
    expect(fallbackState.index).toEqual(1);
    expect(bodies.map((b) => b['model'])).toEqual(['primary-model', 'mid-model', 'last-model']);
    // Seam blocks accumulate in hop order and are prepended ahead of the
    // serving hop's own content — pins ordering and hop-2 from/to threading.
    expect(result.content).toEqual([
      {
        type: 'fallback',
        from: { model: 'primary-model' },
        to: { model: 'mid-model' },
        trigger: { type: 'refusal', category: null },
      },
      {
        type: 'fallback',
        from: { model: 'mid-model' },
        to: { model: 'last-model' },
        trigger: { type: 'refusal', category: null },
      },
      { type: 'text', text: 'ok' },
    ]);
  });

  test('a pinned start seams from the pinned entry, not the original body model', async () => {
    const { client, bodies } = makeClient(
      [refusal('mid-model'), message('last-model', { content: [{ type: 'text', text: 'ok' }] })],
      betaRefusalFallbackMiddleware([{ model: 'mid-model' }, { model: 'last-model' }]),
    );

    const fallbackState = new BetaFallbackState();
    fallbackState.index = 0;
    const result = await client.beta.messages.create(params, { fallbackState });
    expect(bodies.map((b) => b['model'])).toEqual(['mid-model', 'last-model']);
    expect(result.content).toEqual([
      {
        type: 'fallback',
        from: { model: 'mid-model' },
        to: { model: 'last-model' },
        trigger: { type: 'refusal', category: null },
      },
      { type: 'text', text: 'ok' },
    ]);
  });

  test('returns the final refusal once the chain is exhausted', async () => {
    const { client, bodies } = makeClient(
      [refusal('primary-model'), refusal('fallback-model')],
      betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
    );

    const result = await client.beta.messages.create(params);
    expect(result.model).toEqual('fallback-model');
    expect(result.stop_reason).toEqual('refusal');
    expect(bodies).toHaveLength(2);
  });

  describe('beta header', () => {
    const makeHeaderClient = (responses: Response[], middleware: Middleware) => {
      const betaHeaders: (string | null)[] = [];
      const client = new Anthropic({
        apiKey: 'my-anthropic-api-key',
        fetch: async (_url, init) => {
          betaHeaders.push(new Headers(init!.headers).get('anthropic-beta'));
          return responses.shift()!;
        },
        middleware: [middleware],
      });
      return { client, betaHeaders };
    };

    test('sends the fallback-credit beta on the original and fallback requests', async () => {
      const { client, betaHeaders } = makeHeaderClient(
        [refusal('primary-model', 'credit-token'), message('fallback-model')],
        betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
      );

      await client.beta.messages.create(params);
      expect(betaHeaders).toEqual(['fallback-credit-2026-06-01', 'fallback-credit-2026-06-01']);
    });

    test('the betas option replaces the default', async () => {
      const { client, betaHeaders } = makeHeaderClient(
        [message('primary-model')],
        betaRefusalFallbackMiddleware([{ model: 'fallback-model' }], {
          betas: ['fallback-credit-2027-01-01', 'interleaved-thinking-2025-05-14'],
        }),
      );

      await client.beta.messages.create(params);
      expect(betaHeaders).toEqual(['fallback-credit-2027-01-01, interleaved-thinking-2025-05-14']);
    });

    test('betas: [] sends no beta header', async () => {
      const { client, betaHeaders } = makeHeaderClient(
        [message('primary-model')],
        betaRefusalFallbackMiddleware([{ model: 'fallback-model' }], { betas: [] }),
      );

      await client.beta.messages.create(params);
      expect(betaHeaders).toEqual([null]);
    });

    test('does not duplicate a beta already on the request', async () => {
      const { client, betaHeaders } = makeHeaderClient(
        [message('primary-model')],
        betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
      );

      await client.beta.messages.create({ ...params, betas: ['fallback-credit-2026-06-01'] });
      expect(betaHeaders).toEqual(['fallback-credit-2026-06-01']);
    });

    test('appends to betas already on the request', async () => {
      const { client, betaHeaders } = makeHeaderClient(
        [message('primary-model')],
        betaRefusalFallbackMiddleware([{ model: 'fallback-model' }]),
      );

      await client.beta.messages.create({ ...params, betas: ['interleaved-thinking-2025-05-14'] });
      expect(betaHeaders).toEqual(['interleaved-thinking-2025-05-14, fallback-credit-2026-06-01']);
    });
  });
});
