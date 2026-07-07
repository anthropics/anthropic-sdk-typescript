import type { RequestOptions } from '@anthropic-ai/sdk/internal/request-options';
import { compareType } from './utils/typing';

describe('RequestOptions', () => {
  test('does not expose unsupported idempotency keys', () => {
    compareType<'idempotencyKey' extends keyof RequestOptions ? true : false, false>(true);

    const options: RequestOptions = {};
    expect(options).toEqual({});

    // @ts-expect-error idempotency keys are not supported by the Anthropic API client.
    const unsupported: RequestOptions = { idempotencyKey: 'retry-key' };
    expect(unsupported).toEqual({ idempotencyKey: 'retry-key' });
  });
});
