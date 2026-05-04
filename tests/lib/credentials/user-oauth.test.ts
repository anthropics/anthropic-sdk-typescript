import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { Fetch } from '@anthropic-ai/sdk/internal/builtin-types';
import { userOAuthProvider } from '@anthropic-ai/sdk/lib/credentials/user-oauth';
import {
  WorkloadIdentityError,
  OAUTH_API_BETA_HEADER,
  FEDERATION_BETA_HEADER,
  writeCredentialsFileAtomic,
} from '@anthropic-ai/sdk/lib/credentials/types';

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

describe('userOAuthProvider', () => {
  let testDir: string;
  let credPath: string;

  beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), 'user-oauth-test-'));
    credPath = path.join(testDir, 'credentials.json');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true });
  });

  const baseConfig = {
    baseURL: 'https://api.anthropic.com',
    clientId: 'my-client',
  };

  const writeCreds = (data: string | object, mode = 0o600) =>
    fs.writeFileSync(credPath, typeof data === 'string' ? data : JSON.stringify(data), { mode });

  it('returns cached token when still fresh', async () => {
    const futureExpiry = NOW_IN_SECONDS + 3600;
    writeCreds({
      access_token: 'cached-token',
      refresh_token: 'refresh-tok',
      expires_at: futureExpiry,
    });

    const mockFetch: Fetch = jest.fn();
    const provider = userOAuthProvider({ ...baseConfig, credentialsPath: credPath, fetch: mockFetch });
    const token = await provider();

    expect(token.token).toBe('cached-token');
    expect(token.expiresAt).toBe(futureExpiry);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('forceRefresh skips the disk freshness short-circuit and refreshes anyway', async () => {
    writeCreds({
      access_token: 'stale-but-unexpired',
      refresh_token: 'refresh-tok',
      expires_at: NOW_IN_SECONDS + 3600,
    });

    const mockFetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'forced-new', expires_in: 3600 }), { status: 200 }),
      );
    const provider = userOAuthProvider({
      ...baseConfig,
      credentialsPath: credPath,
      fetch: mockFetch as unknown as Fetch,
    });

    const token = await provider({ forceRefresh: true });
    expect(token.token).toBe('forced-new');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes when token is expired and sends only the OAuth beta header', async () => {
    const pastExpiry = NOW_IN_SECONDS - 10;
    writeCreds({
      access_token: 'stale-token',
      refresh_token: 'refresh-tok',
      expires_at: pastExpiry,
    });

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ access_token: 'new-token', expires_in: 3600, refresh_token: 'new-refresh' }),
      );

    const provider = userOAuthProvider({ ...baseConfig, credentialsPath: credPath, fetch: mockFetch });
    const token = await provider();

    expect(token.token).toBe('new-token');
    expect(token.expiresAt).toBe(NOW_IN_SECONDS + 3600);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = (mockFetch as jest.Mock).mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/oauth/token');
    const body = JSON.parse(init.body);
    expect(body.grant_type).toBe('refresh_token');
    expect(body.refresh_token).toBe('refresh-tok');
    expect(body.client_id).toBe('my-client');
    expect(init.headers['anthropic-beta']).toBe(OAUTH_API_BETA_HEADER);
    expect(init.headers['anthropic-beta']).not.toContain(FEDERATION_BETA_HEADER);
    expect(init.headers['User-Agent']).toMatch(/^anthropic-sdk-typescript\//);
  });

  it('writes refreshed credentials back to file with no .tmp leftover', async () => {
    writeCreds({
      access_token: 'stale',
      refresh_token: 'old-refresh',
      expires_at: NOW_IN_SECONDS - 10,
    });

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ access_token: 'new-tok', expires_in: 7200, refresh_token: 'rotated-refresh' }),
      );

    const provider = userOAuthProvider({ ...baseConfig, credentialsPath: credPath, fetch: mockFetch });
    await provider();

    const written = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    expect(written.version).toBe('1.0');
    expect(written.access_token).toBe('new-tok');
    expect(written.expires_at).toBe(NOW_IN_SECONDS + 7200);
    expect(written.refresh_token).toBe('rotated-refresh');
    expect(written.type).toBe('oauth_token');
    expect(fs.readdirSync(testDir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('treats token as static when clientId is empty', async () => {
    writeCreds({ access_token: 'static-tok' });

    const mockFetch: Fetch = jest.fn();
    const provider = userOAuthProvider({
      ...baseConfig,
      clientId: undefined,
      credentialsPath: credPath,
      fetch: mockFetch,
    });
    const token = await provider();

    expect(token.token).toBe('static-tok');
    expect(token.expiresAt).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws when expired and no refresh available (empty clientId)', async () => {
    writeCreds({ access_token: 'expired', expires_at: NOW_IN_SECONDS - 10, refresh_token: 'r' });

    const mockFetch: Fetch = jest.fn();
    const provider = userOAuthProvider({
      ...baseConfig,
      clientId: undefined,
      credentialsPath: credPath,
      fetch: mockFetch,
    });

    await expect(provider()).rejects.toThrow('no refresh is available');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws when credentials file is missing access_token', async () => {
    writeCreds({ refresh_token: 'r' });

    const mockFetch: Fetch = jest.fn();
    const provider = userOAuthProvider({ ...baseConfig, credentialsPath: credPath, fetch: mockFetch });

    await expect(provider()).rejects.toThrow("must include 'access_token'");
  });

  it('throws WorkloadIdentityError on corrupt credentials JSON', async () => {
    writeCreds('{not json');

    const provider = userOAuthProvider({ ...baseConfig, credentialsPath: credPath, fetch: jest.fn() });
    await expect(provider()).rejects.toThrow(WorkloadIdentityError);
    await expect(provider()).rejects.toThrow('not valid JSON');
  });

  it('throws when refresh response lacks expires_in (fail closed)', async () => {
    writeCreds({ access_token: 'x', refresh_token: 'y', expires_at: 0 });

    const mockFetch: Fetch = jest.fn().mockResolvedValue(jsonResponse({ access_token: 'tok' }));

    const provider = userOAuthProvider({ ...baseConfig, credentialsPath: credPath, fetch: mockFetch });
    await expect(provider()).rejects.toThrow('missing or invalid expires_in');
  });

  it('throws on refresh failure', async () => {
    writeCreds({ access_token: 'x', refresh_token: 'y', expires_at: 0 });

    const mockFetch: Fetch = jest.fn().mockResolvedValue(new Response('bad', { status: 400 }));

    const provider = userOAuthProvider({ ...baseConfig, credentialsPath: credPath, fetch: mockFetch });
    await expect(provider()).rejects.toThrow(WorkloadIdentityError);
  });

  it('rejects non-https token endpoint on refresh', async () => {
    writeCreds({ access_token: 'x', refresh_token: 'y', expires_at: 0 });

    const provider = userOAuthProvider({
      ...baseConfig,
      baseURL: 'http://api.example.com',
      credentialsPath: credPath,
      fetch: jest.fn(),
    });
    await expect(provider()).rejects.toThrow('non-https token endpoint');
  });

  it('rejects non-Bearer token_type on refresh', async () => {
    writeCreds({ access_token: 'x', refresh_token: 'y', expires_at: 0 });

    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', token_type: 'mac', expires_in: 60 }));

    const provider = userOAuthProvider({ ...baseConfig, credentialsPath: credPath, fetch: mockFetch });
    await expect(provider()).rejects.toThrow('unsupported token_type');
  });

  it('writeCredentialsFileAtomic cleans up tmp file on write failure', async () => {
    // Target a path inside a non-existent dir whose parent is a regular file,
    // so mkdir succeeds for the immediate dir? No — simpler: target a path
    // that IS a directory so the rename onto it fails (or open fails).
    fs.mkdirSync(credPath); // credPath is now a directory → rename onto it fails
    await expect(writeCredentialsFileAtomic(credPath, { x: 1 })).rejects.toThrow();
    // Nothing matching .tmp should be left behind in testDir
    expect(fs.readdirSync(testDir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  const itPosix = process.platform === 'win32' ? it.skip : it;

  itPosix('follows a symlinked credentials file and verifies the target', async () => {
    const real = path.join(testDir, 'real.json');
    fs.writeFileSync(real, JSON.stringify({ access_token: 'via-symlink' }), { mode: 0o600 });
    fs.symlinkSync(real, credPath);

    const provider = userOAuthProvider({ ...baseConfig, credentialsPath: credPath, fetch: jest.fn() });
    const token = await provider();
    expect(token.token).toBe('via-symlink');

    // If the symlink target has a bad mode, the resolved path is what's reported
    fs.chmodSync(real, 0o644);
    await expect(provider()).rejects.toThrow(/group\/world-readable.*real\.json/);
  });

  itPosix('refuses a group/world-readable credentials file', async () => {
    writeCreds({ access_token: 'x' });
    fs.chmodSync(credPath, 0o644);
    const provider = userOAuthProvider({ ...baseConfig, credentialsPath: credPath, fetch: jest.fn() });
    await expect(provider()).rejects.toThrow('group/world-readable');

    fs.chmodSync(credPath, 0o640);
    await expect(provider()).rejects.toThrow('group/world-readable');
  });

  itPosix('refuses a group/world-writable credentials file', async () => {
    writeCreds({ access_token: 'x' });
    fs.chmodSync(credPath, 0o602);
    const provider = userOAuthProvider({ ...baseConfig, credentialsPath: credPath, fetch: jest.fn() });
    await expect(provider()).rejects.toThrow('group/world-writable');

    fs.chmodSync(credPath, 0o620);
    await expect(provider()).rejects.toThrow('group/world-writable');
  });
});
