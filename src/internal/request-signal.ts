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

// One per request, shared by its registered targets.
type Abandonment = { controller: AbortController; remaining: number };

// Backstop for requests that never reach an explicit release point: a caller
// that partially iterates a stream (or receives a raw binary Response) and
// drops the reference never completes, errors, or cancels it, so the only
// remaining lifecycle event is the response being collected. Finalization
// timing is GC-driven and not guaranteed, so this only bounds abandonment -
// the explicit release calls stay the primary cleanup. The held value must
// not reference the response, or it could never be collected. Typed
// structurally because the compiler lib is es2020.
type AbandonmentRegistry = {
  register(target: object, heldValue: Abandonment, token: object): void;
  unregister(token: object): void;
};

const registry: AbandonmentRegistry | null =
  typeof (globalThis as any).FinalizationRegistry === 'function' ?
    new (globalThis as any).FinalizationRegistry((abandonment: Abandonment) => {
      if (--abandonment.remaining === 0) releaseRequestSignal(abandonment.controller);
    })
  : null;

// Module-scope factory so the cleanup closure captures exactly the signal and
// the listener - built at the `fetchWithTimeout` call site it would share that
// scope's context and retain the request body for as long as the cleanup is
// held (same reason `_makeAbort` exists in client.ts).
function makeCleanup(signal: AbortSignal, listener: () => void): () => void {
  return () => signal.removeEventListener('abort', listener);
}

export function registerRequestSignalCleanup(
  controller: AbortController,
  signal: AbortSignal,
  listener: () => void,
): void {
  cleanups.set(controller, makeCleanup(signal, listener));
}

// Both the Response and its body are registered, and the listener is released
// only once both are collected. A caller can keep a reader on the body and drop
// the Response wrapper (`.asResponse()`), so the body alone keeps it armed. A
// caller can also hold the Response with its body unread, and some runtimes
// (Cloudflare workerd) let the body's JS wrapper be collected while the
// Response is alive, so the Response alone keeps it armed too.
export function armAbandonmentBackstop(response: Response, controller: AbortController): void {
  if (!registry || !cleanups.has(controller)) return;
  const targets: object[] = response.body ? [response.body, response] : [response];
  const abandonment: Abandonment = { controller, remaining: targets.length };
  for (const target of targets) registry.register(target, abandonment, controller);
}

export function releaseRequestSignal(controller: AbortController): void {
  const cleanup = cleanups.get(controller);
  if (cleanup) {
    cleanups.delete(controller);
    registry?.unregister(controller);
    cleanup();
  }
}
