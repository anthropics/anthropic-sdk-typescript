import fs from 'fs';
import type { ResponseLike } from '@anthropic-ai/sdk/internal/to-file';
import { toFile } from '@anthropic-ai/sdk/core/uploads';
import { File } from 'node:buffer';

class MyClass {
  name: string = 'foo';
}

function mockResponse({ url, content }: { url: string; content?: Blob }): ResponseLike {
  return {
    url,
    blob: async () => content || new Blob([]),
  };
}

describe('toFile', () => {
  it('throws a helpful error for mismatched types', async () => {
    await expect(
      // @ts-expect-error intentionally mismatched type
      toFile({ foo: 'string' }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Unexpected data type: object; constructor: Object; props: ["foo"]"`,
    );

    await expect(
      // @ts-expect-error intentionally mismatched type
      toFile(new MyClass()),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Unexpected data type: object; constructor: MyClass; props: ["name"]"`,
    );
  });

  it('disallows string at the type-level', async () => {
    // @ts-expect-error we intentionally do not type support for `string`
    // to help people avoid passing a file path
    const file = await toFile('contents');
    expect(file.text()).resolves.toEqual('contents');
  });

  it('extracts a file name from a Response', async () => {
    const response = mockResponse({ url: 'https://example.com/my/audio.mp3' });
    const file = await toFile(response);
    expect(file.name).toEqual('audio.mp3');
  });

  it('extracts a file name from a File', async () => {
    const input = new File(['foo'], 'input.jsonl');
    const file = await toFile(input);
    expect(file.name).toEqual('input.jsonl');
  });

  it('extracts a file name from a ReadStream', async () => {
    const input = fs.createReadStream('tests/uploads.test.ts');
    const file = await toFile(input);
    expect(file.name).toEqual('uploads.test.ts');
    expect(file.type).toEqual('');
  });

  it('allows overriding props from a ReadStream', async () => {
    var file = await toFile(fs.createReadStream('tests/uploads.test.ts'), undefined, {
      type: 'application/typescript',
    });
    expect(file.name).toEqual('uploads.test.ts');
    expect(file.type).toEqual('application/typescript');

    const time = new Date().getTime();
    var file = await toFile(fs.createReadStream('tests/uploads.test.ts'), 'my-uploads.test.ts', {
      type: 'application/typescript',
      lastModified: time,
    });
    expect(file.name).toEqual('my-uploads.test.ts');
    expect(file.type).toEqual('application/typescript');
    expect(file.lastModified).toEqual(time);
  });

  it('does not copy File objects by default', async () => {
    const input = new File(['foo'], 'input.jsonl', { type: 'jsonl' });
    const file = await toFile(input);
    expect(file).toStrictEqual(input);
    expect(file.name).toEqual('input.jsonl');
    expect(file.type).toBe('jsonl');
  });

  it('allows overriding props from a File', async () => {
    const time = new Date().getTime();
    var input = new File(['foo'], 'input.jsonl', { type: 'jsonl', lastModified: time - 10000 });
    var file = await toFile(input, 'foo.jsonl', { type: 'plain/text', lastModified: time });
    expect(file).not.toStrictEqual(input);
    expect(file.name).toEqual('foo.jsonl');
    expect(file.type).toEqual('plain/text');
    expect(file.lastModified).toEqual(time);
  });

  it('is assignable to File and Blob', async () => {
    const input = new File(['foo'], 'input.jsonl', { type: 'jsonl' });
    const result = await toFile(input);
    const file: File = result;
    const blob: Blob = result;
    void file, blob;
  });
});

describe('missing File error message', () => {
  let prevGlobalFile: unknown;
  let prevNodeFile: unknown;
  beforeEach(() => {
    // The file shim captures the global File object when it's first imported.
    // Reset modules before each test so we can test the error thrown when it's undefined.
    jest.resetModules();
    const buffer = require('node:buffer');
    // @ts-ignore
    prevGlobalFile = globalThis.File;
    prevNodeFile = buffer.File;
    // @ts-ignore
    globalThis.File = undefined;
    buffer.File = undefined;
  });
  afterEach(() => {
    // Clean up
    // @ts-ignore
    globalThis.File = prevGlobalFile;
    require('node:buffer').File = prevNodeFile;
    jest.resetModules();
  });

  test('is thrown', async () => {
    const uploads = await import('@anthropic-ai/sdk/core/uploads');
    await expect(
      uploads.toFile(mockResponse({ url: 'https://example.com/my/audio.mp3' })),
    ).rejects.toMatchInlineSnapshot(
      `[Error: \`File\` is not defined as a global, which is required for file uploads.]`,
    );
  });
});
