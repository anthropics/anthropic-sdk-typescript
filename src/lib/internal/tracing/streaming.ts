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
  setResponseAttributes,
  setResponseHeaderAttributes,
  SPAN_ATTRIBUTES,
  type ApiCallSpan,
} from '../../../internal/tracing';
import { loggerFor } from '../../../internal/utils/log';
import { checkNever, isObj } from '../../../internal/utils/values';
import { ATTR_GEN_AI_RESPONSE_TIME_TO_FIRST_CHUNK } from './attributes';
import { setMessageContentAttributes } from './content';
import { setUsageSumAttributes } from './response';
import type { AnyMessage, AnyStreamEvent, MessageCreateBody, MessagesCreateSpan } from './types';

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
  setResponseHeaderAttributes(span, props.response);
  const call: MessagesCreateSpan | undefined = props.options.__span;
  const startTime = call?.startTime;
  // What the span reads of the Message, and the usage, as the events have them so far.
  let message: Record<string, unknown> | undefined;
  let usage: Record<string, unknown> | undefined;
  let sawDelta = false;
  let sawMessageDelta = false;
  let sawStop = false;
  observeStream(stream, props.controller.signal, {
    onItem(event) {
      try {
        switch (event.type) {
          case 'message_start': {
            // Only what the span reads, because this lives for as long as the application holds the stream.
            const atStart: Record<string, unknown> = { ...event.message };
            usage = { ...event.message.usage };
            message = {};
            for (const [, [name]] of SPAN_ATTRIBUTES[call?.name ?? '']?.response ?? []) {
              if (name !== undefined && name !== 'usage') {
                message[name] = atStart[name];
              }
            }
            break;
          }
          case 'content_block_start': {
            // A fallback block names the model that produces the rest of the Message.
            const block: unknown = event.content_block;
            if (message && isObj(block) && block['type'] === 'fallback' && isObj(block['to'])) {
              message['model'] = block['to']['model'];
            }
            break;
          }
          case 'message_delta':
            if (message && usage) {
              const totals: Record<string, unknown> = isObj(event.usage) ? event.usage : {};
              // The final count, which replaces the placeholder of `message_start` whatever it is.
              usage['output_tokens'] = totals['output_tokens'];
              // Totals for the whole Message, null when they do not apply, so one that is present
              // replaces the earlier value.
              for (const name of TOTALS_IN_MESSAGE_DELTA) {
                if (totals[name] != null) {
                  usage[name] = totals[name];
                }
              }
              if (event.delta.stop_reason != null) {
                message['stop_reason'] = event.delta.stop_reason;
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
        if (message && usage && call) {
          // `message_delta` has the stop reason and the final output usage, so a stream cut short
          // after it still has them. Before it, `message_start` has only placeholders for them.
          const complete = sawMessageDelta || sawStop;
          let response: Record<string, unknown> = { ...message, usage };
          if (!complete) {
            for (const path of FINAL_FROM_MESSAGE_DELTA) {
              response = without(response, path);
            }
          }
          setResponseAttributes(span, call.name, response);
          setUsageSumAttributes(span, usage, complete);
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

/**
 * The paths in a streamed Message whose values are final only from `message_delta` on.
 * `message_start` has placeholders for them, so the span of a stream that ended before
 * `message_delta` records nothing under them.
 */
export const FINAL_FROM_MESSAGE_DELTA: ReadonlyArray<readonly string[]> = [
  ['stop_reason'],
  ['usage', 'output_tokens'],
  ['usage', 'output_tokens_details'],
];

/**
 * The totals in the usage of `message_delta`, besides `output_tokens`, that replace those of
 * `message_start`. Of the rest of the event, the span records the stop reason alone.
 */
export const TOTALS_IN_MESSAGE_DELTA = [
  'input_tokens',
  'cache_creation_input_tokens',
  'cache_read_input_tokens',
  'output_tokens_details',
  'iterations',
] as const;

/** `data` without the value at `path`, as a copy that shares what the path does not go through. */
function without(data: Record<string, unknown>, path: readonly string[]): Record<string, unknown> {
  const [name, ...rest] = path;
  if (name === undefined || !(name in data)) {
    return data;
  }
  if (rest.length === 0) {
    const { [name]: _, ...others } = data;
    return others;
  }
  const value = data[name];
  return isObj(value) ? { ...data, [name]: without(value, rest) } : data;
}
