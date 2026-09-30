import { APIResource } from '../../../../core/resource';
import * as AnalyticsAPI from './analytics';
import { BetaAnalyticsCostUsersItemsPageCursor } from './analytics';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';

export class UserCostReport extends APIResource {
  /**
   * Get per-user cost in USD across a date range.
   *
   * Returns one row per user, ranked by spend. Use this to see which users account
   * for the most cost. Only cost attributable to a seat user is included; for
   * organization-wide totals including direct API-key and automation traffic, use
   * the bucketed `/v1/organizations/analytics/cost_report` endpoint. Available to
   * organizations on a Claude Enterprise plan. Requires an API key with the
   * `read:analytics` scope.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaAnalyticsCostUsersItem of client.beta.organization.analytics.userCostReport.list(
   *   { starting_at: '2019-12-27T18:11:19.117Z' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    query: UserCostReportListParams,
    options?: RequestOptions,
  ): PagePromise<BetaAnalyticsCostUsersItemsPageCursor, AnalyticsAPI.BetaAnalyticsCostUsersItem> {
    return this._client.getAPIList(
      '/v1/organizations/analytics/user_cost_report?beta=true',
      PageCursor<AnalyticsAPI.BetaAnalyticsCostUsersItem>,
      { query, ...options },
    );
  }
}

export interface UserCostReportListParams extends PageCursorParams {
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
   * the bucketed `/cost_report` endpoint. The `product`, `model`, `context_window`,
   * `inference_geo`, and `speed` dimensions — and the time bucket, when
   * `bucket_width` is set — count toward `limit`. `cost_type` and `token_type` do
   * not: `cost_type` returns one row per cost component (tokens, web search, code
   * execution); `token_type` returns one row per token type, each with
   * `cost_type: "tokens"`; combining both returns the per-token-type rows plus the
   * web-search and code-execution rows. A page can therefore contain more rows than
   * `limit` when `cost_type` or `token_type` is requested.
   */
  group_by?: Array<
    | 'claude_tag_category'
    | 'claude_tag_user_id'
    | 'context_window'
    | 'cost_type'
    | 'inference_geo'
    | 'model'
    | 'product'
    | 'rbac_group_id'
    | 'slack_channel_id'
    | 'speed'
    | 'token_type'
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
   * Metric to rank actors by. Defaults to `amount`.
   */
  order_by?: 'amount' | 'list_amount';

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

export declare namespace UserCostReport {
  export { type UserCostReportListParams as UserCostReportListParams };
}

export { type BetaAnalyticsCostUsersItemsPageCursor };
