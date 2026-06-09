// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { NullableHeaders } from './headers';

import type { BodyInit } from './builtin-types';
import { Stream } from '../core/streaming';
import type { Middleware } from '../core/middleware';
import type { HTTPMethod, MergedRequestInit } from './types';
import { type HeadersLike } from './headers';

export type FinalRequestOptions = RequestOptions & { method: HTTPMethod; path: string };

/**
 * Tracks which fallback a sequence of requests is pinned to.
 *
 * Create one (`new BetaFallbackState()`) and pass it via the `fallbackState`
 * request option on every request that should share the pin — the turns of one
 * conversation, or any wider scope the stickiness should apply to;
 * `betaRefusalFallbackMiddleware` mutates it in place when a model refuses.
 */
export class BetaFallbackState {
  /**
   * Index into the fallback chain the requests are pinned to.
   *
   * `undefined` (or -1) targets the original request params; the middleware
   * sets it to the index of the fallback that accepted the request.
   */
  index?: number;
}

/**
 * Options for an individual API request.
 *
 * Declared as an interface so it can be extended via declaration merging, e.g.
 * to thread custom per-request context through to {@link Middleware}:
 *
 * ```ts
 * declare module '@anthropic-ai/sdk/internal/request-options' {
 *   interface RequestOptions {
 *     myContext?: string;
 *   }
 * }
 * ```
 *
 * The SDK ignores properties it doesn't know about; they are visible to
 * middleware on `ctx.options`.
 */
export interface RequestOptions {
  /**
   * The HTTP method for the request (e.g., 'get', 'post', 'put', 'delete').
   */
  method?: HTTPMethod;

  /**
   * The URL path for the request.
   *
   * @example "/v1/foo"
   */
  path?: string;

  /**
   * Query parameters to include in the request URL.
   */
  query?: object | undefined | null;

  /**
   * The request body. Can be a string, JSON object, FormData, or other supported types.
   */
  body?: unknown;

  /**
   * HTTP headers to include with the request. Can be a Headers object, plain object, or array of tuples.
   */
  headers?: HeadersLike;

  /**
   * The maximum number of times that the client will retry a request in case of a
   * temporary failure, like a network error or a 5XX error from the server.
   *
   * @default 2
   */
  maxRetries?: number;

  stream?: boolean | undefined;

  /**
   * The maximum amount of time (in milliseconds) that the client should wait for a response
   * from the server before timing out a single request.
   *
   * @unit milliseconds
   */
  timeout?: number;

  /**
   * Additional `RequestInit` options to be passed to the underlying `fetch` call.
   * These options will be merged with the client's default fetch options.
   */
  fetchOptions?: MergedRequestInit;

  /**
   * An AbortSignal that can be used to cancel the request.
   */
  signal?: AbortSignal | undefined | null;

  /**
   * Additional {@link Middleware} to wrap this request's HTTP attempts.
   *
   * These run after any client-level middleware (but still outside any backend
   * adaptation) and apply to every attempt of this request, including retries.
   */
  middleware?: ReadonlyArray<Middleware> | undefined;

  /**
   * Sticky state for `betaRefusalFallbackMiddleware`.
   *
   * The middleware records which fallback it settled on, so requests sharing
   * the state skip models that already refused. Pass the same object across
   * whatever scope the pin should apply to — typically a conversation.
   */
  fallbackState?: BetaFallbackState;

  /**
   * A unique key for this request to enable idempotency.
   */
  idempotencyKey?: string;

  /**
   * Override the default base URL for this specific request.
   */
  defaultBaseURL?: string | undefined;

  __binaryResponse?: boolean | undefined;
  __streamClass?: typeof Stream;
}

export type EncodedContent = { bodyHeaders: HeadersLike; body: BodyInit };
export type RequestEncoder = (request: { headers: NullableHeaders; body: unknown }) => EncodedContent;

export const FallbackEncoder: RequestEncoder = ({ headers, body }) => {
  return {
    bodyHeaders: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  };
};
