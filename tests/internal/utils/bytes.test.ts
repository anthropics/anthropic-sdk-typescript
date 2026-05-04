describe('decodeUTF8', () => {
  const OriginalTextDecoder = globalThis.TextDecoder;

  afterEach(() => {
    Object.defineProperty(globalThis, 'TextDecoder', {
      configurable: true,
      writable: true,
      value: OriginalTextDecoder,
    });
    jest.resetModules();
  });

  test('falls back to ArrayBuffer when TextDecoder rejects Uint8Array views', async () => {
    const nativeDecoder = new OriginalTextDecoder();

    class ArrayBufferOnlyTextDecoder {
      readonly encoding = 'utf-8';
      readonly fatal = false;
      readonly ignoreBOM = false;

      decode(input?: ArrayBuffer | ArrayBufferView | null) {
        if (input == null) {
          return nativeDecoder.decode();
        }

        if (!(input instanceof ArrayBuffer)) {
          throw new TypeError(
            "Failed to execute 'decode' on 'TextDecoder': parameter 1 is not of type 'ArrayBuffer'",
          );
        }

        return nativeDecoder.decode(input);
      }
    }

    Object.defineProperty(globalThis, 'TextDecoder', {
      configurable: true,
      writable: true,
      value: ArrayBufferOnlyTextDecoder as unknown as typeof TextDecoder,
    });
    jest.resetModules();

    const { decodeUTF8 } = await import('@anthropic-ai/sdk/internal/utils/bytes');
    const bytes = new Uint8Array([0x78, 0x66, 0x6f, 0x6f, 0x79]).subarray(1, 4);

    expect(decodeUTF8(bytes)).toBe('foo');
  });
});
