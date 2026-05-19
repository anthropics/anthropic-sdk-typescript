import { concatBytes, decodeUTF8, encodeUTF8 } from '../utils/bytes';

export type Bytes = string | ArrayBuffer | Uint8Array | null | undefined;

/**
 * A re-implementation of httpx's `LineDecoder` in Python that handles incrementally
 * reading lines from text.
 *
 * https://github.com/encode/httpx/blob/920333ea98118e9cf617f246905d7b202510941c/httpx/_decoders.py#L258
 */
export class LineDecoder {
  // prettier-ignore
  static NEWLINE_CHARS = new Set(['\n', '\r']);
  static NEWLINE_REGEXP = /\r\n|[\n\r]/g;

  #buffer: Uint8Array;
  #carriageReturnIndex: number | null;

  constructor() {
    this.#buffer = new Uint8Array();
    this.#carriageReturnIndex = null;
  }

  decode(chunk: Bytes): string[] {
    if (chunk == null) {
      return [];
    }

    const binaryChunk =
      chunk instanceof ArrayBuffer ? new Uint8Array(chunk)
      : typeof chunk === 'string' ? encodeUTF8(chunk)
      : chunk;

    this.#buffer = concatBytes([this.#buffer, binaryChunk]);

    const lines: string[] = [];
    let patternIndex;
    while ((patternIndex = findNewlineIndex(this.#buffer, this.#carriageReturnIndex)) != null) {
      if (patternIndex.carriage && this.#carriageReturnIndex == null) {
        // skip until we either get a corresponding `\n`, a new `\r` or nothing
        this.#carriageReturnIndex = patternIndex.index;
        continue;
      }

      // we got double \r or \rtext\n
      if (
        this.#carriageReturnIndex != null &&
        (patternIndex.index !== this.#carriageReturnIndex + 1 || patternIndex.carriage)
      ) {
        lines.push(decodeUTF8(this.#buffer.subarray(0, this.#carriageReturnIndex - 1)));
        this.#buffer = this.#buffer.subarray(this.#carriageReturnIndex);
        this.#carriageReturnIndex = null;
        continue;
      }

      const endIndex =
        this.#carriageReturnIndex !== null ? patternIndex.preceding - 1 : patternIndex.preceding;

      const line = decodeUTF8(this.#buffer.subarray(0, endIndex));
      lines.push(line);

      this.#buffer = this.#buffer.subarray(patternIndex.index);
      this.#carriageReturnIndex = null;
    }

    return lines;
  }

  flush(): string[] {
    if (!this.#buffer.length) {
      return [];
    }
    return this.decode('\n');
  }
}

/**
 * This function searches the buffer for the end patterns, (\r or \n)
 * and returns an object with the index preceding the matched newline and the
 * index after the newline char. `null` is returned if no new line is found.
 *
 * ```ts
 * findNewLineIndex('abc\ndef') -> { preceding: 2, index: 3 }
 * ```
 */
function findNewlineIndex(
  buffer: Uint8Array,
  startIndex: number | null,
): { preceding: number; index: number; carriage: boolean } | null {
  const newline = 0x0a; // \n
  const carriage = 0x0d; // \r

  for (let i = startIndex ?? 0; i < buffer.length; i++) {
    if (buffer[i] === newline) {
      return { preceding: i, index: i + 1, carriage: false };
    }

    if (buffer[i] === carriage) {
      return { preceding: i, index: i + 1, carriage: true };
    }
  }

  return null;
}

export function findDoubleNewlineIndex(buffer: Uint8Array): number {
  // This function searches the buffer for two adjacent line endings and returns
  // the index right after the second one, or -1 if none are found. SSE allows
  // lines to end in \r, \n, or \r\n, so adjacent line endings may be mixed.
  for (let i = 0; i < buffer.length; i++) {
    const firstEnd = findLineEndingEnd(buffer, i);
    if (firstEnd === -1) {
      continue;
    }

    const secondEnd = findLineEndingEnd(buffer, firstEnd);
    if (secondEnd !== -1) {
      return secondEnd;
    }
  }

  return -1;
}

function findLineEndingEnd(buffer: Uint8Array, index: number): number {
  const newline = 0x0a; // \n
  const carriage = 0x0d; // \r

  if (buffer[index] === newline) {
    return index + 1;
  }

  if (buffer[index] === carriage) {
    return buffer[index + 1] === newline ? index + 2 : index + 1;
  }

  return -1;
}
