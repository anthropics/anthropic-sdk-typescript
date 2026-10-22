/**
 * The browser toolset interface: `BetaAbstractBrowserToolset20260801`.
 *
 * A driver subclasses it and overrides the members its backend supports. A member it does not override
 * is reported to the API as disabled and, if the model calls it anyway, answered with an `is_error`
 * result. `execute` is the dispatch layer: override it (calling `super.execute`) for before/after hooks
 * around every member. `run` is the SDK's pipeline around it.
 */
import type {
  BetaBrowserCloseTabInput,
  BetaBrowserDoubleClickInput,
  BetaBrowserFileUploadInput,
  BetaBrowserFindInput,
  BetaBrowserFormInputInput,
  BetaBrowserGetPageTextInput,
  BetaBrowserHoldKeyInput,
  BetaBrowserHoverInput,
  BetaBrowserJavascriptExecInput,
  BetaBrowserKeyInput,
  BetaBrowserLeftClickDragInput,
  BetaBrowserLeftClickInput,
  BetaBrowserLeftMouseDownInput,
  BetaBrowserLeftMouseUpInput,
  BetaBrowserListTabsInput,
  BetaBrowserMemberInput,
  BetaBrowserMiddleClickInput,
  BetaBrowserMouseMoveInput,
  BetaBrowserNavigateInput,
  BetaBrowserNewTabInput,
  BetaBrowserReadConsoleInput,
  BetaBrowserReadNetworkInput,
  BetaBrowserReadPageInput,
  BetaBrowserRightClickInput,
  BetaBrowserScreenshotInput,
  BetaBrowserScrollInput,
  BetaBrowserScrollToInput,
  BetaBrowserSwitchTabInput,
  BetaBrowserToolset20260801,
  BetaBrowserToolsetConfigs,
  BetaBrowserTripleClickInput,
  BetaBrowserTypeInput,
  BetaBrowserWaitInput,
  BetaBrowserZoomInput,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from '../../../resources/beta';
import type { BetaToolRunContext, Promisable } from '../../../lib/tools/BetaRunnableTool';
import type { BetaRunnableToolset, BetaToolsetContent } from '../../../lib/tools/BetaRunnableToolset';
import {
  classify,
  throwIfAborted,
  throwIfPropagates,
  runToolsetMember,
} from '../../../lib/internal/toolsets/run';
import { ToolError } from '../../../lib/tools/ToolError';
import {
  CallQueue,
  confirmOrThrow,
  dispatchMember,
  resolveMember,
  resolveToolsetOptions,
  wireAsyncDispose,
  type ResolvedToolsetOptions,
} from '../../../lib/internal/toolsets/core';
import {
  ToolsetClosedError,
  ToolsetConfigError,
  ToolsetContractError,
  UnavailableMemberError,
} from '../../../lib/internal/toolsets/errors';
import {
  CallRecord,
  PipelineState,
  boundedError,
  confirmContext,
  navigateRequestURL,
  parseInput,
  policyRefusal,
  reportOf,
  resolveUploadPaths,
  urlContext,
  withBoundedTabURLs,
} from '../../../lib/internal/toolsets/pipeline';
import { actionLine } from '../../../lib/internal/toolsets/render';
import type {
  BetaBrowserStateCallable,
  BetaConfirmCallable,
  BetaFilePolicy,
  BetaToolConfigs,
  BetaToolsetCallContext,
  BetaURLContext,
  BetaURLPolicy,
} from '../../../lib/internal/toolsets/hooks';
import type { BetaBrowserMemberName } from '../../../lib/internal/toolsets/inputs';
import {
  BROWSER_REGISTRY,
  CONFIRM_REQUIRED,
  FAMILY,
  TOOLSET_TYPE,
  memberEnabled,
  typedResult,
  type BrowserMemberResults,
} from '../../../lib/internal/toolsets/registry';
import type { BetaBrowserMemberResult, BetaBrowserState } from '../../../lib/internal/toolsets/results';
import {
  SDK_HELPER_SYMBOL,
  type StainlessHelperHeaderValue,
} from '../../../internal/stainless-helper-header';
import { oneLine } from '../../../lib/internal/toolsets/sanitize';

type Ctx = BetaToolsetCallContext;
type Result<K extends BetaBrowserMemberName> = Promisable<BrowserMemberResults[K]>;

type BetaRunnableBrowserToolset = BetaRunnableToolset<BetaBrowserToolset20260801>;

// Each optional field admits an explicit `undefined` (not only omission) so the options object
// type-checks under exactOptionalPropertyTypes, e.g. `{ configs: cond ? c : undefined }`.
export interface BetaBrowserToolsetOptions {
  /**
   * The `configs` object of the `tools[]` entry, sent as given: `{ <member>: { enabled, defer_loading } }`. This is
   * how a member is switched on or off. The SDK adds `enabled: false` for every member the subclass does not
   * implement and never dispatches a disabled member. A subclass that overrides `execute` serves every member, so
   * turn off the ones it does not serve here.
   */
  configs?: BetaBrowserToolsetConfigs | undefined;
  /**
   * Optional. `(ctx) => boolean | Promise<boolean>`, called before every member call the SDK is about to run (after
   * the URL policy and the file policy, never for a call already refused). Return true to run it, false to answer the
   * model with a refusal. Decide by `ctx.member` which members prompt a person. `ctx` also contains the member's
   * `input` and the target tab's `tabURL` / `tabId` as of the last `browserState` report the SDK collected.
   * Required when `javascript_exec` or `file_upload` is enabled.
   */
  confirm?: BetaConfirmCallable | undefined;
  /**
   * Required. `(ctx) => BetaBrowserState | Promise<BetaBrowserState>`: the open tabs (one marked active) and the state changes
   * since the previous call. The SDK calls it once after every call it answers, refused or failed ones too, and
   * attaches the result to the tool result as the `browser_state` block. A driver passes its own reporting method
   * and types the options it accepts from its callers as `Omit<BetaBrowserToolsetOptions, 'browserState'>`.
   */
  browserState: BetaBrowserStateCallable;
  /**
   * Optional. `(context, url) => void`, throwing `ToolError` to refuse. Called once for each `navigate` that has a
   * URL, with the URL exactly as the model wrote it, before the driver receives it. `back`, `forward` and `reload` are
   * not checked. Left unset, `navigate` is not checked. This is a hook for your own policy, not a security boundary:
   * it does not see redirects, sub-resources or addresses a page reaches on its own. Request interception in the
   * driver and egress rules around the browser cover those.
   */
  urlPolicy?: BetaURLPolicy | undefined;
  /**
   * Optional `BetaFilePolicy` (the shipped `BetaNodeFilePolicy`, or your own): which local paths and Files API document ids
   * `file_upload` may use, and whether a download's local path is shown to the model. Without one, an upload naming a
   * path or document id is refused and download paths stay hidden.
   */
  filePolicy?: BetaFilePolicy | undefined;
  /**
   * Optional fields set on the `tools[]` entry itself rather than on a member: `{ cache_control: { type: 'ephemeral' } }`.
   * Naming `configs` here throws: the `configs` option sets it.
   */
  toolConfigs?: BetaToolConfigs | undefined;
}

/** The constructor options, validated and resolved once at construction. @internal */
interface ResolvedBrowserOptions
  extends ResolvedToolsetOptions<BetaBrowserToolsetConfigs, BetaConfirmCallable> {
  browserState: BetaBrowserStateCallable;

  /** The caller's `urlPolicy`, or undefined when `navigate` is not checked. */
  urlPolicy: BetaURLPolicy | undefined;

  filePolicy: BetaFilePolicy | undefined;
}

function resolveOptions(
  instance: object,
  base: object,
  options: BetaBrowserToolsetOptions,
): ResolvedBrowserOptions {
  const shared = resolveToolsetOptions(BROWSER_REGISTRY, instance, base, options);
  const { served, wireConfigs: wire, confirm } = shared;

  const urlPolicy = options.urlPolicy;

  const required = [...CONFIRM_REQUIRED].filter((n) => served.has(n) && memberEnabled(n, wire)).sort();
  if (required.length && confirm === undefined) {
    throw new ToolsetConfigError(
      `${JSON.stringify(
        required,
      )} requires a confirm callable: pass confirm: <callable>, or disable it in configs`,
    );
  }
  return { ...shared, browserState: options.browserState, urlPolicy, filePolicy: options.filePolicy };
}

/**
 * The browser toolset for `browser_toolset_20260801`.
 *
 * Subclass it and override the members your backend supports. Each takes `(ctx, input)` and returns
 * the result type in its signature. A pure action (a click, typing, scrolling) returns nothing, or a string the
 * model reads in a text block of its own after the SDK's fixed acknowledgment (such as `Clicked.`), folded to one
 * line. See the browser use tool documentation
 * (https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) and read "Running a
 * browser toolset safely" in the SDK guide (`browser-toolset.md`) before deploying one.
 */
export abstract class BetaAbstractBrowserToolset20260801 implements BetaRunnableBrowserToolset {
  readonly type = TOOLSET_TYPE;
  /** The family this toolset answers for: matched against `tool_use.toolset_name`. */
  readonly toolsetName = FAMILY;
  // Assigned in the constructor. As an initialiser, it would compile to a statement that runs at import time.
  readonly [SDK_HELPER_SYMBOL]: StainlessHelperHeaderValue;
  /** Private, so spreading or serialising a toolset never copies the policies or the callbacks. */
  readonly #options: ResolvedBrowserOptions;
  readonly #pipeline = new PipelineState();
  /** Every top-level call queues here: calls run one at a time, in arrival order. */
  readonly #queue = new CallQueue();
  /** Set by `close()`: a run that arrives afterwards throws `ToolsetClosedError`. */
  #closed = false;

  constructor(options: BetaBrowserToolsetOptions) {
    this[SDK_HELPER_SYMBOL] = 'browser-toolset';
    wireAsyncDispose(BetaAbstractBrowserToolset20260801.prototype);
    this.#options = resolveOptions(this, BetaAbstractBrowserToolset20260801.prototype, options);
  }

  /**
   * The wire `configs`: the caller's, plus `enabled: false` for every member this class does not serve. `null` when
   * the entry has none. Frozen and read-only (`toolset.configs = …` throws): it is what the dispatch gate reads and
   * what `toJSON()` copies.
   */
  get configs(): BetaBrowserToolsetConfigs | null {
    return this.#options.wireConfigs ?? null;
  }

  /**
   * The tool runner's entry point (and `toolResult`'s): run the member `toolUse.name` through the pipeline and
   * return its `tool_result` content. A refusal or failure is thrown as a `ToolError` holding the content. Calls
   * on one toolset run one at a time, in arrival order, whatever their context. Not an extension point (override
   * `execute` or a member method), and not for use from inside a member, where it would wait behind the call that
   * is waiting for it: a member that composes others calls their methods directly.
   */
  run(ctx: BetaToolRunContext, toolUse: BetaToolUseBlock): Promise<BetaToolsetContent> {
    if (this.#closed) throw new ToolsetClosedError(`this '${FAMILY}' toolset is closed`);
    const record = new CallRecord(ctx, toolUse.name, toolUse.input);
    return this.#queue.enqueue(ctx.signal, () => this.#run(record));
  }

  /**
   * Answer one member `tool_use` for a hand-written loop: runs it through the same pipeline as the
   * tool runner and returns the `tool_result` block, `toolset_name` and `is_error` set. It never
   * throws a `ToolError`, but a `ToolsetUsageError` still propagates.
   */
  toolResult(toolUse: BetaToolUseBlock): Promise<BetaToolResultBlockParam> {
    return runToolsetMember(this, toolUse);
  }

  async #run(record: CallRecord): Promise<BetaToolsetContent> {
    // A call aborted while it waited in the queue dispatches nothing and prompts nobody.
    throwIfAborted(record.ctx.signal);

    const options = this.#options;

    try {
      const member = resolveMember(BROWSER_REGISTRY, options, record.name);
      record.member = member;
      record.input = parseInput(record.rawInput);
      const url = navigateRequestURL(record);
      if (url !== undefined) await this.#applyPolicy(url, urlContext(record));
      await resolveUploadPaths(record, options.filePolicy);
      await this.#confirm(record);
      throwIfAborted(record.ctx.signal);

      try {
        record.result = typedResult(member.result, await this.execute(record.ctx, member.name, record.input));
      } catch (error) {
        // The driver's own error text reaches the model, cut to the field limit.
        record.error = boundedError(classify(error, record.ctx));
      }

      // A run aborted while the member was in flight is not answered with a success block: the abort
      // propagates (the runner is unwinding), whatever the member managed to finish.
      throwIfAborted(record.ctx.signal);

      const line = actionLine(member, record.result);
      // The line a pure action returned is page-shaped: folded to one line and cut.
      if (line !== undefined) record.result = { kind: 'none', value: oneLine(line) };
    } catch (error) {
      if (!(error instanceof ToolError)) throw error;
      throwIfAborted(record.ctx.signal); // a refusal out of a hook once the run is cancelled is the cancellation
      record.error = boundedError(error);
    }

    const state = await this.#browserState(record.ctx);
    const { content, isError } = await this.#pipeline.finish(record, reportOf(state), options.filePolicy);
    if (isError) throw new ToolError(content);
    return content;
  }

  async #browserState(ctx: BetaToolsetCallContext): Promise<BetaBrowserState> {
    try {
      return withBoundedTabURLs(await this.#options.browserState(ctx));
    } catch (error) {
      throwIfPropagates(error, ctx);
      // The tab inventory is the SDK's only view of the browser, and without it nothing can be answered.
      throw new ToolsetContractError(
        `browserState threw ${String(
          error,
        )} or returned no BetaBrowserState; return one, and catch failures inside browserState`,
        { cause: error }, // the driver's own error and stack
      );
    }
  }

  /**
   * The approval gate: every call about to run is shown to `confirm` first, inside the pipeline and within the
   * call's turn in the queue, so no override of `execute` or of the member can skip it. A `ToolError` it throws is
   * relayed as-is. Any other exception means the prompt failed, and refuses the call rather than ending the run.
   * Anything but `true` declines the call.
   */
  async #confirm(record: CallRecord): Promise<void> {
    const confirm = this.#options.confirm;
    if (confirm === undefined) return;
    await confirmOrThrow(confirm, confirmContext(record, this.#pipeline), record);
  }

  /** Run the `urlPolicy` callable on one address. Throws the refusal the model reads when it does not pass. */
  async #applyPolicy(url: string, ctx: BetaURLContext): Promise<void> {
    const policy = this.#options.urlPolicy;
    if (policy === undefined) return;

    let returned: unknown;
    try {
      returned = await policy(ctx, url);
    } catch (error) {
      throw policyRefusal(error);
    }

    if (returned !== undefined) {
      // "return nothing to allow, throw to refuse": a policy mistakenly written as a predicate
      // returns false to block, and reading that as a pass would fail open silently.
      throw new ToolsetContractError(
        `urlPolicy must return nothing to allow or throw a ToolError to refuse; got ${
          returned === null ? 'null' : typeof returned
        }`,
      );
    }
  }

  /**
   * The `tools[]` entry: your `toolConfigs` fields, the type, and the wire `configs`. A fresh deep copy each call, so
   * nothing you do to it changes the toolset. Subclass state (a driver, counters) never reaches the request.
   */
  toJSON(): BetaBrowserToolset20260801 {
    const { toolConfigs, wireConfigs } = this.#options;
    const entry: BetaBrowserToolset20260801 = {
      ...toolConfigs,
      type: this.type,
      ...(wireConfigs != null ? { configs: wireConfigs } : {}),
    };
    return JSON.parse(JSON.stringify(entry));
  }

  /**
   * Release the browser when you are done. The tool runner never calls it, so one instance can serve several runs.
   * Marks the toolset closed at once (a member run that arrives afterwards throws `ToolsetClosedError`) and then
   * waits for the calls already accepted, queued or in flight, to settle, so an override that
   * awaits `super.close()` first tears the browser down with nothing still using it. From inside a member, call it
   * without awaiting (`void this.close()`): the browser is released as soon as that member returns, whereas awaiting
   * it there would wait on the member's own call. Also what `await using` runs: wired to `Symbol.asyncDispose` at
   * runtime where the engine provides it. There is no typed `[Symbol.asyncDispose]` member, so from TypeScript use
   * `try` / `finally` with `close()`.
   */
  async close(): Promise<void> {
    this.#closed = true;
    await this.#queue.drain();
  }

  /**
   * Dispatch one member call to its method.
   *
   * Override it, calling `super.execute(ctx, name, input)`, for before/after hooks around every member
   * (telemetry, logging, rewriting the input or the typed result). The pipeline still wraps the
   * override, so the URL policy, the file policy and `confirm` run before it. It is
   * also the only method a subclass that forwards every member elsewhere (a remote
   * browser, a recording proxy) implements. A subclass that overrides it serves every member: one it
   * implements runs through `super.execute`, one it does not throws `UnavailableMemberError` from its default
   * body there, and `configs` is how it turns off the members it does not serve. A call the SDK refused
   * before dispatch never reaches it.
   */
  protected async execute(
    ctx: BetaToolsetCallContext,
    name: BetaBrowserMemberName,
    input: BetaBrowserMemberInput,
  ): Promise<BetaBrowserMemberResult> {
    return (await dispatchMember(BROWSER_REGISTRY, this, ctx, name, input)) as BetaBrowserMemberResult;
  }

  protected navigate(ctx: Ctx, input: BetaBrowserNavigateInput): Result<'navigate'> {
    throw new UnavailableMemberError('navigate', FAMILY);
  }
  protected screenshot(ctx: Ctx, input: BetaBrowserScreenshotInput): Result<'screenshot'> {
    throw new UnavailableMemberError('screenshot', FAMILY);
  }
  protected zoom(ctx: Ctx, input: BetaBrowserZoomInput): Result<'zoom'> {
    throw new UnavailableMemberError('zoom', FAMILY);
  }
  protected left_click(ctx: Ctx, input: BetaBrowserLeftClickInput): Result<'left_click'> {
    throw new UnavailableMemberError('left_click', FAMILY);
  }
  protected right_click(ctx: Ctx, input: BetaBrowserRightClickInput): Result<'right_click'> {
    throw new UnavailableMemberError('right_click', FAMILY);
  }
  protected middle_click(ctx: Ctx, input: BetaBrowserMiddleClickInput): Result<'middle_click'> {
    throw new UnavailableMemberError('middle_click', FAMILY);
  }
  protected double_click(ctx: Ctx, input: BetaBrowserDoubleClickInput): Result<'double_click'> {
    throw new UnavailableMemberError('double_click', FAMILY);
  }
  protected triple_click(ctx: Ctx, input: BetaBrowserTripleClickInput): Result<'triple_click'> {
    throw new UnavailableMemberError('triple_click', FAMILY);
  }
  protected hover(ctx: Ctx, input: BetaBrowserHoverInput): Result<'hover'> {
    throw new UnavailableMemberError('hover', FAMILY);
  }
  protected left_click_drag(ctx: Ctx, input: BetaBrowserLeftClickDragInput): Result<'left_click_drag'> {
    throw new UnavailableMemberError('left_click_drag', FAMILY);
  }
  protected left_mouse_down(ctx: Ctx, input: BetaBrowserLeftMouseDownInput): Result<'left_mouse_down'> {
    throw new UnavailableMemberError('left_mouse_down', FAMILY);
  }
  protected left_mouse_up(ctx: Ctx, input: BetaBrowserLeftMouseUpInput): Result<'left_mouse_up'> {
    throw new UnavailableMemberError('left_mouse_up', FAMILY);
  }
  protected mouse_move(ctx: Ctx, input: BetaBrowserMouseMoveInput): Result<'mouse_move'> {
    throw new UnavailableMemberError('mouse_move', FAMILY);
  }
  protected scroll(ctx: Ctx, input: BetaBrowserScrollInput): Result<'scroll'> {
    throw new UnavailableMemberError('scroll', FAMILY);
  }
  protected scroll_to(ctx: Ctx, input: BetaBrowserScrollToInput): Result<'scroll_to'> {
    throw new UnavailableMemberError('scroll_to', FAMILY);
  }
  /** The `type` member, named `type_` because `type` is the entry's wire field on this object. */
  protected type_(ctx: Ctx, input: BetaBrowserTypeInput): Result<'type'> {
    throw new UnavailableMemberError('type', FAMILY);
  }
  protected key(ctx: Ctx, input: BetaBrowserKeyInput): Result<'key'> {
    throw new UnavailableMemberError('key', FAMILY);
  }
  protected hold_key(ctx: Ctx, input: BetaBrowserHoldKeyInput): Result<'hold_key'> {
    throw new UnavailableMemberError('hold_key', FAMILY);
  }
  protected form_input(ctx: Ctx, input: BetaBrowserFormInputInput): Result<'form_input'> {
    throw new UnavailableMemberError('form_input', FAMILY);
  }
  protected read_page(ctx: Ctx, input: BetaBrowserReadPageInput): Result<'read_page'> {
    throw new UnavailableMemberError('read_page', FAMILY);
  }
  protected find(ctx: Ctx, input: BetaBrowserFindInput): Result<'find'> {
    throw new UnavailableMemberError('find', FAMILY);
  }
  protected get_page_text(ctx: Ctx, input: BetaBrowserGetPageTextInput): Result<'get_page_text'> {
    throw new UnavailableMemberError('get_page_text', FAMILY);
  }
  protected wait(ctx: Ctx, input: BetaBrowserWaitInput): Result<'wait'> {
    throw new UnavailableMemberError('wait', FAMILY);
  }
  /**
   * Default-disabled. Enabling it in `configs` lets a page read files on the machine running the
   * browser: pass a `filePolicy` confined to one dedicated upload directory. `input.paths` arrive
   * already resolved by it.
   */
  protected file_upload(ctx: Ctx, input: BetaBrowserFileUploadInput): Result<'file_upload'> {
    throw new UnavailableMemberError('file_upload', FAMILY);
  }
  protected read_console(ctx: Ctx, input: BetaBrowserReadConsoleInput): Result<'read_console'> {
    throw new UnavailableMemberError('read_console', FAMILY);
  }
  protected read_network(ctx: Ctx, input: BetaBrowserReadNetworkInput): Result<'read_network'> {
    throw new UnavailableMemberError('read_network', FAMILY);
  }
  /**
   * Default-disabled. Page content can steer what the model asks to run, so enabling it takes a `confirm`
   * callable, which receives every call first. The script runs with the page's own authority (its cookies, storage
   * and signed-in sessions), so the browser profile you drive must not be signed into accounts whose data or actions
   * you would not hand the model.
   */
  protected javascript_exec(ctx: Ctx, input: BetaBrowserJavascriptExecInput): Result<'javascript_exec'> {
    throw new UnavailableMemberError('javascript_exec', FAMILY);
  }
  protected new_tab(ctx: Ctx, input: BetaBrowserNewTabInput): Result<'new_tab'> {
    throw new UnavailableMemberError('new_tab', FAMILY);
  }
  protected list_tabs(ctx: Ctx, input: BetaBrowserListTabsInput): Result<'list_tabs'> {
    throw new UnavailableMemberError('list_tabs', FAMILY);
  }
  protected switch_tab(ctx: Ctx, input: BetaBrowserSwitchTabInput): Result<'switch_tab'> {
    throw new UnavailableMemberError('switch_tab', FAMILY);
  }
  protected close_tab(ctx: Ctx, input: BetaBrowserCloseTabInput): Result<'close_tab'> {
    throw new UnavailableMemberError('close_tab', FAMILY);
  }
}
