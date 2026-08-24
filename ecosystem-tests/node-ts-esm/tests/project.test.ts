import * as fs from 'node:fs';
import { expect, test } from 'vitest';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
// extensionless subpath: resolved through the package.json exports map to the .mjs/.d.mts build
import { Messages } from '@anthropic-ai/sdk/resources/messages';

const client = new Anthropic();

test('subpath export resolves to the same module instance as the root ESM entrypoint', () => {
  expect(client.messages).toBeInstanceOf(Messages);
});

test('beta.files.upload from a read stream and a Buffer', async () => {
  fs.writeFileSync('upload.txt', 'hello world');
  for (const file of [
    fs.createReadStream('upload.txt'),
    await toFile(Buffer.from('hello world'), 'upload.txt'),
  ]) {
    expect(await client.beta.files.upload({ file })).toMatchObject({
      filename: 'upload.txt',
      size_bytes: 11,
    });
  }
});
