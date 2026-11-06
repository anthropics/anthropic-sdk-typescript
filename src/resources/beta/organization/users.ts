import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as OrganizationAPI from './organization';
import { APIPromise } from '../../../core/api-promise';
import { BadRequestError, PermissionDeniedError } from '../../../core/error';
import { Page, type PageParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

/**
 * The member is the organization's primary owner, whom no API key or token can
 * sign out.
 */
export class BetaCannotSignOutPrimaryOwnerError extends BadRequestError {
  declare readonly errorCode: 'cannot_sign_out_primary_owner';
  declare readonly details: BetaCannotSignOutPrimaryOwnerErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaCannotSignOutPrimaryOwnerError';
}

/**
 * The member is the user the API key or token belongs to.
 */
export class BetaCannotSignOutSelfError extends BadRequestError {
  declare readonly errorCode: 'cannot_sign_out_self';
  declare readonly details: BetaCannotSignOutSelfErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaCannotSignOutSelfError';
}

/**
 * On a public-sector deployment, only an API key or token that belongs to a person
 * with owner permissions can sign out a member with the `managed` role.
 */
export class BetaCannotSignOutManagedMemberError extends PermissionDeniedError {
  declare readonly errorCode: 'cannot_sign_out_managed_member';
  declare readonly details: BetaCannotSignOutManagedMemberErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaCannotSignOutManagedMemberError';
}

/**
 * The member is a membership admin, and the person the API key or token belongs to
 * is not allowed to sign out membership admins.
 */
export class BetaCannotSignOutMembershipAdminError extends PermissionDeniedError {
  declare readonly errorCode: 'cannot_sign_out_membership_admin';
  declare readonly details: BetaCannotSignOutMembershipAdminErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaCannotSignOutMembershipAdminError';
}

/**
 * The member is an owner or has owner permissions, and this API key or token
 * cannot sign them out. In a Claude Enterprise organization, an API key with the
 * `write:members` scope can.
 */
export class BetaCannotSignOutOwnerError extends PermissionDeniedError {
  declare readonly errorCode: 'cannot_sign_out_owner';
  declare readonly details: BetaCannotSignOutOwnerErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaCannotSignOutOwnerError';
}

/**
 * This OAuth token cannot sign out a membership admin or a member whose roles
 * grant owner, user management, or identity and access management.
 */
export class BetaCannotSignOutPrivilegedMemberError extends PermissionDeniedError {
  declare readonly errorCode: 'cannot_sign_out_privileged_member';
  declare readonly details: BetaCannotSignOutPrivilegedMemberErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaCannotSignOutPrivilegedMemberError';
}

export class Users extends APIResource {
  /**
   * Retrieve a member of the organization by user ID.
   *
   * @example
   * ```ts
   * const betaOrganizationUser =
   *   await client.beta.organization.users.retrieve('user_id');
   * ```
   */
  retrieve(userID: string, options?: RequestOptions): APIPromise<BetaOrganizationUser> {
    return this._client.get(path`/v1/organizations/users/${userID}`, {
      ...options,
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.users.retrieve', options, {
        route: '/v1/organizations/users/{user_id}',
        attributes: { 'anthropic.organization.user.id': userID },
      }),
    });
  }

  /**
   * Update a member's organization role.
   *
   * @example
   * ```ts
   * const betaOrganizationUser =
   *   await client.beta.organization.users.update('user_id', {
   *     role: 'user',
   *   });
   * ```
   */
  update(userID: string, body: UserUpdateParams, options?: RequestOptions): APIPromise<BetaOrganizationUser> {
    return this._client.post(path`/v1/organizations/users/${userID}`, {
      body,
      ...options,
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.users.update', options, {
        route: '/v1/organizations/users/{user_id}',
        attributes: { 'anthropic.organization.user.id': userID },
      }),
    });
  }

  /**
   * List the organization's members.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaOrganizationUser of client.beta.organization.users.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: UserListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaOrganizationUsersPage, BetaOrganizationUser> {
    return this._client.getAPIList('/v1/organizations/users', Page<BetaOrganizationUser>, {
      query,
      ...options,
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.users.list', options, {
        route: '/v1/organizations/users',
        queryParams: ['after_id', 'before_id', 'email', 'limit', 'roles'],
      }),
    });
  }

  /**
   * Remove a member from the organization.
   *
   * @throws {CannotRemoveLastMemberError}
   * @throws {ConcurrentMembershipChangeError}
   *
   * @example
   * ```ts
   * const user = await client.beta.organization.users.remove(
   *   'user_id',
   * );
   * ```
   */
  remove(userID: string, options?: RequestOptions): APIPromise<UserRemoveResponse> {
    return this._client.delete(path`/v1/organizations/users/${userID}`, {
      ...options,
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.users.remove', options, {
        route: '/v1/organizations/users/{user_id}',
        attributes: { 'anthropic.organization.user.id': userID },
      }),
    });
  }

  /**
   * Sign a member out of Claude everywhere, without removing them from the
   * organization. This ends their sign-in sessions and removes their trusted devices
   * wherever they use Claude, including other organizations and individual plans. It
   * also ends the OAuth tokens issued to them for this organization, so apps such as
   * Claude Code must sign in again.
   *
   * A token can take up to an hour to stop working, though it almost always stops at
   * once. The member keeps their role and can sign in again right away. To keep them
   * out, remove them from the organization or, if your organization uses single
   * sign-on, block them in your identity provider. Signing out does not end API
   * keys, OAuth tokens that were not issued for this organization, or the member's
   * Claude Code cloud sessions and routines.
   *
   * You cannot sign out the organization's primary owner or the person your API key
   * or token acts for, and a request to sign out another owner, a member with owner
   * permissions, or a membership admin may be refused. A refused request returns a
   * `400` or `403` error that says why. If the request returns `503`, send it again
   * to finish; anything already ended stays ended.
   *
   * Every request must include the beta header
   * `anthropic-beta: admin-user-sign-out-2026-10-08`. A request without it returns
   * `400`. Sign-out is in beta. Anthropic turns it on for each organization and has
   * turned it on for every Claude Enterprise organization; until yours is on,
   * requests also return `400`. In a Claude Enterprise organization, an API key
   * needs the `write:members` scope; a key without it gets `403`.
   *
   * @throws {BetaCannotSignOutPrimaryOwnerError}
   * @throws {BetaCannotSignOutSelfError}
   * @throws {BetaOrganizationNotEnrolledInBetaError}
   * @throws {BetaCannotSignOutManagedMemberError}
   * @throws {BetaCannotSignOutMembershipAdminError}
   * @throws {BetaCannotSignOutOwnerError}
   * @throws {BetaCannotSignOutPrivilegedMemberError}
   *
   * @example
   * ```ts
   * const betaOrganizationUser =
   *   await client.beta.organization.users.signOut('user_id');
   * ```
   */
  signOut(
    userID: string,
    params: UserSignOutParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaOrganizationUser> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/organizations/users/${userID}/sign_out`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'admin-user-sign-out-2026-10-08'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.users.sign_out', options, {
        route: '/v1/organizations/users/{user_id}/sign_out',
        attributes: { 'anthropic.organization.user.id': userID },
      }),
    });
  }
}

export type BetaOrganizationUsersPage = Page<BetaOrganizationUser>;

/**
 * On a public-sector deployment, only an API key or token that belongs to a person
 * with owner permissions can sign out a member with the `managed` role.
 */
export interface BetaCannotSignOutManagedMemberErrorDetails {
  error_code: 'cannot_sign_out_managed_member';
}

/**
 * The member is a membership admin, and the person the API key or token belongs to
 * is not allowed to sign out membership admins.
 */
export interface BetaCannotSignOutMembershipAdminErrorDetails {
  error_code: 'cannot_sign_out_membership_admin';
}

/**
 * The member is an owner or has owner permissions, and this API key or token
 * cannot sign them out. In a Claude Enterprise organization, an API key with the
 * `write:members` scope can.
 */
export interface BetaCannotSignOutOwnerErrorDetails {
  error_code: 'cannot_sign_out_owner';
}

/**
 * The member is the organization's primary owner, whom no API key or token can
 * sign out.
 */
export interface BetaCannotSignOutPrimaryOwnerErrorDetails {
  error_code: 'cannot_sign_out_primary_owner';
}

/**
 * This OAuth token cannot sign out a membership admin or a member whose roles
 * grant owner, user management, or identity and access management.
 */
export interface BetaCannotSignOutPrivilegedMemberErrorDetails {
  error_code: 'cannot_sign_out_privileged_member';
}

/**
 * The member is the user the API key or token belongs to.
 */
export interface BetaCannotSignOutSelfErrorDetails {
  error_code: 'cannot_sign_out_self';
}

export interface BetaOrganizationUser {
  /**
   * ID of the User.
   */
  id: string;

  /**
   * RFC 3339 datetime string indicating when the User joined the Organization.
   */
  added_at: string;

  /**
   * Email of the User.
   */
  email: string;

  /**
   * Name of the User.
   */
  name: string;

  /**
   * Organization role of the User.
   */
  role: OrganizationAPI.BetaOrganizationRole;

  /**
   * Object type.
   *
   * For Users, this is always `"user"`.
   */
  type: 'user';
}

export interface UserRemoveResponse {
  /**
   * ID of the User.
   */
  id: string;

  /**
   * Deleted object type.
   *
   * For Users, this is always `"user_deleted"`.
   */
  type: 'user_deleted';
}

export interface UserUpdateParams {
  /**
   * New role for the User.
   *
   * The accepted values depend on the organization type. Console and API
   * organizations accept `user`, `developer`, `billing`, and `claude_code_user`;
   * `admin` cannot be assigned through the API. Claude Enterprise organizations
   * accept `user` and `managed`; changing a User's role to `managed` requires the
   * `write:rbac_groups` scope in addition to `write:members`.
   */
  role: 'billing' | 'claude_code_user' | 'developer' | 'managed' | 'user';
}

export interface UserListParams extends PageParams {
  /**
   * Filter by user email.
   */
  email?: string;

  /**
   * Filter to items whose `role` equals one of the supplied values. Repeatable;
   * values are OR'ed together.
   *
   * Accepted values depend on the organization type: Console and API organizations
   * accept `user`, `developer`, `billing`, `admin`, and `claude_code_user`; Claude
   * Enterprise organizations accept `user`, `owner`, `primary_owner`,
   * `membership_admin`, and `managed`.
   */
  roles?: Array<string>;
}

export interface UserSignOutParams {
  /**
   * This endpoint is in beta: requests must send `admin-user-sign-out-2026-10-08` in
   * this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

Users.BetaCannotSignOutPrimaryOwnerError = BetaCannotSignOutPrimaryOwnerError;
Users.BetaCannotSignOutSelfError = BetaCannotSignOutSelfError;
Users.BetaCannotSignOutManagedMemberError = BetaCannotSignOutManagedMemberError;
Users.BetaCannotSignOutMembershipAdminError = BetaCannotSignOutMembershipAdminError;
Users.BetaCannotSignOutOwnerError = BetaCannotSignOutOwnerError;
Users.BetaCannotSignOutPrivilegedMemberError = BetaCannotSignOutPrivilegedMemberError;

export declare namespace Users {
  export {
    BetaCannotSignOutPrimaryOwnerError as BetaCannotSignOutPrimaryOwnerError,
    BetaCannotSignOutSelfError as BetaCannotSignOutSelfError,
    BetaCannotSignOutManagedMemberError as BetaCannotSignOutManagedMemberError,
    BetaCannotSignOutMembershipAdminError as BetaCannotSignOutMembershipAdminError,
    BetaCannotSignOutOwnerError as BetaCannotSignOutOwnerError,
    BetaCannotSignOutPrivilegedMemberError as BetaCannotSignOutPrivilegedMemberError,
    type BetaCannotSignOutManagedMemberErrorDetails as BetaCannotSignOutManagedMemberErrorDetails,
    type BetaCannotSignOutMembershipAdminErrorDetails as BetaCannotSignOutMembershipAdminErrorDetails,
    type BetaCannotSignOutOwnerErrorDetails as BetaCannotSignOutOwnerErrorDetails,
    type BetaCannotSignOutPrimaryOwnerErrorDetails as BetaCannotSignOutPrimaryOwnerErrorDetails,
    type BetaCannotSignOutPrivilegedMemberErrorDetails as BetaCannotSignOutPrivilegedMemberErrorDetails,
    type BetaCannotSignOutSelfErrorDetails as BetaCannotSignOutSelfErrorDetails,
    type BetaOrganizationUser as BetaOrganizationUser,
    type UserRemoveResponse as UserRemoveResponse,
    type BetaOrganizationUsersPage as BetaOrganizationUsersPage,
    type UserUpdateParams as UserUpdateParams,
    type UserListParams as UserListParams,
    type UserSignOutParams as UserSignOutParams,
  };
}
