// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as ServiceAccountsAPI from './service-accounts';
import { BetaServiceAccountWorkspaceMembersPageCursor } from './service-accounts';
import * as OrganizationWorkspacesAPI from '../workspaces/workspaces';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class Workspaces extends APIResource {
  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * List the workspaces a service account is a member of.
   *
   * Each entry includes the service account's `workspace_role` in that workspace.
   * Use `limit` and the `next_page` cursor to paginate. When the service account has
   * no explicit default-workspace membership, the implicit (`implicit: true`)
   * membership is returned as the first entry on the first page; with `limit=1` the
   * first page may return up to 2 entries (the implicit entry plus one explicit
   * membership) so a pagination cursor can be derived. Memberships are returned only
   * while the service account is active. Without a `page` cursor, an archived
   * service account returns an empty list. A `page` cursor that does not match an
   * active membership returns a 400 invalid-request error. A cursor stops matching
   * when the membership is removed, the workspace is deleted, or the service account
   * is archived. Restart pagination from the first page to recover.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaServiceAccountWorkspaceMember of client.beta.organization.serviceAccounts.workspaces.list(
   *   'service_account_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    serviceAccountID: string,
    params: WorkspaceListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<
    BetaServiceAccountWorkspaceMembersPageCursor,
    ServiceAccountsAPI.BetaServiceAccountWorkspaceMember
  > {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/organizations/service_accounts/${serviceAccountID}/workspaces?beta=true`,
      PageCursor<ServiceAccountsAPI.BetaServiceAccountWorkspaceMember>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
          options?.headers,
        ]),
      },
    );
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Add a service account to a workspace with the given `workspace_role`.
   *
   * Mirror of `POST /workspaces/{workspace_id}/service_accounts`, addressed from the
   * service-account side; both create the same membership. If the service account is
   * already an explicit member of the workspace, its `workspace_role` is replaced
   * with the value supplied here. Archived workspaces return 400. Archived service
   * accounts cannot be added and are rejected.
   *
   * @example
   * ```ts
   * const betaServiceAccountWorkspaceMember =
   *   await client.beta.organization.serviceAccounts.workspaces.add(
   *     'service_account_id',
   *     {
   *       workspace_id: 'workspace_id',
   *       workspace_role: 'workspace_admin',
   *     },
   *   );
   * ```
   */
  add(
    serviceAccountID: string,
    params: WorkspaceAddParams,
    options?: RequestOptions,
  ): APIPromise<ServiceAccountsAPI.BetaServiceAccountWorkspaceMember> {
    const { betas, ...body } = params;
    return this._client.post(
      path`/v1/organizations/service_accounts/${serviceAccountID}/workspaces?beta=true`,
      {
        body,
        ...options,
        headers: buildHeaders([
          { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
          options?.headers,
        ]),
      },
    );
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Remove a service account from a workspace.
   *
   * Mirror of
   * `DELETE /workspaces/{workspace_id}/service_accounts/{service_account_id}`,
   * addressed from the service-account side. Removal is idempotent (returns 200 even
   * if the membership was already removed). A DELETE against the implicit
   * default-workspace membership returns 200 but is a no-op and the membership
   * persists; deleting an explicit default-workspace row reverts to the implicit
   * `workspace_user` membership. Archived workspaces return 400.
   *
   * @example
   * ```ts
   * const workspace =
   *   await client.beta.organization.serviceAccounts.workspaces.remove(
   *     'workspace_id',
   *     { service_account_id: 'service_account_id' },
   *   );
   * ```
   */
  remove(
    workspaceID: string,
    params: WorkspaceRemoveParams,
    options?: RequestOptions,
  ): APIPromise<WorkspaceRemoveResponse> {
    const { service_account_id, betas } = params;
    return this._client.delete(
      path`/v1/organizations/service_accounts/${service_account_id}/workspaces/${workspaceID}?beta=true`,
      {
        ...options,
        headers: buildHeaders([
          { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
          options?.headers,
        ]),
      },
    );
  }
}

export interface WorkspaceRemoveResponse {
  /**
   * Tagged service account ID (`svac_...`) named in the delete request. Removal is
   * idempotent; see the endpoint description for the implicit-membership no-op.
   */
  service_account_id: string;

  type: 'service_account_workspace_member_deleted';

  /**
   * Tagged workspace ID (`wrkspc_...`) named in the delete request.
   */
  workspace_id: string;
}

export interface WorkspaceListParams extends PageCursorParams {
  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkspaceAddParams {
  /**
   * Body param: Tagged workspace ID to add the service account to.
   */
  workspace_id: string;

  /**
   * Body param: Role to assign to the service account in this workspace.
   */
  workspace_role: OrganizationWorkspacesAPI.BetaNoBillingWorkspaceRole;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkspaceRemoveParams {
  /**
   * Path param: ID of the service account.
   */
  service_account_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Workspaces {
  export {
    type WorkspaceRemoveResponse as WorkspaceRemoveResponse,
    type WorkspaceListParams as WorkspaceListParams,
    type WorkspaceAddParams as WorkspaceAddParams,
    type WorkspaceRemoveParams as WorkspaceRemoveParams,
  };
}

export { type BetaServiceAccountWorkspaceMembersPageCursor };
