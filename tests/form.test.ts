import { multipartFormRequestOptions, createForm } from '@anthropic-ai/sdk/internal/uploads';
import { toFile } from '@anthropic-ai/sdk/core/uploads';

describe('form data validation', () => {
  test('valid values do not error', async () => {
    await multipartFormRequestOptions(
      {
        body: {
          foo: 'foo',
          string: 1,
          bool: true,
          file: await toFile(Buffer.from('some-content')),
          blob: new Blob(['Some content'], { type: 'text/plain' }),
        },
      },
      fetch,
    );
  });

  test('null', async () => {
    await expect(() =>
      multipartFormRequestOptions(
        {
          body: {
            null: null,
          },
        },
        fetch,
      ),
    ).rejects.toThrow(TypeError);
  });

  test('bare Blob is sent as a file', async () => {
    for (const stripFilenames of [true, false]) {
      const form = await createForm(
        { file: new Blob(['abc'], { type: 'text/plain' }) },
        fetch,
        stripFilenames,
      );
      const file = form.get('file') as File;
      expect([file.name, file.type, await file.text()]).toEqual(['unknown_file', 'text/plain', 'abc']);
    }
  });

  test('un-awaited toFile is rejected', async () => {
    await expect(() =>
      multipartFormRequestOptions({ body: { file: toFile(Buffer.from('abc')) } }, fetch),
    ).rejects.toThrow(/Promise.*await/);
  });

  test('raw bytes are rejected', async () => {
    for (const file of [Buffer.from('abc'), new Uint8Array([1, 2, 3]), new ArrayBuffer(3)]) {
      await expect(() => multipartFormRequestOptions({ body: { file } }, fetch)).rejects.toThrow(/toFile/);
    }
  });

  test('undefined is stripped', async () => {
    const form = await createForm(
      {
        foo: undefined,
        bar: 'baz',
      },
      fetch,
    );
    expect(form.has('foo')).toBe(false);
    expect(form.get('bar')).toBe('baz');
  });

  test('nested undefined property is stripped', async () => {
    const form = await createForm(
      {
        bar: {
          baz: undefined,
        },
      },
      fetch,
    );
    expect(Array.from(form.entries())).toEqual([]);

    const form2 = await createForm(
      {
        bar: {
          foo: 'string',
          baz: undefined,
        },
      },
      fetch,
    );
    expect(Array.from(form2.entries())).toEqual([['bar[foo]', 'string']]);
  });

  test('nested undefined array item is stripped', async () => {
    const form = await createForm(
      {
        bar: [undefined, undefined],
      },
      fetch,
    );
    expect(Array.from(form.entries())).toEqual([]);

    const form2 = await createForm(
      {
        bar: [undefined, 'foo'],
      },
      fetch,
    );
    expect(Array.from(form2.entries())).toEqual([['bar[]', 'foo']]);
  });
});
