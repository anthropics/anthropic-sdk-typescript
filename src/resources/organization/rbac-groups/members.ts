import { APIResource } from '../../../core/resource';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

export class Members extends APIResource {
  /**
   * List members of an RBAC Group.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const rbacGroupMember of client.organization.rbacGroups.members.list(
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
  ): PagePromise<RBACGroupMembersPageCursor, RBACGroupMember> {
    return this._client.getAPIList(
      path`/v1/organizations/rbac_groups/${rbacGroupID}/members`,
      PageCursor<RBACGroupMember>,
      {
        query,
        ...options,
        __span: startApiCallSpan(this._client, 'anthropic.organization.rbac_groups.members.list', options, {
          route: '/v1/organizations/rbac_groups/{rbac_group_id}/members',
          queryParams: ['limit', 'page'],
          attributes: { 'anthropic.organization.rbac_group.id': rbacGroupID },
        }),
      },
    );
  }

  /**
   * Add a User to an RBAC Group. Membership of groups provisioned by an identity
   * provider (source type `"scim"`) cannot be modified via the API while an
   * organization in the tenant uses SCIM provisioning.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @throws {RBACGroupGrantsOwnerAccessError}
   * @throws {RBACGroupOwnerAccessUnconfirmedError}
   * @throws {SandboxEgressRestrictedError}
   *
   * @example
   * ```ts
   * const rbacGroupMember =
   *   await client.organization.rbacGroups.members.add(
   *     'rbac_group_id',
   *     { user_id: 'user_01WxYzAbCdEfGhJkMnPqRsTu' },
   *   );
   * ```
   */
  add(rbacGroupID: string, body: MemberAddParams, options?: RequestOptions): APIPromise<RBACGroupMember> {
    return this._client.post(path`/v1/organizations/rbac_groups/${rbacGroupID}/members`, {
      body,
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.rbac_groups.members.add', options, {
        route: '/v1/organizations/rbac_groups/{rbac_group_id}/members',
        attributes: { 'anthropic.organization.rbac_group.id': rbacGroupID },
        createdIDAttribute: 'anthropic.organization.rbac_group.member.id',
        createdIDField: 'user_id',
      }),
    });
  }

  /**
   * Remove a User from an RBAC Group. Membership of groups provisioned by an
   * identity provider (source type `"scim"`) cannot be modified via the API while an
   * organization in the tenant uses SCIM provisioning.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @throws {RBACGroupGrantsOwnerAccessError}
   * @throws {RBACGroupOwnerAccessUnconfirmedError}
   * @throws {SandboxEgressRestrictedError}
   *
   * @example
   * ```ts
   * const deletedRBACGroupMember =
   *   await client.organization.rbacGroups.members.remove(
   *     'user_id',
   *     { rbac_group_id: 'rbac_group_id' },
   *   );
   * ```
   */
  remove(
    userID: string,
    params: MemberRemoveParams,
    options?: RequestOptions,
  ): APIPromise<DeletedRBACGroupMember> {
    const { rbac_group_id } = params;
    return this._client.delete(path`/v1/organizations/rbac_groups/${rbac_group_id}/members/${userID}`, {
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.rbac_groups.members.remove', options, {
        route: '/v1/organizations/rbac_groups/{rbac_group_id}/members/{user_id}',
        attributes: {
          'anthropic.organization.rbac_group.id': rbac_group_id,
          'anthropic.organization.rbac_group.member.id': userID,
        },
      }),
    });
  }
}

export type RBACGroupMembersPageCursor = PageCursor<RBACGroupMember>;

export interface DeletedRBACGroupMember {
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

export interface RBACGroupMember {
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
    type DeletedRBACGroupMember as DeletedRBACGroupMember,
    type RBACGroupMember as RBACGroupMember,
    type RBACGroupMembersPageCursor as RBACGroupMembersPageCursor,
    type MemberListParams as MemberListParams,
    type MemberAddParams as MemberAddParams,
    type MemberRemoveParams as MemberRemoveParams,
  };
}
