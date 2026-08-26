// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class Issuers extends APIResource {
  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Register an OIDC issuer that Anthropic will trust for workload identity
   * federation in your organization.
   *
   * The `jwks` field controls how the issuer's signing keys are obtained and takes
   * one of three shapes selected by `type`: `discovery` (resolve keys through OIDC
   * discovery), `explicit_url` (fetch keys from a fixed JWKS URL), or `inline`
   * (provide a static key set). When `jwks.type` is `discovery` and no
   * `discovery_base` is set, the issuer URL must be publicly reachable over HTTPS so
   * Anthropic can fetch the discovery document; for `explicit_url` and `inline`
   * modes the issuer URL is only matched as the JWT's `iss` claim and is not
   * fetched.
   *
   * @example
   * ```ts
   * const betaFederationIssuer =
   *   await client.beta.organization.federation.issuers.create({
   *     issuer_url: 'x',
   *     name: 'x',
   *   });
   * ```
   */
  create(params: IssuerCreateParams, options?: RequestOptions): APIPromise<BetaFederationIssuer> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/federation_issuers?beta=true', {
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
   * Retrieve a federation issuer by its ID (`fdis_...`).
   *
   * @example
   * ```ts
   * const betaFederationIssuer =
   *   await client.beta.organization.federation.issuers.retrieve(
   *     'federation_issuer_id',
   *   );
   * ```
   */
  retrieve(
    federationIssuerID: string,
    params: IssuerRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaFederationIssuer> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/organizations/federation_issuers/${federationIssuerID}?beta=true`, {
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
   * Partially update a federation issuer.
   *
   * Setting `jwks` replaces the full JWKS shape at once. Archived issuers cannot be
   * updated; this returns 400. Create a new issuer instead.
   *
   * Updating an issuer that backs a rule with a scope outside `workspace:developer`
   * or `workspace:inference` requires a Console session.
   *
   * @example
   * ```ts
   * const betaFederationIssuer =
   *   await client.beta.organization.federation.issuers.update(
   *     'federation_issuer_id',
   *   );
   * ```
   */
  update(
    federationIssuerID: string,
    params: IssuerUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaFederationIssuer> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/federation_issuers/${federationIssuerID}?beta=true`, {
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
   * List federation issuers in your organization.
   *
   * Archived issuers are excluded unless `include_archived=true`.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaFederationIssuer of client.beta.organization.federation.issuers.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: IssuerListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaFederationIssuersPageCursor, BetaFederationIssuer> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      '/v1/organizations/federation_issuers?beta=true',
      PageCursor<BetaFederationIssuer>,
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
   * Archive a federation issuer.
   *
   * Idempotent; re-archiving returns the issuer with its original `archived_at`.
   * Rejected with 400 if any live (non-archived) federation rule still references
   * the issuer; archive those rules first (a rule's issuer cannot be changed), or
   * recreate them against another issuer.
   *
   * @example
   * ```ts
   * const betaFederationIssuer =
   *   await client.beta.organization.federation.issuers.archive(
   *     'federation_issuer_id',
   *   );
   * ```
   */
  archive(
    federationIssuerID: string,
    params: IssuerArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaFederationIssuer> {
    const { betas } = params ?? {};
    return this._client.post(
      path`/v1/organizations/federation_issuers/${federationIssuerID}/archive?beta=true`,
      {
        ...options,
        headers: buildHeaders([
          { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
          options?.headers,
        ]),
      },
    );
  }
}

export type BetaFederationIssuersPageCursor = PageCursor<BetaFederationIssuer>;

/**
 * Registered external OIDC identity provider.
 *
 * Records an external IdP the organization trusts for the RFC 7523 jwt-bearer
 * grant. The `issuer_url` must match the JWT `iss` claim exactly.
 */
export interface BetaFederationIssuer {
  /**
   * Tagged ID of the federation issuer.
   */
  id: string;

  /**
   * If set, all rules referencing this issuer reject token exchange.
   */
  archived_at: string | null;

  /**
   * Tagged ID (`user_`/`svac_`) of the actor that archived this issuer.
   */
  archived_by_actor_id: string | null;

  /**
   * Whether the jwt-bearer exchange enforces JTI single-use (replay protection) for
   * tokens from this issuer. Applies only to assertions carrying a `jti` claim;
   * tokens without one are accepted without single-use enforcement.
   */
  check_jti: boolean;

  /**
   * When this issuer was created.
   */
  created_at: string;

  /**
   * Tagged ID (`user_`/`svac_`) of the actor that created this issuer.
   */
  created_by_actor_id: string | null;

  /**
   * The `iss` claim value. Incoming JWTs must match exactly.
   */
  issuer_url: string;

  /**
   * How signing keys are obtained for signature verification.
   */
  jwks: BetaJWKSDiscovery | BetaJWKSExplicitURL | BetaJWKSInline;

  /**
   * If set, Anthropic's JWKS poller has paused polling for this issuer after
   * repeated fetch failures. Re-enable by sending `jwks_polling_disabled: false` via
   * the issuer update endpoint (POST) once the upstream JWKS endpoint is fixed. An
   * OAuth caller cannot send this when the issuer backs a rule with any scope other
   * than `workspace:developer` or `workspace:inference`; use a Console session.
   */
  jwks_polling_disabled_at: string | null;

  /**
   * Maximum allowed iat→exp spread for assertions from this issuer (1-176400
   * seconds, i.e. up to 49h). Assertions must carry both `iat` and `exp`; a missing
   * `iat` is rejected.
   */
  max_jwt_lifetime_seconds: number;

  /**
   * Admin-chosen slug identifier.
   */
  name: string;

  /**
   * Status of automatic JWKS polling for a federation issuer.
   *
   * Anthropic periodically fetches the issuer's signing keys in the background.
   * These fields summarize the most recent fetches so the health of the JWKS
   * endpoint can be monitored.
   */
  poll_status: BetaFederationIssuerPollStatus | null;

  type: 'federation_issuer';

  /**
   * When this issuer was last updated.
   */
  updated_at: string;

  /**
   * Tagged ID (`user_`/`svac_`) of the actor that last updated this issuer.
   */
  updated_by_actor_id: string | null;
}

/**
 * Status of automatic JWKS polling for a federation issuer.
 *
 * Anthropic periodically fetches the issuer's signing keys in the background.
 * These fields summarize the most recent fetches so the health of the JWKS
 * endpoint can be monitored.
 */
export interface BetaFederationIssuerPollStatus {
  /**
   * Consecutive fetch failures since the last success.
   */
  consecutive_failures: number;

  /**
   * When the last successful fetch completed.
   */
  last_fetched_at: string | null;

  /**
   * When the next fetch is scheduled. Null if paused.
   */
  next_poll_at: string | null;
}

/**
 * JWKS via the issuer's OIDC discovery document.
 */
export interface BetaJWKSDiscovery {
  type: 'discovery';

  /**
   * Optional custom CA (PEM) for TLS verification of the JWKS fetch.
   */
  ca_cert_pem?: string | null;

  /**
   * Set when the discovery URL differs from `issuer_url`.
   */
  discovery_base?: string | null;
}

/**
 * JWKS fetched from a fixed endpoint.
 */
export interface BetaJWKSExplicitURL {
  type: 'explicit_url';

  /**
   * JWKS endpoint.
   */
  url: string;

  /**
   * Optional custom CA (PEM) for TLS verification of the JWKS fetch.
   */
  ca_cert_pem?: string | null;
}

/**
 * JWKS supplied directly; no network fetch.
 */
export interface BetaJWKSInline {
  /**
   * Inline JWK objects.
   */
  keys: Array<{ [key: string]: unknown }>;

  type: 'inline';
}

export interface IssuerCreateParams {
  /**
   * Body param: The `iss` claim value to match against.
   */
  issuer_url: string;

  /**
   * Body param: Slug identifier (lowercase, digits, hyphens). Unique within the
   * organization; a duplicate name returns 409.
   */
  name: string;

  /**
   * Body param: Whether the jwt-bearer exchange enforces JTI single-use (replay
   * protection) for tokens from this issuer. Defaults to true. Applies only to
   * assertions carrying a `jti` claim; tokens without one are accepted without
   * single-use enforcement.
   */
  check_jti?: boolean | null;

  /**
   * Body param: How signing keys are obtained. Defaults to OIDC discovery.
   */
  jwks?: BetaJWKSDiscovery | BetaJWKSExplicitURL | BetaJWKSInline;

  /**
   * Body param: Maximum allowed iat→exp spread for assertions from this issuer
   * (1-176400 seconds, i.e. up to 49h). Defaults to 3600 (1h). Assertions must carry
   * both `iat` and `exp`; a missing `iat` is rejected.
   */
  max_jwt_lifetime_seconds?: number | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface IssuerRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface IssuerUpdateParams {
  /**
   * Body param: Whether the jwt-bearer exchange enforces JTI single-use (replay
   * protection) for tokens from this issuer. Applies only to assertions carrying a
   * `jti` claim; tokens without one are accepted without single-use enforcement.
   */
  check_jti?: boolean | null;

  /**
   * Body param: Replaces the `iss` claim value to match against. For discovery-mode
   * issuers without a `discovery_base`, this is also the URL Anthropic fetches the
   * OIDC discovery document and signing keys from, so changing it repoints the JWKS
   * source. Changing the issuer URL to a well-known shared platform is rejected
   * while any live rule under this issuer would not constrain tenant identity.
   */
  issuer_url?: string | null;

  /**
   * Body param: Replaces the entire JWKS configuration.
   */
  jwks?: BetaJWKSDiscovery | BetaJWKSExplicitURL | BetaJWKSInline | null;

  /**
   * Body param: Only `false` is accepted, to re-enable polling after the system
   * pauses it. Polling is paused automatically; sending `true` is rejected.
   */
  jwks_polling_disabled?: boolean | null;

  /**
   * Body param: Maximum allowed iat→exp spread for assertions from this issuer
   * (1-176400 seconds, i.e. up to 49h). Assertions must carry both `iat` and `exp`;
   * a missing `iat` is rejected.
   */
  max_jwt_lifetime_seconds?: number | null;

  /**
   * Body param: Replaces the slug identifier (lowercase, digits, hyphens). Unique
   * within the organization; a duplicate name returns 409.
   */
  name?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface IssuerListParams extends PageCursorParams {
  /**
   * Query param: Include archived resources. Defaults to false.
   */
  include_archived?: boolean;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface IssuerArchiveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Issuers {
  export {
    type BetaFederationIssuer as BetaFederationIssuer,
    type BetaFederationIssuerPollStatus as BetaFederationIssuerPollStatus,
    type BetaJWKSDiscovery as BetaJWKSDiscovery,
    type BetaJWKSExplicitURL as BetaJWKSExplicitURL,
    type BetaJWKSInline as BetaJWKSInline,
    type BetaFederationIssuersPageCursor as BetaFederationIssuersPageCursor,
    type IssuerCreateParams as IssuerCreateParams,
    type IssuerRetrieveParams as IssuerRetrieveParams,
    type IssuerUpdateParams as IssuerUpdateParams,
    type IssuerListParams as IssuerListParams,
    type IssuerArchiveParams as IssuerArchiveParams,
  };
}
