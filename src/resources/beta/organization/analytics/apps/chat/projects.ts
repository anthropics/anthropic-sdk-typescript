import { APIResource } from '../../../../../../core/resource';
import * as AnalyticsAPI from '../../analytics';
import { BetaAnalyticsProjectActivitiesPageCursor } from '../../analytics';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../../../core/pagination';
import { RequestOptions } from '../../../../../../internal/request-options';

export class Projects extends APIResource {
  /**
   * Get per-project activity for a given day, with cursor-based pagination.
   *
   * Returns activity metrics for each project in the organization, sorted by project
   * ID. Use `group_by[]` to break projects out per member or per RBAC group, and
   * `filter[]` to scope results; the parameter descriptions list the supported
   * dimensions. Available to organizations on a Claude Enterprise plan. Requires an
   * API key with the `read:analytics` scope.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaAnalyticsProjectActivity of client.beta.organization.analytics.apps.chat.projects.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: ProjectListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaAnalyticsProjectActivitiesPageCursor, AnalyticsAPI.BetaAnalyticsProjectActivity> {
    return this._client.getAPIList(
      '/v1/organizations/analytics/apps/chat/projects?beta=true',
      PageCursor<AnalyticsAPI.BetaAnalyticsProjectActivity>,
      { query, ...options },
    );
  }
}

export interface ProjectListParams extends PageCursorParams {
  /**
   * UTC date in YYYY-MM-DD format. The day to get project activity for. Data is
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
   * forms: `project_id` takes a tagged project id (`claude_proj_...`);
   * `rbac_group_id` takes the tagged id (`rbac_group_...`, as emitted in responses
   * and by the spend-limits API) or a bare group UUID, and matches users who held
   * the group at any point during each covered UTC day (time-of-usage attribution);
   * `user_id` takes a tagged user id (`user_...`), as emitted in responses. An
   * unsupported dimension returns 400. At most 100 entries.
   */
  filter?: Array<string> | null;

  /**
   * Dimensions to break results out by (e.g. `group_by[]=user_id`). Supported on
   * this endpoint: `rbac_group_id`, `user_id`. Grouped rows carry the requested
   * dimension values as additional fields and paginate like ungrouped responses via
   * `next_page`; an unsupported dimension returns 400. `rbac_group_id` attributes a
   * user to every group they held at any point during each covered UTC day, so
   * grouped rows are not an exclusive partition and can sum above org-level totals.
   * At most 100 entries.
   */
  group_by?: Array<'rbac_group_id' | 'user_id'> | null;

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

export declare namespace Projects {
  export { type ProjectListParams as ProjectListParams };
}

export { type BetaAnalyticsProjectActivitiesPageCursor };
