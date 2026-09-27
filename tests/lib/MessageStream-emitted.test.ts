import Anthropic, { APIConnectionError } from '@anthropic-ai/sdk';
import { mockFetch } from './mock-fetch';
import { loadFixture, parseSSEFixture } from './sse-helpers';

describe.each(['standard', 'beta'] as const)('%s MessageStream.emitted', (mode) => {
  function createStream(fetch: ReturnType<typeof mockFetch>['fetch']) {
    const client = new Anthropic({ apiKey: 'test-key', fetch });
    const params = {
      max_tokens: 1024,
      model: 'claude-opus-4-8',
      messages: [{ role: 'user' as const, content: 'Say hello there!' }],
    };
    // Bind the specific events before combining the streams: their generic
    // emitted() methods have different event types and aren't callable as a union.
    if (mode === 'standard') {
      const stream = client.messages.stream(params, { maxRetries: 0 });
      return {
        text: () => stream.emitted('text'),
        streamEvent: () => stream.emitted('streamEvent'),
        connect: () => stream.emitted('connect'),
        message: () => stream.emitted('message'),
        error: () => stream.emitted('error'),
        done: () => stream.done(),
      };
    }
    const stream = client.beta.messages.stream(params, { maxRetries: 0 });
    return {
      text: () => stream.emitted('text'),
      streamEvent: () => stream.emitted('streamEvent'),
      connect: () => stream.emitted('connect'),
      message: () => stream.emitted('message'),
      error: () => stream.emitted('error'),
      done: () => stream.done(),
    };
  }

  it('returns both the text delta and accumulated text promised by its type', async () => {
    const { fetch, handleStreamEvents } = mockFetch();
    handleStreamEvents(await parseSSEFixture(loadFixture('basic_response.txt')));
    const stream = createStream(fetch);

    const first: [string, string] = await stream.text();
    expect(first).toEqual(['Hello', 'Hello']);
    const second: [string, string] = await stream.text();
    expect(second).toEqual([' there', 'Hello there']);
    await stream.done();
  });

  it('returns the stream event together with its message snapshot', async () => {
    const { fetch, handleStreamEvents } = mockFetch();
    handleStreamEvents(await parseSSEFixture(loadFixture('basic_response.txt')));
    const stream = createStream(fetch);

    const [event, snapshot] = await stream.streamEvent();
    expect(event.type).toBe('message_start');
    expect(snapshot.id).toBe('msg_4QpJur2dWWDjF6C758FbBw5vm12BaVipnK');
    await stream.done();
  });

  it('keeps zero-argument events void and single-argument events unwrapped', async () => {
    const { fetch, handleStreamEvents } = mockFetch();
    handleStreamEvents(await parseSSEFixture(loadFixture('basic_response.txt')));
    const stream = createStream(fetch);
    const connected = stream.connect();
    const message = stream.message();

    expect(await connected).toBeUndefined();
    expect(await message).toMatchObject({
      type: 'message',
      content: [{ type: 'text', text: 'Hello there!' }],
    });
    await stream.done();
  });

  it('rejects a pending event on error while resolving an error event unwrapped', async () => {
    const { fetch, handleRequest } = mockFetch();
    const stream = createStream(fetch);
    const text = stream.text();
    const error = stream.error();
    const rejected = expect(text).rejects.toBeInstanceOf(APIConnectionError);
    handleRequest(async () => {
      throw new Error('offline connection failure');
    });

    await rejected;
    expect(await error).toBeInstanceOf(APIConnectionError);
  });
});
