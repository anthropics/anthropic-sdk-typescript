import { APIResource } from '../../../core/resource';
import * as PermissionsAPI from './permissions';
import {
  PermissionListParams,
  Permissions,
  RBACAllConnectorsPermissionResource,
  RBACConnectorPermissionResource,
  RBACConnectorScopePermissionResource,
  RBACConnectorToolPermissionResource,
  RBACOrganizationPermissionResource,
  RBACRolePermission,
  RBACRolePermissionsPageCursor,
} from './permissions';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

export class RBACRoles extends APIResource {
  permissions: PermissionsAPI.Permissions = new PermissionsAPI.Permissions(this._client);

  /**
   * Retrieve an RBAC Role by ID.
   *
   * The RBAC Roles API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * const rbacRole =
   *   await client.organization.rbacRoles.retrieve(
   *     'rbac_role_id',
   *   );
   * ```
   */
  retrieve(rbacRoleID: string, options?: RequestOptions): APIPromise<RBACRole> {
    return this._client.get(path`/v1/organizations/rbac_roles/${rbacRoleID}`, {
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.rbac_roles.retrieve', options, {
        route: '/v1/organizations/rbac_roles/{rbac_role_id}',
        attributes: { 'anthropic.organization.rbac_role.id': rbacRoleID },
      }),
    });
  }

  /**
   * List RBAC Roles in the organization.
   *
   * The RBAC Roles API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const rbacRole of client.organization.rbacRoles.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: RBACRoleListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<RBACRolesPageCursor, RBACRole> {
    return this._client.getAPIList('/v1/organizations/rbac_roles', PageCursor<RBACRole>, {
      query,
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.rbac_roles.list', options, {
        route: '/v1/organizations/rbac_roles',
        queryParams: ['limit', 'page'],
      }),
    });
  }
}

export type RBACRolesPageCursor = PageCursor<RBACRole>;

export interface RBACRole {
  /**
   * ID of the RBAC Role.
   */
  id: string;

  /**
   * RFC 3339 datetime string indicating when the RBAC Role was created.
   */
  created_at: string;

  /**
   * Name of the RBAC Role. For a role created by Anthropic, this name can differ
   * from the label claude.ai shows, and Anthropic may change the name. To keep a
   * lasting reference to a role, store its `id`.
   */
  display_name: string;

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
    type RBACRole as RBACRole,
    type RBACRolesPageCursor as RBACRolesPageCursor,
    type RBACRoleListParams as RBACRoleListParams,
  };

  export {
    Permissions as Permissions,
    type RBACAllConnectorsPermissionResource as RBACAllConnectorsPermissionResource,
    type RBACConnectorPermissionResource as RBACConnectorPermissionResource,
    type RBACConnectorScopePermissionResource as RBACConnectorScopePermissionResource,
    type RBACConnectorToolPermissionResource as RBACConnectorToolPermissionResource,
    type RBACOrganizationPermissionResource as RBACOrganizationPermissionResource,
    type RBACRolePermission as RBACRolePermission,
    type RBACRolePermissionsPageCursor as RBACRolePermissionsPageCursor,
    type PermissionListParams as PermissionListParams,
  };
}
