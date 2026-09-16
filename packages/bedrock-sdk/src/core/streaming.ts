export * from '@anthropic-ai/sdk/streaming';

import { EventStreamMarshaller } from '@smithy/eventstream-serde-node';
import { fromBase64, toBase64 } from '@smithy/util-base64';
import { streamCollector } from '@smithy/fetch-http-handler';
import { EventStreamSerdeContext, SerdeContext } from '@smithy/types';
import { BedrockRuntimeServiceException } from '@aws-sdk/client-bedrock-runtime';
import { AnthropicError } from '@anthropic-ai/sdk/error';
import { de_ResponseStream } from '../AWS_restJson1';
import type { BodyInit } from '../internal/builtin-types';
import { isAbortError } from '../internal/errors';
import { ReadableStreamFrom, ReadableStreamToAsyncIterable } from '../internal/shims';
import { isObj, safeJSON } from '../internal/utils/values';

type Bytes = string | ArrayBuffer | Uint8Array | Buffer | null | undefined;

export const toUtf8 = (input: Uint8Array): string => new TextDecoder('utf-8').decode(input);
export const fromUtf8 = (input: string): Uint8Array => new TextEncoder().encode(input);

// `de_ResponseStream` parses a Bedrock response stream and emits events as they are found.
// It requires a "context" argument which has many fields, but for what we're using it for
// it only needs this.
export const getMinimalSerdeContext = (): SerdeContext & EventStreamSerdeContext => {
  const marshaller = new EventStreamMarshaller({ utf8Encoder: toUtf8, utf8Decoder: fromUtf8 });
  return {
    base64Decoder: fromBase64,
    base64Encoder: toBase64,
    utf8Decoder: fromUtf8,
    utf8Encoder: toUtf8,
    eventStreamMarshaller: marshaller,
    streamCollector: streamCollector,
  } as unknown as SerdeContext & EventStreamSerdeContext;
};

/**
 * Transcodes a Bedrock streaming response from AWS's binary EventStream
 * framing to the SSE format the Anthropic API uses, preserving status,
 * headers (apart from content type/length), and URL.
 *
 * Chunk frames carry Anthropic-shaped JSON payloads; each becomes an SSE
 * frame named by the payload's `type`, so Anthropic error payloads become
 * standard SSE `error` events. AWS exception and error frames become SSE
 * `error` events typed by the frame's exception type or error code.
 */
export function eventStreamToSSEResponse(response: Response): Response {
  const body = response.body;
  if (!body) {
    return response;
  }

  async function* sseFrames(): AsyncGenerator<Uint8Array, void, unknown> {
    const eventStream = de_ResponseStream(
      ReadableStreamToAsyncIterable<Bytes>(body),
      getMinimalSerdeContext(),
    );
    try {
      for await (const event of eventStream) {
        if (event.chunk && event.chunk.bytes) {
          const data = toUtf8(event.chunk.bytes);
          const parsed = safeJSON(data);
          if (parsed === undefined) {
            throw new AnthropicError(`Could not parse a Bedrock chunk into JSON: ${data}`);
          }
          // Frames without a `type` (e.g. gateway keep-alives) have no SSE
          // event name to carry them; drop them rather than failing the stream.
          const eventName = isObj(parsed) && typeof parsed['type'] === 'string' ? parsed['type'] : null;
          if (eventName != null) {
            // Re-serialize so the payload is guaranteed single-line, as SSE
            // `data:` framing requires.
            yield fromUtf8(`event: ${eventName}\ndata: ${JSON.stringify(parsed)}\n\n`);
          }
        }
      }
    } catch (err) {
      const error = frameError(err);
      if (!error) {
        throw err;
      }
      yield fromUtf8(`event: error\ndata: ${JSON.stringify({ type: 'error', error })}\n\n`);
    }
  }

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/event-stream; charset=utf-8');
  headers.delete('content-length');
  const normalized = new Response(ReadableStreamFrom(sseFrames()) as unknown as BodyInit, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  // Synthesized Responses have `url === ''`; preserve the wire URL for
  // middleware and the SDK's own logging.
  Object.defineProperty(normalized, 'url', { value: response.url });
  return normalized;
}

/**
 * Smithy's unmarshaller throws on `exception` and `error` frames instead of
 * yielding them: modeled exceptions as their AWS class, anything else as a
 * plain `Error` named after the frame's `:exception-type` or `:error-code`.
 */
function frameError(err: unknown): { type: string; message: string } | undefined {
  if (err instanceof BedrockRuntimeServiceException) {
    // `:exception-type` is the camel-cased exception name.
    return { type: err.name.charAt(0).toLowerCase() + err.name.slice(1), message: err.message };
  }
  if (
    err instanceof Error &&
    Object.getPrototypeOf(err) === Error.prototype &&
    err.name !== 'Error' &&
    !isAbortError(err)
  ) {
    return { type: err.name, message: err.message };
  }
  return undefined;
}
