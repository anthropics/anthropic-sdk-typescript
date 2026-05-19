import { APIError } from '../../core/error';

/** True when `e` is an {@link APIError} whose HTTP status equals `code`. */
export function isStatus(e: unknown, code: number): boolean {
  return e instanceof APIError && e.status === code;
}

/** True when `e` is an {@link APIError} with a 4xx status. */
export function is4xx(e: unknown): boolean {
  return e instanceof APIError && typeof e.status === 'number' && e.status >= 400 && e.status < 500;
}

/**
 * True for a 4xx that the core client's retry policy would *not* retry, i.e. a
 * permanent client error. 408 (request timeout), 409 (lock timeout) and 429
 * (rate limit) are retryable for the base client (`Anthropic.shouldRetry`), so
 * they are not treated as fatal here — keeping helper retry behaviour aligned
 * with the rest of the SDK.
 */
export function isFatal4xx(e: unknown): boolean {
  return is4xx(e) && !isStatus(e, 408) && !isStatus(e, 409) && !isStatus(e, 429);
}

/** Exponential backoff: `baseMs * 2 ** attempt`, clamped to `capMs`. */
export function backoff(attempt: number, baseMs: number, capMs: number): number {
  return Math.min(baseMs * 2 ** attempt, capMs);
}

/** Uniform random delay in the half-open interval `[lowMs, highMs)`. */
export function jitter(lowMs: number, highMs: number): number {
  return lowMs + Math.random() * (highMs - lowMs);
}

/**
 * Trim up to 25% off `ms` at random so a fleet of clients backing off after a
 * shared outage does not retry in lockstep — mirrors the jitter the core client
 * applies to its own retry timeout.
 */
export function applyJitter(ms: number): number {
  return ms * (1 - Math.random() * 0.25);
}
