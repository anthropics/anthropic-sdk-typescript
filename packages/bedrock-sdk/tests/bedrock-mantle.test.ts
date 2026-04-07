import { AnthropicBedrockMantle } from '../src';
import { getAuthHeaders } from '../src/core/aws-auth';

jest.mock('../src/core/aws-auth', () => ({
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

const makeRequest = async (client: AnthropicBedrockMantle) => {
  await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ content: 'Test message', role: 'user' }],
  });
};

const getRequestUrl = (): string => {
  return mockFetch.mock.calls[0]![0];
};

describe('AnthropicBedrockMantle', () => {
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

  describe('base URL', () => {
    test('derives base URL from region', () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        awsRegion: 'us-east-1',
      });

      expect(client.baseURL).toBe('https://bedrock-mantle.us-east-1.api.aws/anthropic');
    });

    test('request URL includes /anthropic base path', async () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        awsRegion: 'us-west-2',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(getRequestUrl()).toBe('https://bedrock-mantle.us-west-2.api.aws/anthropic/v1/messages');
    });

    test('uses ANTHROPIC_BEDROCK_MANTLE_BASE_URL env var', () => {
      process.env['ANTHROPIC_BEDROCK_MANTLE_BASE_URL'] = 'https://custom.mantle.example.com';

      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
      });

      expect(client.baseURL).toBe('https://custom.mantle.example.com');
    });

    test('baseURL arg takes precedence over env var', () => {
      process.env['ANTHROPIC_BEDROCK_MANTLE_BASE_URL'] = 'https://from-env.example.com';

      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        baseURL: 'https://from-arg.example.com',
      });

      expect(client.baseURL).toBe('https://from-arg.example.com');
    });
  });

  describe('SigV4 service name', () => {
    test('uses bedrock-mantle as the SigV4 service name', async () => {
      const client = new AnthropicBedrockMantle({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsRegion: 'us-east-1',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(mockGetAuthHeaders).toHaveBeenCalledTimes(1);
      const props = mockGetAuthHeaders.mock.calls[0]![1];
      expect(props.serviceName).toBe('bedrock-mantle');
    });
  });

  describe('environment variables', () => {
    test('uses AWS_BEARER_TOKEN_BEDROCK env var', () => {
      process.env['AWS_BEARER_TOKEN_BEDROCK'] = 'mantle-api-key';

      const client = new AnthropicBedrockMantle({ baseURL: 'https://example.com' });

      expect(client.apiKey).toBe('mantle-api-key');
    });
  });

  describe('endpoint restrictions', () => {
    test('completions resource is not available', () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        baseURL: 'https://example.com',
      });

      expect((client as any).completions).toBeUndefined();
    });

    test('models resource is not available', () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        baseURL: 'https://example.com',
      });

      expect((client as any).models).toBeUndefined();
    });

    test('messages resource is available', () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        baseURL: 'https://example.com',
      });

      expect(client.messages).toBeDefined();
    });

    test('beta.messages resource is available', () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        baseURL: 'https://example.com',
      });

      expect(client.beta.messages).toBeDefined();
    });

    test('beta.models is not available', () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        baseURL: 'https://example.com',
      });

      expect((client.beta as any).models).toBeUndefined();
    });

    test('beta.files is not available', () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        baseURL: 'https://example.com',
      });

      expect((client.beta as any).files).toBeUndefined();
    });

    test('beta.skills is not available', () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        baseURL: 'https://example.com',
      });

      expect((client.beta as any).skills).toBeUndefined();
    });
  });
});
