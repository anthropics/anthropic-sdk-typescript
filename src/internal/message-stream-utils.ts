import { partialParse } from '../_vendor/partial-json-parser/parser';

export const JSON_BUF_PROPERTY = '__json_buf';

/**
 * Copies a tool-use block with an updated `__json_buf`, installing `.input` as
 * a memoized getter so the partial-JSON parse happens on first read instead of
 * on every delta.
 */
export function withLazyInput<T extends { input: unknown }>(prev: T, jsonBuf: string): T {
  const next = {} as T;
  for (const key of Object.keys(prev) as (keyof T)[]) {
    if (key !== 'input') next[key] = prev[key];
  }
  Object.defineProperty(next, JSON_BUF_PROPERTY, { value: jsonBuf, enumerable: false, writable: true });
  let input: unknown;
  let parsed = false;
  Object.defineProperty(next, 'input', {
    enumerable: true,
    configurable: true,
    get() {
      if (!parsed) {
        input = jsonBuf ? partialParse(jsonBuf) : {};
        parsed = true;
      }
      return input;
    },
  });
  return next;
}
