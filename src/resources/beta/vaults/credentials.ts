import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

export class Credentials extends APIResource {
  /**
   * Create a Credential
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
    const { betas, workspace_id, ...body } = params;
    return this._client.post(path`/v1/vaults/${vaultID}/credentials?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.vaults.credentials.create', options, {
        route: '/v1/vaults/{vault_id}/credentials',
        attributes: { 'anthropic.vault.id': vaultID },
        createdIDAttribute: 'anthropic.vault.credential.id',
      }),
    });
  }

  /**
   * Retrieve a Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredential =
   *   await client.beta.vaults.credentials.retrieve(
   *     'vcrd_011CZkZEMt8gZan2iYPQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  retrieve(
    credentialID: string,
    params: CredentialRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsCredential> {
    const { vault_id, betas, workspace_id } = params;
    return this._client.get(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.vaults.credentials.retrieve', options, {
        route: '/v1/vaults/{vault_id}/credentials/{credential_id}',
        attributes: { 'anthropic.vault.id': vault_id, 'anthropic.vault.credential.id': credentialID },
      }),
    });
  }

  /**
   * Update a Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredential =
   *   await client.beta.vaults.credentials.update(
   *     'vcrd_011CZkZEMt8gZan2iYPQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  update(
    credentialID: string,
    params: CredentialUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsCredential> {
    const { vault_id, betas, workspace_id, ...body } = params;
    return this._client.post(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.vaults.credentials.update', options, {
        route: '/v1/vaults/{vault_id}/credentials/{credential_id}',
        attributes: { 'anthropic.vault.id': vault_id, 'anthropic.vault.credential.id': credentialID },
      }),
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
    const { betas, workspace_id, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/vaults/${vaultID}/credentials?beta=true`,
      PageCursor<BetaManagedAgentsCredential>,
      {
        query,
        ...options,
        headers: buildHeaders([
          {
            'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
            ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
          },
          options?.headers,
        ]),
        __span: startApiCallSpan(this._client, 'anthropic.vaults.credentials.list', options, {
          route: '/v1/vaults/{vault_id}/credentials',
          queryParams: ['include_archived', 'limit', 'page'],
          attributes: { 'anthropic.vault.id': vaultID },
        }),
      },
    );
  }

  /**
   * Delete a Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeletedCredential =
   *   await client.beta.vaults.credentials.delete(
   *     'vcrd_011CZkZEMt8gZan2iYPQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  delete(
    credentialID: string,
    params: CredentialDeleteParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeletedCredential> {
    const { vault_id, betas, workspace_id } = params;
    return this._client.delete(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.vaults.credentials.delete', options, {
        route: '/v1/vaults/{vault_id}/credentials/{credential_id}',
        attributes: { 'anthropic.vault.id': vault_id, 'anthropic.vault.credential.id': credentialID },
      }),
    });
  }

  /**
   * Archive a Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredential =
   *   await client.beta.vaults.credentials.archive(
   *     'vcrd_011CZkZEMt8gZan2iYPQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  archive(
    credentialID: string,
    params: CredentialArchiveParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsCredential> {
    const { vault_id, betas, workspace_id } = params;
    return this._client.post(path`/v1/vaults/${vault_id}/credentials/${credentialID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.vaults.credentials.archive', options, {
        route: '/v1/vaults/{vault_id}/credentials/{credential_id}/archive',
        attributes: { 'anthropic.vault.id': vault_id, 'anthropic.vault.credential.id': credentialID },
      }),
    });
  }

  /**
   * Validate an MCP OAuth Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredentialValidation =
   *   await client.beta.vaults.credentials.mcpOAuthValidate(
   *     'vcrd_011CZkZEMt8gZan2iYPQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  mcpOAuthValidate(
    credentialID: string,
    params: CredentialMCPOAuthValidateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsCredentialValidation> {
    const { vault_id, betas, workspace_id } = params;
    return this._client.post(
      path`/v1/vaults/${vault_id}/credentials/${credentialID}/mcp_oauth_validate?beta=true`,
      {
        ...options,
        headers: buildHeaders([
          {
            'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
            ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
          },
          options?.headers,
        ]),
        __span: startApiCallSpan(this._client, 'anthropic.vaults.credentials.mcp_oauth_validate', options, {
          route: '/v1/vaults/{vault_id}/credentials/{credential_id}/mcp_oauth_validate',
          attributes: { 'anthropic.vault.id': vault_id, 'anthropic.vault.credential.id': credentialID },
        }),
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
   * The unique ID of the credential (`vcrd_...`).
   */
  id: string;

  /**
   * When the credential was archived. Null if not archived.
   */
  archived_at: string | null;

  /**
   * Authentication configuration for this credential.
   */
  auth:
    | BetaManagedAgentsMCPOAuthAuthResponse
    | BetaManagedAgentsStaticBearerAuthResponse
    | BetaManagedAgentsEnvironmentVariableAuthResponse;

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

export type BetaManagedAgentsCredentialNetworkingParams =
  | BetaManagedAgentsUnrestrictedCredentialNetworkingParams
  | BetaManagedAgentsLimitedCredentialNetworkingParams;

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
   * Details of the MCP probe step that failed, or `null` if the probe succeeded or
   * there was no access token to test.
   */
  mcp_probe: BetaManagedAgentsMCPProbe | null;

  /**
   * Details of the refresh-token exchange attempted on a 401. Null when no refresh
   * was attempted.
   */
  refresh: BetaManagedAgentsRefreshObject | null;

  /**
   * Overall verdict of the validation probe.
   */
  status: BetaManagedAgentsCredentialValidationStatus;

  type: 'vault_credential_validation';

  /**
   * When the validation probe was performed.
   */
  validated_at: string;

  /**
   * Identifier of the vault containing the credential.
   */
  vault_id: string;
}

/**
 * Overall verdict of a credential validation probe.
 *
 * - `valid` - The credential successfully authenticated against its MCP server.
 * - `invalid` - The probe reached the MCP server and the server rejected the
 *   credential, or no access token is stored. A refresh, if one was tried, didn't
 *   recover it. Usually the end user needs to authorize again.
 * - `unknown` - The probe couldn't tell whether the credential works, for example
 *   because of a network error or because a refresh succeeded but the new access
 *   token wasn't tested. Validate the credential again to find out.
 */
export type BetaManagedAgentsCredentialValidationStatus = 'valid' | 'invalid' | 'unknown';

/**
 * Confirmation of a deleted credential.
 */
export interface BetaManagedAgentsDeletedCredential {
  /**
   * The unique ID of the deleted credential (`vcrd_...`).
   */
  id: string;

  type: 'vault_credential_deleted';
}

/**
 * Environment variable credential details. The secret value is never returned.
 */
export interface BetaManagedAgentsEnvironmentVariableAuthResponse {
  /**
   * Where in the outbound request the secret value is substituted.
   */
  injection_location: BetaManagedAgentsInjectionLocationResponse;

  /**
   * Outbound hosts the secret value is substituted on.
   */
  networking:
    | BetaManagedAgentsUnrestrictedCredentialNetworkingResponse
    | BetaManagedAgentsLimitedCredentialNetworkingResponse;

  /**
   * Name of the environment variable.
   */
  secret_name: string;

  type: 'environment_variable';
}

/**
 * Parameters for creating an environment variable credential.
 */
export interface BetaManagedAgentsEnvironmentVariableCreateParams {
  /**
   * Outbound hosts the secret value is substituted on.
   */
  networking: BetaManagedAgentsCredentialNetworkingParams;

  /**
   * Name of the environment variable. Immutable after create.
   */
  secret_name: string;

  /**
   * The secret to substitute into the agent's outbound requests. It's write-only and
   * never returned in responses.
   */
  secret_value: string;

  type: 'environment_variable';

  /**
   * Where in the outbound request the secret value may be substituted.
   */
  injection_location?: BetaManagedAgentsInjectionLocationParams;
}

/**
 * Parameters for updating an environment variable credential. `secret_name` is
 * immutable.
 */
export interface BetaManagedAgentsEnvironmentVariableUpdateParams {
  type: 'environment_variable';

  /**
   * Updated injection location.
   */
  injection_location?: BetaManagedAgentsInjectionLocationUpdateParams;

  /**
   * The new networking scope, which replaces the stored one as a whole.
   */
  networking?: BetaManagedAgentsCredentialNetworkingParams | null;

  /**
   * The new secret value to replace the stored one.
   */
  secret_value?: string | null;
}

/**
 * Where in the outbound request the secret value may be substituted.
 */
export interface BetaManagedAgentsInjectionLocationParams {
  /**
   * Substitute when the placeholder appears in the request body.
   */
  body?: boolean;

  /**
   * Substitute when the placeholder appears in a request header value.
   */
  header?: boolean;
}

/**
 * Where in the outbound request the secret value is substituted.
 */
export interface BetaManagedAgentsInjectionLocationResponse {
  /**
   * Whether the placeholder is substituted in the request body.
   */
  body: boolean;

  /**
   * Whether the placeholder is substituted in request header values.
   */
  header: boolean;
}

/**
 * Changes which parts of an outbound request the secret is substituted into. A
 * location you leave out keeps its current setting.
 *
 * After the change, at least one location must be enabled.
 *
 * See
 * [Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults#add-a-credential)
 * to learn more about injection locations.
 */
export interface BetaManagedAgentsInjectionLocationUpdateParams {
  /**
   * Substitute when the placeholder appears in the request body.
   */
  body?: boolean;

  /**
   * Substitute when the placeholder appears in a request header value.
   */
  header?: boolean;
}

/**
 * Substitute the secret only on requests to the listed hosts.
 */
export interface BetaManagedAgentsLimitedCredentialNetworkingParams {
  /**
   * The destination hosts of the outbound requests that the credential's secret is
   * substituted into.
   *
   * Each entry is a bare hostname (`api.example.com`), an IPv4 address
   * (`192.0.2.1`), or a `*.` wildcard (`*.example.com`). URLs, ports, paths, and
   * IPv6 addresses aren't accepted. The list can have up to 16 entries.
   */
  allowed_hosts: Array<string>;

  type: 'limited';
}

/**
 * The secret is substituted only on requests to the listed hosts.
 */
export interface BetaManagedAgentsLimitedCredentialNetworkingResponse {
  /**
   * The destination hosts of the outbound requests that the credential's secret is
   * substituted into.
   *
   * An entry matches the request host exactly. An entry such as `*.example.com`
   * matches any subdomain of `example.com` but not `example.com` itself.
   */
  allowed_hosts: Array<string>;

  type: 'limited';
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
   * When the credential's access token expires, in RFC 3339. Absent if the expiry
   * isn't known.
   */
  expires_at?: string | null;

  /**
   * Refresh token configuration, if the credential supports token refresh.
   */
  refresh?: BetaManagedAgentsMCPOAuthRefreshResponse | null;
}

/**
 * Parameters for creating an MCP OAuth credential.
 */
export interface BetaManagedAgentsMCPOAuthCreateParams {
  /**
   * The OAuth access token to send to the MCP server.
   */
  access_token: string;

  /**
   * URL of the MCP server this credential authenticates against.
   */
  mcp_server_url: string;

  type: 'mcp_oauth';

  /**
   * When `access_token` expires, in RFC 3339.
   *
   * Must be in the future.
   */
  expires_at?: string | null;

  /**
   * Refresh token configuration, if the credential supports token refresh.
   */
  refresh?: BetaManagedAgentsMCPOAuthRefreshParams | null;
}

/**
 * OAuth refresh token parameters for creating a credential with refresh support.
 */
export interface BetaManagedAgentsMCPOAuthRefreshParams {
  /**
   * The OAuth client ID to use when refreshing the access token. It can't be changed
   * after the credential is created.
   */
  client_id: string;

  /**
   * The OAuth refresh token that the API uses to get a new access token when the
   * current one expires.
   */
  refresh_token: string;

  /**
   * Token endpoint URL used to refresh the access token.
   */
  token_endpoint: string;

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
   * The OAuth client ID used when refreshing the access token.
   */
  client_id: string;

  /**
   * Token endpoint URL used to refresh the access token.
   */
  token_endpoint: string;

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
   * The new OAuth refresh token to replace the stored one.
   */
  refresh_token?: string | null;

  /**
   * The new OAuth scope for refresh requests. Send an empty string to clear the
   * stored scope.
   */
  scope?: string | null;

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
   * The new OAuth access token to replace the stored one.
   */
  access_token?: string | null;

  /**
   * When the credential's access token expires, in RFC 3339. Leave it out to keep
   * the stored expiry.
   *
   * If you send a new `access_token`, send its `expires_at` too, or the new token
   * keeps the old expiry.
   *
   * Must be in the future.
   */
  expires_at?: string | null;

  /**
   * Updated refresh token configuration.
   */
  refresh?: BetaManagedAgentsMCPOAuthRefreshUpdateParams | null;
}

/**
 * The failing step of an MCP validation probe.
 */
export interface BetaManagedAgentsMCPProbe {
  /**
   * The HTTP error response from the MCP server, or `null` if the MCP server didn't
   * return one for the failing step, for example after a timeout or a DNS or TLS
   * failure.
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
   * The captured HTTP error response from the token endpoint. Populated only when
   * `status` is `failed`.
   */
  http_response: BetaManagedAgentsRefreshHTTPResponse | null;

  /**
   * Outcome of the refresh attempt.
   *
   * - `succeeded` - The token endpoint returned a new access token.
   * - `failed` - The token endpoint returned an error response. See `http_response`
   *   for detail.
   * - `connect_error` - The token endpoint could not be reached (DNS, TLS, or
   *   connection error).
   * - `no_refresh_token` - No refresh token is stored for the credential, so no
   *   exchange was attempted.
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
   * The static bearer token to send to the MCP server, such as an API key or
   * personal access token.
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
   * The new static bearer token to replace the stored one.
   */
  token?: string | null;
}

/**
 * Token endpoint uses HTTP Basic authentication with client credentials.
 */
export interface BetaManagedAgentsTokenEndpointAuthBasicParam {
  /**
   * The OAuth client secret, sent to `token_endpoint` with HTTP Basic
   * authentication.
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
   * A new OAuth client secret to replace the stored one.
   *
   * The credential must already use `client_secret_basic` or `client_secret_post`.
   * It keeps its current `token_endpoint_auth` type, even if the `type` sent with
   * this secret is the other one.
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
   * The OAuth client secret, sent to `token_endpoint` in the POST body.
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
   * A new OAuth client secret to replace the stored one.
   *
   * The credential must already use `client_secret_basic` or `client_secret_post`.
   * It keeps its current `token_endpoint_auth` type, even if the `type` sent with
   * this secret is the other one.
   */
  client_secret?: string | null;
}

/**
 * Substitute the secret on any host the session's Environment network policy
 * permits egress to. The Environment's network policy is the only boundary on
 * where the secret can reach.
 */
export interface BetaManagedAgentsUnrestrictedCredentialNetworkingParams {
  type: 'unrestricted';
}

/**
 * The secret is substituted on any host the session's Environment network policy
 * permits egress to.
 */
export interface BetaManagedAgentsUnrestrictedCredentialNetworkingResponse {
  type: 'unrestricted';
}

export interface CredentialCreateParams {
  /**
   * Body param: Authentication configuration for the credential.
   */
  auth:
    | BetaManagedAgentsMCPOAuthCreateParams
    | BetaManagedAgentsStaticBearerCreateParams
    | BetaManagedAgentsEnvironmentVariableCreateParams;

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
   * Header param: This endpoint is in beta: requests must send
   * `managed-agents-2026-04-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface CredentialRetrieveParams {
  /**
   * Path param: Identifier of the vault containing the credential.
   */
  vault_id: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `managed-agents-2026-04-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface CredentialUpdateParams {
  /**
   * Path param: Identifier of the vault containing the credential.
   */
  vault_id: string;

  /**
   * Body param: New authentication settings for the credential. The `type` must
   * match the credential's current type, which can't be changed.
   */
  auth?:
    | BetaManagedAgentsMCPOAuthUpdateParams
    | BetaManagedAgentsStaticBearerUpdateParams
    | BetaManagedAgentsEnvironmentVariableUpdateParams;

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
   * Header param: This endpoint is in beta: requests must send
   * `managed-agents-2026-04-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface CredentialListParams extends PageCursorParams {
  /**
   * Query param: Whether to include archived credentials in the results. Defaults to
   * `false`.
   */
  include_archived?: boolean;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `managed-agents-2026-04-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface CredentialDeleteParams {
  /**
   * Path param: Identifier of the vault containing the credential.
   */
  vault_id: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `managed-agents-2026-04-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface CredentialArchiveParams {
  /**
   * Path param: Identifier of the vault containing the credential.
   */
  vault_id: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `managed-agents-2026-04-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface CredentialMCPOAuthValidateParams {
  /**
   * Path param: Identifier of the vault containing the credential.
   */
  vault_id: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `managed-agents-2026-04-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export declare namespace Credentials {
  export {
    type BetaManagedAgentsCredential as BetaManagedAgentsCredential,
    type BetaManagedAgentsCredentialNetworkingParams as BetaManagedAgentsCredentialNetworkingParams,
    type BetaManagedAgentsCredentialValidation as BetaManagedAgentsCredentialValidation,
    type BetaManagedAgentsCredentialValidationStatus as BetaManagedAgentsCredentialValidationStatus,
    type BetaManagedAgentsDeletedCredential as BetaManagedAgentsDeletedCredential,
    type BetaManagedAgentsEnvironmentVariableAuthResponse as BetaManagedAgentsEnvironmentVariableAuthResponse,
    type BetaManagedAgentsEnvironmentVariableCreateParams as BetaManagedAgentsEnvironmentVariableCreateParams,
    type BetaManagedAgentsEnvironmentVariableUpdateParams as BetaManagedAgentsEnvironmentVariableUpdateParams,
    type BetaManagedAgentsInjectionLocationParams as BetaManagedAgentsInjectionLocationParams,
    type BetaManagedAgentsInjectionLocationResponse as BetaManagedAgentsInjectionLocationResponse,
    type BetaManagedAgentsInjectionLocationUpdateParams as BetaManagedAgentsInjectionLocationUpdateParams,
    type BetaManagedAgentsLimitedCredentialNetworkingParams as BetaManagedAgentsLimitedCredentialNetworkingParams,
    type BetaManagedAgentsLimitedCredentialNetworkingResponse as BetaManagedAgentsLimitedCredentialNetworkingResponse,
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
    type BetaManagedAgentsUnrestrictedCredentialNetworkingParams as BetaManagedAgentsUnrestrictedCredentialNetworkingParams,
    type BetaManagedAgentsUnrestrictedCredentialNetworkingResponse as BetaManagedAgentsUnrestrictedCredentialNetworkingResponse,
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
