import { backoff, jitter, isStatus, is4xx } from '@anthropic-ai/sdk/lib/environments';
import { APIError } from '@anthropic-ai/sdk/core/error';

describe('backoff', () => {
  const cases: { description: string; attempt: number; want: number }[] = [
    { description: 'first attempt yields the 1s base delay', attempt: 0, want: 1000 },
    { description: 'second attempt doubles to 2s', attempt: 1, want: 2000 },
    { description: 'third attempt doubles again to 4s', attempt: 2, want: 4000 },
    {
      description: 'large attempt count is clamped to the 60s cap rather than overflowing',
      attempt: 20,
      want: 60_000,
    },
  ];
  for (const tc of cases) {
    test(tc.description, () => {
      expect(backoff(tc.attempt)).toBe(tc.want);
    });
  }
});

describe('jitter', () => {
  test('result always falls within [low, high) so callers can rely on the bound', () => {
    for (let i = 0; i < 200; i++) {
      const v = jitter(1000, 3000);
      expect(v).toBeGreaterThanOrEqual(1000);
      expect(v).toBeLessThan(3000);
    }
  });
});

describe('isStatus / is4xx', () => {
  function makeErr(status: number): APIError {
    return Object.assign(Object.create(APIError.prototype) as APIError, { status });
  }

  const cases: { description: string; err: unknown; status: number; wantIs: boolean; want4xx: boolean }[] = [
    {
      description: 'an APIError with matching status is detected by both helpers',
      err: makeErr(409),
      status: 409,
      wantIs: true,
      want4xx: true,
    },
    {
      description: 'a 5xx APIError is not 4xx and does not match a 409 check',
      err: makeErr(503),
      status: 409,
      wantIs: false,
      want4xx: false,
    },
    {
      description: 'a plain Error is never treated as an APIError',
      err: new Error('boom'),
      status: 500,
      wantIs: false,
      want4xx: false,
    },
  ];
  for (const tc of cases) {
    test(tc.description, () => {
      expect(isStatus(tc.err, tc.status)).toBe(tc.wantIs);
      expect(is4xx(tc.err)).toBe(tc.want4xx);
    });
  }
});
