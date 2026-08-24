// The runner copies this directory into every project as ./shared/ (see ../README.md).
// Each case throws on failure and touches only globals that Node >= 20, Bun, Deno, workerd, the
// edge runtime and browsers all have (fetch, WebCrypto, File, AbortController), so every project
// registers the same cases with its own test runner or harness.
import Anthropic, { toFile } from '@anthropic-ai/sdk';
import type { RawMessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';

export const params = {
  model: 'mock-model',
  max_tokens: 32,
  messages: [{ role: 'user' as const, content: 'Hi' }],
};

export function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

/** Compares JSON-shaped values by their serialisation, which is all the cases need. */
export function equal(actual: unknown, expected: unknown): void {
  const [a, e] = [JSON.stringify(actual), JSON.stringify(expected)];
  if (a !== e) throw new Error(`expected ${e}, got ${a}`);
}

async function hmacSHA256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), algorithm, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export const cases: Record<string, (client: Anthropic) => Promise<void>> = {
  'messages.create': async (client) => {
    const message = await client.messages.create(params);
    const block = message.content[0];
    equal(block?.type === 'text' && block.text, 'Hello from mock');
    equal(message.usage.output_tokens, 5);
  },

  'messages.stream helper': async (client) => {
    const stream = client.messages.stream(params);
    let text = '';
    stream.on('text', (delta) => (text += delta));
    const message = await stream.finalMessage();
    equal(text, 'Hello from mock');
    equal(message.content, [{ type: 'text', text: 'Hello from mock', citations: null }]);
    equal(message.stop_reason, 'end_turn');
  },

  'messages.create({ stream: true }) async iteration': async (client) => {
    const stream = await client.messages.create({ ...params, stream: true });
    const events: RawMessageStreamEvent['type'][] = [];
    for await (const event of stream) events.push(event.type);
    equal(events, [
      'message_start',
      'content_block_start',
      'content_block_delta',
      'content_block_delta',
      'content_block_stop',
      'message_delta',
      'message_stop',
    ]);
  },

  'models.list auto-pagination': async (client) => {
    const ids: string[] = [];
    for await (const model of client.models.list({ limit: 2 })) ids.push(model.id);
    equal(ids, ['mock-model-3', 'mock-model-2', 'mock-model-1']);
  },

  'beta.files.upload via toFile (bytes, Blob) and from a File': async (client) => {
    // bun-types' Blob declares no slice(), so a Blob is not statically a toFile input there (see
    // bun/type-tests.ts); every runtime's Blob is one, so widen the signature for that call only.
    const blobToFile = toFile as (blob: unknown, name: string) => Promise<File>;
    for (const file of [
      await toFile(new TextEncoder().encode('hello world'), 'upload.txt'),
      await blobToFile(new Blob(['hello world']), 'upload.txt'),
      new File(['hello world'], 'upload.txt', { type: 'text/plain' }),
    ]) {
      const uploaded = await client.beta.files.upload({ file });
      equal([uploaded.filename, uploaded.size_bytes], ['upload.txt', 11]);
      // toFile does not carry a Blob's own type over, so only the File pins the part's content-type.
      if (file.type) check(uploaded.mime_type.startsWith('text/plain'), `mime_type was ${uploaded.mime_type}`);
    }
  },

  'API errors map to typed error classes': async (client) => {
    const error = await client.messages.create({ ...params, model: 'mock-error' }).catch((e: unknown) => e);
    check(error instanceof Anthropic.BadRequestError, `expected a BadRequestError, got ${String(error)}`);
    check(error instanceof Anthropic.APIError, 'BadRequestError is not an APIError');
    equal(error.status, 400);
    equal(error.error, {
      type: 'error',
      error: { type: 'invalid_request_error', message: 'mock-error: this model always fails' },
      request_id: 'req_mock_0123456789',
    });
  },

  'beta.webhooks.unwrap verifies a signature made with WebCrypto': async (client) => {
    const secret = 'ecosystem-test-webhook-secret';
    const body = JSON.stringify({
      id: 'whe_mock',
      type: 'event',
      created_at: '2025-01-01T00:00:00Z',
      data: { id: 'sesn_mock', type: 'session.status_idled', organization_id: 'org', workspace_id: 'ws' },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = {
      'webhook-id': 'msg_1',
      'webhook-timestamp': timestamp,
      'webhook-signature': `v1,${await hmacSHA256(secret, `msg_1.${timestamp}.${body}`)}`,
    };
    const key = `whsec_${btoa(secret)}`;
    equal(client.beta.webhooks.unwrap(body, { headers, key }), JSON.parse(body));
    let forged: unknown = 'accepted';
    try {
      client.beta.webhooks.unwrap(body.replace('whe_mock', 'whe_forged'), { headers, key });
    } catch (e) {
      forged = e;
    }
    check(
      forged instanceof Error && forged.message === 'No matching signature found',
      `forged body was not rejected: ${String(forged)}`,
    );
  },

  'request timeout': async (client) => {
    const error = await client.messages
      .create({ ...params, model: 'mock-slow' }, { timeout: 300, maxRetries: 0 })
      .catch((e: unknown) => e);
    check(
      error instanceof Anthropic.APIConnectionTimeoutError,
      `expected an APIConnectionTimeoutError, got ${String(error)}`,
    );
  },

  'aborting an in-flight stream': async (client) => {
    const controller = new AbortController();
    const stream = client.messages.stream({ ...params, model: 'mock-slow' }, { signal: controller.signal });
    setTimeout(() => controller.abort(), 100);
    const error = await stream.finalMessage().catch((e: unknown) => e);
    check(
      error instanceof Anthropic.APIUserAbortError,
      `expected an APIUserAbortError, got ${String(error)}`,
    );
  },
};

export type Result = { name: string; ok: boolean; error?: string };

/** For harnesses without a test runner: runs every case, then `extra`, and reports instead of throwing. */
export async function runCases(client: Anthropic, extra: typeof cases = {}): Promise<Result[]> {
  const results: Result[] = [];
  for (const [name, run] of Object.entries({ ...cases, ...extra })) {
    try {
      await run(client);
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: e instanceof Error ? e.stack ?? e.message : String(e) });
    }
  }
  return results;
}
