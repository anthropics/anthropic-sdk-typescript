import { APIResource } from '../../../../core/resource';
import * as SpendLimitsAPI from './spend-limits';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class IncreaseRequests extends APIResource {
  /**
   * Retrieve a spend limit increase request.
   *
   * While `pending`, the response includes a live `spend_summary` for the requester
   * at the request's period.
   *
   * @example
   * ```ts
   * const betaSpendLimitIncreaseRequest =
   *   await client.beta.organization.spendLimits.increaseRequests.retrieve(
   *     'spend_limit_increase_request_id',
   *   );
   * ```
   */
  retrieve(
    spendLimitIncreaseRequestID: string,
    options?: RequestOptions,
  ): APIPromise<BetaSpendLimitIncreaseRequest> {
    return this._client.get(
      path`/v1/organizations/spend_limit_increase_requests/${spendLimitIncreaseRequestID}?beta=true`,
      options,
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
   * for await (const betaSpendLimitIncreaseRequest of client.beta.organization.spendLimits.increaseRequests.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: IncreaseRequestListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaSpendLimitIncreaseRequestsPageCursor, BetaSpendLimitIncreaseRequest> {
    return this._client.getAPIList(
      '/v1/organizations/spend_limit_increase_requests?beta=true',
      PageCursor<BetaSpendLimitIncreaseRequest>,
      { query, ...options },
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
   *   await client.beta.organization.spendLimits.increaseRequests.approve(
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
      path`/v1/organizations/spend_limit_increase_requests/${spendLimitIncreaseRequestID}/approve?beta=true`,
      { body, ...options },
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
   * const betaSpendLimitIncreaseRequest =
   *   await client.beta.organization.spendLimits.increaseRequests.deny(
   *     'spend_limit_increase_request_id',
   *   );
   * ```
   */
  deny(
    spendLimitIncreaseRequestID: string,
    body: IncreaseRequestDenyParams,
    options?: RequestOptions,
  ): APIPromise<BetaSpendLimitIncreaseRequest> {
    return this._client.post(
      path`/v1/organizations/spend_limit_increase_requests/${spendLimitIncreaseRequestID}/deny?beta=true`,
      { body, ...options },
    );
  }
}

export type BetaSpendLimitIncreaseRequestsPageCursor = PageCursor<BetaSpendLimitIncreaseRequest>;

export interface BetaSpendLimitIncreaseRequest {
  id: string;

  actor: SpendLimitsAPI.BetaSpendLimitUserActor | SpendLimitsAPI.BetaSpendLimitScopedAPIKeyActor;

  created_at: string;

  period: SpendLimitsAPI.BetaSpendLimitPeriod;

  resolved_at: string | null;

  resolved_by: SpendLimitsAPI.BetaSpendLimitUserActor | SpendLimitsAPI.BetaSpendLimitScopedAPIKeyActor | null;

  /**
   * Per-member effective-limit report row (`GET /spend_limits/effective`).
   */
  spend_summary: SpendLimitsAPI.BetaSpendSummary | null;

  status: BetaSpendLimitIncreaseRequestStatus;

  type: 'spend_limit_increase_request';
}

export type BetaSpendLimitIncreaseRequestStatus = 'approved' | 'denied' | 'pending';

export interface IncreaseRequestApproveResponse {
  id: string;

  actor: SpendLimitsAPI.BetaSpendLimitUserActor | SpendLimitsAPI.BetaSpendLimitScopedAPIKeyActor;

  created_at: string;

  period: SpendLimitsAPI.BetaSpendLimitPeriod;

  resolved_at: string | null;

  resolved_by: SpendLimitsAPI.BetaSpendLimitUserActor | SpendLimitsAPI.BetaSpendLimitScopedAPIKeyActor | null;

  /**
   * A configured spend limit: a cap on metered spend for one scope and period.
   */
  spend_limit: SpendLimitsAPI.BetaSpendLimit;

  /**
   * Per-member effective-limit report row (`GET /spend_limits/effective`).
   */
  spend_summary: SpendLimitsAPI.BetaSpendSummary | null;

  status: BetaSpendLimitIncreaseRequestStatus;

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
  status?: Array<BetaSpendLimitIncreaseRequestStatus> | null;
}

export interface IncreaseRequestApproveParams {
  /**
   * New per-user spend limit as a non-negative integer decimal string (minor units).
   */
  amount: string;

  period?: SpendLimitsAPI.BetaSpendLimitPeriod | null;

  suppress_notification?: boolean;
}

export interface IncreaseRequestDenyParams {
  suppress_notification?: boolean;
}

export declare namespace IncreaseRequests {
  export {
    type BetaSpendLimitIncreaseRequest as BetaSpendLimitIncreaseRequest,
    type BetaSpendLimitIncreaseRequestStatus as BetaSpendLimitIncreaseRequestStatus,
    type IncreaseRequestApproveResponse as IncreaseRequestApproveResponse,
    type BetaSpendLimitIncreaseRequestsPageCursor as BetaSpendLimitIncreaseRequestsPageCursor,
    type IncreaseRequestListParams as IncreaseRequestListParams,
    type IncreaseRequestApproveParams as IncreaseRequestApproveParams,
    type IncreaseRequestDenyParams as IncreaseRequestDenyParams,
  };
}
