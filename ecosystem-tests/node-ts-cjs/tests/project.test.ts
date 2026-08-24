import * as fs from 'node:fs';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
// deep subpath import: must resolve under moduleResolution node10 via the published directory layout
import { Messages } from '@anthropic-ai/sdk/resources/messages';

const client = new Anthropic();

test('subpath export resolves to the same module instance', () => {
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
