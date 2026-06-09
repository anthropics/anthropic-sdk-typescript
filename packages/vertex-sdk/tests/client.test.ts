// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { AnthropicVertex } from '../src/client';

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

const makeClient = (overrides: Partial<ConstructorParameters<typeof AnthropicVertex>[0]> = {}) =>
  new AnthropicVertex({
    region: 'us-central1',
    projectId: 'test-project',
    accessToken: 'fake-token',
    ...overrides,
  });

describe('AnthropicVertex', () => {
  describe('count_tokens strips anthropic-beta header', () => {
    test('strips anthropic-beta from /v1/messages/count_tokens', async () => {
      const client = makeClient();
      const { req } = await client.buildRequest({
        method: 'post',
        path: '/v1/messages/count_tokens',
        headers: { 'anthropic-beta': 'effort-2025-11-24' },
        body: { model: 'claude-haiku-4-5', messages: [], max_tokens: 10 },
      });
      expect((req.headers as Headers).get('anthropic-beta')).toBeNull();
    });

    test('strips anthropic-beta from /v1/messages/count_tokens?beta=true', async () => {
      const client = makeClient();
      const { req } = await client.buildRequest({
        method: 'post',
        path: '/v1/messages/count_tokens?beta=true',
        headers: { 'anthropic-beta': 'effort-2025-11-24' },
        body: { model: 'claude-haiku-4-5', messages: [], max_tokens: 10 },
      });
      expect((req.headers as Headers).get('anthropic-beta')).toBeNull();
    });

    test('does NOT strip anthropic-beta from regular /v1/messages requests', async () => {
      const client = makeClient();
      const { req } = await client.buildRequest({
        method: 'post',
        path: '/v1/messages',
        headers: { 'anthropic-beta': 'some-feature' },
        body: { model: 'claude-haiku-4-5', messages: [], max_tokens: 10, stream: false },
      });
      expect((req.headers as Headers).get('anthropic-beta')).toBe('some-feature');
    });
  });

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
});
