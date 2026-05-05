import type { Fetch } from '@anthropic-ai/sdk/internal/builtin-types';
import { oidcFederationProvider } from '@anthropic-ai/sdk/lib/credentials/oidc-federation';
import {
  WorkloadIdentityError,
  OAUTH_API_BETA_HEADER,
  FEDERATION_BETA_HEADER,
  redactSensitive,
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

describe('oidcFederationProvider', () => {
  const baseConfig = {
    identityTokenProvider: () => 'my-jwt',
    federationRuleId: 'fdrl_01abc',
    organizationId: 'org-uuid-123',
    baseURL: 'https://api.anthropic.com',
  };

  it('exchanges a JWT for an access token', async () => {
    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'ant-at_xxx', expires_in: 3600 }));

    const provider = oidcFederationProvider({ ...baseConfig, fetch: mockFetch });
    const token = await provider();

    expect(token.token).toBe('ant-at_xxx');
    expect(token.expiresAt).toBe(NOW_IN_SECONDS + 3600);

    const [url, init] = (mockFetch as jest.Mock).mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/oauth/token');
    expect(init.method).toBe('POST');
    expect(init.headers['anthropic-beta']).toBe(`${OAUTH_API_BETA_HEADER},${FEDERATION_BETA_HEADER}`);
    expect(init.headers['User-Agent']).toMatch(/^anthropic-sdk-typescript\//);

    const body = JSON.parse(init.body);
    expect(body.grant_type).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(body.assertion).toBe('my-jwt');
    expect(body.federation_rule_id).toBe('fdrl_01abc');
    expect(body.organization_id).toBe('org-uuid-123');
    expect(body).not.toHaveProperty('workspace_id');
  });

  it('includes service_account_id when provided and never sends scope', async () => {
    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const provider = oidcFederationProvider({
      ...baseConfig,
      fetch: mockFetch,
      serviceAccountId: 'svac_01abc',
    });
    await provider();

    const body = JSON.parse((mockFetch as jest.Mock).mock.calls[0]![1].body);
    expect(body.service_account_id).toBe('svac_01abc');
    expect(body).not.toHaveProperty('scope');
  });

  it('includes workspace_id when provided', async () => {
    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const provider = oidcFederationProvider({
      ...baseConfig,
      fetch: mockFetch,
      workspaceId: 'wrkspc_01abc',
    });
    await provider();

    const body = JSON.parse((mockFetch as jest.Mock).mock.calls[0]![1].body);
    expect(body.workspace_id).toBe('wrkspc_01abc');
  });

  it('passes through the literal "default" workspace_id sentinel', async () => {
    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const provider = oidcFederationProvider({
      ...baseConfig,
      fetch: mockFetch,
      workspaceId: 'default',
    });
    await provider();

    const body = JSON.parse((mockFetch as jest.Mock).mock.calls[0]![1].body);
    expect(body.workspace_id).toBe('default');
  });

  it('uses custom userAgent when provided', async () => {
    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const provider = oidcFederationProvider({
      ...baseConfig,
      fetch: mockFetch,
      userAgent: 'ant-cli/1.2.3',
    });
    await provider();

    const headers = (mockFetch as jest.Mock).mock.calls[0]![1].headers;
    expect(headers['User-Agent']).toBe('ant-cli/1.2.3');
  });

  it('throws WorkloadIdentityError with requestId on non-ok response', async () => {
    const mockFetch: Fetch = jest.fn().mockResolvedValue(
      new Response('unauthorized', {
        status: 401,
        headers: { 'Request-Id': 'req_123' },
      }),
    );

    const provider = oidcFederationProvider({ ...baseConfig, fetch: mockFetch });

    await expect(provider()).rejects.toThrow(WorkloadIdentityError);
    try {
      await provider();
      fail('expected throw');
    } catch (err) {
      expect((err as WorkloadIdentityError).statusCode).toBe(401);
      expect((err as WorkloadIdentityError).requestId).toBe('req_123');
    }
  });

  it('appends the full token-exchange hint on 401 when workspaceId is unset', async () => {
    // Without a workspaceId the most common cause is a federation rule that
    // spans multiple workspaces — surface the workspace-ID fix alongside the
    // generic guidance and the Console auth-event pointer.
    const mockFetch: Fetch = jest.fn().mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401));

    const provider = oidcFederationProvider({ ...baseConfig, fetch: mockFetch });
    try {
      await provider();
      fail('expected throw');
    } catch (err) {
      const message = (err as WorkloadIdentityError).message;
      expect(message).toContain('Ensure your federation rule matches your identity token');
      expect(message).toContain('ANTHROPIC_WORKSPACE_ID');
      expect(message).toContain('View your authentication events');
    }
  });

  it('omits the workspace-ID portion of the hint on 401 when workspaceId is set', async () => {
    // When workspaceId is already configured the workspace-ID suggestion is
    // noise, but the generic guidance and Console auth-event pointer still apply.
    const mockFetch: Fetch = jest.fn().mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401));

    const provider = oidcFederationProvider({
      ...baseConfig,
      fetch: mockFetch,
      workspaceId: 'wrkspc_x',
    });
    try {
      await provider();
      fail('expected throw');
    } catch (err) {
      const message = (err as WorkloadIdentityError).message;
      expect(message).toContain('Ensure your federation rule');
      expect(message).toContain('View your authentication events');
      expect(message).not.toContain('ANTHROPIC_WORKSPACE_ID');
    }
  });

  it('omits hint on non-401 errors', async () => {
    // The hint is 401-specific; a 5xx or 400 should not append any guidance.
    const mockFetch: Fetch = jest.fn().mockResolvedValue(jsonResponse({ error: 'server_error' }, 500));

    const provider = oidcFederationProvider({ ...baseConfig, fetch: mockFetch });
    try {
      await provider();
      fail('expected throw');
    } catch (err) {
      const message = (err as WorkloadIdentityError).message;
      expect(message).not.toContain('Ensure your federation rule');
      expect(message).not.toContain('View your authentication events');
      expect(message).not.toContain('ANTHROPIC_WORKSPACE_ID');
    }
  });

  it('throws WorkloadIdentityError on missing access_token', async () => {
    const mockFetch: Fetch = jest.fn().mockResolvedValue(jsonResponse({ expires_in: 3600 }));

    const provider = oidcFederationProvider({ ...baseConfig, fetch: mockFetch });
    await expect(provider()).rejects.toThrow('missing access_token');
  });

  it('rejects non-Bearer token_type', async () => {
    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', token_type: 'mac', expires_in: 60 }));

    const provider = oidcFederationProvider({ ...baseConfig, fetch: mockFetch });
    await expect(provider()).rejects.toThrow('unsupported token_type "mac"');
  });

  it('accepts Bearer token_type case-insensitively', async () => {
    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', token_type: 'bearer', expires_in: 60 }));

    const provider = oidcFederationProvider({ ...baseConfig, fetch: mockFetch });
    const token = await provider();
    expect(token.token).toBe('tok');
  });

  it('rejects non-https token endpoint (allows loopback http)', async () => {
    const provider = oidcFederationProvider({
      ...baseConfig,
      baseURL: 'http://api.example.com',
      fetch: jest.fn(),
    });
    await expect(provider()).rejects.toThrow('non-https token endpoint');

    for (const baseURL of ['http://localhost:8080', 'http://127.0.0.1', 'http://[::1]:8080']) {
      const loopback = oidcFederationProvider({
        ...baseConfig,
        baseURL,
        fetch: jest.fn().mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 })),
      });
      await expect(loopback()).resolves.toEqual({ token: 'tok', expiresAt: NOW_IN_SECONDS + 60 });
    }
  });

  it('rejects identity tokens larger than 16 KiB', async () => {
    const provider = oidcFederationProvider({
      ...baseConfig,
      identityTokenProvider: () => 'x'.repeat(17 * 1024),
      fetch: jest.fn(),
    });
    await expect(provider()).rejects.toThrow('exceeds the 16 KiB assertion limit');
  });

  it('omits empty-string serviceAccountId from request body', async () => {
    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const provider = oidcFederationProvider({ ...baseConfig, fetch: mockFetch, serviceAccountId: '' });
    await provider();

    const body = JSON.parse((mockFetch as jest.Mock).mock.calls[0]![1].body);
    expect(body).not.toHaveProperty('service_account_id');
  });

  it('redactSensitive keeps only RFC 6749 §5.2 error fields and is idempotent', () => {
    const input = {
      error: 'invalid_grant',
      error_description: 'expired',
      error_uri: 'https://x',
      access_token: 'a',
      assertion: 'jwt',
      something_else: 'x',
    };
    const snapshot = JSON.stringify(input);
    const once = redactSensitive(input);
    const twice = redactSensitive(once);

    expect(JSON.stringify(input)).toBe(snapshot); // input unchanged
    expect(once).toEqual({ error: 'invalid_grant', error_description: 'expired', error_uri: 'https://x' });
    expect(twice).toEqual(once); // idempotent

    // Non-JSON strings are truncated, not parsed
    const long = 'x'.repeat(2500);
    const truncated = redactSensitive(long);
    expect(typeof truncated).toBe('string');
    expect((truncated as string).length).toBeLessThan(long.length);
    expect(truncated as string).toMatch(/<500 more chars>$/);
  });

  it('error bodies from the token endpoint are allowlist-redacted', async () => {
    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: 'invalid_grant', assertion: 'SECRET-JWT', refresh_token: 'SECRET-RT' }),
          { status: 400 },
        ),
      );

    const provider = oidcFederationProvider({ ...baseConfig, fetch: mockFetch });
    try {
      await provider();
      fail('expected throw');
    } catch (err) {
      const e = err as WorkloadIdentityError;
      expect(e.message).not.toContain('SECRET');
      expect(JSON.stringify(e.body)).not.toContain('SECRET');
      expect(JSON.parse(e.body as string)).toEqual({ error: 'invalid_grant' });
    }
  });

  it('throws WorkloadIdentityError on network failure', async () => {
    const mockFetch: Fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const provider = oidcFederationProvider({ ...baseConfig, fetch: mockFetch });
    await expect(provider()).rejects.toThrow('Failed to reach token endpoint');
  });

  it('supports async identity token providers', async () => {
    const asyncIdentity = async () => 'async-jwt';
    const mockFetch: Fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'tok', expires_in: 60 }));

    const provider = oidcFederationProvider({
      ...baseConfig,
      identityTokenProvider: asyncIdentity,
      fetch: mockFetch,
    });
    await provider();

    const body = JSON.parse((mockFetch as jest.Mock).mock.calls[0]![1].body);
    expect(body.assertion).toBe('async-jwt');
  });
});
