import type { Attributes, Span } from '@opentelemetry/api';
import type { BaseAnthropic } from '../../../client';
import { APIError } from '../../../core/error';
import { Stream } from '../../../core/streaming';
import { buildHeaders, type NullableHeaders } from '../../../internal/headers';
import type { ApiCallResult, ApiCallSpan, ApiCallSpanSettings } from '../../../internal/tracing';
import { loggerFor } from '../../../internal/utils/log';
import type { BetaMessageTokensCount } from '../../../resources/beta/messages/messages';
import type { BetaManagedAgentsSession } from '../../../resources/beta/sessions/sessions';
import type { MessageTokensCount } from '../../../resources/messages/messages';
import {
  ATTR_ANTHROPIC_BETA,
  ATTR_ANTHROPIC_MESSAGE_COUNT_TOKENS_INPUT_TOKENS,
  ATTR_ANTHROPIC_REQUEST_SERVICE_TIER,
  ATTR_ANTHROPIC_THINKING_BUDGET_TOKENS,
  ATTR_ANTHROPIC_THINKING_TYPE,
  ATTR_GEN_AI_AGENT_NAME,
  ATTR_GEN_AI_OPERATION_NAME,
  ATTR_GEN_AI_OUTPUT_TYPE,
  ATTR_GEN_AI_REQUEST_MAX_TOKENS,
  ATTR_GEN_AI_REQUEST_MODEL,
  ATTR_GEN_AI_REQUEST_REASONING_LEVEL,
  ATTR_GEN_AI_REQUEST_STREAM,
  ATTR_GEN_AI_REQUEST_TEMPERATURE,
  ATTR_GEN_AI_REQUEST_TOP_K,
  ATTR_GEN_AI_REQUEST_TOP_P,
  GEN_AI_OPERATION_NAME_VALUE_CHAT,
  GEN_AI_OUTPUT_TYPE_VALUE_JSON,
  RESPONSE_HEADER_ATTRIBUTES,
} from './attributes';
import { setMessageContentAttributes } from './content';
import { setResponseAttributes } from './response';
import type { AnyMessage, MessageCreateBody } from './types';

/**
 * Sets the IDs in the response headers of `result` on `span`, the call span of any API call.
 * A failure to record, here and below, is logged and never fails the API call.
 */
export function setAnthropicSpanAttributes(client: BaseAnthropic, span: Span, result: ApiCallResult): void {
  if (!span.isRecording()) {
    return;
  }
  try {
    const error = result.status === 'error' ? result.error : undefined;
    const headers = result.response?.headers ?? (error instanceof APIError ? error.headers : undefined);
    for (const [attribute, header] of RESPONSE_HEADER_ATTRIBUTES) {
      const value = headers?.get(header);
      if (value) {
        span.setAttribute(attribute, value);
      }
    }
  } catch (problem) {
    loggerFor(client).debug('could not record the API call on its span', problem);
  }
}

/**
 * The attributes that a `messages.create` span starts with, from the request's `body` and
 * `headers`. A sampler sees only the attributes that a span starts with.
 */
export function messagesCreateSpanSettings(
  client: BaseAnthropic,
  body: MessageCreateBody,
  headers: NullableHeaders,
): ApiCallSpanSettings {
  const attributes: Attributes = {
    [ATTR_GEN_AI_OPERATION_NAME]: GEN_AI_OPERATION_NAME_VALUE_CHAT,
    [ATTR_GEN_AI_REQUEST_MODEL]: body.model,
  };
  try {
    // The client sends its default headers with the method's, which replace those of the same name.
    const betas = (buildHeaders([client._options.defaultHeaders, headers]).values.get('anthropic-beta') ?? '')
      .split(',')
      .map((beta) => beta.trim())
      .filter(Boolean);
    if (betas.length) {
      attributes[ATTR_ANTHROPIC_BETA] = betas;
    }
    attributes[ATTR_GEN_AI_REQUEST_MAX_TOKENS] = body.max_tokens;
    if (body.temperature != null) {
      attributes[ATTR_GEN_AI_REQUEST_TEMPERATURE] = body.temperature;
    }
    if (body.top_p != null) {
      attributes[ATTR_GEN_AI_REQUEST_TOP_P] = body.top_p;
    }
    if (body.top_k != null) {
      attributes[ATTR_GEN_AI_REQUEST_TOP_K] = body.top_k;
    }
    if (body.stream === true) {
      attributes[ATTR_GEN_AI_REQUEST_STREAM] = true;
    }
    // The beta method has already moved a deprecated `output_format` here.
    if (body.output_config?.format?.type === 'json_schema') {
      attributes[ATTR_GEN_AI_OUTPUT_TYPE] = GEN_AI_OUTPUT_TYPE_VALUE_JSON;
    }
    const effort = body.output_config?.effort;
    if (effort != null) {
      attributes[ATTR_GEN_AI_REQUEST_REASONING_LEVEL] = effort;
    }
    if (body.service_tier != null) {
      attributes[ATTR_ANTHROPIC_REQUEST_SERVICE_TIER] = body.service_tier;
    }
    const thinking = body.thinking;
    if (thinking != null) {
      attributes[ATTR_ANTHROPIC_THINKING_TYPE] = thinking.type;
    }
    if (thinking?.type === 'enabled') {
      attributes[ATTR_ANTHROPIC_THINKING_BUDGET_TOKENS] = thinking.budget_tokens;
    }
  } catch (problem) {
    loggerFor(client).debug('could not record the request on its span', problem);
  }
  return { route: '/v1/messages', attributes };
}

/**
 * In content mode, sets the request's content on `call`. The span does not start with it, because
 * the size limit counts it together with the response's content. Returns `call`.
 */
export function recordMessagesCreateRequest(
  client: BaseAnthropic,
  call: ApiCallSpan | undefined,
  body: MessageCreateBody,
): ApiCallSpan | undefined {
  if (!call?.span.isRecording()) {
    return call;
  }
  try {
    const { contentMode, maxContentBytes } = client.openTelemetry.traces;
    if (contentMode === 'content') {
      setMessageContentAttributes(call, body, undefined, maxContentBytes);
    }
  } catch (problem) {
    loggerFor(client).debug('could not record the request on its span', problem);
  }
  return call;
}

/**
 * Sets the response attributes and, in content mode, the response's content on `call`. A streamed
 * response is recorded as the application reads it (`endAnthropicApiCallSpanWhenStreamEnds`).
 */
export function recordMessagesCreateResponse(
  client: BaseAnthropic,
  call: ApiCallSpan | undefined,
  body: MessageCreateBody,
  data: AnyMessage | Stream<unknown>,
): void {
  if (!call?.span.isRecording() || data instanceof Stream) {
    return;
  }
  const span = call.span;
  try {
    setResponseAttributes(span, data, data.usage, true);
    const { contentMode, maxContentBytes } = client.openTelemetry.traces;
    if (contentMode === 'content') {
      setMessageContentAttributes(call, body, data.content, maxContentBytes);
    }
  } catch (problem) {
    loggerFor(client).debug('could not record the response on its span', problem);
  }
}

/** Sets the token count of a `messages.countTokens` response on `call`. */
export function recordCountTokensResponse(
  client: BaseAnthropic,
  call: ApiCallSpan | undefined,
  count: MessageTokensCount | BetaMessageTokensCount,
): void {
  try {
    call?.span.setAttribute(ATTR_ANTHROPIC_MESSAGE_COUNT_TOKENS_INPUT_TOKENS, count.input_tokens);
  } catch (problem) {
    loggerFor(client).debug('could not record the response on its span', problem);
  }
}

/** Sets the Agent's name and model on `call`, as the created `session` resolved them. */
export function recordSessionsCreateResponse(
  client: BaseAnthropic,
  call: ApiCallSpan | undefined,
  session: BetaManagedAgentsSession,
): void {
  try {
    call?.span.setAttributes({
      [ATTR_GEN_AI_AGENT_NAME]: session.agent.name,
      [ATTR_GEN_AI_REQUEST_MODEL]: session.agent.model.id,
    });
  } catch (problem) {
    loggerFor(client).debug('could not record the response on its span', problem);
  }
}
