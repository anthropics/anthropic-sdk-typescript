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
  BetaToolUseBlock,
} from '../../resources/beta';

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

export type BetaToolRunContext = {
  toolUseBlock: BetaToolUseBlock;
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
};

/**
 * A runnable custom tool (type: 'custom') created by helpers like `betaZodTool`.
 *
 * Unlike the more general {@link BetaRunnableTool}, this type is structurally
 * compatible with `ToolUnion` so it can be passed directly to
 * `client.messages.stream()` and `client.messages.create()` in addition to
 * `client.beta.messages.toolRunner()`.
 *
 * The narrower `input_schema` shape (no `readonly` arrays) is what makes the
 * assignability work under `strictNullChecks` + `exactOptionalPropertyTypes`.
 */
export type BetaRunnableCustomTool<Input = any> = {
  type: 'custom';
  name: string;
  description?: string;
  input_schema: {
    type: 'object';
    properties?: unknown | null;
    required?: string[] | null;
    [k: string]: unknown;
  };
  run: (
    args: Input,
    context?: BetaToolRunContext,
  ) => Promisable<string | Array<BetaToolResultContentBlockParam>>;
  parse: (content: unknown) => Input;
};
