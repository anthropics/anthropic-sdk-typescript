// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { AbstractPage, Response, APIClient, FinalRequestOptions, PageInfo } from './core';

export interface PageResponse<Item> {
  data: Array<Item>;

  has_more: boolean;

  first_id: string | null;

  last_id: string | null;
}

export interface PageParams {
  /**
   * Number of items per page.
   */
  limit?: number;

  before_id?: string;

  after_id?: string;
}

export class Page<Item> extends AbstractPage<Item> implements PageResponse<Item> {
  data: Array<Item>;

  has_more: boolean;

  first_id: string | null;

  last_id: string | null;

  constructor(client: APIClient, response: Response, body: PageResponse<Item>, options: FinalRequestOptions) {
    super(client, response, body, options);

    this.data = body.data || [];
    this.has_more = body.has_more || false;
    this.first_id = body.first_id || null;
    this.last_id = body.last_id || null;
  }

  getPaginatedItems(): Item[] {
    return this.data ?? [];
  }

  override hasNextPage(): boolean {
    if (this.has_more === false) {
      return false;
    }

    return super.hasNextPage();
  }

  // @deprecated Please use `nextPageInfo()` instead
  nextPageParams(): Partial<PageParams> | null {
    const info = this.nextPageInfo();
    if (!info) return null;
    if ('params' in info) return info.params;
    const params = Object.fromEntries(info.url.searchParams);
    if (!Object.keys(params).length) return null;
    return params;
  }

  nextPageInfo(): PageInfo | null {
    if ((this.options.query as Record<string, unknown>)?.['before_id']) {
      // in reverse
      const firstId = this.first_id;
      if (!firstId) {
        return null;
      }

      return {
        params: {
          before_id: firstId,
        },
      };
    }

    const cursor = this.last_id;
    if (!cursor) {
      return null;
    }

    return {
      params: {
        after_id: cursor,
      },
    };
  }
}
