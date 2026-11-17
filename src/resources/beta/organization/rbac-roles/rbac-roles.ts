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
import { startApiCallSpan } from '../../../../internal/tracing';
import { path } from '../../../../internal/utils/path';

export class RBACRoles extends APIResource {
  permissions: PermissionsAPI.Permissions = new PermissionsAPI.Permissions(this._client);

  /**
   * Retrieve an RBAC Role by ID.
   *
   * The RBAC Roles API is available to Claude Enterprise organizations only.
   *
   * @throws {OrganizationTypeNotSupportedError}
   * @throws {ParentOrganizationRequiredError}
   * @throws {RBACRoleNotFoundError}
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
    return this._client.get(path`/v1/organizations/rbac_roles/${rbacRoleID}`, {
      ...options,
      __qualifiers: { beta: 'true' },
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
   * @throws {OrganizationTypeNotSupportedError}
   * @throws {ParentOrganizationRequiredError}
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
    return this._client.getAPIList('/v1/organizations/rbac_roles', PageCursor<BetaRBACRole>, {
      query,
      ...options,
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.rbac_roles.list', options, {
        route: '/v1/organizations/rbac_roles',
        queryParams: ['limit', 'page'],
      }),
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
   * Name of the RBAC Role. For a built-in role, this is Anthropic's name for the
   * access that the role grants. Anthropic may change this name, so to keep a
   * lasting reference to a role, store its `id`.
   */
  display_name: string;

  /**
   * Whether the RBAC Role is built-in or custom. More values of `type` may be added,
   * so do not treat every role that is not `built_in` as `custom`.
   */
  source: BetaRBACRoleSource;

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

export type BetaRBACRoleSource = BetaRBACRoleSourceBuiltIn | BetaRBACRoleSourceCustom;

export interface BetaRBACRoleSourceBuiltIn {
  /**
   * Anthropic provisions the RBAC Role, and the organization's administrators cannot
   * change or delete it.
   */
  type: 'built_in';
}

export interface BetaRBACRoleSourceCustom {
  /**
   * The organization's administrators can change and delete the RBAC Role.
   */
  type: 'custom';
}

export interface RBACRoleListParams extends PageCursorParams {}

RBACRoles.Permissions = Permissions;

export declare namespace RBACRoles {
  export {
    type BetaRBACRole as BetaRBACRole,
    type BetaRBACRoleSource as BetaRBACRoleSource,
    type BetaRBACRoleSourceBuiltIn as BetaRBACRoleSourceBuiltIn,
    type BetaRBACRoleSourceCustom as BetaRBACRoleSourceCustom,
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
