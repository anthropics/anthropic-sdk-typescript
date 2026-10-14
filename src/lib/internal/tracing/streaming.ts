import { SpanStatusCode, type Span } from '@opentelemetry/api';
import type { BaseAnthropic } from '../../../client';
import { AnthropicError } from '../../../core/error';
import { Stream } from '../../../core/streaming';
import type { APIResponseProps } from '../../../internal/parse';
import {
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  endApiCallSpanWhenStreamEnds,
  guardTracing,
  observeStream,
  setErrorStatus,
  type ApiCallSpan,
} from '../../../internal/tracing';
import { loggerFor } from '../../../internal/utils/log';
import { checkNever } from '../../../internal/utils/values';
import { ATTR_GEN_AI_RESPONSE_TIME_TO_FIRST_CHUNK } from './attributes';
import { setMessageContentAttributes } from './content';
import { setResponseAttributes } from './response';
import type {
  AnyMessage,
  AnyStreamEvent,
  MessageCreateBody,
  MessagesCreateSpan,
  RecordedMessage,
  RecordedUsage,
} from './types';

/**
 * In content mode, records `message`, which a stream helper accumulated, as the response content
 * of `call`, under the same size limit as a response that is not streamed.
 */
export function recordStreamedMessageContent(
  client: BaseAnthropic,
  call: ApiCallSpan,
  body: MessageCreateBody,
  message: AnyMessage,
): void {
  if (!call.span.isRecording() || client.openTelemetry.traces.contentMode !== 'content') {
    return;
  }
  try {
    setMessageContentAttributes(call, body, message.content, client.openTelemetry.traces.maxContentBytes);
  } catch (problem) {
    loggerFor(client).debug('could not record the streamed message on its span', problem);
  }
}

/**
 * Ends `span` when the application's read of `stream` ends. Only the stream of `messages.create`
 * has events that the span records.
 */
export function endAnthropicApiCallSpanWhenStreamEnds(
  client: BaseAnthropic,
  span: Span,
  stream: AsyncIterable<unknown>,
  props: APIResponseProps,
): void {
  if (props.options.__span?.name === 'anthropic.messages.create' && stream instanceof Stream) {
    endMessagesCreateSpanWhenStreamEnds(client, span, stream, props);
  } else {
    endApiCallSpanWhenStreamEnds(span, stream, props);
  }
}

/**
 * Ends the span of a `messages.create` API call when the application's read of `stream` ends, with
 * the attributes of the Message that the events reconstruct, as far as it was read. The content is
 * that of a stream helper's Message: the helper records it at `message_stop`
 * (`recordStreamedMessageContent`), and a stream that ends earlier records it here.
 */
function endMessagesCreateSpanWhenStreamEnds(
  client: BaseAnthropic,
  span: Span,
  stream: Stream<AnyStreamEvent>,
  props: APIResponseProps,
): void {
  if (!span.isRecording()) {
    return;
  }
  span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, props.response.status);
  const call: MessagesCreateSpan | undefined = props.options.__span;
  const startTime = call?.startTime;
  let message: RecordedMessage | undefined;
  let usage: RecordedUsage | undefined;
  let sawDelta = false;
  let sawMessageDelta = false;
  let sawStop = false;
  observeStream(stream, props.controller.signal, {
    onItem(event) {
      try {
        switch (event.type) {
          case 'message_start': {
            const { id, model, stop_reason } = event.message;
            message = { id, model, stop_reason };
            usage = { ...event.message.usage };
            break;
          }
          case 'content_block_start':
            // A fallback block names the model that produces the rest of the Message.
            if (message && event.content_block.type === 'fallback') {
              message.model = event.content_block.to.model;
            }
            break;
          case 'message_delta':
            if (message && usage) {
              // Totals for the whole Message, null when they do not apply, so one that is present
              // replaces the earlier value.
              usage.output_tokens = event.usage.output_tokens;
              if (event.usage.input_tokens != null) {
                usage.input_tokens = event.usage.input_tokens;
              }
              if (event.usage.cache_creation_input_tokens != null) {
                usage.cache_creation_input_tokens = event.usage.cache_creation_input_tokens;
              }
              if (event.usage.cache_read_input_tokens != null) {
                usage.cache_read_input_tokens = event.usage.cache_read_input_tokens;
              }
              if (event.usage.output_tokens_details != null) {
                usage.output_tokens_details = event.usage.output_tokens_details;
              }
              if ('iterations' in event.usage && event.usage.iterations != null) {
                usage.iterations = event.usage.iterations;
              }
              if (event.delta.stop_reason != null) {
                message.stop_reason = event.delta.stop_reason;
              }
              sawMessageDelta = true;
            }
            break;
          case 'message_stop':
            sawStop = true;
            break;
          case 'content_block_delta':
            // The first chunk is the first delta, of any type, not an earlier event.
            if (!sawDelta && startTime !== undefined) {
              span.setAttribute(ATTR_GEN_AI_RESPONSE_TIME_TO_FIRST_CHUNK, (Date.now() - startTime) / 1000);
            }
            sawDelta = true;
            break;
          case 'content_block_stop':
            break;
          default:
            checkNever(event);
        }
      } catch (problem) {
        loggerFor(client).debug('could not record the stream on its span', problem);
      }
    },
    onEnd(end) {
      try {
        if (message && usage) {
          // `message_delta` has the stop reason and the final output usage, so a stream cut short
          // after it still has them.
          setResponseAttributes(span, message, usage, sawMessageDelta || sawStop);
        }
      } catch (problem) {
        loggerFor(client).debug('could not record the stream on its span', problem);
      }
      const failure = call?.failure;
      // A helper that failed on an event did not build the Message that the stream sent.
      if (!sawStop && call?.streamed && failure === undefined) {
        recordStreamedMessageContent(client, call, call.streamed.body, call.streamed.message);
      }
      if (end.reason === 'failed') {
        setErrorStatus(span, end.error);
      } else if (failure !== undefined) {
        setErrorStatus(span, failure, 'client_error');
      } else if (end.reason === 'completed') {
        if (sawStop) {
          span.setStatus({ code: SpanStatusCode.OK });
        } else {
          // The application sees the stream end without an error, so only the span fails.
          setErrorStatus(span, new AnthropicError('The stream ended before message_stop.'), 'api_error');
        }
      }
      // Otherwise the application closed the stream before the API did, which leaves the status
      // unset, even after `message_stop`.
      guardTracing(client, () => span.end());
    },
  });
}
