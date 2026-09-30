import { APIResource } from '../../../core/resource';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

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
   * const federationIssuer =
   *   await client.organization.federation.issuers.create({
   *     issuer_url: 'x',
   *     name: 'x',
   *   });
   * ```
   */
  create(body: IssuerCreateParams, options?: RequestOptions): APIPromise<FederationIssuer> {
    return this._client.post('/v1/organizations/federation_issuers', { body, ...options });
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
   * const federationIssuer =
   *   await client.organization.federation.issuers.retrieve(
   *     'federation_issuer_id',
   *   );
   * ```
   */
  retrieve(federationIssuerID: string, options?: RequestOptions): APIPromise<FederationIssuer> {
    return this._client.get(path`/v1/organizations/federation_issuers/${federationIssuerID}`, options);
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
   * const federationIssuer =
   *   await client.organization.federation.issuers.update(
   *     'federation_issuer_id',
   *   );
   * ```
   */
  update(
    federationIssuerID: string,
    body: IssuerUpdateParams,
    options?: RequestOptions,
  ): APIPromise<FederationIssuer> {
    return this._client.post(path`/v1/organizations/federation_issuers/${federationIssuerID}`, {
      body,
      ...options,
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
   * for await (const federationIssuer of client.organization.federation.issuers.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: IssuerListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<FederationIssuersPageCursor, FederationIssuer> {
    return this._client.getAPIList('/v1/organizations/federation_issuers', PageCursor<FederationIssuer>, {
      query,
      ...options,
    });
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
   * const federationIssuer =
   *   await client.organization.federation.issuers.archive(
   *     'federation_issuer_id',
   *   );
   * ```
   */
  archive(federationIssuerID: string, options?: RequestOptions): APIPromise<FederationIssuer> {
    return this._client.post(
      path`/v1/organizations/federation_issuers/${federationIssuerID}/archive`,
      options,
    );
  }
}

export type FederationIssuersPageCursor = PageCursor<FederationIssuer>;

/**
 * Registered external OIDC identity provider.
 *
 * Records an external IdP the organization trusts for the RFC 7523 jwt-bearer
 * grant. The `issuer_url` must match the JWT `iss` claim exactly.
 */
export interface FederationIssuer {
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
  jwks: JWKSDiscovery | JWKSExplicitURL | JWKSInline;

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
   * Live state of Anthropic's JWKS polling for this issuer. Populated on both
   * single-issuer retrieval and list responses, including archived issuers.
   * Typically null for inline-key issuers (no polling), or when poll status is
   * temporarily unavailable or polling has not started yet.
   */
  poll_status: FederationIssuerPollStatus | null;

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
export interface FederationIssuerPollStatus {
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
export interface JWKSDiscovery {
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
export interface JWKSExplicitURL {
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
export interface JWKSInline {
  /**
   * Inline JWK objects.
   */
  keys: Array<{ [key: string]: unknown }>;

  type: 'inline';
}

export interface IssuerCreateParams {
  /**
   * The `iss` claim value to match against.
   */
  issuer_url: string;

  /**
   * Slug identifier (lowercase, digits, hyphens). Unique within the organization; a
   * duplicate name returns 409.
   */
  name: string;

  /**
   * Whether the jwt-bearer exchange enforces JTI single-use (replay protection) for
   * tokens from this issuer. Defaults to true. Applies only to assertions carrying a
   * `jti` claim; tokens without one are accepted without single-use enforcement.
   */
  check_jti?: boolean | null;

  /**
   * How signing keys are obtained. Defaults to OIDC discovery.
   */
  jwks?: JWKSDiscovery | JWKSExplicitURL | JWKSInline;

  /**
   * Maximum allowed iat→exp spread for assertions from this issuer (1-176400
   * seconds, i.e. up to 49h). Defaults to 3600 (1h). Assertions must carry both
   * `iat` and `exp`; a missing `iat` is rejected.
   */
  max_jwt_lifetime_seconds?: number | null;
}

export interface IssuerUpdateParams {
  /**
   * Whether the jwt-bearer exchange enforces JTI single-use (replay protection) for
   * tokens from this issuer. Applies only to assertions carrying a `jti` claim;
   * tokens without one are accepted without single-use enforcement.
   */
  check_jti?: boolean | null;

  /**
   * Replaces the `iss` claim value to match against. For discovery-mode issuers
   * without a `discovery_base`, this is also the URL Anthropic fetches the OIDC
   * discovery document and signing keys from, so changing it repoints the JWKS
   * source. Changing the issuer URL to a well-known shared platform is rejected
   * while any live rule under this issuer would not constrain tenant identity.
   */
  issuer_url?: string | null;

  /**
   * Replaces the entire JWKS configuration.
   */
  jwks?: JWKSDiscovery | JWKSExplicitURL | JWKSInline | null;

  /**
   * Only `false` is accepted, to re-enable polling after the system pauses it.
   * Polling is paused automatically; sending `true` is rejected.
   */
  jwks_polling_disabled?: boolean | null;

  /**
   * Maximum allowed iat→exp spread for assertions from this issuer (1-176400
   * seconds, i.e. up to 49h). Assertions must carry both `iat` and `exp`; a missing
   * `iat` is rejected.
   */
  max_jwt_lifetime_seconds?: number | null;

  /**
   * Replaces the slug identifier (lowercase, digits, hyphens). Unique within the
   * organization; a duplicate name returns 409.
   */
  name?: string | null;
}

export interface IssuerListParams extends PageCursorParams {
  /**
   * Include archived resources. Defaults to false.
   */
  include_archived?: boolean;
}

export declare namespace Issuers {
  export {
    type FederationIssuer as FederationIssuer,
    type FederationIssuerPollStatus as FederationIssuerPollStatus,
    type JWKSDiscovery as JWKSDiscovery,
    type JWKSExplicitURL as JWKSExplicitURL,
    type JWKSInline as JWKSInline,
    type FederationIssuersPageCursor as FederationIssuersPageCursor,
    type IssuerCreateParams as IssuerCreateParams,
    type IssuerUpdateParams as IssuerUpdateParams,
    type IssuerListParams as IssuerListParams,
  };
}
