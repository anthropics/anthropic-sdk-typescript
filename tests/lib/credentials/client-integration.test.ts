import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import Anthropic from '@anthropic-ai/sdk';
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
        expect(getHeader(init, 'x-api-key')).toBe('sk-env-key');
        expect(getHeader(init, 'authorization')).toBeNull();
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(exchanged).toBe(false);
    expect(client.credentials).toBeNull(); // lazy resolution never started
  });

  it('apiKey takes precedence over config; config is not resolved', async () => {
    // user_oauth without credentials_path would throw if resolved.
    const client = new Anthropic({
      apiKey: 'sk-test',
      config: { workspace_id: 'ws-ignored', authentication: { type: 'user_oauth' } },
      fetch: async (_url, init) => {
        expect(getHeader(init, 'x-api-key')).toBe('sk-test');
        expect(getHeader(init, 'anthropic-workspace-id')).toBeNull();
        expect(getHeader(init, 'anthropic-beta')).toBeNull();
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    expect(client.credentials).toBeNull();
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('apiKey takes precedence over credentials', async () => {
    let providerCalled = false;
    const client = new Anthropic({
      apiKey: 'sk-test',
      credentials: async () => {
        providerCalled = true;
        return { token: 'should-not-be-used', expiresAt: null };
      },
      fetch: async (_url, init) => {
        expect(getHeader(init, 'x-api-key')).toBe('sk-test');
        expect(getHeader(init, 'authorization')).toBeNull();
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(providerCalled).toBe(false);
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
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
      model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow();
    // 1 initial + 1 refresh-retry. Further 401s do NOT trigger more refreshes.
    expect(providerCalls).toBe(2);
  });

  it('does not refresh on 401 when apiKey was used', async () => {
    let providerCalls = 0;
    const client = new Anthropic({
      apiKey: 'sk-test',
      maxRetries: 1,
      credentials: async () => {
        providerCalls++;
        return { token: 'unused', expiresAt: farFuture() };
      },
      fetch: async () => jsonResponse({ error: { type: 'authentication_error', message: 'nope' } }, 401),
    });

    await expect(
      client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow();
    expect(providerCalls).toBe(0);
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
          model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(exchanged).toBe(true);
  });

  it('explicit credentials option takes precedence over config option', async () => {
    const client = new Anthropic({
      apiKey: null,
      credentials: async () => ({ token: 'from-provider', expiresAt: farFuture() }),
      config: {
        organization_id: 'ignored',
        authentication: { type: 'oidc_federation', federation_rule_id: 'ignored' },
      },
      fetch: async (_url, init) => {
        expect(getHeader(init, 'authorization')).toBe('Bearer from-provider');
        return jsonResponse(VALID_MSG_RESPONSE);
      },
    });

    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
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
      model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      clone.messages.create({
        model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    }

    expect(seenWs).toEqual(['ws-shared', 'ws-shared']);
  });

  it('pins withOptions({apiKey: undefined}) and ({credentials: null}) override semantics', async () => {
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

    // apiKey: undefined → overridesAuth=true (key is present), so the clone
    // builds a fresh _auth with its OWN TokenCache wrapping the inherited
    // provider (passed via the credentials: this.credentials spread). The
    // clone authenticates with the same token but does not share the parent's
    // cache.
    const reset1 = parent.withOptions({ apiKey: undefined });
    await reset1.messages.create({
      model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
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
      seenAuths.push(getHeader(init, 'authorization') ?? `apikey:${getHeader(init, 'x-api-key')}`);
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    }

    expect(seenAuths).toEqual(['Bearer A', 'Bearer A', 'Bearer C', 'apikey:sk-d']);
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
      body: { model: 'claude-sonnet-4-20250514', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] },
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

  describe('profile option', () => {
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
        model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    });

    it('throws when combined with credentials', () => {
      expect(
        () =>
          new Anthropic({
            profile: 'staging',
            credentials: async () => ({ token: 'x', expiresAt: null }),
          }),
      ).toThrow(/Pass at most one of `profile`, `credentials`, or `config`/);
    });

    it('throws when combined with config', () => {
      expect(
        () =>
          new Anthropic({
            profile: 'staging',
            config: { authentication: { type: 'user_oauth', credentials_path: '/dev/null' } },
          }),
      ).toThrow(/Pass at most one of `profile`, `credentials`, or `config`/);
    });

    it('surfaces a clear error when the named profile does not exist', async () => {
      const client = new Anthropic({
        profile: 'nope',
        fetch: async () => jsonResponse(VALID_MSG_RESPONSE),
      });
      await expect(
        client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      ).rejects.toThrow(/Profile "nope" could not be resolved/);
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
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
        model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
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
          model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      const b = a.withOptions({ maxRetries: 5 });
      const c = b.withOptions({ maxRetries: 6 });

      for (const client of [b, c]) {
        await client.messages.create({
          model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(clone.baseURL).toBe('https://override.example.com');
    });
  });
});
