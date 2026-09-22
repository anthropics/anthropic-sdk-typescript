/** Shared fixtures for the memory-sync suite. */

import type { MockInstance } from 'vitest';
import type { SessionMemoryStores } from '@anthropic-ai/sdk/tools/agent-toolset/node';

/**
 * Drive one reconcile pass without clock bookkeeping.
 *
 * The public cadence path (`syncIfDue` plus the clock) is exercised
 * by the worker tests; unit tests call the pass directly.
 */
export const runSync = (stores: SessionMemoryStores): Promise<void> => stores.syncAll(false);

/** A settable stand-in for the module's `Date.now`. */
export class Clock {
  now = 0;
  #spy: MockInstance<() => number>;

  constructor() {
    this.#spy = vi.spyOn(Date, 'now').mockImplementation(() => this.now);
  }

  restore(): void {
    this.#spy.mockRestore();
  }
}
