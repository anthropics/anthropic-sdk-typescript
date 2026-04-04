import {
  isTextBlock,
  isThinkingBlock,
  isRedactedThinkingBlock,
  isToolUseBlock,
  isServerToolUseBlock,
  isWebSearchToolResultBlock,
  isWebFetchToolResultBlock,
  isCodeExecutionToolResultBlock,
  isBashCodeExecutionToolResultBlock,
  isTextEditorCodeExecutionToolResultBlock,
  isToolSearchToolResultBlock,
  isContainerUploadBlock,
} from '../../src/lib/content-block-type-guards';
import type { ContentBlock } from '../../src/resources/messages';

/**
 * Compile-time exhaustiveness check: every ContentBlock variant must have a
 * corresponding type guard. If a new variant is added to the ContentBlock union
 * and no guard is written for it, this type will resolve to the unhandled
 * variant(s) and the `never` assertion below will fail to compile.
 */
type GuardedBlock =
  | (ContentBlock & { type: 'text' })
  | (ContentBlock & { type: 'thinking' })
  | (ContentBlock & { type: 'redacted_thinking' })
  | (ContentBlock & { type: 'tool_use' })
  | (ContentBlock & { type: 'server_tool_use' })
  | (ContentBlock & { type: 'web_search_tool_result' })
  | (ContentBlock & { type: 'web_fetch_tool_result' })
  | (ContentBlock & { type: 'code_execution_tool_result' })
  | (ContentBlock & { type: 'bash_code_execution_tool_result' })
  | (ContentBlock & { type: 'text_editor_code_execution_tool_result' })
  | (ContentBlock & { type: 'tool_search_tool_result' })
  | (ContentBlock & { type: 'container_upload' });

// If ContentBlock gains a new variant, Unguarded will be that variant instead of never.
type Unguarded = Exclude<ContentBlock, GuardedBlock>;
const _exhaustive: [Unguarded] extends [never] ? true : false = true;
void _exhaustive;

describe('ContentBlock type guards', () => {
  const textBlock: ContentBlock = {
    type: 'text',
    text: 'hello',
    citations: null,
  };

  const toolUseBlock: ContentBlock = {
    type: 'tool_use',
    id: 'toolu_123',
    name: 'get_weather',
    input: { city: 'London' },
    caller: { type: 'direct' },
  };

  const thinkingBlock: ContentBlock = {
    type: 'thinking',
    thinking: 'Let me think...',
    signature: 'sig_abc',
  };

  describe('isTextBlock', () => {
    it('returns true for text blocks', () => {
      expect(isTextBlock(textBlock)).toBe(true);
    });

    it('returns false for non-text blocks', () => {
      expect(isTextBlock(toolUseBlock)).toBe(false);
      expect(isTextBlock(thinkingBlock)).toBe(false);
    });

    it('narrows the type correctly', () => {
      if (isTextBlock(textBlock)) {
        const _text: string = textBlock.text;
        expect(_text).toBe('hello');
      }
    });
  });

  describe('isToolUseBlock', () => {
    it('returns true for tool_use blocks', () => {
      expect(isToolUseBlock(toolUseBlock)).toBe(true);
    });

    it('returns false for non-tool_use blocks', () => {
      expect(isToolUseBlock(textBlock)).toBe(false);
    });

    it('narrows the type correctly', () => {
      if (isToolUseBlock(toolUseBlock)) {
        const _name: string = toolUseBlock.name;
        expect(_name).toBe('get_weather');
      }
    });
  });

  describe('isThinkingBlock', () => {
    it('returns true for thinking blocks', () => {
      expect(isThinkingBlock(thinkingBlock)).toBe(true);
    });

    it('returns false for non-thinking blocks', () => {
      expect(isThinkingBlock(textBlock)).toBe(false);
    });
  });

  describe('isRedactedThinkingBlock', () => {
    it('identifies redacted_thinking blocks', () => {
      const block: ContentBlock = { type: 'redacted_thinking', data: 'redacted' };
      expect(isRedactedThinkingBlock(block)).toBe(true);
      expect(isRedactedThinkingBlock(textBlock)).toBe(false);
    });
  });

  describe('isServerToolUseBlock', () => {
    it('identifies server_tool_use blocks', () => {
      const block: ContentBlock = {
        type: 'server_tool_use',
        id: 'srvtoolu_123',
        name: 'web_search',
        input: {},
        caller: { type: 'direct' },
      };
      expect(isServerToolUseBlock(block)).toBe(true);
      expect(isServerToolUseBlock(textBlock)).toBe(false);
    });
  });

  describe('isWebSearchToolResultBlock', () => {
    it('identifies web_search_tool_result blocks', () => {
      const block: ContentBlock = {
        type: 'web_search_tool_result',
        tool_use_id: 'srvtoolu_123',
        content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' },
        caller: { type: 'direct' },
      };
      expect(isWebSearchToolResultBlock(block)).toBe(true);
      expect(isWebSearchToolResultBlock(textBlock)).toBe(false);
    });
  });

  describe('isWebFetchToolResultBlock', () => {
    it('identifies web_fetch_tool_result blocks', () => {
      const block: ContentBlock = {
        type: 'web_fetch_tool_result',
        tool_use_id: 'srvtoolu_123',
        content: { type: 'web_fetch_tool_result_error', error_code: 'too_many_requests' },
        caller: { type: 'direct' },
      };
      expect(isWebFetchToolResultBlock(block)).toBe(true);
      expect(isWebFetchToolResultBlock(textBlock)).toBe(false);
    });
  });

  describe('isCodeExecutionToolResultBlock', () => {
    it('identifies code_execution_tool_result blocks', () => {
      const block: ContentBlock = {
        type: 'code_execution_tool_result',
        tool_use_id: 'srvtoolu_123',
        content: { type: 'code_execution_tool_result_error', error_code: 'unavailable' },
      };
      expect(isCodeExecutionToolResultBlock(block)).toBe(true);
      expect(isCodeExecutionToolResultBlock(textBlock)).toBe(false);
    });
  });

  describe('isBashCodeExecutionToolResultBlock', () => {
    it('identifies bash_code_execution_tool_result blocks', () => {
      const block: ContentBlock = {
        type: 'bash_code_execution_tool_result',
        tool_use_id: 'srvtoolu_123',
        content: { type: 'bash_code_execution_tool_result_error', error_code: 'unavailable' },
      };
      expect(isBashCodeExecutionToolResultBlock(block)).toBe(true);
      expect(isBashCodeExecutionToolResultBlock(textBlock)).toBe(false);
    });
  });

  describe('isTextEditorCodeExecutionToolResultBlock', () => {
    it('identifies text_editor_code_execution_tool_result blocks', () => {
      const block: ContentBlock = {
        type: 'text_editor_code_execution_tool_result',
        tool_use_id: 'srvtoolu_123',
        content: {
          type: 'text_editor_code_execution_tool_result_error',
          error_code: 'unavailable',
          error_message: null,
        },
      };
      expect(isTextEditorCodeExecutionToolResultBlock(block)).toBe(true);
      expect(isTextEditorCodeExecutionToolResultBlock(textBlock)).toBe(false);
    });
  });

  describe('isToolSearchToolResultBlock', () => {
    it('identifies tool_search_tool_result blocks', () => {
      const block: ContentBlock = {
        type: 'tool_search_tool_result',
        tool_use_id: 'srvtoolu_123',
        content: {
          type: 'tool_search_tool_result_error',
          error_code: 'invalid_tool_input',
          error_message: null,
        },
      };
      expect(isToolSearchToolResultBlock(block)).toBe(true);
      expect(isToolSearchToolResultBlock(textBlock)).toBe(false);
    });
  });

  describe('isContainerUploadBlock', () => {
    it('identifies container_upload blocks', () => {
      const block: ContentBlock = {
        type: 'container_upload',
        file_id: 'file_123',
      };
      expect(isContainerUploadBlock(block)).toBe(true);
      expect(isContainerUploadBlock(textBlock)).toBe(false);
    });
  });

  describe('works with Array.filter', () => {
    it('filters and narrows an array of content blocks', () => {
      const blocks: ContentBlock[] = [textBlock, toolUseBlock, thinkingBlock];
      const textBlocks = blocks.filter(isTextBlock);

      expect(textBlocks).toHaveLength(1);
      // Type is narrowed to TextBlock[]
      const _text: string = textBlocks[0]!.text;
      expect(_text).toBe('hello');
    });
  });
});
