import Anthropic from '@anthropic-ai/sdk';
import { VERSION } from '@anthropic-ai/sdk/version';

describe('user agent', () => {
  test('is a hardcoded string', async () => {
    const originalName = Anthropic.name;
    // Rename the class, as a minifier would, to prove the header isn't derived from it.
    Object.defineProperty(Anthropic, 'name', { value: 'MinifiedClient' });
    try {
      const client = new Anthropic({ baseURL: 'http://localhost:5000/', apiKey: 'my-anthropic-api-key' });
      expect(client.constructor.name).toBe('MinifiedClient');
      const { req } = await client.buildRequest({ path: '/foo', method: 'post' });
      expect(req.headers.get('user-agent')).toBe(`Anthropic/JS ${VERSION}`);
    } finally {
      Object.defineProperty(Anthropic, 'name', { value: originalName });
    }
  });

  test('does not follow the subclass name', async () => {
    class MyClient extends Anthropic {}
    const client = new MyClient({ baseURL: 'http://localhost:5000/', apiKey: 'my-anthropic-api-key' });
    const { req } = await client.buildRequest({ path: '/foo', method: 'post' });
    expect(req.headers.get('user-agent')).toBe(`Anthropic/JS ${VERSION}`);
  });
});
