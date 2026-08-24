import { createHmac } from 'node:crypto';
import * as fs from 'node:fs';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
// deep subpath import: must resolve under moduleResolution node10 via the published directory layout
import { Messages, type RawMessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';

const client = new Anthropic();
const params = { model: 'mock-model', max_tokens: 32, messages: [{ role: 'user' as const, content: 'Hi' }] };

test('subpath export resolves to the same module instance', () => {
  expect(client.messages).toBeInstanceOf(Messages);
});

test('messages.create', async () => {
  const message = await client.messages.create(params);
  const block = message.content[0];
  expect(block?.type === 'text' && block.text).toBe('Hello from mock');
  expect(message.usage.output_tokens).toBe(5);
});

test('messages.stream helper', async () => {
  const stream = client.messages.stream(params);
  let text = '';
  stream.on('text', (delta) => (text += delta));
  const message = await stream.finalMessage();
  expect(text).toBe('Hello from mock');
  expect(message.content).toEqual([{ type: 'text', text: 'Hello from mock', citations: null }]);
  expect(message.stop_reason).toBe('end_turn');
});

test('messages.create({ stream: true }) async iteration', async () => {
  const stream = await client.messages.create({ ...params, stream: true });
  const events: RawMessageStreamEvent['type'][] = [];
  for await (const event of stream) events.push(event.type);
  expect(events).toEqual([
    'message_start',
    'content_block_start',
    'content_block_delta',
    'content_block_delta',
    'content_block_stop',
    'message_delta',
    'message_stop',
  ]);
});

test('models.list auto-pagination', async () => {
  const ids: string[] = [];
  for await (const model of client.models.list({ limit: 2 })) ids.push(model.id);
  expect(ids).toEqual(['mock-model-3', 'mock-model-2', 'mock-model-1']);
});

test('beta.files.upload from a read stream, a Buffer and a File', async () => {
  fs.writeFileSync('upload.txt', 'hello world');
  for (const file of [
    fs.createReadStream('upload.txt'),
    await toFile(Buffer.from('hello world'), 'upload.txt'),
    new File(['hello world'], 'upload.txt', { type: 'text/plain' }),
  ]) {
    expect(await client.beta.files.upload({ file })).toMatchObject({
      filename: 'upload.txt',
      size_bytes: 11,
    });
  }
});

test('API errors map to typed error classes', async () => {
  const error = await client.messages.create({ ...params, model: 'mock-error' }).catch((e) => e);
  expect(error).toBeInstanceOf(Anthropic.BadRequestError);
  expect(error).toBeInstanceOf(Anthropic.APIError);
  expect(error.status).toBe(400);
  expect(error.error).toMatchObject({ type: 'error', error: { type: 'invalid_request_error' } });
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
  expect(client.beta.webhooks.unwrap(body, { headers, key })).toEqual(JSON.parse(body));
  expect(() => client.beta.webhooks.unwrap(body.replace('whe_mock', 'whe_forged'), { headers, key })).toThrow(
    'No matching signature found',
  );
});

test('request timeout', async () => {
  const request = client.messages.create({ ...params, model: 'mock-slow' }, { timeout: 300, maxRetries: 0 });
  await expect(request).rejects.toBeInstanceOf(Anthropic.APIConnectionTimeoutError);
});

test('aborting an in-flight stream', async () => {
  const controller = new AbortController();
  const stream = client.messages.stream({ ...params, model: 'mock-slow' }, { signal: controller.signal });
  setTimeout(() => controller.abort(), 100);
  await expect(stream.finalMessage()).rejects.toBeInstanceOf(Anthropic.APIUserAbortError);
});
