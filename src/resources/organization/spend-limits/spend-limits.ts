import { APIResource } from '../../../core/resource';
import * as EffectiveAPI from './effective';
import { Effective, EffectiveListParams } from './effective';
import * as IncreaseRequestsAPI from './increase-requests';
import {
  IncreaseRequestApproveParams,
  IncreaseRequestApproveResponse,
  IncreaseRequestDenyParams,
  IncreaseRequestListParams,
  IncreaseRequests,
  SpendLimitIncreaseRequest,
  SpendLimitIncreaseRequestActor,
  SpendLimitIncreaseRequestResolvedBy,
  SpendLimitIncreaseRequestStatus,
  SpendLimitIncreaseRequestsPageCursor,
} from './increase-requests';
import { PageCursor } from '../../../core/pagination';

export class SpendLimits extends APIResource {
  effective: EffectiveAPI.Effective = new EffectiveAPI.Effective(this._client);
  increaseRequests: IncreaseRequestsAPI.IncreaseRequests = new IncreaseRequestsAPI.IncreaseRequests(
    this._client,
  );
}

export type SpendSummariesPageCursor = PageCursor<SpendSummary>;

/**
 * A configured spend limit: a cap on metered spend for one scope and period.
 */
export interface SpendLimit {
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
   * Read-only. `false` when extra usage is switched off for this organization
   * (`organization` limit); `amount` is kept and applies again when it's switched
   * back on. Always `true` for other limits.
   */
  is_enabled: boolean;

  /**
   * Length of the window the limit resets over. `amount` caps spend within each
   * period.
   */
  period: SpendLimitPeriod;

  /**
   * What the limit applies to. A tagged union on `type`; each variant carries the
   * identifier for its scope.
   */
  scope:
    | SpendLimitUserScope
    | SpendLimitSeatTierScope
    | SpendLimitRBACGroupScope
    | SpendLimitOrganizationServiceScope
    | SpendLimitOrganizationScope
    | SpendLimitWorkspaceScope
    | SpendLimitUsageTierScope;

  /**
   * Object type. Always `spend_limit`.
   */
  type: 'spend_limit';

  /**
   * RFC 3339 datetime at which the spend limit was last modified.
   */
  updated_at: string;
}

export interface SpendLimitOrganizationScope {
  type: 'organization';
}

export interface SpendLimitOrganizationServiceScope {
  service: string;

  type: 'organization_service';
}

export type SpendLimitPeriod = 'daily' | 'monthly' | 'weekly';

export interface SpendLimitRBACGroupScope {
  rbac_group_id: string;

  type: 'rbac_group';
}

/**
 * A scoped Admin API key acting on behalf of the organization.
 */
export interface SpendLimitScopedAPIKeyActor {
  scoped_api_key_id: string;

  type: 'scoped_api_key_actor';
}

export interface SpendLimitSeatTierScope {
  seat_tier: string;

  type: 'seat_tier';
}

/**
 * Scope of the monthly spend cap Anthropic sets for a Claude Console organization
 * from its usage tier, or a higher cap Anthropic granted the organization.
 * Read-only; its `created_at` and `updated_at` are the organization's creation
 * time, so `amount` can change while `updated_at` stays the same.
 */
export interface SpendLimitUsageTierScope {
  /**
   * Scope type. Always `usage_tier` for this scope.
   */
  type: 'usage_tier';
}

/**
 * A user within the organization. `name` and `email_address` are null when the
 * underlying account is unavailable or has been deleted; `deleted` is true only
 * for deleted accounts.
 */
export interface SpendLimitUserActor {
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
export interface SpendLimitUserScope {
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
export interface SpendLimitWorkspaceScope {
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
export interface SpendSummary {
  actor: SpendLimitUserActor | SpendLimitScopedAPIKeyActor;

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
  period: SpendLimitPeriod;

  /**
   * The member's spend so far in the current period, as a non-negative decimal
   * string in the minor unit of `currency` (cents for USD). May carry fractional
   * minor units up to three decimal places (e.g. `"12050.5"`) — metered usage is not
   * rounded to whole cents. Reads as `"0"` when the spend reading is temporarily
   * unavailable.
   */
  period_to_date_spend: string;

  scope:
    | SpendLimitUserScope
    | SpendLimitSeatTierScope
    | SpendLimitRBACGroupScope
    | SpendLimitOrganizationServiceScope
    | SpendLimitOrganizationScope
    | SpendLimitWorkspaceScope
    | SpendLimitUsageTierScope;

  source:
    | SpendLimitUserScope
    | SpendLimitSeatTierScope
    | SpendLimitRBACGroupScope
    | SpendLimitOrganizationServiceScope
    | SpendLimitOrganizationScope
    | SpendLimitWorkspaceScope
    | SpendLimitUsageTierScope;

  spend_limit_id: string;
}

SpendLimits.Effective = Effective;
SpendLimits.IncreaseRequests = IncreaseRequests;

export declare namespace SpendLimits {
  export {
    type SpendLimit as SpendLimit,
    type SpendLimitOrganizationScope as SpendLimitOrganizationScope,
    type SpendLimitOrganizationServiceScope as SpendLimitOrganizationServiceScope,
    type SpendLimitPeriod as SpendLimitPeriod,
    type SpendLimitRBACGroupScope as SpendLimitRBACGroupScope,
    type SpendLimitScopedAPIKeyActor as SpendLimitScopedAPIKeyActor,
    type SpendLimitSeatTierScope as SpendLimitSeatTierScope,
    type SpendLimitUsageTierScope as SpendLimitUsageTierScope,
    type SpendLimitUserActor as SpendLimitUserActor,
    type SpendLimitUserScope as SpendLimitUserScope,
    type SpendLimitWorkspaceScope as SpendLimitWorkspaceScope,
    type SpendSummary as SpendSummary,
  };

  export { Effective as Effective, type EffectiveListParams as EffectiveListParams };

  export {
    IncreaseRequests as IncreaseRequests,
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
