import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { Messages } from '@anthropic-ai/sdk/resources/messages';

const client = new Anthropic();

test('running under PnP, ESM and CJS entrypoints both resolve', () => {
  assert.ok(process.versions['pnp']);
  assert.ok(client.messages instanceof Messages);
  const require = createRequire(import.meta.url);
  assert.equal(typeof require('@anthropic-ai/sdk').Anthropic, 'function');
  // zod is an optional peer this project does not provide
  assert.throws(() => require('zod'), /isn't declared in your dependencies/);
});

test('beta.files.upload from a read stream and a Buffer', async () => {
  fs.writeFileSync('upload.txt', 'hello world');
  for (const file of [
    fs.createReadStream('upload.txt'),
    await toFile(Buffer.from('hello world'), 'upload.txt'),
  ]) {
    const uploaded = await client.beta.files.upload({ file });
    assert.equal(uploaded.filename, 'upload.txt');
    assert.equal(uploaded.size_bytes, 11);
  }
});
