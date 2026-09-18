import { APIResource } from '../../core/resource';
import * as BetaAPI from './beta';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class UserProfiles extends APIResource {
  /**
   * Create User Profile
   *
   * @example
   * ```ts
   * const betaUserProfile =
   *   await client.beta.userProfiles.create();
   * ```
   */
  create(params: UserProfileCreateParams, options?: RequestOptions): APIPromise<BetaUserProfile> {
    const { betas, workspace_id, ...body } = params;
    return this._client.post('/v1/user_profiles?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'user-profiles-2026-08-18'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * Get User Profile
   *
   * @example
   * ```ts
   * const betaUserProfile =
   *   await client.beta.userProfiles.retrieve(
   *     'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   *   );
   * ```
   */
  retrieve(
    userProfileID: string,
    params: UserProfileRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaUserProfile> {
    const { betas, workspace_id } = params ?? {};
    return this._client.get(path`/v1/user_profiles/${userProfileID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'user-profiles-2026-08-18'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * Update User Profile
   *
   * @example
   * ```ts
   * const betaUserProfile =
   *   await client.beta.userProfiles.update(
   *     'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   *   );
   * ```
   */
  update(
    userProfileID: string,
    params: UserProfileUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaUserProfile> {
    const { betas, workspace_id, ...body } = params;
    return this._client.post(path`/v1/user_profiles/${userProfileID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'user-profiles-2026-08-18'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * List User Profiles
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaUserProfile of client.beta.userProfiles.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: UserProfileListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaUserProfilesPageCursor, BetaUserProfile> {
    const { betas, workspace_id, ...query } = params ?? {};
    return this._client.getAPIList('/v1/user_profiles?beta=true', PageCursor<BetaUserProfile>, {
      query,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'user-profiles-2026-08-18'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * Create Enrollment URL
   *
   * @example
   * ```ts
   * const betaUserProfileEnrollmentURL =
   *   await client.beta.userProfiles.createEnrollmentURL(
   *     'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   *   );
   * ```
   */
  createEnrollmentURL(
    userProfileID: string,
    params: UserProfileCreateEnrollmentURLParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaUserProfileEnrollmentURL> {
    const { betas, workspace_id } = params ?? {};
    return this._client.post(path`/v1/user_profiles/${userProfileID}/enrollment_url?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'user-profiles-2026-08-18'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }
}

export type BetaUserProfilesPageCursor = PageCursor<BetaUserProfile>;

/**
 * A record of an entity that the platform serves through the API, such as an
 * end-user of the platform's product or a company that the platform resells Claude
 * access to.
 *
 * A Messages, Message Batches or token counting request can send a profile's `id`
 * in the `anthropic-user-profile-id` header to attribute the request to that
 * entity.
 */
export interface BetaUserProfile {
  /**
   * Unique identifier for this user profile, prefixed `uprof_`.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  /**
   * Arbitrary key-value metadata. Maximum 16 pairs, keys up to 64 chars, values up
   * to 512 chars.
   */
  metadata: { [key: string]: string };

  /**
   * Trust grants for this profile, keyed by grant name. Key omitted when no grant is
   * active or in flight.
   */
  trust_grants: { [key: string]: BetaUserProfileTrustGrant };

  /**
   * Object type. Always `user_profile`.
   */
  type: 'user_profile';

  /**
   * A timestamp in RFC 3339 format
   */
  updated_at: string;

  /**
   * How the platform uses the API on behalf of the entity this profile represents.
   * `application`: the platform sells a product that uses the API behind the scenes,
   * and the profile represents an individual end-user of that product.
   * `passthrough`: the platform resells raw inference, and the profile identifies
   * the resold-to company.
   *
   * - `application` - The user profile represents an individual end-user of a
   *   product that the platform builds on the API. New profiles get this value by
   *   default.
   * - `passthrough` - The user profile represents a company that the platform
   *   resells Claude access to.
   */
  access_type?: 'application' | 'passthrough';

  /**
   * Platform's own identifier for this user. Not enforced unique. Present under the
   * `user-profiles-2026-03-24` and `user-profiles-2026-08-18` beta headers; under
   * `user-profiles-2026-09-04` the value is `external_user_details.reference_id`.
   */
  external_id?: string | null;

  /**
   * Details about the entity this profile represents, as the platform states them.
   * Anthropic does not verify them. Every field is present, `null` until the
   * platform supplies a value.
   */
  external_user_details?: BetaUserProfileExternalUserDetails;

  /**
   * A timestamp in RFC 3339 format
   */
  external_user_onboarded_at?: string | null;

  /**
   * Real-world name of the entity this profile represents (company or individual).
   * For a company the platform resells Claude access to (`access_type`
   * `passthrough`) this is that company's name.
   */
  name?: string | null;
}

/**
 * A URL to give to the entity that a user profile represents, so that the entity
 * can enroll for a trust grant.
 */
export interface BetaUserProfileEnrollmentURL {
  /**
   * A timestamp in RFC 3339 format
   */
  expires_at: string;

  /**
   * Object type. Always `enrollment_url`.
   */
  type: 'enrollment_url';

  /**
   * Enrollment URL to send to the end user. Valid until `expires_at`.
   */
  url: string;
}

/**
 * Details about the entity this profile represents, as the platform states them.
 * Anthropic does not verify them. Every field is present, `null` until the
 * platform supplies a value.
 */
export interface BetaUserProfileExternalUserDetails {
  /**
   * The status of the entity's account on the platform, as the platform states it:
   * `active`; `suspended`, when the platform has restricted the account and may
   * restore it; or `blocked`, when the platform has barred it. It records the
   * platform's decision only; the statuses in `trust_grants` are Anthropic's and do
   * not follow it.
   *
   * - `active` - The platform has neither restricted nor barred the account of the
   *   entity that the user profile represents.
   * - `suspended` - The platform has restricted the account of the entity that the
   *   user profile represents and may restore it.
   * - `blocked` - The platform has barred the account of the entity that the user
   *   profile represents.
   */
  account_status: 'active' | 'suspended' | 'blocked' | null;

  /**
   * The country the platform associates with the entity, as an ISO 3166-1 alpha-2
   * code. `null` until the platform supplies one.
   */
  country: string | null;

  /**
   * The platform-computed hash of the entity's email address. `null` until the
   * platform supplies one.
   */
  email_hash: string | null;

  /**
   * What kind of entity the profile represents, as the platform states it:
   * `individual`, `business`, `non_profit` or `government`.
   */
  entity_type: 'individual' | 'business' | 'non_profit' | 'government' | null;

  /**
   * The platform-computed hash of the entity's name. `null` until the platform
   * supplies one.
   */
  name_hash: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  onboarded_at: string | null;

  /**
   * The platform's own reference for the entity. `null` until the platform supplies
   * one.
   */
  reference_id: string | null;
}

export interface BetaUserProfileExternalUserDetailsParams {
  /**
   * The status of the entity's account on the platform, as the platform states it:
   * `active`; `suspended`, when the platform has restricted the account and may
   * restore it; or `blocked`, when the platform has barred it. It records the
   * platform's decision only; the statuses in `trust_grants` are Anthropic's and do
   * not follow it.
   *
   * - `active` - The platform has neither restricted nor barred the account of the
   *   entity that the user profile represents.
   * - `suspended` - The platform has restricted the account of the entity that the
   *   user profile represents and may restore it.
   * - `blocked` - The platform has barred the account of the entity that the user
   *   profile represents.
   */
  account_status?: 'active' | 'suspended' | 'blocked' | null;

  /**
   * The country of the entity (not of the platform), as the platform determines it:
   * an ISO 3166-1 alpha-2 code in upper case, for example `US`. Only the form, two
   * uppercase ASCII letters, is checked.
   */
  country?: string | null;

  /**
   * A hash of the entity's email address, computed by the platform. Anthropic treats
   * it as an opaque string and does not prescribe the hash function. 1 to 255
   * characters.
   */
  email_hash?: string | null;

  /**
   * What kind of entity the profile represents, as the platform states it:
   * `individual`, `business`, `non_profit` or `government`.
   */
  entity_type?: 'individual' | 'business' | 'non_profit' | 'government' | null;

  /**
   * A hash of the entity's name, computed by the platform. Anthropic treats it as an
   * opaque string and does not prescribe the hash function. 1 to 255 characters.
   */
  name_hash?: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  onboarded_at?: string;

  /**
   * The platform's own reference for the entity, for example the key of the
   * end-user's row in the platform's database. Not interpreted by Anthropic and not
   * enforced unique. 1 to 255 characters.
   */
  reference_id?: string | null;
}

/**
 * The status of one trust grant on a user profile, listed in the profile's
 * `trust_grants` map under the grant's name.
 */
export interface BetaUserProfileTrustGrant {
  /**
   * Status of the trust grant.
   */
  status: 'active' | 'pending' | 'rejected';
}

export interface UserProfileCreateParams {
  /**
   * Body param: How the platform uses the API on behalf of the entity this profile
   * represents. `application`: the platform sells a product that uses the API behind
   * the scenes, and the profile represents an individual end-user of that product.
   * `passthrough`: the platform resells raw inference, and the profile identifies
   * the resold-to company.
   *
   * - `application` - The user profile represents an individual end-user of a
   *   product that the platform builds on the API. New profiles get this value by
   *   default.
   * - `passthrough` - The user profile represents a company that the platform
   *   resells Claude access to.
   */
  access_type?: 'application' | 'passthrough';

  /**
   * Body param: Platform's own identifier for this user. Not enforced unique.
   * Maximum 255 characters. Accepted under the `user-profiles-2026-03-24` and
   * `user-profiles-2026-08-18` beta headers; under `user-profiles-2026-09-04` send
   * `external_user_details.reference_id` instead.
   */
  external_id?: string | null;

  /**
   * Body param: Details about the entity this profile represents, as the platform
   * states them. Every field is optional. Accepted under the
   * `user-profiles-2026-09-04` beta header only.
   */
  external_user_details?: BetaUserProfileExternalUserDetailsParams;

  /**
   * Body param: A timestamp in RFC 3339 format
   */
  external_user_onboarded_at?: string;

  /**
   * Body param: Free-form key-value data to attach to this user profile. Maximum 16
   * keys, with keys up to 64 characters and values up to 512 characters. Values must
   * be non-empty strings.
   */
  metadata?: { [key: string]: string };

  /**
   * Body param: Optional for all profiles. Real-world name of the entity this
   * profile represents (company or individual); for a company the platform resells
   * Claude access to (`access_type` `passthrough`), that company's name where known.
   * Maximum 255 characters.
   */
  name?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
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

export interface UserProfileRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
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

export interface UserProfileUpdateParams {
  /**
   * Body param: How the platform uses the API on behalf of the entity this profile
   * represents. `application`: the platform sells a product that uses the API behind
   * the scenes, and the profile represents an individual end-user of that product.
   * `passthrough`: the platform resells raw inference, and the profile identifies
   * the resold-to company.
   *
   * - `application` - The user profile represents an individual end-user of a
   *   product that the platform builds on the API. New profiles get this value by
   *   default.
   * - `passthrough` - The user profile represents a company that the platform
   *   resells Claude access to.
   */
  access_type?: 'application' | 'passthrough' | null;

  /**
   * Body param: If present, replaces the stored external_id. Omit to leave
   * unchanged. Maximum 255 characters. Accepted under the `user-profiles-2026-03-24`
   * and `user-profiles-2026-08-18` beta headers; under `user-profiles-2026-09-04`
   * send `external_user_details.reference_id` instead.
   */
  external_id?: string | null;

  /**
   * Body param: Details about the entity this profile represents, as the platform
   * states them. Each field sent replaces the stored value; omit a field to leave it
   * unchanged. Once set, a value cannot be cleared and `null` is rejected. Accepted
   * under the `user-profiles-2026-09-04` beta header only.
   */
  external_user_details?: BetaUserProfileExternalUserDetailsParams;

  /**
   * Body param: A timestamp in RFC 3339 format
   */
  external_user_onboarded_at?: string;

  /**
   * Body param: Key-value pairs to merge into the stored metadata. Keys provided
   * overwrite existing values. To remove a key, set its value to an empty string.
   * Keys not provided are left unchanged. Maximum 16 keys, with keys up to 64
   * characters and values up to 512 characters.
   */
  metadata?: { [key: string]: string };

  /**
   * Body param: If present, replaces the stored name. Omit to leave unchanged.
   * Maximum 255 characters.
   */
  name?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
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

export interface UserProfileListParams extends PageCursorParams {
  /**
   * Query param: The sort direction, applied to the field that `order_by` selects.
   * Defaults to `desc`.
   *
   * - `asc` - Oldest first when `order_by` is `created_at`, or names in ascending
   *   order when `order_by` is `name`.
   * - `desc` - Newest first when `order_by` is `created_at`, or names in descending
   *   order when `order_by` is `name`. This is the default.
   */
  order?: 'asc' | 'desc';

  /**
   * Query param: The field to sort user profiles by, in the direction that `order`
   * sets. Defaults to `created_at`.
   *
   * - `created_at` - Sort by when each user profile was created. This is the
   *   default.
   * - `name` - Sort by `name`, ignoring the case of ASCII letters. Profiles without
   *   a name come last in either direction.
   */
  order_by?: 'created_at' | 'name';

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
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

export interface UserProfileCreateEnrollmentURLParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
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

export declare namespace UserProfiles {
  export {
    type BetaUserProfile as BetaUserProfile,
    type BetaUserProfileEnrollmentURL as BetaUserProfileEnrollmentURL,
    type BetaUserProfileExternalUserDetails as BetaUserProfileExternalUserDetails,
    type BetaUserProfileExternalUserDetailsParams as BetaUserProfileExternalUserDetailsParams,
    type BetaUserProfileTrustGrant as BetaUserProfileTrustGrant,
    type BetaUserProfilesPageCursor as BetaUserProfilesPageCursor,
    type UserProfileCreateParams as UserProfileCreateParams,
    type UserProfileRetrieveParams as UserProfileRetrieveParams,
    type UserProfileUpdateParams as UserProfileUpdateParams,
    type UserProfileListParams as UserProfileListParams,
    type UserProfileCreateEnrollmentURLParams as UserProfileCreateEnrollmentURLParams,
  };
}
