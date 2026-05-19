/**
 * Chain an external {@link AbortSignal} into a local {@link AbortController}:
 * the controller aborts whenever `external` aborts (synchronously if it is
 * already aborted).
 *
 * Returns a cleanup function that detaches the listener. Callers MUST invoke it
 * on their normal teardown path — `{ once: true }` only removes the listener if
 * abort actually fires, so a long-lived `external` signal (e.g. a daemon-wide
 * signal reused across many short-lived controllers) would otherwise leak one
 * listener per controller.
 */
export function linkAbort(external: AbortSignal | null | undefined, controller: AbortController): () => void {
  if (!external) return () => {};
  if (external.aborted) {
    controller.abort();
    return () => {};
  }
  const onAbort = () => controller.abort();
  external.addEventListener('abort', onAbort);
  return () => external.removeEventListener('abort', onAbort);
}
