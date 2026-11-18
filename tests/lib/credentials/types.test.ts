import { oidcFederationProvider } from '@anthropic-ai/sdk/lib/credentials/oidc-federation';
import { parseTokenResponse, WorkloadIdentityError } from '@anthropic-ai/sdk/lib/credentials/types';

describe('parseTokenResponse', () => {
  it.each([
    null,
    [],
    'not an object',
    { access_token: 123 },
    { access_token: true },
    { access_token: {} },
    { access_token: '' },
    { access_token: 'sensitive-token', token_type: 123 },
    { access_token: 'sensitive-token', token_type: 0 },
    { access_token: 'sensitive-token', token_type: false },
    { access_token: 'sensitive-token', token_type: null },
    { access_token: 'sensitive-token', token_type: '' },
    { access_token: 'sensitive-token', token_type: {} },
  ])('rejects malformed token response %j with request metadata', async (body) => {
    const response = new Response(JSON.stringify(body), { status: 200 });
    const error = await parseTokenResponse(response, 'req_test').catch((error: unknown) => error);

    expect(error).toBeInstanceOf(WorkloadIdentityError);
    expect(error).toMatchObject({ statusCode: 200, requestId: 'req_test' });
    expect(JSON.stringify(error)).not.toContain('sensitive-token');
    expect(String(error)).not.toContain('sensitive-token');
  });

  it.each([undefined, 'Bearer', 'bearer', 'BEARER'])(
    'preserves valid token responses with token_type %j',
    async (token_type) => {
      const body = {
        access_token: 'test-token',
        token_type,
        expires_in: 3600,
        refresh_token: 'test-refresh',
      };
      const response = new Response(JSON.stringify(body));
      await expect(parseTokenResponse(response, 'req_test')).resolves.toEqual(body);
    },
  );

  it('surfaces malformed successful federation responses as WorkloadIdentityError', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 123, expires_in: 60 }), {
        headers: { 'Request-Id': 'req_federation' },
      }),
    );
    const provider = oidcFederationProvider({
      identityTokenProvider: () => 'test-identity',
      federationRuleId: 'test-rule',
      organizationId: 'test-org',
      baseURL: 'https://example.invalid',
      fetch,
    });

    const error = await provider().catch((error: unknown) => error);
    expect(error).toBeInstanceOf(WorkloadIdentityError);
    expect(error).toMatchObject({ statusCode: 200, requestId: 'req_federation' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
