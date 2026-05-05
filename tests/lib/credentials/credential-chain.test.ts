import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { Fetch } from '@anthropic-ai/sdk/internal/builtin-types';
import { defaultCredentials } from '@anthropic-ai/sdk/lib/credentials/credential-chain';

const NOW_IN_SECONDS = 1700000000;

beforeAll(() => {
  jest.useFakeTimers({ now: NOW_IN_SECONDS * 1000 });
});

afterAll(() => {
  jest.useRealTimers();
});

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('defaultCredentials', () => {
  let testDir: string;
  const originalEnv: Record<string, string | undefined> = {};

  const envVars = [
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_CONFIG_DIR',
    'ANTHROPIC_FEDERATION_RULE_ID',
    'ANTHROPIC_IDENTITY_TOKEN',
    'ANTHROPIC_IDENTITY_TOKEN_FILE',
    'ANTHROPIC_ORGANIZATION_ID',
    'ANTHROPIC_PROFILE',
    'ANTHROPIC_SCOPE',
    'ANTHROPIC_SERVICE_ACCOUNT_ID',
    'ANTHROPIC_WORKSPACE_ID',
    'APPDATA',
    'HOME',
    'XDG_CONFIG_HOME',
  ];

  beforeEach(() => {
    for (const name of envVars) {
      originalEnv[name] = process.env[name];
    }
    testDir = mkdtempSync(path.join(tmpdir(), 'chain-test-'));
    process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
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

  const baseOptions = {
    baseURL: 'https://api.anthropic.com',
    fetch: jest.fn() as unknown as Fetch,
  };

  function writeConfig(profile: string, config: object) {
    const dir = path.join(testDir, 'configs');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${profile}.json`), JSON.stringify(config));
  }

  function writeCredentials(profile: string, creds: object) {
    const dir = path.join(testDir, 'credentials');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${profile}.json`), JSON.stringify(creds), { mode: 0o600 });
  }

  it('returns null when no config or env vars are set', async () => {
    expect(await defaultCredentials(baseOptions)).toBeNull();
  });

  it('resolves user_oauth with fresh cached token', async () => {
    writeConfig('default', { authentication: { type: 'user_oauth', client_id: 'my-client' } });
    writeCredentials('default', {
      access_token: 'user-tok',
      refresh_token: 'refresh-tok',
      expires_at: NOW_IN_SECONDS + 3600,
    });

    const result = await defaultCredentials(baseOptions);
    expect(result).not.toBeNull();

    const token = await result!.provider();
    expect(token.token).toBe('user-tok');
  });

  it('includes workspace_id header for user_oauth only', async () => {
    writeConfig('default', {
      workspace_id: 'ws-user',
      authentication: { type: 'user_oauth' },
    });
    writeCredentials('default', {
      access_token: 'tok',
      refresh_token: 'ref',
      expires_at: NOW_IN_SECONDS + 3600,
    });
    const userResult = await defaultCredentials(baseOptions);
    expect(userResult!.extraHeaders).toEqual({ 'anthropic-workspace-id': 'ws-user' });

    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');
    writeConfig('default', {
      workspace_id: 'ws-fed',
      organization_id: 'org-123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: { source: 'file', path: tokenPath },
      },
    });
    const fedFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));
    const fedResult = await defaultCredentials({ ...baseOptions, fetch: fedFetch });
    // Federation profiles send workspace_id in the exchange body, not as a header.
    expect(fedResult!.extraHeaders).toEqual({});
    // forceRefresh bypasses the still-fresh user_oauth credential cache from above.
    await fedResult!.provider({ forceRefresh: true });
    const fedBody = JSON.parse((fedFetch as jest.Mock).mock.calls[0]![1].body);
    expect(fedBody.workspace_id).toBe('ws-fed');
  });

  it('resolves oidc_federation from config with identity_token file', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');

    writeConfig('default', {
      organization_id: 'org-123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: { source: 'file', path: tokenPath },
      },
    });

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'exchanged-tok', expires_in: 3600 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    expect(result).not.toBeNull();

    const token = await result!.provider();
    expect(token.token).toBe('exchanged-tok');
  });

  it('uses cached credential file for oidc_federation before exchanging', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');

    writeConfig('default', {
      organization_id: 'org-123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: { source: 'file', path: tokenPath },
      },
    });
    writeCredentials('default', {
      access_token: 'cached-tok',
      expires_at: NOW_IN_SECONDS + 3600,
    });

    const mockFetch: Fetch = jest.fn();

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    expect(result).not.toBeNull();

    const token = await result!.provider();
    expect(token.token).toBe('cached-tok');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('preserves unknown keys (e.g. refresh_token) when writing federation cache', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');

    writeConfig('default', {
      organization_id: 'org-123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: { source: 'file', path: tokenPath },
      },
    });
    // Stale cache with a refresh_token that the federation writer must not clobber
    writeCredentials('default', {
      access_token: 'stale',
      expires_at: NOW_IN_SECONDS - 10,
      refresh_token: 'preserved-rt',
      custom_field: 'kept',
    });

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'new-tok', expires_in: 3600 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    await result!.provider();

    const written = JSON.parse(fs.readFileSync(path.join(testDir, 'credentials', 'default.json'), 'utf-8'));
    expect(written.version).toBe('1.0');
    expect(written.access_token).toBe('new-tok');
    expect(written.refresh_token).toBe('preserved-rt');
    expect(written.custom_field).toBe('kept');
  });

  it('surfaces cache write errors to onCacheWriteError without failing the exchange', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');

    writeConfig('default', {
      organization_id: 'org-123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: { source: 'file', path: tokenPath },
        // Point credentials_path at a directory so the write fails
        credentials_path: testDir,
      },
    });

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));
    const onErr = jest.fn();

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch, onCacheWriteError: onErr });
    const token = await result!.provider();

    expect(token.token).toBe('tok'); // exchange still succeeds
    // Both the failed cache read (EISDIR) and the failed write surface here
    expect(onErr).toHaveBeenCalled();
    expect((onErr.mock.calls.at(-1)![0] as NodeJS.ErrnoException).code).toBe('EISDIR');
  });

  it('threads userAgent through to the federation exchange', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');

    writeConfig('default', {
      organization_id: 'org-123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: { source: 'file', path: tokenPath },
      },
    });

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch, userAgent: 'ant-cli/1.2.3' });
    await result!.provider();

    expect((mockFetch as jest.Mock).mock.calls[0]![1].headers['User-Agent']).toBe('ant-cli/1.2.3');
  });

  it('writes back credential file after oidc_federation exchange', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');

    writeConfig('default', {
      organization_id: 'org-123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: { source: 'file', path: tokenPath },
      },
    });
    // No cached credentials. Will exchange

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'new-tok', expires_in: 3600 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    const token = await result!.provider();
    expect(token.token).toBe('new-tok');

    // Check that credentials were written back
    const credPath = path.join(testDir, 'credentials', 'default.json');
    const written = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    expect(written.access_token).toBe('new-tok');
    expect(written.expires_at).toBe(NOW_IN_SECONDS + 3600);
  });

  it('resolves oidc_federation from env vars with identity token file', async () => {
    delete process.env['ANTHROPIC_CONFIG_DIR'];
    process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'nonexistent');

    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'env-jwt');

    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_env';
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-env';
    process.env['ANTHROPIC_IDENTITY_TOKEN_FILE'] = tokenPath;

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'env-tok', expires_in: 60 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    expect(result).not.toBeNull();

    const token = await result!.provider();
    expect(token.token).toBe('env-tok');
  });

  it('resolves oidc_federation from env vars with static identity token', async () => {
    delete process.env['ANTHROPIC_CONFIG_DIR'];
    process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'nonexistent');

    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_env';
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-env';
    process.env['ANTHROPIC_IDENTITY_TOKEN'] = 'static-jwt';

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'static-tok', expires_in: 60 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    expect(result).not.toBeNull();

    const token = await result!.provider();
    expect(token.token).toBe('static-tok');

    const body = JSON.parse((mockFetch as jest.Mock).mock.calls[0]![1].body);
    expect(body.assertion).toBe('static-jwt');
  });

  it('does not write a disk cache for the env-only federation chain', async () => {
    // No profile file on disk: <testDir>/configs/ does not exist. The chain
    // is synthesized purely from env vars and must stay in-memory only.
    // Before this fix the chain wrote <config_dir>/credentials/default.json
    // anyway, so a CI run that changed ANTHROPIC_WORKSPACE_ID (or
    // ANTHROPIC_ORGANIZATION_ID / ANTHROPIC_FEDERATION_RULE_ID) between runs
    // would re-serve the stale cached token until it expired. The other
    // disk-caching SDKs already skip the cache on the env-only path.
    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_env';
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-env';
    process.env['ANTHROPIC_IDENTITY_TOKEN'] = 'env-jwt';
    process.env['ANTHROPIC_WORKSPACE_ID'] = 'wrkspc_env';

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'env-tok', expires_in: 3600 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    expect(result).not.toBeNull();
    const token = await result!.provider();
    expect(token.token).toBe('env-tok');

    expect(fs.existsSync(path.join(testDir, 'credentials', 'default.json'))).toBe(false);
    expect(fs.existsSync(path.join(testDir, 'credentials'))).toBe(false);
  });

  it('does not read a stale disk cache for the env-only federation chain', async () => {
    // Even if a stray credentials/default.json exists (e.g. left over from a
    // file-backed profile that was later removed), the env-only chain must
    // ignore it and perform a fresh exchange.
    writeCredentials('default', {
      access_token: 'stale-disk-tok',
      expires_at: NOW_IN_SECONDS + 3600, // still valid → would be served if cached
    });

    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_env';
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-env';
    process.env['ANTHROPIC_IDENTITY_TOKEN'] = 'env-jwt';

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'fresh-tok', expires_in: 3600 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    const token = await result!.provider();

    expect(token.token).toBe('fresh-tok');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // The stray file is not overwritten either — env-only never touches disk.
    const onDisk = JSON.parse(fs.readFileSync(path.join(testDir, 'credentials', 'default.json'), 'utf-8'));
    expect(onDisk.access_token).toBe('stale-disk-tok');
  });

  it('passes ANTHROPIC_WORKSPACE_ID through the pure-env-var federation chain', async () => {
    delete process.env['ANTHROPIC_CONFIG_DIR'];
    process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'nonexistent');

    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_01abc';
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-uuid';
    process.env['ANTHROPIC_IDENTITY_TOKEN'] = 'literal-jwt';
    process.env['ANTHROPIC_WORKSPACE_ID'] = 'wrkspc_01abc';

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    expect(result).not.toBeNull();
    await result!.provider();

    const body = JSON.parse((mockFetch as jest.Mock).mock.calls[0]![1].body);
    expect(body.workspace_id).toBe('wrkspc_01abc');
  });

  it('treats ANTHROPIC_WORKSPACE_ID="" as unset on the pure-env-var federation chain', async () => {
    // A defaulted-but-empty CI variable should never put `"workspace_id": ""`
    // on the wire. readEnv coerces empty to undefined, and the body builder's
    // truthy check skips it — this pins both layers.
    delete process.env['ANTHROPIC_CONFIG_DIR'];
    process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'nonexistent');

    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_01abc';
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-uuid';
    process.env['ANTHROPIC_IDENTITY_TOKEN'] = 'literal-jwt';
    process.env['ANTHROPIC_WORKSPACE_ID'] = '';

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    expect(result).not.toBeNull();
    await result!.provider();

    const body = JSON.parse((mockFetch as jest.Mock).mock.calls[0]![1].body);
    expect(body).not.toHaveProperty('workspace_id');
  });

  it('ANTHROPIC_WORKSPACE_ID fills a missing top-level workspace_id from a profile config', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org_x';
    process.env['ANTHROPIC_WORKSPACE_ID'] = 'wrkspc_from_env';
    process.env['ANTHROPIC_IDENTITY_TOKEN_FILE'] = tokenPath;

    // Profile file has oidc_federation auth but no workspace_id.
    writeConfig('default', {
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
      },
    });

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    expect(result).not.toBeNull();
    await result!.provider();

    const body = JSON.parse((mockFetch as jest.Mock).mock.calls[0]![1].body);
    expect(body.workspace_id).toBe('wrkspc_from_env');
  });

  it('ANTHROPIC_WORKSPACE_ID fills a missing workspace_id for a user_oauth profile (header)', async () => {
    // The env var fills `workspace_id` uniformly across profile types — not
    // just federation. For user_oauth the filled value surfaces as the
    // anthropic-workspace-id request header (federation routes it into the
    // exchange body instead).
    process.env['ANTHROPIC_WORKSPACE_ID'] = 'wrkspc_env';
    writeConfig('default', { authentication: { type: 'user_oauth' } });
    writeCredentials('default', {
      access_token: 'tok',
      refresh_token: 'ref',
      expires_at: NOW_IN_SECONDS + 3600,
    });

    const result = await defaultCredentials(baseOptions);
    expect(result).not.toBeNull();
    expect(result!.extraHeaders).toEqual({ 'anthropic-workspace-id': 'wrkspc_env' });
  });

  it('config-file workspace_id beats ANTHROPIC_WORKSPACE_ID env var (precedence)', async () => {
    // File values are authoritative; env vars only fill fields the file left
    // unset. This pins the precedence model: profile > env var.
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org_x';
    process.env['ANTHROPIC_WORKSPACE_ID'] = 'wrkspc_env';
    process.env['ANTHROPIC_IDENTITY_TOKEN_FILE'] = tokenPath;

    writeConfig('default', {
      workspace_id: 'wrkspc_file',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
      },
    });

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    expect(result).not.toBeNull();
    await result!.provider();

    const body = JSON.parse((mockFetch as jest.Mock).mock.calls[0]![1].body);
    expect(body.workspace_id).toBe('wrkspc_file');
  });

  it('throws clear error for oidc_federation env vars without identity token', async () => {
    delete process.env['ANTHROPIC_CONFIG_DIR'];
    process.env['ANTHROPIC_CONFIG_DIR'] = path.join(testDir, 'nonexistent');

    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_env';
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-env';
    // No ANTHROPIC_IDENTITY_TOKEN or ANTHROPIC_IDENTITY_TOKEN_FILE

    await expect(defaultCredentials(baseOptions)).rejects.toThrow('requires an identity token');
  });

  it('uses base_url from config for token exchange', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');

    writeConfig('default', {
      base_url: 'https://custom-api.example.com',
      organization_id: 'org-123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: { source: 'file', path: tokenPath },
      },
    });

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const result = await defaultCredentials({ ...baseOptions, fetch: mockFetch });
    await result!.provider();

    const [url] = (mockFetch as jest.Mock).mock.calls[0]!;
    expect(url).toBe('https://custom-api.example.com/v1/oauth/token');
  });

  it('throws clear error when oidc_federation config has no organization_id', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');

    writeConfig('default', {
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: { source: 'file', path: tokenPath },
      },
    });

    await expect(defaultCredentials(baseOptions)).rejects.toThrow('requires organization_id');
  });

  it('throws clear error when oidc_federation config has no federation_rule_id', async () => {
    const tokenPath = path.join(testDir, 'id-token');
    fs.writeFileSync(tokenPath, 'my-jwt');

    writeConfig('default', {
      organization_id: 'org_123',
      authentication: {
        type: 'oidc_federation',
        identity_token: { source: 'file', path: tokenPath },
      },
    });

    await expect(defaultCredentials(baseOptions)).rejects.toThrow(/requires 'federation_rule_id'/);
  });

  it('rejects identity_token with an unknown source', async () => {
    writeConfig('default', {
      organization_id: 'org_123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: { source: 'gcp_metadata', audience: 'anthropic' },
      },
    });

    await expect(defaultCredentials(baseOptions)).rejects.toThrow(
      /identity_token.source "gcp_metadata" is not supported/,
    );
  });

  it('rejects identity_token.source "file" with empty path', async () => {
    writeConfig('default', {
      organization_id: 'org_123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: { source: 'file', path: '' },
      },
    });

    await expect(defaultCredentials(baseOptions)).rejects.toThrow(/requires a non-empty path/);
  });

  it('uses ANTHROPIC_PROFILE to select config', async () => {
    process.env['ANTHROPIC_PROFILE'] = 'staging';
    writeConfig('staging', { authentication: { type: 'user_oauth' } });
    writeCredentials('staging', { access_token: 'staging-tok' });

    const result = await defaultCredentials(baseOptions);
    expect(result).not.toBeNull();

    const token = await result!.provider();
    expect(token.token).toBe('staging-tok');
  });
});
