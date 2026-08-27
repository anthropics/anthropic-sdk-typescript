// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../core/resource';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class RateLimits extends APIResource {
  /**
   * List rate-limit overrides configured for a workspace.
   *
   * Returns only the groups and limiter types that have a workspace-level override.
   * Groups without overrides inherit the organization limits and are not listed; use
   * `GET /v1/organizations/rate_limits` to see those.
   *
   * When `limit` is omitted, every matching entry is returned in a single page; when
   * `limit` truncates the result, follow `next_page` to fetch the remaining entries.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaWorkspaceRateLimit of client.beta.organization.workspaces.rateLimits.list(
   *   'workspace_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    workspaceID: string,
    query: RateLimitListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaWorkspaceRateLimitsPageCursor, BetaWorkspaceRateLimit> {
    return this._client.getAPIList(
      path`/v1/organizations/workspaces/${workspaceID}/rate_limits?beta=true`,
      PageCursor<BetaWorkspaceRateLimit>,
      { query, ...options },
    );
  }
}

export type BetaWorkspaceRateLimitsPageCursor = PageCursor<BetaWorkspaceRateLimit>;

export interface BetaWorkspaceRateLimit {
  /**
   * The kind of rate-limit group this entry represents. `model_group` entries apply
   * to a family of models (listed in `models`); other values apply to an API-surface
   * category and have `models` set to `null`.
   */
  group_type: 'batch' | 'files' | 'model_group' | 'skills' | 'token_count' | 'web_search';

  /**
   * The limiter values overridden for this group in this workspace. Limiter types
   * without a workspace override are omitted and inherit the organization value.
   */
  limits: Array<BetaWorkspaceRateLimitValue>;

  /**
   * Model names this entry's limits apply to, including aliases. `null` when
   * `group_type` is not `"model_group"`.
   */
  models: Array<string> | null;

  /**
   * The `id` of the RateLimit group this override applies to.
   */
  rate_limit_id: string;

  /**
   * Object type. Always `workspace_rate_limit` for workspace rate-limit entries.
   */
  type: 'workspace_rate_limit';

  /**
   * ID of the Workspace this override applies to.
   */
  workspace_id: string;
}

export interface BetaWorkspaceRateLimitValue {
  /**
   * The organization-level value for the same limiter type, for reference. `null`
   * when the organization has no limit configured for this limiter type.
   */
  org_limit: number | null;

  /**
   * The limiter type (for example, `requests_per_minute` or
   * `input_tokens_per_minute`).
   */
  type: string;

  /**
   * The workspace-level override value for this limiter type.
   */
  value: number;
}

export interface RateLimitListParams extends PageCursorParams {
  /**
   * Filter by group type.
   */
  group_type?: 'batch' | 'files' | 'model_group' | 'skills' | 'token_count' | 'web_search' | null;
}

export declare namespace RateLimits {
  export {
    type BetaWorkspaceRateLimit as BetaWorkspaceRateLimit,
    type BetaWorkspaceRateLimitValue as BetaWorkspaceRateLimitValue,
    type BetaWorkspaceRateLimitsPageCursor as BetaWorkspaceRateLimitsPageCursor,
    type RateLimitListParams as RateLimitListParams,
  };
}
