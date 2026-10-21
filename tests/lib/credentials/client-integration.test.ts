import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { MockInstance } from 'vitest';
import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk';
import type { AccessToken } from '@anthropic-ai/sdk/lib/credentials/types';
import { OAUTH_API_BETA_HEADER } from '@anthropic-ai/sdk/lib/credentials/types';

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

describe('client credentials integration', () => {
  let testDir: string;
  const originalEnv: Record<string, string | undefined> = {};

  const envVars = [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_CONFIG_DIR',
    'ANTHROPIC_FEDERATION_RULE_ID',
    'ANTHROPIC_IDENTITY_TOKEN',
    'ANTHROPIC_IDENTITY_TOKEN_FILE',
    'ANTHROPIC_ORGANIZATION_ID',
    'ANTHROPIC_PROFILE',
  ];

  beforeEach(() => {
    for (const name of envVars) {
      originalEnv[name] = process.env[name];
      delete process.env[name];
    }
    testDir = mkdtempSync(path.join(tmpdir(), 'client-creds-test-'));
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
    fs.rmSync(testDir, { recursive: true });
  });

  function writeProfile(name: string, opts: { base_url?: string } = {}) {
    fs.mkdirSync(path.join(testDir, 'configs'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'credentials'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'configs', `${name}.json`),
      JSON.stringify({ ...opts, authentication: { type: 'user_oauth' } }),
    );
    fs.writeFileSync(
      path.join(testDir, 'credentials', `${name}.json`),
      JSON.stringify({ access_token: `${name}-tok`, expires_at: farFuture() }),
      { mode: 0o600 },
    );
  }

  async function sentHeaders(makeClient: (opts: ClientOptions) => Anthropic): Promise<Headers> {
    let headers: Headers | undefined;
    const client = makeClient({
      fetch: async (url, init) => {
        if ((typeof url === 'string' ? url : url.toString()).includes('/v1/oauth/token')) {
          return jsonResponse({ access_token: 'federated-tok', expires_in: 3600 });
        }
        headers = new Headers(init?.headers);
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });
    await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    return headers!;
  }

  it('ANTHROPIC_API_KEY env var shadows a profile-configured federation config', async () => {
    process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
    process.env['ANTHROPIC_API_KEY'] = 'sk-env-key';
    const tokenPath = path.join(testDir, 'id-token');
    fs.mkdirSync(path.join(testDir, 'configs'), { recursive: true });
    fs.writeFileSync(tokenPath, 'my-jwt');
    fs.writeFileSync(
      path.join(testDir, 'configs', 'default.json'),
      JSON.stringify({
        organization_id: 'org-123',
        authentication: {
          type: 'oidc_federation',
          federation_rule_id: 'fdrl_01abc',
          identity_token: { source: 'file', path: tokenPath },
        },
      }),
    );

    let exchanged = false;
    const client = new Anthropic({
      fetch: async (url, init) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/v1/oauth/token')) {
          exchanged = true;
          return jsonResponse({ access_token: 'should-not-happen', expires_in: 3600 });
        }
        expect(getHeader(init, 'authorization')).toBe('Bearer sk-env-key');
        expect(getHeader(init, 'x-api-key')).toBeNull();
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(exchanged).toBe(false);
    expect(client.credentials).toBeNull(); // lazy resolution never started
  });

  it('uses explicit credentials provider for bearer auth', async () => {
    const client = new Anthropic({
      apiKey: null,
      credentials: async () => ({ token: 'my-access-token', expiresAt: farFuture() }),
      fetch: async (_url, init) => {
        expect(getHeader(init, 'authorization')).toBe('Bearer my-access-token');
        expect(getHeader(init, 'anthropic-beta')).toContain(OAUTH_API_BETA_HEADER);
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('joins the oauth beta to request betas with a comma and no space', async () => {
    const client = new Anthropic({
      apiKey: null,
      credentials: async () => ({ token: 'my-access-token', expiresAt: farFuture() }),
      fetch: async (_url, init) => {
        expect(getHeader(init, 'anthropic-beta')).toBe(`files-api-2025-04-14,${OAUTH_API_BETA_HEADER}`);
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    await client.beta.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
      betas: ['files-api-2025-04-14'],
    });
  });

  it('lazily resolves credentials from env vars on first request', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');

    process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'nonexistent');
    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_test';
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-test';
    process.env['ANTHROPIC_IDENTITY_TOKEN_FILE'] = tokenPath;

    let tokenExchanged = false;
    const client = new Anthropic({
      fetch: async (url, init) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/v1/oauth/token')) {
          tokenExchanged = true;
          // The token-exchange UA matches the client's API-request UA
          expect(getHeader(init, 'User-Agent')).toMatch(/^Anthropic\/JS /);
          return jsonResponse({ access_token: 'resolved-tok', expires_in: 3600 });
        }
        expect(getHeader(init, 'authorization')).toBe('Bearer resolved-tok');
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(tokenExchanged).toBe(true);
  });

  it('retries on 401 after invalidating token cache', async () => {
    let callCount = 0;
    const client = new Anthropic({
      apiKey: null,
      maxRetries: 1,
      credentials: async () => {
        callCount++;
        return { token: `tok-${callCount}`, expiresAt: farFuture() };
      },
      fetch: async (_url, init) => {
        if (getHeader(init, 'authorization') === 'Bearer tok-1') {
          return jsonResponse({ error: { type: 'authentication_error', message: 'expired' } }, 401);
        }
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(callCount).toBe(2);
  });

  it('caps 401-triggered refresh to once per request', async () => {
    let providerCalls = 0;
    const client = new Anthropic({
      apiKey: null,
      maxRetries: 5,
      credentials: async () => {
        providerCalls++;
        return { token: `tok-${providerCalls}`, expiresAt: farFuture() };
      },
      // Always 401 — refreshed token is also rejected
      fetch: async () => jsonResponse({ error: { type: 'authentication_error', message: 'nope' } }, 401),
    });

    await expect(
      client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow();
    // 1 initial + 1 refresh-retry. Further 401s do NOT trigger more refreshes.
    expect(providerCalls).toBe(2);
  });

  it('does not refresh on 401 when apiKey was used', async () => {
    let fetchCalls = 0;
    const client = new Anthropic({
      apiKey: 'sk-test',
      maxRetries: 1,
      fetch: async () => {
        fetchCalls++;
        return jsonResponse({ error: { type: 'authentication_error', message: 'nope' } }, 401);
      },
    });

    await expect(
      client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow();
    expect(fetchCalls).toBe(1);
  });

  it('surfaces lazy credential resolution errors on first request without unhandled rejection', async () => {
    process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
    fs.mkdirSync(path.join(testDir, 'configs'), { recursive: true });
    // Config with unknown auth type → loadConfig() throws
    fs.writeFileSync(
      path.join(testDir, 'configs', 'default.json'),
      JSON.stringify({ authentication: { type: 'mystery' } }),
    );

    const rejections: unknown[] = [];
    const onUnhandled = (err: unknown) => rejections.push(err);
    process.on('unhandledRejection', onUnhandled);
    try {
      const client = new Anthropic({ fetch: async () => jsonResponse({}) });
      // Give the eager resolution promise a tick to settle
      await new Promise((r) => setImmediate(r));
      expect(rejections).toEqual([]);

      // Error surfaces on first request with the root cause, not the generic message
      await expect(
        client.messages.create({
          model: 'claude-opus-4-8',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      ).rejects.toThrow('not a known authentication type');
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('throws when no auth can be resolved', async () => {
    process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'empty');
    fs.mkdirSync(path.join(testDir, 'empty'), { recursive: true });

    const client = new Anthropic({
      fetch: async () => jsonResponse({}),
    });

    await expect(
      client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow('Could not resolve authentication method');
  });

  it('resolves credentials from explicit config option (oidc_federation)', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'explicit-jwt');

    let exchanged = false;
    const client = new Anthropic({
      apiKey: null,
      config: {
        organization_id: 'org-explicit',
        workspace_id: 'wrkspc_x',
        authentication: {
          type: 'oidc_federation',
          federation_rule_id: 'fdrl_explicit',
          identity_token: { source: 'file', path: tokenPath },
        },
      },
      fetch: async (url, init) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/v1/oauth/token')) {
          exchanged = true;
          const body = JSON.parse(init!.body as string);
          expect(body.federation_rule_id).toBe('fdrl_explicit');
          expect(body.assertion).toBe('explicit-jwt');
          expect(body.workspace_id).toBe('wrkspc_x');
          return jsonResponse({ access_token: 'explicit-tok', expires_in: 3600 });
        }
        expect(getHeader(init, 'authorization')).toBe('Bearer explicit-tok');
        // Federation profiles send workspace_id in the exchange body, not as a header.
        expect(getHeader(init, 'anthropic-workspace-id')).toBeNull();
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(exchanged).toBe(true);
  });

  it('throws descriptive error when config option is incomplete', () => {
    expect(
      () =>
        new Anthropic({
          apiKey: null,
          config: { authentication: { type: 'user_oauth' } }, // no credentials_path
        }),
    ).toThrow('user_oauth config requires authentication.credentials_path');

    expect(
      () =>
        new Anthropic({
          apiKey: null,
          config: {
            organization_id: 'org-x',
            authentication: { type: 'oidc_federation', federation_rule_id: 'fdrl_x' },
          }, // no identity_token
        }),
    ).toThrow('requires an identity token');
  });

  it('explicit Authorization header bypasses a stored credential resolution error', async () => {
    process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
    fs.mkdirSync(path.join(testDir, 'configs'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'configs', 'default.json'),
      JSON.stringify({ authentication: { type: 'mystery' } }), // makes resolution fail
    );

    const client = new Anthropic({
      defaultHeaders: { Authorization: 'Bearer override-tok' },
      fetch: async (_url, init) => {
        expect(getHeader(init, 'authorization')).toBe('Bearer override-tok');
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    // Give resolution a tick to settle (and fail)
    await new Promise((r) => setImmediate(r));

    // Explicit header escape hatch wins; resolution error is not thrown
    await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('withOptions clone created before lazy resolution settles shares the result', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');

    process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'nonexistent');
    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_test';
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-test';
    process.env['ANTHROPIC_IDENTITY_TOKEN_FILE'] = tokenPath;

    let exchangeCount = 0;
    const fetchImpl = async (url: any, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/v1/oauth/token')) {
        exchangeCount++;
        return jsonResponse({ access_token: 'shared-tok', expires_in: 3600 });
      }
      expect(getHeader(init, 'authorization')).toBe('Bearer shared-tok');
      return jsonResponse(VALID_MSG_RESPONSE);
    };

    const parent = new Anthropic({ fetch: fetchImpl });
    // Clone immediately, before lazy resolution has a chance to settle
    const clone = parent.withOptions({ timeout: 5000 });

    await Promise.all([
      parent.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      clone.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ]);

    // Shared auth state → only ONE token exchange for both clients
    expect(exchangeCount).toBe(1);
    expect(clone.credentials).toBe(parent.credentials);
  });

  it('withOptions clone created before resolution settles receives extraHeaders (workspace_id)', async () => {
    process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
    fs.mkdirSync(path.join(testDir, 'configs'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'credentials'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'configs', 'default.json'),
      JSON.stringify({ workspace_id: 'ws-shared', authentication: { type: 'user_oauth' } }),
    );
    fs.writeFileSync(
      path.join(testDir, 'credentials', 'default.json'),
      JSON.stringify({ access_token: 'tok', expires_at: farFuture() }),
      { mode: 0o600 },
    );

    const seenWs: (string | null)[] = [];
    const fetchImpl = async (_url: any, init?: RequestInit): Promise<Response> => {
      seenWs.push(getHeader(init, 'anthropic-workspace-id'));
      return jsonResponse(VALID_MSG_RESPONSE);
    };

    const parent = new Anthropic({ fetch: fetchImpl });
    const clone = parent.withOptions({ timeout: 5000 }); // before resolution settles

    for (const c of [parent, clone]) {
      await c.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    }

    expect(seenWs).toEqual(['ws-shared', 'ws-shared']);
  });

  it('per-request workspace_id overrides the profile workspace_id header', async () => {
    process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
    fs.mkdirSync(path.join(testDir, 'configs'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'credentials'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'configs', 'default.json'),
      JSON.stringify({ workspace_id: 'ws-profile', authentication: { type: 'user_oauth' } }),
    );
    fs.writeFileSync(
      path.join(testDir, 'credentials', 'default.json'),
      JSON.stringify({ access_token: 'tok', expires_at: farFuture() }),
      { mode: 0o600 },
    );

    const seenWs: (string | null)[] = [];
    const client = new Anthropic({
      fetch: async (_url: any, init?: RequestInit) => {
        seenWs.push(getHeader(init, 'anthropic-workspace-id'));
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    await client.messages.create({ model: 'claude-opus-4-8', max_tokens: 1, messages: [] });
    await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [],
      workspace_id: 'ws-request',
    });

    expect(seenWs).toEqual(['ws-profile', 'ws-request']);
  });

  it('pins withOptions({apiKey: null}) and ({credentials: null}) override semantics', async () => {
    process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'empty');
    fs.mkdirSync(path.join(testDir, 'empty'), { recursive: true });

    const seen: string[] = [];
    const parent = new Anthropic({
      apiKey: null,
      credentials: async () => ({ token: 'parent', expiresAt: farFuture() }),
      fetch: async (_url, init) => {
        seen.push(getHeader(init, 'authorization') ?? '');
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    // apiKey: null → overridesAuth=true (key is present), so the clone builds
    // a fresh _auth with its OWN TokenCache wrapping the inherited provider.
    // The clone authenticates with the same token but does not share the
    // parent's cache.
    const reset1 = parent.withOptions({ apiKey: null });
    await reset1.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(seen).toEqual(['Bearer parent']);

    // credentials: null → overridesAuth=true AND options.credentials=null
    // overrides the spread, so the clone has no provider and (with an empty
    // config dir) hits the "could not resolve" error.
    const reset2 = parent.withOptions({ credentials: null });
    await expect(
      reset2.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow('Could not resolve authentication method');
  });

  it('withOptions clone observes parent resolution failure', async () => {
    process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
    fs.mkdirSync(path.join(testDir, 'configs'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'configs', 'default.json'),
      JSON.stringify({ authentication: { type: 'mystery' } }),
    );

    const parent = new Anthropic({ fetch: async () => jsonResponse({}) });
    const clone = parent.withOptions({ timeout: 5000 });
    await new Promise((r) => setImmediate(r));

    await expect(
      clone.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow('not a known authentication type');
  });

  it('withOptions with explicit auth override does NOT share parent auth state', async () => {
    const parent = new Anthropic({
      apiKey: null,
      credentials: async () => ({ token: 'parent-tok', expiresAt: farFuture() }),
      fetch: async () => jsonResponse(VALID_MSG_RESPONSE),
    });
    const clone = parent.withOptions({
      credentials: async () => ({ token: 'clone-tok', expiresAt: farFuture() }),
    });

    expect(clone.credentials).not.toBe(parent.credentials);
  });

  it('nested withOptions: auth override on second hop is honored', async () => {
    const seenAuths: string[] = [];
    const fetchImpl = async (_url: any, init?: RequestInit): Promise<Response> => {
      seenAuths.push(getHeader(init, 'authorization') ?? '');
      return jsonResponse(VALID_MSG_RESPONSE);
    };

    const a = new Anthropic({
      apiKey: null,
      credentials: async () => ({ token: 'A', expiresAt: farFuture() }),
      fetch: fetchImpl,
    });
    const b = a.withOptions({ timeout: 1000 }); // shares a's auth
    const c = b.withOptions({ credentials: async () => ({ token: 'C', expiresAt: farFuture() }) }); // override
    const d = b.withOptions({ apiKey: 'sk-d' }); // override with apiKey

    for (const client of [a, b, c, d]) {
      await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    }

    expect(seenAuths).toEqual(['Bearer A', 'Bearer A', 'Bearer C', 'Bearer sk-d']);
  });

  it('401-refresh-once flag resets between top-level requests sharing options object', async () => {
    let providerCalls = 0;
    let fetchCalls = 0;
    const client = new Anthropic({
      apiKey: null,
      maxRetries: 5,
      credentials: async () => {
        providerCalls++;
        return { token: `tok-${providerCalls}`, expiresAt: farFuture() };
      },
      fetch: async () => {
        fetchCalls++;
        // First two calls 401 (initial + refresh-retry), then succeed
        if (fetchCalls <= 2) {
          return jsonResponse({ error: { type: 'authentication_error', message: 'nope' } }, 401);
        }
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    const sharedOpts = {
      method: 'post' as const,
      path: '/v1/messages',
      body: { model: 'claude-opus-4-8', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] },
    };

    // First request: 401 → refresh → 401 → fail (didRefreshFor401 set)
    await expect(client.request(sharedOpts)).rejects.toThrow();
    expect(providerCalls).toBe(2);

    // Second request with the SAME options object: flag must be reset so the
    // 401-refresh fires again (1 more provider call). If the flag persisted,
    // providerCalls would stay at 2.
    fetchCalls = 0;
    await expect(client.request(sharedOpts)).rejects.toThrow();
    expect(providerCalls).toBe(3);
  });

  it('withOptions propagates credentials to new client', async () => {
    const provider = async (): Promise<AccessToken> => ({
      token: 'propagated-tok',
      expiresAt: farFuture(),
    });

    const client = new Anthropic({
      apiKey: null,
      credentials: provider,
      fetch: async () => jsonResponse(VALID_MSG_RESPONSE),
    });

    const copied = client.withOptions({ timeout: 5000 });
    expect(copied.credentials).toBe(provider);
  });

  describe('apiKey and authToken share the Authorization header', () => {
    beforeEach(() => {
      process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'empty');
    });

    it.each<{
      name: string;
      env?: Record<string, string>;
      options?: ClientOptions;
      copy?: ClientOptions;
      sent: string;
    }>([
      { name: 'apiKey', options: { apiKey: 'sk-key' }, sent: 'sk-key' },
      { name: 'ANTHROPIC_API_KEY', env: { ANTHROPIC_API_KEY: 'sk-env-key' }, sent: 'sk-env-key' },
      {
        name: 'authToken beats ANTHROPIC_API_KEY',
        env: { ANTHROPIC_API_KEY: 'sk-env-key' },
        options: { authToken: 'tok' },
        sent: 'tok',
      },
      {
        name: 'apiKey beats ANTHROPIC_AUTH_TOKEN',
        env: { ANTHROPIC_AUTH_TOKEN: 'env-tok' },
        options: { apiKey: 'sk-key' },
        sent: 'sk-key',
      },
      {
        name: "withOptions({authToken}) replaces the parent's ANTHROPIC_API_KEY",
        env: { ANTHROPIC_API_KEY: 'sk-env-key' },
        copy: { authToken: 'tok' },
        sent: 'tok',
      },
      {
        name: 'ANTHROPIC_API_KEY beats ANTHROPIC_AUTH_TOKEN',
        env: { ANTHROPIC_API_KEY: 'sk-env-key', ANTHROPIC_AUTH_TOKEN: 'env-tok' },
        sent: 'sk-env-key',
      },
    ])('$name', async ({ env, options, copy, sent }) => {
      Object.assign(process.env, env);
      const headers = await sentHeaders((opts) => {
        const client = new Anthropic({ ...opts, ...options });
        return copy ? client.withOptions(copy) : client;
      });
      expect(headers.get('authorization')).toBe(`Bearer ${sent}`);
      expect(headers.get('x-api-key')).toBeNull();
    });

    it('does not read the environment for the other credential', () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-env-key';
      process.env['ANTHROPIC_AUTH_TOKEN'] = 'env-tok';
      expect(new Anthropic({ authToken: 'tok' }).apiKey).toBeNull();
      expect(new Anthropic({ apiKey: 'sk-key' }).authToken).toBeNull();
    });

    it.each<ClientOptions>([{ apiKey: 'sk-key' }, {}])(
      'a hand-set X-Api-Key replaces Authorization (options %o)',
      async (options) => {
        process.env['ANTHROPIC_API_KEY'] = 'sk-env-key';
        const headers = await sentHeaders(
          (opts) =>
            new Anthropic({
              ...opts,
              ...options,
              defaultHeaders: { 'X-Api-Key': 'sk-key', Authorization: null },
            }),
        );
        expect(headers.get('x-api-key')).toBe('sk-key');
        expect(headers.get('authorization')).toBeNull();
      },
    );

    it('a client with no credential needs Authorization: null', async () => {
      const headers = await sentHeaders(
        (opts) => new Anthropic({ ...opts, defaultHeaders: { Authorization: null } }),
      );
      expect(headers.get('authorization')).toBeNull();
      await expect(
        sentHeaders((opts) => new Anthropic({ ...opts, defaultHeaders: { 'X-Api-Key': null } })),
      ).rejects.toThrow('Could not resolve authentication method');
    });

    it('a hand-set X-Api-Key goes out next to authToken', async () => {
      const headers = await sentHeaders(
        (opts) => new Anthropic({ ...opts, authToken: 'tok', defaultHeaders: { 'X-Api-Key': 'sk-key' } }),
      );
      expect(headers.get('x-api-key')).toBe('sk-key');
      expect(headers.get('authorization')).toBe('Bearer tok');
    });
  });

  describe('apiKey as a function', () => {
    beforeEach(() => {
      process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'empty');
    });

    function keysSent(options: ClientOptions): { client: Anthropic; sent: (string | null)[] } {
      const sent: (string | null)[] = [];
      const statuses = [500, 200, 200];
      const client = new Anthropic({
        ...options,
        fetch: async (_url, init) => {
          sent.push(new Headers(init?.headers).get('authorization'));
          return jsonResponse(VALID_MSG_RESPONSE, statuses[sent.length - 1]);
        },
      });
      return { client, sent };
    }

    const create = (client: Anthropic) =>
      client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });

    it('is called before each request, retries included', async () => {
      let calls = 0;
      const { client, sent } = keysSent({ apiKey: async () => `sk-key-${++calls}`, maxRetries: 1 });
      await create(client);
      await create(client);
      expect(sent).toEqual(['Bearer sk-key-1', 'Bearer sk-key-2', 'Bearer sk-key-3']);
      expect(client.apiKey).toBeNull();
    });

    it('is kept by a copy, and replaced by a credential passed to withOptions', async () => {
      const { client, sent } = keysSent({ apiKey: async () => 'sk-key', maxRetries: 0 });
      await expect(create(client)).rejects.toThrow(Anthropic.InternalServerError);
      await create(client.withOptions({ timeout: 1000 }));
      await create(client.withOptions({ authToken: 'tok' }));
      expect(sent).toEqual(['Bearer sk-key', 'Bearer sk-key', 'Bearer tok']);
    });

    it('wraps what the function throws', async () => {
      const cause = new Error('vault is sealed');
      const { client, sent } = keysSent({
        apiKey: async () => {
          throw cause;
        },
      });
      const error = await create(client).catch((err) => err);
      expect(error).toBeInstanceOf(Anthropic.AnthropicError);
      expect(error.message).toBe('The `apiKey` function failed: vault is sealed');
      expect(error.cause).toBe(cause);
      expect(sent).toEqual([]);
    });

    it('rejects an empty key', async () => {
      const { client, sent } = keysSent({ apiKey: async () => '' });
      const error = await create(client).catch((err) => err);
      expect(error).toBeInstanceOf(Anthropic.AnthropicError);
      expect(error.message).toBe('The `apiKey` function must return a non-empty string. It returned "".');
      expect(sent).toEqual([]);
    });
  });

  describe('profile option', () => {
    beforeEach(() => {
      process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
    });

    it('loads the named profile', async () => {
      writeProfile('staging');
      const client = new Anthropic({
        profile: 'staging',
        fetch: async (_url, init) => {
          expect(getHeader(init, 'authorization')).toBe('Bearer staging-tok');
          expect(getHeader(init, 'x-api-key')).toBeNull();
          return jsonResponse(VALID_MSG_RESPONSE);
        },
      });
      await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(client.credentials).not.toBeNull();
    });

    it('beats ANTHROPIC_API_KEY in env', async () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-env-should-be-ignored';
      writeProfile('staging');
      const client = new Anthropic({
        profile: 'staging',
        fetch: async (_url, init) => {
          expect(getHeader(init, 'authorization')).toBe('Bearer staging-tok');
          expect(getHeader(init, 'x-api-key')).toBeNull();
          return jsonResponse(VALID_MSG_RESPONSE);
        },
      });
      expect(client.apiKey).toBeNull();
      await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    });

    it('beats ANTHROPIC_PROFILE in env', async () => {
      process.env['ANTHROPIC_PROFILE'] = 'from-env';
      writeProfile('from-env');
      writeProfile('from-ctor');
      const client = new Anthropic({
        profile: 'from-ctor',
        fetch: async (_url, init) => {
          expect(getHeader(init, 'authorization')).toBe('Bearer from-ctor-tok');
          return jsonResponse(VALID_MSG_RESPONSE);
        },
      });
      await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    });

    it('surfaces a clear error when the named profile does not exist', async () => {
      const client = new Anthropic({
        profile: 'nope',
        fetch: async () => jsonResponse(VALID_MSG_RESPONSE),
      });
      await expect(
        client.messages.create({
          model: 'claude-opus-4-8',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      ).rejects.toThrow(/Profile "nope" could not be resolved/);
    });

    it('does not fall back to the federation variables when the named profile does not exist', async () => {
      process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_01abc';
      process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-123';
      process.env['ANTHROPIC_IDENTITY_TOKEN'] = 'my-jwt';
      await expect(sentHeaders((opts) => new Anthropic({ ...opts, profile: 'nope' }))).rejects.toThrow(
        /Profile "nope" could not be resolved/,
      );
    });

    it('withOptions({profile}) on a profile-based parent switches profile', async () => {
      writeProfile('a');
      writeProfile('b');
      const parent = new Anthropic({
        profile: 'a',
        fetch: async () => jsonResponse(VALID_MSG_RESPONSE),
      });
      const clone = parent.withOptions({
        profile: 'b',
        fetch: async (_url, init) => {
          expect(getHeader(init, 'authorization')).toBe('Bearer b-tok');
          return jsonResponse(VALID_MSG_RESPONSE);
        },
      });
      await clone.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    });
  });

  describe('one credential per client', () => {
    const names = ['apiKey', 'authToken', 'credentials', 'config', 'profile'] as const;
    type Name = (typeof names)[number];

    const sent: Record<Name, string> = {
      apiKey: 'sk-key',
      authToken: 'tok',
      credentials: 'provider-tok',
      config: 'config-tok',
      profile: 'staging-tok',
    };
    let passed: Record<Name, ClientOptions>;

    const environment: { sent: string; set: () => void }[] = [
      { sent: 'sk-env-key', set: () => (process.env['ANTHROPIC_API_KEY'] = 'sk-env-key') },
      { sent: 'env-tok', set: () => (process.env['ANTHROPIC_AUTH_TOKEN'] = 'env-tok') },
      {
        sent: 'from-env-tok',
        set: () => {
          process.env['ANTHROPIC_PROFILE'] = 'from-env';
          writeProfile('from-env');
        },
      },
      {
        sent: 'federated-tok',
        set: () => {
          process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_01abc';
          process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-123';
          process.env['ANTHROPIC_IDENTITY_TOKEN'] = 'my-jwt';
        },
      },
      { sent: 'default-tok', set: () => writeProfile('default') },
    ];

    beforeEach(() => {
      process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
      writeProfile('staging');
      const credentialsPath = path.join(testDir, 'config-credentials.json');
      fs.writeFileSync(
        credentialsPath,
        JSON.stringify({ access_token: 'config-tok', expires_at: farFuture() }),
        { mode: 0o600 },
      );
      passed = {
        apiKey: { apiKey: 'sk-key' },
        authToken: { authToken: 'tok' },
        credentials: { credentials: async () => ({ token: 'provider-tok', expiresAt: farFuture() }) },
        config: { config: { authentication: { type: 'user_oauth', credentials_path: credentialsPath } } },
        profile: { profile: 'staging' },
      };
    });

    it.each(names.flatMap((a, i) => names.slice(i + 1).map((b) => [a, b] as const)))(
      'rejects %s together with %s',
      (a, b) => {
        const both = { ...passed[a], ...passed[b] };
        for (const construct of [
          () => new Anthropic(both),
          () => new Anthropic({ apiKey: 'parent-key' }).withOptions(both),
        ]) {
          expect(construct).toThrow(TypeError);
          expect(construct).toThrow(
            'Pass at most one of `apiKey`, `authToken`, `credentials`, `config`, `profile`. ' +
              `Received \`${a}\`, \`${b}\`.`,
          );
        }
      },
    );

    it.each(names)('%s does not read the environment', async (name) => {
      for (const source of environment) source.set();
      const headers = await sentHeaders((opts) => new Anthropic({ ...opts, ...passed[name] }));
      expect(headers.get('authorization')).toBe(`Bearer ${sent[name]}`);
    });

    it.each(environment.map((source, i) => ({ sent: source.sent, sources: environment.slice(i) })))(
      'with no credential passed, the environment supplies $sent first',
      async ({ sent, sources }) => {
        for (const source of sources) source.set();
        const headers = await sentHeaders((opts) => new Anthropic(opts));
        expect(headers.get('authorization')).toBe(`Bearer ${sent}`);
      },
    );

    it('an ANTHROPIC_PROFILE that names a missing profile fails the first request', async () => {
      for (const source of environment.slice(3)) source.set();
      process.env['ANTHROPIC_PROFILE'] = 'nope';
      const client = new Anthropic({ fetch: async () => jsonResponse(VALID_MSG_RESPONSE) });

      const request = client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      await expect(request).rejects.toThrow(Anthropic.AnthropicError);
      await expect(request).rejects.toThrow('ANTHROPIC_PROFILE names the profile "nope"');
    });

    it.each(
      names.flatMap((parent) =>
        names.filter((copy) => copy !== parent).map((copy) => [copy, parent] as const),
      ),
    )('withOptions({%s}) replaces the %s of the client it copies', async (copy, parent) => {
      const headers = await sentHeaders((opts) =>
        new Anthropic({ ...opts, ...passed[parent] }).withOptions(passed[copy]),
      );
      expect(headers.get('authorization')).toBe(`Bearer ${sent[copy]}`);
    });

    it.each(names)('a copy that is passed no credential keeps %s', async (name) => {
      for (const source of environment) source.set();
      let parent: Anthropic;
      await sentHeaders((opts) => (parent = new Anthropic({ ...opts, ...passed[name] })));
      for (const none of [
        {},
        Object.fromEntries(names.map((other) => [other, undefined])),
        Object.fromEntries(names.filter((other) => other !== name).map((other) => [other, null])),
      ]) {
        const headers = await sentHeaders((opts) => parent.withOptions({ ...opts, ...none }));
        expect(headers.get('authorization')).toBe(`Bearer ${sent[name]}`);
      }
    });

    it('copies a client that found both ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN', async () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-env-key';
      process.env['ANTHROPIC_AUTH_TOKEN'] = 'env-tok';
      expect(new Anthropic().authToken).toBeNull();
      const headers = await sentHeaders((opts) => new Anthropic().withOptions(opts));
      expect(headers.get('authorization')).toBe('Bearer sk-env-key');
    });
  });

  describe('warning about ANTHROPIC_API_KEY next to ANTHROPIC_AUTH_TOKEN', () => {
    const both = { ANTHROPIC_API_KEY: 'sk-env-key', ANTHROPIC_AUTH_TOKEN: 'env-tok' };
    let FreshAnthropic: typeof Anthropic;
    let warn: MockInstance<typeof console.warn>;

    beforeEach(async () => {
      process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'empty');
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.resetModules();
      FreshAnthropic = (await import('@anthropic-ai/sdk')).default;
    });

    afterEach(() => {
      warn.mockRestore();
      vi.resetModules();
    });

    it('warns once per process and sends the key', async () => {
      Object.assign(process.env, both);
      const headers = await sentHeaders((opts) => new FreshAnthropic(opts));
      expect(headers.get('authorization')).toBe('Bearer sk-env-key');
      expect(warn.mock.calls).toEqual([
        ['Anthropic: ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN are both set. Using ANTHROPIC_API_KEY.'],
      ]);

      new FreshAnthropic().withOptions({ maxRetries: 0 });
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it("goes to the client's logger", () => {
      Object.assign(process.env, both);
      const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
      new FreshAnthropic({ logger });
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each<{ name: string; env: Record<string, string>; options?: ClientOptions }>([
      { name: 'only ANTHROPIC_API_KEY', env: { ANTHROPIC_API_KEY: 'sk-env-key' } },
      { name: 'only ANTHROPIC_AUTH_TOKEN', env: { ANTHROPIC_AUTH_TOKEN: 'env-tok' } },
      { name: 'an empty ANTHROPIC_API_KEY', env: { ...both, ANTHROPIC_API_KEY: '' } },
      { name: 'an empty ANTHROPIC_AUTH_TOKEN', env: { ...both, ANTHROPIC_AUTH_TOKEN: '' } },
      { name: 'apiKey passed', env: both, options: { apiKey: 'sk-key' } },
      { name: 'authToken passed', env: both, options: { authToken: 'tok' } },
      {
        name: 'credentials passed',
        env: both,
        options: { credentials: async () => ({ token: 'provider-tok', expiresAt: farFuture() }) },
      },
      { name: 'apiKey: null', env: both, options: { apiKey: null } },
      { name: 'authToken: null', env: both, options: { authToken: null } },
    ])('does not warn with $name', ({ env, options }) => {
      Object.assign(process.env, env);
      new FreshAnthropic(options);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('baseURL precedence (ctor opt > env > profile > default)', () => {
    function writeUserOAuthProfile(dir: string, base_url?: string) {
      fs.mkdirSync(path.join(dir, 'configs'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'credentials'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'configs', 'default.json'),
        JSON.stringify({ ...(base_url ? { base_url } : {}), authentication: { type: 'user_oauth' } }),
      );
      fs.writeFileSync(
        path.join(dir, 'credentials', 'default.json'),
        JSON.stringify({ access_token: 'tok', expires_at: farFuture() }),
        { mode: 0o600 },
      );
    }

    it('explicit config.base_url propagates to client.baseURL (sync path)', () => {
      const credPath = path.join(testDir, 'creds.json');
      fs.writeFileSync(credPath, JSON.stringify({ access_token: 'tok', expires_at: farFuture() }), {
        mode: 0o600,
      });
      const client = new Anthropic({
        apiKey: null,
        config: {
          base_url: 'https://staging.example.com/',
          authentication: { type: 'user_oauth', credentials_path: credPath },
        },
        fetch: async () => jsonResponse(VALID_MSG_RESPONSE),
      });
      expect(client.baseURL).toBe('https://staging.example.com');
    });

    it('profile base_url propagates to outbound API host (lazy path)', async () => {
      process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
      writeUserOAuthProfile(testDir, 'https://staging.example.com');

      const seenHosts: string[] = [];
      const client = new Anthropic({
        fetch: async (url) => {
          seenHosts.push(new URL(typeof url === 'string' ? url : url.toString()).host);
          return jsonResponse(VALID_MSG_RESPONSE);
        },
      });

      await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(seenHosts).toEqual(['staging.example.com']);
      expect(client.baseURL).toBe('https://staging.example.com');
    });

    it('ANTHROPIC_BASE_URL env wins over profile base_url', async () => {
      process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
      process.env['ANTHROPIC_BASE_URL'] = 'https://env.example.com';
      writeUserOAuthProfile(testDir, 'https://profile.example.com');

      const seenHosts: string[] = [];
      const client = new Anthropic({
        fetch: async (url) => {
          seenHosts.push(new URL(typeof url === 'string' ? url : url.toString()).host);
          return jsonResponse(VALID_MSG_RESPONSE);
        },
      });

      await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(client.baseURL).toBe('https://env.example.com');
      expect(seenHosts).toEqual(['env.example.com']);
    });

    it('constructor baseURL opt wins over profile base_url', async () => {
      process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
      writeUserOAuthProfile(testDir, 'https://profile.example.com');

      const client = new Anthropic({
        baseURL: 'https://opt.example.com',
        fetch: async () => jsonResponse(VALID_MSG_RESPONSE),
      });
      await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(client.baseURL).toBe('https://opt.example.com');
    });

    it('falls through to hardcoded default when profile has no base_url', async () => {
      process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
      writeUserOAuthProfile(testDir /* no base_url */);

      const client = new Anthropic({ fetch: async () => jsonResponse(VALID_MSG_RESPONSE) });
      await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(client.baseURL).toBe('https://api.anthropic.com');
    });

    it('withOptions clone created before lazy resolution settles adopts profile base_url', async () => {
      process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
      writeUserOAuthProfile(testDir, 'https://staging.example.com');

      const seenHosts: string[] = [];
      const fetchImpl = async (url: any): Promise<Response> => {
        seenHosts.push(new URL(typeof url === 'string' ? url : url.toString()).host);
        return jsonResponse(VALID_MSG_RESPONSE);
      };

      const parent = new Anthropic({ fetch: fetchImpl });
      const clone = parent.withOptions({ timeout: 5000 }); // before resolution settles

      for (const c of [parent, clone]) {
        await c.messages.create({
          model: 'claude-opus-4-8',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        });
      }
      expect(seenHosts).toEqual(['staging.example.com', 'staging.example.com']);
      expect(clone.baseURL).toBe('https://staging.example.com');
    });

    it('nested withOptions chain on a profile-bound parent stays on the profile host', async () => {
      process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
      writeUserOAuthProfile(testDir, 'https://staging.example.com');

      const seenHosts: string[] = [];
      const fetchImpl = async (url: any): Promise<Response> => {
        seenHosts.push(new URL(typeof url === 'string' ? url : url.toString()).host);
        return jsonResponse(VALID_MSG_RESPONSE);
      };

      const a = new Anthropic({ fetch: fetchImpl });
      // Let resolution settle so a.baseURL has been mutated to the profile host
      // before cloning — exercises the "don't pin mutated baseURL into clone
      // options" path in withOptions().
      await a.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      const b = a.withOptions({ maxRetries: 5 });
      const c = b.withOptions({ maxRetries: 6 });

      for (const client of [b, c]) {
        await client.messages.create({
          model: 'claude-opus-4-8',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        });
      }
      expect(seenHosts).toEqual(['staging.example.com', 'staging.example.com', 'staging.example.com']);
      expect(c.baseURL).toBe('https://staging.example.com');
    });

    it('withOptions auth override does not inherit parent profile base_url', async () => {
      process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
      writeUserOAuthProfile(testDir, 'https://staging.example.com');

      const parent = new Anthropic({ fetch: async () => jsonResponse(VALID_MSG_RESPONSE) });
      await parent.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(parent.baseURL).toBe('https://staging.example.com');

      // Auth override → fresh _authState (no profile baseURL). Clone must NOT
      // be stuck on the parent's resolved staging host; it falls back to the
      // construction-time default since no caller/env/profile pinned one.
      const seenHosts: string[] = [];
      const clone = parent.withOptions({
        credentials: async () => ({ token: 'override-tok', expiresAt: farFuture() }),
        fetch: async (url) => {
          seenHosts.push(new URL(typeof url === 'string' ? url : url.toString()).host);
          return jsonResponse(VALID_MSG_RESPONSE);
        },
      });
      await clone.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(clone.baseURL).toBe('https://api.anthropic.com');
      expect(seenHosts).toEqual(['api.anthropic.com']);
    });

    it('withOptions({baseURL}) override is honored over profile base_url', async () => {
      process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
      writeUserOAuthProfile(testDir, 'https://staging.example.com');

      const parent = new Anthropic({ fetch: async () => jsonResponse(VALID_MSG_RESPONSE) });
      const clone = parent.withOptions({ baseURL: 'https://override.example.com' });

      await clone.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(clone.baseURL).toBe('https://override.example.com');
    });
  });
});
