/**
 * The browser member registry: one row per member, from which most per-member tables derive.
 *
 * Member names and input types come from the API's `tool_use` union (`inputs.ts`). What is kept by
 * hand here is what the API types lack: each member's result kind, the confirmation text the
 * model reads after a pure action, which members the API disables by default, and which members render
 * only a `browser_state` block. A test diffs the member set and the default-disabled set against the
 * published toolset definition so the two cannot drift silently.
 *
 * @internal
 */
import type { BetaBrowserStateTabEntry, BetaBrowserToolsetConfigs } from '../../../resources/beta';
import {
  buildMembers,
  type BetaScreenshotResult,
  isEnabled,
  memberOf,
  type KindResultOf,
  type MemberRow,
  type Registry,
  type ResultKind,
  type ToolsetMember,
  type TypedResultOf,
} from './core';
import type { BrowserMemberInputs, BetaBrowserMemberName } from './inputs';
import type { BetaBrowserNavigateResult } from './results';

export const FAMILY = 'browser' as const;
/**
 * Members whose calls wait for a person unless the application says otherwise: page content can steer what the
 * model asks them to do, and what they do reaches outside the page.
 */
export const CONFIRM_REQUIRED: ReadonlySet<string> = /* @__PURE__ */ new Set([
  'javascript_exec',
  'file_upload',
]);
export const TOOLSET_TYPE = 'browser_toolset_20260801' as const;

/**
 * What each browser member's implementation returns. A pure action returns nothing, or one line of text the model reads
 * in a text block of its own after the SDK's acknowledgment.
 */
export interface BrowserMemberResults {
  navigate: BetaBrowserNavigateResult;
  screenshot: BetaScreenshotResult;
  zoom: BetaScreenshotResult;
  left_click: void | string;
  right_click: void | string;
  middle_click: void | string;
  double_click: void | string;
  triple_click: void | string;
  hover: void | string;
  left_click_drag: void | string;
  left_mouse_down: void | string;
  left_mouse_up: void | string;
  mouse_move: void | string;
  scroll: void | string;
  scroll_to: void | string;
  type: void | string;
  key: void | string;
  hold_key: void | string;
  form_input: void | string;
  read_page: string;
  find: string;
  get_page_text: string;
  wait: void | string;
  file_upload: void | string;
  read_console: string;
  read_network: string;
  javascript_exec: string;
  new_tab: BetaBrowserStateTabEntry;
  list_tabs: BetaBrowserStateTabEntry[];
  switch_tab: BetaBrowserStateTabEntry;
  close_tab: void;
}

// The result map must cover exactly the member names the API declares: a member in one without the
// other fails here.
type AssertSameKeys<A, B> =
  [keyof A] extends [B] ?
    [B] extends [keyof A] ?
      true
    : never
  : never;
const _browserKeys: AssertSameKeys<BrowserMemberResults, BetaBrowserMemberName> = true;
void _browserKeys;

/** The type-level registry: what the model sends and what the implementation returns, per member. */
export type BrowserMembers = {
  [K in BetaBrowserMemberName]: { input: BrowserMemberInputs[K]; result: BrowserMemberResults[K] };
};

/** One member of the browser toolset. */
export type Member = ToolsetMember<BetaBrowserMemberName, BrowserResultKind>;

// Hand-kept: result kinds, confirmation templates and default-disabled flags. Everything else about a
// member comes from the API types. A member missing here (or an extra one) fails to compile.
const ROWS = {
  navigate: ['navigate', null, true],
  screenshot: ['screenshot', null, true],
  zoom: ['screenshot', null, true],
  left_click: ['none', 'Clicked.', true],
  right_click: ['none', 'Right-clicked.', true],
  middle_click: ['none', 'Middle-clicked.', true],
  double_click: ['none', 'Double-clicked.', true],
  triple_click: ['none', 'Triple-clicked.', true],
  hover: ['none', 'Hovered.', true],
  left_click_drag: ['none', 'Dragged.', true],
  left_mouse_down: ['none', 'Mouse button pressed.', true],
  left_mouse_up: ['none', 'Mouse button released.', true],
  mouse_move: ['none', 'Moved the mouse.', true],
  scroll: ['none', 'Scrolled {scroll_direction}.', true],
  scroll_to: ['none', 'Scrolled to {ref}.', true],
  type: ['none', 'Typed.', true],
  key: ['none', 'Pressed {text}.', true],
  hold_key: ['none', 'Held {text} for {duration}s.', true],
  form_input: ['none', 'Set the value of {ref}.', true],
  read_page: ['text', null, true],
  find: ['text', null, true],
  get_page_text: ['text', null, true],
  wait: ['none', 'Waited {duration}s.', true],
  file_upload: ['none', 'Uploaded.', false],
  read_console: ['text', null, false],
  read_network: ['text', null, false],
  javascript_exec: ['text', null, false],
  new_tab: ['tab', null, true],
  list_tabs: ['tabs', null, true],
  switch_tab: ['tab', null, true],
  close_tab: ['none', null, true],
} as const satisfies { readonly [K in BetaBrowserMemberName]: MemberRow };

/** The result kinds the rows above use. */
export type BrowserResultKind = (typeof ROWS)[BetaBrowserMemberName][0];

/** The declared result (`BrowserMemberResults`) of every member the rows above give result kind `R`. */
export type KindResult<R extends ResultKind> = KindResultOf<
  BetaBrowserMemberName,
  typeof ROWS,
  BrowserMemberResults,
  R
>;

/** A browser member's result with its result kind, which says how to read it. */
export type TypedResult<R extends BrowserResultKind = BrowserResultKind> = TypedResultOf<
  BetaBrowserMemberName,
  typeof ROWS,
  BrowserMemberResults,
  R
>;

/**
 * `value` typed as what a member of result kind `kind` returns: the one place the driver's declared result type is
 * taken at its word.
 */
export function typedResult<R extends BrowserResultKind>(kind: R, value: KindResult<R>): TypedResult<R> {
  return { kind, value };
}

type RowName = keyof typeof ROWS;

/**
 * Every browser member name, in the order of `ROWS`. Built from the table, not imported from the generated runtime list,
 * so the toolset modules do not load `resources/beta/messages/messages` (the runner loads them from there).
 */
export const BROWSER_MEMBER_NAMES: ReadonlyArray<RowName> = /* @__PURE__ */ Object.keys(ROWS) as RowName[];

/** Every browser member, in the order of `ROWS`. */
export const BROWSER_MEMBERS: ReadonlyMap<BetaBrowserMemberName, Member> = /* @__PURE__ */ buildMembers(
  BROWSER_MEMBER_NAMES,
  ROWS,
);

/** Members the API withholds unless `configs` enables them. */
export const BROWSER_DEFAULT_DISABLED_MEMBERS: ReadonlySet<string> = /* @__PURE__ */ new Set(
  /* @__PURE__ */ [...BROWSER_MEMBERS.values()].filter((m) => !m.enabledByDefault).map((m) => m.name),
);

/** The browser registry as the shared toolset core reads it. */
export const BROWSER_REGISTRY: Registry<BetaBrowserMemberName, Member> = {
  family: FAMILY,
  names: BROWSER_MEMBER_NAMES,
  members: BROWSER_MEMBERS,
  defaultDisabled: BROWSER_DEFAULT_DISABLED_MEMBERS,
};

export function getMember(name: string): Member | undefined {
  return memberOf(BROWSER_REGISTRY, name);
}

/**
 * The tab members, which render no content of their own, so their non-error result is exactly one `browser_state`
 * block, and a line meant for the model (a refused navigation) waits for the next result that can hold it. Listed by
 * name rather than derived from `ROWS`, so a tab member that gains a confirmation line stays in the set.
 */
export const STATE_ONLY_MEMBERS: ReadonlySet<BetaBrowserMemberName> = /* @__PURE__ */ new Set([
  'new_tab',
  'list_tabs',
  'switch_tab',
  'close_tab',
]);

/** The wire entry's `configs`, read as `{ [member]: { enabled? } }`. */
export type MemberConfigs = BetaBrowserToolsetConfigs | undefined;

/** Whether `configs` leave the browser member `name` enabled (`isEnabled` over the browser defaults). */
export function memberEnabled(name: string, configs: MemberConfigs): boolean {
  return isEnabled(name, configs, BROWSER_DEFAULT_DISABLED_MEMBERS);
}
