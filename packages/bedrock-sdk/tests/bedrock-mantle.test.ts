import type { MockedFunction } from 'vitest';
import { VERSION } from '@anthropic-ai/sdk/version';
import { copyClientForHelper } from '@anthropic-ai/sdk/lib/helper-client';
import { AnthropicBedrockMantle } from '../src';
import { getAuthHeaders } from '../src/core/aws-auth';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

vi.mock('../src/core/aws-auth', () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    authorization: 'AWS4-HMAC-SHA256 Credential=mock',
    'x-amz-date': '20260312T000000Z',
  }),
}));

const mockGetAuthHeaders = getAuthHeaders as MockedFunction<typeof getAuthHeaders>;

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

const makeRequest = async (client: AnthropicBedrockMantle) => {
  await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [{ content: 'Test message', role: 'user' }],
  });
};

const getRequestUrl = (): string => {
  return mockFetch.mock.calls[0]![0];
};

const getRequestHeaders = (call = 0): Headers => {
  const requestInit = mockFetch.mock.calls[call]![1] as RequestInit;
  return new Headers(requestInit.headers as HeadersInit);
};

const getRequestBody = (): unknown => {
  const requestInit = mockFetch.mock.calls[0]![1] as RequestInit;
  return JSON.parse(requestInit.body as string);
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

    test('signs after user middleware, covering the mutated request and hiding the signature from middleware', async () => {
      let middlewareSawSignature: string | null = null;
      const client = new AnthropicBedrockMantle({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsRegion: 'us-east-1',
        maxRetries: 0,
        middleware: [
          async (request, next) => {
            middlewareSawSignature = request.headers.get('authorization');
            const body = JSON.parse(request.body as string);
            body.metadata = { user_id: 'user-123' };
            return next({ ...request, body: JSON.stringify(body) });
          },
        ],
      });

      await makeRequest(client);

      expect(middlewareSawSignature).toBeNull();
      const signedRequest = mockGetAuthHeaders.mock.calls[0]![0] as { body?: unknown };
      expect(JSON.parse(signedRequest.body as string).metadata).toEqual({ user_id: 'user-123' });
    });
  });

  describe('environment variables', () => {
    test('uses AWS_BEARER_TOKEN_BEDROCK env var', () => {
      process.env['AWS_BEARER_TOKEN_BEDROCK'] = 'mantle-api-key';

      const client = new AnthropicBedrockMantle({ baseURL: 'https://example.com' });

      expect(client.apiKey).toBe('mantle-api-key');
    });
  });

  describe('bearer token auth', () => {
    test('sends Authorization: Bearer header when using apiKey', async () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-bearer-token',
        awsRegion: 'us-east-1',
        maxRetries: 0,
      });

      await makeRequest(client);

      const requestInit = mockFetch.mock.calls[0]![1] as RequestInit;
      const headers = new Headers(requestInit.headers as HeadersInit);
      expect(headers.get('authorization')).toBe('Bearer test-bearer-token');
      expect(headers.get('x-api-key')).toBeNull();
    });

    test('sends Authorization: Bearer header when using AWS_BEARER_TOKEN_BEDROCK env var', async () => {
      process.env['AWS_BEARER_TOKEN_BEDROCK'] = 'env-bearer-token';

      const client = new AnthropicBedrockMantle({
        awsRegion: 'us-east-1',
        maxRetries: 0,
      });

      await makeRequest(client);

      const requestInit = mockFetch.mock.calls[0]![1] as RequestInit;
      const headers = new Headers(requestInit.headers as HeadersInit);
      expect(headers.get('authorization')).toBe('Bearer env-bearer-token');
      expect(headers.get('x-api-key')).toBeNull();
    });

    describe.each<[string, (extra: object) => AnthropicBedrockMantle]>([
      ['the constructor', (extra) => new AnthropicBedrockMantle({ awsRegion: 'us-east-1', ...extra })],
      ['withOptions', (extra) => new AnthropicBedrockMantle({ awsRegion: 'us-east-1' }).withOptions(extra)],
    ])('%s', (_where, build) => {
      test.each<[string, object]>([
        ['authToken', { authToken: 'first-party-token' }],
        ['credentials', { credentials: async () => ({ token: 'first-party-token', expiresAt: null }) }],
        ['config', { config: { authentication: { type: 'user_oauth' } } }],
        ['profile', { profile: 'my-profile' }],
      ])('rejects `%s`', (name, extra) => {
        process.env['AWS_BEARER_TOKEN_BEDROCK'] = 'env-bearer-token';
        expect(() => build(extra)).toThrow(
          `The \`${name}\` option is not supported by AnthropicBedrockMantle; ` +
            'authentication uses a Bedrock API key (`apiKey`) or AWS credentials (SigV4).',
        );
      });
    });

    test('a copy that clears the apiKey signs instead of reading AWS_BEARER_TOKEN_BEDROCK', async () => {
      process.env['AWS_BEARER_TOKEN_BEDROCK'] = 'env-bearer-token';
      process.env['AWS_REGION'] = 'us-east-1';
      const client = new AnthropicBedrockMantle({ apiKey: 'test-bearer-token' });

      await makeRequest(client.withOptions({ apiKey: null }));

      const [, requestInit] = mockFetch.mock.calls[0]!;
      const headers = new Headers(requestInit.headers as HeadersInit);
      expect(headers.get('authorization')).toBe('AWS4-HMAC-SHA256 Credential=mock');
    });

    test('a copy signs with the region, AWS credentials and resolver of its parent', async () => {
      process.env['AWS_REGION'] = 'us-east-1';
      const providerChainResolver = vi.fn();
      const client = new AnthropicBedrockMantle({
        awsRegion: 'eu-west-1',
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsSessionToken: 'my-session-token',
        awsProfile: 'my-profile',
        providerChainResolver,
      });

      await makeRequest(client.withOptions({ timeout: 1234 }));

      expect(mockGetAuthHeaders).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          regionName: 'eu-west-1',
          awsAccessKey: 'my-access-key',
          awsSecretAccessKey: 'my-secret-key',
          awsSessionToken: 'my-session-token',
          awsProfile: 'my-profile',
          providerChainResolver,
        }),
      );
    });

    const otherResolver = vi.fn();

    test.each<[string, object]>([
      ['keys', { awsAccessKey: 'other-access-key', awsSecretAccessKey: 'other-secret-key' }],
      ['a profile', { awsProfile: 'other-profile' }],
      ['a resolver', { providerChainResolver: otherResolver }],
    ])('a copy given %s uses none of the AWS credentials of its parent', async (_what, extra) => {
      const client = new AnthropicBedrockMantle({
        awsRegion: 'eu-west-1',
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsSessionToken: 'my-session-token',
        awsProfile: 'my-profile',
        providerChainResolver: vi.fn(),
      });

      await makeRequest(client.withOptions(extra));

      expect(mockGetAuthHeaders).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          regionName: 'eu-west-1',
          awsAccessKey: null,
          awsSecretAccessKey: null,
          awsSessionToken: null,
          awsProfile: null,
          providerChainResolver: null,
          ...extra,
        }),
      );
    });

    test('a copy of a client that skips auth skips it too', async () => {
      const client = new AnthropicBedrockMantle({ awsRegion: 'us-east-1', skipAuth: true });

      await makeRequest(client.withOptions({ timeout: 1234 }));

      expect(getRequestHeaders().get('authorization')).toBeNull();
      expect(mockGetAuthHeaders).not.toHaveBeenCalled();
    });

    test('a helper sub-client is refused rather than sent out with the bearer token', () => {
      const client = new AnthropicBedrockMantle({ apiKey: 'test-bearer-token', awsRegion: 'us-east-1' });

      expect(() =>
        // @ts-expect-error the helpers take an `Anthropic` client
        copyClientForHelper(client, { authToken: 'environment-key', helper: 'environments-work-poller' }),
      ).toThrow('The `authToken` option is not supported by AnthropicBedrockMantle');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('does not send Authorization: Bearer header when using SigV4', async () => {
      const client = new AnthropicBedrockMantle({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsRegion: 'us-east-1',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(mockGetAuthHeaders).toHaveBeenCalledTimes(1);
    });
  });

  describe('user profile ID', () => {
    const params = {
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ content: 'Test message', role: 'user' as const }],
    };
    const countTokensParams = { model: params.model, messages: params.messages };

    const newClient = () =>
      new AnthropicBedrockMantle({ apiKey: 'test-key', awsRegion: 'us-east-1', maxRetries: 0 });

    type Send = (client: AnthropicBedrockMantle, extra: { user_profile_id?: string }) => Promise<unknown>;

    const sendCases: Array<[string, Send, Record<string, unknown>]> = [
      ['messages.create', (client, extra) => client.messages.create({ ...params, ...extra }), params],
      [
        'messages.create with stream',
        (client, extra) => client.messages.create({ ...params, ...extra, stream: true }),
        { ...params, stream: true },
      ],
      [
        'beta.messages.create',
        (client, extra) => client.beta.messages.create({ ...params, ...extra }),
        params,
      ],
      [
        'beta.messages.create with stream',
        (client, extra) => client.beta.messages.create({ ...params, ...extra, stream: true }),
        { ...params, stream: true },
      ],
      [
        'messages.countTokens',
        (client, extra) => client.messages.countTokens({ ...countTokensParams, ...extra }),
        countTokensParams,
      ],
      [
        'beta.messages.countTokens',
        (client, extra) => client.beta.messages.countTokens({ ...countTokensParams, ...extra }),
        countTokensParams,
      ],
    ];

    test.each(sendCases)('%s sends the ID in the body instead of the header', async (_name, send, body) => {
      await send(newClient(), { user_profile_id: 'uprof_fake' });

      expect(getRequestBody()).toEqual({ ...body, user_profile_id: 'uprof_fake' });
      expect(getRequestHeaders().get('anthropic-user-profile-id')).toBeNull();
    });

    test.each(sendCases)('%s sends the body as it is without an ID', async (_name, send, body) => {
      await send(newClient(), {});

      expect(getRequestBody()).toEqual(body);
      expect(getRequestHeaders().get('anthropic-user-profile-id')).toBeNull();
    });

    test.each<[string, () => Promise<unknown>]>([
      [
        'request headers',
        () => newClient().messages.create(params, { headers: { 'anthropic-user-profile-id': 'uprof_fake' } }),
      ],
      [
        'client default headers',
        () =>
          new AnthropicBedrockMantle({
            apiKey: 'test-key',
            awsRegion: 'us-east-1',
            maxRetries: 0,
            defaultHeaders: { 'anthropic-user-profile-id': 'uprof_fake' },
          }).messages.create(params),
      ],
    ])('an ID set through %s is sent in the body instead of the header', async (_name, send) => {
      await send();

      expect(getRequestBody()).toEqual({ ...params, user_profile_id: 'uprof_fake' });
      expect(getRequestHeaders().get('anthropic-user-profile-id')).toBeNull();
    });

    test.each(['uprof_fake_one,uprof_fake_two', ''])('the value %j is sent as it is', async (value) => {
      await newClient().messages.create({ ...params, user_profile_id: value });

      expect(getRequestBody()).toEqual({ ...params, user_profile_id: value });
      expect(getRequestHeaders().get('anthropic-user-profile-id')).toBeNull();
    });

    test('the SigV4 signature covers the request with the ID in the body', async () => {
      const client = new AnthropicBedrockMantle({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsRegion: 'us-east-1',
        maxRetries: 0,
      });

      await client.messages.create({ ...params, user_profile_id: 'uprof_fake' });

      const signedRequest = mockGetAuthHeaders.mock.calls[0]![0] as { headers: Headers; body?: unknown };
      expect(JSON.parse(signedRequest.body as string)).toEqual({ ...params, user_profile_id: 'uprof_fake' });
      expect(signedRequest.headers.get('anthropic-user-profile-id')).toBeNull();
      expect(getRequestBody()).toEqual({ ...params, user_profile_id: 'uprof_fake' });
      expect(getRequestHeaders().get('anthropic-user-profile-id')).toBeNull();
    });

    test.each([
      '/v1/messages',
      '/v1/messages?beta=true',
      '/v1/messages/count_tokens',
      '/v1/messages/count_tokens?beta=true',
    ])('an ID already in the body of %s wins over the header', async (path) => {
      await newClient().post(path, {
        body: { ...params, user_profile_id: 'uprof_fake_from_body' },
        headers: { 'anthropic-user-profile-id': 'uprof_fake_from_header' },
      });

      expect(getRequestBody()).toMatchObject({ user_profile_id: 'uprof_fake_from_body' });
      expect(getRequestHeaders().get('anthropic-user-profile-id')).toBeNull();
    });

    test('a body that is not a JSON object is sent unchanged, with the header', async () => {
      await newClient().post('/v1/messages', {
        body: [params],
        headers: { 'anthropic-user-profile-id': 'uprof_fake' },
      });

      expect(getRequestBody()).toEqual([params]);
      expect(getRequestHeaders().get('anthropic-user-profile-id')).toBe('uprof_fake');
    });

    const batch = { requests: [{ custom_id: 'fake-request', params }] };

    test.each<[string, Send]>([
      ['messages.batches.create', (client, extra) => client.messages.batches.create({ ...batch, ...extra })],
      [
        'beta.messages.batches.create',
        (client, extra) => client.beta.messages.batches.create({ ...batch, ...extra }),
      ],
    ])('%s still sends the ID as a header', async (_name, send) => {
      await send(newClient(), { user_profile_id: 'uprof_fake' });

      expect(getRequestBody()).toEqual(batch);
      expect(getRequestHeaders().get('anthropic-user-profile-id')).toBe('uprof_fake');
    });
  });

  describe('endpoint restrictions', () => {
    test('models resource is not available', () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        baseURL: 'https://example.com',
      });

      expect((client as any).models).toBeUndefined();
    });

    test('files resource is not available', () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        baseURL: 'https://example.com',
      });

      expect((client as any).files).toBeUndefined();
    });

    test('userProfiles resource is not available', () => {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        baseURL: 'https://example.com',
      });

      expect((client as any).userProfiles).toBeUndefined();
      expect((client.beta as any).userProfiles).toBeUndefined();
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

  describe('ambient first-party credentials never reach Bedrock Mantle', () => {
    let configDir: string;

    beforeEach(() => {
      delete process.env['ANTHROPIC_API_KEY'];
      delete process.env['ANTHROPIC_AUTH_TOKEN'];
      configDir = fs.mkdtempSync(path.join(tmpdir(), 'bedrock-mantle-creds-test-'));
      fs.mkdirSync(path.join(configDir, 'configs'));
      fs.mkdirSync(path.join(configDir, 'credentials'));
      fs.writeFileSync(
        path.join(configDir, 'configs', 'default.json'),
        JSON.stringify({
          organization_id: 'org-123',
          workspace_id: 'wrkspc-123',
          authentication: { type: 'user_oauth' },
        }),
      );
      fs.writeFileSync(
        path.join(configDir, 'credentials', 'default.json'),
        JSON.stringify({ access_token: 'store-token', expires_at: Math.floor(Date.now() / 1000) + 3600 }),
        { mode: 0o600 },
      );
      process.env['ANTHROPIC_CONFIG_DIR'] = configDir;
    });

    afterEach(() => {
      fs.rmSync(configDir, { recursive: true });
    });

    test('a resolvable shared-config-store profile is never consulted in SigV4 mode', async () => {
      const client = new AnthropicBedrockMantle({
        awsAccessKey: 'my-access-key',
        awsSecretAccessKey: 'my-secret-key',
        awsRegion: 'us-east-1',
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(getRequestUrl()).not.toContain('/v1/oauth/token');
      const headers = getRequestHeaders();
      expect(headers.get('authorization')).toBe('AWS4-HMAC-SHA256 Credential=mock');
      expect(headers.get('x-api-key')).toBeNull();
      expect(headers.get('anthropic-workspace-id')).toBeNull();
      expect(headers.get('anthropic-organization-id')).toBeNull();
    });

    test('a resolvable shared-config-store profile is never consulted with skipAuth', async () => {
      const client = new AnthropicBedrockMantle({ awsRegion: 'us-east-1', skipAuth: true, maxRetries: 0 });

      await makeRequest(client);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const headers = getRequestHeaders();
      expect(headers.get('authorization')).toBeNull();
      expect(headers.get('x-api-key')).toBeNull();
      expect(headers.get('anthropic-workspace-id')).toBeNull();
      expect(headers.get('anthropic-organization-id')).toBeNull();
    });

    test('env ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN are not sent, including by withOptions clones', async () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-should-not-leak';
      process.env['ANTHROPIC_AUTH_TOKEN'] = 'oauth-should-not-leak';
      process.env['AWS_REGION'] = 'us-east-1';

      const client = new AnthropicBedrockMantle({ maxRetries: 0 });
      expect(client.apiKey).toBeNull();
      expect(client.authToken).toBeNull();

      for (const c of [client, client.withOptions({ timeout: 1234 })]) {
        await makeRequest(c);
      }

      for (const call of [0, 1]) {
        const headers = getRequestHeaders(call);
        expect(headers.get('authorization')).toBe('AWS4-HMAC-SHA256 Credential=mock');
        expect(headers.get('x-api-key')).toBeNull();
      }
      expect(mockGetAuthHeaders).toHaveBeenCalledTimes(2);
    });
  });

  test('user agent is a hardcoded string', async () => {
    const originalName = AnthropicBedrockMantle.name;
    // Rename the class, as a minifier would, to prove the header isn't derived from it.
    Object.defineProperty(AnthropicBedrockMantle, 'name', { value: 'MinifiedClient' });
    try {
      const client = new AnthropicBedrockMantle({
        apiKey: 'test-key',
        awsRegion: 'us-east-1',
      });
      expect(client.constructor.name).toBe('MinifiedClient');
      const { req } = await client.buildRequest({ path: '/foo', method: 'post' });
      expect(req.headers.get('user-agent')).toBe(`AnthropicBedrockMantle/JS ${VERSION}`);
    } finally {
      Object.defineProperty(AnthropicBedrockMantle, 'name', { value: originalName });
    }
  });
});
