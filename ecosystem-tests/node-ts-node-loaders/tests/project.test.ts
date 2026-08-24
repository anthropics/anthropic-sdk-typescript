import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { Messages } from '@anthropic-ai/sdk/resources/messages';

// an enum is not erasable syntax, so Node's built-in type stripping would reject this file:
// passing proves the loader under test did the transform
enum Expected {
  Text = 'Hello from mock',
}

const client = new Anthropic();

test('transformed by the loader; subpath export is the same module instance as the root ESM entrypoint', async () => {
  const message = await client.messages.create({
    model: 'mock-model',
    max_tokens: 32,
    messages: [{ role: 'user', content: 'Hi' }],
  });
  const block = message.content[0];
  assert.equal(block?.type === 'text' && block.text, Expected.Text);
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
