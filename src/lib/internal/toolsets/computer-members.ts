/**
 * The computer toolset's members: the names and input types, what each member returns, the registry row per member,
 * and the function that copies the model's input.
 *
 * The member names and every input type are the API types in `resources/beta`. A member's result kind is kept by hand.
 * So is the confirmation text the model reads after a pure action. Neither is in the API types. A test diffs the
 * member set against the published toolset definition so the two cannot drift silently.
 *
 * @internal
 */
import type {
  BetaComputerMemberInput,
  BetaComputerMemberName,
  BetaResponseComputerToolUseBlock,
} from '../../../resources/beta';
import {
  buildMembers,
  type BetaScreenshotResult,
  type KindResultOf,
  type MemberRow,
  type Registry,
  type ResultKind,
  type ToolsetMember,
  type TypedResultOf,
} from './core';

export const COMPUTER_FAMILY = 'computer' as const;
export const COMPUTER_TOOLSET_TYPE = 'computer_toolset_20260801' as const;

// The generated member-name union, re-exported for the modules beside this one.
export type { BetaComputerMemberName };

// The toolset modules import these five API types from here.
export type {
  BetaComputerMemberInput,
  BetaComputerCursorPositionInput,
  BetaComputerLeftMouseDownInput,
  BetaComputerLeftMouseUpInput,
  BetaComputerScreenshotInput,
} from '../../../resources/beta';

/** Each computer member's input type, by member name. */
export type ComputerMemberInputs = {
  [K in BetaComputerMemberName]: Extract<BetaResponseComputerToolUseBlock, { name: K }>['input'];
};

// --- results -----------------------------------------------------------------------------------------------

/** Where the cursor is, in screenshot pixels. Rendered as `X={x},Y={y}`. */
export interface BetaComputerCursorPositionResult {
  x: number;
  y: number;
}

/** Anything a computer member may return: `execute`'s un-narrowed result type. */
export type BetaComputerMemberResult =
  | BetaScreenshotResult
  | BetaComputerCursorPositionResult
  | string
  | void;

/**
 * What each computer member's implementation returns. A pure action returns nothing, or one line of text the model
 * reads in a text block of its own after the SDK's acknowledgment.
 */
export interface ComputerMemberResults {
  key: void | string;
  hold_key: void | string;
  type: void | string;
  cursor_position: BetaComputerCursorPositionResult;
  mouse_move: void | string;
  left_mouse_down: void | string;
  left_mouse_up: void | string;
  left_click: void | string;
  left_click_drag: void | string;
  right_click: void | string;
  middle_click: void | string;
  double_click: void | string;
  triple_click: void | string;
  scroll: void | string;
  wait: void | string;
  screenshot: BetaScreenshotResult;
  zoom: BetaScreenshotResult;
}

// The result map must cover exactly the member names the API declares; a member in one without the
// other fails here.
type AssertSameKeys<A, B> =
  [keyof A] extends [B] ?
    [B] extends [keyof A] ?
      true
    : never
  : never;
const _computerKeys: AssertSameKeys<ComputerMemberResults, BetaComputerMemberName> = true;
void _computerKeys;

// --- the registry ------------------------------------------------------------------------------------------

/** One member of the computer toolset. */
export type ComputerMember = ToolsetMember<BetaComputerMemberName, ComputerResultKind>;

// Hand-kept: result kinds and confirmation templates. Every member is on by default. A member missing here (or an
// extra one) fails to compile.
const ROWS = {
  key: ['none', 'Pressed {text}.', true],
  hold_key: ['none', 'Held {text} for {duration}s.', true],
  type: ['none', 'Typed.', true],
  cursor_position: ['point', null, true],
  mouse_move: ['none', 'Moved the mouse.', true],
  left_mouse_down: ['none', 'Left mouse button pressed.', true],
  left_mouse_up: ['none', 'Left mouse button released.', true],
  left_click: ['none', 'Clicked.', true],
  left_click_drag: ['none', 'Dragged.', true],
  right_click: ['none', 'Right-clicked.', true],
  middle_click: ['none', 'Middle-clicked.', true],
  double_click: ['none', 'Double-clicked.', true],
  triple_click: ['none', 'Triple-clicked.', true],
  scroll: ['none', 'Scrolled {scroll_direction}.', true],
  wait: ['none', 'Waited {duration}s.', true],
  screenshot: ['screenshot', null, true],
  zoom: ['screenshot', null, true],
} as const satisfies { readonly [K in BetaComputerMemberName]: MemberRow };

/** The result kinds the rows above use. */
export type ComputerResultKind = (typeof ROWS)[BetaComputerMemberName][0];

/** The declared result (`ComputerMemberResults`) of every member the rows above give result kind `R`. */
export type ComputerKindResult<R extends ResultKind> = KindResultOf<
  BetaComputerMemberName,
  typeof ROWS,
  ComputerMemberResults,
  R
>;

/** A computer member's result with its result kind, which says how to read it. */
export type ComputerTypedResult<R extends ComputerResultKind = ComputerResultKind> = TypedResultOf<
  BetaComputerMemberName,
  typeof ROWS,
  ComputerMemberResults,
  R
>;

/**
 * `value` typed as what a computer member of result kind `kind` returns: the one place the driver's declared result
 * type is taken at its word.
 */
export function typedComputerResult<R extends ComputerResultKind>(
  kind: R,
  value: ComputerKindResult<R>,
): ComputerTypedResult<R> {
  return { kind, value };
}

type RowName = keyof typeof ROWS;

/**
 * Every computer member name, in the order of `ROWS`. Built from the table, not imported from
 * `BETA_COMPUTER_MEMBER_NAME_VALUES`, so the toolset modules do not load `resources/beta/messages/messages`.
 */
export const COMPUTER_MEMBER_NAMES: ReadonlyArray<RowName> = /* @__PURE__ */ Object.keys(ROWS) as RowName[];

/** Every computer member, in the order of `ROWS`. */
export const COMPUTER_MEMBERS: ReadonlyMap<BetaComputerMemberName, ComputerMember> =
  /* @__PURE__ */ buildMembers(COMPUTER_MEMBER_NAMES, ROWS);

// The API's member data marks no computer tool as needing `confirm`, so this list is the SDK's own.
export const COMPUTER_CONFIRM_REQUIRED: ReadonlySet<string> = /* @__PURE__ */ new Set([
  'type',
  'key',
  'hold_key',
]);

/** The computer registry as the shared toolset core reads it. No member is off by default. */
export const COMPUTER_REGISTRY: Registry<BetaComputerMemberName, ComputerMember> = {
  family: COMPUTER_FAMILY,
  names: COMPUTER_MEMBER_NAMES,
  members: COMPUTER_MEMBERS,
  defaultDisabled: /* @__PURE__ */ new Set(),
};

// --- input -------------------------------------------------------------------------------------------------

/** Copies the model's input. The copy is a spread, so an own `__proto__` key stays an ordinary key. */
export function parseComputerInput(raw: unknown): BetaComputerMemberInput {
  return { ...(raw as object) } as BetaComputerMemberInput;
}
