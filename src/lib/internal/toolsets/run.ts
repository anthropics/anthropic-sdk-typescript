/**
 * What the SDK does around one member call of a runnable toolset: the `tool_result` that answers the call, and how
 * an exception out of a member is classified. Kept out of `BetaRunnableToolset`, which is public and holds only the
 * toolset contract.
 *
 * @internal
 */
import type { BetaToolResultBlockParam, BetaToolUseBlock } from '../../../resources/beta';
import { APIUserAbortError } from '../../../core/error';
import { type BetaToolRunContext } from '../../tools/BetaRunnableTool';
import { ToolError } from '../../tools/ToolError';
import { ToolsetContractError, ToolsetUsageError } from './errors';
import { errorText, errorTextContent, thrownErrorText, wellFormed } from './sanitize';
import { toolsetFamily, type ToolsetFamily } from './family';
import type { BetaRunnableToolset, BetaToolsetContent } from '../../tools/BetaRunnableToolset';

/**
 * What the runner answers for a toolset member it did not run because an earlier member of the same toolset failed
 * in the same assistant turn: the model planned those actions as a sequence, and a later one rarely makes sense once
 * an earlier one did not happen. The browser toolset's text; `notExecutedText` gives each family its own.
 */
export const NOT_EXECUTED = 'Not executed: an earlier action in this turn failed.';

const NOT_EXECUTED_BY_FAMILY: Record<ToolsetFamily, string> = {
  browser: NOT_EXECUTED,
  computer: 'Not executed: an earlier computer action in this turn failed.',
};

/** The not-executed text for `family` (a `tool_use.toolset_name`), or the browser's for a family the SDK doesn't know. */
export function notExecutedText(family: string): string {
  return Object.prototype.hasOwnProperty.call(NOT_EXECUTED_BY_FAMILY, family) ?
      NOT_EXECUTED_BY_FAMILY[family as ToolsetFamily]
    : NOT_EXECUTED;
}

/**
 * The `tool_result` answering a member `tool_use`. `toolset_name` is required on a member result (the API rejects a
 * mismatch), so it is echoed on error paths too.
 */
export function toolsetResultBlock(
  toolUse: BetaToolUseBlock,
  content: string | BetaToolsetContent,
  isError = false,
): BetaToolResultBlockParam {
  if (isError && (content === '' || (Array.isArray(content) && content.length === 0))) {
    // Deliberate: an empty ToolError (`throw new ToolError('')`, or one whose non-text blocks were dropped) would be
    // an is_error result with empty content, which the API rejects with a 400, ending the whole run over a refusal
    // the model could have recovered from. The model still learns the call failed, and the developer loses nothing
    // they wrote.
    content = 'The tool call failed with an empty error message.';
  }

  return {
    type: 'tool_result',
    tool_use_id: toolUse.id,
    toolset_name: toolUse.toolset_name ?? null,
    content,
    ...(isError ? { is_error: true } : {}),
  };
}

/**
 * What never becomes a tool result: a `ToolsetUsageError` propagates as it is, and once the call's own `AbortSignal`
 * has aborted the cancellation propagates as `APIUserAbortError`, whatever was thrown after it. An error named
 * `AbortError` that a driver throws while that signal has not aborted (a page-aborted request, a driver's own timeout)
 * is the driver's failure, not a cancellation.
 */
export function throwIfPropagates(error: unknown, ctx: { signal?: AbortSignal | undefined | null }): void {
  if (error instanceof ToolsetUsageError) throw error;
  throwIfAborted(ctx.signal);
}

/** Once `signal` has aborted, throws the `APIUserAbortError` an aborted request throws, so one `catch` covers both. */
export function throwIfAborted(signal: AbortSignal | undefined | null): void {
  if (signal?.aborted) throw new APIUserAbortError();
}

/**
 * How an exception out of a member call is classified, at the `execute` boundary and in the runner alike: what
 * `throwIfPropagates` covers propagates, a `ToolError` is the member's own refusal, and anything else a driver throws
 * (its `TypeError` included) becomes a refusal the model reads, so the loop continues.
 */
export function classify(error: unknown, ctx: { signal?: AbortSignal | undefined | null }): ToolError {
  throwIfPropagates(error, ctx);
  if (error instanceof ToolError) return error;
  // Not cut here: the toolset cuts the text to the field limit when it builds the result.
  return new ToolError(wellFormed(thrownErrorText(error)));
}

/**
 * Runs one member `tool_use` against `toolset` and builds its `tool_result`. Throws if `toolUse`
 * is not a member call of this family: a block without `toolset_name` is a plain tool (possibly a
 * custom tool sharing a member name) and must never be routed here.
 */
export async function runToolsetMember(
  toolset: BetaRunnableToolset,
  toolUse: BetaToolUseBlock,
  options: Omit<BetaToolRunContext, 'toolUse' | 'toolUseBlock'> = {},
): Promise<BetaToolResultBlockParam> {
  const family = toolsetFamily(toolset);
  if (toolUse.toolset_name !== family) {
    // a caller's routing mistake, like every other misuse of the toolset's API
    throw new ToolsetContractError(
      `tool_use ${JSON.stringify(toolUse.id)} (toolset_name=${JSON.stringify(
        toolUse.toolset_name ?? null,
      )}, name=${JSON.stringify(toolUse.name)}) is not a member call of the ${JSON.stringify(
        family,
      )} toolset`,
    );
  }

  const ctx: BetaToolRunContext = { ...options, toolUse, toolUseBlock: toolUse };

  try {
    return toolsetResultBlock(toolUse, await toolset.run(ctx, toolUse));
  } catch (e) {
    // `classify`, as an is_error result: a converted exception is cut to the field limit here
    throwIfPropagates(e, ctx);
    return toolsetResultBlock(
      toolUse,
      errorTextContent(e instanceof ToolError ? e.content : errorText(e)),
      true,
    );
  }
}
