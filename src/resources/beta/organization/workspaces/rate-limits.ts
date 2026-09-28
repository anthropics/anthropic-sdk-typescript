import { APIResource } from '../../../../core/resource';
import * as RateLimitsAPI from '../rate-limits';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class RateLimits extends APIResource {
  /**
   * List a workspace's rate limits.
   *
   * By default, returns only the groups and limiter types that have a
   * workspace-level override. With `include_inherited=true`, returns every group
   * with organization-level limits the workspace can see, listing for each the
   * values it inherits from the organization as well as its own overrides. Each
   * value's `source` says which it is.
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
   * The rate-limit group this entry's limits apply to. Its `type` equals
   * `group_type`.
   */
  group:
    | RateLimitsAPI.BetaOrganizationRateLimitModelGroup
    | RateLimitsAPI.BetaOrganizationRateLimitBatchGroup
    | RateLimitsAPI.BetaOrganizationRateLimitTokenCountGroup
    | RateLimitsAPI.BetaOrganizationRateLimitFilesGroup
    | RateLimitsAPI.BetaOrganizationRateLimitSkillsGroup
    | RateLimitsAPI.BetaOrganizationRateLimitWebSearchGroup;

  /**
   * @deprecated Use `group.type` instead. `group_type` is still returned and always
   * equals `group.type`.
   */
  group_type: 'batch' | 'files' | 'model_group' | 'skills' | 'token_count' | 'web_search';

  /**
   * The workspace's limiter values for this group. By default only the limiter types
   * with a workspace-level override are listed. With `include_inherited` set to
   * `true`, the limiter types the workspace inherits from the organization are
   * listed too, each marked by `source`.
   */
  limits: Array<BetaWorkspaceRateLimitValue>;

  /**
   * Model names this entry's limits apply to, including aliases. `null` when
   * `group_type` is not `"model_group"`.
   */
  models: Array<string> | null;

  /**
   * The `id` of the organization's RateLimit entry this entry applies to.
   */
  rate_limit_id: string;

  /**
   * Object type. Always `workspace_rate_limit` for workspace rate-limit entries.
   */
  type: 'workspace_rate_limit';

  /**
   * ID of the Workspace this entry applies to.
   */
  workspace_id: string;
}

export interface BetaWorkspaceRateLimitOrganizationSource {
  /**
   * Always `organization`: no workspace-level override is stored, so the
   * organization's value applies.
   */
  type: 'organization';
}

export interface BetaWorkspaceRateLimitValue {
  /**
   * The organization-level value for the same limiter type, for reference. `null`
   * when the organization has no limit configured for this limiter type.
   */
  org_limit: number | null;

  /**
   * Where `value` comes from. `organization` values are listed only when
   * `include_inherited` is `true`, and then `value` equals `org_limit`.
   */
  source: BetaWorkspaceRateLimitWorkspaceSource | BetaWorkspaceRateLimitOrganizationSource;

  /**
   * The limiter type (for example, `requests_per_minute` or
   * `input_tokens_per_minute`).
   */
  type: string;

  /**
   * The workspace's value for this limiter type: the workspace-level override when
   * `source.type` is `workspace`, otherwise the organization's value.
   */
  value: number;
}

export interface BetaWorkspaceRateLimitWorkspaceSource {
  /**
   * Always `workspace`: a workspace-level override is stored.
   */
  type: 'workspace';
}

export interface RateLimitListParams extends PageCursorParams {
  /**
   * Filter by group type.
   */
  group_type?: 'batch' | 'files' | 'model_group' | 'skills' | 'token_count' | 'web_search' | null;

  /**
   * Also list the limiter values the workspace inherits from the organization,
   * including groups with no workspace-level override.
   */
  include_inherited?: boolean;
}

export declare namespace RateLimits {
  export {
    type BetaWorkspaceRateLimit as BetaWorkspaceRateLimit,
    type BetaWorkspaceRateLimitOrganizationSource as BetaWorkspaceRateLimitOrganizationSource,
    type BetaWorkspaceRateLimitValue as BetaWorkspaceRateLimitValue,
    type BetaWorkspaceRateLimitWorkspaceSource as BetaWorkspaceRateLimitWorkspaceSource,
    type BetaWorkspaceRateLimitsPageCursor as BetaWorkspaceRateLimitsPageCursor,
    type RateLimitListParams as RateLimitListParams,
  };
}
