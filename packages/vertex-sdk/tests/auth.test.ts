import { GoogleAuth } from 'google-auth-library';
import { AnthropicVertex } from '../src/client';

const createParams = {
  model: 'claude-opus-4-8',
  max_tokens: 1024,
  messages: [{ content: 'Hello', role: 'user' as const }],
};

describe('default Google credential discovery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not emit unhandledRejection when ADC discovery fails; the error surfaces on the first request', async () => {
    jest
      .spyOn(GoogleAuth.prototype, 'getClient')
      .mockRejectedValue(new Error('Could not load the default credentials'));
    const mockFetch = jest.fn();

    const handler = jest.fn();
    process.on('unhandledRejection', handler);
    try {
      const client = new AnthropicVertex({
        region: 'us-central1',
        projectId: 'test-project',
        fetch: mockFetch as any,
        maxRetries: 0,
      });
      // Let the rejected credential promise settle with nothing awaiting it.
      await new Promise((r) => setImmediate(r));
      expect(handler).not.toHaveBeenCalled();

      await expect(client.messages.create(createParams)).rejects.toThrow(
        'Failed to acquire Google OAuth credentials.',
      );
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', handler);
    }
  });
});
