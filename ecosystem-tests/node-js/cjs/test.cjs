// @ts-check
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const fs = require('node:fs');
const sdk = require('@anthropic-ai/sdk');
const { default: Anthropic, toFile } = require('@anthropic-ai/sdk');
const { Messages } = require('@anthropic-ai/sdk/resources/messages');

const client = new Anthropic();
const params = {
  model: 'mock-model',
  max_tokens: 32,
  messages: [{ role: /** @type {const} */ ('user'), content: 'Hi' }],
};

test('require() shapes', () => {
  assert.equal(sdk.Anthropic, Anthropic);
  assert.equal(sdk.default, Anthropic);
  // @ts-expect-error `new require('@anthropic-ai/sdk')()` works at runtime for backwards compatibility but is untyped
  const legacy = new sdk();
  assert.ok(legacy instanceof Anthropic);
  assert.ok(client.messages instanceof Messages);
});

test('messages.create', async () => {
  const message = await client.messages.create(params);
  const block = message.content[0];
  assert.equal(block?.type === 'text' && block.text, 'Hello from mock');
});

test('messages.stream helper', async () => {
  const stream = client.messages.stream(params);
  let text = '';
  stream.on('text', (delta) => (text += delta));
  const message = await stream.finalMessage();
  assert.equal(text, 'Hello from mock');
  assert.deepEqual(message.content, [{ type: 'text', text: 'Hello from mock', citations: null }]);
});

test('messages.create({ stream: true }) async iteration', async () => {
  const stream = await client.messages.create({ ...params, stream: true });
  const events = [];
  for await (const event of stream) events.push(event.type);
  assert.equal(events.length, 7);
  assert.equal(events[0], 'message_start');
  assert.equal(events[6], 'message_stop');
});

test('models.list auto-pagination', async () => {
  const ids = [];
  for await (const model of client.models.list({ limit: 2 })) ids.push(model.id);
  assert.deepEqual(ids, ['mock-model-3', 'mock-model-2', 'mock-model-1']);
});

test('beta.files.upload from a read stream, a Buffer and a File', async () => {
  fs.writeFileSync('upload.txt', 'hello world');
  for (const file of [
    fs.createReadStream('upload.txt'),
    await toFile(Buffer.from('hello world'), 'upload.txt'),
    new File(['hello world'], 'upload.txt', { type: 'text/plain' }),
  ]) {
    const uploaded = await client.beta.files.upload({ file });
    assert.equal(uploaded.filename, 'upload.txt');
    assert.equal(uploaded.size_bytes, 11);
  }
});

test('API errors map to typed error classes', async () => {
  const error = await client.messages.create({ ...params, model: 'mock-error' }).catch((e) => e);
  assert.ok(error instanceof Anthropic.BadRequestError);
  assert.equal(error.status, 400);
});

test('beta.webhooks.unwrap verifies the signature', () => {
  const secret = Buffer.from('ecosystem-test-webhook-secret');
  const body = JSON.stringify({
    id: 'whe_mock',
    type: 'event',
    created_at: '2025-01-01T00:00:00Z',
    data: { id: 'sesn_mock', type: 'session.status_idled', organization_id: 'org', workspace_id: 'ws' },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret).update(`msg_1.${timestamp}.${body}`).digest('base64');
  const headers = {
    'webhook-id': 'msg_1',
    'webhook-timestamp': timestamp,
    'webhook-signature': `v1,${signature}`,
  };
  const key = `whsec_${secret.toString('base64')}`;
  assert.deepEqual(client.beta.webhooks.unwrap(body, { headers, key }), JSON.parse(body));
  assert.throws(
    () => client.beta.webhooks.unwrap(body.replace('whe_mock', 'whe_forged'), { headers, key }),
    /No matching signature found/,
  );
});

test('request timeout', async () => {
  const request = client.messages.create({ ...params, model: 'mock-slow' }, { timeout: 300, maxRetries: 0 });
  await assert.rejects(request, Anthropic.APIConnectionTimeoutError);
});

test('aborting an in-flight stream', async () => {
  const controller = new AbortController();
  const stream = client.messages.stream({ ...params, model: 'mock-slow' }, { signal: controller.signal });
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(stream.finalMessage(), Anthropic.APIUserAbortError);
});

// never called; `tsc --checkJs` fails on an unused @ts-expect-error, which is the assertion
async function typeTests() {
  // @ts-expect-error max_tokens is required
  await client.messages.create({ model: 'mock-model', messages: params.messages });
  const { content } = await client.messages.create(params);
  // @ts-expect-error content blocks are a union; narrow on `.type` before reading `.text`
  content[0].text.toUpperCase();
}
