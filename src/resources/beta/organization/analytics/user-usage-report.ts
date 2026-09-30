import { APIResource } from '../../../../core/resource';
import * as AnalyticsAPI from './analytics';
import { BetaAnalyticsUsageUsersItemsPageCursor } from './analytics';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';

export class UserUsageReport extends APIResource {
  /**
   * Get per-user token usage across a date range.
   *
   * Returns one row per user, ranked by the chosen token metric. Use this to see
   * which users consume the most tokens. Only usage attributable to a seat user is
   * included; for organization-wide totals including direct API-key and automation
   * traffic, use the bucketed `/v1/organizations/analytics/usage_report` endpoint.
   * Available to organizations on a Claude Enterprise plan. Requires an API key with
   * the `read:analytics` scope.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaAnalyticsUsageUsersItem of client.beta.organization.analytics.userUsageReport.list(
   *   { starting_at: '2019-12-27T18:11:19.117Z' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    query: UserUsageReportListParams,
    options?: RequestOptions,
  ): PagePromise<BetaAnalyticsUsageUsersItemsPageCursor, AnalyticsAPI.BetaAnalyticsUsageUsersItem> {
    return this._client.getAPIList(
      '/v1/organizations/analytics/user_usage_report?beta=true',
      PageCursor<AnalyticsAPI.BetaAnalyticsUsageUsersItem>,
      { query, ...options },
    );
  }
}

export interface UserUsageReportListParams extends PageCursorParams {
  /**
   * Start of range, inclusive. RFC 3339 tz-aware. Must be within the last 365 days
   * and no earlier than 2026-01-01T00:00:00Z.
   */
  starting_at: string;

  /**
   * Time-bucket granularity. When set, each row's `starting_at` and `ending_at` are
   * populated and one actor may span several rows (one per time bucket with usage).
   * The time bucket counts toward `limit`, so one page can return multiple rows for
   * the same actor. `ending_at` is required when `bucket_width` is set, and with
   * `bucket_width="1m"` the range may span at most 24 hours. When omitted, each row
   * aggregates the full `[starting_at, ending_at)` range.
   */
  bucket_width?: '1d' | '1h' | '1m' | null;

  /**
   * Filter to Claude Tag (Claude in Slack) usage in specific spend categories. Usage
   * with no category never matches. `dm` usage is reported under the user's product
   * rather than `claude-tag`, so combining this filter with `products[]=claude-tag`
   * excludes it. Use `group_by[]=claude_tag_category` to break out per-category
   * values.
   */
  claude_tag_categories?: Array<AnalyticsAPI.BetaAnalyticsClaudeTagCategory> | null;

  /**
   * Filter to Claude Tag (Claude in Slack) usage attributed to specific Slack users,
   * by Slack user ID (for example `U0123ABCDEF`), not claude.ai user ID. Usage that
   * is not Claude Tag, and Claude Tag usage not attributed to a single user, never
   * matches. Use `group_by[]=claude_tag_user_id` to break out per-user values.
   */
  claude_tag_user_ids?: Array<string> | null;

  /**
   * Filter to specific context-window pricing tiers. Use `group_by[]=context_window`
   * to break out per-tier values.
   */
  context_windows?: Array<AnalyticsAPI.BetaAnalyticsContextWindow> | null;

  /**
   * End of range, exclusive. When omitted, defaults to the earlier of now and
   * `starting_at` + 31 days. The range may span at most 31 days.
   */
  ending_at?: string | null;

  /**
   * If true, omit rows for users who are deleted (`deleted: true`). A page may
   * contain fewer than `limit` rows; use `has_more` and `next_page` to paginate as
   * usual.
   */
  exclude_deleted_users?: boolean;

  /**
   * Break each actor's row out by the given dimensions. Accepts the same values as
   * the bucketed `/usage_report` endpoint. `limit` bounds (actor × time bucket ×
   * dimension) rows — with dimensions or `bucket_width` present, one actor may span
   * several rows.
   */
  group_by?: Array<
    | 'claude_tag_category'
    | 'claude_tag_user_id'
    | 'context_window'
    | 'inference_geo'
    | 'model'
    | 'product'
    | 'rbac_group_id'
    | 'slack_channel_id'
    | 'speed'
  > | null;

  /**
   * Filter to specific inference regions. `not_available` matches rows where the
   * region is unset. Use `group_by[]=inference_geo` to break out per-region values.
   */
  inference_geos?: Array<AnalyticsAPI.BetaAnalyticsInferenceGeoFilter> | null;

  /**
   * Models to include. Defaults to all models. Use `group_by[]=model` to break out
   * per-model values.
   */
  models?: Array<string> | null;

  /**
   * Sort direction. Defaults to `desc`.
   */
  order?: 'asc' | 'desc';

  /**
   * Metric to rank actors by. Defaults to `total_tokens`.
   */
  order_by?: 'output_tokens' | 'requests' | 'total_tokens' | 'uncached_input_tokens';

  /**
   * Product surfaces to include. Defaults to all products.
   */
  products?: Array<AnalyticsAPI.BetaAnalyticsProductFilter> | null;

  /**
   * Filter to usage attributed to specific RBAC groups. Accepts tagged RBAC group
   * IDs (`rbac_group_...`) or bare group UUIDs. A row matches when the user belonged
   * to any of the listed groups on the (UTC) day the usage occurred; usage with no
   * group attribution never matches.
   */
  rbac_group_ids?: Array<string> | null;

  /**
   * Filter to usage originating from specific Slack channels. Use
   * `group_by[]=slack_channel_id` to break out per-channel values.
   */
  slack_channel_ids?: Array<string> | null;

  /**
   * Filter to fast or standard inference mode. Use `group_by[]=speed` to break out
   * per-mode values.
   */
  speeds?: Array<'fast' | 'standard'> | null;

  /**
   * Filter to specific users by tagged user ID.
   */
  user_ids?: Array<string> | null;
}

export declare namespace UserUsageReport {
  export { type UserUsageReportListParams as UserUsageReportListParams };
}

export { type BetaAnalyticsUsageUsersItemsPageCursor };
