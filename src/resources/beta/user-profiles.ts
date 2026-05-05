// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

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
    const { betas, ...body } = params;
    return this._client.post('/v1/user_profiles?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'user-profiles-2026-03-24'].toString() },
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
    const { betas } = params ?? {};
    return this._client.get(path`/v1/user_profiles/${userProfileID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'user-profiles-2026-03-24'].toString() },
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
    const { betas, ...body } = params;
    return this._client.post(path`/v1/user_profiles/${userProfileID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'user-profiles-2026-03-24'].toString() },
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
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/user_profiles?beta=true', PageCursor<BetaUserProfile>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'user-profiles-2026-03-24'].toString() },
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
    const { betas } = params ?? {};
    return this._client.post(path`/v1/user_profiles/${userProfileID}/enrollment_url?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'user-profiles-2026-03-24'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaUserProfilesPageCursor = PageCursor<BetaUserProfile>;

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
   * How the entity behind a user profile relates to the platform that owns the API
   * key. `external`: an individual end-user of the platform. `resold`: a company the
   * platform resells Claude access to. `internal`: the platform's own usage.
   */
  relationship: 'external' | 'resold' | 'internal';

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
   * Platform's own identifier for this user. Not enforced unique.
   */
  external_id?: string | null;

  /**
   * Display name of the entity this profile represents. For `resold` this is the
   * resold-to company's name.
   */
  name?: string | null;
}

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

export interface BetaUserProfileTrustGrant {
  /**
   * Status of the trust grant.
   */
  status: 'active' | 'pending' | 'rejected';
}

export interface UserProfileCreateParams {
  /**
   * Body param: Platform's own identifier for this user. Not enforced unique.
   * Maximum 255 characters.
   */
  external_id?: string | null;

  /**
   * Body param: Free-form key-value data to attach to this user profile. Maximum 16
   * keys, with keys up to 64 characters and values up to 512 characters. Values must
   * be non-empty strings.
   */
  metadata?: { [key: string]: string };

  /**
   * Body param: Display name of the entity this profile represents. Required when
   * relationship is `resold` (the resold-to company's name); optional otherwise.
   * Maximum 255 characters.
   */
  name?: string | null;

  /**
   * Body param: How the entity behind a user profile relates to the platform that
   * owns the API key. `external`: an individual end-user of the platform. `resold`:
   * a company the platform resells Claude access to. `internal`: the platform's own
   * usage.
   */
  relationship?: 'external' | 'resold' | 'internal';

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface UserProfileRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface UserProfileUpdateParams {
  /**
   * Body param: If present, replaces the stored external_id. Omit to leave
   * unchanged. Maximum 255 characters.
   */
  external_id?: string | null;

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
   * Body param: How the entity behind a user profile relates to the platform that
   * owns the API key. `external`: an individual end-user of the platform. `resold`:
   * a company the platform resells Claude access to. `internal`: the platform's own
   * usage.
   */
  relationship?: 'external' | 'resold' | 'internal' | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface UserProfileListParams extends PageCursorParams {
  /**
   * Query param: Query parameter for order
   */
  order?: 'asc' | 'desc';

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface UserProfileCreateEnrollmentURLParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace UserProfiles {
  export {
    type BetaUserProfile as BetaUserProfile,
    type BetaUserProfileEnrollmentURL as BetaUserProfileEnrollmentURL,
    type BetaUserProfileTrustGrant as BetaUserProfileTrustGrant,
    type BetaUserProfilesPageCursor as BetaUserProfilesPageCursor,
    type UserProfileCreateParams as UserProfileCreateParams,
    type UserProfileRetrieveParams as UserProfileRetrieveParams,
    type UserProfileUpdateParams as UserProfileUpdateParams,
    type UserProfileListParams as UserProfileListParams,
    type UserProfileCreateEnrollmentURLParams as UserProfileCreateEnrollmentURLParams,
  };
}
