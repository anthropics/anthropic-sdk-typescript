import { AnthropicError } from '../core/error';

/**
 * Shared parse-step runtime used by both parser.ts (stable) and beta-parser.ts.
 *
 * Accepts the resolved format object (already extracted from params by the
 * caller's getOutputFormat) and the accumulated text content. Returns the
 * parsed value, or null when the format is absent or non-parseable.
 *
 * Throws AnthropicError if the format is json_schema but parsing fails —
 * same behaviour that lived in each parser previously.
 */
export function parseAccumulatedFormat(
  format: { type: string; parse?: (content: string) => unknown } | null | undefined,
  content: string,
): unknown | null {
  if (format?.type !== 'json_schema') {
    return null;
  }

  try {
    if ('parse' in (format as object)) {
      return (format as { parse: (c: string) => unknown }).parse(content);
    }
    return JSON.parse(content);
  } catch (error) {
    throw new AnthropicError(`Failed to parse structured output: ${error}`);
  }
}
