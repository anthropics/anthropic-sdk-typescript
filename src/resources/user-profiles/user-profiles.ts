import { APIResource } from '../../core/resource';
import * as ActionURLsAPI from './action-urls';
import {
  ActionURLCreateParams,
  ActionURLs,
  UserProfileActionURL,
  UserProfileEnrollEndUserAction,
} from './action-urls';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { startApiCallSpan } from '../../internal/tracing';
import { path } from '../../internal/utils/path';

export class UserProfiles extends APIResource {
  actionURLs: ActionURLsAPI.ActionURLs = new ActionURLsAPI.ActionURLs(this._client);

  /**
   * Create User Profile
   *
   * @example
   * ```ts
   * const userProfile = await client.userProfiles.create();
   * ```
   */
  create(params: UserProfileCreateParams, options?: RequestOptions): APIPromise<UserProfile> {
    const { workspace_id, ...body } = params;
    return this._client.post('/v1/user_profiles', {
      body,
      ...options,
      headers: buildHeaders([
        { ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined) },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.user_profiles.create', options, {
        route: '/v1/user_profiles',
        createdIDAttribute: 'anthropic.user_profile.id',
      }),
    });
  }

  /**
   * Get User Profile
   *
   * @example
   * ```ts
   * const userProfile = await client.userProfiles.retrieve(
   *   'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   * );
   * ```
   */
  retrieve(
    userProfileID: string,
    params: UserProfileRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<UserProfile> {
    const { workspace_id } = params ?? {};
    return this._client.get(path`/v1/user_profiles/${userProfileID}`, {
      ...options,
      headers: buildHeaders([
        { ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined) },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.user_profiles.retrieve', options, {
        route: '/v1/user_profiles/{user_profile_id}',
        attributes: { 'anthropic.user_profile.id': userProfileID },
      }),
    });
  }

  /**
   * Update User Profile
   *
   * @example
   * ```ts
   * const userProfile = await client.userProfiles.update(
   *   'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   * );
   * ```
   */
  update(
    userProfileID: string,
    params: UserProfileUpdateParams,
    options?: RequestOptions,
  ): APIPromise<UserProfile> {
    const { workspace_id, ...body } = params;
    return this._client.post(path`/v1/user_profiles/${userProfileID}`, {
      body,
      ...options,
      headers: buildHeaders([
        { ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined) },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.user_profiles.update', options, {
        route: '/v1/user_profiles/{user_profile_id}',
        attributes: { 'anthropic.user_profile.id': userProfileID },
      }),
    });
  }

  /**
   * List User Profiles
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const userProfile of client.userProfiles.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: UserProfileListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<UserProfilesPageCursor, UserProfile> {
    const { workspace_id, ...query } = params ?? {};
    return this._client.getAPIList('/v1/user_profiles', PageCursor<UserProfile>, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined) },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.user_profiles.list', options, {
        route: '/v1/user_profiles',
        queryParams: ['enforcement_status', 'limit', 'order', 'order_by', 'page'],
      }),
    });
  }

  /**
   * Delete User Profile
   *
   * @example
   * ```ts
   * const deletedUserProfile = await client.userProfiles.delete(
   *   'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   * );
   * ```
   */
  delete(
    userProfileID: string,
    params: UserProfileDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<DeletedUserProfile> {
    const { workspace_id } = params ?? {};
    return this._client.delete(path`/v1/user_profiles/${userProfileID}`, {
      ...options,
      headers: buildHeaders([
        { ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined) },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.user_profiles.delete', options, {
        route: '/v1/user_profiles/{user_profile_id}',
        attributes: { 'anthropic.user_profile.id': userProfileID },
      }),
    });
  }
}

export type UserProfilesPageCursor = PageCursor<UserProfile>;

export interface DeletedUserProfile {
  /**
   * Identifier of the deleted user profile, prefixed `uprof_`.
   */
  id: string;

  /**
   * Object type. Always `user_profile_deleted`.
   */
  type: 'user_profile_deleted';
}

/**
 * A record of an entity that the platform serves through the API, such as an
 * end-user of the platform's product or a company that the platform resells Claude
 * access to.
 *
 * A Messages, Message Batches or token counting request can send a profile's `id`
 * in the `anthropic-user-profile-id` header to attribute the request to that
 * entity.
 */
export interface UserProfile {
  /**
   * Unique identifier for this user profile, prefixed `uprof_`.
   */
  id: string;

  /**
   * How the platform uses the API for this entity: `application` (default) or
   * `passthrough`. Absent under the legacy `user-profiles-2026-03-24` beta header.
   */
  access_type: UserProfileAccessType;

  /**
   * When this user profile was created, in RFC 3339 format.
   */
  created_at: string;

  /**
   * The enforcement actions open on this profile; empty when none is open. Absent
   * under the `user-profiles-2026-09-04` and earlier beta headers.
   */
  enforcement_actions: Array<UserProfileEnforcementAction>;

  /**
   * Anthropic's enforcement status of this profile, from its open enforcement
   * actions and any identity check under review, by the first rule that applies:
   * `banned` while any open action is a `ban`; `pending` while a restriction that an
   * identity check can clear is open, the end user has submitted that check,
   * Anthropic's review of it has not ended, and no open action's `reason` is
   * `account_compromise`; `restricted` while any action is open; `unrestricted`
   * while none is. Absent under the `user-profiles-2026-09-04` and earlier beta
   * headers.
   */
  enforcement_status: UserProfileEnforcementStatus;

  /**
   * Details about the entity this profile represents, as the platform states them;
   * not verified by Anthropic. Every field is present, `null` until the platform
   * supplies a value. Absent under the legacy `user-profiles-2026-03-24` and
   * `user-profiles-2026-08-18` beta headers, which serve `reference_id` as the
   * top-level `external_id` and, under `user-profiles-2026-08-18`, `onboarded_at` as
   * `external_user_onboarded_at`.
   */
  external_user_details: UserProfileExternalUserDetails;

  /**
   * Arbitrary key-value metadata. Maximum 16 pairs, keys up to 64 chars, values up
   * to 512 chars.
   */
  metadata: { [key: string]: string };

  /**
   * Real-world name of the entity this profile represents (company or individual).
   * For a company the platform resells Claude access to (`access_type`
   * `passthrough`) this is that company's name. `null` until the platform supplies
   * one.
   */
  name: string | null;

  /**
   * The profile's standing in each Anthropic program, such as the Cyber Verification
   * Program. Present when the request sends no user-profiles beta header; absent
   * under the `user-profiles-2026-09-04` and earlier beta headers, which serve
   * `trust_grants` instead.
   */
  programs: UserProfilePrograms;

  /**
   * Object type. Always `user_profile`.
   */
  type: 'user_profile';

  /**
   * When this user profile was last modified, in RFC 3339 format. It normally also
   * updates shortly after Anthropic gives the profile an approval or withdraws one.
   * Other changes to the statuses that Anthropic reports do not always update it, so
   * read the status itself rather than watching this timestamp.
   */
  updated_at: string;
}

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
export type UserProfileAccessType = 'application' | 'passthrough';

/**
 * A user profile's standing in the Cyber Verification Program, which relaxes cyber
 * safeguards for requests that name the profile.
 */
export interface UserProfileCyberProgram {
  /**
   * What a request that names the profile must allow to get the relaxed safeguards
   * of every `active` tier. `null` when no tier is `active`, and wherever `tiers` is
   * `{}`.
   */
  requirements: UserProfileCyberRequirements | null;

  /**
   * `active` when at least one tier is `active`, or when the profile has the
   * program's access to earlier models. That access is not a tier: a profile that
   * has it alone reads `active` with every tier `inactive`, or with `tiers` `{}` on
   * a response that does not report tiers. When nothing is `active`, `pending` means
   * that an application or enrollment is under review, or that what Anthropic
   * approved does not yet apply to this profile, and `rejected` means that the
   * application or enrollment was declined.
   */
  status: UserProfileProgramStatus;

  /**
   * The program's tiers, keyed by tier: `a` (Specialized Access), `b` (Red Team
   * Access) and `c` (Defense Access). A response reports either every tier or none.
   * When it reports them, as retrieving the profile normally does, every tier has a
   * key, whether or not it applies to the profile. When it does not, as in the list
   * of user profiles, `tiers` is `{}`, which does not mean that the tiers are
   * inactive. No tier implies another, so read the tier you need. Anthropic may add
   * tiers; ignore a key you do not recognize.
   */
  tiers: { [key: string]: UserProfileCyberTier };
}

/**
 * What a request that names the profile must allow to get the relaxed safeguards
 * of the profile's `active` tiers. A field reads `true` when at least one of those
 * tiers has the requirement and Anthropic has not waived it on that tier for the
 * profile. A request that does not meet a requirement is still served, without the
 * relaxed safeguards of the tiers that have it. The values differ between profiles
 * and can change, so read them rather than assuming them.
 */
export interface UserProfileCyberRequirements {
  /**
   * Whether Anthropic must be able to retain the request's inference data.
   */
  data_retention: boolean;

  /**
   * Whether Anthropic personnel must be allowed to review the data retained from the
   * request.
   */
  human_review: boolean;
}

/**
 * One tier of the Cyber Verification Program.
 */
export interface UserProfileCyberTier {
  /**
   * `active` when the tier applies to the profile, otherwise `inactive`. The
   * response does not say why a tier is `inactive`: it can be in review, declined,
   * withdrawn, never applied for, or approved but not applied to this profile.
   */
  status: 'active' | 'inactive';
}

/**
 * One feature of Enterprise Frontier Safeguards.
 */
export interface UserProfileEfsFeature {
  /**
   * `active` when Anthropic has approved the entity the profile represents to use
   * the feature, otherwise `inactive`. `active` does not mean that the feature is
   * set up or switched on, which is a separate step.
   */
  status: 'active' | 'inactive';
}

/**
 * A user profile's standing in Enterprise Frontier Safeguards, a program under
 * which Anthropic approves the entity the profile represents and may approve any
 * of the program's features.
 */
export interface UserProfileEfsProgram {
  /**
   * The program's features, keyed by feature: `data_retention_exemption` (use of
   * models that normally require data retention, without the data being retained),
   * `cmek` (customer-managed encryption keys) and `storage` (customer-owned
   * storage). Every feature that the caller's organization may read has a key,
   * whether or not it is approved; a missing key does not mean that the feature is
   * inactive. Anthropic may add features; ignore a key you do not recognize.
   */
  features: { [key: string]: UserProfileEfsFeature };

  /**
   * Anthropic's decision on the entity the profile represents: `pending` while it is
   * awaited, `active` once Anthropic has approved the entity for the program, or
   * `rejected` once Anthropic has declined or has removed the entity from the
   * program. `active` does not mean that any one feature is approved: read the
   * feature you need in `features`.
   */
  status: UserProfileProgramStatus;
}

/**
 * A limit Anthropic has placed on the entity this profile represents and not yet
 * resolved, discriminated by `type`: `restriction` or `ban`. More types may be
 * added; read a `type` you do not recognize as `restriction`.
 */
export type UserProfileEnforcementAction =
  | UserProfileEnforcementActionRestriction
  | UserProfileEnforcementActionBan;

/**
 * Anthropic has stopped serving the end user where the ban applies and does not
 * plan to serve them there again.
 */
export interface UserProfileEnforcementActionBan {
  /**
   * The action's ID (`enac_...`), stable while the action is open.
   */
  id: string;

  /**
   * Always `null`: the end user cannot clear a ban.
   */
  action: UserProfileEnforcementActionNextStep | null;

  /**
   * Always `null`: a ban has no end date.
   */
  expires_at: string | null;

  /**
   * When Anthropic opened the action, in RFC 3339 format.
   */
  opened_at: string;

  /**
   * Why Anthropic placed the limit: `unsupported_region`, `fraud_or_abuse`,
   * `high_harm`, `usage_policy_violation`, `account_compromise` or `unspecified`.
   */
  reason: UserProfileEnforcementActionReason;

  type: 'ban';
}

/**
 * The next step on this enforcement action: `verify` means the end user can clear
 * the action by passing an identity check. More values may be added; read a value
 * you do not recognize as `null`.
 */
export type UserProfileEnforcementActionNextStep = 'verify';

/**
 * Why Anthropic placed this enforcement action: `unsupported_region`,
 * `fraud_or_abuse`, `high_harm`, `usage_policy_violation`, `account_compromise` or
 * `unspecified`. More values may be added; read a value you do not recognize as
 * `unspecified`.
 */
export type UserProfileEnforcementActionReason =
  | 'unsupported_region'
  | 'fraud_or_abuse'
  | 'high_harm'
  | 'usage_policy_violation'
  | 'account_compromise'
  | 'unspecified';

/**
 * Anthropic has limited how it serves the end user until the action is resolved.
 * The end user may still be served in part.
 */
export interface UserProfileEnforcementActionRestriction {
  /**
   * The action's ID (`enac_...`), stable while the action is open.
   */
  id: string;

  /**
   * The next step on the action: `verify` or `null`. `verify`: the end user can
   * clear it now by passing an identity check. `null`: there is nothing the end user
   * can do now to clear it, including while Anthropic reviews an identity check the
   * end user submitted.
   */
  action: UserProfileEnforcementActionNextStep | null;

  /**
   * When the action ends on its own, in RFC 3339 format; it stops showing once this
   * time has passed. `null` when it has no end date, and always `null` when `reason`
   * is `account_compromise`.
   */
  expires_at: string | null;

  /**
   * When Anthropic opened the action, in RFC 3339 format.
   */
  opened_at: string;

  /**
   * Why Anthropic placed the limit: `unsupported_region`, `fraud_or_abuse`,
   * `high_harm`, `usage_policy_violation`, `account_compromise` or `unspecified`.
   */
  reason: UserProfileEnforcementActionReason;

  type: 'restriction';
}

/**
 * Anthropic's enforcement status of this profile: `unrestricted`, `pending`,
 * `restricted` or `banned`. More values may be added; read a value you do not
 * recognize as `restricted`.
 */
export type UserProfileEnforcementStatus = 'unrestricted' | 'pending' | 'restricted' | 'banned';

/**
 * The status of the entity's account on the platform, as the platform states it:
 * `active`; `suspended`, when the platform has restricted the account and may
 * restore it; or `blocked`, when the platform has barred it. It records the
 * platform's decision only. The statuses that Anthropic itself reports for the
 * profile, such as its status in a program, are Anthropic's decisions and do not
 * change with it.
 *
 * - `active` - The platform has neither restricted nor barred the account of the
 *   entity that the user profile represents.
 * - `suspended` - The platform has restricted the account of the entity that the
 *   user profile represents and may restore it.
 * - `blocked` - The platform has barred the account of the entity that the user
 *   profile represents.
 */
export type UserProfileExternalUserAccountStatus = 'active' | 'suspended' | 'blocked';

/**
 * Details about the entity this profile represents, as the platform states them.
 * Anthropic does not verify them. Every field is present, `null` until the
 * platform supplies a value.
 */
export interface UserProfileExternalUserDetails {
  /**
   * The status of the entity's account on the platform: `active`, `suspended` or
   * `blocked`. `null` until the platform supplies one.
   */
  account_status: UserProfileExternalUserAccountStatus | null;

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
   * What kind of entity the profile represents: `individual`, `business`,
   * `non_profit` or `government`. `null` until the platform supplies one.
   */
  entity_type: UserProfileExternalUserEntityType | null;

  /**
   * The platform-computed hash of the entity's name. `null` until the platform
   * supplies one.
   */
  name_hash: string | null;

  /**
   * When the entity opened its account with the platform, as stated by the platform,
   * in RFC 3339 format (UTC). `null` until the platform supplies one.
   */
  onboarded_at: string | null;

  /**
   * The platform's own reference for the entity. `null` until the platform supplies
   * one.
   */
  reference_id: string | null;
}

export interface UserProfileExternalUserDetailsParams {
  /**
   * The status of the entity's account on the platform: `active`, `suspended` or
   * `blocked`.
   */
  account_status?: UserProfileExternalUserAccountStatus | null;

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
   * What kind of entity the profile represents: `individual`, `business`,
   * `non_profit` or `government`.
   */
  entity_type?: UserProfileExternalUserEntityType | null;

  /**
   * A hash of the entity's name, computed by the platform. Anthropic treats it as an
   * opaque string and does not prescribe the hash function. 1 to 255 characters.
   */
  name_hash?: string | null;

  /**
   * When the entity opened its account with the platform, in RFC 3339 format: for an
   * `application` profile, when the end-user signed up; for a `passthrough` profile,
   * when the company became the platform's customer. Must be a complete timestamp no
   * more than 1 minute in the future.
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
 * What kind of entity the profile represents, as the platform states it:
 * `individual`, `business`, `non_profit` or `government`.
 */
export type UserProfileExternalUserEntityType = 'individual' | 'business' | 'non_profit' | 'government';

/**
 * The direction that a list of user profiles is sorted in.
 *
 * - `asc` - Oldest first when `order_by` is `created_at`, or names in ascending
 *   order when `order_by` is `name`.
 * - `desc` - Newest first when `order_by` is `created_at`, or names in descending
 *   order when `order_by` is `name`. This is the default.
 */
export type UserProfileListOrder = 'asc' | 'desc';

/**
 * Sort field for listing user profiles: `created_at` (default) or `name`
 * (case-insensitive; profiles without a name sort last).
 *
 * - `created_at` - Sort by when each user profile was created. This is the
 *   default.
 * - `name` - Sort by `name`, ignoring the case of ASCII letters. Profiles without
 *   a name come last in either direction.
 */
export type UserProfileListOrderBy = 'created_at' | 'name';

/**
 * A user profile's status in a program. Each program's `status` field says what
 * the values mean there.
 *
 * - `active` - The profile is in the program.
 * - `pending` - The profile is not in the program yet, and something is still
 *   awaited.
 * - `rejected` - The profile is not in the program and nothing is awaited:
 *   Anthropic has declined, or has withdrawn an earlier approval.
 */
export type UserProfileProgramStatus = 'active' | 'pending' | 'rejected';

/**
 * A user profile's standing in each program. A program is a set of capabilities or
 * exemptions that Anthropic approves for the entity the profile represents. A
 * program reads `null` when the profile has no status in it, when the caller's
 * organization is not entitled to read programs, or when the response does not
 * report that program. Retrieving the profile reports every program. Anthropic may
 * add programs; ignore a key you do not recognize.
 */
export interface UserProfilePrograms {
  /**
   * The profile's standing in the Cyber Verification Program. `null` when the
   * profile has no status in it. Only retrieving the profile gives the full answer:
   * a list or update response can show `null`, or a status other than `active`, for
   * a profile that reads `active` when retrieved.
   */
  cyber: UserProfileCyberProgram | null;

  /**
   * The profile's standing in Enterprise Frontier Safeguards. `null` unless the
   * platform's attestation for the program is in place on this profile, or the
   * entity it represents has applied to the program. A list of user profiles does
   * not report this program: there it reads `null` for every profile, so retrieve
   * the profile to read it.
   */
  efs: UserProfileEfsProgram | null;
}

export interface UserProfileCreateParams {
  /**
   * Body param: How the platform uses the API for this entity. `application`
   * (default): the profile represents an individual end-user of the platform's
   * product. `passthrough`: the profile identifies a company the platform resells
   * Claude access to.
   */
  access_type?: UserProfileAccessType;

  /**
   * Body param: Details about the entity this profile represents, as the platform
   * states them. Every field is optional. Not accepted under the legacy
   * `user-profiles-2026-03-24` and `user-profiles-2026-08-18` beta headers, which
   * take the top-level `external_id` (and, under `user-profiles-2026-08-18`,
   * `external_user_onboarded_at`) instead.
   */
  external_user_details?: UserProfileExternalUserDetailsParams;

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
   * Body param: If present, replaces the stored access type. Omit to leave
   * unchanged.
   */
  access_type?: UserProfileAccessType | null;

  /**
   * Body param: Details about the entity this profile represents, as the platform
   * states them. Each field sent replaces the stored value; omit a field to leave it
   * unchanged. Once set, a value cannot be cleared and `null` is rejected. Not
   * accepted under the legacy `user-profiles-2026-03-24` and
   * `user-profiles-2026-08-18` beta headers.
   */
  external_user_details?: UserProfileExternalUserDetailsParams;

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
   * Query param: Return only the user profiles whose `enforcement_status` is one of
   * these values: `unrestricted`, `pending`, `restricted` or `banned`. Repeat the
   * parameter to match any of several. With it set, a page may hold fewer than
   * `limit` profiles, or none, and still carry a `next_page`: the service examines a
   * bounded number of profiles per request, and only a null `next_page` means the
   * listing is complete. Rejected with `invalid_request_error` under the
   * `user-profiles-2026-09-04` and earlier beta headers. Fails with
   * `overloaded_error` when a profile's enforcement actions cannot be read for the
   * moment.
   */
  enforcement_status?: Array<UserProfileEnforcementStatus>;

  /**
   * Query param: The sort direction, applied to the field that `order_by` selects.
   * Defaults to `desc`.
   */
  order?: UserProfileListOrder;

  /**
   * Query param: The field to sort user profiles by, in the direction that `order`
   * sets. Defaults to `created_at`.
   */
  order_by?: UserProfileListOrderBy;

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

export interface UserProfileDeleteParams {
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

UserProfiles.ActionURLs = ActionURLs;

export declare namespace UserProfiles {
  export {
    type DeletedUserProfile as DeletedUserProfile,
    type UserProfile as UserProfile,
    type UserProfileAccessType as UserProfileAccessType,
    type UserProfileCyberProgram as UserProfileCyberProgram,
    type UserProfileCyberRequirements as UserProfileCyberRequirements,
    type UserProfileCyberTier as UserProfileCyberTier,
    type UserProfileEfsFeature as UserProfileEfsFeature,
    type UserProfileEfsProgram as UserProfileEfsProgram,
    type UserProfileEnforcementAction as UserProfileEnforcementAction,
    type UserProfileEnforcementActionBan as UserProfileEnforcementActionBan,
    type UserProfileEnforcementActionNextStep as UserProfileEnforcementActionNextStep,
    type UserProfileEnforcementActionReason as UserProfileEnforcementActionReason,
    type UserProfileEnforcementActionRestriction as UserProfileEnforcementActionRestriction,
    type UserProfileEnforcementStatus as UserProfileEnforcementStatus,
    type UserProfileExternalUserAccountStatus as UserProfileExternalUserAccountStatus,
    type UserProfileExternalUserDetails as UserProfileExternalUserDetails,
    type UserProfileExternalUserDetailsParams as UserProfileExternalUserDetailsParams,
    type UserProfileExternalUserEntityType as UserProfileExternalUserEntityType,
    type UserProfileListOrder as UserProfileListOrder,
    type UserProfileListOrderBy as UserProfileListOrderBy,
    type UserProfileProgramStatus as UserProfileProgramStatus,
    type UserProfilePrograms as UserProfilePrograms,
    type UserProfilesPageCursor as UserProfilesPageCursor,
    type UserProfileCreateParams as UserProfileCreateParams,
    type UserProfileRetrieveParams as UserProfileRetrieveParams,
    type UserProfileUpdateParams as UserProfileUpdateParams,
    type UserProfileListParams as UserProfileListParams,
    type UserProfileDeleteParams as UserProfileDeleteParams,
  };

  export {
    ActionURLs as ActionURLs,
    type UserProfileActionURL as UserProfileActionURL,
    type UserProfileEnrollEndUserAction as UserProfileEnrollEndUserAction,
    type ActionURLCreateParams as ActionURLCreateParams,
  };
}
