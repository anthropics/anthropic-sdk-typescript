// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { VERSION } from '@anthropic-ai/sdk/version';
import { AnthropicVertex } from '../src/client';
import { APIConnectionError } from '../src/core/error';
import * as fs from 'fs';
import { mkdtempSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

// Mock GoogleAuth to prevent credential loading during tests
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({
      projectId: 'test-project',
      getRequestHeaders: jest.fn().mockResolvedValue({
        authorization: 'Bearer fake-token',
      }),
    }),
  })),
}));

describe('AnthropicVertex', () => {
  describe('baseURL configuration', () => {
    test('global region uses correct base URL', () => {
      const client = new AnthropicVertex({
        region: 'global',
        projectId: 'test-project',
        accessToken: 'fake-token',
      });
      expect(client.baseURL).toBe('https://aiplatform.googleapis.com/v1');
    });

    test('us region uses correct base URL', () => {
      const client = new AnthropicVertex({
        region: 'us',
        projectId: 'test-project',
        accessToken: 'fake-token',
      });
      expect(client.baseURL).toBe('https://aiplatform.us.rep.googleapis.com/v1');
    });

    test('eu region eues correct base URL', () => {
      const client = new AnthropicVertex({
        region: 'eu',
        projectId: 'test-project',
        accessToken: 'fake-token',
      });
      expect(client.baseURL).toBe('https://aiplatform.eu.rep.googleapis.com/v1');
    });

    test.each(['us-central1', 'europe-west1', 'asia-southeast1'])(
      'regional endpoint %s uses correct base URL format',
      (region) => {
        const client = new AnthropicVertex({
          region,
          projectId: 'test-project',
          accessToken: 'fake-token',
        });
        const expectedUrl = `https://${region}-aiplatform.googleapis.com/v1`;
        expect(client.baseURL).toBe(expectedUrl);
      },
    );

    test('explicit baseURL option takes precedence over region', () => {
      const customUrl = 'https://test.googleapis.com/v1';

      const client = new AnthropicVertex({
        region: 'global', // this should get ignored since we're providing an explicit baseURL
        projectId: 'test-project',
        accessToken: 'fake-token',
        baseURL: customUrl,
      });
      expect(client.baseURL).toBe(customUrl);
    });

    test('throws error when region is not provided', () => {
      const originalEnv = process.env['CLOUD_ML_REGION'];
      delete process.env['CLOUD_ML_REGION'];

      try {
        expect(() => {
          new AnthropicVertex({
            projectId: 'test-project',
            accessToken: 'fake-token',
          });
        }).toThrow(
          'No region was given. The client should be instantiated with the `region` option or the `CLOUD_ML_REGION` environment variable should be set.',
        );
      } finally {
        if (originalEnv !== undefined) {
          process.env['CLOUD_ML_REGION'] = originalEnv;
        }
      }
    });
  });

  describe('middleware order (Vertex adaptation runs inside user middleware)', () => {
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
    });

    const createParams = {
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ content: 'Hello', role: 'user' as const }],
    };

    test('middleware observes the canonical request without Google credentials; the wire receives the Vertex shape', async () => {
      const observed: { url?: string; body?: any; authorization?: string | null } = {};
      const client = new AnthropicVertex({
        region: 'us-east5',
        projectId: 'test-project',
        fetch: mockFetch as any,
        middleware: [
          async (request, next) => {
            observed.url = request.url;
            observed.body = JSON.parse(request.body as string);
            observed.authorization = request.headers.get('authorization');
            return next(request);
          },
        ],
      });

      await client.messages.create(createParams);

      expect(observed.url).toBe('https://us-east5-aiplatform.googleapis.com/v1/v1/messages');
      expect(observed.body.model).toBe(createParams.model);
      expect(observed.body.anthropic_version).toBeUndefined();
      expect(observed.authorization).toBeNull();

      const [wireUrl, wireInit] = mockFetch.mock.calls[0];
      expect(wireUrl).toBe(
        `https://us-east5-aiplatform.googleapis.com/v1/projects/test-project/locations/us-east5/publishers/anthropic/models/${createParams.model}:rawPredict`,
      );
      const wireHeaders = new Headers(wireInit.headers);
      expect(wireHeaders.get('authorization')).toBe('Bearer fake-token');
      const wireBody = JSON.parse(wireInit.body);
      expect(wireBody.model).toBeUndefined();
      expect(wireBody.anthropic_version).toBe('vertex-2023-10-16');
    });

    test('an Authorization header set by middleware wins over the Google credentials', async () => {
      const client = new AnthropicVertex({
        region: 'us-east5',
        projectId: 'test-project',
        fetch: mockFetch as any,
        middleware: [
          async (request, next) => {
            request.headers.set('authorization', 'Bearer middleware-token');
            return next(request);
          },
        ],
      });

      await client.messages.create(createParams);

      const [, wireInit] = mockFetch.mock.calls[0];
      expect(new Headers(wireInit.headers).get('authorization')).toBe('Bearer middleware-token');
    });

    test('the stream flag stays in the body and selects the streamRawPredict endpoint', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve(
          new Response('event: message_stop\ndata: {"type":"message_stop"}\n\n', {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          }),
        ),
      );
      const client = new AnthropicVertex({
        region: 'us-east5',
        projectId: 'test-project',
        fetch: mockFetch as any,
      });

      await client.messages.create({ ...createParams, stream: true });

      const [wireUrl, wireInit] = mockFetch.mock.calls[0];
      expect(wireUrl).toBe(
        `https://us-east5-aiplatform.googleapis.com/v1/projects/test-project/locations/us-east5/publishers/anthropic/models/${createParams.model}:streamRawPredict`,
      );
      expect(JSON.parse(wireInit.body).stream).toBe(true);
    });

    test('rewrites count_tokens requests to the count-tokens endpoint', async () => {
      const client = new AnthropicVertex({
        region: 'us-east5',
        projectId: 'test-project',
        fetch: mockFetch as any,
      });

      await client.messages.countTokens({
        model: createParams.model,
        messages: createParams.messages,
      });

      const [wireUrl] = mockFetch.mock.calls[0];
      expect(wireUrl).toBe(
        'https://us-east5-aiplatform.googleapis.com/v1/projects/test-project/locations/us-east5/publishers/anthropic/models/count-tokens:rawPredict',
      );
    });
  });

  describe('ambient first-party credentials never reach Vertex', () => {
    const mockFetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('{}'),
      }),
    );

    const envVars = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_CONFIG_DIR'];
    const originalEnv: Record<string, string | undefined> = {};
    let testDir: string;

    beforeEach(() => {
      mockFetch.mockClear();
      for (const name of envVars) {
        originalEnv[name] = process.env[name];
        delete process.env[name];
      }
      testDir = mkdtempSync(path.join(tmpdir(), 'vertex-creds-test-'));
    });

    afterEach(() => {
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
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ content: 'Hello', role: 'user' as const }],
    };

    test('env ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN are not sent to the Google endpoint', async () => {
      process.env['ANTHROPIC_API_KEY'] = 'env-anthropic-key';
      process.env['ANTHROPIC_AUTH_TOKEN'] = 'env-oauth-token';

      const client = new AnthropicVertex({
        region: 'us-east5',
        projectId: 'test-project',
        fetch: mockFetch as any,
      });
      expect(client.apiKey).toBeNull();
      expect(client.authToken).toBeNull();

      await client.messages.create(createParams);

      const [, wireInit] = mockFetch.mock.calls[0];
      const wireHeaders = new Headers(wireInit.headers);
      expect(wireHeaders.get('x-api-key')).toBeNull();
      expect(wireHeaders.get('authorization')).toBe('Bearer fake-token');
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

      const client = new AnthropicVertex({
        region: 'us-east5',
        projectId: 'test-project',
        fetch: mockFetch as any,
      });

      await client.messages.create(createParams);

      // Exactly the one Vertex request — no token-exchange call — and only
      // the Google credential on the wire.
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [wireUrl, wireInit] = mockFetch.mock.calls[0];
      expect(wireUrl).not.toContain('/v1/oauth/token');
      const wireHeaders = new Headers(wireInit.headers);
      expect(wireHeaders.get('x-api-key')).toBeNull();
      expect(wireHeaders.get('authorization')).toBe('Bearer fake-token');
      expect(wireHeaders.get('anthropic-organization-id')).toBeNull();
    });
  });

  test('user agent is a hardcoded string', async () => {
    const originalName = AnthropicVertex.name;
    // Rename the class, as a minifier would, to prove the header isn't derived from it.
    Object.defineProperty(AnthropicVertex, 'name', { value: 'MinifiedClient' });
    try {
      const client = new AnthropicVertex({
        region: 'us-east5',
        projectId: 'test-project',
        accessToken: 'fake-token',
      });
      expect(client.constructor.name).toBe('MinifiedClient');
      const { req } = await client.buildRequest({ path: '/foo', method: 'post' });
      expect(req.headers.get('user-agent')).toBe(`AnthropicVertex/JS ${VERSION}`);
    } finally {
      Object.defineProperty(AnthropicVertex, 'name', { value: originalName });
    }
  });
});

describe('credential resolution retries', () => {
  const mockFetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('{}'),
    }),
  );

  beforeEach(() => {
    mockFetch.mockClear();
  });

  const createParams = {
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [{ content: 'Hello', role: 'user' as const }],
  };

  const transientFailure = new Error('metadata server unavailable');

  const makeClient = (getRequestHeaders: jest.Mock, maxRetries: number) =>
    new AnthropicVertex({
      region: 'us-central1',
      projectId: 'test-project',
      authClient: { projectId: 'test-project', getRequestHeaders } as any,
      fetch: mockFetch as any,
      maxRetries,
    });

  test('a transient OAuth token failure is retried', async () => {
    const getRequestHeaders = jest
      .fn()
      .mockRejectedValueOnce(transientFailure)
      .mockResolvedValue({ authorization: 'Bearer fake-token' });

    await makeClient(getRequestHeaders, 2).messages.create(createParams);

    expect(getRequestHeaders).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('persistent OAuth failures surface as APIConnectionError once retries are exhausted', async () => {
    const getRequestHeaders = jest.fn().mockRejectedValue(transientFailure);

    await expect(makeClient(getRequestHeaders, 1).messages.create(createParams)).rejects.toThrow(
      APIConnectionError,
    );

    expect(getRequestHeaders).toHaveBeenCalledTimes(2);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
