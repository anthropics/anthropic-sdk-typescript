// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as CredentialsAPI from './credentials';
import {
  BetaManagedAgentsCredential,
  BetaManagedAgentsCredentialValidation,
  BetaManagedAgentsCredentialValidationStatus,
  BetaManagedAgentsCredentialsPageCursor,
  BetaManagedAgentsDeletedCredential,
  BetaManagedAgentsMCPOAuthAuthResponse,
  BetaManagedAgentsMCPOAuthCreateParams,
  BetaManagedAgentsMCPOAuthRefreshParams,
  BetaManagedAgentsMCPOAuthRefreshResponse,
  BetaManagedAgentsMCPOAuthRefreshUpdateParams,
  BetaManagedAgentsMCPOAuthUpdateParams,
  BetaManagedAgentsMCPProbe,
  BetaManagedAgentsRefreshHTTPResponse,
  BetaManagedAgentsRefreshObject,
  BetaManagedAgentsStaticBearerAuthResponse,
  BetaManagedAgentsStaticBearerCreateParams,
  BetaManagedAgentsStaticBearerUpdateParams,
  BetaManagedAgentsTokenEndpointAuthBasicParam,
  BetaManagedAgentsTokenEndpointAuthBasicResponse,
  BetaManagedAgentsTokenEndpointAuthBasicUpdateParam,
  BetaManagedAgentsTokenEndpointAuthNoneParam,
  BetaManagedAgentsTokenEndpointAuthNoneResponse,
  BetaManagedAgentsTokenEndpointAuthPostParam,
  BetaManagedAgentsTokenEndpointAuthPostResponse,
  BetaManagedAgentsTokenEndpointAuthPostUpdateParam,
  CredentialArchiveParams,
  CredentialCreateParams,
  CredentialDeleteParams,
  CredentialListParams,
  CredentialMCPOAuthValidateParams,
  CredentialRetrieveParams,
  CredentialUpdateParams,
  Credentials,
} from './credentials';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Vaults extends APIResource {
  credentials: CredentialsAPI.Credentials = new CredentialsAPI.Credentials(this._client);

  /**
   * Create Vault
   *
   * @example
   * ```ts
   * const betaManagedAgentsVault =
   *   await client.beta.vaults.create({
   *     display_name: 'Example vault',
   *   });
   * ```
   */
  create(params: VaultCreateParams, options?: RequestOptions): APIPromise<BetaManagedAgentsVault> {
    const { betas, ...body } = params;
    return this._client.post('/v1/vaults?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Get Vault
   *
   * @example
   * ```ts
   * const betaManagedAgentsVault =
   *   await client.beta.vaults.retrieve(
   *     'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   *   );
   * ```
   */
  retrieve(
    vaultID: string,
    params: VaultRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsVault> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/vaults/${vaultID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Vault
   *
   * @example
   * ```ts
   * const betaManagedAgentsVault =
   *   await client.beta.vaults.update(
   *     'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   *   );
   * ```
   */
  update(
    vaultID: string,
    params: VaultUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsVault> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/vaults/${vaultID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List Vaults
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsVault of client.beta.vaults.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: VaultListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsVaultsPageCursor, BetaManagedAgentsVault> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/vaults?beta=true', PageCursor<BetaManagedAgentsVault>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Vault
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeletedVault =
   *   await client.beta.vaults.delete(
   *     'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   *   );
   * ```
   */
  delete(
    vaultID: string,
    params: VaultDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeletedVault> {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/vaults/${vaultID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Archive Vault
   *
   * @example
   * ```ts
   * const betaManagedAgentsVault =
   *   await client.beta.vaults.archive(
   *     'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   *   );
   * ```
   */
  archive(
    vaultID: string,
    params: VaultArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsVault> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/vaults/${vaultID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaManagedAgentsVaultsPageCursor = PageCursor<BetaManagedAgentsVault>;

/**
 * Confirmation of a deleted vault.
 */
export interface BetaManagedAgentsDeletedVault {
  /**
   * Unique identifier of the deleted vault.
   */
  id: string;

  type: 'vault_deleted';
}

/**
 * A vault that stores credentials for use by agents during sessions.
 */
export interface BetaManagedAgentsVault {
  /**
   * Unique identifier for the vault.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  archived_at: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  /**
   * Human-readable name for the vault.
   */
  display_name: string;

  /**
   * Arbitrary key-value metadata attached to the vault.
   */
  metadata: { [key: string]: string };

  type: 'vault';

  /**
   * A timestamp in RFC 3339 format
   */
  updated_at: string;
}

export interface VaultCreateParams {
  /**
   * Body param: Human-readable name for the vault. 1-255 characters.
   */
  display_name: string;

  /**
   * Body param: Arbitrary key-value metadata to attach to the vault. Maximum 16
   * pairs, keys up to 64 chars, values up to 512 chars.
   */
  metadata?: { [key: string]: string };

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface VaultRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface VaultUpdateParams {
  /**
   * Body param: Updated human-readable name for the vault. 1-255 characters.
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

export interface VaultListParams extends PageCursorParams {
  /**
   * Query param: Whether to include archived vaults in the results.
   */
  include_archived?: boolean;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface VaultDeleteParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface VaultArchiveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

Vaults.Credentials = Credentials;

export declare namespace Vaults {
  export {
    type BetaManagedAgentsDeletedVault as BetaManagedAgentsDeletedVault,
    type BetaManagedAgentsVault as BetaManagedAgentsVault,
    type BetaManagedAgentsVaultsPageCursor as BetaManagedAgentsVaultsPageCursor,
    type VaultCreateParams as VaultCreateParams,
    type VaultRetrieveParams as VaultRetrieveParams,
    type VaultUpdateParams as VaultUpdateParams,
    type VaultListParams as VaultListParams,
    type VaultDeleteParams as VaultDeleteParams,
    type VaultArchiveParams as VaultArchiveParams,
  };

  export {
    Credentials as Credentials,
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
