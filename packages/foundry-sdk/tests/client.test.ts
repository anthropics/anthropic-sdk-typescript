import { AnthropicFoundry } from '../src';

const mockFetch = jest.fn().mockImplementation(() => {
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
      jest.resetModules();
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
    });

    test('AD provider', async () => {
      const tokenProvider = jest.fn().mockResolvedValue('my-azure-ad-token');

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

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://my-resource.services.ai.azure.com/anthropic/v1/messages');

      const headers = options.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer my-azure-ad-token');
      expect(headers.get('anthropic-version')).toBeTruthy();
      expect(headers.get('content-type')).toBe('application/json');
    });
  });
});
