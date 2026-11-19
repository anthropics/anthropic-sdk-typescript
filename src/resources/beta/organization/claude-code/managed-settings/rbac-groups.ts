import { APIResource } from '../../../../../core/resource';
import * as BetaAPI from '../../../beta';
import { APIPromise } from '../../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../../core/pagination';
import { buildHeaders } from '../../../../../internal/headers';
import { RequestOptions } from '../../../../../internal/request-options';
import { startApiCallSpan } from '../../../../../internal/tracing';
import { path } from '../../../../../internal/utils/path';

export class RBACGroups extends APIResource {
  /**
   * Retrieve an RBAC Group's Claude Code managed settings.
   *
   * **Accepted credentials:** an organization-level Admin API key with the
   * `read:claude_code_managed_settings` scope.
   *
   * Every request must include the beta header
   * `anthropic-beta: ce-claude-code-managed-settings-2026-10-06`. A request without
   * it, or from an organization not enabled for this beta, returns `404`. The Claude
   * Code Managed Settings API is in beta and is available to Claude Enterprise
   * organizations only.
   *
   * @throws {BetaCMEKFeatureUnsupportedError}
   * @throws {CMEKKeyDisabledError}
   * @throws {BetaRBACGroupManagedSettingsNotFoundError}
   *
   * @example
   * ```ts
   * const betaClaudeCodeRBACGroupManagedSettings =
   *   await client.beta.organization.claudeCode.managedSettings.rbacGroups.retrieve(
   *     'rbac_group_id',
   *   );
   * ```
   */
  retrieve(
    rbacGroupID: string,
    params: RBACGroupRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaClaudeCodeRBACGroupManagedSettings> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/organizations/claude_code/managed_settings/rbac_groups/${rbacGroupID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-claude-code-managed-settings-2026-10-06'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_code.managed_settings.rbac_groups.retrieve',
        options,
        {
          route: '/v1/organizations/claude_code/managed_settings/rbac_groups/{rbac_group_id}',
          attributes: { 'anthropic.organization.claude_code.managed_setting.rbac_group.id': rbacGroupID },
        },
      ),
    });
  }

  /**
   * List the RBAC Groups that have Claude Code managed settings, highest precedence
   * first.
   *
   * Each entry gives the group's status and timestamps, not its settings. The list
   * includes deleted groups that still have settings, and leaves out the default
   * settings. If the order changes between pages, the request returns `409`: list
   * again from the first page.
   *
   * **Accepted credentials:** an organization-level Admin API key with the
   * `read:claude_code_managed_settings` scope.
   *
   * Every request must include the beta header
   * `anthropic-beta: ce-claude-code-managed-settings-2026-10-06`. A request without
   * it, or from an organization not enabled for this beta, returns `404`. The Claude
   * Code Managed Settings API is in beta and is available to Claude Enterprise
   * organizations only.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaClaudeCodeRBACGroupManagedSettingsSummary of client.beta.organization.claudeCode.managedSettings.rbacGroups.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: RBACGroupListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<
    BetaClaudeCodeRBACGroupManagedSettingsSummariesPageCursor,
    BetaClaudeCodeRBACGroupManagedSettingsSummary
  > {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      '/v1/organizations/claude_code/managed_settings/rbac_groups',
      PageCursor<BetaClaudeCodeRBACGroupManagedSettingsSummary>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'ce-claude-code-managed-settings-2026-10-06'].toString() },
          options?.headers,
        ]),
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.claude_code.managed_settings.rbac_groups.list',
          options,
          {
            route: '/v1/organizations/claude_code/managed_settings/rbac_groups',
            queryParams: ['limit', 'page'],
          },
        ),
      },
    );
  }

  /**
   * Delete an RBAC Group's Claude Code managed settings and remove the group from
   * `rbac_group_order`.
   *
   * A group with no settings returns `404` with the error code
   * `rbac_group_managed_settings_not_found`. That code on a retry of a delete that
   * returned `503` means the settings are gone.
   *
   * **Accepted credentials:** an organization-level Admin API key with the
   * `write:claude_code_managed_settings` scope.
   *
   * Every request must include the beta header
   * `anthropic-beta: ce-claude-code-managed-settings-2026-10-06`. A request without
   * it, or from an organization not enabled for this beta, returns `404`. The Claude
   * Code Managed Settings API is in beta and is available to Claude Enterprise
   * organizations only.
   *
   * A write that returns `503` may have applied. Retrying it is safe.
   *
   * @throws {CMEKKeyDisabledError}
   * @throws {BetaSettingsHistoryLimitExceededError}
   * @throws {SandboxEgressRestrictedError}
   * @throws {BetaRBACGroupManagedSettingsNotFoundError}
   *
   * @example
   * ```ts
   * const betaDeletedClaudeCodeRBACGroupManagedSettings =
   *   await client.beta.organization.claudeCode.managedSettings.rbacGroups.delete(
   *     'rbac_group_id',
   *   );
   * ```
   */
  delete(
    rbacGroupID: string,
    params: RBACGroupDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaDeletedClaudeCodeRBACGroupManagedSettings> {
    const { betas } = params ?? {};
    return this._client.delete(
      path`/v1/organizations/claude_code/managed_settings/rbac_groups/${rbacGroupID}`,
      {
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'ce-claude-code-managed-settings-2026-10-06'].toString() },
          options?.headers,
        ]),
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.claude_code.managed_settings.rbac_groups.delete',
          options,
          {
            route: '/v1/organizations/claude_code/managed_settings/rbac_groups/{rbac_group_id}',
            attributes: { 'anthropic.organization.claude_code.managed_setting.rbac_group.id': rbacGroupID },
          },
        ),
      },
    );
  }

  /**
   * Create or replace an RBAC Group's Claude Code managed settings.
   *
   * New settings join the end of `rbac_group_order`, and existing settings keep
   * their place. Until the group is moved up, its members who also belong to an
   * earlier group keep that group's settings. In `organization` mode a write changes
   * no member's settings until the organization switches to `rbac_groups` mode. Once
   * a group has settings, that switch no longer copies the organization settings
   * into default settings, so members in no RBAC Group in `rbac_group_order` receive
   * no settings unless you set the default settings before the switch.
   *
   * Get the group's ID from the RBAC Groups API. One key can hold `read:rbac_groups`
   * and `write:claude_code_managed_settings`.
   *
   * **Accepted credentials:** an organization-level Admin API key with the
   * `write:claude_code_managed_settings` scope.
   *
   * Every request must include the beta header
   * `anthropic-beta: ce-claude-code-managed-settings-2026-10-06`. A request without
   * it, or from an organization not enabled for this beta, returns `404`. The Claude
   * Code Managed Settings API is in beta and is available to Claude Enterprise
   * organizations only.
   *
   * A write that returns `503` may have applied. Retrying it is safe.
   *
   * @throws {BetaCMEKFeatureUnsupportedError}
   * @throws {CMEKKeyDisabledError}
   * @throws {BetaRBACGroupOrderLimitExceededError}
   * @throws {BetaRequestBodyTimeoutError}
   * @throws {BetaSettingsDocumentLimitExceededError}
   * @throws {BetaSettingsHistoryLimitExceededError}
   * @throws {SandboxEgressRestrictedError}
   * @throws {BetaRBACGroupNotFoundError}
   *
   * @example
   * ```ts
   * const betaClaudeCodeRBACGroupManagedSettings =
   *   await client.beta.organization.claudeCode.managedSettings.rbacGroups.set(
   *     'rbac_group_id',
   *     { settings: { foo: 'bar' } },
   *   );
   * ```
   */
  set(
    rbacGroupID: string,
    params: RBACGroupSetParams,
    options?: RequestOptions,
  ): APIPromise<BetaClaudeCodeRBACGroupManagedSettings> {
    const { betas, ...body } = params;
    return this._client.post(
      path`/v1/organizations/claude_code/managed_settings/rbac_groups/${rbacGroupID}`,
      {
        body,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'ce-claude-code-managed-settings-2026-10-06'].toString() },
          options?.headers,
        ]),
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.claude_code.managed_settings.rbac_groups.set',
          options,
          {
            route: '/v1/organizations/claude_code/managed_settings/rbac_groups/{rbac_group_id}',
            attributes: { 'anthropic.organization.claude_code.managed_setting.rbac_group.id': rbacGroupID },
          },
        ),
      },
    );
  }
}

export type BetaClaudeCodeRBACGroupManagedSettingsSummariesPageCursor =
  PageCursor<BetaClaudeCodeRBACGroupManagedSettingsSummary>;

export interface BetaClaudeCodeRBACGroupManagedSettings {
  /**
   * When the settings document this group uses was first stored, in RFC 3339 format.
   * This can be earlier than when the group got its settings, and it changes if the
   * group gets a different document.
   */
  created_at: string;

  /**
   * The RBAC Group's ID, prefixed `rbac_group_`.
   */
  rbac_group_id: string;

  /**
   * Whether the group is still one of the organization's RBAC Groups. Its `type` is
   * `active` if it is, `deleted` if it is not, and `unknown` if that cannot be
   * checked right now. A deleted group's settings stay in `rbac_group_order` but
   * match no member.
   */
  rbac_group_status: BetaClaudeCodeRBACGroupStatus;

  /**
   * The group's settings document, or `null` if the stored document is damaged and
   * can no longer be read. Replacing it fixes this.
   */
  settings: { [key: string]: unknown } | null;

  /**
   * Always `claude_code_rbac_group_managed_settings`.
   */
  type: 'claude_code_rbac_group_managed_settings';

  /**
   * When this group's settings or its position in the order last changed, in RFC
   * 3339 format. Its position changes whenever the number of groups ahead of it
   * changes.
   */
  updated_at: string;
}

export interface BetaClaudeCodeRBACGroupManagedSettingsSummary {
  /**
   * When the settings document this group uses was first stored, in RFC 3339 format.
   * This can be earlier than when the group got its settings, and it changes if the
   * group gets a different document.
   */
  created_at: string;

  /**
   * The RBAC Group's ID, prefixed `rbac_group_`.
   */
  rbac_group_id: string;

  /**
   * Whether the group is still one of the organization's RBAC Groups. Its `type` is
   * `active` if it is, `deleted` if it is not, and `unknown` if that cannot be
   * checked right now. A deleted group's settings stay in `rbac_group_order` but
   * match no member.
   */
  rbac_group_status: BetaClaudeCodeRBACGroupStatus;

  /**
   * Always `claude_code_rbac_group_managed_settings_summary`.
   */
  type: 'claude_code_rbac_group_managed_settings_summary';

  /**
   * When this group's settings or its position in the order last changed, in RFC
   * 3339 format. Its position changes whenever the number of groups ahead of it
   * changes.
   */
  updated_at: string;
}

export type BetaClaudeCodeRBACGroupStatus =
  | BetaClaudeCodeRBACGroupStatusActive
  | BetaClaudeCodeRBACGroupStatusDeleted
  | BetaClaudeCodeRBACGroupStatusUnknown;

export interface BetaClaudeCodeRBACGroupStatusActive {
  /**
   * Always `active`.
   */
  type: 'active';
}

export interface BetaClaudeCodeRBACGroupStatusDeleted {
  /**
   * Always `deleted`.
   */
  type: 'deleted';
}

export interface BetaClaudeCodeRBACGroupStatusUnknown {
  /**
   * Always `unknown`.
   */
  type: 'unknown';
}

export interface BetaDeletedClaudeCodeRBACGroupManagedSettings {
  /**
   * The RBAC Group's ID, prefixed `rbac_group_`.
   */
  rbac_group_id: string;

  /**
   * Always `claude_code_rbac_group_managed_settings_deleted`.
   */
  type: 'claude_code_rbac_group_managed_settings_deleted';
}

export interface RBACGroupRetrieveParams {
  /**
   * This endpoint is in beta: requests must send
   * `ce-claude-code-managed-settings-2026-10-06` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface RBACGroupListParams extends PageCursorParams {
  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-claude-code-managed-settings-2026-10-06` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface RBACGroupDeleteParams {
  /**
   * This endpoint is in beta: requests must send
   * `ce-claude-code-managed-settings-2026-10-06` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface RBACGroupSetParams {
  /**
   * Body param: The whole settings document, a JSON object of Claude Code managed
   * settings. It replaces any stored document. At most 1 MiB as the server stores
   * it, which can be larger than the request body.
   */
  settings: { [key: string]: unknown };

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-claude-code-managed-settings-2026-10-06` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace RBACGroups {
  export {
    type BetaClaudeCodeRBACGroupManagedSettings as BetaClaudeCodeRBACGroupManagedSettings,
    type BetaClaudeCodeRBACGroupManagedSettingsSummary as BetaClaudeCodeRBACGroupManagedSettingsSummary,
    type BetaClaudeCodeRBACGroupStatus as BetaClaudeCodeRBACGroupStatus,
    type BetaClaudeCodeRBACGroupStatusActive as BetaClaudeCodeRBACGroupStatusActive,
    type BetaClaudeCodeRBACGroupStatusDeleted as BetaClaudeCodeRBACGroupStatusDeleted,
    type BetaClaudeCodeRBACGroupStatusUnknown as BetaClaudeCodeRBACGroupStatusUnknown,
    type BetaDeletedClaudeCodeRBACGroupManagedSettings as BetaDeletedClaudeCodeRBACGroupManagedSettings,
    type BetaClaudeCodeRBACGroupManagedSettingsSummariesPageCursor as BetaClaudeCodeRBACGroupManagedSettingsSummariesPageCursor,
    type RBACGroupRetrieveParams as RBACGroupRetrieveParams,
    type RBACGroupListParams as RBACGroupListParams,
    type RBACGroupDeleteParams as RBACGroupDeleteParams,
    type RBACGroupSetParams as RBACGroupSetParams,
  };
}
