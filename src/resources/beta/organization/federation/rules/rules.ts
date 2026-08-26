// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../core/resource';
import * as BetaAPI from '../../../beta';
import * as WorkspacesAPI from './workspaces';
import {
  WorkspaceAddParams,
  WorkspaceListParams,
  WorkspaceRemoveParams,
  WorkspaceRemoveResponse,
  Workspaces,
} from './workspaces';
import { APIPromise } from '../../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../../core/pagination';
import { buildHeaders } from '../../../../../internal/headers';
import { RequestOptions } from '../../../../../internal/request-options';
import { path } from '../../../../../internal/utils/path';

export class Rules extends APIResource {
  workspaces: WorkspacesAPI.Workspaces = new WorkspacesAPI.Workspaces(this._client);

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Create a federation rule owned by your organization.
   *
   * The referenced issuer and the target service account must already exist in the
   * same organization; invalid references are rejected with a 400 error. The
   * workspace reference is validated. Membership is not checked at rule creation:
   * token exchange resolves a single enabled workspace per call and is rejected
   * unless the target service account is a member of that workspace (it is
   * implicitly a member of the default workspace). Rules on well-known shared
   * issuers (GitHub Actions, GitLab, Buildkite, Terraform Cloud, Google) must
   * constrain tenant identity via an identity-bearing claim, a tenant-pinning
   * subject prefix (such as `repo:YOUR_ORG/...`), or a CEL condition referencing one
   * of those identity claims (e.g. `claims.repository_owner`). OAuth callers may
   * only manage rules whose `oauth_scope` is `workspace:developer` or
   * `workspace:inference`; other scopes require a Console session.
   *
   * @example
   * ```ts
   * const betaFederationRule =
   *   await client.beta.organization.federation.rules.create({
   *     issuer_id: 'issuer_id',
   *     match: {},
   *     name: 'x',
   *     oauth_scope: 'x',
   *     target: {
   *       service_account_id: 'svac_01SDCCSbTxrXDpWc1phhtcfK',
   *       type: 'service_account',
   *     },
   *   });
   * ```
   */
  create(params: RuleCreateParams, options?: RequestOptions): APIPromise<BetaFederationRule> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/federation_rules?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Retrieve a federation rule by its ID (`fdrl_...`).
   *
   * @example
   * ```ts
   * const betaFederationRule =
   *   await client.beta.organization.federation.rules.retrieve(
   *     'federation_rule_id',
   *   );
   * ```
   */
  retrieve(
    federationRuleID: string,
    params: RuleRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaFederationRule> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/organizations/federation_rules/${federationRuleID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Partially update a federation rule.
   *
   * `issuer_id` is immutable. `match` and `target` are replaced as whole objects
   * when set. Referenced service accounts and workspaces must exist in your
   * organization; invalid references are rejected with a 400 error. Archived rules
   * cannot be updated; this returns 400. Create a new rule instead. Rules on
   * well-known shared issuers (GitHub Actions, GitLab, Buildkite, Terraform Cloud,
   * Google) must constrain tenant identity via an identity-bearing claim, a
   * tenant-pinning subject prefix (such as `repo:YOUR_ORG/...`), or a CEL condition
   * referencing one of those identity claims (e.g. `claims.repository_owner`). On
   * these issuers the requirement is re-checked on every update; if an existing
   * rule's stored match does not yet constrain tenant identity, any update (even a
   * rename or description change) must also supply a conforming `match` in the same
   * request. OAuth callers may only manage rules whose `oauth_scope` is
   * `workspace:developer` or `workspace:inference`; other scopes require a Console
   * session.
   *
   * @example
   * ```ts
   * const betaFederationRule =
   *   await client.beta.organization.federation.rules.update(
   *     'federation_rule_id',
   *   );
   * ```
   */
  update(
    federationRuleID: string,
    params: RuleUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaFederationRule> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/federation_rules/${federationRuleID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * List federation rules in your organization.
   *
   * Optionally filter by issuer with `issuer_id`. Archived rules are excluded unless
   * `include_archived=true`.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaFederationRule of client.beta.organization.federation.rules.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: RuleListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaFederationRulesPageCursor, BetaFederationRule> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      '/v1/organizations/federation_rules?beta=true',
      PageCursor<BetaFederationRule>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
          options?.headers,
        ]),
      },
    );
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Archive a federation rule.
   *
   * Token exchange through this rule stops immediately. Idempotent; re-archiving
   * returns the rule with its original `archived_at`. Archiving clears the rule's
   * workspace targeting (`workspace_id` and `workspace_ids` are emptied). Tokens
   * already minted before archive remain valid until they expire. OAuth callers may
   * only manage rules whose `oauth_scope` is `workspace:developer` or
   * `workspace:inference`; other scopes require a Console session.
   *
   * @example
   * ```ts
   * const betaFederationRule =
   *   await client.beta.organization.federation.rules.archive(
   *     'federation_rule_id',
   *   );
   * ```
   */
  archive(
    federationRuleID: string,
    params: RuleArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaFederationRule> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/organizations/federation_rules/${federationRuleID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
    });
  }
}

export type BetaFederationRulesPageCursor = PageCursor<BetaFederationRule>;

export type BetaFederationRuleWorkspacesPageCursor = PageCursor<BetaFederationRuleWorkspace>;

/**
 * Authorization rule binding an external OIDC identity to Anthropic.
 *
 * Evaluates the match conditions and mints an OAuth access token for the resolved
 * target, scoped to a single workspace where the rule is enabled (chosen by the
 * caller at exchange time when the rule is enabled for more than one). For rules
 * enabled via `workspace_ids` or `applies_to_all_workspaces`, the target service
 * account must be a member of that workspace (it is implicitly a member of the
 * default workspace); rules carrying only the legacy `workspace_id` binding do not
 * enforce this.
 */
export interface BetaFederationRule {
  /**
   * Tagged ID of the federation rule.
   */
  id: string;

  /**
   * When true, this rule is enabled for every workspace in the org (including ones
   * created after the rule). `workspace_ids` is ignored at exchange time.
   */
  applies_to_all_workspaces: boolean;

  /**
   * If set, this rule is archived and rejects token exchange.
   */
  archived_at: string | null;

  /**
   * Tagged ID (`user_`/`svac_`) of the actor that archived this rule.
   */
  archived_by_actor_id: string | null;

  /**
   * CEL expressions extracting named values from claims. Not yet supported; always
   * null.
   */
  attributes: { [key: string]: string } | null;

  /**
   * When this rule was created.
   */
  created_at: string;

  /**
   * Tagged ID (`user_`/`svac_`) of the actor that created this rule.
   */
  created_by_actor_id: string | null;

  /**
   * Optional free-text description.
   */
  description: string | null;

  /**
   * Tagged ID of the issuer whose tokens this rule accepts.
   */
  issuer_id: string;

  /**
   * Issuer's display name at read time.
   */
  issuer_name: string | null;

  /**
   * Conditions the verified JWT must satisfy for this rule to apply. All populated
   * matcher fields must pass.
   */
  match: BetaFederationRuleMatch;

  /**
   * Admin-chosen slug identifier.
   */
  name: string;

  /**
   * Space-separated OAuth scopes granted on the minted token.
   */
  oauth_scope: string;

  /**
   * Identity that tokens minted via this rule act as. Currently always a
   * `service_account` target.
   */
  target: BetaServiceAccountTarget;

  /**
   * Lifetime in seconds of access tokens minted via this rule. Minted tokens are
   * capped at `max(60, min(this value, 2 × remaining assertion validity))` seconds.
   */
  token_lifetime_seconds: number;

  type: 'federation_rule';

  /**
   * When this rule was last updated.
   */
  updated_at: string;

  /**
   * Tagged ID (`user_`/`svac_`) of the actor that last updated this rule.
   */
  updated_by_actor_id: string | null;

  /**
   * Legacy single-workspace binding. Prefer `workspace_ids` and the
   * `/federation_rules/{federation_rule_id}/workspaces` sub-resource for managing
   * workspace enablement.
   */
  workspace_id: string | null;

  /**
   * Tagged IDs of the workspaces this rule is enabled for. May be empty for older
   * rules that only carry the legacy `workspace_id` binding. Ignored at exchange
   * time when `applies_to_all_workspaces` is true (the list may still be non-empty).
   */
  workspace_ids: Array<string>;
}

/**
 * Does the incoming JWT qualify?
 *
 * All populated fields must pass; omitted fields are skipped. At least one of
 * `subject_prefix` (other than a wildcard-only value like `*`), `claims`, or
 * `condition` is required; `audience` alone is not sufficient.
 */
export interface BetaFederationRuleMatch {
  /**
   * Exact match against the `aud` claim (any element if array). When omitted, the
   * JWT's `aud` must still equal Anthropic's expected audience for the issuer;
   * setting this field overrides that default.
   */
  audience?: string | null;

  /**
   * Exact-match `{claim: value}` pairs against top-level claims. Only string-valued
   * claims can be matched; use `condition` for non-string claims.
   */
  claims?: { [key: string]: string } | null;

  /**
   * CEL expression over claims for logic the structural fields can't express. Must
   * evaluate to a boolean and may reference only the `claims` variable; a
   * constant-true expression (such as `true`) is rejected with 400.
   */
  condition?: string | null;

  /**
   * Match the verified JWT `sub` claim. Exact match unless the value ends with `*`,
   * in which case it is a prefix match. Example:
   * `repo:my-org/my-repo:ref:refs/heads/main`.
   */
  subject_prefix?: string | null;
}

export interface BetaFederationRuleWorkspace {
  /**
   * When this workspace was enabled for the rule.
   */
  created_at: string;

  /**
   * Tagged ID (`user_...` or `svac_...`) of the actor that enabled this workspace
   * for the rule, if known.
   */
  created_by_actor_id: string | null;

  /**
   * Tagged ID of the federation rule.
   */
  federation_rule_id: string;

  type: 'federation_rule_workspace';

  /**
   * Tagged ID of the workspace this rule is enabled for.
   */
  workspace_id: string;

  /**
   * Workspace display name. Populated when listing; null in the enable response.
   */
  workspace_name: string | null;
}

/**
 * Bind to a fixed service account by ID.
 */
export interface BetaServiceAccountTarget {
  /**
   * Tagged ID of the service account to mint tokens for.
   */
  service_account_id: string;

  type: 'service_account';

  /**
   * Service account's display name at read time. Ignored on writes.
   */
  service_account_name?: string | null;
}

export interface RuleCreateParams {
  /**
   * Body param: Tagged ID of the federation issuer.
   */
  issuer_id: string;

  /**
   * Body param: Conditions the verified JWT must satisfy for this rule to apply. At
   * least one of `subject_prefix` (other than a wildcard-only value like `*`),
   * `claims`, or `condition` is required; `audience` alone is not sufficient.
   */
  match: BetaFederationRuleMatch;

  /**
   * Body param: Slug identifier (lowercase, digits, hyphens). Unique within the
   * organization; a duplicate name returns 409.
   */
  name: string;

  /**
   * Body param: Space-separated OAuth scopes. OAuth callers may only set
   * `workspace:developer` or `workspace:inference`; other scopes (such as
   * `org:admin`) require a Console session.
   */
  oauth_scope: string;

  /**
   * Body param: Identity that tokens minted via this rule act as. Currently always a
   * `service_account` target.
   */
  target: BetaServiceAccountTarget;

  /**
   * Body param: When true, enable this rule for every workspace in the org
   * (including workspaces created later).
   */
  applies_to_all_workspaces?: boolean;

  /**
   * Body param: CEL expressions `{name: expr}` extracting named values from claims.
   * Not yet supported; any non-empty value is rejected with 400.
   */
  attributes?: { [key: string]: string } | null;

  /**
   * Body param: Optional free-text description.
   */
  description?: string | null;

  /**
   * Body param: Lifetime in seconds for access tokens minted via this rule
   * (60-86400). Defaults to 3600 (1h). Minted tokens are capped at
   * `max(60, min(this value, 2 × remaining assertion validity))` seconds.
   */
  token_lifetime_seconds?: number;

  /**
   * Body param: Tagged ID of the workspace to enable this rule for. Required unless
   * `applies_to_all_workspaces` is true. Additional workspaces can be added via the
   * `/federation_rules/{federation_rule_id}/workspaces` sub-resource.
   */
  workspace_id?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface RuleRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface RuleUpdateParams {
  /**
   * Body param: When true, enables this rule for every workspace in the org
   * (including workspaces created later). Setting `false` is rejected with 400 if no
   * workspace would remain enabled; a rule with only a legacy `workspace_id` binding
   * continues to mint.
   */
  applies_to_all_workspaces?: boolean | null;

  /**
   * Body param: Replaces the CEL expressions `{name: expr}` extracting named values
   * from claims. Send null to clear them. Not yet supported; any non-empty value is
   * rejected with 400.
   */
  attributes?: { [key: string]: string } | null;

  /**
   * Body param: Replaces the description. Omit to leave unchanged; send `null` to
   * clear (the field is stored as an empty string).
   */
  description?: string | null;

  /**
   * Body param: Does the incoming JWT qualify?
   *
   * All populated fields must pass; omitted fields are skipped. At least one of
   * `subject_prefix` (other than a wildcard-only value like `*`), `claims`, or
   * `condition` is required; `audience` alone is not sufficient.
   */
  match?: BetaFederationRuleMatch | null;

  /**
   * Body param: Replaces the slug identifier (lowercase, digits, hyphens). Unique
   * within the organization; a duplicate name returns 409.
   */
  name?: string | null;

  /**
   * Body param: Replaces the space-separated OAuth scopes granted on minted tokens.
   * OAuth callers may only set `workspace:developer` or `workspace:inference`; other
   * scopes (such as `org:admin`) require a Console session.
   */
  oauth_scope?: string | null;

  /**
   * Body param: Bind to a fixed service account by ID.
   */
  target?: BetaServiceAccountTarget | null;

  /**
   * Body param: Replaces the lifetime in seconds for access tokens minted via this
   * rule (60-86400). Minted tokens are capped at
   * `max(60, min(this value, 2 × remaining assertion validity))` seconds.
   */
  token_lifetime_seconds?: number | null;

  /**
   * Body param: Replaces the existing single workspace enablement (the previous one
   * is removed). Rejected with 400 if the rule is enabled for more than one
   * workspace; use the `/federation_rules/{federation_rule_id}/workspaces`
   * sub-resource instead.
   */
  workspace_id?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface RuleListParams extends PageCursorParams {
  /**
   * Query param: Include archived resources. Defaults to false.
   */
  include_archived?: boolean;

  /**
   * Query param: Filter to rules referencing this federation issuer.
   */
  issuer_id?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface RuleArchiveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

Rules.Workspaces = Workspaces;

export declare namespace Rules {
  export {
    type BetaFederationRule as BetaFederationRule,
    type BetaFederationRuleMatch as BetaFederationRuleMatch,
    type BetaFederationRuleWorkspace as BetaFederationRuleWorkspace,
    type BetaServiceAccountTarget as BetaServiceAccountTarget,
    type BetaFederationRulesPageCursor as BetaFederationRulesPageCursor,
    type RuleCreateParams as RuleCreateParams,
    type RuleRetrieveParams as RuleRetrieveParams,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleListParams as RuleListParams,
    type RuleArchiveParams as RuleArchiveParams,
  };

  export {
    Workspaces as Workspaces,
    type WorkspaceRemoveResponse as WorkspaceRemoveResponse,
    type WorkspaceListParams as WorkspaceListParams,
    type WorkspaceAddParams as WorkspaceAddParams,
    type WorkspaceRemoveParams as WorkspaceRemoveParams,
  };
}
