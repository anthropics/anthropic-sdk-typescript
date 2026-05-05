// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Credentials extends APIResource {
  /**
   * Create Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredential =
   *   await client.beta.vaults.credentials.create(
   *     'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   *     {
   *       auth: {
   *         token: 'bearer_exampletoken',
   *         mcp_server_url:
   *           'https://example-server.modelcontextprotocol.io/sse',
   *         type: 'static_bearer',
   *       },
   *     },
   *   );
   * ```
   */
  create(
    vaultID: string,
    params: CredentialCreateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsCredential> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/vaults/${vaultID}/credentials?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Get Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredential =
   *   await client.beta.vaults.credentials.retrieve(
   *     'vcrd_011CZkZEMt8gZan2iYOQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  retrieve(
    credentialID: string,
    params: CredentialRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsCredential> {
    const { vault_id, betas } = params;
    return this._client.get(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredential =
   *   await client.beta.vaults.credentials.update(
   *     'vcrd_011CZkZEMt8gZan2iYOQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  update(
    credentialID: string,
    params: CredentialUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsCredential> {
    const { vault_id, betas, ...body } = params;
    return this._client.post(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List Credentials
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsCredential of client.beta.vaults.credentials.list(
   *   'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    vaultID: string,
    params: CredentialListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsCredentialsPageCursor, BetaManagedAgentsCredential> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/vaults/${vaultID}/credentials?beta=true`,
      PageCursor<BetaManagedAgentsCredential>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
          options?.headers,
        ]),
      },
    );
  }

  /**
   * Delete Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeletedCredential =
   *   await client.beta.vaults.credentials.delete(
   *     'vcrd_011CZkZEMt8gZan2iYOQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  delete(
    credentialID: string,
    params: CredentialDeleteParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeletedCredential> {
    const { vault_id, betas } = params;
    return this._client.delete(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Archive Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredential =
   *   await client.beta.vaults.credentials.archive(
   *     'vcrd_011CZkZEMt8gZan2iYOQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  archive(
    credentialID: string,
    params: CredentialArchiveParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsCredential> {
    const { vault_id, betas } = params;
    return this._client.post(path`/v1/vaults/${vault_id}/credentials/${credentialID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Validate Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredentialValidation =
   *   await client.beta.vaults.credentials.mcpOAuthValidate(
   *     'vcrd_011CZkZEMt8gZan2iYOQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  mcpOAuthValidate(
    credentialID: string,
    params: CredentialMCPOAuthValidateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsCredentialValidation> {
    const { vault_id, betas } = params;
    return this._client.post(
      path`/v1/vaults/${vault_id}/credentials/${credentialID}/mcp_oauth_validate?beta=true`,
      {
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
          options?.headers,
        ]),
      },
    );
  }
}

export type BetaManagedAgentsCredentialsPageCursor = PageCursor<BetaManagedAgentsCredential>;

/**
 * A credential stored in a vault. Sensitive fields are never returned in
 * responses.
 */
export interface BetaManagedAgentsCredential {
  /**
   * Unique identifier for the credential.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  archived_at: string | null;

  /**
   * Authentication details for a credential.
   */
  auth: BetaManagedAgentsMCPOAuthAuthResponse | BetaManagedAgentsStaticBearerAuthResponse;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  /**
   * Arbitrary key-value metadata attached to the credential.
   */
  metadata: { [key: string]: string };

  type: 'vault_credential';

  /**
   * A timestamp in RFC 3339 format
   */
  updated_at: string;

  /**
   * Identifier of the vault this credential belongs to.
   */
  vault_id: string;

  /**
   * Human-readable name for the credential.
   */
  display_name?: string | null;
}

/**
 * Result of live-probing a credential against its configured MCP server.
 */
export interface BetaManagedAgentsCredentialValidation {
  /**
   * Unique identifier of the credential that was validated.
   */
  credential_id: string;

  /**
   * Whether the credential has a refresh token configured.
   */
  has_refresh_token: boolean;

  /**
   * The failing step of an MCP validation probe.
   */
  mcp_probe: BetaManagedAgentsMCPProbe | null;

  /**
   * Outcome of a refresh-token exchange attempted during credential validation.
   */
  refresh: BetaManagedAgentsRefreshObject | null;

  /**
   * Overall verdict of a credential validation probe.
   */
  status: BetaManagedAgentsCredentialValidationStatus;

  type: 'vault_credential_validation';

  /**
   * A timestamp in RFC 3339 format
   */
  validated_at: string;

  /**
   * Identifier of the vault containing the credential.
   */
  vault_id: string;
}

/**
 * Overall verdict of a credential validation probe.
 */
export type BetaManagedAgentsCredentialValidationStatus = 'valid' | 'invalid' | 'unknown';

/**
 * Confirmation of a deleted credential.
 */
export interface BetaManagedAgentsDeletedCredential {
  /**
   * Unique identifier of the deleted credential.
   */
  id: string;

  type: 'vault_credential_deleted';
}

/**
 * OAuth credential details for an MCP server.
 */
export interface BetaManagedAgentsMCPOAuthAuthResponse {
  /**
   * URL of the MCP server this credential authenticates against.
   */
  mcp_server_url: string;

  type: 'mcp_oauth';

  /**
   * A timestamp in RFC 3339 format
   */
  expires_at?: string | null;

  /**
   * OAuth refresh token configuration returned in credential responses.
   */
  refresh?: BetaManagedAgentsMCPOAuthRefreshResponse | null;
}

/**
 * Parameters for creating an MCP OAuth credential.
 */
export interface BetaManagedAgentsMCPOAuthCreateParams {
  /**
   * OAuth access token.
   */
  access_token: string;

  /**
   * URL of the MCP server this credential authenticates against.
   */
  mcp_server_url: string;

  type: 'mcp_oauth';

  /**
   * A timestamp in RFC 3339 format
   */
  expires_at?: string | null;

  /**
   * OAuth refresh token parameters for creating a credential with refresh support.
   */
  refresh?: BetaManagedAgentsMCPOAuthRefreshParams | null;
}

/**
 * OAuth refresh token parameters for creating a credential with refresh support.
 */
export interface BetaManagedAgentsMCPOAuthRefreshParams {
  /**
   * OAuth client ID.
   */
  client_id: string;

  /**
   * OAuth refresh token.
   */
  refresh_token: string;

  /**
   * Token endpoint URL used to refresh the access token.
   */
  token_endpoint: string;

  /**
   * Token endpoint requires no client authentication.
   */
  token_endpoint_auth:
    | BetaManagedAgentsTokenEndpointAuthNoneParam
    | BetaManagedAgentsTokenEndpointAuthBasicParam
    | BetaManagedAgentsTokenEndpointAuthPostParam;

  /**
   * OAuth resource indicator.
   */
  resource?: string | null;

  /**
   * OAuth scope for the refresh request.
   */
  scope?: string | null;
}

/**
 * OAuth refresh token configuration returned in credential responses.
 */
export interface BetaManagedAgentsMCPOAuthRefreshResponse {
  /**
   * OAuth client ID.
   */
  client_id: string;

  /**
   * Token endpoint URL used to refresh the access token.
   */
  token_endpoint: string;

  /**
   * Token endpoint requires no client authentication.
   */
  token_endpoint_auth:
    | BetaManagedAgentsTokenEndpointAuthNoneResponse
    | BetaManagedAgentsTokenEndpointAuthBasicResponse
    | BetaManagedAgentsTokenEndpointAuthPostResponse;

  /**
   * OAuth resource indicator.
   */
  resource?: string | null;

  /**
   * OAuth scope for the refresh request.
   */
  scope?: string | null;
}

/**
 * Parameters for updating OAuth refresh token configuration.
 */
export interface BetaManagedAgentsMCPOAuthRefreshUpdateParams {
  /**
   * Updated OAuth refresh token.
   */
  refresh_token?: string | null;

  /**
   * Updated OAuth scope for the refresh request.
   */
  scope?: string | null;

  /**
   * Updated HTTP Basic authentication parameters for the token endpoint.
   */
  token_endpoint_auth?:
    | BetaManagedAgentsTokenEndpointAuthBasicUpdateParam
    | BetaManagedAgentsTokenEndpointAuthPostUpdateParam;
}

/**
 * Parameters for updating an MCP OAuth credential. The `mcp_server_url` is
 * immutable.
 */
export interface BetaManagedAgentsMCPOAuthUpdateParams {
  type: 'mcp_oauth';

  /**
   * Updated OAuth access token.
   */
  access_token?: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  expires_at?: string | null;

  /**
   * Parameters for updating OAuth refresh token configuration.
   */
  refresh?: BetaManagedAgentsMCPOAuthRefreshUpdateParams | null;
}

/**
 * The failing step of an MCP validation probe.
 */
export interface BetaManagedAgentsMCPProbe {
  /**
   * An HTTP response captured during a credential validation probe.
   */
  http_response: BetaManagedAgentsRefreshHTTPResponse | null;

  /**
   * The MCP method that failed (for example `initialize` or `tools/list`).
   */
  method: string;
}

/**
 * An HTTP response captured during a credential validation probe.
 */
export interface BetaManagedAgentsRefreshHTTPResponse {
  /**
   * Response body. May be truncated and has sensitive values scrubbed.
   */
  body: string;

  /**
   * Whether `body` was truncated.
   */
  body_truncated: boolean;

  /**
   * Value of the `Content-Type` response header.
   */
  content_type: string;

  /**
   * HTTP status code.
   */
  status_code: number;
}

/**
 * Outcome of a refresh-token exchange attempted during credential validation.
 */
export interface BetaManagedAgentsRefreshObject {
  /**
   * An HTTP response captured during a credential validation probe.
   */
  http_response: BetaManagedAgentsRefreshHTTPResponse | null;

  /**
   * Outcome of a refresh-token exchange attempted during credential validation.
   */
  status: 'succeeded' | 'failed' | 'connect_error' | 'no_refresh_token';
}

/**
 * Static bearer token credential details for an MCP server.
 */
export interface BetaManagedAgentsStaticBearerAuthResponse {
  /**
   * URL of the MCP server this credential authenticates against.
   */
  mcp_server_url: string;

  type: 'static_bearer';
}

/**
 * Parameters for creating a static bearer token credential.
 */
export interface BetaManagedAgentsStaticBearerCreateParams {
  /**
   * Static bearer token value.
   */
  token: string;

  /**
   * URL of the MCP server this credential authenticates against.
   */
  mcp_server_url: string;

  type: 'static_bearer';
}

/**
 * Parameters for updating a static bearer token credential. The `mcp_server_url`
 * is immutable.
 */
export interface BetaManagedAgentsStaticBearerUpdateParams {
  type: 'static_bearer';

  /**
   * Updated static bearer token value.
   */
  token?: string | null;
}

/**
 * Token endpoint uses HTTP Basic authentication with client credentials.
 */
export interface BetaManagedAgentsTokenEndpointAuthBasicParam {
  /**
   * OAuth client secret.
   */
  client_secret: string;

  type: 'client_secret_basic';
}

/**
 * Token endpoint uses HTTP Basic authentication with client credentials.
 */
export interface BetaManagedAgentsTokenEndpointAuthBasicResponse {
  type: 'client_secret_basic';
}

/**
 * Updated HTTP Basic authentication parameters for the token endpoint.
 */
export interface BetaManagedAgentsTokenEndpointAuthBasicUpdateParam {
  type: 'client_secret_basic';

  /**
   * Updated OAuth client secret.
   */
  client_secret?: string | null;
}

/**
 * Token endpoint requires no client authentication.
 */
export interface BetaManagedAgentsTokenEndpointAuthNoneParam {
  type: 'none';
}

/**
 * Token endpoint requires no client authentication.
 */
export interface BetaManagedAgentsTokenEndpointAuthNoneResponse {
  type: 'none';
}

/**
 * Token endpoint uses POST body authentication with client credentials.
 */
export interface BetaManagedAgentsTokenEndpointAuthPostParam {
  /**
   * OAuth client secret.
   */
  client_secret: string;

  type: 'client_secret_post';
}

/**
 * Token endpoint uses POST body authentication with client credentials.
 */
export interface BetaManagedAgentsTokenEndpointAuthPostResponse {
  type: 'client_secret_post';
}

/**
 * Updated POST body authentication parameters for the token endpoint.
 */
export interface BetaManagedAgentsTokenEndpointAuthPostUpdateParam {
  type: 'client_secret_post';

  /**
   * Updated OAuth client secret.
   */
  client_secret?: string | null;
}

export interface CredentialCreateParams {
  /**
   * Body param: Authentication details for creating a credential.
   */
  auth: BetaManagedAgentsMCPOAuthCreateParams | BetaManagedAgentsStaticBearerCreateParams;

  /**
   * Body param: Human-readable name for the credential. Up to 255 characters.
   */
  display_name?: string | null;

  /**
   * Body param: Arbitrary key-value metadata to attach to the credential. Maximum 16
   * pairs, keys up to 64 chars, values up to 512 chars.
   */
  metadata?: { [key: string]: string };

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface CredentialRetrieveParams {
  /**
   * Path param: Path parameter vault_id
   */
  vault_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface CredentialUpdateParams {
  /**
   * Path param: Path parameter vault_id
   */
  vault_id: string;

  /**
   * Body param: Updated authentication details for a credential.
   */
  auth?: BetaManagedAgentsMCPOAuthUpdateParams | BetaManagedAgentsStaticBearerUpdateParams;

  /**
   * Body param: Updated human-readable name for the credential. 1-255 characters.
   */
  display_name?: string | null;

  /**
   * Body param: Metadata patch. Set a key to a string to upsert it, or to null to
   * delete it. Omitted keys are preserved.
   */
  metadata?: { [key: string]: string | null } | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface CredentialListParams extends PageCursorParams {
  /**
   * Query param: Whether to include archived credentials in the results.
   */
  include_archived?: boolean;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface CredentialDeleteParams {
  /**
   * Path param: Path parameter vault_id
   */
  vault_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface CredentialArchiveParams {
  /**
   * Path param: Path parameter vault_id
   */
  vault_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface CredentialMCPOAuthValidateParams {
  /**
   * Path param: Path parameter vault_id
   */
  vault_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Credentials {
  export {
    type BetaManagedAgentsCredential as BetaManagedAgentsCredential,
    type BetaManagedAgentsCredentialValidation as BetaManagedAgentsCredentialValidation,
    type BetaManagedAgentsCredentialValidationStatus as BetaManagedAgentsCredentialValidationStatus,
    type BetaManagedAgentsDeletedCredential as BetaManagedAgentsDeletedCredential,
    type BetaManagedAgentsMCPOAuthAuthResponse as BetaManagedAgentsMCPOAuthAuthResponse,
    type BetaManagedAgentsMCPOAuthCreateParams as BetaManagedAgentsMCPOAuthCreateParams,
    type BetaManagedAgentsMCPOAuthRefreshParams as BetaManagedAgentsMCPOAuthRefreshParams,
    type BetaManagedAgentsMCPOAuthRefreshResponse as BetaManagedAgentsMCPOAuthRefreshResponse,
    type BetaManagedAgentsMCPOAuthRefreshUpdateParams as BetaManagedAgentsMCPOAuthRefreshUpdateParams,
    type BetaManagedAgentsMCPOAuthUpdateParams as BetaManagedAgentsMCPOAuthUpdateParams,
    type BetaManagedAgentsMCPProbe as BetaManagedAgentsMCPProbe,
    type BetaManagedAgentsRefreshHTTPResponse as BetaManagedAgentsRefreshHTTPResponse,
    type BetaManagedAgentsRefreshObject as BetaManagedAgentsRefreshObject,
    type BetaManagedAgentsStaticBearerAuthResponse as BetaManagedAgentsStaticBearerAuthResponse,
    type BetaManagedAgentsStaticBearerCreateParams as BetaManagedAgentsStaticBearerCreateParams,
    type BetaManagedAgentsStaticBearerUpdateParams as BetaManagedAgentsStaticBearerUpdateParams,
    type BetaManagedAgentsTokenEndpointAuthBasicParam as BetaManagedAgentsTokenEndpointAuthBasicParam,
    type BetaManagedAgentsTokenEndpointAuthBasicResponse as BetaManagedAgentsTokenEndpointAuthBasicResponse,
    type BetaManagedAgentsTokenEndpointAuthBasicUpdateParam as BetaManagedAgentsTokenEndpointAuthBasicUpdateParam,
    type BetaManagedAgentsTokenEndpointAuthNoneParam as BetaManagedAgentsTokenEndpointAuthNoneParam,
    type BetaManagedAgentsTokenEndpointAuthNoneResponse as BetaManagedAgentsTokenEndpointAuthNoneResponse,
    type BetaManagedAgentsTokenEndpointAuthPostParam as BetaManagedAgentsTokenEndpointAuthPostParam,
    type BetaManagedAgentsTokenEndpointAuthPostResponse as BetaManagedAgentsTokenEndpointAuthPostResponse,
    type BetaManagedAgentsTokenEndpointAuthPostUpdateParam as BetaManagedAgentsTokenEndpointAuthPostUpdateParam,
    type BetaManagedAgentsCredentialsPageCursor as BetaManagedAgentsCredentialsPageCursor,
    type CredentialCreateParams as CredentialCreateParams,
    type CredentialRetrieveParams as CredentialRetrieveParams,
    type CredentialUpdateParams as CredentialUpdateParams,
    type CredentialListParams as CredentialListParams,
    type CredentialDeleteParams as CredentialDeleteParams,
    type CredentialArchiveParams as CredentialArchiveParams,
    type CredentialMCPOAuthValidateParams as CredentialMCPOAuthValidateParams,
  };
}
