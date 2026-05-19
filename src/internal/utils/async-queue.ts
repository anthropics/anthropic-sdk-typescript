export type AsyncQueueResult<T> = { done: false; value: T } | { done: true; value: undefined };

/**
 * Single-consumer async queue that bridges background producers to an
 * `AsyncIterator`-style reader. Producers `push()` items; the consumer awaits
 * `next()`. `close()` is idempotent and wakes any pending `next()` with
 * `done: true`. `tryShift()` synchronously drains remaining items after
 * iteration has been signalled to stop.
 */
export class AsyncQueue<T> {
  #items: T[] = [];
  #waiters: Array<(r: AsyncQueueResult<T>) => void> = [];
  #closed = false;

  /** Enqueue an item, or hand it directly to a waiting reader. Returns `false` once closed. */
  push(item: T): boolean {
    if (this.#closed) return false;
    const w = this.#waiters.shift();
    if (w) w({ done: false, value: item });
    else this.#items.push(item);
    return true;
  }

  /** Mark the queue done. Idempotent; wakes every pending reader with `done: true`. */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    while (this.#waiters.length > 0) {
      const w = this.#waiters.shift()!;
      w({ done: true, value: undefined });
    }
  }

  /**
   * Resolve with the next item, or `done: true` once the queue is closed and
   * drained. When `signal` is supplied, aborting it resolves a pending read
   * with `done: true` (cancellation is pushed down here rather than handled by
   * an outer `Promise.race`).
   */
  next(signal?: AbortSignal): Promise<AsyncQueueResult<T>> {
    if (this.#items.length > 0) {
      return Promise.resolve({ done: false, value: this.#items.shift()! });
    }
    if (this.#closed || signal?.aborted) {
      return Promise.resolve({ done: true, value: undefined });
    }
    return new Promise<AsyncQueueResult<T>>((resolve) => {
      const waiter = (r: AsyncQueueResult<T>) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(r);
      };
      const onAbort = () => {
        const idx = this.#waiters.indexOf(waiter);
        if (idx >= 0) this.#waiters.splice(idx, 1);
        resolve({ done: true, value: undefined });
      };
      this.#waiters.push(waiter);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /** Synchronously remove and return the next buffered item, or `undefined` if empty. */
  tryShift(): T | undefined {
    return this.#items.shift();
  }
}
