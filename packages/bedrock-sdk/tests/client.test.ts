import type { Mock } from 'vitest';
import { getAuthHeaders } from '@anthropic-ai/bedrock-sdk/core/auth';
import { VERSION } from '@anthropic-ai/sdk/version';
import { copyClientForHelper } from '@anthropic-ai/sdk/lib/helper-client';
import AnthropicBedrock from '../src';
import * as fs from 'fs';
import { mkdtempSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

// Mock the client to allow for a more integration-style test
// We're mocking specific parts of the AnthropicBedrock client to avoid
// dependencies while still testing the integration behavior

// Mock specific parts of the client
vi.mock('../src/core/auth', () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({}),
}));

// Create a mock fetch function
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

// Store original fetch function
const originalFetch = global.fetch;

describe('Bedrock model ARN URL encoding integration test', () => {
  beforeEach(() => {
    // Replace global fetch with our mock
    global.fetch = mockFetch;
    // Clear mock history
    mockFetch.mockClear();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  test('properly encodes model ARNs with slashes in URL path', async () => {
    // Import the client - do this inside the test to ensure mocks are set up first
    const { AnthropicBedrock } = await import('../src');

    // Create client instance
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });

    // Model ARN with slashes that needs encoding
    const modelArn =
      'arn:aws:bedrock:us-east-2:1234:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0';

    // Make a request to trigger the URL construction with the ARN
    try {
      await client.messages.create({
        model: modelArn,
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });
    } catch (e) {
      // We expect errors due to mocking - we're just interested in the URL construction
    }

    // Verify that fetch was called
    expect(mockFetch).toHaveBeenCalled();

    // Get the URL that was passed to fetch
    const fetchUrl = mockFetch.mock.calls[0]![0];

    // Expected URL with properly encoded ARN (slash encoded as %2F)
    const expectedUrl =
      'http://localhost:4010/model/arn:aws:bedrock:us-east-2:1234:inference-profile%2Fus.anthropic.claude-3-7-sonnet-20250219-v1:0/invoke';

    // Verify the exact URL matches what we expect
    expect(fetchUrl).toBe(expectedUrl);
  });

  test('properly constructs URL path for normal model names', async () => {
    // Import the client - do this inside the test to ensure mocks are set up first
    const { AnthropicBedrock } = await import('../src');

    // Create client instance
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });

    // Regular model name (still contains characters that need encoding)
    const modelName = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

    // Make a request to trigger the URL construction
    try {
      await client.messages.create({
        model: modelName,
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });
    } catch (e) {
      // We expect errors due to mocking - we're just interested in the URL construction
    }

    // Verify that fetch was called
    expect(mockFetch).toHaveBeenCalled();

    // Get the URL that was passed to fetch
    const fetchUrl = mockFetch.mock.calls[0]![0];

    // Expected URL with properly encoded model name
    const expectedUrl = 'http://localhost:4010/model/anthropic.claude-3-5-sonnet-20241022-v2:0/invoke';

    // Verify the exact URL matches what we expect
    expect(fetchUrl).toBe(expectedUrl);
  });
});

describe('Bedrock bearer token authentication', () => {
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

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockClear();
    (getAuthHeaders as Mock).mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('sends Authorization Bearer header when apiKey is provided', async () => {
    const { AnthropicBedrock } = await import('../src');

    const client = new AnthropicBedrock({
      apiKey: 'test-bearer-token',
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });

    try {
      await client.messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Hello', role: 'user' }],
      });
    } catch (e) {
      // may error due to mocking, we only care about the request
    }

    expect(mockFetch).toHaveBeenCalled();

    const [_url, init] = mockFetch.mock.calls[0]!;
    const headers = new Headers(init.headers);

    expect(headers.get('Authorization')).toBe('Bearer test-bearer-token');
  });

  test('withOptions keeps the apiKey, and an apiKey override replaces it', async () => {
    const { AnthropicBedrock } = await import('../src');

    const client = new AnthropicBedrock({
      apiKey: 'test-bearer-token',
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });

    for (const clone of [
      client.withOptions({ timeout: 1234 }),
      client.withOptions({ apiKey: 'new-token' }),
    ]) {
      try {
        await clone.messages.create({
          model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          max_tokens: 1024,
          messages: [{ content: 'Hello', role: 'user' }],
        });
      } catch (e) {
        // may error due to mocking, we only care about the request
      }
    }

    const sent = mockFetch.mock.calls.map(([, init]) => new Headers(init.headers).get('Authorization'));
    expect(sent).toEqual(['Bearer test-bearer-token', 'Bearer new-token']);
  });

  test('a copy signs with the region, AWS keys and resolver of its parent', async () => {
    vi.stubEnv('AWS_REGION', 'us-east-1');
    const providerChainResolver = vi.fn();

    try {
      const client = new AnthropicBedrock({
        awsRegion: 'eu-west-1',
        awsAccessKey: 'my-access-key',
        awsSecretKey: 'my-secret-key',
        awsSessionToken: 'my-session-token',
        providerChainResolver,
      });
      await client.withOptions({ timeout: 1234 }).messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Hello', role: 'user' }],
      });
    } finally {
      vi.unstubAllEnvs();
    }

    expect(getAuthHeaders).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        regionName: 'eu-west-1',
        awsAccessKey: 'my-access-key',
        awsSecretKey: 'my-secret-key',
        awsSessionToken: 'my-session-token',
        providerChainResolver,
      }),
    );
  });

  const otherResolver = vi.fn();

  test.each<[string, object]>([
    ['keys', { awsAccessKey: 'other-access-key', awsSecretKey: 'other-secret-key' }],
    ['a resolver', { providerChainResolver: otherResolver }],
  ])('a copy given %s uses none of the AWS credentials of its parent', async (_what, extra) => {
    const client = new AnthropicBedrock({
      awsRegion: 'eu-west-1',
      awsAccessKey: 'my-access-key',
      awsSecretKey: 'my-secret-key',
      awsSessionToken: 'my-session-token',
      providerChainResolver: vi.fn(),
    });

    await client.withOptions(extra).messages.create({
      model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      max_tokens: 1024,
      messages: [{ content: 'Hello', role: 'user' }],
    });

    expect(getAuthHeaders).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        regionName: 'eu-west-1',
        awsAccessKey: null,
        awsSecretKey: null,
        awsSessionToken: null,
        providerChainResolver: null,
        ...extra,
      }),
    );
  });

  describe.each<[string, (extra: object) => AnthropicBedrock]>([
    ['the constructor', (extra) => new AnthropicBedrock({ apiKey: 'test-bearer-token', ...extra })],
    ['withOptions', (extra) => new AnthropicBedrock({ apiKey: 'test-bearer-token' }).withOptions(extra)],
  ])('%s', (_where, build) => {
    test.each<[string, object]>([
      ['authToken', { authToken: 'first-party-token' }],
      ['credentials', { credentials: async () => ({ token: 'first-party-token', expiresAt: null }) }],
      ['config', { config: { authentication: { type: 'user_oauth' } } }],
      ['profile', { profile: 'my-profile' }],
    ])('rejects `%s`', (name, extra) => {
      expect(() => build(extra)).toThrow(
        `The \`${name}\` option is not supported by AnthropicBedrock; ` +
          'authentication uses a Bedrock API key (`apiKey`) or AWS credentials (SigV4).',
      );
    });
  });

  test('a copy that clears the apiKey signs, and reads no key from the parent or AWS_BEARER_TOKEN_BEDROCK', async () => {
    vi.stubEnv('AWS_BEARER_TOKEN_BEDROCK', 'env-bearer-token');

    try {
      const client = new AnthropicBedrock({ apiKey: 'test-bearer-token', awsRegion: 'us-east-1' });
      await client.withOptions({ apiKey: null }).messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Hello', role: 'user' }],
      });
    } finally {
      vi.unstubAllEnvs();
    }

    const [, init] = mockFetch.mock.calls[0]!;
    expect(new Headers(init.headers).get('Authorization')).toBeNull();
    expect(getAuthHeaders).toHaveBeenCalledTimes(1);
  });

  test('a helper sub-client is refused rather than sent out with the environment key', () => {
    const client = new AnthropicBedrock({ apiKey: 'test-bearer-token' });

    expect(() =>
      // @ts-expect-error the helpers take an `Anthropic` client
      copyClientForHelper(client, { authToken: 'environment-key', helper: 'environments-work-poller' }),
    ).toThrow('The `authToken` option is not supported by AnthropicBedrock');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('does not send Authorization header when no apiKey is provided', async () => {
    const { AnthropicBedrock } = await import('../src');

    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });

    try {
      await client.messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Hello', role: 'user' }],
      });
    } catch (e) {
      // may error due to mocking
    }

    expect(mockFetch).toHaveBeenCalled();

    const [, init] = mockFetch.mock.calls[0]!;
    const headers = new Headers(init.headers);

    expect(headers.get('Authorization')).toBeNull();
  });

  test('skips SigV4 signing when apiKey is provided', async () => {
    const authModule = await import('../src/core/auth');
    const getAuthHeadersSpy = vi.spyOn(authModule, 'getAuthHeaders');

    const { AnthropicBedrock } = await import('../src');

    const client = new AnthropicBedrock({
      apiKey: 'test-bearer-token',
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });

    try {
      await client.messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Hello', role: 'user' }],
      });
    } catch (e) {
      // may error due to mocking
    }

    expect(getAuthHeadersSpy).not.toHaveBeenCalled();
    getAuthHeadersSpy.mockRestore();
  });
});

describe('ambient first-party credentials never reach Bedrock', () => {
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
  const envVars = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_CONFIG_DIR'];
  const originalEnv: Record<string, string | undefined> = {};
  let testDir: string;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockClear();
    (getAuthHeaders as Mock).mockClear();
    for (const name of envVars) {
      originalEnv[name] = process.env[name];
      delete process.env[name];
    }
    testDir = mkdtempSync(path.join(tmpdir(), 'bedrock-creds-test-'));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
    fs.rmSync(testDir, { recursive: true });
  });

  const createParams = {
    model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    max_tokens: 1024,
    messages: [{ content: 'Hello', role: 'user' as const }],
  };

  test('env ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN are not sent and do not suppress SigV4', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'env-anthropic-key';
    process.env['ANTHROPIC_AUTH_TOKEN'] = 'env-oauth-token';

    const { AnthropicBedrock } = await import('../src');
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });
    expect(client.apiKey).toBeNull();
    expect(client.authToken).toBeNull();

    try {
      await client.messages.create(createParams);
    } catch (e) {
      // may error due to mocking, we only care about the request
    }

    // SigV4 still signs the request — the ambient bearer token must not
    // flip the client out of SigV4 mode.
    expect(getAuthHeaders).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0]!;
    const headers = new Headers(init.headers);
    expect(headers.get('x-api-key')).toBeNull();
    expect(headers.get('authorization')).toBeNull();
  });

  test('a resolvable shared-config-store profile is never consulted', async () => {
    process.env['ANTHROPIC_CONFIG_DIR'] = testDir;
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

    const { AnthropicBedrock } = await import('../src');
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });

    try {
      await client.messages.create(createParams);
    } catch (e) {
      // may error due to mocking
    }

    // Exactly the one Bedrock request — no token-exchange call — and no
    // store-derived auth or org header on the wire.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).not.toContain('/v1/oauth/token');
    const headers = new Headers(init.headers);
    expect(headers.get('x-api-key')).toBeNull();
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('anthropic-organization-id')).toBeNull();
  });
});

describe('middleware order (Bedrock adaptation runs inside user middleware)', () => {
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

  beforeEach(() => {
    mockFetch.mockClear();
    (getAuthHeaders as Mock).mockClear();
  });

  const createParams = {
    model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    max_tokens: 1024,
    messages: [{ content: 'Hello', role: 'user' as const }],
  };

  test('middleware observes the canonical Anthropic request; the wire receives the Bedrock shape', async () => {
    const observed: { url?: string; body?: any; version?: string | null } = {};
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
      skipAuth: true,
      fetch: mockFetch as any,
      middleware: [
        async (request, next) => {
          observed.url = request.url;
          observed.body = JSON.parse(request.body as string);
          observed.version = request.headers.get('anthropic-version');
          return next(request);
        },
      ],
    });

    await client.messages.create(createParams);

    expect(observed.url).toBe('http://localhost:4010/v1/messages');
    expect(observed.body.model).toBe(createParams.model);
    expect(observed.body.anthropic_version).toBeUndefined();

    const [wireUrl, wireInit] = mockFetch.mock.calls[0]!;
    expect(wireUrl).toBe(`http://localhost:4010/model/${createParams.model}/invoke`);
    expect(new Headers(wireInit.headers).has('anthropic-version')).toBe(false);
    const wireBody = JSON.parse(wireInit.body);
    expect(wireBody.model).toBeUndefined();
    expect(wireBody.anthropic_version).toBe(observed.version);
  });

  test.each([
    { name: 'a header the caller set', headers: { 'anthropic-version': '2030-01-01' }, sent: '2030-01-01' },
    { name: 'a header the caller removed', headers: { 'anthropic-version': null }, sent: undefined },
    { name: 'a body value the caller set', body: { anthropic_version: '2030-01-02' }, sent: '2030-01-02' },
  ])('$name sends $sent in the body', async ({ headers, body, sent }) => {
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
      skipAuth: true,
      fetch: mockFetch as any,
      defaultHeaders: headers,
    });

    await client.messages.create({ ...createParams, ...body });

    const [, wireInit] = mockFetch.mock.calls[0]!;
    expect(new Headers(wireInit.headers).has('anthropic-version')).toBe(false);
    expect(JSON.parse(wireInit.body).anthropic_version).toBe(sent);
  });

  test('preserves base URL path prefixes when rewriting', async () => {
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010/prefix',
      skipAuth: true,
      fetch: mockFetch as any,
    });

    await client.messages.create(createParams);

    const [wireUrl] = mockFetch.mock.calls[0]!;
    expect(wireUrl).toBe(`http://localhost:4010/prefix/model/${createParams.model}/invoke`);
  });

  test('SigV4 signing covers the middleware-mutated request', async () => {
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
      awsAccessKey: 'access-key',
      awsSecretKey: 'secret-key',
      fetch: mockFetch as any,
      middleware: [
        async (request, next) => {
          const body = JSON.parse(request.body as string);
          body.metadata = { user_id: 'user-123' };
          return next({ ...request, body: JSON.stringify(body) });
        },
      ],
    });

    await client.messages.create(createParams);

    expect(getAuthHeaders).toHaveBeenCalledTimes(1);
    const [signedRequest, signedProps] = (getAuthHeaders as Mock).mock.calls[0]!;
    const signedBody = JSON.parse(signedRequest.body);
    expect(signedBody.metadata).toEqual({ user_id: 'user-123' });
    expect(signedBody.model).toBeUndefined();
    expect(signedRequest.headers.has('anthropic-version')).toBe(false);
    expect(signedProps.url).toBe(`http://localhost:4010/model/${createParams.model}/invoke`);
  });

  test('anthropic-beta headers set by middleware move into the body', async () => {
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
      skipAuth: true,
      fetch: mockFetch as any,
      middleware: [
        async (request, next) => {
          request.headers.set('anthropic-beta', 'beta-1,beta-2');
          return next(request);
        },
      ],
    });

    await client.messages.create(createParams);

    const [, wireInit] = mockFetch.mock.calls[0]!;
    const wireBody = JSON.parse(wireInit.body);
    expect(wireBody.anthropic_beta).toEqual(['beta-1', 'beta-2']);
  });
});

describe('AnthropicBedrock constructor deprecation warnings', () => {
  // Inject a fresh logger per test instead of spying on console.warn:
  // loggerFor() caches bound log functions per logger object, so a
  // console spy installed after the cache is populated is bypassed.
  const makeLogger = () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  });

  test('does not warn when both credentials are provided', () => {
    const logger = makeLogger();
    new AnthropicBedrock({
      awsAccessKey: 'access-key',
      awsSecretKey: 'secret-key',
      awsRegion: 'us-east-1',
      logger,
    });

    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('does not warn when neither credential is provided', () => {
    const logger = makeLogger();
    new AnthropicBedrock({
      awsRegion: 'us-east-1',
      logger,
    });

    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('warns when only one credential is provided', () => {
    const logger = makeLogger();
    new AnthropicBedrock({
      awsAccessKey: 'access-key',
      awsRegion: 'us-east-1',
      logger,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Passing only one of `awsAccessKey` or `awsSecretKey` is deprecated'),
    );
  });
});

describe('AnthropicBedrock user profiles', () => {
  const unavailable = 'User profiles are not available on `AnthropicBedrock`';
  const newClient = () =>
    new AnthropicBedrock({ awsAccessKey: 'access-key', awsSecretKey: 'secret-key', awsRegion: 'us-east-1' });

  test('userProfiles throws an explanatory error', () => {
    expect(() => newClient().userProfiles).toThrow(unavailable);
  });

  test('beta.userProfiles throws an explanatory error', () => {
    expect(() => (newClient().beta as any).userProfiles).toThrow(unavailable);
  });

  test('a clone from withOptions has no user profiles either', () => {
    const clone = newClient().withOptions({ maxRetries: 0 });

    expect(() => clone.userProfiles).toThrow(unavailable);
    expect(() => (clone.beta as any).userProfiles).toThrow(unavailable);
  });
});

describe('AnthropicBedrock user agent', () => {
  test('is a hardcoded string', async () => {
    const originalName = AnthropicBedrock.name;
    // Rename the class, as a minifier would, to prove the header isn't derived from it.
    Object.defineProperty(AnthropicBedrock, 'name', { value: 'MinifiedClient' });
    try {
      const client = new AnthropicBedrock({
        awsAccessKey: 'access-key',
        awsSecretKey: 'secret-key',
        awsRegion: 'us-east-1',
      });
      expect(client.constructor.name).toBe('MinifiedClient');
      const { req } = await client.buildRequest({ path: '/foo', method: 'post' });
      expect(req.headers.get('user-agent')).toBe(`AnthropicBedrock/JS ${VERSION}`);
    } finally {
      Object.defineProperty(AnthropicBedrock, 'name', { value: originalName });
    }
  });
});
