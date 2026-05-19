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

/**
 * Tool types that can be implemented on the client.
 * Excludes server-side tools like code execution, web search, and MCP toolsets.
 */
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
 * The tool-use that triggered a {@link BetaRunnableTool.run}:
 *
 * - from `client.beta.messages.toolRunner`, a Messages `tool_use` content block;
 * - from `client.beta.sessions.events.toolRunner`, the `agent.tool_use` /
 *   `agent.custom_tool_use` session event.
 *
 * The shapes overlap on the common fields (`id`, `name`, `input`), so code that
 * only reads those works without narrowing; narrow on the shape (e.g. `'type' in
 * x`) when you need surface-specific properties.
 */
export type BetaToolUse =
  | BetaToolUseBlock
  | BetaManagedAgentsAgentToolUseEvent
  | BetaManagedAgentsAgentCustomToolUseEvent;

export type BetaToolRunContext = {
  /** The tool-use that triggered this run. See {@link BetaToolUse}. */
  toolUse: BetaToolUse;
  /**
   * @deprecated Renamed to `toolUse`. Also note that for
   * `client.beta.sessions.events.toolRunner` this is the `agent.tool_use` /
   * `agent.custom_tool_use` *event*, not a Messages content block, despite the
   * name — which is why it was renamed.
   */
  toolUseBlock: BetaToolUse;
  signal?: AbortSignal | null | undefined;
};

// this type is just an extension of BetaTool with a run and parse method
// that will be called by `toolRunner()` helpers
export type BetaRunnableTool<Input = any> = BetaClientRunnableToolType & {
  run: (
    args: Input,
    context?: BetaToolRunContext,
  ) => Promisable<string | Array<BetaToolResultContentBlockParam>>;
  parse: (content: unknown) => Input;
  /**
   * Optional cleanup hook for tools that hold process-level resources (e.g. a
   * persistent shell). `SessionToolRunner` (`client.beta.sessions.events.toolRunner`)
   * calls it once when iteration ends.
   */
  close?: () => Promisable<void>;
};

/**
 * Resolve the registry key for a tool — the name the model addresses it by.
 * MCP toolsets are keyed on `mcp_server_name`; every other tool on `name`.
 * Shared so the tool-name lookup is identical across `toolRunner()` surfaces.
 */
export function toolName(tool: BetaToolUnion | BetaRunnableTool): string {
  return 'name' in tool ? tool.name : tool.mcp_server_name;
}

/**
 * Format a thrown value into tool-result content: a {@link ToolError} carries
 * its own structured content, anything else becomes an `Error: <message>`
 * string. Shared so every `toolRunner()` surface reports tool failures the
 * same way to the model.
 */
export function toolErrorContent(e: unknown): string | Array<BetaToolResultContentBlockParam> {
  return e instanceof ToolError ? e.content : `Error: ${e instanceof Error ? e.message : String(e)}`;
}

/** Outcome of {@link runRunnableTool}: the content to post back and whether it is an error. */
export interface RunnableToolOutcome {
  content: string | Array<BetaToolResultContentBlockParam>;
  isError: boolean;
}

/**
 * Run a {@link BetaRunnableTool} end-to-end: parse the raw input, invoke `run`,
 * and format any thrown value via {@link toolErrorContent}. Shared so the
 * parse → run → catch → format pipeline is identical across `toolRunner()`
 * surfaces.
 */
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
