// Direct unit tests for `copyClientForHelper`.
//
// These verify the load-bearing invariants of the util — auth replaced,
// parent's `X-Api-Key` cleared on the sub-client, helper telemetry header set,
// parent not mutated — without re-exercising `withOptions`'s own inheritance
// contract (which is the SDK's job to keep working).

import Anthropic from '@anthropic-ai/sdk';
import { copyClientForHelper } from '@anthropic-ai/sdk/lib/helper-client';
import { AnthropicError } from '@anthropic-ai/sdk/core/error';

const VALID_MSG_RESPONSE = {
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  content: [],
  model: 'x',
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 0, output_tokens: 0 },
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function farFuture(): number {
  return Math.floor(Date.now() / 1000) + 3600;
}

function getHeader(init: RequestInit | undefined, name: string): string | null {
  if (!init?.headers) return null;
  if (init.headers instanceof Headers) return init.headers.get(name);
  if (Array.isArray(init.headers)) {
    const entry = init.headers.find(([k]) => k?.toLowerCase() === name.toLowerCase());
    return entry?.[1] ?? null;
  }
  return (init.headers as Record<string, string>)[name] ?? null;
}

describe('copyClientForHelper', () => {
  test('sets the bearer auth token on the sub-client', () => {
    const parent = new Anthropic({ apiKey: 'parent-key' });
    const scoped = copyClientForHelper(parent, { authToken: 'env-key', helper: 'environments-work-poller' });
    expect(scoped.authToken).toBe('env-key');
  });

  test("clears the parent's X-Api-Key on the sub-client", () => {
    // Without `apiKey: null` in the override, `withOptions` would inherit the
    // parent's apiKey and the sub-client would emit *both* `X-Api-Key` *and*
    // `Authorization: Bearer …` on every request — exactly the situation
    // this util exists to prevent.
    const parent = new Anthropic({ apiKey: 'parent-key' });
    const scoped = copyClientForHelper(parent, { authToken: 'env-key', helper: 'environments-work-poller' });
    expect(scoped.apiKey).toBeNull();
  });

  test('stamps the helper telemetry header on the sub-client', () => {
    const parent = new Anthropic({ apiKey: 'parent-key' });
    const scoped = copyClientForHelper(parent, { authToken: 'env-key', helper: 'environments-worker' });
    const defaults = (scoped as unknown as { _options: { defaultHeaders: { values: Headers } } })._options
      .defaultHeaders;
    expect(defaults.values.get('x-stainless-helper')).toBe('environments-worker');
  });

  test("preserves the parent's custom defaultHeaders on the sub-client", () => {
    // `withOptions` *replaces* defaultHeaders (no merge), so the util must
    // explicitly fold in the parent's custom defaults — otherwise any
    // headers the consumer configured at construction time would silently
    // disappear from the sub-client's wire requests.
    const parent = new Anthropic({
      apiKey: 'parent-key',
      defaultHeaders: { 'X-Custom-Tenant': 'acme' },
    });
    const scoped = copyClientForHelper(parent, { authToken: 'env-key', helper: 'environments-work-poller' });
    const defaults = (scoped as unknown as { _options: { defaultHeaders: { values: Headers } } })._options
      .defaultHeaders;
    expect(defaults.values.get('x-custom-tenant')).toBe('acme');
    expect(defaults.values.get('x-stainless-helper')).toBe('environments-work-poller');
  });

  test('does not mutate the parent client', () => {
    // Building the sub-client must not touch the parent's auth state — a
    // long-lived parent could otherwise be silently re-credentialed every
    // time a runner helper started.
    const parent = new Anthropic({ apiKey: 'parent-key' });
    copyClientForHelper(parent, { authToken: 'env-key', helper: 'environments-work-poller' });
    expect(parent.apiKey).toBe('parent-key');
    expect(parent.authToken).toBeNull();
  });

  test('throws on an empty auth token', () => {
    // An empty `authToken` would otherwise silently produce a sub-client
    // with `authToken: ""` which both fails auth and looks like a
    // misconfiguration — fail loudly instead.
    const parent = new Anthropic({ apiKey: 'parent-key' });
    expect(() => copyClientForHelper(parent, { authToken: '', helper: 'environments-work-poller' })).toThrow(
      AnthropicError,
    );
  });

  test('returns the same concrete subclass as the parent', () => {
    // The generic `<T extends Anthropic>` keeps the caller's compile-time
    // subclass; at runtime `withOptions()` uses `this.constructor`, so the
    // sub-client is always an instance of the parent's class.
    const parent = new Anthropic({ apiKey: 'parent-key' });
    const scoped = copyClientForHelper(parent, { authToken: 'env-key', helper: 'session-tool-runner' });
    expect(scoped).toBeInstanceOf(Anthropic);
  });
});

describe('copyClientForHelper — auth state inheritance', () => {
  test('inherits workspace header from parent auth state but uses its own bearer token', async () => {
    const captured: {
      auth: string | null;
      workspace: string | null;
      helper: string | null;
      apiKey: string | null;
    }[] = [];
    const parent = new Anthropic({
      apiKey: null,
      credentials: async () => ({ token: 'parent-oauth-tok', expiresAt: farFuture() }),
      fetch: async (_url: any, init?: RequestInit) => {
        captured.push({
          auth: getHeader(init, 'authorization'),
          workspace: getHeader(init, 'anthropic-workspace-id'),
          helper: getHeader(init, 'x-stainless-helper'),
          apiKey: getHeader(init, 'x-api-key'),
        });
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });
    (parent as any)._authState.extraHeaders = { 'anthropic-workspace-id': 'ws-tenant-42' };

    await parent.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });

    const helper = copyClientForHelper(parent, {
      authToken: 'env-scoped-bearer',
      helper: 'environments-work-poller',
    });

    await helper.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });

    // Parent: OAuth token + workspace header, no helper tag
    expect(captured[0]!.auth).toBe('Bearer parent-oauth-tok');
    expect(captured[0]!.workspace).toBe('ws-tenant-42');
    expect(captured[0]!.helper).toBeNull();

    // Helper sub-client: new bearer token + same workspace + helper tag, no api key
    expect(captured[1]!.auth).toBe('Bearer env-scoped-bearer');
    expect(captured[1]!.workspace).toBe('ws-tenant-42');
    expect(captured[1]!.helper).toBe('environments-work-poller');
    expect(captured[1]!.apiKey).toBeNull();
  });

  test('inherits resolved baseURL from parent', async () => {
    const seenURLs: string[] = [];
    const parent = new Anthropic({
      apiKey: null,
      credentials: async () => ({ token: 'tok', expiresAt: farFuture() }),
      fetch: async (url: any) => {
        seenURLs.push(String(url));
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });
    // Simulate a profile-resolved baseURL (not set via constructor, so _baseURLIsExplicit stays false)
    (parent as any).baseURL = 'https://custom.anthropic.example';

    await parent.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });

    const helper = copyClientForHelper(parent, {
      authToken: 'env-bearer',
      helper: 'environments-worker',
    });

    await helper.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(seenURLs[0]).toMatch(/^https:\/\/custom\.anthropic\.example\//);
    expect(seenURLs[1]).toMatch(/^https:\/\/custom\.anthropic\.example\//);
  });
});
