import { AnthropicError } from '../../core/error';
import type { Anthropic } from '../../client';
import type {
  BetaManagedAgentsAgentCustomToolUseEvent,
  BetaManagedAgentsAgentToolUseEvent,
  BetaManagedAgentsSessionEvent,
  BetaManagedAgentsStreamSessionEvents,
  BetaManagedAgentsUserCustomToolResultEventParams,
  BetaManagedAgentsUserToolResultEventParams,
} from '../../resources/beta/sessions/events';
import type { BetaToolResultContentBlockParam } from '../../resources/beta';
import { loggerFor, type Logger } from '../../internal/utils/log';
import { sleep } from '../../internal/utils/sleep';
import { isFatal4xx } from '../../internal/utils/backoff';
import { linkAbort } from '../../internal/utils/abort';
import { AsyncQueue } from '../../internal/utils/async-queue';
import { buildHeaders } from '../../internal/headers';
import type { RequestOptions } from '../../internal/request-options';
import { runRunnableTool, toolName, type BetaRunnableTool } from './BetaRunnableTool';
import type { BetaToolRunnerRequestOptions } from './BetaToolRunner';

/** Beta header for the managed-agents API. */
export const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01';

/** `x-stainless-helper` value identifying this helper in SDK telemetry. */
const HELPER_NAME = 'SessionToolRunner';

const STREAM_BACKOFF_START_MS = 500;
const STREAM_BACKOFF_CAP_MS = 10_000;
const TOOL_TIMEOUT_MS = 120_000;
const DRAIN_TIMEOUT_MS = 30_000;
const SEND_RETRIES = 3;

/** Block type accepted in a `user.tool_result` event's content — codegen'd, stays in sync with the API. */
type SessionContentBlock = NonNullable<BetaManagedAgentsUserToolResultEventParams['content']>[number];

/**
 * A tool-call event the runner dispatches against the local registry: either a
 * builtin `agent.tool_use` (answered with `user.tool_result`) or a custom
 * `agent.custom_tool_use` (answered with `user.custom_tool_result`). Server-side
 * `agent.mcp_tool_use` calls are intentionally excluded — the runner does not
 * handle them.
 */
type DispatchedToolUseEvent = BetaManagedAgentsAgentToolUseEvent | BetaManagedAgentsAgentCustomToolUseEvent;

/**
 * The result-event params paired with a {@link DispatchedToolUseEvent}: a
 * `user.tool_result` answers an `agent.tool_use`, a `user.custom_tool_result`
 * answers an `agent.custom_tool_use`. The two pairs must be matched exactly.
 */
type DispatchedToolResultParams =
  | BetaManagedAgentsUserToolResultEventParams
  | BetaManagedAgentsUserCustomToolResultEventParams;

export interface SessionToolRunnerOptions {
  client: Anthropic;
  /**
   * Tools to expose to the session, in the same {@link BetaRunnableTool} shape
   * `client.beta.messages.toolRunner` accepts. Use
   * `betaAgentToolset20260401({ workdir })` from
   * `@anthropic-ai/sdk/tools/agent-toolset/node` for the standard
   * `agent_toolset_20260401` set; filter or extend the array to customise.
   */
  tools: Array<BetaRunnableTool>;
  /**
   * Once the session goes idle with `stop_reason.type === "end_turn"`, the
   * runner keeps running for this many milliseconds before stopping; any new
   * event resets the countdown and it re-arms on the next `end_turn` idle.
   * Defaults to {@link DEFAULT_MAX_IDLE_MS} (60s). `0` (or negative) disables
   * it — the runner then only stops on session termination or the consumer
   * breaking out / aborting.
   */
  maxIdleMs?: number;
  /** External abort signal. Aborting it ends the iteration. */
  signal?: AbortSignal;
  /**
   * Extra per-request options merged into every call this runner issues
   * (event stream / list / send). Mirrors what `client.beta.messages.toolRunner`
   * accepts: custom `headers` (e.g. a proxy's auth/routing headers) reach the
   * poll/heartbeat/stop/stream/list/send calls. The runner always owns the abort
   * signal, so a `signal` here is ignored — pass {@link SessionToolRunnerOptions.signal}
   * to abort externally.
   */
  requestOptions?: BetaToolRunnerRequestOptions;
}

/** Default {@link SessionToolRunnerOptions.maxIdleMs}: 60 seconds. */
export const DEFAULT_MAX_IDLE_MS = 60_000;

/**
 * Outcome of a single tool execution dispatched by {@link SessionToolRunner}.
 *
 * Yielded after the tool ran (or failed) and after the result was posted back
 * to the session as a `user.tool_result` event. Consumers can read either the
 * embedded {@link DispatchedToolCall.event} / {@link DispatchedToolCall.result}
 * blocks or the flat top-level convenience fields.
 */
export interface DispatchedToolCall {
  /**
   * The `agent.tool_use` or `agent.custom_tool_use` event that triggered this
   * dispatch. Read `event.input` for the raw tool input and `event.name` for the
   * tool name; `event.type` distinguishes a builtin tool call from a custom one.
   */
  readonly event: DispatchedToolUseEvent;
  /**
   * The result event posted (or attempted) back to the session for this call: a
   * `user.tool_result` for an `agent.tool_use`, a `user.custom_tool_result` for
   * an `agent.custom_tool_use`. Read `result.content` for the tool's output
   * blocks and `result.is_error` for the error flag.
   *
   * `undefined` when no result event was ever built — i.e. the tool name is
   * not one this runner owns and, under the split-client behavior, it
   * deliberately posted nothing and left the id pending for its owner.
   */
  readonly result?: DispatchedToolResultParams;
  /**
   * Flat convenience for `event.id` — the id of the tool-use event this result
   * answers (echoed back as `tool_use_id` / `custom_tool_use_id` on the result).
   */
  readonly toolUseId: string;
  /** Flat convenience for `event.name` — the dispatched tool's name. */
  readonly name: string;
  /**
   * Flat convenience for `result.is_error` — `true` when the tool threw,
   * `false` on success and for a skipped unowned call.
   */
  readonly isError: boolean;
  /**
   * Whether a result event for this call reached the session. `false` when the
   * post itself failed (typically a permanent 4xx or send-retry exhaustion)
   * and also `false` — with no `result` event ever built — for a tool name
   * this runner does not own when it deliberately posts nothing and leaves the
   * id pending for its owner (the split-client behavior).
   */
  readonly posted: boolean;
}

/** Returns true if `ev` is a `session.status_idle` with `stop_reason` `end_turn`. */
function isEndTurnIdle(ev: { type?: string; stop_reason?: { type?: string } }): boolean {
  return ev.type === 'session.status_idle' && ev.stop_reason?.type === 'end_turn';
}

/**
 * The sessions-side counterpart to `client.beta.messages.toolRunner`: an
 * async-iterable that attaches to a managed-agents session, executes every
 * incoming `agent.tool_use` and `agent.custom_tool_use` event against a local
 * tool registry, posts the matching result back (`user.tool_result` for the
 * former, `user.custom_tool_result` for the latter), and yields one
 * {@link DispatchedToolCall} per completed call. Server-side `agent.mcp_tool_use`
 * calls are not dispatched. Internally drives event-stream reconnect and result
 * posting.
 *
 * Iteration ends when the session terminates (`session.status_terminated` /
 * `session.deleted`), when the consumer `break`s out of the loop or aborts the
 * supplied signal, or — once the session has gone idle with
 * `stop_reason.type === "end_turn"` — when `maxIdleMs` elapses with no new
 * event (any new event resets that countdown; it re-arms on the next `end_turn`
 * idle; `maxIdleMs <= 0` disables it). The `finally` branch drains any in-flight
 * tool calls and runs each tool's `close()` cleanup hook. It does *not* touch
 * the work-item lease — wrap it in an `EnvironmentWorker` if you need
 * heartbeating / force-stop.
 *
 * @example
 * ```ts
 * import { betaAgentToolset20260401 } from '@anthropic-ai/sdk/tools/agent-toolset/node';
 *
 * for await (const call of client.beta.sessions.events.toolRunner(work.data.id, {
 *   tools: [...betaAgentToolset20260401({ workdir }), myTool],
 * })) {
 *   console.log(`${call.name} -> ${call.isError ? 'error' : 'ok'}`);
 * }
 * ```
 */
export class SessionToolRunner implements AsyncIterable<DispatchedToolCall> {
  readonly client: Anthropic;
  readonly sessionId: string;
  readonly tools: ReadonlyArray<BetaRunnableTool>;
  readonly maxIdleMs: number;

  #consumed = false;
  readonly #controller: AbortController;
  readonly #detachExternal: () => void;
  readonly #requestOpts: BetaToolRunnerRequestOptions | undefined;
  readonly #toolByName: Map<string, BetaRunnableTool>;
  readonly #logger: Logger;
  readonly #seen = new Set<string>();
  readonly #answered = new Set<string>();
  readonly #results = new AsyncQueue<DispatchedToolCall>();
  #inFlightCount = 0;
  #onIdle: (() => void) | null = null;
  // When the session is idle past an `end_turn`, the pending stop timer; cleared
  // by any new event. Event-driven — there is no polling watchdog.
  #idleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(sessionId: string, opts: SessionToolRunnerOptions) {
    this.client = opts.client;
    this.sessionId = sessionId;
    this.tools = opts.tools;
    this.maxIdleMs = opts.maxIdleMs ?? DEFAULT_MAX_IDLE_MS;
    this.#logger = loggerFor(opts.client);
    this.#toolByName = new Map(opts.tools.map((t) => [toolName(t), t]));
    this.#controller = new AbortController();
    this.#detachExternal = linkAbort(opts.signal, this.#controller);
    this.#requestOpts = opts.requestOptions;
  }

  /** Read-only view of this runner's abort signal. */
  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  /** Abort the runner. Background tasks will wind down and `for await` will exit cleanly. */
  abort(): void {
    this.#controller.abort();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<DispatchedToolCall> {
    if (this.#consumed) {
      throw new AnthropicError('Cannot iterate over a consumed SessionToolRunner');
    }
    this.#consumed = true;
    this.#logger.info('session tool runner starting', {
      component: 'session-tool-runner',
      session_id: this.sessionId,
    });

    // The one background promise: drives the event stream and dispatches tools.
    // Its `.catch` aborts the controller so the main loop unwinds.
    const streamPromise = this.#streamLoop().catch((e) => {
      if (!this.#controller.signal.aborted) {
        this.#logger.error('stream loop failed', { error: String(e) });
      }
      this.#controller.abort();
    });

    try {
      // Phase 1: yield results as they arrive. `next(signal)` resolves
      // `done: true` when the controller aborts — cancellation is handled in
      // the queue read, no outer `Promise.race` needed.
      while (true) {
        const next = await this.#results.next(this.#controller.signal);
        if (next.done) break;
        yield next.value;
      }

      // Phase 2: let the stream loop settle (and push any final results), then
      // drain whatever is still queued before closing.
      await streamPromise;
      let pending: DispatchedToolCall | undefined;
      while ((pending = this.#results.tryShift()) !== undefined) {
        yield pending;
      }
    } finally {
      this.#controller.abort();
      this.#disarmIdleTimer();
      // Re-await defensively in case the consumer broke out of phase 1 before
      // phase 2 ran — a no-op if it already settled.
      await streamPromise;
      try {
        await this.#drain();
      } catch (e) {
        this.#logger.warn('drain failed', { error: String(e) });
      }
      this.#results.close();
      for (const t of this.tools) {
        try {
          // `close` is typed `() => Promisable<void>`, so a single `await`
          // covers both the sync and async return.
          await t.close?.();
        } catch (e) {
          this.#logger.warn('tool.close failed', { tool: toolName(t), error: String(e) });
        }
      }
      // Detach from the external signal so the consumer can drop their signal
      // reference without leaking this iterator instance.
      this.#detachExternal();
    }
  }

  // ===== request options =====

  /**
   * Request options for every helper-issued call: the caller's `requestOptions`
   * (custom proxy headers etc.) with the helper telemetry header stamped on and
   * the runner's own abort signal forced last so it always owns cancellation.
   */
  #requestOptions(): RequestOptions {
    return {
      ...this.#requestOpts,
      headers: buildHeaders([{ 'x-stainless-helper': HELPER_NAME }, this.#requestOpts?.headers]),
      signal: this.#controller.signal,
    };
  }

  // ===== event stream =====

  async #streamLoop(): Promise<void> {
    const ctrl = this.#controller;
    let backoff = STREAM_BACKOFF_START_MS;
    while (!ctrl.signal.aborted) {
      try {
        // Establish the event stream *before* reconciling history, so an event
        // emitted in the gap between listing and attaching is buffered on the
        // stream rather than lost. `seen`/`answered` dedup any event that shows
        // up both in the reconcile pass and on the live stream.
        const stream = await this.client.beta.sessions.events.stream(
          this.sessionId,
          {},
          this.#requestOptions(),
        );
        await this.#reconcile();
        for await (const ev of stream) {
          backoff = STREAM_BACKOFF_START_MS;
          if (await this.#handleStreamEvent(ev)) return;
        }
      } catch (e) {
        // An abort throws to unwind the caller (the iterator's `streamPromise`
        // `.catch`) rather than returning early and letting it carry on.
        ctrl.signal.throwIfAborted();
        if (isFatal4xx(e)) {
          this.#logger.error('permanent stream failure, shutting down', { error: String(e) });
          ctrl.abort();
          throw e;
        }
        this.#logger.warn('stream disconnected, reconnecting', {
          error: String(e),
          backoff_ms: backoff,
        });
      }
      ctrl.signal.throwIfAborted();
      await sleep(backoff, ctrl.signal);
      backoff = Math.min(backoff * 2, STREAM_BACKOFF_CAP_MS);
    }
  }

  /**
   * Read full history before dispatching so a `tool_use` whose result appears
   * later in the same history is not re-executed. Runs after the live stream is
   * already attached (see {@link SessionToolRunner.#streamLoop}).
   */
  async #reconcile(): Promise<void> {
    const ctrl = this.#controller;
    const pending: DispatchedToolUseEvent[] = [];
    let lastWasEndTurn = false;
    try {
      for await (const ev of this.client.beta.sessions.events.list(
        this.sessionId,
        { limit: 1000 },
        this.#requestOptions(),
      )) {
        this.#ingestHistory(ev, pending);
        lastWasEndTurn = isEndTurnIdle(ev);
      }
    } catch (e) {
      // An abort throws to unwind the caller; a real list failure is
      // non-fatal — undo the speculative `seen` entries and let `#streamLoop`
      // carry on with the live stream.
      ctrl.signal.throwIfAborted();
      this.#logger.warn('reconcile list failed', { error: String(e) });
      // If list itself failed, undo the speculative `seen` entries so the next
      // reconcile pass (or the live stream) can pick them up. Leave the idle
      // timer untouched — the history we read may be incomplete.
      for (const ev of pending) this.#seen.delete(ev.id);
      return;
    }
    const unanswered = pending.filter((ev) => !this.#answered.has(ev.id));
    // If the most recent event in history is an `end_turn` idle and there's no
    // outstanding tool work, the session is done — arm the idle timer so the
    // runner stops even if that `end_turn` arrived during a disconnect.
    if (lastWasEndTurn && unanswered.length === 0) this.#armIdleTimer();
    else this.#disarmIdleTimer();
    for (const ev of unanswered) await this.#execute(ev);
  }

  #ingestHistory(ev: BetaManagedAgentsSessionEvent, pending: DispatchedToolUseEvent[]): void {
    if (ev.type === 'agent.tool_use' || ev.type === 'agent.custom_tool_use') {
      // Mark the event seen so a replay on the live stream is not dispatched
      // twice, but decide whether it still needs executing from `answered`, not
      // `seen`: a call whose result post failed is seen-but-unanswered, and must
      // be retried on the next reconcile pass rather than silently dropped.
      this.#seen.add(ev.id);
      if (!this.#answered.has(ev.id)) pending.push(ev);
    } else if (ev.type === 'user.tool_result') {
      this.#answered.add(ev.tool_use_id);
    } else if (ev.type === 'user.custom_tool_result') {
      this.#answered.add(ev.custom_tool_use_id);
    }
  }

  /** Returns true when the runner should exit. */
  async #handleStreamEvent(ev: BetaManagedAgentsStreamSessionEvents): Promise<boolean> {
    // Arm/disarm the idle timer: an `end_turn` idle starts the grace countdown;
    // any other event cancels it.
    if (isEndTurnIdle(ev)) this.#armIdleTimer();
    else this.#disarmIdleTimer();
    switch (ev.type) {
      case 'agent.tool_use':
      case 'agent.custom_tool_use':
        if (!this.#seen.has(ev.id)) {
          this.#seen.add(ev.id);
          await this.#execute(ev);
        }
        return false;
      case 'user.tool_result':
        this.#answered.add(ev.tool_use_id);
        return false;
      case 'user.custom_tool_result':
        this.#answered.add(ev.custom_tool_use_id);
        return false;
      case 'session.status_terminated':
      case 'session.deleted':
        this.#logger.info('session terminated', {
          component: 'session-tool-runner',
          session_id: this.sessionId,
        });
        this.#controller.abort();
        return true;
      default:
        return false;
    }
  }

  // ===== idle timer =====

  /** (Re)start the grace countdown that stops the runner after `maxIdleMs` of idle. */
  #armIdleTimer(): void {
    this.#disarmIdleTimer();
    if (this.maxIdleMs <= 0) return;
    this.#idleTimer = setTimeout(() => {
      this.#logger.info('session idle after end_turn; stopping', {
        component: 'session-tool-runner',
        session_id: this.sessionId,
        max_idle_ms: this.maxIdleMs,
      });
      this.#controller.abort();
    }, this.maxIdleMs);
  }

  /** Cancel a pending idle countdown, if any. */
  #disarmIdleTimer(): void {
    if (this.#idleTimer !== undefined) {
      clearTimeout(this.#idleTimer);
      this.#idleTimer = undefined;
    }
  }

  // ===== tool execution =====

  async #execute(ev: DispatchedToolUseEvent): Promise<void> {
    if (this.#answered.has(ev.id)) return;
    this.#logger.info('executing tool', {
      component: 'session-tool-runner',
      session_id: this.sessionId,
      tool: ev.name,
      tool_use_id: ev.id,
    });
    this.#inFlightCount++;
    try {
      const tool = this.#toolByName.get(ev.name);
      if (!tool) {
        // Skip (split-client partial fulfilment): a name this runner
        // is not registered for belongs to the other client servicing this
        // session (typically the customer's app backend handling custom tools).
        // Post NO result, do not mark it answered, and leave the tool_use_id
        // pending for its owner — claiming it would corrupt the conversation.
        // Still yield the call so the consumer can observe the unowned
        // dispatch; nothing was sent, so `posted`/`isError` stay false and no
        // `result` event is populated. The id stays unanswered, so reconcile
        // keeps it out of the idle/end-turn accounting and re-surfaces it after
        // a reconnect until its owner answers it.
        this.#logger.info('tool not owned by this runner; leaving the tool_use_id pending for its owner', {
          component: 'session-tool-runner',
          session_id: this.sessionId,
          tool: ev.name,
          tool_use_id: ev.id,
        });
        this.#results.push({ event: ev, toolUseId: ev.id, name: ev.name, isError: false, posted: false });
        return;
      }
      let content: string | Array<BetaToolResultContentBlockParam>;
      let isError: boolean;
      // Per-tool controller: aborts on the runner's own signal *or* the
      // per-tool timeout, so an in-flight tool stops promptly when the runner
      // is aborted instead of running until the timeout.
      const toolCtrl = new AbortController();
      const detachTool = linkAbort(this.#controller.signal, toolCtrl);
      const timer = setTimeout(() => toolCtrl.abort(), TOOL_TIMEOUT_MS);
      try {
        // Pass the source `agent.tool_use` / `agent.custom_tool_use` event
        // straight through as the run context's `toolUse` — it is a union
        // member of `BetaToolUse`, no Messages-block adapter needed.
        const outcome = await runRunnableTool(tool, ev.input, {
          toolUse: ev,
          toolUseBlock: ev,
          signal: toolCtrl.signal,
        });
        content = outcome.content;
        isError = outcome.isError;
      } finally {
        clearTimeout(timer);
        detachTool();
      }
      // Answer with the result event that matches the call kind: a
      // `user.tool_result` for an `agent.tool_use`, a `user.custom_tool_result`
      // for an `agent.custom_tool_use`. Posting the wrong one leaves the call
      // unanswered and the session stuck.
      const result = buildResultEvent(ev, isError, toSessionContent(content));
      const posted = await this.#sendResult(result, ev.id);
      this.#results.push({
        event: ev,
        result,
        toolUseId: ev.id,
        name: ev.name,
        isError,
        posted,
      });
    } finally {
      this.#inFlightCount--;
      if (this.#inFlightCount === 0) this.#onIdle?.();
    }
  }

  async #sendResult(result: DispatchedToolResultParams, toolUseId: string): Promise<boolean> {
    const ctrl = this.#controller;
    let lastErr: unknown;
    for (let i = 0; i < SEND_RETRIES; i++) {
      // An abort throws to unwind the caller rather than returning a
      // `posted: false` result the iterator would carry on past.
      ctrl.signal.throwIfAborted();
      try {
        await this.client.beta.sessions.events.send(
          this.sessionId,
          { events: [result] },
          this.#requestOptions(),
        );
        this.#answered.add(toolUseId);
        return true;
      } catch (e) {
        lastErr = e;
        // Only short-circuit on a permanent 4xx; 408/409/429 deserve the
        // remaining retries (aligned with the core client's retry policy).
        if (isFatal4xx(e)) break;
        // Back off only *between* attempts — never after the final one, since
        // there is no further try left to wait for.
        if (i < SEND_RETRIES - 1) await sleep((i + 1) * 1000, ctrl.signal);
      }
    }
    this.#logger.error('failed to send tool result', {
      tool_use_id: toolUseId,
      error: String(lastErr),
    });
    return false;
  }

  /** Wait (bounded) for in-flight tool executions to finish during teardown. */
  async #drain(): Promise<void> {
    if (this.#inFlightCount === 0) return;
    await Promise.race([new Promise<void>((r) => (this.#onIdle = r)), sleep(DRAIN_TIMEOUT_MS)]);
    this.#onIdle = null;
    if (this.#inFlightCount > 0) {
      this.#logger.warn('drain timeout exceeded');
    }
  }
}

/**
 * Build the result event that answers `ev`: a `user.tool_result` for a builtin
 * `agent.tool_use`, a `user.custom_tool_result` for a custom
 * `agent.custom_tool_use`. The two `(use, result)` pairs are distinct API event
 * types and must be matched exactly — a `user.tool_result` does not answer a
 * custom tool call.
 */
function buildResultEvent(
  ev: DispatchedToolUseEvent,
  isError: boolean,
  content: SessionContentBlock[],
): DispatchedToolResultParams {
  if (ev.type === 'agent.custom_tool_use') {
    return { type: 'user.custom_tool_result', custom_tool_use_id: ev.id, is_error: isError, content };
  }
  return { type: 'user.tool_result', tool_use_id: ev.id, is_error: isError, content };
}

// The Messages-API tool-result block union is wider than the Sessions-API
// tool_result content union; pass through text/image/document and stringify
// anything else so a BetaRunnableTool authored for toolRunner still works here.
function toSessionContent(content: string | Array<BetaToolResultContentBlockParam>): SessionContentBlock[] {
  if (typeof content === 'string') return [{ type: 'text', text: content || '(no output)' }];
  const out = content.map((b): SessionContentBlock => {
    if (b.type === 'text') return { type: 'text', text: b.text || '(no output)' };
    if (b.type === 'image' || b.type === 'document') return b as SessionContentBlock;
    if (b.type === 'search_result') {
      // The Messages `search_result` block param maps field-for-field onto the
      // Sessions `BetaManagedAgentsSearchResultBlock`; map it explicitly rather
      // than letting it fall through to the JSON.stringify branch (which would
      // bury a structured result inside a text block). `citations` is required
      // on the Sessions side and optional on the Messages side — default the
      // flag to `false` when the producer left it unset.
      return {
        type: 'search_result',
        source: b.source,
        title: b.title,
        content: b.content.map((c) => ({ type: 'text', text: c.text })),
        citations: { enabled: b.citations?.enabled ?? false },
      };
    }
    return { type: 'text', text: JSON.stringify(b) };
  });
  return out.length > 0 ? out : [{ type: 'text', text: '(no output)' }];
}
