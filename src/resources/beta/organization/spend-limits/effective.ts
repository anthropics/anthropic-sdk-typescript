import { APIResource } from '../../../../core/resource';
import * as SpendLimitsAPI from './spend-limits';
import { BetaSpendSummariesPageCursor } from './spend-limits';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';

export class Effective extends APIResource {
  /**
   * List each member's effective spend limit and period-to-date spend.
   *
   * Returns one row per (member, period) the member resolves a spend limit for, with
   * the `source` scope the spend limit was inherited from. Paginates by member, so a
   * member's periods never split across pages. Supported for Claude Enterprise
   * organizations only, not for Claude Console organizations.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaSpendSummary of client.beta.organization.spendLimits.effective.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: EffectiveListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaSpendSummariesPageCursor, SpendLimitsAPI.BetaSpendSummary> {
    return this._client.getAPIList(
      '/v1/organizations/spend_limits/effective?beta=true',
      PageCursor<SpendLimitsAPI.BetaSpendSummary>,
      {
        query,
        ...options,
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.spend_limits.effective.list',
          options,
          {
            route: '/v1/organizations/spend_limits/effective',
            queryParams: ['limit', 'page', 'period', 'user_ids'],
          },
        ),
      },
    );
  }
}

export interface EffectiveListParams extends PageCursorParams {
  /**
   * Restrict the report to these limit periods. Omit to return one row per period
   * each member resolves a spend limit for.
   */
  period?: Array<'daily' | 'monthly' | 'weekly'> | null;

  /**
   * Restrict the report to these members, by tagged user ID (`user_...`). At most
   * 100 entries.
   */
  user_ids?: Array<string> | null;
}

export declare namespace Effective {
  export { type EffectiveListParams as EffectiveListParams };
}

export { type BetaSpendSummariesPageCursor };
