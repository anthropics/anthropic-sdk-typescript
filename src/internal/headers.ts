// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { isReadonlyArray } from './utils/values';

type HeaderValue = string | undefined | null;
export type HeadersLike =
  | Headers
  | readonly HeaderValue[][]
  | Record<string, HeaderValue | readonly HeaderValue[]>
  | undefined
  | null
  | NullableHeaders;

const brand_privateNullableHeaders = Symbol.for('brand.privateNullableHeaders') as symbol & {
  description: 'brand.privateNullableHeaders';
};

/**
 * @internal
 * Users can pass explicit nulls to unset default headers. When we parse them
 * into a standard headers type we need to preserve that information.
 */
export type NullableHeaders = {
  /** Brand check, prevent users from creating a NullableHeaders. */
  [_: typeof brand_privateNullableHeaders]: true;
  /** Parsed headers. */
  values: Headers;
  /** Set of lowercase header names explicitly set to null. */
  nulls: Set<string>;
};

function* iterateHeaders(
  headers: HeadersLike,
): IterableIterator<readonly [string, string | null | ClearSentinel]> {
  if (!headers) return;

  if (brand_privateNullableHeaders in headers) {
    const { values, nulls } = headers as NullableHeaders;
    yield* values.entries();
    for (const name of nulls) {
      yield [name, null];
    }
    return;
  }

  let shouldClear = false;
  let iter: Iterable<readonly (HeaderValue | readonly HeaderValue[])[]>;
  if (headers instanceof Headers) {
    iter = headers.entries();
  } else if (isReadonlyArray(headers)) {
    iter = headers;
  } else {
    shouldClear = true;
    iter = Object.entries(headers ?? {});
  }
  for (let row of iter) {
    const name = row[0];
    if (typeof name !== 'string') throw new TypeError('expected header name to be a string');
    const values = isReadonlyArray(row[1]) ? row[1] : [row[1]];
    let didClear = false;
    for (const value of values) {
      if (value === undefined) continue;

      // Objects keys always overwrite older headers, they never append.
      // Yield the clear sentinel before adding the new values, so the
      // consumer can tell this synthetic "clear-before-set" apart from a
      // user's explicit `null` (= remove).
      if (shouldClear && !didClear) {
        didClear = true;
        yield [name, clearSentinel];
      }
      yield [name, value];
    }
  }
}

/** Distinguishes iterateHeaders' synthetic clear-before-set from a user `null`. */
const clearSentinel = Symbol('clear');
type ClearSentinel = typeof clearSentinel;

/**
 * Headers whose values accumulate across {@link buildHeaders} sources instead
 * of the later source's value replacing the earlier one. Values are
 * comma-appended (deduplicated, order-preserving) into a single header line.
 */
export const APPEND_HEADERS: ReadonlySet<string> = new Set(['x-stainless-helper']);

export const appendHeaderValue = (existing: string | null, addition: string): string => {
  const tokens =
    existing ?
      existing
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  for (const tok of addition.split(',').map((t) => t.trim())) {
    if (tok && !tokens.includes(tok)) tokens.push(tok);
  }
  return tokens.join(', ');
};

export const buildHeaders = (newHeaders: HeadersLike[]): NullableHeaders => {
  const targetHeaders = new Headers();
  const nullHeaders = new Set<string>();
  for (const headers of newHeaders) {
    const seenHeaders = new Set<string>();
    for (const [name, value] of iterateHeaders(headers)) {
      const lowerName = name.toLowerCase();
      if (APPEND_HEADERS.has(lowerName)) {
        // Accumulating headers ignore the synthetic clear-before-set; an
        // explicit `null` (any source shape) is honored as removal.
        if (value === clearSentinel) continue;
        if (value === null) {
          targetHeaders.delete(name);
          nullHeaders.add(lowerName);
        } else {
          targetHeaders.set(name, appendHeaderValue(targetHeaders.get(name), value));
          nullHeaders.delete(lowerName);
        }
        continue;
      }
      if (value === clearSentinel || !seenHeaders.has(lowerName)) {
        targetHeaders.delete(name);
        seenHeaders.add(lowerName);
        if (value === clearSentinel) continue;
      }
      if (value === null) {
        targetHeaders.delete(name);
        nullHeaders.add(lowerName);
      } else {
        targetHeaders.append(name, value);
        nullHeaders.delete(lowerName);
      }
    }
  }
  return { [brand_privateNullableHeaders]: true, values: targetHeaders, nulls: nullHeaders };
};

export const isEmptyHeaders = (headers: HeadersLike) => {
  for (const _ of iterateHeaders(headers)) return false;
  return true;
};
