import type { Span } from '@opentelemetry/api';
import { isObj } from '../../../internal/utils/values';
import {
  ATTR_ANTHROPIC_USAGE_COMPACTION_INPUT_TOKENS,
  ATTR_ANTHROPIC_USAGE_COMPACTION_OUTPUT_TOKENS,
  ATTR_GEN_AI_USAGE_INPUT_TOKENS,
} from './attributes';

/**
 * Sets the attributes that are sums over `usage`, the usage of a Message as the API sent it.
 * `setResponseAttributes` sets the attributes that one field gives. The compactions' tokens are final
 * only from the `message_delta` of a streamed Message on, and are set only when `complete` is true.
 */
export function setUsageSumAttributes(span: Span, usage: unknown, complete: boolean): void {
  if (!isObj(usage)) {
    return;
  }
  if (typeof usage['input_tokens'] === 'number') {
    span.setAttribute(ATTR_GEN_AI_USAGE_INPUT_TOKENS, inputTokens(usage));
  }
  if (!complete) {
    return;
  }
  // The usage above leaves out what the compactions used, which only the iterations have.
  const iterations = Array.isArray(usage['iterations']) ? usage['iterations'] : [];
  const compactions = iterations.filter(
    (each): each is Record<string, unknown> => isObj(each) && each['type'] === 'compaction',
  );
  if (compactions.length > 0) {
    span.setAttribute(
      ATTR_ANTHROPIC_USAGE_COMPACTION_INPUT_TOKENS,
      compactions.reduce((sum, each) => sum + inputTokens(each), 0),
    );
    span.setAttribute(
      ATTR_ANTHROPIC_USAGE_COMPACTION_OUTPUT_TOKENS,
      compactions.reduce((sum, each) => sum + count(each, 'output_tokens'), 0),
    );
  }
}

/** The token counts of a usage, or of one of its iterations, that add up to its input tokens. */
export const INPUT_TOKEN_COUNTS = [
  'input_tokens',
  'cache_read_input_tokens',
  'cache_creation_input_tokens',
] as const;

function inputTokens(usage: Record<string, unknown>): number {
  return INPUT_TOKEN_COUNTS.reduce((sum, name) => sum + count(usage, name), 0);
}

/** The token count `name` of `usage`, or 0 when it has none. */
function count(usage: Record<string, unknown>, name: string): number {
  const value = usage[name];
  return typeof value === 'number' ? value : 0;
}
