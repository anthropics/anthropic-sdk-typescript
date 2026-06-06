// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { AnthropicVertex } from '../src/client';
import { AnthropicError } from '../src/core/error';

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

    test('throws AnthropicError when a document block uses a URL source', async () => {
      const client = new AnthropicVertex({
        region: 'us-central1',
        projectId: 'test-project',
        accessToken: 'fake-token',
      });
      await expect(
        (client as any).buildRequest({
          method: 'post',
          path: '/v1/messages',
          body: {
            model: 'claude-opus-4-5',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'document',
                    source: { type: 'url', url: 'https://example.com/doc.pdf' },
                  },
                ],
              },
            ],
          },
        }),
      ).rejects.toThrow(AnthropicError);
      await expect(
        (client as any).buildRequest({
          method: 'post',
          path: '/v1/messages',
          body: {
            model: 'claude-opus-4-5',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'document',
                    source: { type: 'url', url: 'https://example.com/doc.pdf' },
                  },
                ],
              },
            ],
          },
        }),
      ).rejects.toThrow(/does not support URL sources/);
    });

    test('throws AnthropicError when a document URL source is nested inside a tool_result', async () => {
      const client = new AnthropicVertex({
        region: 'us-central1',
        projectId: 'test-project',
        accessToken: 'fake-token',
      });
      await expect(
        (client as any).buildRequest({
          method: 'post',
          path: '/v1/messages',
          body: {
            model: 'claude-opus-4-5',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: 'tool_abc',
                    content: [
                      {
                        type: 'document',
                        source: { type: 'url', url: 'https://example.com/doc.pdf' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      ).rejects.toThrow(AnthropicError);
    });

    test('does not throw for document blocks with base64 or text sources', async () => {
      const client = new AnthropicVertex({
        region: 'us-central1',
        projectId: 'test-project',
        accessToken: 'fake-token',
      });
      const base64Request = (client as any).buildRequest({
        method: 'post',
        path: '/v1/messages',
        body: {
          model: 'claude-opus-4-5',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: 'AAAA' },
                },
              ],
            },
          ],
        },
      });
      const textRequest = (client as any).buildRequest({
        method: 'post',
        path: '/v1/messages',
        body: {
          model: 'claude-opus-4-5',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [{ type: 'document', source: { type: 'text', data: 'hello world' } }],
            },
          ],
        },
      });
      await expect(base64Request).resolves.toBeDefined();
      await expect(textRequest).resolves.toBeDefined();
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
