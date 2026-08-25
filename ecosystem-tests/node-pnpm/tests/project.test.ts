import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { Messages } from '@anthropic-ai/sdk/resources/messages';

const client = new Anthropic();

test('SDK imports and runs with the optional zod peer absent (zod is unresolvable here)', async () => {
  // checked from the SDK's own install location too: pnpm resolves a package's peers from there
  const peer = 'zod';
  await assert.rejects(import(peer), { code: 'ERR_MODULE_NOT_FOUND' });
  const requireFromSdk = createRequire(createRequire(import.meta.url).resolve('@anthropic-ai/sdk'));
  assert.throws(() => requireFromSdk.resolve(peer), { code: 'MODULE_NOT_FOUND' });

  assert.ok(client.messages instanceof Messages);
  const message = await client.messages.create({
    model: 'mock-model',
    max_tokens: 16,
    messages: [{ role: 'user', content: 'hi' }],
  });
  assert.equal(message.content[0]?.type, 'text');
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
