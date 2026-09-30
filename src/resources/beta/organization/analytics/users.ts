import { APIResource } from '../../../../core/resource';
import * as AnalyticsAPI from './analytics';
import { BetaAnalyticsUserActivitiesPageCursor } from './analytics';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';

export class Users extends APIResource {
  /**
   * Get per-user activity for a given day, with cursor-based pagination.
   *
   * Returns activity metrics for each user in the organization, sorted by email
   * address. Use `group_by[]` for per-RBAC-group aggregates, or `filter[]` to scope
   * results to specific members, groups, or a chat project. Available to
   * organizations on a Claude Enterprise plan. Requires an API key with the
   * `read:analytics` scope.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaAnalyticsUserActivity of client.beta.organization.analytics.users.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: UserListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaAnalyticsUserActivitiesPageCursor, AnalyticsAPI.BetaAnalyticsUserActivity> {
    return this._client.getAPIList(
      '/v1/organizations/analytics/users?beta=true',
      PageCursor<AnalyticsAPI.BetaAnalyticsUserActivity>,
      { query, ...options },
    );
  }
}

export interface UserListParams extends PageCursorParams {
  /**
   * UTC date in YYYY-MM-DD format. The day to get user activity for. Data is
   * typically available with a 1-day lag (varies by query; the error for a
   * too-recent date names the latest available day) and may be revised by a few
   * percent over the following days. No earlier than 2026-01-01.
   */
  date?: string | null;

  /**
   * UTC date in YYYY-MM-DD format. End of the date range (exclusive); only valid
   * with `starting_date`. Data is typically available with a 1-day lag (varies by
   * query; the error for a too-recent date names the latest available day), so this
   * can be at most today — which is also the default when omitted, resolved once
   * when the first page is served and reused for the rest of the pagination
   * sequence. At most 366 days after `starting_date`.
   */
  ending_date?: string | null;

  /**
   * Filters as `dimension:value`, e.g. `filter[]=rbac_group_id:{id}`. Repeat the
   * param for OR within a dimension and across dimensions for AND. Supported
   * dimensions on this endpoint: `project_id`, `rbac_group_id`, `user_id`. Value
   * forms: `project_id` takes a tagged project id (`claude_proj_...`) and scopes
   * each member's row to their claude.ai chat activity within that project (it
   * cannot be combined with `group_by[]` or an `rbac_group_id` filter);
   * `rbac_group_id` takes the tagged id (`rbac_group_...`, as emitted in responses
   * and by the spend-limits API) or a bare group UUID, and matches users who held
   * the group at any point during each covered UTC day (time-of-usage attribution);
   * `user_id` takes a tagged user id (`user_...`), as emitted in responses. An
   * unsupported dimension returns 400. At most 100 entries.
   */
  filter?: Array<string> | null;

  /**
   * Dimensions to break results out by (e.g. `group_by[]=rbac_group_id`). Supported
   * on this endpoint: `rbac_group_id`. Rows are already per-member, so the one
   * supported grouping aggregates them per RBAC group instead. Grouped rows carry
   * the requested dimension values as additional fields and paginate like ungrouped
   * responses via `next_page`; an unsupported dimension returns 400. `rbac_group_id`
   * attributes a user to every group they held at any point during each covered UTC
   * day, so grouped rows are not an exclusive partition and can sum above org-level
   * totals. At most 100 entries.
   */
  group_by?: Array<'rbac_group_id'> | null;

  /**
   * Sort direction: `asc` or `desc`. Defaults to `asc` for the endpoint's sort
   * column and to `desc` when `order_by` names a metric (a top-N ranking). Applies
   * to `order_by`, or to the endpoint's default sort field when `order_by` is
   * omitted.
   */
  order?: 'asc' | 'desc' | null;

  /**
   * Sort field. Restricted to the endpoint's sort column plus its rankable metrics
   * (metrics default to descending; a few metrics rank in date-range mode only, per
   * the endpoint's documented orderable set).
   */
  order_by?: string | null;

  /**
   * UTC date in YYYY-MM-DD format. Start of a date range (inclusive). Enables rollup
   * mode: one row per entity aggregated over the whole range — addable counters are
   * summed across days, and a distinct count is never summed where summing could
   * double-count (a field's range value is recomputed exactly over the window,
   * approximate via HLL with typical error under 2%, null, or — for the
   * creation-event counts, whose per-day values cannot overlap — a per-day sum that
   * is itself exact; each field's own description says which). Use either `date` or
   * `starting_date`, not both. Data is typically available with a 1-day lag (varies
   * by query; the error for a too-recent date names the latest available day) and
   * may be revised by a few percent over the following days. No earlier than
   * 2026-01-01.
   */
  starting_date?: string | null;
}

export declare namespace Users {
  export { type UserListParams as UserListParams };
}

export { type BetaAnalyticsUserActivitiesPageCursor };
