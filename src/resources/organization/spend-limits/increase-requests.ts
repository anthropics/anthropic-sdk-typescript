import { APIResource } from '../../../core/resource';
import * as SpendLimitsAPI from './spend-limits';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

export class IncreaseRequests extends APIResource {
  /**
   * Retrieve a spend limit increase request.
   *
   * While `pending`, the response includes a live `spend_summary` for the requester
   * at the request's period.
   *
   * @example
   * ```ts
   * const spendLimitIncreaseRequest =
   *   await client.organization.spendLimits.increaseRequests.retrieve(
   *     'spend_limit_increase_request_id',
   *   );
   * ```
   */
  retrieve(
    spendLimitIncreaseRequestID: string,
    options?: RequestOptions,
  ): APIPromise<SpendLimitIncreaseRequest> {
    return this._client.get(
      path`/v1/organizations/spend_limit_increase_requests/${spendLimitIncreaseRequestID}`,
      {
        ...options,
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.spend_limits.increase_requests.retrieve',
          options,
          {
            route: '/v1/organizations/spend_limit_increase_requests/{spend_limit_increase_request_id}',
            attributes: {
              'anthropic.organization.spend_limit_increase_request.id': spendLimitIncreaseRequestID,
            },
          },
        ),
      },
    );
  }

  /**
   * List spend limit increase requests, most recent first.
   *
   * Pending requests include a live `spend_summary` for the requester. Requests
   * whose requester is no longer a member are excluded.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const spendLimitIncreaseRequest of client.organization.spendLimits.increaseRequests.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: IncreaseRequestListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<SpendLimitIncreaseRequestsPageCursor, SpendLimitIncreaseRequest> {
    return this._client.getAPIList(
      '/v1/organizations/spend_limit_increase_requests',
      PageCursor<SpendLimitIncreaseRequest>,
      {
        query,
        ...options,
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.spend_limits.increase_requests.list',
          options,
          {
            route: '/v1/organizations/spend_limit_increase_requests',
            queryParams: ['actor_ids', 'limit', 'page', 'status'],
          },
        ),
      },
    );
  }

  /**
   * Approve a pending spend limit increase request.
   *
   * Writes a per-user spend limit at `amount` for the requester and transitions the
   * request to `approved`. `period` defaults to the period the member was blocked
   * on. Anthropic emails the requester unless `suppress_notification` is set.
   *
   * @example
   * ```ts
   * const response =
   *   await client.organization.spendLimits.increaseRequests.approve(
   *     'spend_limit_increase_request_id',
   *     { amount: '50000' },
   *   );
   * ```
   */
  approve(
    spendLimitIncreaseRequestID: string,
    body: IncreaseRequestApproveParams,
    options?: RequestOptions,
  ): APIPromise<IncreaseRequestApproveResponse> {
    return this._client.post(
      path`/v1/organizations/spend_limit_increase_requests/${spendLimitIncreaseRequestID}/approve`,
      {
        body,
        ...options,
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.spend_limits.increase_requests.approve',
          options,
          {
            route:
              '/v1/organizations/spend_limit_increase_requests/{spend_limit_increase_request_id}/approve',
            attributes: {
              'anthropic.organization.spend_limit_increase_request.id': spendLimitIncreaseRequestID,
            },
          },
        ),
      },
    );
  }

  /**
   * Deny a pending spend limit increase request.
   *
   * Idempotent on `denied`; denying an already-`approved` request returns 400.
   * Anthropic emails the requester unless `suppress_notification` is set.
   *
   * @example
   * ```ts
   * const spendLimitIncreaseRequest =
   *   await client.organization.spendLimits.increaseRequests.deny(
   *     'spend_limit_increase_request_id',
   *     {},
   *   );
   * ```
   */
  deny(
    spendLimitIncreaseRequestID: string,
    body: IncreaseRequestDenyParams,
    options?: RequestOptions,
  ): APIPromise<SpendLimitIncreaseRequest> {
    return this._client.post(
      path`/v1/organizations/spend_limit_increase_requests/${spendLimitIncreaseRequestID}/deny`,
      {
        body,
        ...options,
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.spend_limits.increase_requests.deny',
          options,
          {
            route: '/v1/organizations/spend_limit_increase_requests/{spend_limit_increase_request_id}/deny',
            attributes: {
              'anthropic.organization.spend_limit_increase_request.id': spendLimitIncreaseRequestID,
            },
          },
        ),
      },
    );
  }
}

export type SpendLimitIncreaseRequestsPageCursor = PageCursor<SpendLimitIncreaseRequest>;

export interface SpendLimitIncreaseRequest {
  id: string;

  /**
   * Who submitted the increase request.
   */
  actor: SpendLimitIncreaseRequestActor;

  created_at: string;

  period: SpendLimitsAPI.SpendLimitPeriod;

  resolved_at: string | null;

  /**
   * Who approved or denied the increase request.
   */
  resolved_by: SpendLimitIncreaseRequestResolvedBy | null;

  /**
   * Per-member effective-limit report row (`GET /spend_limits/effective`).
   */
  spend_summary: SpendLimitsAPI.SpendSummary | null;

  status: SpendLimitIncreaseRequestStatus;

  type: 'spend_limit_increase_request';
}

/**
 * Who submitted the increase request.
 */
export type SpendLimitIncreaseRequestActor =
  | SpendLimitsAPI.SpendLimitUserActor
  | SpendLimitsAPI.SpendLimitScopedAPIKeyActor;

/**
 * Who approved or denied the increase request.
 */
export type SpendLimitIncreaseRequestResolvedBy =
  | SpendLimitsAPI.SpendLimitUserActor
  | SpendLimitsAPI.SpendLimitScopedAPIKeyActor;

export type SpendLimitIncreaseRequestStatus = 'approved' | 'denied' | 'pending';

export interface IncreaseRequestApproveResponse {
  id: string;

  /**
   * Who submitted the increase request.
   */
  actor: SpendLimitIncreaseRequestActor;

  created_at: string;

  period: SpendLimitsAPI.SpendLimitPeriod;

  resolved_at: string | null;

  /**
   * Who approved or denied the increase request.
   */
  resolved_by: SpendLimitIncreaseRequestResolvedBy | null;

  /**
   * A configured spend limit: a cap on metered spend for one scope and period.
   */
  spend_limit: SpendLimitsAPI.SpendLimit | null;

  /**
   * Per-member effective-limit report row (`GET /spend_limits/effective`).
   */
  spend_summary: SpendLimitsAPI.SpendSummary | null;

  status: SpendLimitIncreaseRequestStatus;

  type: 'spend_limit_increase_request';
}

export interface IncreaseRequestListParams extends PageCursorParams {
  /**
   * Filter by requester, as `user_...` tagged IDs.
   */
  actor_ids?: Array<string> | null;

  /**
   * Filter by status. Omit to return all.
   */
  status?: Array<SpendLimitIncreaseRequestStatus> | null;
}

export interface IncreaseRequestApproveParams {
  /**
   * New per-user spend limit as a non-negative integer decimal string (minor units).
   */
  amount: string;

  period?: SpendLimitsAPI.SpendLimitPeriod | null;

  suppress_notification?: boolean;
}

export interface IncreaseRequestDenyParams {
  suppress_notification?: boolean;
}

export declare namespace IncreaseRequests {
  export {
    type SpendLimitIncreaseRequest as SpendLimitIncreaseRequest,
    type SpendLimitIncreaseRequestActor as SpendLimitIncreaseRequestActor,
    type SpendLimitIncreaseRequestResolvedBy as SpendLimitIncreaseRequestResolvedBy,
    type SpendLimitIncreaseRequestStatus as SpendLimitIncreaseRequestStatus,
    type IncreaseRequestApproveResponse as IncreaseRequestApproveResponse,
    type SpendLimitIncreaseRequestsPageCursor as SpendLimitIncreaseRequestsPageCursor,
    type IncreaseRequestListParams as IncreaseRequestListParams,
    type IncreaseRequestApproveParams as IncreaseRequestApproveParams,
    type IncreaseRequestDenyParams as IncreaseRequestDenyParams,
  };
}
