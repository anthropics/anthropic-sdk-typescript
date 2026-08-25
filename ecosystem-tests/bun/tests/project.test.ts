import { expect, test } from 'bun:test';
import Anthropic from '@anthropic-ai/sdk';
// moduleResolution bundler + Bun both resolve this through the exports map's `import` condition
import { Messages } from '@anthropic-ai/sdk/resources/messages';

const client = new Anthropic();

test('running under Bun, subpath export shares the root module instance', () => {
  expect(typeof Bun.version).toBe('string');
  expect(client.messages).toBeInstanceOf(Messages);
});

test('beta.files.upload from Bun.file()', async () => {
  await Bun.write('upload.txt', 'hello world');
  // a lazy, named Blob and an Uploadable as-is
  const uploaded = await client.beta.files.upload({ file: Bun.file('upload.txt') });
  expect(uploaded).toMatchObject({ filename: 'upload.txt', size_bytes: 11 });
  expect(uploaded.mime_type).toStartWith('text/plain');
});
