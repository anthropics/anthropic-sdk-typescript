import { fromBase64, toBase64 } from '@anthropic-ai/sdk/internal/utils/base64';

describe.each(['Buffer', 'atob'])('with %s', (mode) => {
  let originalBuffer: BufferConstructor;
  beforeAll(() => {
    if (mode === 'atob') {
      originalBuffer = globalThis.Buffer;
      // @ts-expect-error Can't assign undefined to BufferConstructor
      delete globalThis.Buffer;
    }
  });
  afterAll(() => {
    if (mode === 'atob') {
      globalThis.Buffer = originalBuffer;
    }
  });
  test('toBase64', () => {
    const testCases = [
      {
        input: 'hello world',
        expected: 'aGVsbG8gd29ybGQ=',
      },
      {
        input: new Uint8Array([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]),
        expected: 'aGVsbG8gd29ybGQ=',
      },
      {
        input: undefined,
        expected: '',
      },
      {
        input: new Uint8Array([
          229, 102, 215, 230, 65, 22, 46, 87, 243, 176, 99, 99, 31, 174, 8, 242, 83, 142, 169, 64, 122, 123,
          193, 71,
        ]),
        expected: '5WbX5kEWLlfzsGNjH64I8lOOqUB6e8FH',
      },
      {
        input: '✓',
        expected: '4pyT',
      },
      {
        input: new Uint8Array([226, 156, 147]),
        expected: '4pyT',
      },
    ];

    testCases.forEach(({ input, expected }) => {
      expect(toBase64(input)).toBe(expected);
    });
  });

  test('toBase64 handles large input without stack overflow', () => {
    // 200KB of data - would cause "Maximum call stack size exceeded"
    // with the old String.fromCharCode.apply/spread approach
    const size = 200 * 1024;
    const largeData = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      largeData[i] = i % 256;
    }

    const encoded = toBase64(largeData);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);

    // Round-trip: decode and verify it matches
    const decoded = fromBase64(encoded);
    expect(decoded).toEqual(largeData);
  });

  test('fromBase64', () => {
    const testCases = [
      {
        input: 'aGVsbG8gd29ybGQ=',
        expected: new Uint8Array([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]),
      },
      {
        input: '',
        expected: new Uint8Array([]),
      },
      {
        input: '5WbX5kEWLlfzsGNjH64I8lOOqUB6e8FH',
        expected: new Uint8Array([
          229, 102, 215, 230, 65, 22, 46, 87, 243, 176, 99, 99, 31, 174, 8, 242, 83, 142, 169, 64, 122, 123,
          193, 71,
        ]),
      },
      {
        input: '4pyT',
        expected: new Uint8Array([226, 156, 147]),
      },
    ];

    testCases.forEach(({ input, expected }) => {
      expect(fromBase64(input)).toEqual(expected);
    });
  });
});
