import type { BaseAnthropic } from '../client';
import type { Fetch } from '../internal/builtin-types';
import { castToError, isAbortError } from '../internal/errors';
import { addRequestID } from '../internal/parse';
import type { FinalRequestOptions } from '../internal/request-options';
import { defaultLogger, loggerFor, type Logger } from '../internal/utils/log';
import type { APIRequest } from './api';
import { AnthropicError, APIConnectionError, RetryableError } from './error';
import { Stream } from './streaming';

/**
 * Invokes the rest of the middleware chain, ending with the underlying `fetch`.
 *
 * This function can be invoked multiple times.
 */
export type MiddlewareNext = (request: APIRequest) => Promise<Response>;

/**
 * Helpers passed to each middleware alongside `next`, scoped to the request
 * in flight (one context is shared by every middleware in the chain).
 */
export interface MiddlewareContext {
  /**
   * The SDK request options the API call in flight was made with: `method`,
   * `path`, the pre-encoded `body`, `stream`, etc.
   *
   * `undefined` when the chain isn't running for an SDK API request, i.e.
   * for credential token-exchange requests.
   */
  readonly options?: FinalRequestOptions | undefined;

  /**
   * The client's logger, pre-filtered to the client's configured log level
   * (the `logLevel` client option or the `ANTHROPIC_LOG` environment
   * variable). Calls below the active level are no-ops, so it's always safe
   * to call; with no logger configured it writes to the global `console`.
   *
   * Values are logged as-is — when logging request or response headers,
   * redact credentials (`authorization`, `x-api-key`, `cookie`) the way the
   * SDK's own logs do.
   *
   * @example
   * ```ts
   * const mw: Middleware = async (request, next, ctx) => {
   *   ctx.logger.debug('->', request.method, request.url);
   *   return next(request);
   * };
   * ```
   */
  readonly logger: Logger;

  /**
   * Parse a response body the way the SDK would for the request in flight:
   *
   * - JSON responses are decoded, with the non-enumerable `_request_id`
   *   property attached like SDK return values, and anything else resolves
   *   to the body text.
   * - For streaming requests ({@link options}`.stream`), resolves immediately
   *   with a {@link Stream} reading an independent copy of the response body —
   *   iterating it doesn't consume the client's events, and aborting or
   *   `break`ing out of it doesn't cancel the underlying request. Each call
   *   returns a fresh `Stream` (streams are single-consumer, so they aren't
   *   cached). Error (non-2xx) responses parse as JSON/text rather than as a
   *   stream, mirroring the SDK's own handling.
   * - For binary requests, resolves with the `Response` itself, unconsumed.
   *
   * Reads through an internal `response.clone()`, so the response stays
   * readable: the client (and any other middleware) can still consume the
   * body afterwards. Non-stream results are cached per `Response` and shared
   * across the middleware chain, so repeated calls cost a single read.
   *
   * @example
   * ```ts
   * const mw: Middleware = async (request, next, ctx) => {
   *   const response = await next(request);
   *   const data = await ctx.parse<Message>(response);
   *   if (data.type === 'message') console.log(data.usage);
   *   return response;
   * };
   * ```
   */
  parse<T = unknown>(response: Response): Promise<T>;
}

/**
 * A function that wraps each HTTP request made by the client.
 *
 * Middleware may observe or modify the request before calling `next`, observe
 * or replace the response, short-circuit by returning a `Response` without
 * calling `next`, or call `next` multiple times to implement custom retries.
 *
 * Middleware always observes the canonical Anthropic-shaped request — e.g.
 * `POST .../v1/messages` with `model` and `stream` in the JSON body and
 * `anthropic-beta` as a header — with the client's logical credentials
 * (`x-api-key` / `Authorization`) applied. On clients for third-party
 * backends (Bedrock, Vertex, Foundry), the backend adaptation — URL and body
 * rewriting, request signing (e.g. AWS SigV4), and response normalization
 * (e.g. AWS EventStream to SSE) — runs *inside* `next`, so middleware behaves
 * identically on every backend: mutating the request is safe (signing covers
 * the final body), and streaming responses are observed as SSE. Each `next()`
 * call re-runs the adaptation, so custom retries re-sign from scratch. To
 * observe the literal wire traffic instead, provide a custom `fetch`.
 *
 * Middleware must not consume the body of the `Response` it returns - the
 * client still needs to read it. To inspect the body, use
 * `await ctx.parse(response)` (cached, leaves the body readable) or read a
 * clone (`await response.clone().text()`); to transform it, return a
 * replacement, e.g. `new Response(body, response)`.
 *
 * Middleware runs per HTTP attempt, inside the SDK's retry loop; the attempt
 * number is available via the `X-Stainless-Retry-Count` request header. An
 * error thrown from middleware propagates to the caller as-is.
 *
 * Middleware errors are **not** retried apart from connection-level errors:
 * timeout/abort errors, errors thrown by `fetch()`, and `APIConnectionError`s
 * or `RetryableError`s — thrown directly or present anywhere in an error's
 * `cause` chain. Retryable middleware errors still propagate to the caller
 * as-is once retries are exhausted.
 *
 * @example
 * ```ts
 * const logger: Middleware = async (request, next, ctx) => {
 *   ctx.logger.debug('->', request.method, request.url);
 *   const response = await next(request);
 *   ctx.logger.debug('<-', response.status, request.url);
 *   return response;
 * };
 *
 * const client = new Anthropic({ middleware: [logger] });
 * ```
 */
export type Middleware = (
  request: APIRequest,
  next: MiddlewareNext,
  ctx: MiddlewareContext,
) => Promise<Response>;

/**
 * Errors thrown by the underlying `fetch`, as opposed to by a middleware.
 *
 * Tracked so the client can apply its connection-error retry policy to
 * transport failures while letting errors thrown by middleware propagate to
 * the caller untouched.
 */
const fetchOriginErrors = new WeakSet<object>();

/** Whether `err` was thrown by the underlying `fetch` rather than by a middleware. */
export function isFetchOriginError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && fetchOriginErrors.has(err);
}

/**
 * Whether an error thrown by middleware should stay on the SDK's
 * connection-error retry policy: fetch-origin, abort, `APIConnectionError`, or
 * `RetryableError` — checked through the error's `cause` chain.
 */
export function isRetryableError(err: unknown): boolean {
  const seen = new Set<unknown>(); // guard against `cause` cycles
  while (typeof err === 'object' && err !== null && !seen.has(err)) {
    seen.add(err);
    if (
      isFetchOriginError(err) ||
      isAbortError(err) ||
      err instanceof APIConnectionError ||
      err instanceof RetryableError
    ) {
      return true;
    }
    err = (err as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Wraps `fetchFn` so each call runs through `middleware`, keeping the same
 * call signature as `fetch` itself.
 *
 * With no middleware, calls are passed straight through to `fetchFn`.
 * Otherwise the arguments are normalized into an {@link APIRequest} (headers
 * coerced to a `Headers` instance, URL stringified) before entering the
 * chain. The chain is composed per call, so mutations of a `middleware`
 * array are picked up by later requests.
 *
 * `options` — the SDK request options behind this call, when there are any —
 * is surfaced to middleware as `ctx.options` and drives `ctx.parse`.
 *
 * `client` supplies `ctx.logger` (the client's level-filtered logger);
 * without it, `ctx.logger` falls back to the client defaults: `console`,
 * filtered to `ANTHROPIC_LOG` or `'warn'`.
 */
export function wrapFetchWithMiddleware(
  fetchFn: Fetch,
  middleware: readonly Middleware[],
  options?: FinalRequestOptions | undefined,
  client?: BaseAnthropic | undefined,
): Fetch {
  return async (url, init = {}) => {
    if (middleware.length === 0) {
      // use undefined this binding; fetch errors if bound to something else in browser/cloudflare
      return fetchFn.call(undefined, url, init);
    }
    const headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers);
    const response = await applyMiddleware(
      fetchFn,
      middleware,
      options,
      client,
    )({
      ...init,
      headers,
      url:
        typeof url === 'string' ? url
        : url instanceof URL ? url.href
        : url.url,
    });
    // Catch a footgun before the client tries to read the body itself and
    // fails with a confusing low-level stream error.
    if (response.bodyUsed || response.body?.locked) {
      throw new AnthropicError(
        'middleware consumed the response body; use response.clone() to inspect it, ' +
          'or return new Response(body, response) to consume and replace it',
      );
    }
    return response;
  };
}

/**
 * Creates the {@link MiddlewareContext} shared by every middleware in one chain.
 */
function createMiddlewareContext(
  options: FinalRequestOptions | undefined,
  client: BaseAnthropic | undefined,
): MiddlewareContext {
  // Keyed on the Response so each `next()` call's response (e.g. with custom
  // retries, or a middleware swapping in a replacement) parses independently,
  // while several middleware parsing the same response share a single read.
  const cache = new WeakMap<Response, Promise<unknown>>();
  return {
    options,
    // Resolved per chain, so changes to the client's `logLevel`/`logger`
    // apply to subsequent requests.
    logger: client ? loggerFor(client) : defaultLogger(),
    parse<T>(response: Response): Promise<T> {
      // Streams are single-consumer, so caching one would hand later callers
      // an already-consumed stream; every call gets a fresh clone-backed one.
      if (options?.stream && response.ok) {
        return parseMiddlewareResponse(response, options) as Promise<T>;
      }
      let parsed = cache.get(response);
      if (!parsed) {
        parsed = parseMiddlewareResponse(response, options);
        cache.set(response, parsed);
      }
      return parsed as Promise<T>;
    },
  };
}

/**
 * Mirrors the client's own response parsing (`defaultParseResponse` in
 * `internal/parse.ts`), reading through a clone so the body stays available
 * to the rest of the chain and the client itself.
 */
async function parseMiddlewareResponse(
  response: Response,
  options: FinalRequestOptions | undefined,
): Promise<unknown> {
  if (response.bodyUsed || response.body?.locked) {
    throw new AnthropicError(
      'cannot ctx.parse() a response whose body was already consumed; ' +
        'call ctx.parse() instead of reading the body, or read via response.clone()',
    );
  }

  // Error responses parse as JSON/text below — the SDK only stream-parses
  // successful responses, and middleware typically wants the error body.
  if (options?.stream && response.ok) {
    // A fresh controller rather than the request's own: aborting (or
    // `break`ing out of) the middleware's stream must not cancel the
    // in-flight request the client is still reading.
    return Stream.fromSSEResponse(response.clone(), new AbortController());
  }

  // fetch refuses to read the body when the status code is 204.
  if (response.status === 204) {
    return null;
  }

  if (options?.__binaryResponse) {
    return response;
  }

  const contentType = response.headers.get('content-type');
  const mediaType = contentType?.split(';')[0]?.trim();
  const isJSON = mediaType?.includes('application/json') || mediaType?.endsWith('+json');
  if (isJSON) {
    if (response.headers.get('content-length') === '0') {
      // if there is no content we can't do anything
      return undefined;
    }
    return addRequestID(await response.clone().json(), response);
  }

  return await response.clone().text();
}

/**
 * Composes `middleware` around `fetchFn` and returns the entry point of the chain.
 */
export function applyMiddleware(
  fetchFn: Fetch,
  middleware: readonly Middleware[],
  options?: FinalRequestOptions | undefined,
  client?: BaseAnthropic | undefined,
): MiddlewareNext {
  // use undefined this binding; fetch errors if bound to something else in browser/cloudflare
  let next: MiddlewareNext = async ({ url, ...init }) => {
    try {
      return await fetchFn.call(undefined, url, init);
    } catch (err) {
      // Brand the error as fetch-origin, normalizing with `castToError` first since a
      // WeakSet can't hold primitives and the brand must be on the same object the
      // client's own `castToError` will later pass through.
      const error = castToError(err);
      fetchOriginErrors.add(error);
      throw error;
    }
  };

  const ctx = createMiddlewareContext(options, client);
  for (let i = middleware.length - 1; i >= 0; i--) {
    const mw = middleware[i]!;
    const nextInner = next;
    next = async (request) => mw(request, nextInner, ctx);
  }

  return next;
}
