/**
 * A deferred: a `Promise` together with its `resolve` / `reject` functions.
 * This is `Promise.withResolvers()`, which is not available in all supported
 * runtimes.
 */
export function promiseWithResolvers<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
