import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { Messages } from '@anthropic-ai/sdk/resources/messages';
// the exports map also exposes "./resources/*.mjs"; bundler resolution types it via the sibling .d.mts
import { Messages as MessagesMjs } from '@anthropic-ai/sdk/resources/messages.mjs';

const client = new Anthropic();

test('extensionless and .mjs subpaths are the same module as the root ESM entrypoint', () => {
  assert.equal(MessagesMjs, Messages);
  assert.ok(client.messages instanceof Messages);
  assert.match(import.meta.resolve('@anthropic-ai/sdk'), /\/index\.mjs$/);
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
