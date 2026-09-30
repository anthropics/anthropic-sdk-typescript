import { APIResource } from '../../../../core/resource';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class Members extends APIResource {
  /**
   * List members of an RBAC Group.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaRBACGroupMember of client.beta.organization.rbacGroups.members.list(
   *   'rbac_group_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    rbacGroupID: string,
    query: MemberListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaRBACGroupMembersPageCursor, BetaRBACGroupMember> {
    return this._client.getAPIList(
      path`/v1/organizations/rbac_groups/${rbacGroupID}/members?beta=true`,
      PageCursor<BetaRBACGroupMember>,
      { query, ...options },
    );
  }

  /**
   * Add a User to an RBAC Group. Membership of groups provisioned by an identity
   * provider (source type `"scim"`) cannot be modified via the API while an
   * organization in the tenant uses SCIM provisioning.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * const betaRBACGroupMember =
   *   await client.beta.organization.rbacGroups.members.add(
   *     'rbac_group_id',
   *     { user_id: 'user_01WCz1FkmYMm4gnmykNKUu3Q' },
   *   );
   * ```
   */
  add(rbacGroupID: string, body: MemberAddParams, options?: RequestOptions): APIPromise<BetaRBACGroupMember> {
    return this._client.post(path`/v1/organizations/rbac_groups/${rbacGroupID}/members?beta=true`, {
      body,
      ...options,
    });
  }

  /**
   * Remove a User from an RBAC Group. Membership of groups provisioned by an
   * identity provider (source type `"scim"`) cannot be modified via the API while an
   * organization in the tenant uses SCIM provisioning.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * const member =
   *   await client.beta.organization.rbacGroups.members.remove(
   *     'user_id',
   *     { rbac_group_id: 'rbac_group_id' },
   *   );
   * ```
   */
  remove(
    userID: string,
    params: MemberRemoveParams,
    options?: RequestOptions,
  ): APIPromise<MemberRemoveResponse> {
    const { rbac_group_id } = params;
    return this._client.delete(
      path`/v1/organizations/rbac_groups/${rbac_group_id}/members/${userID}?beta=true`,
      options,
    );
  }
}

export type BetaRBACGroupMembersPageCursor = PageCursor<BetaRBACGroupMember>;

export interface BetaRBACGroupMember {
  /**
   * RFC 3339 timestamp of when the User was added to the RBAC Group.
   */
  created_at: string;

  /**
   * Email of the User.
   */
  email: string;

  /**
   * ID of the RBAC Group.
   */
  rbac_group_id: string;

  /**
   * Object type.
   *
   * For RBAC Group Members, this is always `"rbac_group_member"`.
   */
  type: 'rbac_group_member';

  /**
   * ID of the User.
   */
  user_id: string;
}

export interface MemberRemoveResponse {
  /**
   * ID of the RBAC Group.
   */
  rbac_group_id: string;

  /**
   * Deleted object type. For RBAC Group Members, this is always
   * `"rbac_group_member_deleted"`.
   */
  type: 'rbac_group_member_deleted';

  /**
   * ID of the User.
   */
  user_id: string;
}

export interface MemberListParams extends PageCursorParams {}

export interface MemberAddParams {
  /**
   * ID of the User.
   */
  user_id: string;
}

export interface MemberRemoveParams {
  /**
   * ID of the RBAC Group.
   */
  rbac_group_id: string;
}

export declare namespace Members {
  export {
    type BetaRBACGroupMember as BetaRBACGroupMember,
    type MemberRemoveResponse as MemberRemoveResponse,
    type BetaRBACGroupMembersPageCursor as BetaRBACGroupMembersPageCursor,
    type MemberListParams as MemberListParams,
    type MemberAddParams as MemberAddParams,
    type MemberRemoveParams as MemberRemoveParams,
  };
}
