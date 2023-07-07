import type { Response } from '@anthropic-ai/sdk/_shims/fetch';

import { APIResponse, Headers, createResponseHeaders } from './core';

import { safeJSON } from '@anthropic-ai/sdk/core';
import { APIError } from '@anthropic-ai/sdk/error';

type Bytes = string | ArrayBuffer | Uint8Array | Buffer | null | undefined;

type ServerSentEvent = {
  event: string | null;
  data: string;
  raw: string[];
};

class SSEDecoder {
  private data: string[];
  private event: string | null;
  private chunks: string[];

  constructor() {
    this.event = null;
    this.data = [];
    this.chunks = [];
  }

  decode(line: string) {
    if (line.endsWith('\r')) {
      line = line.substring(0, line.length - 1);
    }

    if (!line) {
      // empty line and we didn't previously encounter any messages
      if (!this.event && !this.data.length) return null;

      const sse: ServerSentEvent = {
        event: this.event,
        data: this.data.join('\n'),
        raw: this.chunks,
      };

      this.event = null;
      this.data = [];
      this.chunks = [];

      return sse;
    }

    this.chunks.push(line);

    if (line.startsWith(':')) {
      return null;
    }

    let [fieldname, _, value] = partition(line, ':');

    if (value.startsWith(' ')) {
      value = value.substring(1);
    }

    if (fieldname === 'event') {
      this.event = value;
    } else if (fieldname === 'data') {
      this.data.push(value);
    }

    return null;
  }
}

export class Stream<Item> implements AsyncIterable<Item>, APIResponse<Stream<Item>> {
  /** @deprecated - please use the async iterator instead. We plan to add additional helper methods shortly. */
  response: Response;
  /** @deprecated - we plan to add a different way to access raw response information shortly. */
  responseHeaders: Headers;
  controller: AbortController;

  private decoder: SSEDecoder;

  constructor(response: Response, controller: AbortController) {
    this.response = response;
    this.controller = controller;
    this.decoder = new SSEDecoder();
    this.responseHeaders = createResponseHeaders(response.headers);
  }

  private async *iterMessages(): AsyncGenerator<ServerSentEvent, void, unknown> {
    if (!this.response.body) {
      this.controller.abort();
      throw new Error(`Attempted to iterate over a response with no body`);
    }
    const lineDecoder = new LineDecoder();

    const iter = readableStreamAsyncIterable<Bytes>(this.response.body);
    for await (const chunk of iter) {
      const text = decodeText(chunk);

      for (const line of lineDecoder.decode(text)) {
        const sse = this.decoder.decode(line);
        if (sse) yield sse;
      }
    }

    for (const line of lineDecoder.flush()) {
      const sse = this.decoder.decode(line);
      if (sse) yield sse;
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Item, any, undefined> {
    try {
      for await (const sse of this.iterMessages()) {
        if (sse.event === 'completion') {
          try {
            yield JSON.parse(sse.data);
          } catch (e) {
            console.error(`Could not parse message into JSON:`, sse.data);
            console.error(`From chunk:`, sse.raw);
            throw e;
          }
        }

        if (sse.event === 'ping') {
          continue;
        }

        if (sse.event === 'error') {
          const errText = sse.data;
          const errJSON = safeJSON(errText);
          const errMessage = errJSON ? undefined : errText;

          throw APIError.generate(undefined, errJSON, errMessage, this.responseHeaders);
        }
      }
    } catch (e) {
      // If the user calls `stream.controller.abort()`, we should exit without throwing.
      if (e instanceof Error && e.name === 'AbortError') return;
      throw e;
    } finally {
      // If the user `break`s, abort the ongoing request.
      this.controller.abort();
    }
  }
}

const NEWLINE_CHARS = '\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029';

/**
 * A re-implementation of httpx's `LineDecoder` in Python that handles incrementally
 * reading lines from text.
 *
 * https://github.com/encode/httpx/blob/920333ea98118e9cf617f246905d7b202510941c/httpx/_decoders.py#L258
 */
class LineDecoder {
  buffer: string[];
  trailingCR: boolean;

  constructor() {
    this.buffer = [];
    this.trailingCR = false;
  }

  decode(text: string): string[] {
    if (this.trailingCR) {
      text = '\r' + text;
      this.trailingCR = false;
    }
    if (text.endsWith('\r')) {
      this.trailingCR = true;
      text = text.slice(0, -1);
    }

    if (!text) {
      return [];
    }

    const trailing_newline = NEWLINE_CHARS.includes(text.slice(-1));
    let lines = text.split(/\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]/g);

    if (lines.length === 1 && !trailing_newline) {
      this.buffer.push(lines[0]!);
      return [];
    }

    if (this.buffer.length > 0) {
      lines = [this.buffer.join('') + lines[0], ...lines.slice(1)];
      this.buffer = [];
    }

    if (!trailing_newline) {
      this.buffer = [lines.pop() || ''];
    }

    return lines;
  }

  flush(): string[] {
    if (!this.buffer.length && !this.trailingCR) {
      return [];
    }

    const lines = [this.buffer.join('')];
    this.buffer = [];
    this.trailingCR = false;
    return lines;
  }
}

function partition(str: string, delimiter: string): [string, string, string] {
  const index = str.indexOf(delimiter);
  if (index !== -1) {
    return [str.substring(0, index), delimiter, str.substring(index + delimiter.length)];
  }

  return [str, '', ''];
}

let _textDecoder;
function decodeText(bytes: Bytes): string {
  if (bytes == null) return '';
  if (typeof bytes === 'string') return bytes;

  // Node:
  if (typeof Buffer !== 'undefined') {
    if (bytes instanceof Buffer) {
      return bytes.toString();
    }
    if (bytes instanceof Uint8Array) {
      return Buffer.from(bytes).toString();
    }

    throw new Error(`Unexpected: received non-Uint8Array (${bytes.constructor.name}) in Node.`);
  }

  // Browser
  if (typeof TextDecoder !== 'undefined') {
    if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) {
      _textDecoder ??= new TextDecoder('utf8');
      return _textDecoder.decode(bytes);
    }

    throw new Error(
      `Unexpected: received non-Uint8Array/ArrayBuffer (${
        (bytes as any).constructor.name
      }) in a web platform.`,
    );
  }

  throw new Error(`Unexpected: neither Buffer nor TextDecoder are available as globals.`);
}

/**
 * Most browsers don't yet have async iterable support for ReadableStream,
 * and Node has a very different way of reading bytes from its "ReadableStream".
 *
 * This polyfill was pulled from https://github.com/MattiasBuelens/web-streams-polyfill/pull/122#issuecomment-1624185965
 *
 * We make extensive use of "any" here to avoid pulling in either "node" or "dom" types
 * to library users' type scopes.
 */
function readableStreamAsyncIterable<T>(stream: any): AsyncIterableIterator<T> {
  if (stream[Symbol.asyncIterator]) {
    return stream[Symbol.asyncIterator];
  }

  const reader = stream.getReader();

  return {
    next() {
      return reader.read();
    },
    async return() {
      reader.releaseLock();
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
