import type { Span } from '@opentelemetry/api';
import {
  ATTR_ANTHROPIC_MESSAGE_STOP_REASON,
  ATTR_ANTHROPIC_RESPONSE_SERVICE_TIER,
  ATTR_ANTHROPIC_USAGE_CACHE_CREATION_EPHEMERAL_1H_INPUT_TOKENS,
  ATTR_ANTHROPIC_USAGE_CACHE_CREATION_EPHEMERAL_5M_INPUT_TOKENS,
  ATTR_ANTHROPIC_USAGE_COMPACTION_INPUT_TOKENS,
  ATTR_ANTHROPIC_USAGE_COMPACTION_OUTPUT_TOKENS,
  ATTR_GEN_AI_RESPONSE_ID,
  ATTR_GEN_AI_RESPONSE_MODEL,
  ATTR_GEN_AI_USAGE_CACHE_WRITE_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
  ATTR_GEN_AI_USAGE_REASONING_OUTPUT_TOKENS,
} from './attributes';
import type { RecordedMessage, RecordedUsage } from './types';

/**
 * Sets the attributes that come from a Message. The stop reason and the output usage are final
 * only from the `message_delta` of a streamed Message on, and are set only when `complete` is true.
 */
export function setResponseAttributes(
  span: Span,
  message: RecordedMessage,
  usage: RecordedUsage,
  complete: boolean,
): void {
  span.setAttribute(ATTR_GEN_AI_RESPONSE_ID, message.id);
  span.setAttribute(ATTR_GEN_AI_RESPONSE_MODEL, message.model);
  span.setAttribute(
    ATTR_GEN_AI_USAGE_INPUT_TOKENS,
    usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
  );
  if (usage.cache_creation_input_tokens != null) {
    span.setAttribute(ATTR_GEN_AI_USAGE_CACHE_WRITE_INPUT_TOKENS, usage.cache_creation_input_tokens);
  }
  if (usage.cache_read_input_tokens != null) {
    span.setAttribute(ATTR_GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS, usage.cache_read_input_tokens);
  }
  const written = usage.cache_creation;
  if (written != null) {
    span.setAttribute(
      ATTR_ANTHROPIC_USAGE_CACHE_CREATION_EPHEMERAL_5M_INPUT_TOKENS,
      written.ephemeral_5m_input_tokens,
    );
    span.setAttribute(
      ATTR_ANTHROPIC_USAGE_CACHE_CREATION_EPHEMERAL_1H_INPUT_TOKENS,
      written.ephemeral_1h_input_tokens,
    );
  }
  if (usage.service_tier != null) {
    span.setAttribute(ATTR_ANTHROPIC_RESPONSE_SERVICE_TIER, usage.service_tier);
  }
  if (!complete) {
    return;
  }
  span.setAttribute(ATTR_GEN_AI_USAGE_OUTPUT_TOKENS, usage.output_tokens);
  const details = usage.output_tokens_details;
  if (details != null) {
    span.setAttribute(ATTR_GEN_AI_USAGE_REASONING_OUTPUT_TOKENS, details.thinking_tokens);
  }
  // The usage above leaves out what the compactions used, which only the iterations have.
  const compactions = usage.iterations?.filter((each) => each.type === 'compaction') ?? [];
  if (compactions.length > 0) {
    span.setAttribute(
      ATTR_ANTHROPIC_USAGE_COMPACTION_INPUT_TOKENS,
      compactions.reduce(
        (sum, each) =>
          sum + each.input_tokens + each.cache_read_input_tokens + each.cache_creation_input_tokens,
        0,
      ),
    );
    span.setAttribute(
      ATTR_ANTHROPIC_USAGE_COMPACTION_OUTPUT_TOKENS,
      compactions.reduce((sum, each) => sum + each.output_tokens, 0),
    );
  }
  if (message.stop_reason != null) {
    span.setAttribute(ATTR_ANTHROPIC_MESSAGE_STOP_REASON, message.stop_reason);
  }
}
