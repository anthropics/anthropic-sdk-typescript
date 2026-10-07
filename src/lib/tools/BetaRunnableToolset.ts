/**
 * Runnable-toolset contract for `browser_toolset_20260801` and `computer_toolset_20260801`.
 *
 * A toolset is one nameless `tools[]` entry declaring a family of member tools. Each member call is
 * its own `tool_use` whose `name` is the member and whose `toolset_name` is the family
 * (`'browser'` or `'computer'`), and the `tool_result` echoes `toolset_name`. Member names are not reserved (a custom
 * tool may be called `navigate`), so dispatch keys on `(toolset_name, name)`, never on `name`
 * alone. A runnable toolset serializes to exactly the nameless entry: functions are dropped by
 * `JSON.stringify` and the family is derived from `type`, never stored.
 *
 * @internal
 */
import {
  BetaBrowserToolset20260801,
  BetaComputerToolset20260801,
  BetaToolResultContentBlockParam,
  BetaToolUseBlock,
} from '../../resources/beta';
import { BetaToolRunContext, Promisable } from './BetaRunnableTool';

export {
  ToolsetUsageError,
  ToolsetConfigError,
  ToolsetContractError,
  ToolsetClosedError,
  UnknownMemberError,
  DisabledMemberError,
  UnavailableMemberError,
  InvalidMemberInputError,
  URLRefusedError,
  ConfirmDeclinedError,
  ConfirmFailedError,
  UploadRefusedError,
} from '../internal/toolsets/errors';

export type BetaToolsetParam = BetaBrowserToolset20260801 | BetaComputerToolset20260801;

/** The `tool_result` content a member call renders to. */
export type BetaToolsetContent = Array<BetaToolResultContentBlockParam>;

/** A toolset entry plus the `run` the tool runner calls for each member `tool_use`. */
export type BetaRunnableToolset<T extends BetaToolsetParam = BetaToolsetParam> = T & {
  /**
   * Executes the member `toolUse.name` with its raw `tool_use.input` and returns the rendered
   * tool-result content, or throws a `ToolError` for a model-visible failure.
   */
  run: (ctx: BetaToolRunContext, toolUse: BetaToolUseBlock) => Promisable<BetaToolsetContent>;
  /**
   * Releases held resources (a browser, a socket) when you are done with the toolset. The tool runner never calls
   * it, so one instance can serve several runs.
   */
  close?: () => Promisable<void>;
};
