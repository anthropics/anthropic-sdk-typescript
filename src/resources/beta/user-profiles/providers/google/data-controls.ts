import { APIResource } from '../../../../../core/resource';
import * as BetaAPI from '../../../beta';
import { APIPromise } from '../../../../../core/api-promise';
import { buildHeaders } from '../../../../../internal/headers';
import { RequestOptions } from '../../../../../internal/request-options';
import { startApiCallSpan } from '../../../../../internal/tracing';
import { path } from '../../../../../internal/utils/path';

export class DataControls extends APIResource {
  /**
   * Get the profile's encryption keys and storage buckets for Claude on Google
   * Cloud's Agent Platform, with each region's status.
   *
   * @example
   * ```ts
   * const betaGoogleManagedDataControls =
   *   await client.beta.userProfiles.providers.google.dataControls.retrieve(
   *     'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   *   );
   * ```
   */
  retrieve(
    userProfileID: string,
    params: DataControlRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaGoogleManagedDataControls> {
    const { betas, workspace_id } = params ?? {};
    return this._client.get(path`/v1/user_profiles/${userProfileID}/providers/google/data_controls`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [
            ...(betas ?? []),
            'user-profiles-2026-09-04,google-managed-data-controls-2026-09-01',
          ].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.user_profiles.providers.google.data_controls.retrieve',
        options,
        {
          route: '/v1/user_profiles/{user_profile_id}/providers/google/data_controls',
          attributes: { 'anthropic.user_profile.id': userProfileID },
        },
      ),
    });
  }

  /**
   * Turn a control on or off, or change the key or bucket set for a region. Controls
   * and regions that you leave out stay as they are.
   *
   * @example
   * ```ts
   * const betaGoogleManagedDataControls =
   *   await client.beta.userProfiles.providers.google.dataControls.update(
   *     'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   *     {},
   *   );
   * ```
   */
  update(
    userProfileID: string,
    params: DataControlUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaGoogleManagedDataControls> {
    const { betas, workspace_id, ...body } = params;
    return this._client.post(path`/v1/user_profiles/${userProfileID}/providers/google/data_controls`, {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [
            ...(betas ?? []),
            'user-profiles-2026-09-04,google-managed-data-controls-2026-09-01',
          ].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.user_profiles.providers.google.data_controls.update',
        options,
        {
          route: '/v1/user_profiles/{user_profile_id}/providers/google/data_controls',
          attributes: { 'anthropic.user_profile.id': userProfileID },
        },
      ),
    });
  }
}

/**
 * A Cloud Storage bucket, named by the project that holds it and by its own name.
 */
export interface BetaGoogleManagedBucketReference {
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
 * The customer-managed encryption key control, discriminated by `type`.
 */
export type BetaGoogleManagedCMEKControl = BetaGoogleManagedCMEKDisabled | BetaGoogleManagedCMEKEnabled;

/**
 * How to set the `cmek` control, discriminated by `type`.
 */
export type BetaGoogleManagedCMEKControlParams =
  | BetaGoogleManagedCMEKDisabledParams
  | BetaGoogleManagedCMEKEnabledParams;

/**
 * The control is off and has no keys.
 */
export interface BetaGoogleManagedCMEKDisabled {
  /**
   * Keys that a region has retired, earliest `expires_at` first.
   */
  retired_keys: Array<BetaGoogleManagedRetiredKey>;

  type: 'disabled';
}

/**
 * Turns the control off and removes every region's key.
 */
export interface BetaGoogleManagedCMEKDisabledParams {
  type: 'disabled';
}

/**
 * The control is on and has a key for at least one region.
 */
export interface BetaGoogleManagedCMEKEnabled {
  /**
   * The ID of the External Key configured for each region (`ekey_...`), keyed by
   * region code. A region with no key is left out.
   */
  external_key_ids: { [key: string]: string };

  /**
   * Keys that a region has retired, earliest `expires_at` first.
   */
  retired_keys: Array<BetaGoogleManagedRetiredKey>;

  /**
   * Each region's status for the control, keyed by region code. A region that your
   * organization is not offered may have no entry, and Anthropic may add regions.
   */
  status: { [key: string]: BetaGoogleManagedCMEKRegionStatus };

  type: 'enabled';
}

/**
 * Turns the control on, or changes its keys while it is on.
 */
export interface BetaGoogleManagedCMEKEnabledParams {
  type: 'enabled';

  /**
   * The External Key to use in each region, keyed by region code, such as `us` or
   * `eu`. An External Key ID (`ekey_...`) sets that region's key, `null` removes it,
   * and a region you leave out keeps its key. While the control is on, at least one
   * region must have a key.
   */
  external_key_ids?: { [key: string]: string | null } | null;
}

/**
 * The configured key passed validation, and the region applies it.
 */
export interface BetaGoogleManagedCMEKRegionActive {
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
export interface BetaGoogleManagedCMEKRegionFailed {
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
export interface BetaGoogleManagedCMEKRegionNotConfigured {
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
export interface BetaGoogleManagedCMEKRegionPending {
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

/**
 * One region's status for the `cmek` control, discriminated by `type`.
 */
export type BetaGoogleManagedCMEKRegionStatus =
  | BetaGoogleManagedCMEKRegionNotConfigured
  | BetaGoogleManagedCMEKRegionPending
  | BetaGoogleManagedCMEKRegionActive
  | BetaGoogleManagedCMEKRegionFailed
  | BetaGoogleManagedCMEKRegionSuspended;

/**
 * Anthropic has withdrawn or paused its approval of customer-managed keys for this
 * profile, so the region does not apply the control.
 */
export interface BetaGoogleManagedCMEKRegionSuspended {
  /**
   * The ID of the External Key that the region applies now (`ekey_...`). While a
   * replacement key is `pending` or `failed`, this is the previous key. `null` when
   * the region applies no key.
   */
  effective_external_key_id: string | null;

  type: 'suspended';
}

/**
 * A user profile's encryption key and storage bucket settings for Claude on Google
 * Cloud's Agent Platform. Every user profile has one of these objects. You can
 * read and update it, but not create or delete it. Keys and buckets are set for
 * each region. A request's region depends on the Google endpoint it is sent to:
 * `us` is the US multi-region endpoint and the regional endpoint of every location
 * whose name starts with `us-`, `eu` is the EU multi-region endpoint and the
 * regional endpoint of every location whose name starts with `europe-`, `sg` is
 * the `asia-southeast1` regional endpoint, and `global` is the global endpoint,
 * wherever Google serves the request. Anthropic may add regions.
 */
export interface BetaGoogleManagedDataControls {
  /**
   * The label value that every bucket set up for this profile must have. It never
   * changes.
   */
  bucket_label_value: string;

  /**
   * The customer-managed encryption key control: the key in the end customer's
   * Google Cloud KMS that is set for each region.
   */
  cmek: BetaGoogleManagedCMEKControl;

  /**
   * The customer-owned storage control: the end customer's Cloud Storage bucket that
   * is set for each region.
   */
  storage: BetaGoogleManagedStorageControl;

  /**
   * Object type. Always `google_managed_data_controls`.
   */
  type: 'google_managed_data_controls';

  /**
   * When an update last changed a control, or a region's status last changed, in RFC
   * 3339 format. A region that starts or stops reading `suspended`, a change to
   * `last_checked_at` alone, and the removal of a retired entry do not count.
   */
  updated_at: string;

  /**
   * The ID of the user profile that these controls belong to (`uprof_...`).
   */
  user_profile_id: string;
}

/**
 * A bucket that a region has retired. Until `expires_at`, keep the bucket and
 * Anthropic's access to it as they were when the bucket passed verification.
 */
export interface BetaGoogleManagedRetiredBucket {
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
export interface BetaGoogleManagedRetiredKey {
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
export interface BetaGoogleManagedStorageBucket {
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
 * The customer-owned storage control, discriminated by `type`.
 */
export type BetaGoogleManagedStorageControl =
  | BetaGoogleManagedStorageDisabled
  | BetaGoogleManagedStorageEnabled;

/**
 * How to set the `storage` control, discriminated by `type`.
 */
export type BetaGoogleManagedStorageControlParams =
  | BetaGoogleManagedStorageDisabledParams
  | BetaGoogleManagedStorageEnabledParams;

/**
 * The control is off and has no buckets.
 */
export interface BetaGoogleManagedStorageDisabled {
  /**
   * Buckets that a region has retired, earliest `expires_at` first.
   */
  retired_buckets: Array<BetaGoogleManagedRetiredBucket>;

  type: 'disabled';
}

/**
 * Turns the control off and removes every region's bucket.
 */
export interface BetaGoogleManagedStorageDisabledParams {
  type: 'disabled';
}

/**
 * The control is on and has a bucket for at least one region.
 */
export interface BetaGoogleManagedStorageEnabled {
  /**
   * The bucket configured for each region, keyed by region code. A region with no
   * bucket is left out.
   */
  buckets: { [key: string]: BetaGoogleManagedStorageBucket };

  /**
   * Buckets that a region has retired, earliest `expires_at` first.
   */
  retired_buckets: Array<BetaGoogleManagedRetiredBucket>;

  /**
   * Each region's status for the control, keyed by region code. A region that your
   * organization is not offered may have no entry, and Anthropic may add regions.
   */
  status: { [key: string]: BetaGoogleManagedStorageRegionStatus };

  type: 'enabled';
}

/**
 * Turns the control on, or changes its buckets while it is on.
 */
export interface BetaGoogleManagedStorageEnabledParams {
  type: 'enabled';

  /**
   * The bucket to use in each region, keyed by region code, such as `us` or `eu`. An
   * object with `project_number` and `bucket_name` sets that region's bucket, `null`
   * removes it, and a region you leave out keeps its bucket. A bucket can serve only
   * one region. While the control is on, at least one region must have a bucket.
   */
  buckets?: { [key: string]: BetaGoogleManagedBucketReference | null };
}

/**
 * One check that a verification attempt failed.
 */
export interface BetaGoogleManagedStorageFailedCheck {
  /**
   * Which check failed, such as `label_mismatch` or `grant_mismatch`. Anthropic may
   * add values.
   */
  check:
    | 'label_mismatch'
    | 'location_mismatch'
    | 'encryption'
    | 'versioning'
    | 'bucket_settings'
    | 'lifecycle_rules'
    | 'deletion_policy'
    | 'grant_mismatch'
    | 'kms_key_refused'
    | 'probe_failed'
    | 'project_not_verified';

  /**
   * What failed and, where the end customer can fix it, what to change.
   */
  message: string;

  /**
   * On a check about one of the accounts that Anthropic uses to reach the bucket,
   * that account's kind of access, such as `ingest`. `null` on any other check.
   * Anthropic may add values.
   */
  role: 'ingest' | 'read' | 'maintenance' | 'media_erasure' | 'verify' | null;
}

/**
 * The configured bucket passed verification, and the region applies it.
 */
export interface BetaGoogleManagedStorageRegionActive {
  /**
   * The bucket that the region applies now. While a replacement bucket is `pending`
   * or `failed`, this is the previous bucket. `null` when the region applies no
   * bucket.
   */
  effective_bucket: BetaGoogleManagedBucketReference | null;

  /**
   * The checks that the latest reported daily verification failed. Empty when it
   * passed.
   */
  failed_checks: Array<BetaGoogleManagedStorageFailedCheck>;

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
export interface BetaGoogleManagedStorageRegionFailed {
  /**
   * The bucket that the region applies now. While a replacement bucket is `pending`
   * or `failed`, this is the previous bucket. `null` when the region applies no
   * bucket.
   */
  effective_bucket: BetaGoogleManagedBucketReference | null;

  /**
   * The checks that the last reported verification attempt failed.
   */
  failed_checks: Array<BetaGoogleManagedStorageFailedCheck>;

  type: 'failed';
}

/**
 * No bucket is set for this region.
 */
export interface BetaGoogleManagedStorageRegionNotConfigured {
  /**
   * The bucket that the region applies now. While a replacement bucket is `pending`
   * or `failed`, this is the previous bucket. `null` when the region applies no
   * bucket.
   */
  effective_bucket: BetaGoogleManagedBucketReference | null;

  type: 'not_configured';
}

/**
 * The region is verifying the configured bucket.
 */
export interface BetaGoogleManagedStorageRegionPending {
  /**
   * The bucket that the region applies now. While a replacement bucket is `pending`
   * or `failed`, this is the previous bucket. `null` when the region applies no
   * bucket.
   */
  effective_bucket: BetaGoogleManagedBucketReference | null;

  /**
   * The checks that the latest reported verification attempt failed. Empty when none
   * has failed.
   */
  failed_checks: Array<BetaGoogleManagedStorageFailedCheck>;

  type: 'pending';
}

/**
 * One region's status for the `storage` control, discriminated by `type`.
 */
export type BetaGoogleManagedStorageRegionStatus =
  | BetaGoogleManagedStorageRegionNotConfigured
  | BetaGoogleManagedStorageRegionPending
  | BetaGoogleManagedStorageRegionActive
  | BetaGoogleManagedStorageRegionFailed
  | BetaGoogleManagedStorageRegionSuspended;

/**
 * Anthropic has withdrawn or paused its approval of customer-owned storage for
 * this profile, so the region does not apply the control.
 */
export interface BetaGoogleManagedStorageRegionSuspended {
  /**
   * The bucket that the region applies now. While a replacement bucket is `pending`
   * or `failed`, this is the previous bucket. `null` when the region applies no
   * bucket.
   */
  effective_bucket: BetaGoogleManagedBucketReference | null;

  type: 'suspended';
}

export interface DataControlRetrieveParams {
  /**
   * This endpoint is in beta: requests must send
   * `google-managed-data-controls-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Optional header to select the Workspace for this request. The value is a
   * Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface DataControlUpdateParams {
  /**
   * Body param: The customer-managed encryption key control. Leave it out to keep
   * the control as it is. Send `cmek`, `storage`, or both.
   */
  cmek?: BetaGoogleManagedCMEKControlParams;

  /**
   * Body param: The customer-owned storage control. Leave it out to keep the control
   * as it is. Send `cmek`, `storage`, or both.
   */
  storage?: BetaGoogleManagedStorageControlParams;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `google-managed-data-controls-2026-09-01` in this header.
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

export declare namespace DataControls {
  export {
    type BetaGoogleManagedBucketReference as BetaGoogleManagedBucketReference,
    type BetaGoogleManagedCMEKControl as BetaGoogleManagedCMEKControl,
    type BetaGoogleManagedCMEKControlParams as BetaGoogleManagedCMEKControlParams,
    type BetaGoogleManagedCMEKDisabled as BetaGoogleManagedCMEKDisabled,
    type BetaGoogleManagedCMEKDisabledParams as BetaGoogleManagedCMEKDisabledParams,
    type BetaGoogleManagedCMEKEnabled as BetaGoogleManagedCMEKEnabled,
    type BetaGoogleManagedCMEKEnabledParams as BetaGoogleManagedCMEKEnabledParams,
    type BetaGoogleManagedCMEKRegionActive as BetaGoogleManagedCMEKRegionActive,
    type BetaGoogleManagedCMEKRegionFailed as BetaGoogleManagedCMEKRegionFailed,
    type BetaGoogleManagedCMEKRegionNotConfigured as BetaGoogleManagedCMEKRegionNotConfigured,
    type BetaGoogleManagedCMEKRegionPending as BetaGoogleManagedCMEKRegionPending,
    type BetaGoogleManagedCMEKRegionStatus as BetaGoogleManagedCMEKRegionStatus,
    type BetaGoogleManagedCMEKRegionSuspended as BetaGoogleManagedCMEKRegionSuspended,
    type BetaGoogleManagedDataControls as BetaGoogleManagedDataControls,
    type BetaGoogleManagedRetiredBucket as BetaGoogleManagedRetiredBucket,
    type BetaGoogleManagedRetiredKey as BetaGoogleManagedRetiredKey,
    type BetaGoogleManagedStorageBucket as BetaGoogleManagedStorageBucket,
    type BetaGoogleManagedStorageControl as BetaGoogleManagedStorageControl,
    type BetaGoogleManagedStorageControlParams as BetaGoogleManagedStorageControlParams,
    type BetaGoogleManagedStorageDisabled as BetaGoogleManagedStorageDisabled,
    type BetaGoogleManagedStorageDisabledParams as BetaGoogleManagedStorageDisabledParams,
    type BetaGoogleManagedStorageEnabled as BetaGoogleManagedStorageEnabled,
    type BetaGoogleManagedStorageEnabledParams as BetaGoogleManagedStorageEnabledParams,
    type BetaGoogleManagedStorageFailedCheck as BetaGoogleManagedStorageFailedCheck,
    type BetaGoogleManagedStorageRegionActive as BetaGoogleManagedStorageRegionActive,
    type BetaGoogleManagedStorageRegionFailed as BetaGoogleManagedStorageRegionFailed,
    type BetaGoogleManagedStorageRegionNotConfigured as BetaGoogleManagedStorageRegionNotConfigured,
    type BetaGoogleManagedStorageRegionPending as BetaGoogleManagedStorageRegionPending,
    type BetaGoogleManagedStorageRegionStatus as BetaGoogleManagedStorageRegionStatus,
    type BetaGoogleManagedStorageRegionSuspended as BetaGoogleManagedStorageRegionSuspended,
    type DataControlRetrieveParams as DataControlRetrieveParams,
    type DataControlUpdateParams as DataControlUpdateParams,
  };
}
