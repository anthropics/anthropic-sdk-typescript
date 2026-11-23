import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import { APIPromise } from '../../../core/api-promise';
import { BadRequestError, ConflictError } from '../../../core/error';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

/**
 * The External Storage is `active` or `draining`, so this delete didn't erase it.
 * The message says what to do next. On `draining` storage this delete may have
 * started a removal that can't be undone: get the storage and read
 * `status.removal_started`.
 */
export class BetaExternalStorageInUseError extends BadRequestError {
  declare readonly errorCode: 'external_storage_in_use';
  declare readonly details: BetaExternalStorageInUseErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaExternalStorageInUseError';
}

/**
 * The External Storage can't be deleted while an Enterprise Frontier Safeguards
 * workspace policy lists it as allowed storage.
 */
export class BetaExternalStorageInWorkspacePolicyError extends BadRequestError {
  declare readonly errorCode: 'external_storage_in_workspace_policy';
  declare readonly details: BetaExternalStorageInWorkspacePolicyErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaExternalStorageInWorkspacePolicyError';
}

/**
 * External Storage isn't available for this Workspace, so only `internal` storage
 * is accepted. The error's `message` says why.
 */
export class BetaExternalStorageNotAvailableError extends BadRequestError {
  declare readonly errorCode: 'external_storage_not_available';
  declare readonly details: BetaExternalStorageNotAvailableErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaExternalStorageNotAvailableError';
}

/**
 * Anthropic has not approved External Storage for the organization, for the
 * Workspace or, for storage bound to a user profile, for that user profile.
 * Contact your Anthropic account team.
 */
export class BetaGrantRequiredError extends BadRequestError {
  declare readonly errorCode: 'grant_required';
  declare readonly details: BetaGrantRequiredErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaGrantRequiredError';
}

/**
 * On Claude Platform on AWS, the External Storage ID in the request is neither a
 * bucket ARN nor an `estrg_` ID, or is the `estrg_` ID of AWS storage. Name AWS
 * storage by its bucket ARN, `arn:<partition>:s3:::<bucket_name>`, which responses
 * return as its `id`.
 */
export class BetaInvalidStorageARNError extends BadRequestError {
  declare readonly errorCode: 'invalid_storage_arn';
  declare readonly details: BetaInvalidStorageARNErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaInvalidStorageARNError';
}

/**
 * The request can't use External Storage on this cloud provider. The error's
 * message says why.
 */
export class BetaProviderNotAllowedError extends BadRequestError {
  declare readonly errorCode: 'provider_not_allowed';
  declare readonly details: BetaProviderNotAllowedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaProviderNotAllowedError';
}

/**
 * The Workspace has reached its limit of 100 different External Storage resources
 * attached over its lifetime. Detached storage counts toward the limit until it is
 * deleted.
 */
export class BetaStorageAttachLimitReachedError extends BadRequestError {
  declare readonly errorCode: 'storage_attach_limit_reached';
  declare readonly details: BetaStorageAttachLimitReachedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaStorageAttachLimitReachedError';
}

/**
 * This External Storage can't be attached to the setting named in `field`. The
 * error's `message` says why.
 */
export class BetaStorageNotAttachableError extends BadRequestError {
  declare readonly errorCode: 'storage_not_attachable';
  declare readonly details: BetaStorageNotAttachableErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaStorageNotAttachableError';
}

/**
 * This storage is bound to a different user profile from storage the Workspace has
 * attached, or from active or draining storage it once had for safeguards data.
 * Detaching storage the Workspace uses only for transcripts clears this. Detaching
 * safeguards storage doesn't, so use a new Workspace instead.
 */
export class BetaStorageProfileStillRequiredError extends BadRequestError {
  declare readonly errorCode: 'storage_profile_still_required';
  declare readonly details: BetaStorageProfileStillRequiredErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaStorageProfileStillRequiredError';
}

/**
 * The External Storage failed verification, so the request changed nothing.
 * `failed_checks` lists what to fix.
 */
export class BetaStorageVerificationFailedError extends BadRequestError {
  declare readonly errorCode: 'storage_verification_failed';
  declare readonly details: BetaStorageVerificationFailedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaStorageVerificationFailedError';
}

/**
 * `provider_config.region` is not a region where External Storage is available.
 */
export class BetaUnsupportedRegionError extends BadRequestError {
  declare readonly errorCode: 'unsupported_region';
  declare readonly details: BetaUnsupportedRegionErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaUnsupportedRegionError';
}

/**
 * The organization already has External Storage for this bucket that it has not
 * deleted. List the organization's External Storage to find it.
 */
export class BetaStorageAlreadyRegisteredError extends ConflictError {
  declare readonly errorCode: 'storage_already_registered';
  declare readonly details: BetaStorageAlreadyRegisteredErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaStorageAlreadyRegisteredError';
}

/**
 * Another request changed this storage setting while this one was running, so this
 * request left it as it is. Read the Workspace and send the request again if you
 * still want the change.
 */
export class BetaStorageChangedConcurrentlyError extends ConflictError {
  declare readonly errorCode: 'storage_changed_concurrently';
  declare readonly details: BetaStorageChangedConcurrentlyErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaStorageChangedConcurrentlyError';
}

export class ExternalStorage extends APIResource {
  /**
   * Register a bucket in the organization's own cloud account. It is saved as
   * `pending_configuration` and verified when activated.
   *
   * @throws {BetaGrantRequiredError}
   * @throws {BetaOrganizationNotEligibleError}
   * @throws {BetaProviderNotAllowedError}
   * @throws {BetaUnsupportedRegionError}
   * @throws {UserProfileNotFoundError}
   * @throws {SandboxEgressRestrictedError}
   * @throws {BetaStorageAlreadyRegisteredError}
   * @throws {BetaAuthorizationCheckUnavailableError}
   *
   * @example
   * ```ts
   * const betaExternalStorage =
   *   await client.beta.organization.externalStorage.create({
   *     provider_config: {
   *       account_id: '111122223333',
   *       bucket_name: 'acme-safety-retention',
   *       region: 'us-east-2',
   *       type: 'aws',
   *     },
   *   });
   * ```
   */
  create(params: ExternalStorageCreateParams, options?: RequestOptions): APIPromise<BetaExternalStorage> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/external_storage', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'efs-2026-10-01'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_storage.create', options, {
        route: '/v1/organizations/external_storage',
        createdIDAttribute: 'anthropic.organization.external_storage.id',
      }),
    });
  }

  /**
   * Get one External Storage in the organization.
   *
   * @throws {BetaInvalidStorageARNError}
   *
   * @example
   * ```ts
   * const betaExternalStorage =
   *   await client.beta.organization.externalStorage.retrieve(
   *     'external_storage_id',
   *   );
   * ```
   */
  retrieve(
    externalStorageID: string,
    params: ExternalStorageRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaExternalStorage> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/organizations/external_storage/${externalStorageID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'efs-2026-10-01'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_storage.retrieve', options, {
        route: '/v1/organizations/external_storage/{external_storage_id}',
        attributes: { 'anthropic.organization.external_storage.id': externalStorageID },
      }),
    });
  }

  /**
   * Rename External Storage or clear its name, in any status.
   *
   * @throws {BetaInvalidStorageARNError}
   * @throws {SandboxEgressRestrictedError}
   *
   * @example
   * ```ts
   * const betaExternalStorage =
   *   await client.beta.organization.externalStorage.update(
   *     'external_storage_id',
   *     { display_name: 'x' },
   *   );
   * ```
   */
  update(
    externalStorageID: string,
    params: ExternalStorageUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaExternalStorage> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/external_storage/${externalStorageID}`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'efs-2026-10-01'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_storage.update', options, {
        route: '/v1/organizations/external_storage/{external_storage_id}',
        attributes: { 'anthropic.organization.external_storage.id': externalStorageID },
      }),
    });
  }

  /**
   * List the organization's External Storage, newest first.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaExternalStorage of client.beta.organization.externalStorage.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: ExternalStorageListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaExternalStoragesPageCursor, BetaExternalStorage> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/organizations/external_storage', PageCursor<BetaExternalStorage>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'efs-2026-10-01'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_storage.list', options, {
        route: '/v1/organizations/external_storage',
        queryParams: ['limit', 'page', 'user_profile_ids'],
      }),
    });
  }

  /**
   * Delete External Storage. Storage that is pending configuration, available, or
   * active but never attached is deleted at once, unless an Enterprise Frontier
   * Safeguards workspace policy lists it. Other storage gets a 400 that says what to
   * do next. On `draining` storage that 400 can mean this delete started a removal
   * that can't be undone. To check, get the storage: if `status.removal_started` is
   * true, delete it again later to finish.
   *
   * @throws {BetaExternalStorageInUseError}
   * @throws {BetaExternalStorageInWorkspacePolicyError}
   * @throws {BetaInvalidStorageARNError}
   * @throws {SandboxEgressRestrictedError}
   *
   * @example
   * ```ts
   * const betaDeletedExternalStorage =
   *   await client.beta.organization.externalStorage.delete(
   *     'external_storage_id',
   *   );
   * ```
   */
  delete(
    externalStorageID: string,
    params: ExternalStorageDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaDeletedExternalStorage> {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/organizations/external_storage/${externalStorageID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'efs-2026-10-01'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_storage.delete', options, {
        route: '/v1/organizations/external_storage/{external_storage_id}',
        attributes: { 'anthropic.organization.external_storage.id': externalStorageID },
      }),
    });
  }

  /**
   * Verify pending External Storage and make it available. Storage that is already
   * available, active or draining comes back unchanged, without any check.
   *
   * @throws {BetaGrantRequiredError}
   * @throws {BetaInvalidStorageARNError}
   * @throws {BetaOrganizationNotEligibleError}
   * @throws {BetaProviderNotAllowedError}
   * @throws {BetaStorageVerificationFailedError}
   * @throws {UserProfileNotFoundError}
   * @throws {SandboxEgressRestrictedError}
   * @throws {BetaAuthorizationCheckUnavailableError}
   *
   * @example
   * ```ts
   * const betaExternalStorage =
   *   await client.beta.organization.externalStorage.activate(
   *     'external_storage_id',
   *   );
   * ```
   */
  activate(
    externalStorageID: string,
    params: ExternalStorageActivateParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaExternalStorage> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/organizations/external_storage/${externalStorageID}/activate`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'efs-2026-10-01'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.external_storage.activate', options, {
        route: '/v1/organizations/external_storage/{external_storage_id}/activate',
        attributes: { 'anthropic.organization.external_storage.id': externalStorageID },
      }),
    });
  }
}

export type BetaExternalStoragesPageCursor = PageCursor<BetaExternalStorage>;

/**
 * At least one Workspace has the storage attached.
 */
export interface BetaActiveExternalStorageStatus {
  /**
   * Whether the bucket passed its latest recorded check. It can stay `true` after
   * the bucket stops working, so don't use it for monitoring.
   */
  healthy: boolean;

  /**
   * When the bucket's latest recorded check ran, in RFC 3339.
   */
  last_checked_at: string;

  type: 'active';
}

/**
 * The storage is verified, no Workspace has it attached, and Anthropic doesn't use
 * the bucket.
 */
export interface BetaAvailableExternalStorageStatus {
  /**
   * Whether the bucket passed its latest recorded check. It can stay `true` after
   * the bucket stops working, so don't use it for monitoring.
   */
  healthy: boolean;

  /**
   * When the bucket's latest recorded check ran, in RFC 3339.
   */
  last_checked_at: string;

  type: 'available';
}

/**
 * An Amazon S3 bucket.
 */
export interface BetaAWSExternalStorageConfig {
  /**
   * 12-digit ID of the AWS account that owns the bucket.
   */
  account_id: string;

  /**
   * The bucket's name, without `s3://`.
   */
  bucket_name: string;

  /**
   * The bucket's AWS region.
   */
  region: string;

  type: 'aws';
}

/**
 * An Amazon S3 bucket.
 */
export interface BetaAWSExternalStorageConfigParam {
  /**
   * 12-digit ID of the AWS account that owns the bucket.
   */
  account_id: string;

  /**
   * The bucket's name, without `s3://`: 3 to 63 lower-case letters, digits and
   * hyphens, starting and ending with a letter or digit.
   */
  bucket_name: string;

  /**
   * The bucket's AWS region. Activating the storage fails if Anthropic can't use
   * buckets in that region.
   */
  region: string;

  type: 'aws';
}

export interface BetaDeletedExternalStorage {
  /**
   * The External Storage ID, which starts with `estrg_`. Through Claude Platform on
   * AWS, storage whose `provider_config.type` is `aws` has its bucket ARN as its ID
   * instead: `arn:<partition>:s3:::<bucket_name>`, where `<partition>` is the
   * partition of the bucket's region.
   */
  id: string;

  type: 'external_storage_deleted';
}

/**
 * No Workspace has the storage attached. A Workspace can attach it again, unless
 * `removal_started` is true.
 */
export interface BetaDrainingExternalStorageStatus {
  /**
   * Whether the bucket passed its latest recorded check. It can stay `true` after
   * the bucket stops working, so don't use it for monitoring.
   */
  healthy: boolean;

  /**
   * When the bucket's latest recorded check ran, in RFC 3339.
   */
  last_checked_at: string;

  /**
   * True once a delete has started removing this storage, which can't be undone. It
   * then can't be attached, and another delete finishes the removal.
   */
  removal_started: boolean;

  type: 'draining';
}

/**
 * A storage bucket in the organization's own cloud account. Anthropic writes
 * inference data to it from each Workspace it is attached to.
 */
export interface BetaExternalStorage {
  /**
   * The External Storage ID, which starts with `estrg_`. Through Claude Platform on
   * AWS, storage whose `provider_config.type` is `aws` has its bucket ARN as its ID
   * instead: `arn:<partition>:s3:::<bucket_name>`, where `<partition>` is the
   * partition of the bucket's region.
   */
  id: string;

  created_at: string;

  /**
   * Human-friendly display name. Null if none was set.
   */
  display_name: string | null;

  provider_config: BetaAWSExternalStorageConfig | BetaGCPExternalStorageConfig;

  /**
   * The version of Anthropic's setup template whose IAM role names this storage was
   * found to use at activation. Null if no version was recorded, as for storage not
   * yet activated or not on S3.
   */
  setup_template_version: string | null;

  status:
    | BetaPendingConfigurationExternalStorageStatus
    | BetaAvailableExternalStorageStatus
    | BetaActiveExternalStorageStatus
    | BetaDrainingExternalStorageStatus;

  type: 'external_storage';

  updated_at: string;

  /**
   * The user profile the storage is bound to, or null.
   */
  user_profile_id: string | null;
}

/**
 * One check that an External Storage's verification failed.
 */
export interface BetaExternalStorageFailedCheck {
  /**
   * Name of the check that failed, such as `versioning`, for code to branch on. New
   * names may be added; `other` is a check this API does not name. The value is a
   * name with no data of its own.
   */
  check:
    | 'already_registered'
    | 'assume_role'
    | 'bucket_empty'
    | 'bucket_not_confirmed'
    | 'bucket_policy'
    | 'bucket_settings'
    | 'default_encryption'
    | 'deletion_policy'
    | 'encryption'
    | 'grant_mismatch'
    | 'key_usable'
    | 'kms_key_refused'
    | 'lifecycle_no_archive'
    | 'lifecycle_rules'
    | 'lifecycle_template'
    | 'location_mismatch'
    | 'object_lock'
    | 'other'
    | 'ownership_enforced'
    | 'probe_failed'
    | 'probe_object'
    | 'probe_storage_class'
    | 'public_access_block'
    | 'region'
    | 'replication'
    | 'request_metrics'
    | 'request_payment'
    | 'transcripts_support'
    | 'trust_ingest_role'
    | 'trust_maintenance_role'
    | 'trust_media_erasure_role'
    | 'trust_read_role'
    | 'trust_transcripts_role'
    | 'trust_transcripts_verify_role'
    | 'trust_verify_role'
    | 'versioning';

  /**
   * What failed and how to fix it, in plain words.
   */
  message: string;

  /**
   * The part of your access grant that the check is about, such as `ingest`: on AWS,
   * one of the IAM roles your setup created; on Google Cloud, the grant to one of
   * Anthropic's service accounts. `null` when the check is not about one. New names
   * may be added. The value is a name with no data of its own.
   */
  role:
    | 'ingest'
    | 'maintenance'
    | 'media_erasure'
    | 'read'
    | 'transcripts'
    | 'transcripts_verify'
    | 'verify'
    | null;
}

/**
 * The External Storage is `active` or `draining`, so this delete didn't erase it.
 * The message says what to do next. On `draining` storage this delete may have
 * started a removal that can't be undone: get the storage and read
 * `status.removal_started`.
 */
export interface BetaExternalStorageInUseErrorDetails {
  error_code: 'external_storage_in_use';
}

/**
 * The External Storage can't be deleted while an Enterprise Frontier Safeguards
 * workspace policy lists it as allowed storage.
 */
export interface BetaExternalStorageInWorkspacePolicyErrorDetails {
  error_code: 'external_storage_in_workspace_policy';
}

/**
 * External Storage isn't available for this Workspace, so only `internal` storage
 * is accepted. The error's `message` says why.
 */
export interface BetaExternalStorageNotAvailableErrorDetails {
  error_code: 'external_storage_not_available';
}

/**
 * A Google Cloud Storage bucket.
 */
export interface BetaGCPExternalStorageConfig {
  /**
   * The bucket's name, without `gs://`.
   */
  bucket_name: string;

  /**
   * Number of the Google Cloud project that holds the bucket.
   */
  project_number: string;

  /**
   * The bucket's Google Cloud region.
   */
  region: string;

  type: 'gcp';
}

/**
 * A Google Cloud Storage bucket.
 */
export interface BetaGCPExternalStorageConfigParam {
  /**
   * The bucket's name, without `gs://`: 3 to 63 lower-case letters, digits and
   * hyphens, starting and ending with a letter or digit. It can't start with `goog`
   * or contain `google`.
   */
  bucket_name: string;

  /**
   * Project number, not project ID, of the Google Cloud project that holds the
   * bucket.
   */
  project_number: string;

  /**
   * The bucket's Google Cloud region, such as `us-east5`: one of the single regions
   * that the setup guide lists. Dual-regions and multi-regions aren't supported.
   */
  region: string;

  type: 'gcp';
}

/**
 * Anthropic has not approved External Storage for the organization, for the
 * Workspace or, for storage bound to a user profile, for that user profile.
 * Contact your Anthropic account team.
 */
export interface BetaGrantRequiredErrorDetails {
  error_code: 'grant_required';
}

/**
 * On Claude Platform on AWS, the External Storage ID in the request is neither a
 * bucket ARN nor an `estrg_` ID, or is the `estrg_` ID of AWS storage. Name AWS
 * storage by its bucket ARN, `arn:<partition>:s3:::<bucket_name>`, which responses
 * return as its `id`.
 */
export interface BetaInvalidStorageARNErrorDetails {
  error_code: 'invalid_storage_arn';
}

/**
 * The storage isn't verified yet.
 */
export interface BetaPendingConfigurationExternalStorageStatus {
  type: 'pending_configuration';
}

/**
 * The request can't use External Storage on this cloud provider. The error's
 * message says why.
 */
export interface BetaProviderNotAllowedErrorDetails {
  error_code: 'provider_not_allowed';
}

/**
 * The organization already has External Storage for this bucket that it has not
 * deleted. List the organization's External Storage to find it.
 */
export interface BetaStorageAlreadyRegisteredErrorDetails {
  error_code: 'storage_already_registered';
}

/**
 * The Workspace has reached its limit of 100 different External Storage resources
 * attached over its lifetime. Detached storage counts toward the limit until it is
 * deleted.
 */
export interface BetaStorageAttachLimitReachedErrorDetails {
  error_code: 'storage_attach_limit_reached';
}

/**
 * Another request changed this storage setting while this one was running, so this
 * request left it as it is. Read the Workspace and send the request again if you
 * still want the change.
 */
export interface BetaStorageChangedConcurrentlyErrorDetails {
  error_code: 'storage_changed_concurrently';

  /**
   * The storage setting that changed.
   */
  field: string;
}

/**
 * This External Storage can't be attached to the setting named in `field`. The
 * error's `message` says why.
 */
export interface BetaStorageNotAttachableErrorDetails {
  error_code: 'storage_not_attachable';

  /**
   * The request field at fault.
   */
  field: string;
}

/**
 * This storage is bound to a different user profile from storage the Workspace has
 * attached, or from active or draining storage it once had for safeguards data.
 * Detaching storage the Workspace uses only for transcripts clears this. Detaching
 * safeguards storage doesn't, so use a new Workspace instead.
 */
export interface BetaStorageProfileStillRequiredErrorDetails {
  error_code: 'storage_profile_still_required';
}

/**
 * The External Storage failed verification, so the request changed nothing.
 * `failed_checks` lists what to fix.
 */
export interface BetaStorageVerificationFailedErrorDetails {
  error_code: 'storage_verification_failed';

  /**
   * One entry for each check that failed.
   */
  failed_checks: Array<BetaExternalStorageFailedCheck>;

  /**
   * The request field at fault. Sent when the refused request is a Workspace's
   * create or update.
   */
  field?: string | null;
}

/**
 * `provider_config.region` is not a region where External Storage is available.
 */
export interface BetaUnsupportedRegionErrorDetails {
  error_code: 'unsupported_region';
}

export interface ExternalStorageCreateParams {
  /**
   * Body param
   */
  provider_config: BetaAWSExternalStorageConfigParam | BetaGCPExternalStorageConfigParam;

  /**
   * Body param: Human-friendly display name.
   */
  display_name?: string | null;

  /**
   * Body param: The user profile to bind the storage to. It can't be changed later.
   * The storage can be attached only to Workspaces with this profile, and the
   * bucket's setup must name the same ID.
   */
  user_profile_id?: string | null;

  /**
   * Header param: This endpoint is in beta: requests must send `efs-2026-10-01` in
   * this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ExternalStorageRetrieveParams {
  /**
   * This endpoint is in beta: requests must send `efs-2026-10-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ExternalStorageUpdateParams {
  /**
   * Body param: Human-friendly display name; null clears it.
   */
  display_name: string | null;

  /**
   * Header param: This endpoint is in beta: requests must send `efs-2026-10-01` in
   * this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ExternalStorageListParams extends PageCursorParams {
  /**
   * Query param: Returns only External Storage bound to one of these user profile
   * IDs (`uprof_...`). An empty entry matches storage bound to no user profile. At
   * most 10 entries, counting repeats.
   */
  user_profile_ids?: Array<string> | null;

  /**
   * Header param: This endpoint is in beta: requests must send `efs-2026-10-01` in
   * this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ExternalStorageDeleteParams {
  /**
   * This endpoint is in beta: requests must send `efs-2026-10-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ExternalStorageActivateParams {
  /**
   * This endpoint is in beta: requests must send `efs-2026-10-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

ExternalStorage.BetaExternalStorageInUseError = BetaExternalStorageInUseError;
ExternalStorage.BetaExternalStorageInWorkspacePolicyError = BetaExternalStorageInWorkspacePolicyError;
ExternalStorage.BetaExternalStorageNotAvailableError = BetaExternalStorageNotAvailableError;
ExternalStorage.BetaGrantRequiredError = BetaGrantRequiredError;
ExternalStorage.BetaInvalidStorageARNError = BetaInvalidStorageARNError;
ExternalStorage.BetaProviderNotAllowedError = BetaProviderNotAllowedError;
ExternalStorage.BetaStorageAttachLimitReachedError = BetaStorageAttachLimitReachedError;
ExternalStorage.BetaStorageNotAttachableError = BetaStorageNotAttachableError;
ExternalStorage.BetaStorageProfileStillRequiredError = BetaStorageProfileStillRequiredError;
ExternalStorage.BetaStorageVerificationFailedError = BetaStorageVerificationFailedError;
ExternalStorage.BetaUnsupportedRegionError = BetaUnsupportedRegionError;
ExternalStorage.BetaStorageAlreadyRegisteredError = BetaStorageAlreadyRegisteredError;
ExternalStorage.BetaStorageChangedConcurrentlyError = BetaStorageChangedConcurrentlyError;

export declare namespace ExternalStorage {
  export {
    BetaExternalStorageInUseError as BetaExternalStorageInUseError,
    BetaExternalStorageInWorkspacePolicyError as BetaExternalStorageInWorkspacePolicyError,
    BetaExternalStorageNotAvailableError as BetaExternalStorageNotAvailableError,
    BetaGrantRequiredError as BetaGrantRequiredError,
    BetaInvalidStorageARNError as BetaInvalidStorageARNError,
    BetaProviderNotAllowedError as BetaProviderNotAllowedError,
    BetaStorageAttachLimitReachedError as BetaStorageAttachLimitReachedError,
    BetaStorageNotAttachableError as BetaStorageNotAttachableError,
    BetaStorageProfileStillRequiredError as BetaStorageProfileStillRequiredError,
    BetaStorageVerificationFailedError as BetaStorageVerificationFailedError,
    BetaUnsupportedRegionError as BetaUnsupportedRegionError,
    BetaStorageAlreadyRegisteredError as BetaStorageAlreadyRegisteredError,
    BetaStorageChangedConcurrentlyError as BetaStorageChangedConcurrentlyError,
    type BetaActiveExternalStorageStatus as BetaActiveExternalStorageStatus,
    type BetaAvailableExternalStorageStatus as BetaAvailableExternalStorageStatus,
    type BetaAWSExternalStorageConfig as BetaAWSExternalStorageConfig,
    type BetaAWSExternalStorageConfigParam as BetaAWSExternalStorageConfigParam,
    type BetaDeletedExternalStorage as BetaDeletedExternalStorage,
    type BetaDrainingExternalStorageStatus as BetaDrainingExternalStorageStatus,
    type BetaExternalStorage as BetaExternalStorage,
    type BetaExternalStorageFailedCheck as BetaExternalStorageFailedCheck,
    type BetaExternalStorageInUseErrorDetails as BetaExternalStorageInUseErrorDetails,
    type BetaExternalStorageInWorkspacePolicyErrorDetails as BetaExternalStorageInWorkspacePolicyErrorDetails,
    type BetaExternalStorageNotAvailableErrorDetails as BetaExternalStorageNotAvailableErrorDetails,
    type BetaGCPExternalStorageConfig as BetaGCPExternalStorageConfig,
    type BetaGCPExternalStorageConfigParam as BetaGCPExternalStorageConfigParam,
    type BetaGrantRequiredErrorDetails as BetaGrantRequiredErrorDetails,
    type BetaInvalidStorageARNErrorDetails as BetaInvalidStorageARNErrorDetails,
    type BetaPendingConfigurationExternalStorageStatus as BetaPendingConfigurationExternalStorageStatus,
    type BetaProviderNotAllowedErrorDetails as BetaProviderNotAllowedErrorDetails,
    type BetaStorageAlreadyRegisteredErrorDetails as BetaStorageAlreadyRegisteredErrorDetails,
    type BetaStorageAttachLimitReachedErrorDetails as BetaStorageAttachLimitReachedErrorDetails,
    type BetaStorageChangedConcurrentlyErrorDetails as BetaStorageChangedConcurrentlyErrorDetails,
    type BetaStorageNotAttachableErrorDetails as BetaStorageNotAttachableErrorDetails,
    type BetaStorageProfileStillRequiredErrorDetails as BetaStorageProfileStillRequiredErrorDetails,
    type BetaStorageVerificationFailedErrorDetails as BetaStorageVerificationFailedErrorDetails,
    type BetaUnsupportedRegionErrorDetails as BetaUnsupportedRegionErrorDetails,
    type BetaExternalStoragesPageCursor as BetaExternalStoragesPageCursor,
    type ExternalStorageCreateParams as ExternalStorageCreateParams,
    type ExternalStorageRetrieveParams as ExternalStorageRetrieveParams,
    type ExternalStorageUpdateParams as ExternalStorageUpdateParams,
    type ExternalStorageListParams as ExternalStorageListParams,
    type ExternalStorageDeleteParams as ExternalStorageDeleteParams,
    type ExternalStorageActivateParams as ExternalStorageActivateParams,
  };
}
