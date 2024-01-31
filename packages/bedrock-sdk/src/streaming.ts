import { EventStreamMarshaller } from '@smithy/eventstream-serde-node';
import { fromBase64, toBase64 } from '@smithy/util-base64';
import { streamCollector } from '@smithy/fetch-http-handler';
import { EventStreamSerdeContext, SerdeContext } from '@smithy/types';
import {
  Stream as CoreStream,
  readableStreamAsyncIterable,
  ServerSentEvent,
} from '@anthropic-ai/sdk/streaming';
import { AnthropicError } from '@anthropic-ai/sdk/error';
import { APIError } from '@anthropic-ai/sdk';
import { createResponseHeaders, safeJSON } from '@anthropic-ai/sdk/core';
import { de_ResponseStream } from './AWS_restJson1';

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

export class Stream<Item> extends CoreStream<Item> {
  static override fromSSEResponse<Item>(response: Response, controller: AbortController) {
    let consumed = false;

    async function* iterMessages(): AsyncGenerator<ServerSentEvent, void, unknown> {
      if (!response.body) {
        controller.abort();
        throw new AnthropicError(`Attempted to iterate over a response with no body`);
      }

      const responseBodyIter = readableStreamAsyncIterable<Bytes>(response.body);
      const eventStream = de_ResponseStream(responseBodyIter, getMinimalSerdeContext());
      for await (const event of eventStream) {
        if (event.chunk && event.chunk.bytes) {
          const s = toUtf8(event.chunk.bytes);
          yield { event: 'completion', data: s, raw: [] };
        } else if (event.internalServerException) {
          yield { event: 'error', data: 'InternalServerException', raw: [] };
        } else if (event.modelStreamErrorException) {
          yield { event: 'error', data: 'ModelStreamErrorException', raw: [] };
        } else if (event.validationException) {
          yield { event: 'error', data: 'ValidationException', raw: [] };
        } else if (event.throttlingException) {
          yield { event: 'error', data: 'ThrottlingException', raw: [] };
        }
      }
    }

    // Note: this function is copied entirely from the core SDK
    async function* iterator(): AsyncIterator<Item, any, undefined> {
      if (consumed) {
        throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
      }
      consumed = true;
      let done = false;
      try {
        for await (const sse of iterMessages()) {
          if (sse.event === 'completion') {
            try {
              yield JSON.parse(sse.data);
            } catch (e) {
              console.error(`Could not parse message into JSON:`, sse.data);
              console.error(`From chunk:`, sse.raw);
              throw e;
            }
          }

          if (sse.event === 'error') {
            const errText = sse.data;
            const errJSON = safeJSON(errText);
            const errMessage = errJSON ? undefined : errText;

            throw APIError.generate(undefined, errJSON, errMessage, createResponseHeaders(response.headers));
          }
        }
        done = true;
      } catch (e) {
        // If the user calls `stream.controller.abort()`, we should exit without throwing.
        if (e instanceof Error && e.name === 'AbortError') return;
        throw e;
      } finally {
        // If the user `break`s, abort the ongoing request.
        if (!done) controller.abort();
      }
    }

    return new Stream(iterator, controller);
  }
}
