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

// Backstop for requests that never reach an explicit release point: a caller
// that partially iterates a stream (or receives a raw binary Response) and
// drops the reference never completes, errors, or cancels it, so the only
// remaining lifecycle event is the response being collected. Finalization
// timing is GC-driven and not guaranteed, so this only bounds abandonment -
// the explicit release calls stay the primary cleanup. The held value must
// not reference the response, or it could never be collected. Typed
// structurally because the compiler lib is es2020.
type AbandonmentRegistry = {
  register(target: object, heldValue: AbortController, token: object): void;
  unregister(token: object): void;
};

const registry: AbandonmentRegistry | null =
  typeof (globalThis as any).FinalizationRegistry === 'function' ?
    new (globalThis as any).FinalizationRegistry((controller: AbortController) =>
      releaseRequestSignal(controller),
    )
  : null;

export function registerRequestSignalCleanup(controller: AbortController, cleanup: () => void): void {
  cleanups.set(controller, cleanup);
}

export function armAbandonmentBackstop(response: object, controller: AbortController): void {
  if (cleanups.has(controller)) registry?.register(response, controller, controller);
}

export function releaseRequestSignal(controller: AbortController): void {
  const cleanup = cleanups.get(controller);
  if (cleanup) {
    cleanups.delete(controller);
    registry?.unregister(controller);
    cleanup();
  }
}
