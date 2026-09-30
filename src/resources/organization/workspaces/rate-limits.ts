import { APIResource } from '../../../core/resource';
import * as RateLimitsAPI from '../rate-limits';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

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
   * for await (const workspaceRateLimit of client.organization.workspaces.rateLimits.list(
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
  ): PagePromise<WorkspaceRateLimitsPageCursor, WorkspaceRateLimit> {
    return this._client.getAPIList(
      path`/v1/organizations/workspaces/${workspaceID}/rate_limits`,
      PageCursor<WorkspaceRateLimit>,
      { query, ...options },
    );
  }
}

export type WorkspaceRateLimitsPageCursor = PageCursor<WorkspaceRateLimit>;

export interface WorkspaceRateLimit {
  /**
   * The rate-limit group this entry's limits apply to. Its `type` equals
   * `group_type`.
   */
  group:
    | RateLimitsAPI.OrganizationRateLimitModelGroup
    | RateLimitsAPI.OrganizationRateLimitBatchGroup
    | RateLimitsAPI.OrganizationRateLimitTokenCountGroup
    | RateLimitsAPI.OrganizationRateLimitFilesGroup
    | RateLimitsAPI.OrganizationRateLimitSkillsGroup
    | RateLimitsAPI.OrganizationRateLimitWebSearchGroup;

  /**
   * The workspace's limiter values for this group. By default only the limiter types
   * with a workspace-level override are listed. With `include_inherited` set to
   * `true`, the limiter types the workspace inherits from the organization are
   * listed too, each marked by `source`.
   */
  limits: Array<WorkspaceRateLimitValue>;

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

export interface WorkspaceRateLimitOrganizationSource {
  /**
   * Always `organization`: no workspace-level override is stored, so the
   * organization's value applies.
   */
  type: 'organization';
}

export interface WorkspaceRateLimitValue {
  /**
   * The organization-level value for the same limiter type, for reference. `null`
   * when the organization has no limit configured for this limiter type.
   */
  org_limit: number | null;

  /**
   * Where `value` comes from. `organization` values are listed only when
   * `include_inherited` is `true`, and then `value` equals `org_limit`.
   */
  source: WorkspaceRateLimitWorkspaceSource | WorkspaceRateLimitOrganizationSource;

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

export interface WorkspaceRateLimitWorkspaceSource {
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
    type WorkspaceRateLimit as WorkspaceRateLimit,
    type WorkspaceRateLimitOrganizationSource as WorkspaceRateLimitOrganizationSource,
    type WorkspaceRateLimitValue as WorkspaceRateLimitValue,
    type WorkspaceRateLimitWorkspaceSource as WorkspaceRateLimitWorkspaceSource,
    type WorkspaceRateLimitsPageCursor as WorkspaceRateLimitsPageCursor,
    type RateLimitListParams as RateLimitListParams,
  };
}
