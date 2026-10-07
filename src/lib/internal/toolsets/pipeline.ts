/**
 * The stages of a member call that are plain computation: the input check, error classification,
 * rendering the outcome with the browser state. `run` on the toolset class fixes the order and does the
 * awaiting.
 *
 * @internal
 */
import type {
  BetaBrowserFileUploadInput,
  BetaBrowserMemberInput,
  BetaBrowserNavigateInput,
  BetaBrowserStateChange,
  BetaBrowserStateTabEntry,
  BetaTextBlockParam,
} from '../../../resources/beta';
import type { BetaToolsetContent } from '../../tools/BetaRunnableToolset';
import { ToolError } from '../../tools/ToolError';
import { MemberCall, errorContent } from './core';
import {
  InvalidMemberInputError,
  NO_UPLOAD_ROOTS,
  ToolsetUsageError,
  URLRefusedError,
  UploadRefusedError,
} from './errors';
import type { BetaConfirmContext, BetaFilePolicy, BetaURLContext } from './hooks';
import { FAMILY, STATE_ONLY_MEMBERS, type Member, type TypedResult } from './registry';
import {
  NAVIGATION_REFUSED_LINE,
  coalesceChanges,
  dialogLines,
  isDialogDismissed,
  isDownloadChange,
  isNavigationRefused,
  renderBrowserState,
  renderResult,
  text,
} from './render';
import { FIELD_MAX, boundedTabURL, cutPoints } from './sanitize';
import type { BetaBrowserState, BetaDialogDismissed } from './results';

/** One browser member call in flight: what each stage produced, for the stages after it, and the tab it is about. */
export class CallRecord extends MemberCall<Member, BetaBrowserMemberInput, TypedResult> {
  /**
   * The tab the call names, or undefined when it names none (an absent or empty `tab_id` both mean the
   * active tab, as they do to a driver).
   */
  get tabId(): string | undefined {
    const tabId = this.input !== undefined && 'tab_id' in this.input ? this.input.tab_id : undefined;
    return tabId == null || tabId === '' ? undefined : tabId;
  }
}

// --- input ---------------------------------------------------------------------------------------------

/**
 * The model's `tool_use.input`, copied and typed as the member's input type. Nothing is checked here: every field stays
 * in the copy as sent, declared or not. If the driver throws on a field, the error becomes an `is_error` result.
 *
 * `confirm` gets the copy as `ctx.input`, and the driver gets it as `input`. `browserState` does not get the copy.
 * All three get `ctx.toolUse.input`, the input as the model sent it.
 */
export function parseInput(raw: unknown): BetaBrowserMemberInput {
  // The API sends `input` as an object. The copy keeps the SDK's own writes (a history word, resolved paths) out of it.
  return { ...(raw as object | null | undefined) } as BetaBrowserMemberInput;
}

/**
 * The driver's report as the pipeline reads it, built once: the tabs and the wire changes with each page-supplied URL
 * bounded, and the SDK's own change kinds set apart, since they reach the model as text.
 */
export interface Report {
  readonly tabs: BetaBrowserStateTabEntry[];
  readonly changes: BetaBrowserStateChange[];
  readonly navigationRefused: boolean;
  readonly dialogs: BetaDialogDismissed[];
}

/**
 * The checked `BetaBrowserState` as a `Report`: its tabs and wire changes as they stand, the SDK's own change kinds set
 * apart.
 */
export function reportOf(state: BetaBrowserState): Report {
  const changes: BetaBrowserStateChange[] = [];
  let navigationRefused = false;
  const dialogs: BetaDialogDismissed[] = [];
  for (const change of state.state_changes ?? []) {
    if (isNavigationRefused(change)) navigationRefused = true;
    else if (isDialogDismissed(change)) dialogs.push(change);
    else changes.push(change);
  }
  return { tabs: state.tabs, changes, navigationRefused, dialogs };
}

/**
 * The report with each tab's and each download's page-supplied URL as the model will read it (folded to one line and
 * held to the API's limit, see `boundedTabURL`) before anything else reads or forwards it.
 * Tab entries are copies, so the inventory kept for the next call never aliases the driver's objects; state
 * changes are the driver's objects unless a URL was bounded.
 */
export function withBoundedTabURLs(state: BetaBrowserState): BetaBrowserState {
  const tabs = state.tabs.map((tab) => ({ ...tab, url: boundedTabURL(tab.url) }));
  const state_changes = state.state_changes?.map((change) => {
    if (!isDownloadChange(change)) return change;
    const bounded = boundedTabURL(change.url);
    return bounded === change.url ? change : { ...change, url: bounded };
  });
  return state_changes === undefined ? { ...state, tabs } : { ...state, tabs, state_changes };
}

/** The `tab_id` of the tab a `new_tab` call returned, if it returned one. */
function openedTabId(call: CallRecord): string | undefined {
  const opened =
    call.member?.name === 'new_tab' && call.result?.kind === 'tab' ? call.result.value : undefined;
  return opened?.tab_id;
}

/**
 * A `new_tab` result must include exactly one `tab_opened`: the tab it opened. A popup the page opened around the
 * same time (drained by this call, or held back from a call whose result never reached the model) is still news,
 * so its `tab_opened` waits for the next block rather than making this one invalid. When the driver reported no
 * `tab_opened` for the opened tab, one is added.
 */
export function holdOtherTabOpened(
  call: CallRecord,
  changes: BetaBrowserStateChange[],
): { keep: BetaBrowserStateChange[]; held: BetaBrowserStateChange[] } {
  const tabId = openedTabId(call);
  if (tabId === undefined) return { keep: changes, held: [] };

  const keep: BetaBrowserStateChange[] = [];
  const held: BetaBrowserStateChange[] = [];

  for (const change of changes) {
    if (change.type === 'tab_opened' && change.tab_id !== tabId) held.push(change);
    else keep.push(change);
  }

  if (!keep.some((change) => change.type === 'tab_opened')) keep.push({ type: 'tab_opened', tab_id: tabId });
  return { keep, held };
}

/** What the model reads when `new_tab` succeeded but the report does not have the opened tab as its only active tab. */
const NEW_TAB_NOT_ACTIVE_LINE =
  'new_tab opened a tab, but the browser does not report it as the only active tab. Call list_tabs to see the tabs.';

/**
 * Which tab a call is about: the tab it names by `tab_id`, else the active tab.
 * `undefined` when the named tab is not in the report (or nothing is active).
 */
export function targetTab(
  tabs: readonly BetaBrowserStateTabEntry[],
  tabId: string | undefined,
): BetaBrowserStateTabEntry | undefined {
  return tabs.find((tab) => (tabId !== undefined ? tab.tab_id === tabId : tab.active === true));
}

/** Per-toolset bookkeeping kept across calls. */
export class PipelineState {
  /**
   * State changes a call drained but could not send: a failed call's, or another tab's `tab_opened` held back from a
   * `new_tab` result. They go out with the next block that can hold them.
   */
  pendingChanges: BetaBrowserStateChange[] = [];

  /** A refused-navigation line that could not be attached yet (the result was state-only). */
  refusalPending = false;

  /** Dismissed dialogs whose lines could not be attached yet (the result was state-only). */
  dialogsPending: BetaDialogDismissed[] = [];

  /**
   * The tab inventory of the most recent report: what `confirm` receives.
   * `undefined` before the first report (a report may list no tabs).
   */
  lastTabs: BetaBrowserStateTabEntry[] | undefined = undefined;

  /**
   * Render the call's outcome with the browser state the driver just reported.
   *
   * On success the content is the member's rendering plus the `browser_state` block (with any changes
   * held back earlier). On failure, and for a `new_tab` whose tab the report does not show as the only active tab,
   * the changes are held back for the next block, because an error result cannot include one, and the content is
   * the error text plus any refused-navigation and dismissed-dialog lines, since those are often why the member
   * failed.
   */
  async finish(
    call: CallRecord,
    report: Report,
    filePolicy: BetaFilePolicy | undefined,
  ): Promise<{ content: BetaToolsetContent; isError: boolean }> {
    this.lastTabs = report.tabs;
    const refused = report.navigationRefused || this.refusalPending;
    const dialogs = [...this.dialogsPending, ...report.dialogs];
    const changes = coalesceChanges(this.pendingChanges, report);

    // Held first: should rendering stop the run (a ToolsetUsageError out of the file policy), the
    // drained changes are still on hand rather than lost with this call.
    this.pendingChanges = changes;

    const openedId = call.error === undefined ? openedTabId(call) : undefined;
    const activeIds = report.tabs.filter((tab) => tab.active === true).map((tab) => tab.tab_id);
    if (openedId !== undefined && (activeIds.length !== 1 || activeIds[0] !== openedId)) {
      // The API refuses a non-error new_tab result unless the tab it opened is its only active tab.
      return {
        content: [text(NEW_TAB_NOT_ACTIVE_LINE), ...this.#takeNotices(refused, dialogs)],
        isError: true,
      };
    }

    if (call.error === undefined) {
      const content = renderResult(call.member!, call.input, call.result!);
      const { keep, held } = holdOtherTabOpened(call, changes);
      const block = await renderBrowserState(report.tabs, keep, filePolicy);
      this.pendingChanges = held;

      if (STATE_ONLY_MEMBERS.has(call.member!.name)) {
        // A block-only result has no text, so the lines wait for the next result that can hold them.
        this.refusalPending = refused;
        this.dialogsPending = dialogs;
        return { content: [block], isError: false };
      }
      content.push(...this.#takeNotices(refused, dialogs), block);
      return { content, isError: false };
    }

    return { content: [...errorContent(call.error), ...this.#takeNotices(refused, dialogs)], isError: true };
  }

  /** The refused-navigation line and the dialog lines as text blocks, now that a result can hold them. */
  #takeNotices(refused: boolean, dialogs: readonly BetaDialogDismissed[]): BetaTextBlockParam[] {
    this.refusalPending = false;
    this.dialogsPending = [];
    return [...(refused ? [NAVIGATION_REFUSED_LINE] : []), ...dialogLines(dialogs)].map(text);
  }
}

// --- URL and file policy enforcement -----------------------------------------------------------------

/**
 * `error` with each text block cut to the API's field limit, or the same object when nothing was cut: a driver's
 * exception can embed a page-sized payload.
 */
export function boundedError(error: ToolError): ToolError {
  const content = errorContent(error);
  const bounded = content.map((block) => ({ ...block, text: cutPoints(block.text, FIELD_MAX) }));
  if (bounded.every((block, i) => block.text === content[i]!.text)) return error;
  return new ToolError(bounded);
}

export const HISTORY_NAVIGATION: ReadonlySet<string> = /* @__PURE__ */ new Set(['back', 'forward', 'reload']);

export function urlContext(record: CallRecord): BetaURLContext {
  return { member: record.member!.name, tabId: record.tabId, toolUseId: record.toolUseId };
}

/**
 * The `url` of a `navigate` call exactly as the model wrote it, for the URL policy. `undefined` for the history words
 * `back` / `forward` / `reload` (the driver receives the canonical lower-case word) and for other members.
 */
export function navigateRequestURL(record: CallRecord): string | undefined {
  if (record.member?.name !== 'navigate' || record.input === undefined) return undefined;
  const input = record.input as BetaBrowserNavigateInput;
  // the URL policy is promised a string
  if (typeof input.url !== 'string')
    throw new InvalidMemberInputError(record.member.name, FAMILY, 'url: expected a string');
  const word = input.url.trim().toLowerCase();
  if (HISTORY_NAVIGATION.has(word)) {
    input.url = word;
    return undefined;
  }
  return input.url;
}

/**
 * A policy that threw refused the URL. A ToolError contains the text the model should read. Any other exception's
 * message may contain the URL it refused, so the model reads the SDK's own line instead. A TypeError out of your policy
 * is a refusal like any other exception, not a `ToolsetUsageError`.
 */
export function policyRefusal(error: unknown): ToolError {
  if (error instanceof ToolsetUsageError) throw error;
  if (error instanceof ToolError) return error;
  return new URLRefusedError('refused by the URL policy');
}

/**
 * For `file_upload`: run `input.paths` and `input.document_ids` through the file policy before dispatch. Without a
 * file policy, an upload that names either is refused. In `ctx.input`, `confirm` gets the paths and document ids the
 * policy returned. The member gets them in `input`. A refused path or document stops the call before `confirm` or the
 * member runs. `browserState` still runs after a refusal. Its `ctx.toolUse.input` is the input as the model sent it.
 * That input includes the refused entries.
 */
export async function resolveUploadPaths(
  record: CallRecord,
  filePolicy: BetaFilePolicy | undefined,
): Promise<void> {
  if (record.member?.name !== 'file_upload' || record.input === undefined) return;

  const input = record.input as BetaBrowserFileUploadInput;
  const ctx = urlContext(record);
  if (!nothingToVet(input.paths)) {
    input.paths = await vetUpload(filePolicy, ctx, input.paths, 'resolveUploadPaths', NO_UPLOAD_ROOTS);
  }

  if (!nothingToVet(input.document_ids)) {
    input.document_ids = await vetUpload(
      filePolicy,
      ctx,
      input.document_ids,
      'resolveUploadDocuments',
      'file_upload has no configured document allowlist',
    );
  }
}

/** Only an absent value or an empty array skips the file policy, so a value that is not a list can't get past it. */
function nothingToVet(value: string[] | null | undefined): value is [] | null | undefined {
  return value == null || (Array.isArray(value) && value.length === 0);
}

async function vetUpload(
  filePolicy: BetaFilePolicy | undefined,
  ctx: BetaURLContext,
  given: string[],
  hook: 'resolveUploadPaths' | 'resolveUploadDocuments',
  missing: string,
): Promise<string[]> {
  const field = hook === 'resolveUploadPaths' ? 'paths' : 'document_ids';
  if (!Array.isArray(given) || given.some((entry) => typeof entry !== 'string'))
    throw new InvalidMemberInputError('file_upload', FAMILY, `${field}: expected a list of strings`);
  if (filePolicy === undefined) throw new UploadRefusedError(missing);

  try {
    // a copy, so what `confirm` and the driver receive is not the policy's own array
    return [...(await filePolicy[hook](ctx, given))];
  } catch (error) {
    // The hook rule: a ToolsetUsageError stops the run, a ToolError is the policy's own refusal, and
    // anything else fails closed as a refusal the model reads. The upload never reaches the driver.
    if (error instanceof ToolsetUsageError || error instanceof ToolError) throw error;
    throw new UploadRefusedError('the file policy could not vet the upload');
  }
}

// --- confirmation --------------------------------------------------------------------------------------

/**
 * What the `confirm` callable receives: the member and its input, and the tab the call targets (named, else active)
 * with its URL, as of the last report and with no page read.
 */
export function confirmContext(record: CallRecord, pipeline: PipelineState): BetaConfirmContext {
  const tab = targetTab(pipeline.lastTabs ?? [], record.tabId);
  // The URL as a `browser_state` block carries it: folded and bounded when the report was collected.
  return {
    ...record.ctx,
    member: record.member!.name,
    input: record.input!,
    tabId: tab === undefined ? record.tabId : tab.tab_id,
    tabURL: tab?.url,
  };
}
