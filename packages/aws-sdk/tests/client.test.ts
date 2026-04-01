import { AnthropicAws } from '../src';
import { getAuthHeaders } from '../src/core/auth';

jest.mock('../src/core/auth', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({
    authorization: 'AWS4-HMAC-SHA256 Credential=mock',
    'x-amz-date': '20260312T000000Z',
  }),
}));

const mockGetAuthHeaders = getAuthHeaders as jest.MockedFunction<typeof getAuthHeaders>;

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

const makeRequest = async (client: AnthropicAws) => {
  await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ content: 'Test message', role: 'user' }],
  });
};

const getRequestHeaders = (): Headers => {
  const [, options] = mockFetch.mock.calls[0]!;
  return options.headers as Headers;
};

describe('AnthropicAws', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockClear();
    mockGetAuthHeaders.mockClear();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  describe('initialization with API key', () => {
    test('creates client with api key and custom region', () => {
      const client = new AnthropicAws({
        apiKey: 'test-key',
        awsRegion: 'eu-west-1',
        workspaceId: 'ws-test',
      });

      expect(client.apiKey).toBe('test-key');
      expect(client.baseURL).toBe('https://aws-external-anthropic.eu-west-1.api.aws');
      expect(client.awsRegion).toBe('eu-west-1');
    });

    test('creates client with api key and custom baseURL', () => {
      const client = new AnthropicAws({
        apiKey: 'test-key',
        baseURL: 'https://custom.api.example.com',
        workspaceId: 'ws-test',
      });

      expect(client.baseURL).toBe('https://custom.api.example.com');
    });
  });

  describe('initialization with SigV4 credentials', () => {
    test('creates client with explicit AWS credentials', () => {
      const client = new AnthropicAws({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsRegion: 'us-west-2',
        workspaceId: 'ws-test',
      });

      expect(client.awsAccessKey).toBe('my-access-key');
      expect(client.awsSecretAccessKey).toBe('my-secret-key');
      expect(client.awsRegion).toBe('us-west-2');
      expect(client.baseURL).toBe('https://aws-external-anthropic.us-west-2.api.aws');
    });

    test('creates client with session token', () => {
      const client = new AnthropicAws({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsSessionToken: 'my-session-token',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
      });

      expect(client.awsSessionToken).toBe('my-session-token');
    });

    test('creates client with provider chain resolver', () => {
      const resolver = jest.fn();

      const client = new AnthropicAws({
        providerChainResolver: resolver,
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
      });

      expect(client.providerChainResolver).toBe(resolver);
    });

    test('creates client with no explicit creds (falls back to provider chain)', () => {
      const client = new AnthropicAws({
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
      });

      expect(client.awsAccessKey).toBeNull();
      expect(client.awsSecretAccessKey).toBeNull();
      expect(client.baseURL).toBe('https://aws-external-anthropic.us-east-1.api.aws');
    });
  });

  describe('initialization with awsProfile', () => {
    test('creates client with awsProfile', () => {
      const client = new AnthropicAws({
        awsProfile: 'my-profile',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
      });

      expect(client.awsProfile).toBe('my-profile');
    });
  });

  describe('partial credential validation', () => {
    test('throws when only awsAccessKey is provided', () => {
      expect(
        () =>
          new AnthropicAws({
            awsAccessKey: 'my-access-key',
            awsRegion: 'us-east-1',
            workspaceId: 'ws-test',
          }),
      ).toThrow('`awsAccessKey` and `awsSecretAccessKey` must be provided together.');
    });

    test('throws when only awsSecretAccessKey is provided', () => {
      expect(
        () =>
          new AnthropicAws({
            awsSecretAccessKey: 'my-secret-key',
            awsRegion: 'us-east-1',
            workspaceId: 'ws-test',
          }),
      ).toThrow('`awsAccessKey` and `awsSecretAccessKey` must be provided together.');
    });
  });

  describe('initialization from environment variables', () => {
    test('uses AWS_REGION env var', () => {
      process.env['AWS_REGION'] = 'ap-southeast-1';

      const client = new AnthropicAws({
        apiKey: 'test-key',
        workspaceId: 'ws-test',
      });

      expect(client.awsRegion).toBe('ap-southeast-1');
      expect(client.baseURL).toBe('https://aws-external-anthropic.ap-southeast-1.api.aws');
    });

    test('uses ANTHROPIC_AWS_API_KEY env var', () => {
      process.env['ANTHROPIC_AWS_API_KEY'] = 'env-api-key';

      const client = new AnthropicAws({ awsRegion: 'us-east-1', workspaceId: 'ws-test' });

      expect(client.apiKey).toBe('env-api-key');
    });

    test('uses ANTHROPIC_AWS_BASE_URL env var', () => {
      process.env['ANTHROPIC_AWS_BASE_URL'] = 'https://custom.gateway.api.aws';

      const client = new AnthropicAws({
        apiKey: 'test-key',
        workspaceId: 'ws-test',
      });

      expect(client.baseURL).toBe('https://custom.gateway.api.aws');
    });

    test('uses AWS_DEFAULT_REGION env var as fallback', () => {
      process.env['AWS_DEFAULT_REGION'] = 'eu-central-1';

      const client = new AnthropicAws({
        apiKey: 'test-key',
        workspaceId: 'ws-test',
      });

      expect(client.awsRegion).toBe('eu-central-1');
      expect(client.baseURL).toBe('https://aws-external-anthropic.eu-central-1.api.aws');
    });

    test('AWS_REGION takes precedence over AWS_DEFAULT_REGION', () => {
      process.env['AWS_REGION'] = 'us-west-2';
      process.env['AWS_DEFAULT_REGION'] = 'eu-central-1';

      const client = new AnthropicAws({
        apiKey: 'test-key',
        workspaceId: 'ws-test',
      });

      expect(client.awsRegion).toBe('us-west-2');
      expect(client.baseURL).toBe('https://aws-external-anthropic.us-west-2.api.aws');
    });

    test('awsRegion arg takes precedence over AWS_REGION env', () => {
      process.env['AWS_REGION'] = 'from-env';

      const client = new AnthropicAws({
        apiKey: 'test-key',
        awsRegion: 'from-arg',
        workspaceId: 'ws-test',
      });

      expect(client.awsRegion).toBe('from-arg');
      expect(client.baseURL).toBe('https://aws-external-anthropic.from-arg.api.aws');
    });

    test('throws when no region or base URL is provided', () => {
      expect(() => new AnthropicAws({ apiKey: 'test-key', workspaceId: 'ws-test' })).toThrow(
        'No AWS region or base URL found.',
      );
    });

    test('allows missing region when baseURL is provided', () => {
      const client = new AnthropicAws({
        apiKey: 'test-key',
        baseURL: 'https://custom.gateway.api.aws',
        workspaceId: 'ws-test',
      });

      expect(client.awsRegion).toBeUndefined();
      expect(client.baseURL).toBe('https://custom.gateway.api.aws');
    });
  });

  describe('auth precedence', () => {
    test('apiKey arg sends x-api-key header, not SigV4', async () => {
      const client = new AnthropicAws({
        apiKey: 'my-api-key',
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      await makeRequest(client);

      const headers = getRequestHeaders();
      expect(headers.get('x-api-key')).toBe('my-api-key');
      expect(mockGetAuthHeaders).not.toHaveBeenCalled();
    });

    test('explicit AWS creds use SigV4, not API key', async () => {
      const client = new AnthropicAws({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(mockGetAuthHeaders).toHaveBeenCalledTimes(1);
      const props = mockGetAuthHeaders.mock.calls[0]![1];
      expect(props.awsAccessKey).toBe('my-access-key');
      expect(props.awsSecretAccessKey).toBe('my-secret-key');

      const headers = getRequestHeaders();
      expect(headers.get('x-api-key')).toBeNull();
    });

    test('explicit AWS creds take precedence over env ANTHROPIC_AWS_API_KEY', async () => {
      process.env['ANTHROPIC_AWS_API_KEY'] = 'env-api-key';

      const client = new AnthropicAws({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(mockGetAuthHeaders).toHaveBeenCalledTimes(1);
      const headers = getRequestHeaders();
      expect(headers.get('x-api-key')).toBeNull();
    });

    test('awsProfile uses SigV4 and passes profile to auth', async () => {
      const client = new AnthropicAws({
        awsProfile: 'my-profile',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(mockGetAuthHeaders).toHaveBeenCalledTimes(1);
      const props = mockGetAuthHeaders.mock.calls[0]![1];
      expect(props.awsProfile).toBe('my-profile');

      const headers = getRequestHeaders();
      expect(headers.get('x-api-key')).toBeNull();
    });

    test('awsProfile takes precedence over env ANTHROPIC_AWS_API_KEY', async () => {
      process.env['ANTHROPIC_AWS_API_KEY'] = 'env-api-key';

      const client = new AnthropicAws({
        awsProfile: 'my-profile',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(mockGetAuthHeaders).toHaveBeenCalledTimes(1);
      const headers = getRequestHeaders();
      expect(headers.get('x-api-key')).toBeNull();
    });

    test('env ANTHROPIC_AWS_API_KEY sends x-api-key header when no constructor auth', async () => {
      process.env['ANTHROPIC_AWS_API_KEY'] = 'env-api-key';

      const client = new AnthropicAws({ awsRegion: 'us-east-1', workspaceId: 'ws-test', maxRetries: 0 });

      await makeRequest(client);

      const headers = getRequestHeaders();
      expect(headers.get('x-api-key')).toBe('env-api-key');
      expect(mockGetAuthHeaders).not.toHaveBeenCalled();
    });

    test('no auth falls back to SigV4 default chain', async () => {
      const client = new AnthropicAws({
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(mockGetAuthHeaders).toHaveBeenCalledTimes(1);
      const props = mockGetAuthHeaders.mock.calls[0]![1];
      expect(props.awsAccessKey).toBeNull();
      expect(props.awsSecretAccessKey).toBeNull();
      expect(props.awsProfile).toBeNull();

      const headers = getRequestHeaders();
      expect(headers.get('x-api-key')).toBeNull();
    });
  });

  describe('SigV4 auth headers', () => {
    test('sends SigV4 signed headers on request', async () => {
      const client = new AnthropicAws({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsRegion: 'us-west-2',
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe('https://aws-external-anthropic.us-west-2.api.aws/v1/messages');

      const headers = getRequestHeaders();
      expect(headers.get('authorization')).toBe('AWS4-HMAC-SHA256 Credential=mock');
      expect(headers.get('x-amz-date')).toBe('20260312T000000Z');
      expect(headers.get('content-type')).toBe('application/json');
    });

    test('passes session token to auth', async () => {
      const client = new AnthropicAws({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsSessionToken: 'my-session-token',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      await makeRequest(client);

      const props = mockGetAuthHeaders.mock.calls[0]![1];
      expect(props.awsSessionToken).toBe('my-session-token');
    });
  });

  describe('API key auth headers', () => {
    test('sends x-api-key header', async () => {
      const client = new AnthropicAws({
        apiKey: 'test-api-key',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe('https://aws-external-anthropic.us-east-1.api.aws/v1/messages');

      const headers = getRequestHeaders();
      expect(headers.get('x-api-key')).toBe('test-api-key');
      expect(headers.get('anthropic-version')).toBeTruthy();
      expect(headers.get('content-type')).toBe('application/json');
    });
  });

  describe('workspaceId', () => {
    test('sends anthropic-workspace-id header when workspaceId is set', async () => {
      const client = new AnthropicAws({
        apiKey: 'test-key',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-abc123',
        maxRetries: 0,
      });

      await makeRequest(client);

      const headers = getRequestHeaders();
      expect(headers.get('anthropic-workspace-id')).toBe('ws-abc123');
    });

    test('uses ANTHROPIC_AWS_WORKSPACE_ID env var', async () => {
      process.env['ANTHROPIC_AWS_WORKSPACE_ID'] = 'ws-from-env';

      const client = new AnthropicAws({
        apiKey: 'test-key',
        awsRegion: 'us-east-1',
        maxRetries: 0,
      });

      expect(client.workspaceId).toBe('ws-from-env');
      await makeRequest(client);

      const headers = getRequestHeaders();
      expect(headers.get('anthropic-workspace-id')).toBe('ws-from-env');
    });

    test('workspaceId arg takes precedence over env var', async () => {
      process.env['ANTHROPIC_AWS_WORKSPACE_ID'] = 'ws-from-env';

      const client = new AnthropicAws({
        apiKey: 'test-key',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-from-arg',
        maxRetries: 0,
      });

      expect(client.workspaceId).toBe('ws-from-arg');
      await makeRequest(client);

      const headers = getRequestHeaders();
      expect(headers.get('anthropic-workspace-id')).toBe('ws-from-arg');
    });

    test('throws when workspaceId is not set and env var is absent', () => {
      expect(() => new AnthropicAws({ apiKey: 'test-key', awsRegion: 'us-east-1' })).toThrow(
        'No workspace ID found. Set `workspaceId` in the constructor or the `ANTHROPIC_AWS_WORKSPACE_ID` environment variable.',
      );
    });
  });

  describe('skipAuth', () => {
    test('constructs without any auth credentials when skipAuth is true', () => {
      const client = new AnthropicAws({
        baseURL: 'https://my-gateway.example.com',
        skipAuth: true,
      });

      expect(client.skipAuth).toBe(true);
      expect(client.apiKey).toBeNull();
      expect(client.awsAccessKey).toBeNull();
      expect(client.awsSecretAccessKey).toBeNull();
    });

    test('does not require workspaceId when skipAuth is true', () => {
      expect(
        () =>
          new AnthropicAws({
            baseURL: 'https://my-gateway.example.com',
            skipAuth: true,
          }),
      ).not.toThrow();
    });

    test('still uses workspaceId when provided with skipAuth', async () => {
      const client = new AnthropicAws({
        baseURL: 'https://my-gateway.example.com',
        skipAuth: true,
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      expect(client.workspaceId).toBe('ws-test');
      await makeRequest(client);

      const headers = getRequestHeaders();
      expect(headers.get('anthropic-workspace-id')).toBe('ws-test');
    });

    test('does not send x-api-key header when skipAuth is true', async () => {
      const client = new AnthropicAws({
        baseURL: 'https://my-gateway.example.com',
        skipAuth: true,
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      await makeRequest(client);

      const headers = getRequestHeaders();
      expect(headers.get('x-api-key')).toBeNull();
      expect(mockGetAuthHeaders).not.toHaveBeenCalled();
    });

    test('does not call SigV4 auth when skipAuth is true with AWS creds', async () => {
      const client = new AnthropicAws({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsRegion: 'us-east-1',
        baseURL: 'https://my-gateway.example.com',
        skipAuth: true,
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(mockGetAuthHeaders).not.toHaveBeenCalled();
    });

    test('does not require awsRegion when skipAuth is true and using SigV4 path', async () => {
      const client = new AnthropicAws({
        baseURL: 'https://my-gateway.example.com',
        skipAuth: true,
        workspaceId: 'ws-test',
        maxRetries: 0,
      });

      // Should not throw about missing region
      await expect(makeRequest(client)).resolves.toBeUndefined();
      expect(mockGetAuthHeaders).not.toHaveBeenCalled();
    });

    test('defaults skipAuth to false', () => {
      const client = new AnthropicAws({
        apiKey: 'test-key',
        awsRegion: 'us-east-1',
        workspaceId: 'ws-test',
      });

      expect(client.skipAuth).toBe(false);
    });
  });

  describe('resources', () => {
    test('has messages resource', () => {
      const client = new AnthropicAws({ apiKey: 'test-key', awsRegion: 'us-east-1', workspaceId: 'ws-test' });
      expect(client.messages).toBeDefined();
    });

    test('has beta resource', () => {
      const client = new AnthropicAws({ apiKey: 'test-key', awsRegion: 'us-east-1', workspaceId: 'ws-test' });
      expect(client.beta).toBeDefined();
    });

    test('has models resource', () => {
      const client = new AnthropicAws({ apiKey: 'test-key', awsRegion: 'us-east-1', workspaceId: 'ws-test' });
      expect(client.models).toBeDefined();
    });
  });
});
