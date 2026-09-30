import { APIResource } from '../../../../core/resource';
import * as MembersAPI from './members';
import {
  BetaRBACGroupMember,
  BetaRBACGroupMembersPageCursor,
  MemberAddParams,
  MemberListParams,
  MemberRemoveParams,
  MemberRemoveResponse,
  Members,
} from './members';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class RBACGroups extends APIResource {
  members: MembersAPI.Members = new MembersAPI.Members(this._client);

  /**
   * Create an RBAC Group in the Claude Enterprise tenant. Groups created via the API
   * have source type `"direct"`.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * const betaRBACGroup =
   *   await client.beta.organization.rbacGroups.create({
   *     name: 'Engineering',
   *   });
   * ```
   */
  create(body: RBACGroupCreateParams, options?: RequestOptions): APIPromise<BetaRBACGroup> {
    return this._client.post('/v1/organizations/rbac_groups?beta=true', { body, ...options });
  }

  /**
   * Retrieve an RBAC Group by ID.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * const betaRBACGroup =
   *   await client.beta.organization.rbacGroups.retrieve(
   *     'rbac_group_id',
   *   );
   * ```
   */
  retrieve(rbacGroupID: string, options?: RequestOptions): APIPromise<BetaRBACGroup> {
    return this._client.get(path`/v1/organizations/rbac_groups/${rbacGroupID}?beta=true`, options);
  }

  /**
   * Update an RBAC Group's name. Groups provisioned by an identity provider (source
   * type `"scim"`) cannot be modified via the API while an organization in the
   * tenant uses SCIM provisioning.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * const betaRBACGroup =
   *   await client.beta.organization.rbacGroups.update(
   *     'rbac_group_id',
   *   );
   * ```
   */
  update(
    rbacGroupID: string,
    body: RBACGroupUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaRBACGroup> {
    return this._client.post(path`/v1/organizations/rbac_groups/${rbacGroupID}?beta=true`, {
      body,
      ...options,
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
   * for await (const betaRBACGroup of client.beta.organization.rbacGroups.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: RBACGroupListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaRBACGroupsPageCursor, BetaRBACGroup> {
    return this._client.getAPIList('/v1/organizations/rbac_groups?beta=true', PageCursor<BetaRBACGroup>, {
      query,
      ...options,
    });
  }

  /**
   * Delete an RBAC Group. Groups provisioned by an identity provider (source type
   * `"scim"`) cannot be deleted via the API while an organization in the tenant uses
   * SCIM provisioning.
   *
   * The RBAC Groups API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * const rbacGroup =
   *   await client.beta.organization.rbacGroups.delete(
   *     'rbac_group_id',
   *   );
   * ```
   */
  delete(rbacGroupID: string, options?: RequestOptions): APIPromise<RBACGroupDeleteResponse> {
    return this._client.delete(path`/v1/organizations/rbac_groups/${rbacGroupID}?beta=true`, options);
  }
}

export type BetaRBACGroupsPageCursor = PageCursor<BetaRBACGroup>;

export interface BetaRBACGroup {
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

export interface RBACGroupDeleteResponse {
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

RBACGroups.Members = Members;

export declare namespace RBACGroups {
  export {
    type BetaRBACGroup as BetaRBACGroup,
    type RBACGroupDeleteResponse as RBACGroupDeleteResponse,
    type BetaRBACGroupsPageCursor as BetaRBACGroupsPageCursor,
    type RBACGroupCreateParams as RBACGroupCreateParams,
    type RBACGroupUpdateParams as RBACGroupUpdateParams,
    type RBACGroupListParams as RBACGroupListParams,
  };

  export {
    Members as Members,
    type BetaRBACGroupMember as BetaRBACGroupMember,
    type MemberRemoveResponse as MemberRemoveResponse,
    type BetaRBACGroupMembersPageCursor as BetaRBACGroupMembersPageCursor,
    type MemberListParams as MemberListParams,
    type MemberAddParams as MemberAddParams,
    type MemberRemoveParams as MemberRemoveParams,
  };
}
