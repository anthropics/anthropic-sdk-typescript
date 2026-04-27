export function concatBytes(buffers: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const buffer of buffers) {
    length += buffer.length;
  }
  const output = new Uint8Array(length);
  let index = 0;
  for (const buffer of buffers) {
    output.set(buffer, index);
    index += buffer.length;
  }

  return output;
}

let encodeUTF8_: (str: string) => Uint8Array;
export function encodeUTF8(str: string) {
  let encoder;
  return (
    encodeUTF8_ ??
    ((encoder = new (globalThis as any).TextEncoder()), (encodeUTF8_ = encoder.encode.bind(encoder)))
  )(str);
}

let decodeUTF8Decoder_: { decode: (input?: ArrayBuffer | ArrayBufferView | null) => string };
export function decodeUTF8(bytes: Uint8Array) {
  const decoder = decodeUTF8Decoder_ ?? (decodeUTF8Decoder_ = new (globalThis as any).TextDecoder());

  try {
    return decoder.decode(bytes);
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }

    return decoder.decode(bytes.slice().buffer);
  }
}
