import { APIResource } from '../../../../core/resource';
import * as RateLimitsAPI from '../rate-limits';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';
import { path } from '../../../../internal/utils/path';

export class RateLimits extends APIResource {
  /**
   * Set or clear rate-limit overrides for one rate-limit group in a workspace.
   *
   * Only the limiter types named in `limits` change: an integer `value` sets that
   * type's override and `null` clears it. Types not named keep their current value.
   * A value above the organization's own limit is stored, but the organization limit
   * still applies, so the lower of the two is enforced.
   *
   * Returns the targeted group's entry with this request applied, in the shape
   * `GET /v1/organizations/workspaces/{workspace_id}/rate_limits` returns. Changes
   * take effect within about an hour.
   *
   * @example
   * ```ts
   * const betaWorkspaceRateLimit =
   *   await client.beta.organization.workspaces.rateLimits.update(
   *     'rate_limit_id',
   *     {
   *       workspace_id: 'workspace_id',
   *       limits: [{ type: 'fast_itpmca', value: 0 }],
   *     },
   *   );
   * ```
   */
  update(
    rateLimitID: string,
    params: RateLimitUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaWorkspaceRateLimit> {
    const { workspace_id, ...body } = params;
    return this._client.post(path`/v1/organizations/workspaces/${workspace_id}/rate_limits/${rateLimitID}`, {
      body,
      ...options,
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.workspaces.rate_limits.update',
        options,
        {
          route: '/v1/organizations/workspaces/{workspace_id}/rate_limits/{rate_limit_id}',
          attributes: {
            'anthropic.organization.workspace.id': workspace_id,
            'anthropic.organization.workspace.rate_limit.id': rateLimitID,
          },
        },
      ),
    });
  }

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
      path`/v1/organizations/workspaces/${workspaceID}/rate_limits`,
      PageCursor<BetaWorkspaceRateLimit>,
      {
        query,
        ...options,
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.workspaces.rate_limits.list',
          options,
          {
            route: '/v1/organizations/workspaces/{workspace_id}/rate_limits',
            queryParams: ['group_type', 'include_inherited', 'limit', 'page'],
            attributes: { 'anthropic.organization.workspace.id': workspaceID },
          },
        ),
      },
    );
  }
}

export type BetaWorkspaceRateLimitsPageCursor = PageCursor<BetaWorkspaceRateLimit>;

export interface BetaWorkspaceRateLimit {
  /**
   * The rate-limit group this entry's limits apply to.
   */
  group:
    | RateLimitsAPI.BetaOrganizationRateLimitModelGroup
    | RateLimitsAPI.BetaOrganizationRateLimitBatchGroup
    | RateLimitsAPI.BetaOrganizationRateLimitTokenCountGroup
    | RateLimitsAPI.BetaOrganizationRateLimitFilesGroup
    | RateLimitsAPI.BetaOrganizationRateLimitSkillsGroup
    | RateLimitsAPI.BetaOrganizationRateLimitWebSearchGroup;

  /**
   * The workspace's limiter values for this group. By default only the limiter types
   * with a workspace-level override are listed. With `include_inherited` set to
   * `true`, the limiter types the workspace inherits from the organization are
   * listed too, each marked by `source`.
   */
  limits: Array<BetaWorkspaceRateLimitValue>;

  /**
   * Model names this entry's limits apply to, including aliases. `null` when
   * `group.type` is not `"model_group"`. The list covers the models this workspace
   * has access to, so it can differ between workspaces.
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

/**
 * Rate limiter type.
 */
export type BetaWorkspaceRateLimitType =
  | 'fast_itpmca'
  | 'fast_otpm'
  | 'input_tokens_per_minute'
  | 'input_tokens_per_minute_cache_aware'
  | 'output_tokens_per_minute'
  | 'requests_per_minute'
  | 'tokens_per_day'
  | 'tokens_per_minute'
  | 'tool_uses_per_second';

export interface BetaWorkspaceRateLimitUpdateValue {
  /**
   * Rate limiter type.
   */
  type: BetaWorkspaceRateLimitType;

  /**
   * New limit value. Set to null to clear the workspace override and fall back to
   * the organization limit.
   */
  value: number | null;
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

export interface RateLimitUpdateParams {
  /**
   * Path param: The ID of the workspace.
   */
  workspace_id: string;

  /**
   * Body param: Limits to set or clear. Unspecified limit types are unchanged.
   */
  limits: Array<BetaWorkspaceRateLimitUpdateValue>;
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
    type BetaWorkspaceRateLimitType as BetaWorkspaceRateLimitType,
    type BetaWorkspaceRateLimitUpdateValue as BetaWorkspaceRateLimitUpdateValue,
    type BetaWorkspaceRateLimitValue as BetaWorkspaceRateLimitValue,
    type BetaWorkspaceRateLimitWorkspaceSource as BetaWorkspaceRateLimitWorkspaceSource,
    type BetaWorkspaceRateLimitsPageCursor as BetaWorkspaceRateLimitsPageCursor,
    type RateLimitUpdateParams as RateLimitUpdateParams,
    type RateLimitListParams as RateLimitListParams,
  };
}
