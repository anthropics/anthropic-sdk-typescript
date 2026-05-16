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

  describe('document URL source validation', () => {
    test('throws clear error when document block uses URL source', async () => {
      const client = new AnthropicVertex({
        region: 'us-central1',
        projectId: 'test-project',
        accessToken: 'fake-token',
      });

      await expect(
        client.messages.create({
          model: 'claude-sonnet-4-20250514',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: {
                    type: 'url',
                    url: 'https://example.com/document.pdf',
                  },
                },
              ],
            },
          ],
          max_tokens: 1024,
        }),
      ).rejects.toThrow(
        'Vertex AI does not support document blocks with URL sources',
      );
    });

    test('throws clear error when document URL source is nested inside tool_result', async () => {
      const client = new AnthropicVertex({
        region: 'us-central1',
        projectId: 'test-project',
        accessToken: 'fake-token',
      });

      await expect(
        client.messages.create({
          model: 'claude-sonnet-4-20250514',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'Hello' }],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: 'toolu_123',
                  name: 'read_doc',
                  input: { path: 'doc.pdf' },
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'toolu_123',
                  content: [
                    {
                      type: 'document',
                      source: {
                        type: 'url',
                        url: 'https://example.com/response.pdf',
                      },
                    },
                  ],
                },
              ],
            },
          ],
          max_tokens: 1024,
        }),
      ).rejects.toThrow(
        'Vertex AI does not support document blocks with URL sources',
      );
    });

    test('passes when document uses base64 source', async () => {
      const client = new AnthropicVertex({
        region: 'us-central1',
        projectId: 'test-project',
        accessToken: 'fake-token',
      });

      // This should not throw during buildRequest (it will fail on network, which is fine)
      // We just verify the URL source check doesn't reject it
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('fetch not implemented'));

      try {
        await expect(
          client.messages.create({
            model: 'claude-sonnet-4-20250514',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'document',
                    source: {
                      type: 'base64',
                      media_type: 'application/pdf',
                      data: 'JVBERi0xLjQKJcfsj6IKNSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCg==',
                    },
                  },
                ],
              },
            ],
            max_tokens: 1024,
          }),
        ).rejects.toThrow('fetch not implemented');
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('passes when document uses plain text source', async () => {
      const client = new AnthropicVertex({
        region: 'us-central1',
        projectId: 'test-project',
        accessToken: 'fake-token',
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('fetch not implemented'));

      try {
        await expect(
          client.messages.create({
            model: 'claude-sonnet-4-20250514',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'document',
                    source: {
                      type: 'text',
                      data: 'This is a plain text document.',
                    },
                  },
                ],
              },
            ],
            max_tokens: 1024,
          }),
        ).rejects.toThrow('fetch not implemented');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
