import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
// no "type" in package.json: CommonJS under both tsconfigs; `moduleResolution: node` finds the subpath
// via the published directory layout, `nodenext` via the exports map "require" condition
import { Messages } from '@anthropic-ai/sdk/resources/messages';

const client = new Anthropic();

test('emitted as CommonJS; subpath is the same module instance', () => {
  assert.equal(typeof require, 'function');
  assert.match(require.resolve('@anthropic-ai/sdk'), /[\\/]index\.js$/);
  assert.ok(client.messages instanceof Messages);
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
