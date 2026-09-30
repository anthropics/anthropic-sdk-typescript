import { APIResource } from '../../../../core/resource';
import * as AnalyticsAPI from './analytics';
import { BetaAnalyticsSingleDayActivitySummariesPageCursor } from './analytics';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';

export class Summaries extends APIResource {
  /**
   * Get organization-wide activity summaries for a date range.
   *
   * Returns one entry per day from `starting_date` (inclusive) to `ending_date`
   * (exclusive) in `data`, the same `data` / `next_page` envelope as the other
   * analytics list endpoints; the series is currently returned in full, so
   * `next_page` is always null (`summaries` is a deprecated alias of `data`). Data
   * is typically available with a 1-day lag and may be revised by a few percent over
   * the following days: when `ending_date` is omitted it defaults to the most recent
   * available day + 1, so the last entry covers the most recent available day. The
   * series can be scoped to an RBAC group via `filter[]=rbac_group_id:{id}`.
   * Available to organizations on a Claude Enterprise plan. Requires an API key with
   * the `read:analytics` scope.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaAnalyticsSingleDayActivitySummary of client.beta.organization.analytics.summaries.list(
   *   { starting_date: '2019-12-27' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    query: SummaryListParams,
    options?: RequestOptions,
  ): PagePromise<
    BetaAnalyticsSingleDayActivitySummariesPageCursor,
    AnalyticsAPI.BetaAnalyticsSingleDayActivitySummary
  > {
    return this._client.getAPIList(
      '/v1/organizations/analytics/summaries?beta=true',
      PageCursor<AnalyticsAPI.BetaAnalyticsSingleDayActivitySummary>,
      { query, ...options },
    );
  }
}

export interface SummaryListParams extends PageCursorParams {
  /**
   * UTC date in YYYY-MM-DD format. Start of the date range (inclusive). Data is
   * typically available with a 1-day lag (varies by query; the error for a
   * too-recent date names the latest available day) and may be revised by a few
   * percent over the following days. No earlier than 2026-01-01.
   */
  starting_date: string;

  /**
   * UTC date in YYYY-MM-DD format. End of the date range (exclusive). Data is
   * typically available with a 1-day lag, so this can be at most today — which is
   * also the default when omitted, making the last entry cover the most recent
   * available day. Data may be revised by a few percent over the following days. The
   * range may span at most 366 days.
   */
  ending_date?: string | null;

  /**
   * Filters as `dimension:value`. Only `rbac_group_id` is supported (e.g.
   * `filter[]=rbac_group_id:{id}`); repeat the param to OR across groups. Scopes the
   * whole day series to members of the matching group(s), re-aggregated from
   * member-level activity — org-wide seat/invite fields and the adoption rates
   * derived from them are null on scoped rows. `rbac_group_id` accepts the tagged id
   * (`rbac_group_...`, as emitted in responses and by the spend-limits API) or a
   * bare group UUID, and matches users who held the group at any point during each
   * UTC day (time-of-usage attribution). At most 100 entries.
   */
  filter?: Array<string> | null;
}

export declare namespace Summaries {
  export { type SummaryListParams as SummaryListParams };
}

export { type BetaAnalyticsSingleDayActivitySummariesPageCursor };
