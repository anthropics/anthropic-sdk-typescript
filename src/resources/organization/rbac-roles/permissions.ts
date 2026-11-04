import { APIResource } from '../../../core/resource';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

export class Permissions extends APIResource {
  /**
   * List the permissions an RBAC Role grants.
   *
   * The RBAC Roles API is available to Claude Enterprise organizations only.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const rbacRolePermission of client.organization.rbacRoles.permissions.list(
   *   'rbac_role_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    rbacRoleID: string,
    query: PermissionListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<RBACRolePermissionsPageCursor, RBACRolePermission> {
    return this._client.getAPIList(
      path`/v1/organizations/rbac_roles/${rbacRoleID}/permissions`,
      PageCursor<RBACRolePermission>,
      {
        query,
        ...options,
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.rbac_roles.permissions.list',
          options,
          {
            route: '/v1/organizations/rbac_roles/{rbac_role_id}/permissions',
            queryParams: ['limit', 'page'],
            attributes: { 'anthropic.organization.rbac_role.id': rbacRoleID },
          },
        ),
      },
    );
  }
}

export type RBACRolePermissionsPageCursor = PageCursor<RBACRolePermission>;

export interface RBACAllConnectorsPermissionResource {
  /**
   * Kind of resource the permission applies to.
   */
  type: 'all_connectors';
}

export interface RBACConnectorPermissionResource {
  /**
   * ID of the connector the permission applies to.
   */
  connector_id: string;

  /**
   * Kind of resource the permission applies to.
   */
  type: 'connector';
}

export interface RBACConnectorScopePermissionResource {
  /**
   * ID of the connector the permission applies to.
   */
  connector_id: string;

  /**
   * OAuth scope the permission names — the role may receive this scope when tokens
   * are minted for the connector.
   *
   * Subject to the same encoding rule as `tool_name`: a scope containing characters
   * outside `[a-zA-Z0-9_-]` (or colliding with a reserved form) appears
   * server-encoded in a stable `{prefix}_{32-hex}` form. OAuth scopes routinely
   * contain `:` and `/`, so most appear encoded.
   */
  scope: string;

  /**
   * Kind of resource the permission applies to.
   */
  type: 'connector_scope';
}

export interface RBACConnectorToolPermissionResource {
  /**
   * ID of the connector the permission applies to.
   */
  connector_id: string;

  /**
   * Published name of the connector tool the permission applies to.
   *
   * When the published name contains characters outside `[a-zA-Z0-9_-]` (or collides
   * with a reserved form), it is server-encoded into a stable `{prefix}_{32-hex}`
   * form — a shortened readable prefix of the name plus a hash — from which the
   * published name is not recoverable.
   */
  tool_name: string;

  /**
   * Kind of resource the permission applies to.
   */
  type: 'connector_tool';
}

export interface RBACOrganizationPermissionResource {
  /**
   * UUID of the organization the permission applies to.
   */
  organization_id: string;

  /**
   * Kind of resource the permission applies to.
   */
  type: 'organization';
}

export interface RBACRolePermission {
  /**
   * Action the permission grants on the resource.
   *
   * The vocabulary follows the resource: an `organization` grant carries a
   * product-feature entitlement (for example `chat`), an admin-panel permission
   * entitlement (`permission_*`), or a blanket capability-access mode —
   * `capability_access_all` grants every product-feature entitlement except
   * `inference_hooks_inspection`, which a role holds only through its own row, and
   * `capability_access_all_ga` grants the subset of those for stable features as it
   * stands at permission-check time; neither mode grants model-access entitlements.
   * A consumer enumerating a role's per-feature grants should treat a blanket row as
   * granting every product-feature entitlement it covers, or it will under-report
   * the role's effective access. A `connector_tool` grant carries a tool-access
   * action (`use` or `always_allow`); a `connector_scope` grant carries the scope
   * action `grant` (the role may receive the named OAuth scope when tokens are
   * minted for the connector); `connector` and `all_connectors` grants carry a
   * tool-access action, the scope action, or an authentication-method action
   * (`interactive` or `managed`).
   */
  action: string;

  /**
   * What the permission applies to.
   *
   * A tagged union: `type` names the kind of resource and determines which
   * identifier fields are present.
   */
  resource:
    | RBACOrganizationPermissionResource
    | RBACConnectorToolPermissionResource
    | RBACConnectorScopePermissionResource
    | RBACConnectorPermissionResource
    | RBACAllConnectorsPermissionResource;

  /**
   * Object type.
   *
   * For RBAC Role Permissions, this is always `"rbac_role_permission"`.
   */
  type: 'rbac_role_permission';
}

export interface PermissionListParams extends PageCursorParams {}

export declare namespace Permissions {
  export {
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
