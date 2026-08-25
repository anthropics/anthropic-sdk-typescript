import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@jest/globals';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { Messages } from '@anthropic-ai/sdk/resources/messages';
import { params } from '../shared/cases.js';

const client = new Anthropic();

test('loaded as native ESM through jest', () => {
  // a `require`-based transform (the ts-jest CJS preset) would have no import.meta
  expect(import.meta.url).toMatch(/^file:/);
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

test('error classes are per module instance (dual-package hazard)', async () => {
  const error = await client.messages.create({ ...params, model: 'mock-error' }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(Anthropic.APIError);
  // require() loads the separate CJS build with its own class objects, so instanceof does not
  // hold across the two (and `.name` is just "Error"): compare `.status`
  const cjs: typeof import('@anthropic-ai/sdk') = createRequire(import.meta.url)('@anthropic-ai/sdk');
  expect(cjs.APIError).not.toBe(Anthropic.APIError);
  expect(error).not.toBeInstanceOf(cjs.APIError);
});
