import { APIResource } from '../../../../core/resource';
import * as EffectiveAPI from './effective';
import { Effective, EffectiveListParams } from './effective';
import * as IncreaseRequestsAPI from './increase-requests';
import {
  BetaSpendLimitIncreaseRequest,
  BetaSpendLimitIncreaseRequestStatus,
  BetaSpendLimitIncreaseRequestsPageCursor,
  IncreaseRequestApproveParams,
  IncreaseRequestApproveResponse,
  IncreaseRequestDenyParams,
  IncreaseRequestListParams,
  IncreaseRequests,
} from './increase-requests';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class SpendLimits extends APIResource {
  effective: EffectiveAPI.Effective = new EffectiveAPI.Effective(this._client);
  increaseRequests: IncreaseRequestsAPI.IncreaseRequests = new IncreaseRequestsAPI.IncreaseRequests(
    this._client,
  );

  /**
   * Retrieve a spend limit by ID.
   *
   * @example
   * ```ts
   * const betaSpendLimit =
   *   await client.beta.organization.spendLimits.retrieve(
   *     'spend_limit_id',
   *   );
   * ```
   */
  retrieve(spendLimitID: string, options?: RequestOptions): APIPromise<BetaSpendLimit> {
    return this._client.get(path`/v1/organizations/spend_limits/${spendLimitID}?beta=true`, options);
  }

  /**
   * Delete a spend limit.
   *
   * For a Claude Enterprise organization, this deletes a per-user override, and the
   * member falls back to any inherited spend limit at that period. Its seat-tier,
   * group, and organization-level rows cannot be deleted via this endpoint. A Claude
   * Console organization deletes its organization and workspace limits. Deleting
   * them through the API is in an early access preview.
   *
   * @example
   * ```ts
   * const spendLimit =
   *   await client.beta.organization.spendLimits.delete(
   *     'spend_limit_id',
   *   );
   * ```
   */
  delete(spendLimitID: string, options?: RequestOptions): APIPromise<SpendLimitDeleteResponse> {
    return this._client.delete(path`/v1/organizations/spend_limits/${spendLimitID}?beta=true`, options);
  }

  /**
   * Set a spend limit.
   *
   * Upsert keyed on (scope, period): setting a limit that already exists overwrites
   * it in place. A Claude Enterprise organization sets `user` limits. Its seat-tier,
   * group, and organization-level defaults are configured in claude.ai. A Claude
   * Console organization sets `organization` and `workspace` limits, which are
   * monthly and always carry an amount. Setting those limits is in an early access
   * preview. To request access, contact your Anthropic account team.
   *
   * @example
   * ```ts
   * const betaSpendLimit =
   *   await client.beta.organization.spendLimits.set({
   *     amount: '50000',
   *     scope: {
   *       type: 'user',
   *       user_id: 'user_01WCz1FkmYMm4gnmykNKUu3Q',
   *     },
   *   });
   * ```
   */
  set(body: SpendLimitSetParams, options?: RequestOptions): APIPromise<BetaSpendLimit> {
    return this._client.post('/v1/organizations/spend_limits?beta=true', { body, ...options });
  }
}

export type BetaSpendSummariesPageCursor = PageCursor<BetaSpendSummary>;

/**
 * A configured spend limit: a cap on metered spend for one scope and period.
 */
export interface BetaSpendLimit {
  /**
   * Unique tagged ID of the spend limit (`spl_...`).
   */
  id: string;

  /**
   * Limit amount as a non-negative integer decimal string in the minor unit of
   * `currency` (cents for USD): "50000" is $500.00. `null` means no numeric cap is
   * configured at this scope — see the effective report for whether a limit applies.
   */
  amount: string | null;

  /**
   * RFC 3339 datetime at which the spend limit was created.
   */
  created_at: string;

  /**
   * ISO 4217 code of the organization's billing currency; the unit for `amount`.
   */
  currency: string;

  /**
   * Length of the window the limit resets over. `amount` caps spend within each
   * period.
   */
  period: BetaSpendLimitPeriod;

  /**
   * What the limit applies to. A tagged union on `type`; each variant carries the
   * identifier for its scope.
   */
  scope:
    | BetaSpendLimitUserScope
    | BetaSpendLimitSeatTierScope
    | BetaSpendLimitRBACGroupScope
    | BetaSpendLimitOrganizationServiceScope
    | BetaSpendLimitOrganizationScope
    | BetaSpendLimitWorkspaceScope;

  /**
   * Object type. Always `spend_limit`.
   */
  type: 'spend_limit';

  /**
   * RFC 3339 datetime at which the spend limit was last modified.
   */
  updated_at: string;
}

export interface BetaSpendLimitOrganizationScope {
  type: 'organization';
}

export interface BetaSpendLimitOrganizationServiceScope {
  service: string;

  type: 'organization_service';
}

export type BetaSpendLimitPeriod = 'daily' | 'monthly' | 'weekly';

export interface BetaSpendLimitRBACGroupScope {
  rbac_group_id: string;

  type: 'rbac_group';
}

/**
 * A scoped Admin API key acting on behalf of the organization.
 */
export interface BetaSpendLimitScopedAPIKeyActor {
  scoped_api_key_id: string;

  type: 'scoped_api_key_actor';
}

export interface BetaSpendLimitSeatTierScope {
  seat_tier: string;

  type: 'seat_tier';
}

/**
 * A user within the organization. `name` and `email_address` are null when the
 * underlying account is unavailable or has been deleted; `deleted` is true only
 * for deleted accounts.
 */
export interface BetaSpendLimitUserActor {
  /**
   * True only when the underlying account has been deleted.
   */
  deleted: boolean;

  /**
   * The user's email address. Null when the account is unavailable or has been
   * deleted.
   */
  email_address: string | null;

  /**
   * The user's current display name. Null when the account is unavailable, has been
   * deleted, or has no name set.
   */
  name: string | null;

  /**
   * Actor type. Always `user_actor`.
   */
  type: 'user_actor';

  /**
   * Tagged ID of the user.
   */
  user_id: string;
}

/**
 * Scope selecting a single member of the organization.
 */
export interface BetaSpendLimitUserScope {
  /**
   * Scope type. Always `user` for this scope.
   */
  type: 'user';

  /**
   * Tagged ID of the member the spend limit applies to.
   */
  user_id: string;
}

/**
 * Scope selecting one workspace of a Claude Console organization.
 */
export interface BetaSpendLimitWorkspaceScope {
  /**
   * Scope type. Always `workspace` for this scope.
   */
  type: 'workspace';

  /**
   * Tagged ID of the workspace the spend limit applies to.
   */
  workspace_id: string;
}

/**
 * Per-member effective-limit report row (`GET /spend_limits/effective`).
 */
export interface BetaSpendSummary {
  actor: BetaSpendLimitUserActor | BetaSpendLimitScopedAPIKeyActor;

  /**
   * Effective limit amount as a non-negative integer decimal string in the minor
   * unit of `currency` (cents for USD). `null` means no limit applies for this row's
   * `period` — each period resolves independently, so another period may still cap
   * this member.
   */
  amount: string | null;

  /**
   * ISO 4217 code of the organization's billing currency; the unit for `amount` and
   * `period_to_date_spend`.
   */
  currency: string;

  /**
   * Period this row's effective limit and spend are reported for.
   */
  period: BetaSpendLimitPeriod;

  /**
   * The member's spend so far in the current period, as a non-negative decimal
   * string in the minor unit of `currency` (cents for USD). May carry fractional
   * minor units up to three decimal places (e.g. `"12050.5"`) — metered usage is not
   * rounded to whole cents. Reads as `"0"` when the spend reading is temporarily
   * unavailable.
   */
  period_to_date_spend: string;

  scope:
    | BetaSpendLimitUserScope
    | BetaSpendLimitSeatTierScope
    | BetaSpendLimitRBACGroupScope
    | BetaSpendLimitOrganizationServiceScope
    | BetaSpendLimitOrganizationScope
    | BetaSpendLimitWorkspaceScope;

  source:
    | BetaSpendLimitUserScope
    | BetaSpendLimitSeatTierScope
    | BetaSpendLimitRBACGroupScope
    | BetaSpendLimitOrganizationServiceScope
    | BetaSpendLimitOrganizationScope
    | BetaSpendLimitWorkspaceScope;

  spend_limit_id: string;
}

export interface SpendLimitDeleteResponse {
  id: string;

  type: 'spend_limit_deleted';
}

export interface SpendLimitSetParams {
  /**
   * Limit amount as a non-negative integer decimal string in the minor unit of the
   * organization's billing currency (cents for USD): "50000" is $500.00. `null` sets
   * an explicit no-limit override for this scope and `period` only — each period
   * resolves independently, so caps for other periods still apply.
   */
  amount: string | null;

  /**
   * What the limit applies to. Claude Enterprise organizations set `user` limits.
   * Claude Console organizations set `organization` and `workspace` limits. Any
   * other combination returns 400. Setting `organization` and `workspace` limits
   * through the API is in an early access preview. To request access, contact your
   * Anthropic account team.
   */
  scope: BetaSpendLimitUserScope | BetaSpendLimitOrganizationScope | BetaSpendLimitWorkspaceScope;

  period?: BetaSpendLimitPeriod;
}

SpendLimits.Effective = Effective;
SpendLimits.IncreaseRequests = IncreaseRequests;

export declare namespace SpendLimits {
  export {
    type BetaSpendLimit as BetaSpendLimit,
    type BetaSpendLimitOrganizationScope as BetaSpendLimitOrganizationScope,
    type BetaSpendLimitOrganizationServiceScope as BetaSpendLimitOrganizationServiceScope,
    type BetaSpendLimitPeriod as BetaSpendLimitPeriod,
    type BetaSpendLimitRBACGroupScope as BetaSpendLimitRBACGroupScope,
    type BetaSpendLimitScopedAPIKeyActor as BetaSpendLimitScopedAPIKeyActor,
    type BetaSpendLimitSeatTierScope as BetaSpendLimitSeatTierScope,
    type BetaSpendLimitUserActor as BetaSpendLimitUserActor,
    type BetaSpendLimitUserScope as BetaSpendLimitUserScope,
    type BetaSpendLimitWorkspaceScope as BetaSpendLimitWorkspaceScope,
    type BetaSpendSummary as BetaSpendSummary,
    type SpendLimitDeleteResponse as SpendLimitDeleteResponse,
    type SpendLimitSetParams as SpendLimitSetParams,
  };

  export { Effective as Effective, type EffectiveListParams as EffectiveListParams };

  export {
    IncreaseRequests as IncreaseRequests,
    type BetaSpendLimitIncreaseRequest as BetaSpendLimitIncreaseRequest,
    type BetaSpendLimitIncreaseRequestStatus as BetaSpendLimitIncreaseRequestStatus,
    type IncreaseRequestApproveResponse as IncreaseRequestApproveResponse,
    type BetaSpendLimitIncreaseRequestsPageCursor as BetaSpendLimitIncreaseRequestsPageCursor,
    type IncreaseRequestListParams as IncreaseRequestListParams,
    type IncreaseRequestApproveParams as IncreaseRequestApproveParams,
    type IncreaseRequestDenyParams as IncreaseRequestDenyParams,
  };
}
