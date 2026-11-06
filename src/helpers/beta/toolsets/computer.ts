/**
 * The computer toolset interface: `BetaAbstractComputerToolset20260801`.
 */
import type {
  BetaComputerDoubleClickInput,
  BetaComputerHoldKeyInput,
  BetaComputerKeyInput,
  BetaComputerLeftClickDragInput,
  BetaComputerLeftClickInput,
  BetaComputerMiddleClickInput,
  BetaComputerMouseMoveInput,
  BetaComputerRightClickInput,
  BetaComputerScrollInput,
  BetaComputerToolset20260801,
  BetaComputerToolsetConfigs,
  BetaComputerTripleClickInput,
  BetaComputerTypeInput,
  BetaComputerWaitInput,
  BetaComputerZoomInput,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from '../../../resources/beta';
import type { BetaToolRunContext, Promisable } from '../../../lib/tools/BetaRunnableTool';
import {
  type BetaRunnableToolset,
  ToolsetClosedError,
  type BetaToolsetContent,
} from '../../../lib/tools/BetaRunnableToolset';
import { classify, throwIfAborted, runToolsetMember } from '../../../lib/internal/toolsets/run';
import { ToolError } from '../../../lib/tools/ToolError';
import {
  CallQueue,
  MemberCall,
  checkedError,
  confirmOrThrow,
  dispatchMember,
  isEnabled,
  resolveMember,
  resolveToolsetOptions,
  wireAsyncDispose,
  type ResolvedToolsetOptions,
} from '../../../lib/internal/toolsets/core';
import {
  COMPUTER_CONFIRM_REQUIRED,
  COMPUTER_FAMILY,
  COMPUTER_REGISTRY,
  COMPUTER_TOOLSET_TYPE,
  parseComputerInput,
  type BetaComputerCursorPositionInput,
  type BetaComputerLeftMouseDownInput,
  type BetaComputerLeftMouseUpInput,
  type BetaComputerMemberInput,
  type BetaComputerScreenshotInput,
  type ComputerMember,
  type BetaComputerMemberName,
  type BetaComputerMemberResult,
  type ComputerMemberResults,
  type ComputerTypedResult,
  typedComputerResult,
} from '../../../lib/internal/toolsets/computer-members';
import { ToolsetConfigError, UnavailableMemberError } from '../../../lib/internal/toolsets/errors';
import type {
  BetaComputerConfirmCallable,
  BetaComputerConfirmContext,
  BetaToolConfigs,
  BetaToolsetCallContext,
} from '../../../lib/internal/toolsets/hooks';
import { renderResult } from '../../../lib/internal/toolsets/render';
import {
  SDK_HELPER_SYMBOL,
  type StainlessHelperHeaderValue,
} from '../../../internal/stainless-helper-header';

type Ctx = BetaToolsetCallContext;
type Result<K extends BetaComputerMemberName> = Promisable<ComputerMemberResults[K]>;

type BetaRunnableComputerToolset = BetaRunnableToolset<BetaComputerToolset20260801>;

// Each optional field admits an explicit `undefined` (not only omission) so the options object
// type-checks under exactOptionalPropertyTypes, e.g. `{ configs: cond ? c : undefined }`.
export interface BetaComputerToolsetOptions {
  /**
   * The `configs` object of the `tools[]` entry. This is how a member is switched off (every member is on by
   * default).
   */
  configs?: BetaComputerToolsetConfigs | undefined;
  /**
   * Optional. `(ctx) => boolean | Promise<boolean>`, called before every member call the SDK is about to run (never
   * for a call already refused). Return true to run it, false to answer the model with a refusal; decide by
   * `ctx.member` and `ctx.input` which calls actually prompt a person.
   */
  confirm?: BetaComputerConfirmCallable | undefined;
  /**
   * Optional fields set on the `tools[]` entry itself rather than on a member: `{ cache_control: { type: 'ephemeral' } }`.
   * Naming `configs` here throws: the `configs` option sets it.
   */
  toolConfigs?: BetaToolConfigs | undefined;
}

type ResolvedComputerOptions = ResolvedToolsetOptions<
  BetaComputerToolsetConfigs,
  BetaComputerConfirmCallable
>;

/** One computer member call in flight. */
type ComputerCall = MemberCall<ComputerMember, BetaComputerMemberInput, ComputerTypedResult>;

/**
 * The computer toolset for `computer_toolset_20260801`.
 *
 * Subclass it and override the members your desktop supports. Each takes `(ctx, input)` and returns the result type
 * in its signature.
 *
 * A pure action (a click, a key, scrolling) returns nothing, or one line of text the model reads in a text block of
 * its own after the SDK's fixed acknowledgment.
 *
 * Coordinates arrive in screenshot pixels. Scaling to and from the display is the driver's.
 *
 * See the computer use tool documentation
 * (https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool) and read "Running a computer
 * toolset safely" in the SDK guide (`computer-toolset.md`) before deploying one.
 */
export abstract class BetaAbstractComputerToolset20260801 implements BetaRunnableComputerToolset {
  readonly type = COMPUTER_TOOLSET_TYPE;
  /** The API sets `tool_use.toolset_name` to this value on every call to this toolset. */
  readonly toolsetName = COMPUTER_FAMILY;
  // Assigned in the constructor. As an initialiser, it would compile to a statement that runs at import time.
  readonly [SDK_HELPER_SYMBOL]: StainlessHelperHeaderValue;
  /** Private, so spreading or serialising a toolset never copies the callbacks. */
  readonly #options: ResolvedComputerOptions;
  /** Every top-level call queues here: calls run one at a time, in arrival order. */
  readonly #queue = new CallQueue();
  /** Set by `close()`: a run that arrives afterwards throws `ToolsetClosedError`. */
  #closed = false;

  constructor(options: BetaComputerToolsetOptions = {}) {
    this[SDK_HELPER_SYMBOL] = 'computer-toolset';
    wireAsyncDispose(BetaAbstractComputerToolset20260801.prototype);
    const resolved = resolveToolsetOptions(
      COMPUTER_REGISTRY,
      this,
      BetaAbstractComputerToolset20260801.prototype,
      options,
    );
    const required = [...COMPUTER_CONFIRM_REQUIRED]
      .filter((n) => isEnabled(n, resolved.wireConfigs, COMPUTER_REGISTRY.defaultDisabled))
      .sort();
    if (required.length && resolved.confirm === undefined) {
      throw new ToolsetConfigError(
        `${JSON.stringify(
          required,
        )} requires a confirm callable: pass confirm: <callable>, or disable it in configs`,
      );
    }
    this.#options = resolved;
  }

  /**
   * The wire `configs`: the caller's, plus `enabled: false` for every member this class does not serve; `null` when
   * the entry carries none. Frozen and read-only (`toolset.configs = …` throws): it is what the dispatch gate reads
   * and what `toJSON()` copies.
   */
  get configs(): BetaComputerToolsetConfigs | null {
    return this.#options.wireConfigs ?? null;
  }

  /**
   * The tool runner and `toolResult` call this to run the member `toolUse.name` through the pipeline. It returns the
   * `tool_result` content, or throws a `ToolError` for a refusal or failure, with the blocks as they were thrown. It
   * is not an extension point. Override `execute` or a member method instead.
   */
  run(ctx: BetaToolRunContext, toolUse: BetaToolUseBlock): Promise<BetaToolsetContent> {
    if (this.#closed) throw new ToolsetClosedError(`this '${COMPUTER_FAMILY}' toolset is closed`);
    const call: ComputerCall = new MemberCall(ctx, toolUse.name, toolUse.input);
    return this.#queue.enqueue(ctx.signal, () => this.#run(call));
  }

  /**
   * Answer one member `tool_use` for a hand-written loop: runs it through the same pipeline as the
   * tool runner and returns the `tool_result` block, `toolset_name` and `is_error` set. It never
   * throws a `ToolError`; a `ToolsetUsageError` still propagates.
   */
  toolResult(toolUse: BetaToolUseBlock): Promise<BetaToolResultBlockParam> {
    return runToolsetMember(this, toolUse);
  }

  async #run(call: ComputerCall): Promise<BetaToolsetContent> {
    // A call aborted while it waited in the queue dispatches nothing and prompts nobody.
    throwIfAborted(call.ctx.signal);
    try {
      const member = resolveMember(COMPUTER_REGISTRY, this.#options, call.name);
      call.member = member;
      call.input = parseComputerInput(call.rawInput);
      await this.#confirm(call);
      throwIfAborted(call.ctx.signal);
      try {
        call.result = typedComputerResult(
          member.result,
          await this.execute(call.ctx, member.name, call.input),
        );
      } catch (error) {
        // The driver's own error text reaches the model, bounded to the field limit.
        call.error = await checkedError(classify(error, call.ctx));
      }
      // A run aborted while the member was in flight is not answered with a success block: the abort
      // propagates (the runner is unwinding), whatever the member managed to finish.
      throwIfAborted(call.ctx.signal);
    } catch (error) {
      if (!(error instanceof ToolError)) throw error;
      call.error = await checkedError(error);
    }
    if (call.error !== undefined) {
      // Thrown as raised, images included: `toolResult` and the runner keep only the text an is_error result may hold.
      const { content } = call.error;
      throw new ToolError(typeof content === 'string' ? [{ type: 'text', text: content }] : content);
    }
    return renderResult(call.member!, call.input, call.result!);
  }

  /**
   * The approval gate: every call about to run is shown to `confirm` first, inside the pipeline and on the
   * one-at-a-time queue, so no override of `execute` or of the member can skip it.
   */
  async #confirm(call: ComputerCall): Promise<void> {
    const confirm = this.#options.confirm;
    if (confirm === undefined) return;
    const ctx: BetaComputerConfirmContext = { ...call.ctx, member: call.member!.name, input: call.input! };
    await confirmOrThrow(confirm, ctx, call);
  }

  /**
   * The `tools[]` entry: your `toolConfigs` fields, the type, and the wire `configs`. A fresh deep copy each call, so
   * nothing you do to it changes the toolset; subclass state (a display connection, counters) never reaches the
   * request.
   */
  toJSON(): BetaComputerToolset20260801 {
    const { toolConfigs, wireConfigs } = this.#options;
    const entry: BetaComputerToolset20260801 = {
      ...toolConfigs,
      type: this.type,
      ...(wireConfigs != null ? { configs: wireConfigs } : {}),
    };
    return JSON.parse(JSON.stringify(entry));
  }

  /**
   * Release the desktop when you are done. The tool runner never calls it, so one instance can serve several runs.
   *
   * - A call that arrives afterwards throws `ToolsetClosedError`.
   * - It waits for calls already accepted.
   * - Inside a member, call `void this.close()`, since awaiting it there would wait on its own call.
   * - `await using` runs it where the engine supports that, but the class declares no `[Symbol.asyncDispose]`
   *   type, so TypeScript callers use `try` / `finally`.
   */
  async close(): Promise<void> {
    this.#closed = true;
    await this.#queue.drain();
  }

  /**
   * Dispatch one member call to its method.
   *
   * Override it for hooks around every member, and call `super.execute(ctx, name, input)` from the override.
   * `confirm` still runs first.
   *
   * A subclass that overrides it receives calls for every member. A member it does not implement throws
   * `UnavailableMemberError`, so use `configs` to turn off the ones it does not handle.
   */
  protected async execute(
    ctx: BetaToolsetCallContext,
    name: BetaComputerMemberName,
    input: BetaComputerMemberInput,
  ): Promise<BetaComputerMemberResult> {
    return (await dispatchMember(COMPUTER_REGISTRY, this, ctx, name, input)) as BetaComputerMemberResult;
  }

  /** Default body of every member: the model called a member this driver does not implement. */
  protected unavailable(
    name: BetaComputerMemberName,
    _ctx?: BetaToolsetCallContext,
    _input?: unknown,
  ): never {
    throw new UnavailableMemberError(name, COMPUTER_FAMILY);
  }

  protected key(ctx: Ctx, input: BetaComputerKeyInput): Result<'key'> {
    return this.unavailable('key', ctx, input);
  }
  protected hold_key(ctx: Ctx, input: BetaComputerHoldKeyInput): Result<'hold_key'> {
    return this.unavailable('hold_key', ctx, input);
  }
  /** The `type` member; named `type_` because `type` is the entry's wire field on this object. */
  protected type_(ctx: Ctx, input: BetaComputerTypeInput): Result<'type'> {
    return this.unavailable('type', ctx, input);
  }
  protected cursor_position(ctx: Ctx, input: BetaComputerCursorPositionInput): Result<'cursor_position'> {
    return this.unavailable('cursor_position', ctx, input);
  }
  protected mouse_move(ctx: Ctx, input: BetaComputerMouseMoveInput): Result<'mouse_move'> {
    return this.unavailable('mouse_move', ctx, input);
  }
  protected left_mouse_down(ctx: Ctx, input: BetaComputerLeftMouseDownInput): Result<'left_mouse_down'> {
    return this.unavailable('left_mouse_down', ctx, input);
  }
  protected left_mouse_up(ctx: Ctx, input: BetaComputerLeftMouseUpInput): Result<'left_mouse_up'> {
    return this.unavailable('left_mouse_up', ctx, input);
  }
  protected left_click(ctx: Ctx, input: BetaComputerLeftClickInput): Result<'left_click'> {
    return this.unavailable('left_click', ctx, input);
  }
  protected left_click_drag(ctx: Ctx, input: BetaComputerLeftClickDragInput): Result<'left_click_drag'> {
    return this.unavailable('left_click_drag', ctx, input);
  }
  protected right_click(ctx: Ctx, input: BetaComputerRightClickInput): Result<'right_click'> {
    return this.unavailable('right_click', ctx, input);
  }
  protected middle_click(ctx: Ctx, input: BetaComputerMiddleClickInput): Result<'middle_click'> {
    return this.unavailable('middle_click', ctx, input);
  }
  protected double_click(ctx: Ctx, input: BetaComputerDoubleClickInput): Result<'double_click'> {
    return this.unavailable('double_click', ctx, input);
  }
  protected triple_click(ctx: Ctx, input: BetaComputerTripleClickInput): Result<'triple_click'> {
    return this.unavailable('triple_click', ctx, input);
  }
  protected scroll(ctx: Ctx, input: BetaComputerScrollInput): Result<'scroll'> {
    return this.unavailable('scroll', ctx, input);
  }
  protected wait(ctx: Ctx, input: BetaComputerWaitInput): Result<'wait'> {
    return this.unavailable('wait', ctx, input);
  }
  protected screenshot(ctx: Ctx, input: BetaComputerScreenshotInput): Result<'screenshot'> {
    return this.unavailable('screenshot', ctx, input);
  }
  protected zoom(ctx: Ctx, input: BetaComputerZoomInput): Result<'zoom'> {
    return this.unavailable('zoom', ctx, input);
  }
}
