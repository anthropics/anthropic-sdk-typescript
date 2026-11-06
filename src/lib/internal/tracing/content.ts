import type { Span } from '@opentelemetry/api';
import type { ApiCallSpan } from '../../../internal/tracing';
import {
  ATTR_ANTHROPIC_CONTENT_TRUNCATED,
  ATTR_ANTHROPIC_TOOL_RESULT_CONTENT,
  ATTR_GEN_AI_INPUT_MESSAGES,
  ATTR_GEN_AI_OUTPUT_MESSAGES,
  ATTR_GEN_AI_REQUEST_STOP_SEQUENCES,
  ATTR_GEN_AI_SYSTEM_INSTRUCTIONS,
} from './attributes';
import type {
  AnyContentBlock,
  AnyResultBlockContent,
  AnyToolResultContent,
  MessageCreateBody,
} from './types';

/**
 * Sets the content attributes of a `messages.create` API call, within `limit` bytes: first
 * with the request alone, and again with `output`, the response's content blocks. The second call
 * sets only the output when that fits beside the request's content, and otherwise sets everything
 * again to remove more of it.
 */
export function setMessageContentAttributes(
  call: ApiCallSpan,
  body: MessageCreateBody,
  output: ReadonlyArray<AnyContentBlock> | undefined,
  limit: number,
): void {
  const span = call.span;
  const requestSize = call.requestContentSize;
  if (output !== undefined && requestSize !== undefined) {
    const outputMessages = JSON.stringify([{ role: 'assistant', parts: contentParts(output) }]);
    if (
      requestSize + 3 * outputMessages.length <= limit ||
      requestSize + utf8Length(outputMessages) <= limit
    ) {
      span.setAttribute(ATTR_GEN_AI_OUTPUT_MESSAGES, outputMessages);
      return;
    }
  }
  const size = setContentAttributes(
    span,
    {
      // An empty list sets no attribute.
      [ATTR_GEN_AI_REQUEST_STOP_SEQUENCES]:
        body.stop_sequences?.length ? [...body.stop_sequences] : undefined,
      [ATTR_GEN_AI_SYSTEM_INSTRUCTIONS]: body.system === undefined ? undefined : contentParts(body.system),
      [ATTR_GEN_AI_INPUT_MESSAGES]: body.messages.map(
        (message): ContentMessage => ({ role: message.role, parts: contentParts(message.content) }),
      ),
      [ATTR_GEN_AI_OUTPUT_MESSAGES]:
        output === undefined ? undefined : [{ role: 'assistant', parts: contentParts(output) }],
    },
    limit,
  );
  if (output === undefined) {
    call.requestContentSize = size;
  }
}

function contentParts(content: string | ReadonlyArray<AnyContentBlock> | undefined): ContentPart[] {
  if (typeof content === 'string') {
    return [{ type: 'text', content }];
  }
  return content?.map(blockPart) ?? [];
}

/**
 * The part of a content block. A block that the conventions have no part for is a part with only
 * a type: image and document data is large and binary, and redacted thinking is encrypted.
 */
function blockPart(block: AnyContentBlock): ContentPart {
  switch (block.type) {
    case 'text':
      return { type: 'text', content: block.text };
    case 'thinking':
      return { type: 'reasoning', content: block.thinking };
    case 'tool_use':
      return {
        type: 'tool_call',
        id: block.id,
        name: block.name,
        arguments: block.input,
        // Only a call to a member of a toolset, such as `computer`, has one.
        ...(typeof block.toolset_name === 'string' ?
          { anthropic_toolset_name: block.toolset_name }
        : undefined),
      };
    case 'server_tool_use':
      return { type: 'tool_call', id: block.id, name: block.name, arguments: block.input };
    case 'mcp_tool_use':
      return {
        type: 'tool_call',
        id: block.id,
        name: block.name,
        arguments: block.input,
        anthropic_mcp_server_name: block.server_name,
      };
    case 'tool_result':
      return {
        type: 'tool_call_response',
        id: block.tool_use_id,
        response: toolResultContentBlocks(block.content),
      };
    default:
      if (typeof block.type !== 'string') {
        return { type: 'anthropic_unknown' };
      }
      if (block.type.endsWith('_tool_result') && 'tool_use_id' in block) {
        return {
          type: 'tool_call_response',
          id: block.tool_use_id,
          response: resultBlockContent(block.content),
        };
      }
      return { type: `anthropic_${block.type}` };
  }
}

/**
 * The content blocks of a tool result, always as a list: a result with no content has none. A text
 * block and a search result block keep their fields ({@link withoutLeftOutFields}), and any other
 * block has only its type.
 */
export function toolResultContentBlocks(content: AnyToolResultContent) {
  // A tool written in JavaScript can return `null`, which the runner sends as it is.
  if (content === undefined || content === null) {
    return [];
  }
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }
  return content.map((block) => {
    if (block.type === 'text' || block.type === 'search_result') {
      return withoutLeftOutFields(block);
    }
    if (typeof block.type !== 'string') {
      return { type: 'unknown' };
    }
    return { type: block.type };
  });
}

/**
 * What a span holds of the content of a server tool's or an MCP tool's result block, which is a
 * string, a list of blocks, or one object such as a code execution result or an error: always a
 * list, which holds that one object alone.
 */
function resultBlockContent(content: AnyResultBlockContent): unknown {
  if (content === undefined || content === null) {
    return [];
  }
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }
  if (!Array.isArray(content)) {
    return [withoutLeftOutFields(content)];
  }
  return content.map((block) => {
    if (block.type === 'text' || block.type === 'search_result' || block.type === 'web_search_result') {
      return withoutLeftOutFields(block);
    }
    if (typeof block.type !== 'string') {
      return { type: 'unknown' };
    }
    return { type: block.type };
  });
}

/**
 * `value` without, at any depth, the fields whose name starts with `encrypted_`, which are opaque,
 * and without image and document data, which is large and binary.
 */
function withoutLeftOutFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutLeftOutFields);
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  const { type, file_type } = value as { type?: unknown; file_type?: unknown };
  if (type === 'image' || type === 'document') {
    return { type };
  }
  const isImageOrDocumentView =
    type === 'text_editor_code_execution_view_result' && (file_type === 'image' || file_type === 'pdf');
  // `Object.fromEntries` defines each field, so one named `__proto__` is kept like any other.
  return Object.fromEntries(
    Object.entries(value)
      .filter(([name]) => !name.startsWith('encrypted_') && !(name === 'content' && isImageOrDocumentView))
      .map(([name, field]) => [name, withoutLeftOutFields(field)]),
  );
}

/** A message of the generative-AI conventions. */
interface ContentMessage {
  role: string;
  parts: ContentPart[];
}

/** A part of a message's content in the generative-AI conventions. */
type ContentPart = { type: unknown; [field: string]: unknown };

/** The content attributes that hold message parts, which {@link setContentAttributes} reduces. */
interface MessageContentAttributes {
  [ATTR_GEN_AI_SYSTEM_INSTRUCTIONS]?: ContentPart[] | undefined;
  [ATTR_GEN_AI_INPUT_MESSAGES]?: ContentMessage[] | undefined;
  [ATTR_GEN_AI_OUTPUT_MESSAGES]?: ContentMessage[] | undefined;
}

/**
 * `gen_ai.request.stop_sequences` and `anthropic.tool_result.content` are named because
 * {@link setContentAttributes} treats each in its own way. An attribute with another name, such as
 * `gen_ai.tool.call.arguments`, is whole or absent.
 */
interface ContentAttributes extends MessageContentAttributes {
  [ATTR_GEN_AI_REQUEST_STOP_SEQUENCES]?: string[] | undefined;
  [ATTR_ANTHROPIC_TOOL_RESULT_CONTENT]?: unknown[] | undefined;
  [name: string]: unknown;
}

/**
 * Sets the content attributes of `span` within `limit` bytes of UTF-8.
 * `gen_ai.request.stop_sequences` alone is not JSON: the conventions type it as an array of
 * strings, which every backend takes, and its size is that of its strings. Each other attribute is
 * one JSON string.
 *
 * A UTF-16 code unit takes at most three bytes, so content whose `length` is at most a third of
 * the limit fits, as most does, and is not measured. Other content is measured in bytes
 * ({@link utf8Length}).
 *
 * First, the stop sequences, and an attribute that {@link ContentAttributes} does not name, are
 * left out whole when they alone are over the limit. Then message parts are removed to fit
 * ({@link withoutFirstParts}), and on a tool span the last blocks of the tool result
 * ({@link truncateToolResultContent}). A span that lost any of these gets
 * `anthropic.content.truncated`. Only what stays after that can leave a span over the limit: an
 * emptied list, a message without parts, and the last text part, cut from its end.
 *
 * Returns the size of what it set, or more than that when it did not measure.
 */
export function setContentAttributes(span: Span, attributes: ContentAttributes, limit: number): number {
  const {
    [ATTR_GEN_AI_REQUEST_STOP_SEQUENCES]: stopSequences,
    [ATTR_GEN_AI_SYSTEM_INSTRUCTIONS]: instructions,
    [ATTR_GEN_AI_INPUT_MESSAGES]: input,
    [ATTR_GEN_AI_OUTPUT_MESSAGES]: output,
    [ATTR_ANTHROPIC_TOOL_RESULT_CONTENT]: toolResult,
    ...others
  } = attributes;
  const messages: MessageContentAttributes = {
    [ATTR_GEN_AI_SYSTEM_INSTRUCTIONS]: instructions,
    [ATTR_GEN_AI_INPUT_MESSAGES]: input,
    [ATTR_GEN_AI_OUTPUT_MESSAGES]: output,
  };
  const values: Record<string, string> = {};
  const blocks = toolResult?.map((block) => JSON.stringify(block));
  // The 1 more for each string and the 2 are the commas and the brackets of the tool result.
  const length =
    [...(stopSequences ?? []), ...(blocks ?? [])].reduce((sum, text) => sum + text.length + 1, 2) +
    serialize(others, values) +
    serialize(messages, values);
  const sizeOf = 3 * length <= limit ? (text: string) => 3 * text.length : utf8Length;
  const sizeOfMessages = () => Object.keys(messages).reduce((sum, key) => sum + sizeOf(values[key] ?? ''), 0);

  const stopSequencesSize = stopSequences?.reduce((sum, each) => sum + sizeOf(each), 0) ?? 0;
  const keepsStopSequences = stopSequences !== undefined && stopSequencesSize <= limit;
  let size = keepsStopSequences ? stopSequencesSize : 0;
  let truncated = stopSequences !== undefined && !keepsStopSequences;
  for (const key of Object.keys(others)) {
    const jsonSize = sizeOf(values[key] ?? '');
    if (jsonSize > limit) {
      delete values[key];
      truncated = true;
    } else {
      size += jsonSize;
    }
  }
  let messagesSize = sizeOfMessages();
  if (size + messagesSize > limit) {
    const { truncated: lostParts, ...fitted } = withoutFirstParts(messages, size + messagesSize - limit);
    truncated ||= lostParts;
    serialize(fitted, values);
    messagesSize = sizeOfMessages();
  }
  size += messagesSize;
  if (blocks !== undefined) {
    const kept = truncateToolResultContent(blocks, limit - size, sizeOf);
    values[ATTR_ANTHROPIC_TOOL_RESULT_CONTENT] = kept.json;
    size += kept.size;
    truncated ||= kept.truncated;
  }
  if (truncated) {
    span.setAttribute(ATTR_ANTHROPIC_CONTENT_TRUNCATED, true);
  }
  if (keepsStopSequences) {
    span.setAttribute(ATTR_GEN_AI_REQUEST_STOP_SEQUENCES, stopSequences);
  }
  for (const [key, value] of Object.entries(values)) {
    span.setAttribute(key, value);
  }
  return size;
}

/** Puts the JSON of each defined attribute in `values`, and returns the `length` of what it put there. */
function serialize(attributes: object, values: Record<string, string>): number {
  let length = 0;
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) {
      values[key] = JSON.stringify(value);
      length += values[key].length;
    }
  }
  return length;
}

/**
 * `attributes` with `excess` bytes less of JSON. The parts of the system instructions, the
 * input messages and the output messages are one list, which loses whole parts from its start. The
 * last part left, when it is a text part, keeps the start of its `content` that fits.
 */
function withoutFirstParts(
  attributes: MessageContentAttributes,
  excess: number,
): MessageContentAttributes & { truncated: boolean } {
  const withOwnParts = (messages: ContentMessage[] | undefined) =>
    messages?.map((message) => ({ ...message, parts: [...message.parts] }));
  const instructions = attributes[ATTR_GEN_AI_SYSTEM_INSTRUCTIONS]?.slice();
  const input = withOwnParts(attributes[ATTR_GEN_AI_INPUT_MESSAGES]);
  const output = withOwnParts(attributes[ATTR_GEN_AI_OUTPUT_MESSAGES]);
  const lists = [instructions ?? [], ...[...(input ?? []), ...(output ?? [])].map(({ parts }) => parts)];
  let left = lists.reduce((sum, parts) => sum + parts.length, 0);
  let truncated = false;
  for (const parts of lists) {
    let removed = 0;
    while (excess > 0 && removed < parts.length) {
      const part = parts[removed]!;
      const size = utf8Length(JSON.stringify(part));
      const content = part['content'];
      if (left === 1 && part.type === 'text' && typeof content === 'string') {
        const kept = startThatFits(part, content, size - excess);
        if (kept !== content) {
          parts[removed] = { ...part, content: kept };
          truncated = true;
        }
        break;
      }
      // A part that has one after it loses the comma between them too.
      excess -= size + (removed + 1 < parts.length ? 1 : 0);
      removed++;
      left--;
      truncated = true;
    }
    parts.splice(0, removed);
  }
  return {
    [ATTR_GEN_AI_SYSTEM_INSTRUCTIONS]: instructions,
    [ATTR_GEN_AI_INPUT_MESSAGES]: input,
    [ATTR_GEN_AI_OUTPUT_MESSAGES]: output,
    truncated,
  };
}

/**
 * The longest start of `content` with which the JSON of the text part `part` fits in `limit`
 * bytes. It never ends between the two halves of a surrogate pair.
 */
function startThatFits(part: ContentPart, content: string, limit: number): string {
  const room = limit - utf8Length(JSON.stringify({ ...part, content: '' }));
  // A character takes at least one byte of the JSON, so those that fit are among the first `room`.
  // In their JSON each is itself, or an escape sequence, which starts with a backslash and is
  // ASCII. A surrogate pair is one character, and itself: the JSON escapes only a half of one.
  const head = content.slice(0, Math.max(room, 0));
  const escaped = JSON.stringify(head);
  let length = 0;
  let escapedLength = 0;
  let size = 0;
  while (length < head.length) {
    const point = escaped.codePointAt(1 + escapedLength)!;
    const units = point > 0xffff ? 2 : 1;
    const escapedUnits =
      point !== 0x5c ? units
      : escaped[2 + escapedLength] === 'u' ? 6
      : 2;
    size +=
      point < 0x80 ? escapedUnits
      : point < 0x800 ? 2
      : point < 0x10000 ? 3
      : 4;
    if (size > room) {
      break;
    }
    escapedLength += escapedUnits;
    length += units;
  }
  return content.slice(0, length);
}

/**
 * The JSON of the first of `blocks`, each the JSON of a content block of a tool result, that fit
 * in `limit` bytes, the size of that JSON as `sizeOf` measures it, and whether it is not all of them.
 */
function truncateToolResultContent(
  blocks: string[],
  limit: number,
  sizeOf: (text: string) => number,
): { json: string; size: number; truncated: boolean } {
  const kept: string[] = [];
  // The JSON of an array is its brackets, its elements, and a comma between each two.
  let size = 2;
  for (const block of blocks) {
    const next = size + (kept.length === 0 ? 0 : 1) + sizeOf(block);
    if (next > limit) {
      break;
    }
    kept.push(block);
    size = next;
  }
  return { json: '[' + kept.join(',') + ']', size, truncated: kept.length < blocks.length };
}

/** The size of `text` in UTF-8, in bytes. It makes no copy of the text to measure it. */
function utf8Length(text: string): number {
  let size = 0;
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) {
      size += 1;
    } else if (unit < 0x800) {
      size += 2;
    } else if (unit >= 0xd800 && unit < 0xdc00 && (text.charCodeAt(index + 1) & 0xfc00) === 0xdc00) {
      // The two halves of a surrogate pair are one character of four bytes.
      size += 4;
      index++;
    } else {
      size += 3;
    }
  }
  return size;
}
