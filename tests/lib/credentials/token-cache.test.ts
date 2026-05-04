import { TokenCache } from '@anthropic-ai/sdk/lib/credentials/token-cache';
import type { AccessToken, AccessTokenProvider } from '@anthropic-ai/sdk/lib/credentials/types';

let fakeNow = 1700000000;

beforeAll(() => {
  jest.useFakeTimers({ now: fakeNow * 1000 });
});

afterAll(() => {
  jest.useRealTimers();
});

function setFakeNow(seconds: number) {
  fakeNow = seconds;
  jest.setSystemTime(seconds * 1000);
}

describe('TokenCache', () => {
  it('fetches on first call when cache is empty', async () => {
    const provider = jest.fn<Promise<AccessToken>, []>().mockResolvedValue({
      token: 'tok-1',
      expiresAt: fakeNow + 3600,
    });

    const cache = new TokenCache(provider);
    expect(await cache.getToken()).toBe('tok-1');
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('returns cached token without calling provider when fresh', async () => {
    const provider = jest.fn<Promise<AccessToken>, []>().mockResolvedValue({
      token: 'tok-1',
      expiresAt: fakeNow + 3600,
    });

    const cache = new TokenCache(provider);
    await cache.getToken();
    expect(provider).toHaveBeenCalledTimes(1);

    // Second call — still fresh
    expect(await cache.getToken()).toBe('tok-1');
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('caches forever when expiresAt is null', async () => {
    const provider = jest.fn<Promise<AccessToken>, []>().mockResolvedValue({
      token: 'eternal',
      expiresAt: null,
    });

    const cache = new TokenCache(provider);
    expect(await cache.getToken()).toBe('eternal');
    expect(await cache.getToken()).toBe('eternal');
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('returns stale token in advisory window and refreshes in background', async () => {
    let callCount = 0;
    const initialExpiry = fakeNow + 3600;
    const provider: AccessTokenProvider = () => {
      callCount++;
      return Promise.resolve({
        token: `tok-${callCount}`,
        expiresAt: fakeNow + 3600,
      });
    };

    const cache = new TokenCache(provider);
    await cache.getToken(); // initial fetch
    expect(callCount).toBe(1);

    // Advance to advisory window (90s remaining, within 30–120s)
    setFakeNow(initialExpiry - 90);

    // Should return stale token immediately
    const token = await cache.getToken();
    expect(token).toBe('tok-1');

    // Flush the microtask queue so the background refresh completes
    await Promise.resolve();

    // Next call should get the refreshed token
    expect(await cache.getToken()).toBe('tok-2');
  });

  it('keeps stale token when advisory background refresh fails', async () => {
    let callCount = 0;
    const provider: AccessTokenProvider = () => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ token: 'tok-1', expiresAt: fakeNow + 3600 });
      }
      return Promise.reject(new Error('refresh failed'));
    };

    const onError = jest.fn();
    const cache = new TokenCache(provider, onError);
    await cache.getToken();

    // Advance to advisory window
    setFakeNow(fakeNow + 3600 - 90);

    expect(await cache.getToken()).toBe('tok-1');

    // Flush the microtask queue so the failed background refresh settles
    await Promise.resolve();

    // Still returns stale token
    expect(await cache.getToken()).toBe('tok-1');
    // Advisory failure surfaced to the callback (for debug logging)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'refresh failed' }));
  });

  it('blocks and refreshes in mandatory window', async () => {
    let callCount = 0;
    const initialExpiry = fakeNow + 3600;
    const provider: AccessTokenProvider = () => {
      callCount++;
      return Promise.resolve({
        token: `tok-${callCount}`,
        expiresAt: fakeNow + 3600,
      });
    };

    const cache = new TokenCache(provider);
    await cache.getToken();
    expect(callCount).toBe(1);

    // Advance to mandatory window (10s remaining)
    setFakeNow(initialExpiry - 10);

    const token = await cache.getToken();
    expect(token).toBe('tok-2');
    expect(callCount).toBe(2);
  });

  it('throws when mandatory refresh fails', async () => {
    let callCount = 0;
    const provider: AccessTokenProvider = () => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ token: 'tok-1', expiresAt: fakeNow + 3600 });
      }
      return Promise.reject(new Error('exchange down'));
    };

    const cache = new TokenCache(provider);
    await cache.getToken();

    // Advance past expiry
    setFakeNow(fakeNow + 3700);

    await expect(cache.getToken()).rejects.toThrow('exchange down');
  });

  it('deduplicates concurrent mandatory refreshes', async () => {
    let callCount = 0;
    let resolveProvider!: (token: AccessToken) => void;

    const provider: AccessTokenProvider = () => {
      callCount++;
      return new Promise((resolve) => {
        resolveProvider = resolve;
      });
    };

    const cache = new TokenCache(provider);

    // Fire multiple concurrent getToken calls
    const p1 = cache.getToken();
    const p2 = cache.getToken();
    const p3 = cache.getToken();

    // Only one provider call should be in-flight
    expect(callCount).toBe(1);

    resolveProvider({ token: 'shared-tok', expiresAt: fakeNow + 3600 });

    const [t1, t2, t3] = await Promise.all([p1, p2, p3]);
    expect(t1).toBe('shared-tok');
    expect(t2).toBe('shared-tok');
    expect(t3).toBe('shared-tok');
    expect(callCount).toBe(1);
  });

  it('invalidate forces re-fetch on next call', async () => {
    let callCount = 0;
    const provider: AccessTokenProvider = () => {
      callCount++;
      return Promise.resolve({ token: `tok-${callCount}`, expiresAt: fakeNow + 3600 });
    };

    const cache = new TokenCache(provider);
    expect(await cache.getToken()).toBe('tok-1');

    cache.invalidate();

    expect(await cache.getToken()).toBe('tok-2');
    expect(callCount).toBe(2);
  });

  it('invalidate passes forceRefresh to provider so disk caches are bypassed', async () => {
    const calls: Array<{ forceRefresh?: boolean } | undefined> = [];
    const provider: AccessTokenProvider = (opts) => {
      calls.push(opts);
      return Promise.resolve({ token: 'tok', expiresAt: fakeNow + 3600 });
    };

    const cache = new TokenCache(provider);
    await cache.getToken();
    expect(calls[0]).toBeUndefined();

    cache.invalidate();
    await cache.getToken();
    expect(calls[1]).toEqual({ forceRefresh: true });

    // One-shot: subsequent normal calls do not force.
    cache.invalidate();
    await cache.getToken();
    await cache.getToken(); // cached, no provider call
    expect(calls.length).toBe(3);
  });

  it('backs off advisory refresh for 5s after a failure', async () => {
    setFakeNow(1700000000);
    let callCount = 0;
    const provider: AccessTokenProvider = () => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ token: 'tok-1', expiresAt: fakeNow + 3600 });
      }
      return Promise.reject(new Error('refresh failed'));
    };

    const onError = jest.fn();
    const cache = new TokenCache(provider, onError);
    await cache.getToken();

    // Advance to advisory window
    setFakeNow(fakeNow + 3600 - 90);
    await cache.getToken(); // triggers background refresh → fails (call #2)
    await Promise.resolve();
    expect(callCount).toBe(2);
    expect(onError).toHaveBeenCalledTimes(1);

    // Within backoff window: another getToken should NOT trigger a provider call.
    setFakeNow(fakeNow + 2);
    await cache.getToken();
    await Promise.resolve();
    expect(callCount).toBe(2);

    // After backoff window: provider is tried again.
    setFakeNow(fakeNow + 4);
    await cache.getToken();
    await Promise.resolve();
    expect(callCount).toBe(3);
    expect(onError).toHaveBeenCalledTimes(2);
  });
});
