import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { BadRequestError, ConflictError } from '../../core/error';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { RequestOptions } from '../../internal/request-options';
import { startApiCallSpan } from '../../internal/tracing';
import { path } from '../../internal/utils/path';

/**
 * The External Key can't be deleted or reconfigured while the organization's
 * Workspace Policy lists it as an allowed key.
 */
export class ExternalKeyInWorkspacePolicyError extends BadRequestError {
  declare readonly errorCode: 'external_key_in_workspace_policy';
  declare readonly details: ExternalKeyInWorkspacePolicyErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'ExternalKeyInWorkspacePolicyError';
}

/**
 * The External Key failed Anthropic's validation, so the request was refused. The
 * message gives the reason, if there is one.
 */
export class ExternalKeyValidationFailedError extends BadRequestError {
  declare readonly errorCode: 'external_key_validation_failed';
  declare readonly details: ExternalKeyValidationFailedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'ExternalKeyValidationFailedError';
}

/**
 * Anthropic's validation of the External Key did not finish in time, so the
 * request was refused. Wait a moment, then send the request again.
 */
export class ExternalKeyValidationTimedOutError extends BadRequestError {
  declare readonly errorCode: 'external_key_validation_timed_out';
  declare readonly details: ExternalKeyValidationTimedOutErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'ExternalKeyValidationTimedOutError';
}

/**
 * The external key changed while the request was validating it. Send the request
 * again.
 */
export class ExternalKeyChangedError extends ConflictError {
  declare readonly errorCode: 'external_key_changed';
  declare readonly details: ExternalKeyChangedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'ExternalKeyChangedError';
}

export class ExternalKeys extends APIResource {
  /**
   * Create an external key config owned by the caller's organization.
   *
   * @throws {UserProfileNotFoundError}
   *
   * @example
   * ```ts
   * const externalKey =
   *   await client.organization.externalKeys.create({
   *     provider_config: {
   *       kms_arn:
   *         'arn:aws:kms:us-east-1:111122223333:key/abcd1234-5678-90ab-cdef-000011112222',
   *       type: 'aws',
   *     },
   *   });
   * ```
   */
  create(body: ExternalKeyCreateParams, options?: RequestOptions): APIPromise<ExternalKey> {
    return this._client.post('/v1/organizations/external_keys', {
      body,
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_keys.create', options, {
        route: '/v1/organizations/external_keys',
        createdIDAttribute: 'anthropic.organization.external_key.id',
      }),
    });
  }

  /**
   * Retrieve a single external key config in the caller's organization by ID.
   *
   * @example
   * ```ts
   * const externalKey =
   *   await client.organization.externalKeys.retrieve(
   *     'external_key_id',
   *   );
   * ```
   */
  retrieve(externalKeyID: string, options?: RequestOptions): APIPromise<ExternalKey> {
    return this._client.get(path`/v1/organizations/external_keys/${externalKeyID}`, {
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_keys.retrieve', options, {
        route: '/v1/organizations/external_keys/{external_key_id}',
        attributes: { 'anthropic.organization.external_key.id': externalKeyID },
      }),
    });
  }

  /**
   * Partially update an external key config. Omitted fields are left unchanged.
   *
   * `display_name` is always editable. `geo` and `provider_config` cannot be changed
   * once any workspace references this config, because previously encrypted data
   * requires the original key identity to decrypt.
   *
   * @throws {ExternalKeyInWorkspacePolicyError}
   *
   * @example
   * ```ts
   * const externalKey =
   *   await client.organization.externalKeys.update(
   *     'external_key_id',
   *     {},
   *   );
   * ```
   */
  update(
    externalKeyID: string,
    body: ExternalKeyUpdateParams,
    options?: RequestOptions,
  ): APIPromise<ExternalKey> {
    return this._client.post(path`/v1/organizations/external_keys/${externalKeyID}`, {
      body,
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_keys.update', options, {
        route: '/v1/organizations/external_keys/{external_key_id}',
        attributes: { 'anthropic.organization.external_key.id': externalKeyID },
      }),
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
   * for await (const externalKey of client.organization.externalKeys.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: ExternalKeyListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<ExternalKeysPageCursor, ExternalKey> {
    return this._client.getAPIList('/v1/organizations/external_keys', PageCursor<ExternalKey>, {
      query,
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_keys.list', options, {
        route: '/v1/organizations/external_keys',
        queryParams: ['limit', 'page'],
      }),
    });
  }

  /**
   * Delete an external key config.
   *
   * The request is rejected if any workspace still references this config.
   *
   * @throws {ExternalKeyInWorkspacePolicyError}
   *
   * @example
   * ```ts
   * const externalKey =
   *   await client.organization.externalKeys.delete(
   *     'external_key_id',
   *   );
   * ```
   */
  delete(externalKeyID: string, options?: RequestOptions): APIPromise<ExternalKeyDeleteResponse> {
    return this._client.delete(path`/v1/organizations/external_keys/${externalKeyID}`, {
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_keys.delete', options, {
        route: '/v1/organizations/external_keys/{external_key_id}',
        attributes: { 'anthropic.organization.external_key.id': externalKeyID },
      }),
    });
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
   *   await client.organization.externalKeys.validate(
   *     'external_key_id',
   *   );
   * ```
   */
  validate(externalKeyID: string, options?: RequestOptions): APIPromise<ExternalKeyValidateResponse> {
    return this._client.post(path`/v1/organizations/external_keys/${externalKeyID}/validate`, {
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_keys.validate', options, {
        route: '/v1/organizations/external_keys/{external_key_id}/validate',
        attributes: { 'anthropic.organization.external_key.id': externalKeyID },
      }),
    });
  }
}

export type ExternalKeysPageCursor = PageCursor<ExternalKey>;

export interface AWSExternalKeyConfig {
  /**
   * Full ARN of the AWS KMS key. On Claude Platform on AWS, alias ARNs are rejected,
   * and your organization's own key must be a single-Region key in your
   * organization's AWS account.
   */
  kms_arn: string;

  type: 'aws';

  /**
   * AWS region. Derived from `kms_arn` if omitted.
   */
  region?: string | null;
}

export interface AzureExternalKeyConfig {
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
export interface AzureExternalKeyConfigParam {
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
export interface ExternalKey {
  /**
   * Identifier of the external key config: a tagged ID prefixed `ekey_`, or, on
   * Claude Platform on AWS, an AWS KMS key's ARN.
   */
  id: string;

  /**
   * Whether any workspace uses this config to encrypt its data — counting live and
   * archived workspaces (an archived workspace's data remains encrypted under the
   * config), excluding deleted ones. Only an attached config is used by the
   * encryption path; an `unattached` config is inert and can be deleted.
   */
  attachment: ExternalKeyAttachedAttachment | ExternalKeyUnattachedAttachment;

  created_at: string;

  /**
   * Human-friendly display name. Null if none was set.
   */
  display_name: string | null;

  /**
   * Data residency geo. Selects the region this key is used in.
   */
  geo: string;

  /**
   * KMS provider identity and auth coordinates.
   */
  provider_config: AWSExternalKeyConfig | GCPExternalKeyConfig | AzureExternalKeyConfig;

  type: 'external_key';

  updated_at: string;

  /**
   * ID of the user profile the key is bound to, or null if the key is not bound to
   * one. A key bound to a user profile can only be attached to a Workspace that has
   * the same user profile. A key that isn't bound can be attached to a Workspace
   * whatever its user profile.
   */
  user_profile_id: string | null;
}

export interface ExternalKeyAttachedAttachment {
  type: 'attached';
}

/**
 * The external key changed while the request was validating it. Send the request
 * again.
 */
export interface ExternalKeyChangedErrorDetails {
  error_code: 'external_key_changed';
}

/**
 * The External Key can't be deleted or reconfigured while the organization's
 * Workspace Policy lists it as an allowed key.
 */
export interface ExternalKeyInWorkspacePolicyErrorDetails {
  error_code: 'external_key_in_workspace_policy';
}

export interface ExternalKeyUnattachedAttachment {
  type: 'unattached';
}

/**
 * The External Key failed Anthropic's validation, so the request was refused. The
 * message gives the reason, if there is one.
 */
export interface ExternalKeyValidationFailedErrorDetails {
  error_code: 'external_key_validation_failed';
}

/**
 * Anthropic's validation of the External Key did not finish in time, so the
 * request was refused. Wait a moment, then send the request again.
 */
export interface ExternalKeyValidationTimedOutErrorDetails {
  error_code: 'external_key_validation_timed_out';
}

export interface GCPExternalKeyConfig {
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
  provider_config: AWSExternalKeyConfig | GCPExternalKeyConfig | AzureExternalKeyConfigParam;

  /**
   * Human-friendly display name.
   */
  display_name?: string | null;

  /**
   * Data residency geo. Only `us` is supported.
   */
  geo?: 'us';

  /**
   * ID of a user profile to bind the key to. Omit this field for a key that isn't
   * bound to a user profile. Such a key can be attached to a Workspace whatever its
   * user profile. The binding cannot be changed later. A key bound to a user profile
   * can only be attached to a Workspace that has the same user profile.
   */
  user_profile_id?: string | null;
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
  provider_config?: AWSExternalKeyConfig | GCPExternalKeyConfig | AzureExternalKeyConfigParam | null;
}

export interface ExternalKeyListParams extends PageCursorParams {}

ExternalKeys.ExternalKeyInWorkspacePolicyError = ExternalKeyInWorkspacePolicyError;
ExternalKeys.ExternalKeyValidationFailedError = ExternalKeyValidationFailedError;
ExternalKeys.ExternalKeyValidationTimedOutError = ExternalKeyValidationTimedOutError;
ExternalKeys.ExternalKeyChangedError = ExternalKeyChangedError;

export declare namespace ExternalKeys {
  export {
    ExternalKeyInWorkspacePolicyError as ExternalKeyInWorkspacePolicyError,
    ExternalKeyValidationFailedError as ExternalKeyValidationFailedError,
    ExternalKeyValidationTimedOutError as ExternalKeyValidationTimedOutError,
    ExternalKeyChangedError as ExternalKeyChangedError,
    type AWSExternalKeyConfig as AWSExternalKeyConfig,
    type AzureExternalKeyConfig as AzureExternalKeyConfig,
    type AzureExternalKeyConfigParam as AzureExternalKeyConfigParam,
    type ExternalKey as ExternalKey,
    type ExternalKeyAttachedAttachment as ExternalKeyAttachedAttachment,
    type ExternalKeyChangedErrorDetails as ExternalKeyChangedErrorDetails,
    type ExternalKeyInWorkspacePolicyErrorDetails as ExternalKeyInWorkspacePolicyErrorDetails,
    type ExternalKeyUnattachedAttachment as ExternalKeyUnattachedAttachment,
    type ExternalKeyValidationFailedErrorDetails as ExternalKeyValidationFailedErrorDetails,
    type ExternalKeyValidationTimedOutErrorDetails as ExternalKeyValidationTimedOutErrorDetails,
    type GCPExternalKeyConfig as GCPExternalKeyConfig,
    type ExternalKeyDeleteResponse as ExternalKeyDeleteResponse,
    type ExternalKeyValidateResponse as ExternalKeyValidateResponse,
    type ExternalKeysPageCursor as ExternalKeysPageCursor,
    type ExternalKeyCreateParams as ExternalKeyCreateParams,
    type ExternalKeyUpdateParams as ExternalKeyUpdateParams,
    type ExternalKeyListParams as ExternalKeyListParams,
  };
}
