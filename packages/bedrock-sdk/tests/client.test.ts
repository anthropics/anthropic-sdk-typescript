import { getAuthHeaders } from '@anthropic-ai/bedrock-sdk/core/auth';
import AnthropicBedrock from '../src';

// Mock the client to allow for a more integration-style test
// We're mocking specific parts of the AnthropicBedrock client to avoid
// dependencies while still testing the integration behavior

// Mock specific parts of the client
jest.mock('../src/core/auth', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({}),
}));

// Create a mock fetch function
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
    const { AnthropicBedrock } = require('../src');

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
    const fetchUrl = mockFetch.mock.calls[0][0];

    // Expected URL with properly encoded ARN (slash encoded as %2F)
    const expectedUrl =
      'http://localhost:4010/model/arn:aws:bedrock:us-east-2:1234:inference-profile%2Fus.anthropic.claude-3-7-sonnet-20250219-v1:0/invoke';

    // Verify the exact URL matches what we expect
    expect(fetchUrl).toBe(expectedUrl);
  });

  test('properly constructs URL path for normal model names', async () => {
    // Import the client - do this inside the test to ensure mocks are set up first
    const { AnthropicBedrock } = require('../src');

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
    const fetchUrl = mockFetch.mock.calls[0][0];

    // Expected URL with properly encoded model name
    const expectedUrl = 'http://localhost:4010/model/anthropic.claude-3-5-sonnet-20241022-v2:0/invoke';

    // Verify the exact URL matches what we expect
    expect(fetchUrl).toBe(expectedUrl);
  });
});

describe('Bedrock bearer token authentication', () => {
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

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockClear();
    (getAuthHeaders as jest.Mock).mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('sends Authorization Bearer header when apiKey is provided', async () => {
    const { AnthropicBedrock } = require('../src');

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

    const [_url, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init.headers);

    expect(headers.get('Authorization')).toBe('Bearer test-bearer-token');
  });

  test('does not send Authorization header when no apiKey is provided', async () => {
    const { AnthropicBedrock } = require('../src');

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

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init.headers);

    expect(headers.get('Authorization')).toBeNull();
  });

  test('skips SigV4 signing when apiKey is provided', async () => {
    const authModule = require('../src/core/auth');
    const getAuthHeadersSpy = jest.spyOn(authModule, 'getAuthHeaders');

    const { AnthropicBedrock } = require('../src');

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

describe('middleware order (Bedrock adaptation runs inside user middleware)', () => {
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

  beforeEach(() => {
    mockFetch.mockClear();
    (getAuthHeaders as jest.Mock).mockClear();
  });

  const createParams = {
    model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    max_tokens: 1024,
    messages: [{ content: 'Hello', role: 'user' as const }],
  };

  test('middleware observes the canonical Anthropic request; the wire receives the Bedrock shape', async () => {
    const observed: { url?: string; body?: any } = {};
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
      skipAuth: true,
      fetch: mockFetch as any,
      middleware: [
        async (request, next) => {
          observed.url = request.url;
          observed.body = JSON.parse(request.body as string);
          return next(request);
        },
      ],
    });

    await client.messages.create(createParams);

    expect(observed.url).toBe('http://localhost:4010/v1/messages');
    expect(observed.body.model).toBe(createParams.model);
    expect(observed.body.anthropic_version).toBeUndefined();

    const [wireUrl, wireInit] = mockFetch.mock.calls[0];
    expect(wireUrl).toBe(`http://localhost:4010/model/${createParams.model}/invoke`);
    const wireBody = JSON.parse(wireInit.body);
    expect(wireBody.model).toBeUndefined();
    expect(wireBody.anthropic_version).toBe('bedrock-2023-05-31');
  });

  test('preserves base URL path prefixes when rewriting', async () => {
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010/prefix',
      skipAuth: true,
      fetch: mockFetch as any,
    });

    await client.messages.create(createParams);

    const [wireUrl] = mockFetch.mock.calls[0];
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
    const [signedRequest, signedProps] = (getAuthHeaders as jest.Mock).mock.calls[0];
    const signedBody = JSON.parse(signedRequest.body);
    expect(signedBody.metadata).toEqual({ user_id: 'user-123' });
    expect(signedBody.model).toBeUndefined();
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

    const [, wireInit] = mockFetch.mock.calls[0];
    const wireBody = JSON.parse(wireInit.body);
    expect(wireBody.anthropic_beta).toEqual(['beta-1', 'beta-2']);
  });
});

describe('AnthropicBedrock constructor deprecation warnings', () => {
  // Inject a fresh logger per test instead of spying on console.warn:
  // loggerFor() caches bound log functions per logger object, so a
  // console spy installed after the cache is populated is bypassed.
  const makeLogger = () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
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
