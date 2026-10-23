import { APIResource } from '../../../../core/resource';
import * as AnalyticsAPI from './analytics';
import { BetaAnalyticsUsageReportTimeBucketsReportPageCursor } from './analytics';
import { PagePromise, ReportPageCursor, type ReportPageCursorParams } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';

export class UsageReport extends APIResource {
  /**
   * [Legacy] Get token usage over time across a date range.
   *
   * Returns token usage bucketed by minute, hour, or day, optionally broken down by
   * one or more `group_by[]` dimensions, such as product or model. Available to
   * organizations on a Claude Enterprise plan. Requires an API key with the
   * `read:analytics` scope.
   *
   * This endpoint is one of the legacy Claude Enterprise usage and cost reports. For
   * new integrations, use
   * [`GET /v1/organizations/analytics/usage`](/docs/en/api/beta/organization/analytics/usage/list)
   * in the Usage and Cost Analytics API instead. To move an existing integration,
   * see
   * [Migrate from the Claude Enterprise usage and cost reports](/docs/en/manage-claude/usage-cost-analytics-api#migrate-from-enterprise-analytics-reports).
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaAnalyticsUsageReportTimeBucket of client.beta.organization.analytics.usageReport.list(
   *   { starting_at: '2019-12-27T18:11:19.117Z' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    query: UsageReportListParams,
    options?: RequestOptions,
  ): PagePromise<
    BetaAnalyticsUsageReportTimeBucketsReportPageCursor,
    AnalyticsAPI.BetaAnalyticsUsageReportTimeBucket
  > {
    return this._client.getAPIList(
      '/v1/organizations/analytics/usage_report',
      ReportPageCursor<AnalyticsAPI.BetaAnalyticsUsageReportTimeBucket>,
      {
        query,
        ...options,
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.analytics.usage_report.list',
          options,
          {
            route: '/v1/organizations/analytics/usage_report',
            queryParams: [
              'bucket_width',
              'claude_tag_categories',
              'claude_tag_user_ids',
              'context_windows',
              'ending_at',
              'group_by',
              'inference_geos',
              'limit',
              'models',
              'page',
              'products',
              'rbac_group_ids',
              'slack_channel_ids',
              'speeds',
              'starting_at',
              'user_ids',
            ],
          },
        ),
      },
    );
  }
}

export interface UsageReportListParams extends ReportPageCursorParams {
  /**
   * Start of range, inclusive. RFC 3339 tz-aware. Must be within the last 365 days
   * and no earlier than 2026-01-01T00:00:00Z.
   */
  starting_at: string;

  /**
   * Time bucket granularity.
   */
  bucket_width?: '1d' | '1h' | '1m';

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
   * Dimensions to break each time bucket out by. Defaults to no grouping (one total
   * per bucket). Each bucket reports at most its top 100 groups; a group beyond that
   * cap has no row in that bucket (there is no remainder row), so grouped buckets
   * are not exhaustive when a dimension has more than 100 distinct values.
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
   * Maximum number of time buckets per page. Defaults and caps vary by
   * `bucket_width` (`1d`: default 7, max 31; `1h`: default 24, max 168; `1m`:
   * default 60, max 256).
   */
  limit?: number | null;

  /**
   * Models to include. Defaults to all models. Use `group_by[]=model` to break out
   * per-model values.
   */
  models?: Array<string> | null;

  /**
   * Product surfaces to include. Defaults to all products. Use `group_by[]=product`
   * to break out per-product values.
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

export declare namespace UsageReport {
  export { type UsageReportListParams as UsageReportListParams };
}

export { type BetaAnalyticsUsageReportTimeBucketsReportPageCursor };
