// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../core/resource';
import * as WorkspacesAPI from './workspaces';
import { BetaWorkspaceMembersPage } from './workspaces';
import { APIPromise } from '../../../../core/api-promise';
import { Page, type PageParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class Members extends APIResource {
  /**
   * Get Workspace Member
   *
   * @example
   * ```ts
   * const betaWorkspaceMember =
   *   await client.beta.organization.workspaces.members.retrieve(
   *     'user_id',
   *     { workspace_id: 'workspace_id' },
   *   );
   * ```
   */
  retrieve(
    userID: string,
    params: MemberRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<WorkspacesAPI.BetaWorkspaceMember> {
    const { workspace_id } = params;
    return this._client.get(
      path`/v1/organizations/workspaces/${workspace_id}/members/${userID}?beta=true`,
      options,
    );
  }

  /**
   * Update Workspace Member
   *
   * @example
   * ```ts
   * const betaWorkspaceMember =
   *   await client.beta.organization.workspaces.members.update(
   *     'user_id',
   *     {
   *       workspace_id: 'workspace_id',
   *       workspace_role: 'workspace_admin',
   *     },
   *   );
   * ```
   */
  update(
    userID: string,
    params: MemberUpdateParams,
    options?: RequestOptions,
  ): APIPromise<WorkspacesAPI.BetaWorkspaceMember> {
    const { workspace_id, ...body } = params;
    return this._client.post(path`/v1/organizations/workspaces/${workspace_id}/members/${userID}?beta=true`, {
      body,
      ...options,
    });
  }

  /**
   * List Workspace Members
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaWorkspaceMember of client.beta.organization.workspaces.members.list(
   *   'workspace_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    workspaceID: string,
    query: MemberListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaWorkspaceMembersPage, WorkspacesAPI.BetaWorkspaceMember> {
    return this._client.getAPIList(
      path`/v1/organizations/workspaces/${workspaceID}/members?beta=true`,
      Page<WorkspacesAPI.BetaWorkspaceMember>,
      { query, ...options },
    );
  }

  /**
   * Create Workspace Member
   *
   * @example
   * ```ts
   * const betaWorkspaceMember =
   *   await client.beta.organization.workspaces.members.add(
   *     'workspace_id',
   *     {
   *       user_id: 'user_01WCz1FkmYMm4gnmykNKUu3Q',
   *       workspace_role: 'workspace_admin',
   *     },
   *   );
   * ```
   */
  add(
    workspaceID: string,
    body: MemberAddParams,
    options?: RequestOptions,
  ): APIPromise<WorkspacesAPI.BetaWorkspaceMember> {
    return this._client.post(path`/v1/organizations/workspaces/${workspaceID}/members?beta=true`, {
      body,
      ...options,
    });
  }

  /**
   * Delete Workspace Member
   *
   * @example
   * ```ts
   * const member =
   *   await client.beta.organization.workspaces.members.remove(
   *     'user_id',
   *     { workspace_id: 'workspace_id' },
   *   );
   * ```
   */
  remove(
    userID: string,
    params: MemberRemoveParams,
    options?: RequestOptions,
  ): APIPromise<MemberRemoveResponse> {
    const { workspace_id } = params;
    return this._client.delete(
      path`/v1/organizations/workspaces/${workspace_id}/members/${userID}?beta=true`,
      options,
    );
  }
}

export interface MemberRemoveResponse {
  /**
   * Deleted object type.
   *
   * For Workspace Members, this is always `"workspace_member_deleted"`.
   */
  type: 'workspace_member_deleted';

  /**
   * ID of the User.
   */
  user_id: string;

  /**
   * ID of the Workspace.
   */
  workspace_id: string;
}

export interface MemberRetrieveParams {
  /**
   * ID of the Workspace.
   */
  workspace_id: string;
}

export interface MemberUpdateParams {
  /**
   * Path param: ID of the Workspace.
   */
  workspace_id: string;

  /**
   * Body param: New workspace role for the User.
   */
  workspace_role: WorkspacesAPI.BetaWorkspaceRole;
}

export interface MemberListParams extends PageParams {}

export interface MemberAddParams {
  /**
   * ID of the User.
   */
  user_id: string;

  /**
   * Role of the new Workspace Member. Cannot be `workspace_billing`.
   */
  workspace_role: WorkspacesAPI.BetaNoBillingWorkspaceRole;
}

export interface MemberRemoveParams {
  /**
   * ID of the Workspace.
   */
  workspace_id: string;
}

export declare namespace Members {
  export {
    type MemberRemoveResponse as MemberRemoveResponse,
    type MemberRetrieveParams as MemberRetrieveParams,
    type MemberUpdateParams as MemberUpdateParams,
    type MemberListParams as MemberListParams,
    type MemberAddParams as MemberAddParams,
    type MemberRemoveParams as MemberRemoveParams,
  };
}

export { type BetaWorkspaceMembersPage };
