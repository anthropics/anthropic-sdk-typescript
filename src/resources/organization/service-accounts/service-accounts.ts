import { APIResource } from '../../../core/resource';
import * as WorkspacesAPI from './workspaces';
import {
  WorkspaceAddParams,
  WorkspaceListParams,
  WorkspaceRemoveParams,
  WorkspaceRemoveResponse,
  Workspaces,
} from './workspaces';
import * as OrganizationWorkspacesAPI from '../workspaces/workspaces';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class ServiceAccounts extends APIResource {
  workspaces: WorkspacesAPI.Workspaces = new WorkspacesAPI.Workspaces(this._client);

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Create a service account.
   *
   * A service account is a named workload identity that federation rules target.
   * `organization_role` is `developer` (default) or `admin`; a rule may only be
   * created or retargeted to grant `org:admin` scope when the target's
   * `organization_role` is `admin`. Creating an `admin`-role service account
   * requires an interactive credential (a user OAuth token or a Console session) — a
   * workload may only create `developer`-role service accounts.
   *
   * @example
   * ```ts
   * const serviceAccount =
   *   await client.organization.serviceAccounts.create({
   *     name: 'ci-deploy-bot',
   *   });
   * ```
   */
  create(body: ServiceAccountCreateParams, options?: RequestOptions): APIPromise<ServiceAccount> {
    return this._client.post('/v1/organizations/service_accounts', { body, ...options });
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Retrieve a service account by its ID (`svac_...`).
   *
   * @example
   * ```ts
   * const serviceAccount =
   *   await client.organization.serviceAccounts.retrieve(
   *     'service_account_id',
   *   );
   * ```
   */
  retrieve(serviceAccountID: string, options?: RequestOptions): APIPromise<ServiceAccount> {
    return this._client.get(path`/v1/organizations/service_accounts/${serviceAccountID}`, options);
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Update a service account.
   *
   * Only `description` and `organization_role` are mutable; `name` cannot be
   * changed. Archived service accounts cannot be updated; this returns 400. Setting
   * `organization_role` to `admin` (even when unchanged) requires an interactive
   * credential (a user OAuth token or a Console session).
   *
   * @example
   * ```ts
   * const serviceAccount =
   *   await client.organization.serviceAccounts.update(
   *     'service_account_id',
   *   );
   * ```
   */
  update(
    serviceAccountID: string,
    body: ServiceAccountUpdateParams,
    options?: RequestOptions,
  ): APIPromise<ServiceAccount> {
    return this._client.post(path`/v1/organizations/service_accounts/${serviceAccountID}`, {
      body,
      ...options,
    });
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * List service accounts in the caller's organization.
   *
   * Results are ordered by creation time, newest first. Use `limit` and the
   * `next_page` cursor to paginate; set `include_archived=true` to include archived
   * service accounts.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const serviceAccount of client.organization.serviceAccounts.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: ServiceAccountListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<ServiceAccountsPageCursor, ServiceAccount> {
    return this._client.getAPIList('/v1/organizations/service_accounts', PageCursor<ServiceAccount>, {
      query,
      ...options,
    });
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Archive a service account.
   *
   * Idempotent; re-archiving returns the service account with its original
   * `archived_at`. Rejected with 400 if any live (non-archived) federation rule
   * still targets this service account, same as issuer archival; archive those rules
   * first or change their target to another service account.
   *
   * @example
   * ```ts
   * const serviceAccount =
   *   await client.organization.serviceAccounts.archive(
   *     'service_account_id',
   *   );
   * ```
   */
  archive(serviceAccountID: string, options?: RequestOptions): APIPromise<ServiceAccount> {
    return this._client.post(path`/v1/organizations/service_accounts/${serviceAccountID}/archive`, options);
  }
}

export type ServiceAccountsPageCursor = PageCursor<ServiceAccount>;

export type ServiceAccountWorkspaceMembersPageCursor = PageCursor<ServiceAccountWorkspaceMember>;

/**
 * Named non-human identity within the caller's organization.
 *
 * A service account is a pure identity: name + org. Authorization lives on
 * whatever references it (federation rules).
 */
export interface ServiceAccount {
  /**
   * Tagged ID of the service account.
   */
  id: string;

  /**
   * If set, this service account is archived.
   */
  archived_at: string | null;

  /**
   * Tagged ID (`user_`/`svac_`) of the actor that archived this service account.
   */
  archived_by_actor_id: string | null;

  /**
   * When this service account was created.
   */
  created_at: string;

  /**
   * Tagged ID (`user_`/`svac_`) of the actor that created this service account.
   */
  created_by_actor_id: string | null;

  /**
   * Optional free-text description.
   */
  description: string | null;

  /**
   * Admin-chosen slug identifier.
   */
  name: string;

  /**
   * Org-level role. A federation rule may only be created or retargeted to grant
   * `org:admin` scope when this is `admin`. A rule granting `org:admin` whose target
   * is later demoted to `developer` is rejected at token exchange. Rules granting
   * `org:admin` are managed in the Console.
   */
  organization_role: 'admin' | 'developer';

  type: 'service_account';

  /**
   * When this service account was last updated.
   */
  updated_at: string;

  /**
   * Tagged ID (`user_`/`svac_`) of the actor that last updated this service account.
   */
  updated_by_actor_id: string | null;
}

export interface ServiceAccountWorkspaceMember {
  /**
   * Tagged ID (`user_...`/`svac_...`) of the actor who created this membership.
   */
  created_by_actor_id: string | null;

  /**
   * True when this is the implicit default-workspace membership every service
   * account has when no explicit membership exists. Implicit memberships have role
   * `workspace_user` and cannot be removed.
   */
  implicit: boolean | null;

  /**
   * Tagged service account ID (`svac_...`).
   */
  service_account_id: string;

  type: 'service_account_workspace_member';

  /**
   * Tagged workspace ID (`wrkspc_...`).
   */
  workspace_id: string;

  /**
   * Role of the service account in this workspace. Service accounts cannot hold the
   * `workspace_billing` role.
   */
  workspace_role: OrganizationWorkspacesAPI.WorkspaceRole;
}

export interface ServiceAccountCreateParams {
  /**
   * Slug identifier (lowercase, digits, hyphens). Unique within the organization; a
   * duplicate name returns 409.
   */
  name: string;

  /**
   * Optional free-text description.
   */
  description?: string | null;

  /**
   * Org-level role. Defaults to `developer`.
   */
  organization_role?: 'admin' | 'developer';
}

export interface ServiceAccountUpdateParams {
  /**
   * Replaces the description. Omit to leave unchanged; send `null` to clear (the
   * field is stored as an empty string).
   */
  description?: string | null;

  /**
   * Replaces the org-level role. Omit or send `null` to leave unchanged.
   */
  organization_role?: 'admin' | 'developer' | null;
}

export interface ServiceAccountListParams extends PageCursorParams {
  /**
   * Include archived resources. Defaults to false.
   */
  include_archived?: boolean;
}

ServiceAccounts.Workspaces = Workspaces;

export declare namespace ServiceAccounts {
  export {
    type ServiceAccount as ServiceAccount,
    type ServiceAccountWorkspaceMember as ServiceAccountWorkspaceMember,
    type ServiceAccountsPageCursor as ServiceAccountsPageCursor,
    type ServiceAccountCreateParams as ServiceAccountCreateParams,
    type ServiceAccountUpdateParams as ServiceAccountUpdateParams,
    type ServiceAccountListParams as ServiceAccountListParams,
  };

  export {
    Workspaces as Workspaces,
    type WorkspaceRemoveResponse as WorkspaceRemoveResponse,
    type WorkspaceListParams as WorkspaceListParams,
    type WorkspaceAddParams as WorkspaceAddParams,
    type WorkspaceRemoveParams as WorkspaceRemoveParams,
  };
}
