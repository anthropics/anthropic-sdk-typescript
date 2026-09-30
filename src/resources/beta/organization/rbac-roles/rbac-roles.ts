import { APIResource } from '../../../../core/resource';
import * as PermissionsAPI from './permissions';
import {
  BetaRBACAllConnectorsPermissionResource,
  BetaRBACConnectorPermissionResource,
  BetaRBACConnectorScopePermissionResource,
  BetaRBACConnectorToolPermissionResource,
  BetaRBACOrganizationPermissionResource,
  BetaRBACRolePermission,
  BetaRBACRolePermissionsPageCursor,
  PermissionListParams,
  Permissions,
} from './permissions';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class RBACRoles extends APIResource {
  permissions: PermissionsAPI.Permissions = new PermissionsAPI.Permissions(this._client);

  /**
   * Retrieve an RBAC Role by ID.
   *
   * The RBAC Roles API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * const betaRBACRole =
   *   await client.beta.organization.rbacRoles.retrieve(
   *     'rbac_role_id',
   *   );
   * ```
   */
  retrieve(rbacRoleID: string, options?: RequestOptions): APIPromise<BetaRBACRole> {
    return this._client.get(path`/v1/organizations/rbac_roles/${rbacRoleID}?beta=true`, options);
  }

  /**
   * List RBAC Roles in the organization.
   *
   * The RBAC Roles API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaRBACRole of client.beta.organization.rbacRoles.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: RBACRoleListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaRBACRolesPageCursor, BetaRBACRole> {
    return this._client.getAPIList('/v1/organizations/rbac_roles?beta=true', PageCursor<BetaRBACRole>, {
      query,
      ...options,
    });
  }
}

export type BetaRBACRolesPageCursor = PageCursor<BetaRBACRole>;

export interface BetaRBACRole {
  /**
   * ID of the RBAC Role.
   */
  id: string;

  /**
   * RFC 3339 datetime string indicating when the RBAC Role was created.
   */
  created_at: string;

  /**
   * Name of the RBAC Role.
   */
  name: string;

  /**
   * Object type.
   *
   * For RBAC Roles, this is always `"rbac_role"`.
   */
  type: 'rbac_role';

  /**
   * RFC 3339 datetime string indicating when the RBAC Role was last updated.
   */
  updated_at: string;
}

export interface RBACRoleListParams extends PageCursorParams {}

RBACRoles.Permissions = Permissions;

export declare namespace RBACRoles {
  export {
    type BetaRBACRole as BetaRBACRole,
    type BetaRBACRolesPageCursor as BetaRBACRolesPageCursor,
    type RBACRoleListParams as RBACRoleListParams,
  };

  export {
    Permissions as Permissions,
    type BetaRBACAllConnectorsPermissionResource as BetaRBACAllConnectorsPermissionResource,
    type BetaRBACConnectorPermissionResource as BetaRBACConnectorPermissionResource,
    type BetaRBACConnectorScopePermissionResource as BetaRBACConnectorScopePermissionResource,
    type BetaRBACConnectorToolPermissionResource as BetaRBACConnectorToolPermissionResource,
    type BetaRBACOrganizationPermissionResource as BetaRBACOrganizationPermissionResource,
    type BetaRBACRolePermission as BetaRBACRolePermission,
    type BetaRBACRolePermissionsPageCursor as BetaRBACRolePermissionsPageCursor,
    type PermissionListParams as PermissionListParams,
  };
}
