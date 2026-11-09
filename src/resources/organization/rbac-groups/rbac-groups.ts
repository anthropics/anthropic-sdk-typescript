import { APIResource } from '../../../core/resource';
import * as MembersAPI from './members';
import {
  DeletedRBACGroupMember,
  MemberAddParams,
  MemberListParams,
  MemberRemoveParams,
  Members,
  RBACGroupMember,
  RBACGroupMembersPageCursor,
} from './members';
import { APIPromise } from '../../../core/api-promise';
import { BadRequestError } from '../../../core/error';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

/**
 * A role attached to an RBAC Group in the request grants owner access, so this API
 * does not add members to that group (directly or through an invite), remove its
 * members, or delete it. Make the change in the organization's admin settings in
 * Claude.
 */
export class RBACGroupGrantsOwnerAccessError extends BadRequestError {
  declare readonly errorCode: 'rbac_group_grants_owner_access';
  declare readonly details: RBACGroupGrantsOwnerAccessErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'RBACGroupGrantsOwnerAccessError';
}

/**
 * The API could not finish checking whether an RBAC Group in the request grants
 * owner access, so it made no change. Retrying the same request will not help.
 * Make the change in the organization's admin settings in Claude.
 */
export class RBACGroupOwnerAccessUnconfirmedError extends BadRequestError {
  declare readonly errorCode: 'rbac_group_owner_access_unconfirmed';
  declare readonly details: RBACGroupOwnerAccessUnconfirmedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'RBACGroupOwnerAccessUnconfirmedError';
}

export class RBACGroups extends APIResource {
  members: MembersAPI.Members = new MembersAPI.Members(this._client);

  /**
   * Create an RBAC Group in the Claude Enterprise tenant. Groups created via the API
   * have source type `"direct"`.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @throws {SandboxEgressRestrictedError}
   *
   * @example
   * ```ts
   * const rbacGroup =
   *   await client.organization.rbacGroups.create({
   *     name: 'Engineering',
   *   });
   * ```
   */
  create(body: RBACGroupCreateParams, options?: RequestOptions): APIPromise<RBACGroup> {
    return this._client.post('/v1/organizations/rbac_groups', {
      body,
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.rbac_groups.create', options, {
        route: '/v1/organizations/rbac_groups',
        createdIDAttribute: 'anthropic.organization.rbac_group.id',
      }),
    });
  }

  /**
   * Retrieve an RBAC Group by ID.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * const rbacGroup =
   *   await client.organization.rbacGroups.retrieve(
   *     'rbac_group_id',
   *   );
   * ```
   */
  retrieve(rbacGroupID: string, options?: RequestOptions): APIPromise<RBACGroup> {
    return this._client.get(path`/v1/organizations/rbac_groups/${rbacGroupID}`, {
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.rbac_groups.retrieve', options, {
        route: '/v1/organizations/rbac_groups/{rbac_group_id}',
        attributes: { 'anthropic.organization.rbac_group.id': rbacGroupID },
      }),
    });
  }

  /**
   * Update an RBAC Group's name. Groups provisioned by an identity provider (source
   * type `"scim"`) cannot be modified via the API while an organization in the
   * tenant uses SCIM provisioning.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @throws {SandboxEgressRestrictedError}
   *
   * @example
   * ```ts
   * const rbacGroup =
   *   await client.organization.rbacGroups.update(
   *     'rbac_group_id',
   *     {},
   *   );
   * ```
   */
  update(rbacGroupID: string, body: RBACGroupUpdateParams, options?: RequestOptions): APIPromise<RBACGroup> {
    return this._client.post(path`/v1/organizations/rbac_groups/${rbacGroupID}`, {
      body,
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.rbac_groups.update', options, {
        route: '/v1/organizations/rbac_groups/{rbac_group_id}',
        attributes: { 'anthropic.organization.rbac_group.id': rbacGroupID },
      }),
    });
  }

  /**
   * List RBAC Groups in the Claude Enterprise tenant.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const rbacGroup of client.organization.rbacGroups.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: RBACGroupListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<RBACGroupsPageCursor, RBACGroup> {
    return this._client.getAPIList('/v1/organizations/rbac_groups', PageCursor<RBACGroup>, {
      query,
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.rbac_groups.list', options, {
        route: '/v1/organizations/rbac_groups',
        queryParams: ['limit', 'page'],
      }),
    });
  }

  /**
   * Delete an RBAC Group. Groups provisioned by an identity provider (source type
   * `"scim"`) cannot be deleted via the API while an organization in the tenant uses
   * SCIM provisioning.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @throws {RBACGroupGrantsOwnerAccessError}
   * @throws {RBACGroupOwnerAccessUnconfirmedError}
   * @throws {SandboxEgressRestrictedError}
   *
   * @example
   * ```ts
   * const deletedRBACGroup =
   *   await client.organization.rbacGroups.delete(
   *     'rbac_group_id',
   *   );
   * ```
   */
  delete(rbacGroupID: string, options?: RequestOptions): APIPromise<DeletedRBACGroup> {
    return this._client.delete(path`/v1/organizations/rbac_groups/${rbacGroupID}`, {
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.rbac_groups.delete', options, {
        route: '/v1/organizations/rbac_groups/{rbac_group_id}',
        attributes: { 'anthropic.organization.rbac_group.id': rbacGroupID },
      }),
    });
  }
}

export type RBACGroupsPageCursor = PageCursor<RBACGroup>;

export interface DeletedRBACGroup {
  /**
   * ID of the RBAC Group.
   */
  id: string;

  /**
   * Deleted object type.
   *
   * For RBAC Groups, this is always `"rbac_group_deleted"`.
   */
  type: 'rbac_group_deleted';
}

export interface RBACGroup {
  /**
   * ID of the RBAC Group.
   */
  id: string;

  /**
   * RFC 3339 timestamp of when the RBAC Group was created.
   */
  created_at: string;

  /**
   * Name of the RBAC Group. Not uniqueness-enforced.
   */
  name: string;

  /**
   * RBAC Role IDs attached to this RBAC Group. Role attachment is managed in the
   * admin settings and is read-only on this API. `null` means role data was
   * temporarily unavailable — retry to distinguish from an empty list.
   */
  role_ids: Array<string> | null;

  /**
   * How the RBAC Group was created: `"direct"` for groups created directly (for
   * example, in the organization's admin settings), `"scim"` for groups provisioned
   * by the identity provider.
   */
  source_type: 'direct' | 'scim';

  /**
   * Object type.
   *
   * For RBAC Groups, this is always `"rbac_group"`.
   */
  type: 'rbac_group';

  /**
   * RFC 3339 timestamp of when the RBAC Group was last updated.
   */
  updated_at: string;
}

/**
 * A role attached to an RBAC Group in the request grants owner access, so this API
 * does not add members to that group (directly or through an invite), remove its
 * members, or delete it. Make the change in the organization's admin settings in
 * Claude.
 */
export interface RBACGroupGrantsOwnerAccessErrorDetails {
  error_code: 'rbac_group_grants_owner_access';
}

/**
 * The API could not finish checking whether an RBAC Group in the request grants
 * owner access, so it made no change. Retrying the same request will not help.
 * Make the change in the organization's admin settings in Claude.
 */
export interface RBACGroupOwnerAccessUnconfirmedErrorDetails {
  error_code: 'rbac_group_owner_access_unconfirmed';
}

export interface RBACGroupCreateParams {
  /**
   * Name of the RBAC Group. Not uniqueness-enforced.
   */
  name: string;
}

export interface RBACGroupUpdateParams {
  /**
   * Name of the RBAC Group. Not uniqueness-enforced.
   */
  name?: string | null;
}

export interface RBACGroupListParams extends PageCursorParams {}

RBACGroups.RBACGroupGrantsOwnerAccessError = RBACGroupGrantsOwnerAccessError;
RBACGroups.RBACGroupOwnerAccessUnconfirmedError = RBACGroupOwnerAccessUnconfirmedError;
RBACGroups.Members = Members;

export declare namespace RBACGroups {
  export {
    RBACGroupGrantsOwnerAccessError as RBACGroupGrantsOwnerAccessError,
    RBACGroupOwnerAccessUnconfirmedError as RBACGroupOwnerAccessUnconfirmedError,
    type DeletedRBACGroup as DeletedRBACGroup,
    type RBACGroup as RBACGroup,
    type RBACGroupGrantsOwnerAccessErrorDetails as RBACGroupGrantsOwnerAccessErrorDetails,
    type RBACGroupOwnerAccessUnconfirmedErrorDetails as RBACGroupOwnerAccessUnconfirmedErrorDetails,
    type RBACGroupsPageCursor as RBACGroupsPageCursor,
    type RBACGroupCreateParams as RBACGroupCreateParams,
    type RBACGroupUpdateParams as RBACGroupUpdateParams,
    type RBACGroupListParams as RBACGroupListParams,
  };

  export {
    Members as Members,
    type DeletedRBACGroupMember as DeletedRBACGroupMember,
    type RBACGroupMember as RBACGroupMember,
    type RBACGroupMembersPageCursor as RBACGroupMembersPageCursor,
    type MemberListParams as MemberListParams,
    type MemberAddParams as MemberAddParams,
    type MemberRemoveParams as MemberRemoveParams,
  };
}
