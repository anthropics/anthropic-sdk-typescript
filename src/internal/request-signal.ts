/**
 * Tracks the removal of the per-request abort listener that
 * `fetchWithTimeout` attaches to a caller-provided signal, so the listener's
 * lifetime matches the request instead of the signal.
 *
 * Without removal, a long-lived signal (e.g. one AbortController reused for
 * a whole session) accumulates one `{ once: true }` listener plus its bound
 * AbortController per HTTP attempt until the signal fires or is collected,
 * and Node warns at the 11th listener. The listener must survive until the
 * response body is settled - removing it when fetch resolves (headers) would
 * break aborting an in-flight body read - so the code that finishes the body
 * (response parsing, stream teardown, retry/error handling) calls
 * `releaseRequestSignal` with the request's controller.
 */
const cleanups = new WeakMap<AbortController, () => void>();

export function registerRequestSignalCleanup(controller: AbortController, cleanup: () => void): void {
  cleanups.set(controller, cleanup);
}

export function releaseRequestSignal(controller: AbortController): void {
  const cleanup = cleanups.get(controller);
  if (cleanup) {
    cleanups.delete(controller);
    cleanup();
  }
}
