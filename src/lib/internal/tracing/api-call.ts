import type { Attributes } from '@opentelemetry/api';
import type { BaseAnthropic } from '../../../client';
import { Stream } from '../../../core/streaming';
import type { RequestOptions } from '../../../internal/request-options';
import { guardTracing, type ApiCallSpan, type ApiCallSpanSettings } from '../../../internal/tracing';
import { loggerFor } from '../../../internal/utils/log';
import { isObj } from '../../../internal/utils/values';
import { ATTR_GEN_AI_AGENT_ID, ATTR_GEN_AI_OUTPUT_TYPE, GEN_AI_OUTPUT_TYPE_VALUE_JSON } from './attributes';
import { setMessageContentAttributes } from './content';
import { setUsageSumAttributes } from './response';
import type { AnyMessage, MessageCreateBody } from './types';

/**
 * What a `messages.create` span starts with from `request`, the options of its request.
 * `startApiCallSpan` reads the attributes that one field of the body or one header gives. A sampler
 * sees only the attributes that a span starts with.
 */
export function messagesCreateSpanSettings(
  client: BaseAnthropic,
  request: RequestOptions,
): ApiCallSpanSettings {
  // This runs in the method, outside the guard of `startApiCallSpan`.
  const attributes = guardTracing(client, (): Attributes => {
    // The beta method has already moved a deprecated `output_format` here.
    const outputConfig = isObj(request.body) ? request.body['output_config'] : undefined;
    const format = isObj(outputConfig) ? outputConfig['format'] : undefined;
    return isObj(format) && format['type'] === 'json_schema' ?
        { [ATTR_GEN_AI_OUTPUT_TYPE]: GEN_AI_OUTPUT_TYPE_VALUE_JSON }
      : {};
  });
  return { route: '/v1/messages', request, attributes };
}

/**
 * The ID of the Agent that `body`, the body of a `sessions.create` request, names: the request
 * gives it as a string or in an object. An `agent` that is neither is for the API to refuse.
 */
export function sessionsCreateSpanAttributes(body: unknown): Attributes | undefined {
  // This runs in the method, outside the guard of `startApiCallSpan`.
  return guardTracing(undefined, () => {
    const agent = isObj(body) ? body['agent'] : undefined;
    const id = isObj(agent) ? agent['id'] : agent;
    return typeof id === 'string' ? { [ATTR_GEN_AI_AGENT_ID]: id } : {};
  });
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
 * Sets the sums over the response's usage and, in content mode, the response's content on `call`.
 * A streamed response is recorded as the application reads it
 * (`endAnthropicApiCallSpanWhenStreamEnds`).
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
  try {
    setUsageSumAttributes(call.span, data.usage, true);
    const { contentMode, maxContentBytes } = client.openTelemetry.traces;
    if (contentMode === 'content') {
      setMessageContentAttributes(call, body, data.content, maxContentBytes);
    }
  } catch (problem) {
    loggerFor(client).debug('could not record the response on its span', problem);
  }
}
