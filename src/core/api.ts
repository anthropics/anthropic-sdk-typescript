import type { FinalizedRequestInit } from '../internal/types';

/**
 * An HTTP request as it will be passed to `fetch`, the `RequestInit` plus the request `url`.
 *
 * `headers` is always a `Headers` instance and may be mutated in place.
 */
export type APIRequest = FinalizedRequestInit & {
  /** The fully-built request URL, including query parameters. */
  url: string;
};
