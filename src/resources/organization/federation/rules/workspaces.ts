import { APIResource } from '../../../../core/resource';
import * as RulesAPI from './rules';
import { FederationRuleWorkspacesPageCursor } from './rules';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class Workspaces extends APIResource {
  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * List workspaces where this federation rule is enabled.
   *
   * Returns all workspace enablements in a single response; the `limit` and `page`
   * parameters are accepted but have no effect, and `next_page` is always `null`.
   * Returns explicit per-workspace enablements only; for rules with
   * `applies_to_all_workspaces` or a legacy single `workspace_id`, check those
   * fields on the rule itself.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const federationRuleWorkspace of client.organization.federation.rules.workspaces.list(
   *   'federation_rule_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    federationRuleID: string,
    query: WorkspaceListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<FederationRuleWorkspacesPageCursor, RulesAPI.FederationRuleWorkspace> {
    return this._client.getAPIList(
      path`/v1/organizations/federation_rules/${federationRuleID}/workspaces`,
      PageCursor<RulesAPI.FederationRuleWorkspace>,
      { query, ...options },
    );
  }

  /**
   * **Requires an OAuth access token with the `org:admin` scope**, from
   * `ant auth login --scope org:admin` or a workload identity federation rule; Admin
   * API keys are not accepted. See
   * [Manage WIF with the Admin API](/docs/en/manage-claude/wif-admin-api).
   *
   * Enable a federation rule for a workspace.
   *
   * Idempotent; re-enabling returns the existing enablement. The rule and workspace
   * must both belong to your organization. Membership of the rule's target service
   * account in this workspace is not checked at enablement: token exchange into this
   * workspace is rejected unless the target is a member (it is implicitly a member
   * of the default workspace). Archived rules are rejected with 400. OAuth callers
   * may only manage rules whose `oauth_scope` is `workspace:developer` or
   * `workspace:inference`; other scopes require a Console session.
   *
   * @example
   * ```ts
   * const federationRuleWorkspace =
   *   await client.organization.federation.rules.workspaces.add(
   *     'federation_rule_id',
   *     { workspace_id: 'workspace_id' },
   *   );
   * ```
   */
  add(
    federationRuleID: string,
    body: WorkspaceAddParams,
    options?: RequestOptions,
  ): APIPromise<RulesAPI.FederationRuleWorkspace> {
    return this._client.post(path`/v1/organizations/federation_rules/${federationRuleID}/workspaces`, {
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
   * Disable a federation rule for a workspace.
   *
   * Idempotent; succeeds even if the enablement was already removed. OAuth callers
   * may only manage rules whose `oauth_scope` is `workspace:developer` or
   * `workspace:inference`; other scopes require a Console session.
   *
   * @example
   * ```ts
   * const workspace =
   *   await client.organization.federation.rules.workspaces.remove(
   *     'workspace_id',
   *     { federation_rule_id: 'federation_rule_id' },
   *   );
   * ```
   */
  remove(
    workspaceID: string,
    params: WorkspaceRemoveParams,
    options?: RequestOptions,
  ): APIPromise<WorkspaceRemoveResponse> {
    const { federation_rule_id } = params;
    return this._client.delete(
      path`/v1/organizations/federation_rules/${federation_rule_id}/workspaces/${workspaceID}`,
      options,
    );
  }
}

export interface WorkspaceRemoveResponse {
  /**
   * Tagged ID of the federation rule.
   */
  federation_rule_id: string;

  type: 'federation_rule_workspace_deleted';

  /**
   * Tagged ID of the workspace named in the delete request. Removal is idempotent.
   */
  workspace_id: string;
}

export interface WorkspaceListParams extends PageCursorParams {}

export interface WorkspaceAddParams {
  /**
   * Tagged ID of the workspace to enable this rule for.
   */
  workspace_id: string;
}

export interface WorkspaceRemoveParams {
  /**
   * ID of the federation rule.
   */
  federation_rule_id: string;
}

export declare namespace Workspaces {
  export {
    type WorkspaceRemoveResponse as WorkspaceRemoveResponse,
    type WorkspaceListParams as WorkspaceListParams,
    type WorkspaceAddParams as WorkspaceAddParams,
    type WorkspaceRemoveParams as WorkspaceRemoveParams,
  };
}

export { type FederationRuleWorkspacesPageCursor };
