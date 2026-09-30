import { APIResource } from '../../../../core/resource';
import * as AnalyticsAPI from './analytics';
import { BetaAnalyticsArtifactActivitiesPageCursor } from './analytics';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';

export class Artifacts extends APIResource {
  /**
   * Get artifact-creation activity for a given day, broken out by MIME type.
   *
   * Returns the full (`artifact_type`, `is_shared`) cube for the organization;
   * `next_page` is null except for grouped queries, which paginate. The cube can be
   * broken out per product, per member, or per RBAC group via `group_by[]`, and
   * scoped via `filter[]`. Requires an API key with the `read:analytics` scope.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaAnalyticsArtifactActivity of client.beta.organization.analytics.artifacts.list(
   *   { date: '2019-12-27' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    query: ArtifactListParams,
    options?: RequestOptions,
  ): PagePromise<BetaAnalyticsArtifactActivitiesPageCursor, AnalyticsAPI.BetaAnalyticsArtifactActivity> {
    return this._client.getAPIList(
      '/v1/organizations/analytics/artifacts?beta=true',
      PageCursor<AnalyticsAPI.BetaAnalyticsArtifactActivity>,
      { query, ...options },
    );
  }
}

export interface ArtifactListParams extends PageCursorParams {
  /**
   * UTC date in YYYY-MM-DD format. The day to get artifact activity for. Data is
   * typically available with a 1-day lag (varies by query; the error for a
   * too-recent date names the latest available day) and may be revised by a few
   * percent over the following days. No earlier than 2026-01-01.
   */
  date: string;

  /**
   * Filters as `dimension:value`, e.g. `filter[]=rbac_group_id:{id}`. Repeat the
   * param for OR within a dimension and across dimensions for AND. Supported
   * dimensions on this endpoint: `artifact_type`, `is_shared`, `product`,
   * `rbac_group_id`, `user_id`. Value forms: `artifact_type` is a canonical artifact
   * MIME type (e.g. `text/markdown`) or `other`; `is_shared` is `true` or `false`;
   * `product` is `chat`, `claude_code`, or `cowork` (the surfaces that create
   * artifacts); `rbac_group_id` takes the tagged id (`rbac_group_...`, as emitted in
   * responses and by the spend-limits API) or a bare group UUID, and matches users
   * who held the group at any point during each covered UTC day (time-of-usage
   * attribution); `user_id` takes a tagged user id (`user_...`), as emitted in
   * responses. An unsupported dimension returns 400. At most 100 entries.
   */
  filter?: Array<string> | null;

  /**
   * Dimensions to break results out by: `product`, `user_id` and/or `rbac_group_id`.
   * The ungrouped artifact-type cube is finite and returned in full; grouped queries
   * multiply the cube and paginate via `next_page`. `product` takes the values
   * `chat`, `claude_code`, or `cowork` (the surfaces that create artifacts).
   * `rbac_group_id` attributes a user to every group they held at any point during
   * the requested UTC day, so grouped rows are not an exclusive partition. At most
   * 100 entries.
   */
  group_by?: Array<'product' | 'rbac_group_id' | 'user_id'> | null;
}

export declare namespace Artifacts {
  export { type ArtifactListParams as ArtifactListParams };
}

export { type BetaAnalyticsArtifactActivitiesPageCursor };
