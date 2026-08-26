// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as ServiceAccountsAPI from '../service-accounts/service-accounts';
import { BetaServiceAccountWorkspaceMembersPageCursor } from '../service-accounts/service-accounts';
import * as WorkspacesAPI from './workspaces';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class ServiceAccounts extends APIResource {
  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Retrieve a service account's membership in a workspace.
   *
   * Returns the membership record, including the service account's `workspace_role`
   * in this workspace. Archived workspaces return 400. For the default workspace,
   * returns the implicit (`implicit: true`) membership when no explicit membership
   * exists; an explicitly added membership is returned with its assigned role. An
   * archived service account returns 404.
   *
   * @example
   * ```ts
   * const betaServiceAccountWorkspaceMember =
   *   await client.beta.organization.workspaces.serviceAccounts.retrieve(
   *     'service_account_id',
   *     { workspace_id: 'workspace_id' },
   *   );
   * ```
   */
  retrieve(
    serviceAccountID: string,
    params: ServiceAccountRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<ServiceAccountsAPI.BetaServiceAccountWorkspaceMember> {
    const { workspace_id, betas } = params;
    return this._client.get(
      path`/v1/organizations/workspaces/${workspace_id}/service_accounts/${serviceAccountID}?beta=true`,
      {
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
   * Change a service account's role in a workspace.
   *
   * The new `workspace_role` replaces the current one. Only explicit memberships can
   * be updated; to set a role on the implicit default-workspace membership, add the
   * service account explicitly with
   * `POST /workspaces/{workspace_id}/service_accounts`. Archived workspaces
   * return 400. Archived service accounts cannot be updated and are rejected.
   *
   * @example
   * ```ts
   * const betaServiceAccountWorkspaceMember =
   *   await client.beta.organization.workspaces.serviceAccounts.update(
   *     'service_account_id',
   *     {
   *       workspace_id: 'workspace_id',
   *       workspace_role: 'workspace_admin',
   *     },
   *   );
   * ```
   */
  update(
    serviceAccountID: string,
    params: ServiceAccountUpdateParams,
    options?: RequestOptions,
  ): APIPromise<ServiceAccountsAPI.BetaServiceAccountWorkspaceMember> {
    const { workspace_id, betas, ...body } = params;
    return this._client.post(
      path`/v1/organizations/workspaces/${workspace_id}/service_accounts/${serviceAccountID}?beta=true`,
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
   * List the service accounts that are members of a workspace.
   *
   * Each entry includes the service account's `workspace_role`. Use `limit` and the
   * `next_page` cursor to paginate. Archived workspaces return 400; use
   * `GET /service_accounts/{id}/workspaces` to audit memberships of an archived
   * workspace. The implicit default-workspace membership is not included in this
   * list. Memberships of archived service accounts are omitted from the results.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaServiceAccountWorkspaceMember of client.beta.organization.workspaces.serviceAccounts.list(
   *   'workspace_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    workspaceID: string,
    params: ServiceAccountListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<
    BetaServiceAccountWorkspaceMembersPageCursor,
    ServiceAccountsAPI.BetaServiceAccountWorkspaceMember
  > {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/organizations/workspaces/${workspaceID}/service_accounts?beta=true`,
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
   * The role determines what the service account can do in the workspace and which
   * workspace-scoped permissions it can be granted when authenticating through
   * federation. Every service account is already an implicit `workspace_user` member
   * of the default workspace; adding it explicitly assigns a chosen role. If the
   * service account is already an explicit member of the workspace, its
   * `workspace_role` is replaced with the value supplied here. Archived workspaces
   * return 400. Archived service accounts cannot be added and are rejected.
   *
   * @example
   * ```ts
   * const betaServiceAccountWorkspaceMember =
   *   await client.beta.organization.workspaces.serviceAccounts.add(
   *     'workspace_id',
   *     {
   *       service_account_id: 'service_account_id',
   *       workspace_role: 'workspace_admin',
   *     },
   *   );
   * ```
   */
  add(
    workspaceID: string,
    params: ServiceAccountAddParams,
    options?: RequestOptions,
  ): APIPromise<ServiceAccountsAPI.BetaServiceAccountWorkspaceMember> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/workspaces/${workspaceID}/service_accounts?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Remove a service account from a workspace.
   *
   * Removal is idempotent (returns 200 even if the membership was already removed).
   * A DELETE against the implicit default-workspace membership returns 200 but is a
   * no-op and the membership persists; deleting an explicit default-workspace row
   * reverts to the implicit `workspace_user` membership. Archived workspaces
   * return 400.
   *
   * @example
   * ```ts
   * const serviceAccount =
   *   await client.beta.organization.workspaces.serviceAccounts.remove(
   *     'service_account_id',
   *     { workspace_id: 'workspace_id' },
   *   );
   * ```
   */
  remove(
    serviceAccountID: string,
    params: ServiceAccountRemoveParams,
    options?: RequestOptions,
  ): APIPromise<ServiceAccountRemoveResponse> {
    const { workspace_id, betas } = params;
    return this._client.delete(
      path`/v1/organizations/workspaces/${workspace_id}/service_accounts/${serviceAccountID}?beta=true`,
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

export interface ServiceAccountRemoveResponse {
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

export interface ServiceAccountRetrieveParams {
  /**
   * Path param: ID of the workspace.
   */
  workspace_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ServiceAccountUpdateParams {
  /**
   * Path param: ID of the workspace.
   */
  workspace_id: string;

  /**
   * Body param: New role for the service account in this workspace.
   */
  workspace_role: WorkspacesAPI.BetaNoBillingWorkspaceRole;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ServiceAccountListParams extends PageCursorParams {
  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ServiceAccountAddParams {
  /**
   * Body param: Tagged service account ID to add.
   */
  service_account_id: string;

  /**
   * Body param: Role to assign to the service account in this workspace.
   */
  workspace_role: WorkspacesAPI.BetaNoBillingWorkspaceRole;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ServiceAccountRemoveParams {
  /**
   * Path param: ID of the workspace.
   */
  workspace_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace ServiceAccounts {
  export {
    type ServiceAccountRemoveResponse as ServiceAccountRemoveResponse,
    type ServiceAccountRetrieveParams as ServiceAccountRetrieveParams,
    type ServiceAccountUpdateParams as ServiceAccountUpdateParams,
    type ServiceAccountListParams as ServiceAccountListParams,
    type ServiceAccountAddParams as ServiceAccountAddParams,
    type ServiceAccountRemoveParams as ServiceAccountRemoveParams,
  };
}

export { type BetaServiceAccountWorkspaceMembersPageCursor };
