// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';

export class RateLimits extends APIResource {
  /**
   * List Messages API rate limits for your organization.
   *
   * Each entry corresponds to one rate-limit group (either a model family or an
   * API-surface category such as the Files API or Message Batches) and contains the
   * set of limiter values that apply to it.
   *
   * When `limit` is omitted, every matching entry is returned in a single page; when
   * `limit` truncates the result, follow `next_page` to fetch the remaining entries.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaOrganizationRateLimit of client.beta.organization.rateLimits.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: RateLimitListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaOrganizationRateLimitsPageCursor, BetaOrganizationRateLimit> {
    return this._client.getAPIList(
      '/v1/organizations/rate_limits?beta=true',
      PageCursor<BetaOrganizationRateLimit>,
      { query, ...options },
    );
  }
}

export type BetaOrganizationRateLimitsPageCursor = PageCursor<BetaOrganizationRateLimit>;

export interface BetaOrganizationRateLimit {
  /**
   * Stable identifier for this rate-limit group within the organization.
   */
  id: string;

  /**
   * The kind of rate-limit group this entry represents. `model_group` entries apply
   * to a family of models (listed in `models`); other values apply to an API-surface
   * category and have `models` set to `null`.
   */
  group_type: 'batch' | 'files' | 'model_group' | 'skills' | 'token_count' | 'web_search';

  /**
   * The limiter values that apply to this group.
   */
  limits: Array<BetaOrganizationRateLimitValue>;

  /**
   * Model names this entry's limits apply to, including aliases. `null` when
   * `group_type` is not `"model_group"`.
   */
  models: Array<string> | null;

  /**
   * Object type. Always `rate_limit` for organization rate-limit entries.
   */
  type: 'rate_limit';
}

export interface BetaOrganizationRateLimitValue {
  /**
   * The limiter type (for example, `requests_per_minute` or
   * `input_tokens_per_minute`).
   */
  type: string;

  /**
   * The configured limit value for this limiter type.
   */
  value: number;
}

export interface RateLimitListParams extends PageCursorParams {
  /**
   * Filter by group type.
   */
  group_type?: 'batch' | 'files' | 'model_group' | 'skills' | 'token_count' | 'web_search' | null;

  /**
   * Filter to the single entry containing this model. Accepts full model names and
   * aliases. Returns 404 if the model is not found or has no rate limits for this
   * organization.
   */
  model?: string | null;
}

export declare namespace RateLimits {
  export {
    type BetaOrganizationRateLimit as BetaOrganizationRateLimit,
    type BetaOrganizationRateLimitValue as BetaOrganizationRateLimitValue,
    type BetaOrganizationRateLimitsPageCursor as BetaOrganizationRateLimitsPageCursor,
    type RateLimitListParams as RateLimitListParams,
  };
}
