import { APIResource } from '../../../../../../core/resource';
import * as BetaAPI from '../../../../beta';
import { APIPromise } from '../../../../../../core/api-promise';
import { buildHeaders } from '../../../../../../internal/headers';
import { RequestOptions } from '../../../../../../internal/request-options';
import { startApiCallSpan } from '../../../../../../internal/tracing';
import { path } from '../../../../../../internal/utils/path';

export class DataControls extends APIResource {
  /**
   * Get a Google Cloud project's encryption keys and storage buckets for Claude on
   * Google Cloud's Agent Platform, with each region's status.
   *
   * Your organization must have proved that it owns the project.
   *
   * @example
   * ```ts
   * const betaGoogleManagedProjectDataControls =
   *   await client.beta.organization.providers.google.projects.dataControls.retrieve(
   *     '123456789012',
   *   );
   * ```
   */
  retrieve(
    projectNumber: string,
    params: DataControlRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaGoogleManagedProjectDataControls> {
    const { betas } = params ?? {};
    return this._client.get(
      path`/v1/organizations/providers/google/projects/${projectNumber}/data_controls`,
      {
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'google-managed-data-controls-2026-09-01'].toString() },
          options?.headers,
        ]),
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.providers.google.projects.data_controls.retrieve',
          options,
          {
            route: '/v1/organizations/providers/google/projects/{project_number}/data_controls',
            attributes: { 'anthropic.organization.provider.google.project.id': projectNumber },
          },
        ),
      },
    );
  }

  /**
   * Turn a control on or off, or change the key or bucket set for a region. Controls
   * and regions that you leave out stay as they are.
   *
   * Your organization must have proved that it owns the project. Only one
   * organization at a time can have controls turned on for a project.
   *
   * **Requires a credential that identifies a user or a service account**: an OAuth
   * access token with the `org:admin` scope, or an organization-scoped API key that
   * belongs to a user or service account whose organization role can update these
   * controls. The `admin`, `owner` and `primary_owner` roles can. An Admin API key
   * gets a `403` error.
   *
   * @throws {BetaCMEKNotApprovedError}
   * @throws {BetaExternalKeyNotFoundError}
   * @throws {BetaExternalKeyProviderMismatchError}
   * @throws {BetaGCPProjectNotVerifiedError}
   * @throws {KeyProfileMismatchError}
   * @throws {BetaOrganizationNotEligibleError}
   * @throws {BetaRegionNotSupportedError}
   * @throws {BetaStorageNotApprovedError}
   * @throws {SandboxEgressRestrictedError}
   * @throws {BetaGCPProjectControlledByAnotherOrganizationError}
   * @throws {BetaStorageInUseError}
   * @throws {BetaAuthorizationCheckUnavailableError}
   *
   * @example
   * ```ts
   * const betaGoogleManagedProjectDataControls =
   *   await client.beta.organization.providers.google.projects.dataControls.update(
   *     '123456789012',
   *     {},
   *   );
   * ```
   */
  update(
    projectNumber: string,
    params: DataControlUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaGoogleManagedProjectDataControls> {
    const { betas, ...body } = params;
    return this._client.post(
      path`/v1/organizations/providers/google/projects/${projectNumber}/data_controls`,
      {
        body,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'google-managed-data-controls-2026-09-01'].toString() },
          options?.headers,
        ]),
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.providers.google.projects.data_controls.update',
          options,
          {
            route: '/v1/organizations/providers/google/projects/{project_number}/data_controls',
            attributes: { 'anthropic.organization.provider.google.project.id': projectNumber },
          },
        ),
      },
    );
  }
}

/**
 * A Cloud Storage bucket, named by the project that holds it and by its own name.
 */
export interface BetaGoogleManagedProjectBucketReference {
  /**
   * The bucket's Cloud Storage name.
   */
  bucket_name: string;

  /**
   * The number of the Google Cloud project that holds the bucket, in decimal.
   */
  project_number: string;
}

/**
 * The customer-managed encryption key control: the key in your Google Cloud KMS
 * that is set for each region. It covers the project's requests that name no user
 * profile, or a user profile that has no key of its own for the project.
 */
export type BetaGoogleManagedProjectCMEKControl =
  | BetaGoogleManagedProjectCMEKDisabled
  | BetaGoogleManagedProjectCMEKEnabled;

/**
 * The customer-managed encryption key control. Leave it out to keep the control as
 * it is. Send `cmek`, `storage`, or both.
 */
export type BetaGoogleManagedProjectCMEKControlParams =
  | BetaGoogleManagedProjectCMEKDisabledParams
  | BetaGoogleManagedProjectCMEKEnabledParams;

/**
 * The control is off and has no keys.
 */
export interface BetaGoogleManagedProjectCMEKDisabled {
  /**
   * Keys that a region has retired, earliest `expires_at` first.
   */
  retired_keys: Array<BetaGoogleManagedProjectRetiredKey>;

  type: 'disabled';
}

/**
 * Turns the control off and removes every region's key.
 */
export interface BetaGoogleManagedProjectCMEKDisabledParams {
  type: 'disabled';
}

/**
 * The control is on and has a key for at least one region.
 */
export interface BetaGoogleManagedProjectCMEKEnabled {
  /**
   * The ID of the External Key configured for each region (`ekey_...`), keyed by
   * region code. A region with no key is left out.
   */
  external_key_ids: { [key: string]: string };

  /**
   * Keys that a region has retired, earliest `expires_at` first.
   */
  retired_keys: Array<BetaGoogleManagedProjectRetiredKey>;

  /**
   * Each region's status for the control, keyed by region code. A region that your
   * organization is not offered may have no entry, and Anthropic may add regions.
   */
  status: { [key: string]: BetaGoogleManagedProjectCMEKRegionStatus };

  type: 'enabled';
}

/**
 * Turns the control on, or changes its keys while it is on.
 */
export interface BetaGoogleManagedProjectCMEKEnabledParams {
  type: 'enabled';

  /**
   * The External Key to use in each region, keyed by region code, such as `us` or
   * `eu`. An External Key ID (`ekey_...`) sets that region's key, `null` removes it,
   * and a region you leave out keeps its key. While the control is on, at least one
   * region must have a key.
   */
  external_key_ids?: { [key: string]: string | null };
}

/**
 * The configured key passed validation, and the region applies it.
 */
export interface BetaGoogleManagedProjectCMEKRegionActive {
  /**
   * The ID of the External Key that the region applies now (`ekey_...`). While a
   * replacement key is `pending` or `failed`, this is the previous key. `null` when
   * the region applies no key.
   */
  effective_external_key_id: string | null;

  /**
   * Why Google Cloud KMS refused the region's latest use of the key. `null` when the
   * region has no refusal to report. A `null` does not mean that the key works.
   */
  error: string | null;

  /**
   * When the region last got a successful answer from Google Cloud KMS for the key,
   * in RFC 3339 format. `null` when it has none to report.
   */
  last_checked_at: string | null;

  type: 'active';

  /**
   * When the status last became `active`, in RFC 3339 format.
   */
  validated_at: string;
}

/**
 * The region stopped retrying validation before the configured key passed. To
 * restart validation, send the region a key again. It can be the same key.
 */
export interface BetaGoogleManagedProjectCMEKRegionFailed {
  /**
   * The ID of the External Key that the region applies now (`ekey_...`). While a
   * replacement key is `pending` or `failed`, this is the previous key. `null` when
   * the region applies no key.
   */
  effective_external_key_id: string | null;

  /**
   * Why the region cannot use the configured key.
   */
  error: string;

  type: 'failed';
}

/**
 * No key is set for this region.
 */
export interface BetaGoogleManagedProjectCMEKRegionNotConfigured {
  /**
   * The ID of the External Key that the region applies now (`ekey_...`). While a
   * replacement key is `pending` or `failed`, this is the previous key. `null` when
   * the region applies no key.
   */
  effective_external_key_id: string | null;

  type: 'not_configured';
}

/**
 * The region is validating the configured key, or the key has passed validation
 * and the region has not started to apply it.
 */
export interface BetaGoogleManagedProjectCMEKRegionPending {
  /**
   * The ID of the External Key that the region applies now (`ekey_...`). While a
   * replacement key is `pending` or `failed`, this is the previous key. `null` when
   * the region applies no key.
   */
  effective_external_key_id: string | null;

  /**
   * Why the latest validation attempt failed. `null` when no attempt has failed.
   */
  error: string | null;

  type: 'pending';
}

export type BetaGoogleManagedProjectCMEKRegionStatus =
  | BetaGoogleManagedProjectCMEKRegionNotConfigured
  | BetaGoogleManagedProjectCMEKRegionPending
  | BetaGoogleManagedProjectCMEKRegionActive
  | BetaGoogleManagedProjectCMEKRegionFailed
  | BetaGoogleManagedProjectCMEKRegionSuspended;

/**
 * Anthropic has withdrawn or paused its approval of customer-managed keys for this
 * project, so the region does not apply the control.
 */
export interface BetaGoogleManagedProjectCMEKRegionSuspended {
  /**
   * The ID of the External Key that the region applies now (`ekey_...`). While a
   * replacement key is `pending` or `failed`, this is the previous key. `null` when
   * the region applies no key.
   */
  effective_external_key_id: string | null;

  type: 'suspended';
}

/**
 * A Google Cloud project's encryption key and storage bucket settings for Claude
 * on Google Cloud's Agent Platform. Your organization has one of these objects for
 * each Google Cloud project that it has proved it owns. You can read and update
 * it, but not create or delete it. Keys and buckets are set for each region. A
 * request's region depends on the Google endpoint it is sent to: `us` is the US
 * multi-region endpoint and the regional endpoint of every location whose name
 * starts with `us-`, `eu` is the EU multi-region endpoint and the regional
 * endpoint of every location whose name starts with `europe-`, `sg` is the
 * `asia-southeast1` regional endpoint, and `global` is the global endpoint,
 * wherever Google serves the request. Anthropic may add regions.
 */
export interface BetaGoogleManagedProjectDataControls {
  /**
   * The customer-managed encryption key control: the key in your Google Cloud KMS
   * that is set for each region. It covers the project's requests that name no user
   * profile, or a user profile that has no key of its own for the project.
   */
  cmek: BetaGoogleManagedProjectCMEKControl;

  /**
   * The number of the Google Cloud project that these controls belong to, in
   * decimal.
   */
  project_number: string;

  /**
   * The customer-owned storage control: your Cloud Storage bucket that is set for
   * each region. It covers the project's requests that name no user profile, or a
   * user profile that has no bucket of its own for the project.
   */
  storage: BetaGoogleManagedProjectStorageControl;

  /**
   * Object type. Always `google_managed_project_data_controls`.
   */
  type: 'google_managed_project_data_controls';

  /**
   * When an update last changed a control, or a region's status last changed, in RFC
   * 3339 format. A region that starts or stops reading `suspended`, a change to
   * `last_checked_at` alone, and the removal of a retired entry do not count.
   */
  updated_at: string;
}

/**
 * A Cloud Storage bucket, named by the project that holds it and by its own name.
 */
export interface BetaGoogleManagedProjectEffectiveBucket {
  /**
   * The bucket's Cloud Storage name.
   */
  bucket_name: string;

  /**
   * The number of the Google Cloud project that holds the bucket, in decimal.
   */
  project_number: string;
}

/**
 * A bucket that a region has retired. Until `expires_at`, keep the bucket and
 * Anthropic's access to it as they were when the bucket passed verification.
 */
export interface BetaGoogleManagedProjectRetiredBucket {
  /**
   * The bucket's Cloud Storage name.
   */
  bucket_name: string;

  /**
   * When this entry is removed, in RFC 3339 format.
   */
  expires_at: string;

  /**
   * The number of the Google Cloud project that holds the bucket, in decimal.
   */
  project_number: string;

  /**
   * The code of the region that retired the bucket.
   */
  region: string;
}

/**
 * A key that a region has retired. Keep the key usable until `expires_at`.
 */
export interface BetaGoogleManagedProjectRetiredKey {
  /**
   * When this entry is removed, in RFC 3339 format.
   */
  expires_at: string;

  /**
   * The ID of the retired External Key (`ekey_...`).
   */
  external_key_id: string;

  /**
   * The code of the region that retired the key.
   */
  region: string;
}

/**
 * The bucket configured for a region.
 */
export interface BetaGoogleManagedProjectStorageBucket {
  /**
   * The bucket's Cloud Storage name.
   */
  bucket_name: string;

  /**
   * The resource name of the Cloud KMS key that the bucket encrypts objects under by
   * default. `null` until the region has confirmed the bucket, and when the bucket
   * has no default key.
   */
  kms_key_name: string | null;

  /**
   * The bucket's location, as Cloud Storage reports it. `null` until the region has
   * confirmed the bucket.
   */
  location: string | null;

  /**
   * The ID of the project that holds the bucket. `null` until the region has
   * confirmed the bucket.
   */
  project_id: string | null;

  /**
   * The number of the Google Cloud project that holds the bucket, in decimal.
   */
  project_number: string;
}

/**
 * The customer-owned storage control: your Cloud Storage bucket that is set for
 * each region. It covers the project's requests that name no user profile, or a
 * user profile that has no bucket of its own for the project.
 */
export type BetaGoogleManagedProjectStorageControl =
  | BetaGoogleManagedProjectStorageDisabled
  | BetaGoogleManagedProjectStorageEnabled;

/**
 * The customer-owned storage control. Leave it out to keep the control as it is.
 * Send `cmek`, `storage`, or both.
 */
export type BetaGoogleManagedProjectStorageControlParams =
  | BetaGoogleManagedProjectStorageDisabledParams
  | BetaGoogleManagedProjectStorageEnabledParams;

/**
 * The control is off and has no buckets.
 */
export interface BetaGoogleManagedProjectStorageDisabled {
  /**
   * Buckets that a region has retired, earliest `expires_at` first.
   */
  retired_buckets: Array<BetaGoogleManagedProjectRetiredBucket>;

  type: 'disabled';
}

/**
 * Turns the control off and removes every region's bucket.
 */
export interface BetaGoogleManagedProjectStorageDisabledParams {
  type: 'disabled';
}

/**
 * The control is on and has a bucket for at least one region.
 */
export interface BetaGoogleManagedProjectStorageEnabled {
  /**
   * The bucket configured for each region, keyed by region code. A region with no
   * bucket is left out.
   */
  buckets: { [key: string]: BetaGoogleManagedProjectStorageBucket };

  /**
   * Buckets that a region has retired, earliest `expires_at` first.
   */
  retired_buckets: Array<BetaGoogleManagedProjectRetiredBucket>;

  /**
   * Each region's status for the control, keyed by region code. A region that your
   * organization is not offered may have no entry, and Anthropic may add regions.
   */
  status: { [key: string]: BetaGoogleManagedProjectStorageRegionStatus };

  type: 'enabled';
}

/**
 * Turns the control on, or changes its buckets while it is on.
 */
export interface BetaGoogleManagedProjectStorageEnabledParams {
  type: 'enabled';

  /**
   * The bucket to use in each region, keyed by region code, such as `us` or `eu`. An
   * object with `project_number` and `bucket_name` sets that region's bucket, `null`
   * removes it, and a region you leave out keeps its bucket. A bucket can serve only
   * one region. While the control is on, at least one region must have a bucket.
   */
  buckets?: { [key: string]: BetaGoogleManagedProjectBucketReference | null };
}

/**
 * One check that a verification attempt failed.
 */
export interface BetaGoogleManagedProjectStorageFailedCheck {
  /**
   * Which check failed, such as `label_mismatch` or `grant_mismatch`. Anthropic may
   * add values.
   */
  check:
    | 'bucket_settings'
    | 'deletion_policy'
    | 'encryption'
    | 'grant_mismatch'
    | 'kms_key_refused'
    | 'label_mismatch'
    | 'lifecycle_rules'
    | 'location_mismatch'
    | 'probe_failed'
    | 'project_not_verified'
    | 'versioning';

  /**
   * What failed and, where you can fix it, what to change.
   */
  message: string;

  /**
   * On a check about one of the accounts that Anthropic uses to reach the bucket,
   * that account's kind of access, such as `ingest`. `null` on any other check.
   * Anthropic may add values.
   */
  role: 'ingest' | 'maintenance' | 'media_erasure' | 'read' | 'verify' | null;
}

/**
 * The configured bucket passed verification, and the region applies it.
 */
export interface BetaGoogleManagedProjectStorageRegionActive {
  /**
   * The bucket that the region applies now. While a replacement bucket is `pending`
   * or `failed`, this is the previous bucket. `null` when the region applies no
   * bucket.
   */
  effective_bucket: BetaGoogleManagedProjectEffectiveBucket | null;

  /**
   * The checks that the latest reported daily verification failed. Empty when it
   * passed.
   */
  failed_checks: Array<BetaGoogleManagedProjectStorageFailedCheck>;

  type: 'active';

  /**
   * When the status last became `active`, in RFC 3339 format.
   */
  validated_at: string;
}

/**
 * The region stopped retrying verification before the configured bucket passed. To
 * restart verification, send the region a bucket again. It can be the same bucket.
 */
export interface BetaGoogleManagedProjectStorageRegionFailed {
  /**
   * The bucket that the region applies now. While a replacement bucket is `pending`
   * or `failed`, this is the previous bucket. `null` when the region applies no
   * bucket.
   */
  effective_bucket: BetaGoogleManagedProjectEffectiveBucket | null;

  /**
   * The checks that the last reported verification attempt failed.
   */
  failed_checks: Array<BetaGoogleManagedProjectStorageFailedCheck>;

  type: 'failed';
}

/**
 * No bucket is set for this region.
 */
export interface BetaGoogleManagedProjectStorageRegionNotConfigured {
  /**
   * The bucket that the region applies now. While a replacement bucket is `pending`
   * or `failed`, this is the previous bucket. `null` when the region applies no
   * bucket.
   */
  effective_bucket: BetaGoogleManagedProjectEffectiveBucket | null;

  type: 'not_configured';
}

/**
 * The region is verifying the configured bucket.
 */
export interface BetaGoogleManagedProjectStorageRegionPending {
  /**
   * The bucket that the region applies now. While a replacement bucket is `pending`
   * or `failed`, this is the previous bucket. `null` when the region applies no
   * bucket.
   */
  effective_bucket: BetaGoogleManagedProjectEffectiveBucket | null;

  /**
   * The checks that the latest reported verification attempt failed. Empty when none
   * has failed.
   */
  failed_checks: Array<BetaGoogleManagedProjectStorageFailedCheck>;

  type: 'pending';
}

export type BetaGoogleManagedProjectStorageRegionStatus =
  | BetaGoogleManagedProjectStorageRegionNotConfigured
  | BetaGoogleManagedProjectStorageRegionPending
  | BetaGoogleManagedProjectStorageRegionActive
  | BetaGoogleManagedProjectStorageRegionFailed
  | BetaGoogleManagedProjectStorageRegionSuspended;

/**
 * Anthropic has withdrawn or paused its approval of customer-owned storage for
 * this project, so the region does not apply the control.
 */
export interface BetaGoogleManagedProjectStorageRegionSuspended {
  /**
   * The bucket that the region applies now. While a replacement bucket is `pending`
   * or `failed`, this is the previous bucket. `null` when the region applies no
   * bucket.
   */
  effective_bucket: BetaGoogleManagedProjectEffectiveBucket | null;

  type: 'suspended';
}

export interface DataControlRetrieveParams {
  /**
   * This endpoint is in beta: requests must send
   * `google-managed-data-controls-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DataControlUpdateParams {
  /**
   * Body param: The customer-managed encryption key control. Leave it out to keep
   * the control as it is. Send `cmek`, `storage`, or both.
   */
  cmek?: BetaGoogleManagedProjectCMEKControlParams;

  /**
   * Body param: The customer-owned storage control. Leave it out to keep the control
   * as it is. Send `cmek`, `storage`, or both.
   */
  storage?: BetaGoogleManagedProjectStorageControlParams;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `google-managed-data-controls-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace DataControls {
  export {
    type BetaGoogleManagedProjectBucketReference as BetaGoogleManagedProjectBucketReference,
    type BetaGoogleManagedProjectCMEKControl as BetaGoogleManagedProjectCMEKControl,
    type BetaGoogleManagedProjectCMEKControlParams as BetaGoogleManagedProjectCMEKControlParams,
    type BetaGoogleManagedProjectCMEKDisabled as BetaGoogleManagedProjectCMEKDisabled,
    type BetaGoogleManagedProjectCMEKDisabledParams as BetaGoogleManagedProjectCMEKDisabledParams,
    type BetaGoogleManagedProjectCMEKEnabled as BetaGoogleManagedProjectCMEKEnabled,
    type BetaGoogleManagedProjectCMEKEnabledParams as BetaGoogleManagedProjectCMEKEnabledParams,
    type BetaGoogleManagedProjectCMEKRegionActive as BetaGoogleManagedProjectCMEKRegionActive,
    type BetaGoogleManagedProjectCMEKRegionFailed as BetaGoogleManagedProjectCMEKRegionFailed,
    type BetaGoogleManagedProjectCMEKRegionNotConfigured as BetaGoogleManagedProjectCMEKRegionNotConfigured,
    type BetaGoogleManagedProjectCMEKRegionPending as BetaGoogleManagedProjectCMEKRegionPending,
    type BetaGoogleManagedProjectCMEKRegionStatus as BetaGoogleManagedProjectCMEKRegionStatus,
    type BetaGoogleManagedProjectCMEKRegionSuspended as BetaGoogleManagedProjectCMEKRegionSuspended,
    type BetaGoogleManagedProjectDataControls as BetaGoogleManagedProjectDataControls,
    type BetaGoogleManagedProjectEffectiveBucket as BetaGoogleManagedProjectEffectiveBucket,
    type BetaGoogleManagedProjectRetiredBucket as BetaGoogleManagedProjectRetiredBucket,
    type BetaGoogleManagedProjectRetiredKey as BetaGoogleManagedProjectRetiredKey,
    type BetaGoogleManagedProjectStorageBucket as BetaGoogleManagedProjectStorageBucket,
    type BetaGoogleManagedProjectStorageControl as BetaGoogleManagedProjectStorageControl,
    type BetaGoogleManagedProjectStorageControlParams as BetaGoogleManagedProjectStorageControlParams,
    type BetaGoogleManagedProjectStorageDisabled as BetaGoogleManagedProjectStorageDisabled,
    type BetaGoogleManagedProjectStorageDisabledParams as BetaGoogleManagedProjectStorageDisabledParams,
    type BetaGoogleManagedProjectStorageEnabled as BetaGoogleManagedProjectStorageEnabled,
    type BetaGoogleManagedProjectStorageEnabledParams as BetaGoogleManagedProjectStorageEnabledParams,
    type BetaGoogleManagedProjectStorageFailedCheck as BetaGoogleManagedProjectStorageFailedCheck,
    type BetaGoogleManagedProjectStorageRegionActive as BetaGoogleManagedProjectStorageRegionActive,
    type BetaGoogleManagedProjectStorageRegionFailed as BetaGoogleManagedProjectStorageRegionFailed,
    type BetaGoogleManagedProjectStorageRegionNotConfigured as BetaGoogleManagedProjectStorageRegionNotConfigured,
    type BetaGoogleManagedProjectStorageRegionPending as BetaGoogleManagedProjectStorageRegionPending,
    type BetaGoogleManagedProjectStorageRegionStatus as BetaGoogleManagedProjectStorageRegionStatus,
    type BetaGoogleManagedProjectStorageRegionSuspended as BetaGoogleManagedProjectStorageRegionSuspended,
    type DataControlRetrieveParams as DataControlRetrieveParams,
    type DataControlUpdateParams as DataControlUpdateParams,
  };
}
