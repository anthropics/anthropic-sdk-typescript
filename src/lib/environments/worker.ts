import { AnthropicError, APIError } from '../../core/error';
import type { Anthropic } from '../../client';
import type { BetaSelfHostedWork, BetaWorkSecret } from '../../resources/beta/environments/work';
import { loggerFor, type Logger } from '../../internal/utils/log';
import { fromBase64 } from '../../internal/utils/base64';
import { decodeUTF8 } from '../../internal/utils/bytes';
import { readEnv } from '../../internal/utils/env';
import { sleep } from '../../internal/utils/sleep';
import { isFatal4xx, isStatus } from '../../internal/utils/backoff';
import { linkAbort } from '../../internal/utils/abort';
import { isObj } from '../../internal/utils/values';
import { buildHeaders } from '../../internal/headers';
import type { BetaRunnableTool } from '../tools/BetaRunnableTool';
import type { BetaToolRunnerRequestOptions } from '../tools/BetaToolRunner';
import { SessionToolRunner } from '../tools/SessionToolRunner';
import { WorkPoller } from './poller';
import { copyClientForHelper } from '../helper-client';
// `tools/agent-toolset/node` is Node-only (node:child_process, node:fs, …).
// Only the type is imported statically (erased at build); the module's values
// (`setupSkills`, `betaAgentToolset20260401`) are loaded lazily inside the
// per-item handler. That keeps this file free of Node-only deps in the static
// import graph, which is what lets `client.beta.environments.work.worker()`
// exist as a resource method without pulling Node built-ins into the SDK core.
import type { AgentToolContext, MemoryDeleteMode, SessionMemoryStores } from '../../tools/agent-toolset/node';
import { checkMemorySyncInterval } from '../../tools/agent-toolset/sync-interval';
import type { BetaManagedAgentsSession } from '../../resources/beta/sessions/sessions';

const HEARTBEAT_DEFAULT_MS = 30_000;
const HEARTBEAT_TTL_DEFAULT_MS = 90_000;
const NO_HEARTBEAT_SENTINEL = 'NO_HEARTBEAT';

/**
 * Either a fixed tool array or a factory invoked once per claimed session with
 * that session's {@link AgentToolContext} — use the factory form to bind
 * `betaAgentToolset20260401` (or any tool that needs the workdir / session
 * id) to the right session.
 */
export type EnvironmentWorkerTools =
  | Array<BetaRunnableTool>
  | ((ctx: AgentToolContext) => Array<BetaRunnableTool>);

export interface EnvironmentWorkerOptions {
  client: Anthropic;
  /**
   * The self-hosted environment to poll for work. Required by
   * {@link EnvironmentWorker.run}; not used by {@link EnvironmentWorker.handleItem}.
   */
  environmentId?: string;
  /**
   * The environment key — the worker's standing credential: polling always
   * uses it, and per-session calls fall back to it when a claimed item's
   * `secret` doesn't yield a sessions token. Required by
   * {@link EnvironmentWorker.run}; falls back to `ANTHROPIC_ENVIRONMENT_KEY` in
   * {@link EnvironmentWorker.handleItem}.
   */
  environmentKey?: string;
  /**
   * Tools to expose to each claimed session. Defaults to
   * `betaAgentToolset20260401(ctx)` (the standard `agent_toolset_20260401` set
   * bound to the per-session {@link AgentToolContext}).
   *
   * A `run` that blocks the event loop synchronously also stalls the lease
   * heartbeat, and the worker can lose the lease; keep tools non-blocking (see
   * {@link BetaRunnableTool.run}).
   */
  tools?: EnvironmentWorkerTools;
  /** Base directory for the per-session {@link AgentToolContext}. Defaults to `process.cwd()`. */
  workdir?: string;
  /**
   * @deprecated No longer accepted: the file tools are always confined to
   * `workdir` plus `allowedRoots`, which is neither behavior this flag used to
   * select, so passing either value throws. Remove it; list extra directories
   * in {@link AgentToolContext.allowedRoots}. The property is removed in a
   * future release.
   */
  unrestrictedPaths?: boolean;
  /** Forwarded to the per-session {@link AgentToolContext} (`maxFileBytes`). */
  maxFileBytes?: number | null;
  /** Forwarded to {@link SessionToolRunner} (`maxIdleMs`). */
  maxIdleMs?: number;
  /**
   * How often (milliseconds) to sync the session's attached memory stores back
   * while it runs — checked after each dispatched tool call, plus one final
   * sync when the session ends cleanly. Defaults to
   * `DEFAULT_MEMORY_SYNC_INTERVAL_MS` (15s); the constructor throws for
   * values below `MIN_MEMORY_SYNC_INTERVAL_MS` (5s). Every teardown also runs
   * a push-only flush of changed files; that flush and the final sync are
   * each bounded by `MEMORY_FLUSH_TIMEOUT_MS`, and a warning is logged when
   * either bound cuts work off. `null` disables memory download and sync
   * entirely. Memory stores are only touched for work items whose `secret`
   * carries a `sessions_token`; while sync is enabled, an item without one
   * fails when its session has memory stores attached, because those stores
   * cannot be mounted without the token. With `null` the same item runs,
   * without memory, and nothing is logged — turning sync off is the
   * operator's explicit choice.
   */
  memorySyncIntervalMs?: number | null;
  /**
   * Whether local file deletions may delete on the server — see
   * {@link MemoryDeleteMode}. Uploads and pulls are unaffected.
   * Defaults to `"enabled"`.
   */
  memorySyncDeletions?: MemoryDeleteMode;
  /** Forwarded to the {@link WorkPoller}. */
  workerId?: string;
  /** External abort signal; aborting it ends the run. */
  signal?: AbortSignal;
  /**
   * Extra per-request options merged into every call this worker issues — the
   * work poll/ack/heartbeat/stop control-plane calls and the per-session
   * SessionToolRunner's stream/list/send. Mirrors what
   * `client.beta.messages.toolRunner` accepts: custom `headers` (e.g. a proxy's
   * auth/routing headers) reach all of them. The worker owns the abort signals,
   * so a `signal` here is ignored — use {@link EnvironmentWorkerOptions.signal}.
   */
  requestOptions?: BetaToolRunnerRequestOptions;
}

/**
 * Options for {@link EnvironmentWorker.handleItem}. Every field falls back to the
 * matching `ANTHROPIC_*` environment variable — the ones the
 * `ant worker poll --on-work` command sets for the process it spawns — when not
 * passed explicitly.
 */
export interface HandleItemOptions {
  /** Work item id. Falls back to `ANTHROPIC_WORK_ID`. */
  workId?: string;
  /** Self-hosted environment id. Falls back to `ANTHROPIC_ENVIRONMENT_ID`. */
  environmentId?: string;
  /** Session id. Falls back to `ANTHROPIC_SESSION_ID`. */
  sessionId?: string;
  /**
   * The environment key used to authenticate every per-session call. Resolution
   * order: this option, then the worker's own `environmentKey`, then
   * `ANTHROPIC_ENVIRONMENT_KEY`.
   */
  environmentKey?: string;
  /**
   * The work item's per-item `secret` payload from the poll response. Falls
   * back to `ANTHROPIC_WORK_SECRET`. Unlike the others it is optional — when
   * present, the sessions token extracted from it is preferred as the Bearer
   * credential for this item's heartbeat / force-stop / skill-download /
   * session calls; when absent (or undecodable) those calls use the
   * environment key.
   */
  workSecret?: string;
  /** External abort signal; aborting it ends the run. Defaults to the constructor's signal. */
  signal?: AbortSignal;
}

/**
 * The fields of {@link BetaSelfHostedWork} the per-item flow reads. `secret` is
 * declared here rather than picked because the generated model does not carry
 * it — only the poll response populates it.
 */
type ClaimedWork = Pick<BetaSelfHostedWork, 'id' | 'environment_id' | 'data'> & {
  secret?: string | null;
};

/** True when the session has at least one memory store attached. */
function hasMemoryStore(session: BetaManagedAgentsSession): boolean {
  return session.resources.some((r) => r.type === 'memory_store');
}

/**
 * Extract the per-item sessions token from a work item's `secret` payload.
 *
 * The `secret` the poll response populates is not itself a credential: it is a
 * URL-safe base64 JSON payload matching {@link BetaWorkSecret} — the
 * `sessions_token` (the bearer for this item's work lifecycle and
 * session-level calls) plus fields this worker does not consume. Returns the
 * sessions token, or `null` (meaning: fall back to the environment key) when
 * the payload is missing, doesn't decode, or carries no token. Never log the
 * payload or anything extracted from it.
 */
export function sessionsTokenFromSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  let parsed: unknown;
  try {
    // The payload may arrive URL-safe and without base64 padding; normalize
    // both before decoding.
    const normalized = secret.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    parsed = JSON.parse(decodeUTF8(fromBase64(padded)));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  // The payload is untrusted input, so the token is still checked at runtime
  // rather than trusted to match the schema.
  const token = (parsed as Partial<BetaWorkSecret>).sessions_token;
  return typeof token === 'string' && token !== '' ? token : null;
}

/**
 * The self-hosted environment runner, composed from the control-plane
 * {@link WorkPoller} and the per-session {@link SessionToolRunner}.
 *
 * For each claimed `session` work item it: builds the per-session
 * {@link AgentToolContext}, downloads the session agent's skills
 * (`setupSkills`), then runs a {@link SessionToolRunner} for the session
 * while heartbeating the work-item lease on the same event loop; on exit it
 * force-stops the work item (unless the lease was lost, in which case the item
 * is left to whoever holds it now), cleans up the downloaded skills, and loops
 * to the next one. The lease heartbeat reports `state === "stopping"` / a lost
 * lease back into the run by aborting the session runner.
 *
 * The `environmentKey` is the worker's standing credential. When a claimed
 * work item carries a per-item `secret` (a short-lived payload the poll
 * response may populate), the sessions token extracted from it is preferred
 * over the environment key for that item's heartbeat / force-stop /
 * skill-download / session calls; polling itself always uses the environment
 * key, and items without a usable secret fall back to it entirely.
 *
 * Use {@link EnvironmentWorker.handleItem} if you already hold a claimed work
 * item (e.g. a `worker poll --on-work` script handed one to a fresh process) and
 * just want the per-item flow without the poll loop — with no arguments it reads
 * the `ANTHROPIC_*` env vars that command sets.
 *
 * Construct it via `client.beta.environments.work.worker({ ... })` (or
 * `new EnvironmentWorker({ client, ... })` directly).
 *
 * @example
 * ```ts
 * // Long-running daemon: poll for work, serve each session, loop.
 * await client.beta.environments.work
 *   .worker({ environmentId, environmentKey, workdir: '/workspace' })
 *   .run(AbortSignal.timeout(60 * 60_000));
 *
 * // Already-claimed item (e.g. inside `ant worker poll --on-work ...`):
 * await client.beta.environments.work.worker({ workdir: '/workspace' }).handleItem();
 * ```
 */
export class EnvironmentWorker {
  readonly client: Anthropic;
  readonly environmentId: string | undefined;
  readonly environmentKey: string | undefined;
  readonly tools: EnvironmentWorkerTools | undefined;
  readonly workdir: string;
  /** @deprecated Never set; see {@link EnvironmentWorkerOptions.unrestrictedPaths}. */
  readonly unrestrictedPaths: boolean | undefined;
  readonly maxFileBytes: number | null | undefined;
  readonly maxIdleMs: number | undefined;
  readonly memorySyncIntervalMs: number | null | undefined;
  readonly memorySyncDeletions: MemoryDeleteMode;
  readonly workerId: string | undefined;
  readonly requestOptions: BetaToolRunnerRequestOptions | undefined;
  readonly #signal: AbortSignal | undefined;

  constructor(opts: Omit<EnvironmentWorkerOptions, 'unrestrictedPaths'>);
  /** @deprecated `unrestrictedPaths` is no longer accepted — see {@link EnvironmentWorkerOptions.unrestrictedPaths}. */
  constructor(opts: Omit<EnvironmentWorkerOptions, 'unrestrictedPaths'> & { unrestrictedPaths: boolean }); // help language servers see deprecation
  constructor(opts: EnvironmentWorkerOptions) {
    if (opts.unrestrictedPaths !== undefined) {
      throw new AnthropicError(
        'The `unrestrictedPaths` option you passed to EnvironmentWorker (or ' +
          'client.beta.environments.work.worker()) is no longer supported. ' +
          "The worker's file tools (read, write, edit, glob, grep) are now always confined to `workdir` " +
          "plus the session's memory folders. Remove `unrestrictedPaths` from your options; to let the " +
          'file tools reach any other directory, add it to `AgentToolContext.allowedRoots` from a ' +
          '`tools` factory.',
      );
    }
    this.client = opts.client;
    this.environmentId = opts.environmentId;
    this.environmentKey = opts.environmentKey;
    this.tools = opts.tools;
    this.workdir = opts.workdir ?? process.cwd();
    this.maxFileBytes = opts.maxFileBytes;
    this.maxIdleMs = opts.maxIdleMs;
    if (opts.memorySyncIntervalMs != null) {
      checkMemorySyncInterval(opts.memorySyncIntervalMs, 'memorySyncIntervalMs');
    }
    this.memorySyncIntervalMs = opts.memorySyncIntervalMs;
    this.memorySyncDeletions = opts.memorySyncDeletions ?? 'enabled';
    this.workerId = opts.workerId;
    this.requestOptions = opts.requestOptions;
    this.#signal = opts.signal;
  }

  /**
   * Poll the environment and service each claimed session until the supplied
   * signal (or the one passed to the constructor) aborts. Throws if
   * `environmentId` / `environmentKey` were not provided to the constructor.
   */
  async run(signal?: AbortSignal): Promise<void> {
    const { environmentId, environmentKey } = this;
    if (environmentId === undefined || environmentKey === undefined) {
      throw new AnthropicError(
        'EnvironmentWorker.run: environmentId and environmentKey are required to poll for work',
      );
    }
    const externalSignal = signal ?? this.#signal;
    const poller = new WorkPoller({
      client: this.client,
      environmentId,
      environmentKey,
      ...(this.workerId !== undefined ? { workerId: this.workerId } : {}),
      ...(externalSignal ? { signal: externalSignal } : {}),
      ...(this.requestOptions !== undefined ? { requestOptions: this.requestOptions } : {}),
      // The per-item handler stops or releases every work item on exit; let it
      // be the single owner of `work.stop` rather than double-posting from the
      // poller.
      autoStop: false,
    });

    for await (const work of poller) {
      try {
        await this.#handleItem(work, environmentKey, poller.signal);
      } catch (e) {
        // One bad item fails that item, not the worker: the handler's teardown
        // already stopped or released it, so the next poll claims the next
        // item. A store directory left behind by a killed worker would
        // otherwise crashloop this process forever.
        if (poller.signal?.aborted) throw e;
        loggerFor(this.client).error('work item failed', { work_id: work.id, error: String(e) });
      }
    }
  }

  /**
   * Service a single, already-claimed work item without the poll loop: build the
   * per-session {@link AgentToolContext} (workdir from this worker's options),
   * download the session agent's skills (`setupSkills`), run a
   * {@link SessionToolRunner} for the session while heartbeating the work-item
   * lease, and force-stop the work item on exit (whether the runner finishes
   * normally, throws, or the control plane signals shutdown). The one
   * exception is a lost lease: the item then belongs to the queue or another
   * worker and is left alone.
   *
   * Use this when something else does the claiming — e.g. a `worker poll
   * --on-work` script that hands an already-claimed item to a fresh process. The
   * work id / environment id / session id each fall back to `ANTHROPIC_WORK_ID` /
   * `ANTHROPIC_ENVIRONMENT_ID` / `ANTHROPIC_SESSION_ID` (the env vars that
   * command sets) when not passed; the environment key resolves from this
   * option, then the worker's own `environmentKey`, then
   * `ANTHROPIC_ENVIRONMENT_KEY`. With no arguments inside that command it just
   * works. Throws a clear error naming the first of the four required values
   * still missing after resolution. Throws `SessionMemoryError` when the
   * session has memory stores attached but they cannot be mounted — the work
   * item carried no sessions token (unless `memorySyncIntervalMs` turned
   * memory off), or a store failed to download.
   *
   * `workSecret` is the work item's per-item `secret` payload from the poll
   * response, falling back to `ANTHROPIC_WORK_SECRET`; unlike the others it is
   * optional — when present, the sessions token extracted from it is preferred
   * as the Bearer credential for this item's heartbeat / force-stop / session
   * calls; when absent (or undecodable) those calls use the environment key.
   */
  async handleItem(opts?: HandleItemOptions): Promise<void> {
    const workId = opts?.workId ?? readEnv('ANTHROPIC_WORK_ID');
    const environmentId = opts?.environmentId ?? readEnv('ANTHROPIC_ENVIRONMENT_ID');
    const sessionId = opts?.sessionId ?? readEnv('ANTHROPIC_SESSION_ID');
    const environmentKey =
      opts?.environmentKey ?? this.environmentKey ?? readEnv('ANTHROPIC_ENVIRONMENT_KEY');
    // `||` rather than `??` so an empty option still falls through to the env
    // var and then to null (matching how `readEnv` treats empty values).
    const workSecret = opts?.workSecret || readEnv('ANTHROPIC_WORK_SECRET') || null;

    if (!workId) {
      throw new AnthropicError('handleItem: workId is required — pass it or set ANTHROPIC_WORK_ID');
    }
    if (!environmentId) {
      throw new AnthropicError(
        'handleItem: environmentId is required — pass it or set ANTHROPIC_ENVIRONMENT_ID',
      );
    }
    if (!sessionId) {
      throw new AnthropicError('handleItem: sessionId is required — pass it or set ANTHROPIC_SESSION_ID');
    }
    if (!environmentKey) {
      throw new AnthropicError(
        'handleItem: environmentKey is required — pass it, construct the worker with it, or set ANTHROPIC_ENVIRONMENT_KEY',
      );
    }

    const work: ClaimedWork = {
      id: workId,
      environment_id: environmentId,
      secret: workSecret,
      data: { type: 'session', id: sessionId },
    };
    await this.#handleItem(work, environmentKey, opts?.signal ?? this.#signal);
  }

  /**
   * The per-item body shared by {@link EnvironmentWorker.run}'s poll loop and
   * {@link EnvironmentWorker.handleItem}: run a {@link SessionToolRunner} for the
   * work item's session while heartbeating its lease, force-stopping on exit
   * unless the lease was lost. Non-session work items are ignored.
   *
   * When the poll response carried a per-item `secret` (a short-lived payload
   * scoped to this work item), the sessions token extracted from it is
   * preferred over `environmentKey` as the Bearer credential for those
   * per-item calls; a missing/undecodable secret falls back to
   * `environmentKey` unchanged.
   */
  async #handleItem(
    work: ClaimedWork,
    environmentKey: string,
    externalSignal: AbortSignal | undefined,
  ): Promise<void> {
    const log = loggerFor(this.client);
    // The per-item credential: the sessions token carried inside the work
    // item's secret payload when the server issued one, otherwise the
    // environment key. Never log this value.
    const sessionsToken = sessionsTokenFromSecret(work.secret);
    if (work.secret && sessionsToken === null) {
      log.warn(
        'work item carried a secret payload but no sessions token could be extracted; ' +
          'falling back to the environment key',
        { work_id: work.id },
      );
    }
    const itemCredential = sessionsToken ?? environmentKey;
    // Every per-session call — the SessionToolRunner event stream/list/send, the
    // lease heartbeat, the skill download, and the work force-stop —
    // authenticates with the per-item credential. Scope a client to it once and
    // thread that through. `copyClientForHelper` also clears the parent's
    // `apiKey`, so the sub-client emits *only* the bearer credential on the
    // wire (a plain `withOptions({authToken})` would leave `X-Api-Key` set as
    // well).
    const sessionClient = copyClientForHelper(this.client, {
      authToken: itemCredential,
      helper: 'environments-worker',
    });

    // The poller runs with `autoStop: false`, so the per-item handler is the
    // single owner of `work.stop` for every claimed item.
    const sessionId = work.data.id;

    // A per-session controller: aborts when the supplied signal aborts, when the
    // session runner finishes, or when the lease heartbeat says to stop.
    const ctrl = new AbortController();
    const detachExternal = linkAbort(externalSignal, ctrl);
    const lease = new Lease(ctrl);

    // Lazily load the Node-only toolset module — see the import note at the top.
    const agentToolset = await import('../../tools/agent-toolset/node');

    // Start the lease heartbeat BEFORE the session fetch and the skill /
    // memory downloads: those can take longer than the lease TTL, and an
    // unheartbeated lease lapsing mid-download would let another worker
    // reclaim the item and serve the same session (split-brain).
    //
    // Each heartbeat reports the lease TTL the server is enforcing; it becomes
    // the runner's tool-result send retry window so a send keeps retrying
    // exactly as long as the lease could still be live. The runner is only
    // built after the downloads, so hold the latest TTL until then.
    let leaseTtlMs: number | undefined;
    let runner: SessionToolRunner | undefined;
    const heartbeatPromise = heartbeatLoop(sessionClient, work, lease, log, this.requestOptions, (ttlMs) => {
      leaseTtlMs = ttlMs;
      runner?._setSendRetryWindow(ttlMs);
    }).catch((e) => {
      if (!ctrl.signal.aborted) log.error('heartbeat loop failed', { work_id: work.id, error: String(e) });
      ctrl.abort();
    });

    let cleanupSkills: () => Promise<void> = async () => {};
    let stores: SessionMemoryStores | undefined;
    let cleanEnd = false;
    try {
      if (work.data.type !== 'session') {
        log.debug('skipping non-session work item', { work_id: work.id, type: work.data.type });
        return;
      }
      // One session fetch, shared by the skills download and the memory-store
      // download — two fetches could disagree about the attached resources.
      // A failed fetch fails the work item (the teardown below still stops
      // or releases it).
      const session: BetaManagedAgentsSession = await sessionClient.beta.sessions.retrieve(sessionId);
      // Only with the session in hand can we tell one that simply has no
      // memory from one whose memory we cannot mount. Turning memory off
      // with the interval knob is a deliberate opt-out and stays quiet.
      if (sessionsToken === null && this.memorySyncIntervalMs !== null && hasMemoryStore(session)) {
        throw new agentToolset.SessionMemoryError(
          `cannot mount the session's memories: the work item carried no sessions token ` +
            `(work_id=${work.id}, session_id=${sessionId}); ` +
            'the memory endpoints reject the environment key, so the poller must issue a per-item ' +
            '`secret` carrying `sessions_token`, or set `memorySyncIntervalMs: null` to run without memory',
        );
      }

      const ctx: AgentToolContext = {
        workdir: this.workdir,
        // The scoped sub-client, not the parent: the skill download
        // `setupSkills` performs for this session rides the same per-item
        // credential as every other per-item call.
        client: sessionClient,
        session,
        ...(this.maxFileBytes !== undefined ? { maxFileBytes: this.maxFileBytes } : {}),
      };
      try {
        cleanupSkills = await agentToolset.setupSkills(ctx);
      } catch (e) {
        log.warn('skill setup failed', { session_id: sessionId, work_id: work.id, error: String(e) });
      }

      // Memory stores: the memory_stores endpoints accept the per-item sessions
      // token but reject the environment key, so download and sync only run when
      // the item carried a usable secret (and the interval is set).
      // `sessionClient` is already scoped to that token then, so the memory
      // calls ride the same sub-client. A store that cannot be materialised
      // throws `SessionMemoryError` out of `download` and fails the item.
      if (sessionsToken !== null && this.memorySyncIntervalMs !== null) {
        stores = new agentToolset.SessionMemoryStores(sessionClient, {
          workdir: this.workdir,
          ...(this.memorySyncIntervalMs !== undefined ? { syncIntervalMs: this.memorySyncIntervalMs } : {}),
          syncDeletions: this.memorySyncDeletions,
        });
        await stores.download(session);
        // A store mounted outside the workdir must stay reachable by the file
        // tools; read-only stores still refuse writes.
        ctx.allowedRoots = stores.roots;
        ctx.readOnlyRoots = stores.readOnlyRoots;
      } else {
        log.debug('memory stores disabled for this item', { work_id: work.id });
      }

      const tools =
        typeof this.tools === 'function' ?
          this.tools(ctx)
        : this.tools ?? agentToolset.betaAgentToolset20260401(ctx);

      runner = new SessionToolRunner(sessionId, {
        client: sessionClient,
        tools,
        ...(this.maxIdleMs !== undefined ? { maxIdleMs: this.maxIdleMs } : {}),
        ...(this.requestOptions !== undefined ? { requestOptions: this.requestOptions } : {}),
        signal: ctrl.signal,
      });
      if (leaseTtlMs !== undefined) runner._setSendRetryWindow(leaseTtlMs);
      for await (const _ of runner) {
        // Drive the runner to completion; per-call observability is not part
        // of this composition's surface — use `SessionToolRunner` directly
        // (via `client.beta.sessions.events.toolRunner`) if you want it.
        if (stores) await stores.syncIfDue();
      }
      // Only a clean stream end earns the last full sync; it runs in the
      // teardown below.
      cleanEnd = !ctrl.signal.aborted;
    } finally {
      // The heartbeat keeps the lease alive until this teardown is done.
      try {
        // cleanupSkills first, so its failure cannot skip the memory flush.
        await cleanupSkills().catch((e) => {
          log.warn('skill cleanup failed', { session_id: sessionId, work_id: work.id, error: String(e) });
        });
      } finally {
        if (stores) {
          const boundMs = agentToolset.MEMORY_FLUSH_TIMEOUT_MS;
          if (cleanEnd) {
            const finishCutOff = await withTimeout(stores.finish(), boundMs);
            if (finishCutOff) {
              log.warn(
                `final memory sync cut off after ${boundMs}ms; the flush that follows still uploads changed files`,
                { session_id: sessionId, work_id: work.id },
              );
            }
          }
          // Also after finish(): it swallows its own failures, and a
          // clean flush is a no-op.
          const flushBound = new AbortController();
          const flushCutOff = await withTimeout(stores.flushWrites(flushBound.signal), boundMs);
          if (flushCutOff) {
            flushBound.abort();
            log.warn(
              `memory flush cut off after ${boundMs}ms; changed files it had not uploaded yet are not saved`,
              { session_id: sessionId, work_id: work.id },
            );
          }
          await stores.dispose().catch((e) => {
            log.warn('memory store cleanup failed', {
              session_id: sessionId,
              work_id: work.id,
              error: String(e),
            });
          });
        }
      }
      lease.finish('runner_done');
      detachExternal();
      await heartbeatPromise;
      // Stop only an item this worker still holds — after a lost lease it
      // belongs to the queue or another worker.
      if (lease.lost) {
        log.info('lease lost; released without stopping it', { session_id: sessionId, work_id: work.id });
      } else {
        await forceStop(sessionClient, work, log, this.requestOptions);
      }
    }
  }
}

/**
 * Resolve when `p` settles or `ms` elapses — `true` when `ms` elapsed
 * first. A timed-out `p` keeps running — JS cannot cancel a promise.
 */
async function withTimeout(p: Promise<void>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p.then(
        () => false,
        () => false,
      ),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(true), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Force-stop a claimed work item, swallowing the 409 that means it's already stopped. */
async function forceStop(
  client: Anthropic,
  work: Pick<BetaSelfHostedWork, 'id' | 'environment_id'>,
  log: Logger,
  requestOptions?: BetaToolRunnerRequestOptions,
): Promise<void> {
  try {
    await client.beta.environments.work.stop(
      work.id,
      { environment_id: work.environment_id, force: true },
      // Caller's headers pass through; the helper-tag header is on the scoped
      // sub-client's default_headers via copyClientForHelper, so no per-call
      // re-stamping needed.
      { ...requestOptions, headers: buildHeaders([requestOptions?.headers]) },
    );
  } catch (e) {
    if (!isStatus(e, 409)) {
      log.error('force-stop on exit failed', { work_id: work.id, error: String(e) });
    }
  }
}

/** Why heartbeating of a work item ended, as recorded on its {@link Lease}. */
type LeaseEndReason =
  | 'runner_done'
  | 'control_plane_stop'
  | 'lease_lost'
  | 'heartbeat_rejected'
  | 'assumed_lost';

/**
 * This worker's view of one work-item lease: the per-item abort signal plus
 * why heartbeating ended. The first recorded reason wins, so a run aborted
 * *because* the lease was lost still reads as lost afterwards; an abort with
 * no recorded reason (the external signal) is not lost.
 */
class Lease {
  readonly #ctrl: AbortController;
  #endReason: LeaseEndReason | undefined;

  constructor(ctrl: AbortController) {
    this.#ctrl = ctrl;
  }

  get signal(): AbortSignal {
    return this.#ctrl.signal;
  }

  finish(reason: LeaseEndReason): void {
    this.#endReason ??= reason;
    this.#ctrl.abort();
  }

  /** True once the item belongs to the queue or another worker. */
  get lost(): boolean {
    return this.#endReason === 'lease_lost' || this.#endReason === 'assumed_lost';
  }
}

/** The server's view of the lease carried by a 412 heartbeat response, or empty if absent. */
function serverLeaseState(e: unknown): Record<string, unknown> {
  let node: unknown = e instanceof APIError ? e.error : undefined;
  for (const key of ['error', 'details', 'current_state']) {
    if (!isObj(node)) return {};
    node = node[key];
  }
  return isObj(node) ? node : {};
}

/**
 * Keep the work-item lease alive while a session is being served. Runs until
 * `lease` ends, and ends it itself when the control plane reports the work is
 * `stopping`/`stopped` or no longer extends the lease, when a heartbeat is
 * rejected (a 412 means the lease already belongs to someone else), or when no
 * heartbeat has succeeded for longer than the lease ttl (the lease is assumed
 * lost, so two runners don't end up serving the same work). Each heartbeat
 * call is cut off after the current beat interval so a hung request cannot
 * outlive the lease it is meant to renew.
 */
async function heartbeatLoop(
  client: Anthropic,
  work: Pick<BetaSelfHostedWork, 'id' | 'environment_id'>,
  lease: Lease,
  logger: Logger,
  requestOptions?: BetaToolRunnerRequestOptions,
  /** Called with the server-reported lease TTL after every successful beat. */
  onLeaseTtl?: (ttlMs: number) => void,
): Promise<void> {
  let intervalMs = HEARTBEAT_DEFAULT_MS;
  let ttlMs = HEARTBEAT_TTL_DEFAULT_MS;
  let lastSuccessMs = Date.now();
  let last = NO_HEARTBEAT_SENTINEL;
  const beat = async (): Promise<void> => {
    // Not the request `timeout` option: the core client retries timeouts, so
    // it would not bound the call as a whole.
    const beatCtrl = new AbortController();
    const detach = linkAbort(lease.signal, beatCtrl);
    const cutoff = setTimeout(() => beatCtrl.abort(), intervalMs);
    try {
      const resp = await client.beta.environments.work.heartbeat(
        work.id,
        { environment_id: work.environment_id, expected_last_heartbeat: last },
        { ...requestOptions, headers: buildHeaders([requestOptions?.headers]), signal: beatCtrl.signal },
      );
      lastSuccessMs = Date.now();
      last = resp.last_heartbeat;
      if (resp.ttl_seconds > 0) {
        ttlMs = resp.ttl_seconds * 1000;
        intervalMs = Math.max(1_000, Math.min(ttlMs / 2, HEARTBEAT_DEFAULT_MS));
        onLeaseTtl?.(ttlMs);
      }
      if (resp.state === 'stopping' || resp.state === 'stopped') {
        logger.info('heartbeat signals shutdown', { work_id: work.id, state: resp.state });
        lease.finish('control_plane_stop');
      }
      if (!resp.lease_extended) {
        logger.warn('lease not extended, shutting down', { work_id: work.id });
        lease.finish('control_plane_stop');
      }
    } catch (e) {
      // An abort throws to unwind the caller (the `heartbeatLoop(...).catch`
      // in `#handleItem`) rather than returning early.
      lease.signal.throwIfAborted();
      if (isStatus(e, 412)) {
        const server = serverLeaseState(e);
        logger.error('lease lost: heartbeat precondition failed', {
          work_id: work.id,
          server_state: server['state'],
          server_ttl_seconds: server['ttl_seconds'],
          server_last_heartbeat: server['last_heartbeat'],
        });
        lease.finish('lease_lost');
        return;
      }
      if (isFatal4xx(e)) {
        logger.error('permanent heartbeat failure', { work_id: work.id, error: String(e) });
        lease.finish('heartbeat_rejected');
        throw e;
      }
      if (Date.now() - lastSuccessMs > ttlMs) {
        logger.error('lease assumed lost: no successful heartbeat in ttl', {
          work_id: work.id,
          ttl_ms: ttlMs,
          error: String(e),
        });
        lease.finish('assumed_lost');
        return;
      }
      logger.warn('transient heartbeat failure', { work_id: work.id, error: String(e) });
    } finally {
      clearTimeout(cutoff);
      detach();
    }
  };

  await beat();
  while (!lease.signal.aborted) {
    await sleep(intervalMs, lease.signal);
    lease.signal.throwIfAborted();
    await beat();
  }
}
