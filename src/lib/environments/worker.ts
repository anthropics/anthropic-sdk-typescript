import { AnthropicError } from '../../core/error';
import type { Anthropic } from '../../client';
import type { BetaSelfHostedWork } from '../../resources/beta/environments/work';
import { loggerFor, type Logger } from '../../internal/utils/log';
import { readEnv } from '../../internal/utils/env';
import { sleep } from '../../internal/utils/sleep';
import { isFatal4xx, isStatus } from '../../internal/utils/backoff';
import { linkAbort } from '../../internal/utils/abort';
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
import type { AgentToolContext } from '../../tools/agent-toolset/node';

const HEARTBEAT_DEFAULT_MS = 30_000;
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
   * The environment key — the single credential for the runner. It authenticates
   * the work-poll calls and every per-session call (event stream, lease
   * heartbeat, force-stop). Required by {@link EnvironmentWorker.run}; falls back
   * to `ANTHROPIC_ENVIRONMENT_KEY` in {@link EnvironmentWorker.handleItem}.
   */
  environmentKey?: string;
  /**
   * Tools to expose to each claimed session. Defaults to
   * `betaAgentToolset20260401(ctx)` (the standard `agent_toolset_20260401` set
   * bound to the per-session {@link AgentToolContext}).
   */
  tools?: EnvironmentWorkerTools;
  /** Base directory for the per-session {@link AgentToolContext}. Defaults to `process.cwd()`. */
  workdir?: string;
  /** Forwarded to the per-session {@link AgentToolContext}. */
  unrestrictedPaths?: boolean;
  /** Forwarded to the per-session {@link AgentToolContext} (`maxFileBytes`). */
  maxFileBytes?: number | null;
  /** Forwarded to {@link SessionToolRunner} (`maxIdleMs`). */
  maxIdleMs?: number;
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
  /** External abort signal; aborting it ends the run. Defaults to the constructor's signal. */
  signal?: AbortSignal;
}

/** The fields of {@link BetaSelfHostedWork} the per-item flow reads. */
type ClaimedWork = Pick<BetaSelfHostedWork, 'id' | 'environment_id' | 'data'>;

/**
 * The self-hosted environment runner, composed from the control-plane
 * {@link WorkPoller} and the per-session {@link SessionToolRunner}.
 *
 * For each claimed `session` work item it: builds the per-session
 * {@link AgentToolContext}, downloads the session agent's skills
 * (`setupSkills`), then runs a {@link SessionToolRunner} for the session
 * *while* heartbeating the work-item lease in parallel; on exit it force-stops
 * the work item, cleans up the downloaded skills, and loops to the next one. The
 * lease heartbeat reports `state === "stopping"` / a lost lease back into the run
 * by aborting the session runner.
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
  readonly unrestrictedPaths: boolean | undefined;
  readonly maxFileBytes: number | null | undefined;
  readonly maxIdleMs: number | undefined;
  readonly workerId: string | undefined;
  readonly requestOptions: BetaToolRunnerRequestOptions | undefined;
  readonly #signal: AbortSignal | undefined;

  constructor(opts: EnvironmentWorkerOptions) {
    this.client = opts.client;
    this.environmentId = opts.environmentId;
    this.environmentKey = opts.environmentKey;
    this.tools = opts.tools;
    this.workdir = opts.workdir ?? process.cwd();
    this.unrestrictedPaths = opts.unrestrictedPaths;
    this.maxFileBytes = opts.maxFileBytes;
    this.maxIdleMs = opts.maxIdleMs;
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
      // The per-item handler force-stops every work item on exit; let it be the
      // single owner of `work.stop` rather than double-posting from the poller.
      autoStop: false,
    });

    for await (const work of poller) {
      await this.#handleItem(work, environmentKey, poller.signal);
    }
  }

  /**
   * Service a single, already-claimed work item without the poll loop: build the
   * per-session {@link AgentToolContext} (workdir from this worker's options),
   * download the session agent's skills (`setupSkills`), run a
   * {@link SessionToolRunner} for the session while heartbeating the work-item
   * lease in parallel, and force-stop the work item on exit (whether the runner
   * finishes normally, throws, or the heartbeat loop signals shutdown).
   *
   * Use this when something else does the claiming — e.g. a `worker poll
   * --on-work` script that hands an already-claimed item to a fresh process. The
   * work id / environment id / session id each fall back to `ANTHROPIC_WORK_ID` /
   * `ANTHROPIC_ENVIRONMENT_ID` / `ANTHROPIC_SESSION_ID` (the env vars that
   * command sets) when not passed; the environment key resolves from this
   * option, then the worker's own `environmentKey`, then
   * `ANTHROPIC_ENVIRONMENT_KEY`. With no arguments inside that command it just
   * works. Throws a clear error naming the first of the four required values
   * still missing after resolution.
   */
  async handleItem(opts?: HandleItemOptions): Promise<void> {
    const workId = opts?.workId ?? readEnv('ANTHROPIC_WORK_ID');
    const environmentId = opts?.environmentId ?? readEnv('ANTHROPIC_ENVIRONMENT_ID');
    const sessionId = opts?.sessionId ?? readEnv('ANTHROPIC_SESSION_ID');
    const environmentKey =
      opts?.environmentKey ?? this.environmentKey ?? readEnv('ANTHROPIC_ENVIRONMENT_KEY');

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
      data: { type: 'session', id: sessionId },
    };
    await this.#handleItem(work, environmentKey, opts?.signal ?? this.#signal);
  }

  /**
   * The per-item body shared by {@link EnvironmentWorker.run}'s poll loop and
   * {@link EnvironmentWorker.handleItem}: run a {@link SessionToolRunner} for the
   * work item's session while heartbeating its lease, force-stopping on exit.
   * Non-session work items are ignored.
   */
  async #handleItem(
    work: ClaimedWork,
    environmentKey: string,
    externalSignal: AbortSignal | undefined,
  ): Promise<void> {
    const log = loggerFor(this.client);
    // Every per-session call — the SessionToolRunner event stream/list/send, the
    // lease heartbeat, and the work force-stop — authenticates with the
    // environment key. Scope a client to it once and thread that through.
    // `copyClientForHelper` also clears the parent's `apiKey`, so the sub-client
    // emits *only* the bearer credential on the wire (a plain
    // `withOptions({authToken})` would leave `X-Api-Key` set as well).
    const sessionClient = copyClientForHelper(this.client, {
      authToken: environmentKey,
      helper: 'environments-worker',
    });

    // The poller runs with `autoStop: false`, so the per-item handler is the
    // single owner of `work.stop` for every claimed item.
    const sessionId = work.data.id;

    const ctx: AgentToolContext = {
      workdir: this.workdir,
      client: this.client,
      sessionId,
      ...(this.unrestrictedPaths !== undefined ? { unrestrictedPaths: this.unrestrictedPaths } : {}),
      ...(this.maxFileBytes !== undefined ? { maxFileBytes: this.maxFileBytes } : {}),
    };
    // Lazily load the Node-only toolset module — see the import note at the top.
    const agentToolset = await import('../../tools/agent-toolset/node');
    let cleanupSkills: () => Promise<void> = async () => {};
    try {
      cleanupSkills = await agentToolset.setupSkills(ctx);
    } catch (e) {
      log.warn('skill setup failed', { session_id: sessionId, work_id: work.id, error: String(e) });
    }
    const tools =
      typeof this.tools === 'function' ?
        this.tools(ctx)
      : this.tools ?? agentToolset.betaAgentToolset20260401(ctx);

    // A per-session controller: aborts when the supplied signal aborts, when the
    // session runner finishes, or when the lease heartbeat says to stop.
    const ctrl = new AbortController();
    const detachExternal = linkAbort(externalSignal, ctrl);

    const heartbeatPromise = heartbeatLoop(sessionClient, work, ctrl, log, this.requestOptions).catch((e) => {
      if (!ctrl.signal.aborted) log.error('heartbeat loop failed', { work_id: work.id, error: String(e) });
      ctrl.abort();
    });

    try {
      const runner = new SessionToolRunner(sessionId, {
        client: sessionClient,
        tools,
        ...(this.maxIdleMs !== undefined ? { maxIdleMs: this.maxIdleMs } : {}),
        ...(this.requestOptions !== undefined ? { requestOptions: this.requestOptions } : {}),
        signal: ctrl.signal,
      });
      for await (const _ of runner) {
        // Drive the runner to completion; per-call observability is not part
        // of this composition's surface — use `SessionToolRunner` directly
        // (via `client.beta.sessions.events.toolRunner`) if you want it.
      }
    } finally {
      ctrl.abort();
      detachExternal();
      await heartbeatPromise;
      await cleanupSkills().catch((e) => {
        log.warn('skill cleanup failed', { session_id: sessionId, work_id: work.id, error: String(e) });
      });
      await forceStop(sessionClient, work, log, this.requestOptions);
    }
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

/**
 * Keep the work-item lease alive while a session is being served. Aborts `ctrl`
 * when the control plane reports the work is `stopping`/`stopped`, when the
 * lease is no longer extended, or on a permanent heartbeat failure.
 */
async function heartbeatLoop(
  client: Anthropic,
  work: Pick<BetaSelfHostedWork, 'id' | 'environment_id'>,
  ctrl: AbortController,
  logger: Logger,
  requestOptions?: BetaToolRunnerRequestOptions,
): Promise<void> {
  let intervalMs = HEARTBEAT_DEFAULT_MS;
  let last = NO_HEARTBEAT_SENTINEL;
  const beat = async (): Promise<void> => {
    try {
      const resp = await client.beta.environments.work.heartbeat(
        work.id,
        { environment_id: work.environment_id, expected_last_heartbeat: last },
        { ...requestOptions, headers: buildHeaders([requestOptions?.headers]), signal: ctrl.signal },
      );
      last = resp.last_heartbeat;
      if (resp.ttl_seconds > 0) {
        intervalMs = Math.max(1_000, Math.min((resp.ttl_seconds * 1000) / 2, HEARTBEAT_DEFAULT_MS));
      }
      if (resp.state === 'stopping' || resp.state === 'stopped') {
        logger.info('heartbeat signals shutdown', { work_id: work.id, state: resp.state });
        ctrl.abort();
      }
      if (!resp.lease_extended) {
        logger.warn('lease not extended, shutting down', { work_id: work.id });
        ctrl.abort();
      }
    } catch (e) {
      // An abort throws to unwind the caller (the `heartbeatLoop(...).catch`
      // in `#handleItem`) rather than returning early.
      ctrl.signal.throwIfAborted();
      if (isFatal4xx(e)) {
        logger.error('permanent heartbeat failure', { work_id: work.id, error: String(e) });
        ctrl.abort();
        throw e;
      }
      logger.warn('transient heartbeat failure', { work_id: work.id, error: String(e) });
    }
  };

  await beat();
  while (!ctrl.signal.aborted) {
    await sleep(intervalMs, ctrl.signal);
    ctrl.signal.throwIfAborted();
    await beat();
  }
}
