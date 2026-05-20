import { Tool, ToolResultBlockParam, ToolUseBlock } from '../../resources/messages';

export type Promisable<T> = T | Promise<T>;

export type ToolRunContext = {
  toolUseBlock: ToolUseBlock;
  signal?: AbortSignal | null | undefined;
};

/**
 * Tool types that can be implemented on the client for the non-beta messages API.
 */
export type ClientRunnableToolType = Tool;

// Extension of Tool with run and parse methods for client-side tool execution
export type RunnableTool<Input = any> = ClientRunnableToolType & {
  run: (
    args: Input,
    context?: ToolRunContext,
  ) => Promisable<string | Array<ToolResultBlockParam>>;
  parse: (content: unknown) => Input;
};
