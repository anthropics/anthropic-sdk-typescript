import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
// no "type" in package.json + module node16: this file is CommonJS, so both specifiers must
// resolve through the "require" condition of the exports map (index.js / resources/*.js)
import { Messages } from '@anthropic-ai/sdk/resources/messages';

const client = new Anthropic();

test('emitted as CommonJS and resolved via the "require" condition', async () => {
  assert.equal(typeof require, 'function');
  assert.match(require.resolve('@anthropic-ai/sdk'), /[\\/]index\.js$/);
  assert.match(require.resolve('@anthropic-ai/sdk/resources/messages'), /[\\/]resources[\\/]messages\.js$/);
  assert.ok(client.messages instanceof Messages);
  // node16 keeps `import()` as a real dynamic import from CJS, which takes the "import" condition:
  // a second, ESM copy of the SDK (dual package), still fully functional
  const esm = await import('@anthropic-ai/sdk');
  assert.notEqual(esm.default, Anthropic);
  assert.equal(new esm.default({ apiKey: 'x' }).messages instanceof Messages, false);
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
