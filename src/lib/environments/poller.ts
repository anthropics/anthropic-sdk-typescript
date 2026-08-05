import { AnthropicError } from '../../core/error';
import type { Anthropic } from '../../client';
import type { BetaSelfHostedWork } from '../../resources/beta/environments/work';
import { loggerFor } from '../../internal/utils/log';
import { sleep } from '../../internal/utils/sleep';
import { uuid4 } from '../../internal/utils/uuid';
import { linkAbort } from '../../internal/utils/abort';
import { buildHeaders } from '../../internal/headers';
import type { BetaToolRunnerRequestOptions } from '../tools/BetaToolRunner';
import {
  applyJitter,
  backoff as expBackoff,
  isFatal4xx,
  isStatus,
  jitter,
} from '../../internal/utils/backoff';
import { copyClientForHelper } from '../helper-client';

export { is4xx, isFatal4xx, isStatus, jitter } from '../../internal/utils/backoff';

// API caps block_ms at 999; rely on client-side jitter between empty polls.
export const POLL_BLOCK_MS = 999;
const POLL_BACKOFF_BASE_MS = 1000;
const POLL_BACKOFF_CAP_MS = 60_000;

export interface WorkPollerOptions {
  client: Anthropic;
  environmentId: string;
  /**
   * The environment key — the single credential for the self-hosted runner. It
   * authenticates the work-poll calls here and every per-session call the
   * consumer makes afterwards.
   */
  environmentKey: string;
  workerId?: string;
  /** External abort signal. Aborting it ends the iteration. */
  signal?: AbortSignal;
  /**
   * Whether the poller posts `work.stop` itself after the consumer's loop body
   * returns. Defaults to `true`. Set `false` when the consumer already owns the
   * stop (e.g. {@link EnvironmentWorker} force-stops every item) so the work
   * item is not stopped twice.
   *
   * Orthogonal to {@link WorkPollerOptions.drain}: `autoStop` is a per-item
   * lifecycle flag (does the poller `work.stop` each item), `drain` controls
   * loop termination (does the poller return when the queue is empty). They are
   * not two names for the same thing — `EnvironmentWorker.run` uses
   * `autoStop: false` with `drain` defaulting `false`.
   */
  autoStop?: boolean;
  /**
   * When `true`, the poller returns (ends iteration) as soon as the work queue
   * is empty instead of long-polling forever. Defaults to `false` (long-poll
   * until aborted). Pair with `blockMs: null` for a single non-blocking pass
   * over whatever is already queued.
   */
  drain?: boolean;
  /**
   * Block timeout in milliseconds passed through to `work.poll` — the server
   * long-polls up to this long for an item before returning empty. Defaults to
   * {@link POLL_BLOCK_MS} (the API cap, 999). Pass `null` to omit it entirely
   * for a non-blocking single poll (useful with {@link WorkPollerOptions.drain}).
   */
  blockMs?: number | null;
  /**
   * Reclaim unacknowledged work items older than this many milliseconds, passed
   * through to `work.poll`'s `reclaim_older_than_ms`. Defaults to `undefined`
   * (omitted — the server applies its own default).
   */
  reclaimOlderThanMs?: number | null;
  /**
   * Extra per-request options merged into the poll/ack/stop calls. Custom
   * `headers` (e.g. a proxy's auth/routing headers) are layered on top of the
   * environment-key auth + helper telemetry headers; the poller owns the abort
   * signal, so a `signal` here is ignored.
   */
  requestOptions?: BetaToolRunnerRequestOptions;
}

/**
 * Async-iterable that long-polls a self-hosted environment for work, ack's
 * each item, yields the {@link BetaSelfHostedWork} item, and posts `stop` after
 * the consumer's loop body returns (or when the consumer `break`s).
 *
 * @example
 * ```ts
 * for await (const work of client.beta.environments.work.poller({
 *   environmentId,
 *   environmentKey,
 * })) {
 *   // ...service the work...
 * }
 * ```
 */
export class WorkPoller implements AsyncIterable<BetaSelfHostedWork> {
  readonly client: Anthropic;
  readonly environmentId: string;
  readonly environmentKey: string;
  readonly workerId: string;

  // Sub-client scoped to the environment key. Every poll / ack / stop call
  // is routed through this so the parent's `X-Api-Key` never lands on the
  // wire alongside the bearer credential. The helper-telemetry header is
  // attached as a default on this client; per-call plumbing is unnecessary.
  readonly #runnerClient: Anthropic;
  #consumed = false;
  readonly #controller: AbortController;
  readonly #detachExternal: () => void;
  readonly #autoStop: boolean;
  readonly #drain: boolean;
  readonly #blockMs: number | null;
  readonly #reclaimOlderThanMs: number | null;
  readonly #requestOpts: BetaToolRunnerRequestOptions | undefined;

  constructor(opts: WorkPollerOptions) {
    this.client = opts.client;
    this.environmentId = opts.environmentId;
    this.environmentKey = opts.environmentKey;
    this.workerId = opts.workerId ?? defaultWorkerId();
    this.#runnerClient = copyClientForHelper(opts.client, {
      authToken: opts.environmentKey,
      helper: 'environments-work-poller',
    });
    this.#autoStop = opts.autoStop ?? true;
    this.#drain = opts.drain ?? false;
    // `undefined` => default to the API cap; an explicit `null` => omit
    // `block_ms` for a non-blocking poll.
    this.#blockMs = opts.blockMs === undefined ? POLL_BLOCK_MS : opts.blockMs;
    this.#reclaimOlderThanMs = opts.reclaimOlderThanMs ?? null;
    this.#requestOpts = opts.requestOptions;
    this.#controller = new AbortController();
    this.#detachExternal = linkAbort(opts.signal, this.#controller);
  }

  /** Read-only view of this iterator's abort signal. */
  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  /** Abort the iterator. The current `for await` will exit cleanly. */
  abort(): void {
    this.#controller.abort();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<BetaSelfHostedWork> {
    if (this.#consumed) {
      throw new AnthropicError('Cannot iterate over a consumed WorkPoller');
    }
    this.#consumed = true;
    const log = loggerFor(this.client);
    log.info('poller starting', {
      component: 'work-poller',
      environment_id: this.environmentId,
    });

    try {
      let attempt = 0;
      while (!this.#controller.signal.aborted) {
        let work: BetaSelfHostedWork | null;
        try {
          work = await this.#runnerClient.beta.environments.work.poll(
            this.environmentId,
            {
              'Anthropic-Worker-ID': this.workerId,
              ...(this.#blockMs !== null ? { block_ms: this.#blockMs } : {}),
              ...(this.#reclaimOlderThanMs !== null ?
                { reclaim_older_than_ms: this.#reclaimOlderThanMs }
              : {}),
            },
            { headers: buildHeaders([this.#requestOpts?.headers]), signal: this.#controller.signal },
          );
        } catch (e) {
          if (this.#controller.signal.aborted) return;
          // A bad environment key / missing environment never recovers — surface
          // it instead of spinning forever at the backoff cap.
          if (isFatal4xx(e)) {
            log.error('poll failed permanently, stopping poller', { error: String(e) });
            throw e;
          }
          // Jittered exponential backoff so a fleet of pollers doesn't retry in
          // lockstep after a shared outage.
          const wait = applyJitter(backoff(attempt));
          log.warn('poll failed, backing off', { error: String(e), backoff_ms: wait });
          attempt++;
          await sleep(wait, this.#controller.signal);
          continue;
        }
        attempt = 0;
        if (work == null) {
          // Queue empty: either return now (drain) or wait and poll again.
          if (this.#drain) return;
          await sleep(jitter(1000, 3000), this.#controller.signal);
          continue;
        }
        log.info('claimed work', {
          component: 'work-poller',
          environment_id: this.environmentId,
          work_id: work.id,
          work_type: work.data.type,
        });

        try {
          await this.#runnerClient.beta.environments.work.ack(
            work.id,
            { environment_id: work.environment_id },
            { headers: buildHeaders([this.#requestOpts?.headers]), signal: this.#controller.signal },
          );
        } catch (e) {
          log.error('ack failed', { work_id: work.id, error: String(e) });
          continue;
        }

        try {
          yield work;
        } finally {
          // Post-handler stop. Runs whether the consumer body returned
          // normally, threw, or `break`d out of the loop — unless the consumer
          // owns the stop itself (`autoStop: false`).
          if (this.#autoStop) {
            try {
              await this.#runnerClient.beta.environments.work.stop(
                work.id,
                { environment_id: work.environment_id },
                { headers: buildHeaders([this.#requestOpts?.headers]) },
              );
            } catch (e) {
              if (!isStatus(e, 409)) log.warn('stop failed', { work_id: work.id, error: String(e) });
            }
          }
        }
      }
    } finally {
      // Detach from the external signal so the consumer can drop their
      // signal reference without leaking this iterator instance.
      this.#detachExternal();
    }
  }
}

/** Exponential poll backoff: 1s, 2s, 4s … clamped to a 60s cap. */
export function backoff(attempt: number): number {
  return expBackoff(attempt, POLL_BACKOFF_BASE_MS, POLL_BACKOFF_CAP_MS);
}

function defaultWorkerId(): string {
  // The API documents the worker id as a *unique* identifier for Redis consumer
  // groups, so the fallback must be unique even when several pollers share a
  // host. Prefix with the hostname when one is exposed for readability, but rely
  // on the uuid for uniqueness.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const host = env?.['HOSTNAME'];
  return host ? `${host}-${uuid4()}` : uuid4();
}
