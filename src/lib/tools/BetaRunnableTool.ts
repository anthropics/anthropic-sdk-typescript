import {
  BetaMemoryTool20250818,
  BetaTool,
  BetaToolBash20241022,
  BetaToolBash20250124,
  BetaToolComputerUse20241022,
  BetaToolComputerUse20250124,
  BetaToolComputerUse20251124,
  BetaToolResultContentBlockParam,
  BetaToolTextEditor20241022,
  BetaToolTextEditor20250124,
  BetaToolTextEditor20250429,
  BetaToolTextEditor20250728,
  BetaToolUnion,
  BetaToolUseBlock,
} from '../../resources/beta';
import type {
  BetaManagedAgentsAgentCustomToolUseEvent,
  BetaManagedAgentsAgentToolUseEvent,
} from '../../resources/beta/sessions/events';
import { ToolError } from './ToolError';

export type Promisable<T> = T | Promise<T>;

/** Tools that run on the client. Server-side tools (code execution, web search, MCP toolsets) are not included. */
export type BetaClientRunnableToolType =
  | BetaTool
  | BetaMemoryTool20250818
  | BetaToolBash20241022
  | BetaToolBash20250124
  | BetaToolComputerUse20241022
  | BetaToolComputerUse20250124
  | BetaToolComputerUse20251124
  | BetaToolTextEditor20241022
  | BetaToolTextEditor20250124
  | BetaToolTextEditor20250429
  | BetaToolTextEditor20250728;

/**
 * The tool call being served: a Messages `tool_use` block, or a session
 * `agent.tool_use` / `agent.custom_tool_use` event. All three carry `id`,
 * `name` and `input`.
 */
export type BetaToolUse =
  | BetaToolUseBlock
  | BetaManagedAgentsAgentToolUseEvent
  | BetaManagedAgentsAgentCustomToolUseEvent;

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
   * move it to a worker thread.
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

/** Tool-result content for a thrown value: a {@link ToolError}'s own content, otherwise `Error: <message>`. */
export function toolErrorContent(e: unknown): string | Array<BetaToolResultContentBlockParam> {
  return e instanceof ToolError ? e.content : `Error: ${e instanceof Error ? e.message : String(e)}`;
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
