import { VERSION } from '@anthropic-ai/sdk/version';
import { copyClientForHelper } from '@anthropic-ai/sdk/lib/helper-client';
import { AnthropicFoundry } from '../src';

const mockFetch = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('{}'),
  });
});
const originalFetch = global.fetch;

describe('AnthropicFoundry', () => {
  describe('basic initialization with API key', () => {
    test('creates client with api key and resource', () => {
      const client = new AnthropicFoundry({
        apiKey: 'test-key',
        resource: 'example-resource',
      });

      expect(client.apiKey).toBe('test-key');
      expect(client.baseURL).toBe('https://example-resource.services.ai.azure.com/anthropic/');
    });
  });

  describe('initialization with base_url', () => {
    test('creates client with baseURL instead of resource', () => {
      const client = new AnthropicFoundry({
        apiKey: 'test-key',
        baseURL: 'https://example.azure.anthropic.com/anthropic',
      });

      expect(client.baseURL).toBe('https://example.azure.anthropic.com/anthropic');
    });
  });

  describe('initialization with Azure AD token provider', () => {
    test('creates client with Azure AD token provider', async () => {
      const tokenProvider = async () => 'test-token';

      const client = new AnthropicFoundry({
        azureADTokenProvider: tokenProvider,
        resource: 'example-resource',
      });

      expect(client).toBeInstanceOf(AnthropicFoundry);
      // Verify token provider is stored correctly
      expect((client as any)._options.apiKey).toBe(tokenProvider);
    });
  });

  describe('initialization from environment variables', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('falls back to environment variables', () => {
      process.env['ANTHROPIC_FOUNDRY_API_KEY'] = 'env-key';
      process.env['ANTHROPIC_FOUNDRY_RESOURCE'] = 'env-resource';

      const client = new AnthropicFoundry();

      expect(client.apiKey).toBe('env-key');
      expect(client.baseURL).toContain('env-resource.services.ai.azure.com');
    });
  });

  describe('missing credentials error', () => {
    test('throws error when no credentials are provided', () => {
      expect(() => {
        new AnthropicFoundry({
          resource: 'example-resource',
        });
      }).toThrow('Missing credentials');
    });
  });

  describe('missing resource error', () => {
    test('throws error when neither resource nor baseURL is provided', () => {
      expect(() => {
        new AnthropicFoundry({
          apiKey: 'test-key',
        });
      }).toThrow(/baseURL.*resource/);
    });
  });

  describe('mutually exclusive arguments', () => {
    test('throws error when both apiKey and azureADTokenProvider are provided', () => {
      expect(() => {
        new AnthropicFoundry({
          apiKey: 'test-key',
          azureADTokenProvider: async () => 'token',
          resource: 'example-resource',
        });
      }).toThrow('apiKey` and `azureADTokenProvider` arguments are mutually exclusive');
    });

    test('throws error when both resource and baseURL are provided', () => {
      expect(() => {
        new AnthropicFoundry({
          apiKey: 'test-key',
          baseURL: 'https://example.com/anthropic',
          resource: 'example-resource',
        });
      }).toThrow('baseURL and resource are mutually exclusive');
    });
  });

  describe('dangerouslyAllowBrowser behavior', () => {
    test('sets dangerouslyAllowBrowser when azureADTokenProvider is provided', () => {
      const client = new AnthropicFoundry({
        azureADTokenProvider: async () => 'test-token',
        resource: 'example-resource',
      });

      expect(client).toBeInstanceOf(AnthropicFoundry);
      // The client should be created without throwing browser security error
    });
  });

  describe('auth', () => {
    beforeEach(() => {
      global.fetch = mockFetch;
      mockFetch.mockClear();
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.unstubAllEnvs();
    });

    test('API key', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'env-anthropic-key');
      vi.stubEnv('ANTHROPIC_AUTH_TOKEN', 'env-oauth-token');

      const client = new AnthropicFoundry({
        apiKey: 'my-foundry-key',
        resource: 'my-resource',
        maxRetries: 1,
      });

      await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });

      const [, options] = mockFetch.mock.calls[0]!;
      const headers = options.headers as Headers;
      expect(headers.get('x-api-key')).toBe('my-foundry-key');
      expect(headers.get('authorization')).toBeNull();
    });

    describe.each<[string, (extra: object) => AnthropicFoundry]>([
      ['the constructor', (extra) => new AnthropicFoundry({ resource: 'my-resource', ...extra })],
      [
        'withOptions',
        (extra) =>
          new AnthropicFoundry({ apiKey: 'my-foundry-key', resource: 'my-resource' }).withOptions(extra),
      ],
    ])('%s', (_where, build) => {
      test.each<[string, object]>([
        ['authToken', { authToken: 'first-party-token' }],
        ['credentials', { credentials: async () => ({ token: 'first-party-token', expiresAt: null }) }],
        ['config', { config: { authentication: { type: 'user_oauth' } } }],
        ['profile', { profile: 'my-profile' }],
      ])('rejects `%s`', (name, extra) => {
        vi.stubEnv('ANTHROPIC_FOUNDRY_API_KEY', 'my-foundry-key');
        expect(() => build(extra)).toThrow(
          `The \`${name}\` option is not supported by AnthropicFoundry; authentication uses ` +
            'a Foundry API key (`apiKey`) or a Microsoft Entra token (`azureADTokenProvider`).',
        );
      });
    });

    describe.each<[string, object, Record<string, string>, string | null, string]>([
      [
        'the `resource` option',
        { resource: 'my-resource' },
        {},
        'my-resource',
        'https://my-resource.services.ai.azure.com/anthropic/',
      ],
      [
        'ANTHROPIC_FOUNDRY_RESOURCE',
        {},
        { ANTHROPIC_FOUNDRY_RESOURCE: 'my-resource' },
        'my-resource',
        'https://my-resource.services.ai.azure.com/anthropic/',
      ],
      [
        'the `baseURL` option',
        { baseURL: 'https://gateway.example.com/anthropic/' },
        {},
        null,
        'https://gateway.example.com/anthropic/',
      ],
      [
        'ANTHROPIC_FOUNDRY_BASE_URL',
        {},
        { ANTHROPIC_FOUNDRY_BASE_URL: 'https://gateway.example.com/anthropic/' },
        null,
        'https://gateway.example.com/anthropic/',
      ],
    ])('a copy of a client whose endpoint came from %s', (_source, options, env, resource, baseURL) => {
      test.each<[string, object, string | null, string]>([
        ['keeps it', { timeout: 1234 }, resource, baseURL],
        [
          'uses the `resource` it is given',
          { resource: 'other-resource' },
          'other-resource',
          'https://other-resource.services.ai.azure.com/anthropic/',
        ],
        [
          'uses the `baseURL` it is given',
          { baseURL: 'https://proxy.example.com/anthropic/' },
          null,
          'https://proxy.example.com/anthropic/',
        ],
      ])('%s', (_what, extra, copyResource, copyBaseURL) => {
        for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);

        const copy = new AnthropicFoundry({ apiKey: 'my-foundry-key', ...options }).withOptions(extra);

        expect(copy.resource).toBe(copyResource);
        expect(copy.baseURL).toBe(copyBaseURL);
      });
    });

    test('a copy rejects a `resource` together with a `baseURL`', () => {
      const client = new AnthropicFoundry({ apiKey: 'my-foundry-key', resource: 'my-resource' });

      expect(() =>
        client.withOptions({ resource: 'other-resource', baseURL: 'https://proxy.example.com/anthropic/' }),
      ).toThrow('baseURL and resource are mutually exclusive');
    });

    test('a helper sub-client is refused rather than sent out with the API key', () => {
      const client = new AnthropicFoundry({ apiKey: 'my-foundry-key', resource: 'my-resource' });

      expect(() =>
        // @ts-expect-error `AnthropicFoundry` narrows `messages`, so it is not assignable to `Anthropic`
        copyClientForHelper(client, { authToken: 'environment-key', helper: 'environments-work-poller' }),
      ).toThrow('The `authToken` option is not supported by AnthropicFoundry');
      expect(() =>
        client.beta.environments.work.poller({ environmentId: 'env_1', environmentKey: 'environment-key' }),
      ).toThrow('The `authToken` option is not supported by AnthropicFoundry');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('AD provider', async () => {
      vi.stubEnv('ANTHROPIC_FEDERATION_RULE_ID', 'fdrl_01abc');
      vi.stubEnv('ANTHROPIC_ORGANIZATION_ID', 'org-123');
      vi.stubEnv('ANTHROPIC_IDENTITY_TOKEN', 'my-jwt');

      const tokenProvider = vi.fn().mockResolvedValue('my-azure-ad-token');

      const client = new AnthropicFoundry({
        azureADTokenProvider: tokenProvider,
        resource: 'my-resource',
        maxRetries: 1,
      });

      await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });

      expect(tokenProvider).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe('https://my-resource.services.ai.azure.com/anthropic/v1/messages');

      const headers = options.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer my-azure-ad-token');
      expect(headers.get('anthropic-beta')).toBeNull();
      expect(headers.get('anthropic-version')).toBeTruthy();
      expect(headers.get('content-type')).toBe('application/json');
    });

    test('a copy keeps the AD provider', async () => {
      const client = new AnthropicFoundry({
        azureADTokenProvider: async () => 'my-azure-ad-token',
        resource: 'my-resource',
      });

      await client.withOptions({ maxRetries: 1 }).messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });

      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe('https://my-resource.services.ai.azure.com/anthropic/v1/messages');
      expect((options.headers as Headers).get('authorization')).toBe('Bearer my-azure-ad-token');
    });

    test('logical credentials are visible to user middleware', async () => {
      let middlewareSawAuthorization: string | null = null;

      const client = new AnthropicFoundry({
        azureADTokenProvider: async () => 'my-azure-ad-token',
        resource: 'my-resource',
        maxRetries: 1,
        middleware: [
          async (request, next) => {
            middlewareSawAuthorization = request.headers.get('authorization');
            return next(request);
          },
        ],
      });

      await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });

      expect(middlewareSawAuthorization).toBe('Bearer my-azure-ad-token');
    });
  });

  describe('user profiles', () => {
    beforeEach(() => {
      global.fetch = mockFetch;
      mockFetch.mockClear();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    const profileURL = 'https://my-resource.services.ai.azure.com/anthropic/v1/user_profiles';

    const requestCases: Array<[string, (client: AnthropicFoundry) => PromiseLike<unknown>, string, string]> =
      [
        ['create', (client) => client.userProfiles.create({}), 'POST', profileURL],
        [
          'retrieve',
          (client) => client.userProfiles.retrieve('uprof_fake'),
          'GET',
          `${profileURL}/uprof_fake`,
        ],
        [
          'update',
          (client) => client.userProfiles.update('uprof_fake', { metadata: { key: 'value' } }),
          'POST',
          `${profileURL}/uprof_fake`,
        ],
        ['list', (client) => client.userProfiles.list(), 'GET', profileURL],
        [
          'delete',
          (client) => client.userProfiles.delete('uprof_fake'),
          'DELETE',
          `${profileURL}/uprof_fake`,
        ],
      ];

    test.each(requestCases)('%s sends the API key', async (_name, send, method, url) => {
      const client = new AnthropicFoundry({ apiKey: 'test-key', resource: 'my-resource', maxRetries: 0 });

      await send(client);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [requestURL, requestInit] = mockFetch.mock.calls[0]!;
      expect(requestURL).toBe(url);
      expect(requestInit.method.toUpperCase()).toBe(method);
      expect((requestInit.headers as Headers).get('x-api-key')).toBe('test-key');
    });

    test.each(requestCases)('%s sends the Azure AD token', async (_name, send, method, url) => {
      const client = new AnthropicFoundry({
        azureADTokenProvider: async () => 'my-azure-ad-token',
        resource: 'my-resource',
        maxRetries: 0,
      });

      await send(client);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [requestURL, requestInit] = mockFetch.mock.calls[0]!;
      expect(requestURL).toBe(url);
      expect(requestInit.method.toUpperCase()).toBe(method);
      expect((requestInit.headers as Headers).get('authorization')).toBe('Bearer my-azure-ad-token');
    });

    const params = {
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ content: 'Test message', role: 'user' as const }],
    };
    const countTokensParams = { model: params.model, messages: params.messages };

    test.each<[string, (client: AnthropicFoundry) => Promise<unknown>]>([
      ['messages.create', (client) => client.messages.create({ ...params, user_profile_id: 'uprof_fake' })],
      [
        'beta.messages.create',
        (client) => client.beta.messages.create({ ...params, user_profile_id: 'uprof_fake' }),
      ],
      [
        'messages.countTokens',
        (client) => client.messages.countTokens({ ...countTokensParams, user_profile_id: 'uprof_fake' }),
      ],
      [
        'beta.messages.countTokens',
        (client) => client.beta.messages.countTokens({ ...countTokensParams, user_profile_id: 'uprof_fake' }),
      ],
    ])('%s sends the ID as a header', async (_name, send) => {
      const client = new AnthropicFoundry({ apiKey: 'test-key', resource: 'my-resource', maxRetries: 0 });

      await send(client);

      const [, requestInit] = mockFetch.mock.calls[0]!;
      expect((requestInit.headers as Headers).get('anthropic-user-profile-id')).toBe('uprof_fake');
      expect(JSON.parse(requestInit.body as string).user_profile_id).toBeUndefined();
    });
  });

  test('user agent is a hardcoded string', async () => {
    const originalName = AnthropicFoundry.name;
    // Rename the class, as a minifier would, to prove the header isn't derived from it.
    Object.defineProperty(AnthropicFoundry, 'name', { value: 'MinifiedClient' });
    try {
      const client = new AnthropicFoundry({ apiKey: 'test-key', resource: 'example-resource' });
      expect(client.constructor.name).toBe('MinifiedClient');
      const { req } = await client.buildRequest({ path: '/foo', method: 'post' });
      expect(req.headers.get('user-agent')).toBe(`AnthropicFoundry/JS ${VERSION}`);
    } finally {
      Object.defineProperty(AnthropicFoundry, 'name', { value: originalName });
    }
  });
});
