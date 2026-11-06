import { AnthropicError } from './error';
import { type ReadableStream } from '../internal/shim-types';
import { makeReadableStream } from '../internal/shims';
import { LineDecoder } from '../internal/decoders/line';
import { ReadableStreamToAsyncIterable } from '../internal/shims';
import { isAbortError } from '../internal/errors';
import { safeJSON } from '../internal/utils/values';
import { encodeUTF8 } from '../internal/utils/bytes';
import { loggerFor } from '../internal/utils/log';
import type { BaseAnthropic } from '../client';

import { APIError } from './error';
import type { ErrorType } from '../resources/shared';
import { releaseRequestSignal } from '../internal/request-signal';

type Bytes = string | ArrayBuffer | Uint8Array | null | undefined;

export type ServerSentEvent = {
  event: string | null;
  data: string;
  raw: string[];
};

export class Stream<Item> implements AsyncIterable<Item> {
  controller: AbortController;
  #client: BaseAnthropic | undefined;

  constructor(
    private iterator: () => AsyncIterator<Item>,
    controller: AbortController,
    client?: BaseAnthropic,
  ) {
    this.controller = controller;
    this.#client = client;
  }

  /**
   * Iterate the raw Server-Sent Events from `response` — `{event, data, raw}`
   * objects, before any JSON parsing or event-name filtering.
   *
   * This reads `response.body` directly (not a clone), so the response is
   * consumed. Use this in middleware that fully replaces the stream body; for
   * read-only observation of parsed events, use `ctx.parse()` instead.
   */
  static rawEvents(
    response: Response,
    controller: AbortController = new AbortController(),
  ): AsyncGenerator<ServerSentEvent, void, unknown> {
    return _iterSSEMessages(response, controller);
  }

  static fromSSEResponse<Item>(
    response: Response,
    controller: AbortController,
    client?: BaseAnthropic,
  ): Stream<Item> {
    let consumed = false;
    const logger = client ? loggerFor(client) : console;

    async function* iterator(): AsyncIterator<Item, any, undefined> {
      if (consumed) {
        throw new AnthropicError('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
      }
      consumed = true;
      let done = false;
      try {
        for await (const sse of _iterSSEMessages(response, controller)) {
          if (sse.event === 'ping') {
            continue;
          }

          if (sse.event === null) {
            continue;
          }

          if (sse.event === 'error') {
            const body = safeJSON(sse.data) ?? sse.data;
            const type = body?.error?.type as ErrorType | undefined;
            throw new APIError(undefined, body, undefined, response.headers, type);
          } else {
            if (!sse.data) continue;

            try {
              yield JSON.parse(sse.data) as Item;
            } catch (e) {
              logger.error(`Could not parse message into JSON:`, sse.data);
              logger.error(`From chunk:`, sse.raw);
              throw e;
            }
          }
        }
        done = true;
      } catch (e) {
        // If the user calls `stream.controller.abort()`, we should exit without throwing.
        if (isAbortError(e)) return;
        throw e;
      } finally {
        // If the user `break`s, abort the ongoing request.
        if (!done) controller.abort();
        releaseRequestSignal(controller);
      }
    }

    return new Stream(iterator, controller, client);
  }

  /**
   * Generates a Stream from a newline-separated ReadableStream
   * where each item is a JSON value.
   */
  static fromReadableStream<Item>(
    readableStream: ReadableStream,
    controller: AbortController,
    client?: BaseAnthropic,
  ): Stream<Item> {
    let consumed = false;

    async function* iterLines(): AsyncGenerator<string, void, unknown> {
      const lineDecoder = new LineDecoder();

      const iter = ReadableStreamToAsyncIterable<Bytes>(readableStream);
      for await (const chunk of iter) {
        for (const line of lineDecoder.decode(chunk)) {
          yield line;
        }
      }

      for (const line of lineDecoder.flush()) {
        yield line;
      }
    }

    async function* iterator(): AsyncIterator<Item, any, undefined> {
      if (consumed) {
        throw new AnthropicError('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
      }
      consumed = true;
      let done = false;
      try {
        for await (const line of iterLines()) {
          if (done) continue;
          if (line) yield JSON.parse(line) as Item;
        }
        done = true;
      } catch (e) {
        // If the user calls `stream.controller.abort()`, we should exit without throwing.
        if (isAbortError(e)) return;
        throw e;
      } finally {
        // If the user `break`s, abort the ongoing request.
        if (!done) controller.abort();
        releaseRequestSignal(controller);
      }
    }

    return new Stream(iterator, controller, client);
  }

  [Symbol.asyncIterator](): AsyncIterator<Item> {
    return this.iterator();
  }

  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee(): [Stream<Item>, Stream<Item>] {
    const left: Array<Promise<IteratorResult<Item>>> = [];
    const right: Array<Promise<IteratorResult<Item>>> = [];
    const iterator = this[Symbol.asyncIterator]();

    const teeIterator = (queue: Array<Promise<IteratorResult<Item>>>): AsyncIterator<Item> => {
      return {
        next: () => {
          if (queue.length === 0) {
            const result = iterator.next();
            left.push(result);
            right.push(result);
          }
          return queue.shift()!;
        },
      };
    };

    return [
      new Stream(() => teeIterator(left), this.controller, this.#client),
      new Stream(() => teeIterator(right), this.controller, this.#client),
    ];
  }

  /**
   * Converts this stream to a newline-separated ReadableStream of
   * JSON stringified values in the stream
   * which can be turned back into a Stream with `Stream.fromReadableStream()`.
   */
  toReadableStream(): ReadableStream {
    const self = this;
    let iter: AsyncIterator<Item>;

    return makeReadableStream({
      async start() {
        iter = self[Symbol.asyncIterator]();
      },
      async pull(ctrl: any) {
        try {
          const { value, done } = await iter.next();
          if (done) return ctrl.close();

          const bytes = encodeUTF8(JSON.stringify(value) + '\n');

          ctrl.enqueue(bytes);
        } catch (err) {
          ctrl.error(err);
        }
      },
      async cancel() {
        await iter.return?.();
      },
    });
  }
}

export async function* _iterSSEMessages(
  response: Response,
  controller: AbortController,
): AsyncGenerator<ServerSentEvent, void, unknown> {
  if (!response.body) {
    controller.abort();
    if (
      typeof (globalThis as any).navigator !== 'undefined' &&
      (globalThis as any).navigator.product === 'ReactNative'
    ) {
      throw new AnthropicError(
        `The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api`,
      );
    }
    throw new AnthropicError(`Attempted to iterate over a response with no body`);
  }

  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  let text = '';
  let event: string | null = null;
  let data: string[] = [];
  let raw: string[] = [];

  const takeLine = (line: string): ServerSentEvent | null => {
    if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);

    if (!line) {
      // empty line and we didn't previously encounter any messages
      if (!event && !data.length) return null;

      const sse: ServerSentEvent = { event, data: data.join('\n'), raw };
      event = null;
      data = [];
      raw = [];
      return sse;
    }

    raw.push(line);

    const colon = line.indexOf(':');
    if (colon === 0) return null;

    const fieldname = colon === -1 ? line : line.slice(0, colon);
    if (fieldname !== 'event' && fieldname !== 'data') return null;

    const value = colon === -1 ? '' : line.slice(line.charCodeAt(colon + 1) === 0x20 ? colon + 2 : colon + 1);
    if (fieldname === 'event') event = value;
    else data.push(value);
    return null;
  };

  for await (const chunk of ReadableStreamToAsyncIterable<Bytes>(response.body)) {
    if (chunk == null) continue;

    text += decoder.decode(typeof chunk === 'string' ? encodeUTF8(chunk) : chunk, { stream: true });

    let start = 0;
    if (!text.includes('\r')) {
      let end;
      while ((end = text.indexOf('\n', start)) !== -1) {
        const sse = takeLine(text.slice(start, end));
        start = end + 1;
        if (sse) yield sse;
      }
    } else {
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char !== '\n' && char !== '\r') continue;
        if (char === '\r' && i + 1 === text.length) break;

        const sse = takeLine(text.slice(start, i));
        if (char === '\r' && text[i + 1] === '\n') i++;
        start = i + 1;
        if (sse) yield sse;
      }
    }
    text = text.slice(start);
  }

  text += decoder.decode();
  if (text) {
    for (const line of text.replace(/\r$/, '').split(/\r\n|[\n\r]/)) {
      const sse = takeLine(line);
      if (sse) yield sse;
    }
  }
}
