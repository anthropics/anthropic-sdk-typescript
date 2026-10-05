import { Page, PageCursor, TokenPage } from '@anthropic-ai/sdk/core/pagination';
import type { BaseAnthropic } from '@anthropic-ai/sdk/client';

const client = {} as BaseAnthropic;
const response = new Response('{}');
const options = { method: 'get', path: '/x', query: {} } as any;

describe('cursor pagination', () => {
  test.each([
    ['PageCursor', () => new PageCursor(client, response, { data: [], next_page: 'next' }, options)],
    [
      'TokenPage',
      () => new TokenPage(client, response, { data: [], has_more: true, next_page: 'next' }, options),
    ],
    [
      'Page',
      () =>
        new Page(client, response, { data: [], has_more: true, first_id: null, last_id: 'next' }, options),
    ],
  ])('%s follows a cursor from an empty page', (_name, makePage) => {
    expect(makePage().hasNextPage()).toBe(true);
  });
});
