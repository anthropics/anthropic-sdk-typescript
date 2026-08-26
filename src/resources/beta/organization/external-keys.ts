// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class ExternalKeys extends APIResource {
  /**
   * Create an external key config owned by the caller's organization.
   *
   * @example
   * ```ts
   * const betaExternalKey =
   *   await client.beta.organization.externalKeys.create({
   *     provider_config: {
   *       kms_arn:
   *         'arn:aws:kms:us-east-1:111122223333:key/abcd1234-5678-90ab-cdef-000011112222',
   *       type: 'aws',
   *     },
   *   });
   * ```
   */
  create(body: ExternalKeyCreateParams, options?: RequestOptions): APIPromise<BetaExternalKey> {
    return this._client.post('/v1/organizations/external_keys?beta=true', { body, ...options });
  }

  /**
   * Retrieve a single external key config in the caller's organization by ID.
   *
   * @example
   * ```ts
   * const betaExternalKey =
   *   await client.beta.organization.externalKeys.retrieve(
   *     'external_key_id',
   *   );
   * ```
   */
  retrieve(externalKeyID: string, options?: RequestOptions): APIPromise<BetaExternalKey> {
    return this._client.get(path`/v1/organizations/external_keys/${externalKeyID}?beta=true`, options);
  }

  /**
   * Partially update an external key config. Omitted fields are left unchanged.
   *
   * `display_name` is always editable. `geo` and `provider_config` cannot be changed
   * once any workspace references this config, because previously encrypted data
   * requires the original key identity to decrypt.
   *
   * @example
   * ```ts
   * const betaExternalKey =
   *   await client.beta.organization.externalKeys.update(
   *     'external_key_id',
   *   );
   * ```
   */
  update(
    externalKeyID: string,
    body: ExternalKeyUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaExternalKey> {
    return this._client.post(path`/v1/organizations/external_keys/${externalKeyID}?beta=true`, {
      body,
      ...options,
    });
  }

  /**
   * List external key configs in the caller's organization.
   *
   * Results are ordered by creation time (newest first). Use the `next_page` cursor
   * from the response to fetch subsequent pages.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaExternalKey of client.beta.organization.externalKeys.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: ExternalKeyListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaExternalKeysPageCursor, BetaExternalKey> {
    return this._client.getAPIList('/v1/organizations/external_keys?beta=true', PageCursor<BetaExternalKey>, {
      query,
      ...options,
    });
  }

  /**
   * Delete an external key config.
   *
   * The request is rejected if any workspace still references this config.
   *
   * @example
   * ```ts
   * const externalKey =
   *   await client.beta.organization.externalKeys.delete(
   *     'external_key_id',
   *   );
   * ```
   */
  delete(externalKeyID: string, options?: RequestOptions): APIPromise<ExternalKeyDeleteResponse> {
    return this._client.delete(path`/v1/organizations/external_keys/${externalKeyID}?beta=true`, options);
  }

  /**
   * Validate an external key config against the customer's KMS.
   *
   * Anthropic performs an encrypt/decrypt roundtrip against the configured KMS key
   * and waits up to 30 seconds for the result. The response status is `success` if
   * the roundtrip succeeded, or `failure` with an error message if it failed or
   * timed out.
   *
   * @example
   * ```ts
   * const response =
   *   await client.beta.organization.externalKeys.validate(
   *     'external_key_id',
   *   );
   * ```
   */
  validate(externalKeyID: string, options?: RequestOptions): APIPromise<ExternalKeyValidateResponse> {
    return this._client.post(
      path`/v1/organizations/external_keys/${externalKeyID}/validate?beta=true`,
      options,
    );
  }
}

export type BetaExternalKeysPageCursor = PageCursor<BetaExternalKey>;

export interface BetaAWSExternalKeyConfig {
  /**
   * Full ARN of the AWS KMS key.
   */
  kms_arn: string;

  type: 'aws';

  /**
   * AWS region. Derived from `kms_arn` if omitted.
   */
  region?: string | null;

  /**
   * @deprecated IAM role ARN. Deprecated — Anthropic reaches the KMS key via a
   * managed intermediate role; this field is ignored.
   */
  role_arn?: string | null;
}

export interface BetaAzureExternalKeyConfig {
  /**
   * Name of the key within the vault.
   */
  key_name: string;

  /**
   * Azure AD tenant ID.
   */
  tenant_id: string;

  type: 'azure';

  /**
   * Key Vault data-plane URI — `https://{vault-name}.vault.azure.net` or
   * `https://{hsm-name}.managedhsm.azure.net`.
   */
  vault_uri: string;

  /**
   * Azure AD application (client) ID. Omit to use Anthropic's multitenant app.
   * Provide only if using a single-tenant app registration in the customer's
   * directory.
   */
  client_id?: string | null;
}

/**
 * Azure Key Vault provider configuration.
 */
export interface BetaAzureExternalKeyConfigParam {
  /**
   * Name of the key within the vault.
   */
  key_name: string;

  /**
   * Azure AD tenant ID.
   */
  tenant_id: string;

  type: 'azure';

  /**
   * Key Vault data-plane URI — `https://{vault-name}.vault.azure.net` or
   * `https://{hsm-name}.managedhsm.azure.net`.
   */
  vault_uri: string;

  /**
   * Azure AD application (client) ID. Omit to use Anthropic's multitenant app.
   * Provide only if using a single-tenant app registration in the customer's
   * directory.
   */
  client_id?: string | null;
}

/**
 * CMEK external key config belonging to the caller's organization.
 *
 * Configs are organization-scoped. Workspaces attach to a config; once any
 * workspace references it, the provider fields become effectively immutable
 * (existing encrypted data needs the config for decrypt).
 */
export interface BetaExternalKey {
  /**
   * Identifier of the external key config. A tagged ID prefixed `ekey_`, or — for
   * organizations on the Claude Platform on AWS — the AWS KMS key ARN.
   */
  id: string;

  /**
   * Whether any workspace uses this config to encrypt its data — counting live and
   * archived workspaces (an archived workspace's data remains encrypted under the
   * config), excluding deleted ones. Only an attached config is used by the
   * encryption path; an `unattached` config is inert and can be deleted.
   */
  attachment: BetaExternalKeyAttachedAttachment | BetaExternalKeyUnattachedAttachment;

  created_at: string;

  /**
   * Human-friendly display name. Null if none was set.
   */
  display_name: string | null;

  /**
   * Data residency geo. Selects which regional validator handles this key's
   * encrypt/decrypt roundtrips.
   */
  geo: string;

  /**
   * KMS provider identity and auth coordinates.
   */
  provider_config: BetaAWSExternalKeyConfig | BetaGCPExternalKeyConfig | BetaAzureExternalKeyConfig;

  type: 'external_key';

  updated_at: string;
}

export interface BetaExternalKeyAttachedAttachment {
  type: 'attached';
}

export interface BetaExternalKeyUnattachedAttachment {
  type: 'unattached';
}

export interface BetaGCPExternalKeyConfig {
  /**
   * Full resource name of the Cloud KMS key.
   */
  key_name: string;

  type: 'gcp';
}

export interface ExternalKeyDeleteResponse {
  /**
   * ID of the deleted External Key.
   */
  id: string;

  type: 'external_key_deleted';
}

/**
 * Result of a validation roundtrip against the customer's KMS.
 *
 * HTTP 200 for both outcomes — the operation completed; `status` says whether the
 * key works.
 */
export interface ExternalKeyValidateResponse {
  /**
   * Error message when status is `failure`. Null otherwise.
   */
  error: string | null;

  /**
   * `success` — encrypt/decrypt roundtrip succeeded. `failure` — the roundtrip
   * failed or timed out; see `error`.
   */
  status: 'failure' | 'success';

  type: 'external_key_validation';
}

export interface ExternalKeyCreateParams {
  /**
   * KMS provider identity and auth coordinates.
   */
  provider_config: BetaAWSExternalKeyConfig | BetaGCPExternalKeyConfig | BetaAzureExternalKeyConfigParam;

  /**
   * Human-friendly display name.
   */
  display_name?: string | null;

  /**
   * Data residency geo. Only `us` is supported.
   */
  geo?: 'us';
}

export interface ExternalKeyUpdateParams {
  /**
   * Human-friendly display name.
   */
  display_name?: string | null;

  /**
   * Data residency geo. Only `us` is supported.
   */
  geo?: 'us' | null;

  /**
   * KMS provider identity and auth coordinates.
   */
  provider_config?:
    | BetaAWSExternalKeyConfig
    | BetaGCPExternalKeyConfig
    | BetaAzureExternalKeyConfigParam
    | null;
}

export interface ExternalKeyListParams extends PageCursorParams {}

export declare namespace ExternalKeys {
  export {
    type BetaAWSExternalKeyConfig as BetaAWSExternalKeyConfig,
    type BetaAzureExternalKeyConfig as BetaAzureExternalKeyConfig,
    type BetaAzureExternalKeyConfigParam as BetaAzureExternalKeyConfigParam,
    type BetaExternalKey as BetaExternalKey,
    type BetaExternalKeyAttachedAttachment as BetaExternalKeyAttachedAttachment,
    type BetaExternalKeyUnattachedAttachment as BetaExternalKeyUnattachedAttachment,
    type BetaGCPExternalKeyConfig as BetaGCPExternalKeyConfig,
    type ExternalKeyDeleteResponse as ExternalKeyDeleteResponse,
    type ExternalKeyValidateResponse as ExternalKeyValidateResponse,
    type BetaExternalKeysPageCursor as BetaExternalKeysPageCursor,
    type ExternalKeyCreateParams as ExternalKeyCreateParams,
    type ExternalKeyUpdateParams as ExternalKeyUpdateParams,
    type ExternalKeyListParams as ExternalKeyListParams,
  };
}
