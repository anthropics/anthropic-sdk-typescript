import type {
  ContentBlock,
  TextBlock,
  ThinkingBlock,
  RedactedThinkingBlock,
  ToolUseBlock,
  ServerToolUseBlock,
  WebSearchToolResultBlock,
  WebFetchToolResultBlock,
  CodeExecutionToolResultBlock,
  BashCodeExecutionToolResultBlock,
  TextEditorCodeExecutionToolResultBlock,
  ToolSearchToolResultBlock,
  ContainerUploadBlock,
} from '../resources/messages/messages';

/**
 * Type guard for {@link TextBlock}.
 *
 * ```ts
 * import { isTextBlock } from '@anthropic-ai/sdk';
 *
 * const message = await client.messages.create({ ... });
 * const textBlocks = message.content.filter(isTextBlock);
 * console.log(textBlocks[0].text);
 * ```
 */
export function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === 'text';
}

/**
 * Type guard for {@link ThinkingBlock}.
 */
export function isThinkingBlock(block: ContentBlock): block is ThinkingBlock {
  return block.type === 'thinking';
}

/**
 * Type guard for {@link RedactedThinkingBlock}.
 */
export function isRedactedThinkingBlock(block: ContentBlock): block is RedactedThinkingBlock {
  return block.type === 'redacted_thinking';
}

/**
 * Type guard for {@link ToolUseBlock}.
 */
export function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === 'tool_use';
}

/**
 * Type guard for {@link ServerToolUseBlock}.
 */
export function isServerToolUseBlock(block: ContentBlock): block is ServerToolUseBlock {
  return block.type === 'server_tool_use';
}

/**
 * Type guard for {@link WebSearchToolResultBlock}.
 */
export function isWebSearchToolResultBlock(block: ContentBlock): block is WebSearchToolResultBlock {
  return block.type === 'web_search_tool_result';
}

/**
 * Type guard for {@link WebFetchToolResultBlock}.
 */
export function isWebFetchToolResultBlock(block: ContentBlock): block is WebFetchToolResultBlock {
  return block.type === 'web_fetch_tool_result';
}

/**
 * Type guard for {@link CodeExecutionToolResultBlock}.
 */
export function isCodeExecutionToolResultBlock(block: ContentBlock): block is CodeExecutionToolResultBlock {
  return block.type === 'code_execution_tool_result';
}

/**
 * Type guard for {@link BashCodeExecutionToolResultBlock}.
 */
export function isBashCodeExecutionToolResultBlock(
  block: ContentBlock,
): block is BashCodeExecutionToolResultBlock {
  return block.type === 'bash_code_execution_tool_result';
}

/**
 * Type guard for {@link TextEditorCodeExecutionToolResultBlock}.
 */
export function isTextEditorCodeExecutionToolResultBlock(
  block: ContentBlock,
): block is TextEditorCodeExecutionToolResultBlock {
  return block.type === 'text_editor_code_execution_tool_result';
}

/**
 * Type guard for {@link ToolSearchToolResultBlock}.
 */
export function isToolSearchToolResultBlock(block: ContentBlock): block is ToolSearchToolResultBlock {
  return block.type === 'tool_search_tool_result';
}

/**
 * Type guard for {@link ContainerUploadBlock}.
 */
export function isContainerUploadBlock(block: ContentBlock): block is ContainerUploadBlock {
  return block.type === 'container_upload';
}
