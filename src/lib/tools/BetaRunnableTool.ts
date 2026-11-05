import {
  BetaClientToolUnion,
  BetaToolResultContentBlockParam,
  BetaToolUnion,
  BetaToolUseBlock,
} from '../../resources/beta';
import type {
  BetaManagedAgentsAgentCustomToolUseEvent,
  BetaManagedAgentsAgentToolUseEvent,
} from '../../resources/beta/sessions/events';
import { ToolError } from './ToolError';
import {
  EMPTY_ERROR_TEXT,
  errorText,
  errorTextContent,
  isEmptyErrorContent,
} from '../internal/toolsets/sanitize';

export type Promisable<T> = T | Promise<T>;

/** Tools that run on the client. Server-side tools (code execution, web search, MCP toolsets) are not included. */
export type BetaClientRunnableToolType = Extract<BetaClientToolUnion, { name: string }>;

/**
 * The tool call being served: a Messages `tool_use` block, or a session
 * `agent.tool_use` / `agent.custom_tool_use` event. All three carry `id`,
 * `name` and `input`.
 */
export type BetaToolUse =
  BetaToolUseBlock | BetaManagedAgentsAgentToolUseEvent | BetaManagedAgentsAgentCustomToolUseEvent;

export type BetaToolRunContext = {
  toolUse: BetaToolUse;
  /** @deprecated Use `toolUse`. */
  toolUseBlock: BetaToolUse;
  /**
   * Aborted when the runner is aborted or, in the session runner, when the
   * per-tool timeout fires. The runner still waits for `run` to return, so
   * check it in long-running work.
   */
  signal?: AbortSignal | null | undefined;
};

/** A tool definition plus the `run` and `parse` the tool runners call. */
export type BetaRunnableTool<Input = any> = BetaClientRunnableToolType & {
  /**
   * Runs on the event loop: a body that blocks synchronously stalls the runner
   * and, in an `EnvironmentWorker`, the lease heartbeat. Await async work or
   * move it to a worker thread. A streaming `client.beta.messages.toolRunner`
   * can call it while the reply is still streaming.
   */
  run: (
    args: Input,
    context?: BetaToolRunContext,
  ) => Promisable<string | Array<BetaToolResultContentBlockParam>>;
  parse: (content: unknown) => Input;
  /** Called once by the session runner when it stops. Release held resources here (e.g. a shell). */
  close?: () => Promisable<void>;
};

/**
 * The name the model calls a tool by: `mcp_server_name` for MCP toolsets, `type` for nameless server
 * toolsets (browser/computer), `name` for everything else.
 */
export function toolName(tool: BetaToolUnion | BetaRunnableTool): string {
  return (
    'name' in tool ? tool.name
    : 'mcp_server_name' in tool ? tool.mcp_server_name
    : tool.type
  );
}

/**
 * Tool-result content for a thrown value: a {@link ToolError}'s own content,
 * otherwise `Error: <message>`.
 *
 * Sanitized the same way the toolset runner sanitizes it, because the API
 * applies one contract to an `is_error` result whichever runner produced it:
 * text only, well-formed, bounded to the field limit, and never empty. Passing
 * a `ToolError`'s content through raw let a function tool answer with an image
 * block, an empty string or a page-sized message, and the API rejects each of
 * those with a 400 that ends the run.
 */
export function toolErrorContent(e: unknown): string | Array<BetaToolResultContentBlockParam> {
  const content = e instanceof ToolError ? errorTextContent(e.content) : errorText(e);
  return isEmptyErrorContent(content) ? EMPTY_ERROR_TEXT : content;
}

/** What a tool run produced, and whether it failed. */
export interface RunnableToolOutcome {
  content: string | Array<BetaToolResultContentBlockParam>;
  isError: boolean;
}

/** Parse the input, run the tool, and turn anything thrown into an error result. */
export async function runRunnableTool(
  tool: BetaRunnableTool,
  rawInput: unknown,
  context: BetaToolRunContext,
): Promise<RunnableToolOutcome> {
  try {
    const input = tool.parse ? tool.parse(rawInput) : rawInput;
    const content = await tool.run(input, context);
    return { content, isError: false };
  } catch (e) {
    return { content: toolErrorContent(e), isError: true };
  }
}
