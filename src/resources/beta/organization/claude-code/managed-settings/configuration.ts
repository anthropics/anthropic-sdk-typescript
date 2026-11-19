import { APIResource } from '../../../../../core/resource';
import * as BetaAPI from '../../../beta';
import { APIPromise } from '../../../../../core/api-promise';
import { buildHeaders } from '../../../../../internal/headers';
import { RequestOptions } from '../../../../../internal/request-options';
import { startApiCallSpan } from '../../../../../internal/tracing';

export class Configuration extends APIResource {
  /**
   * Retrieve the organization's Claude Code managed settings mode and RBAC Group
   * order.
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
   * const betaClaudeCodeManagedSettingsConfiguration =
   *   await client.beta.organization.claudeCode.managedSettings.configuration.retrieve();
   * ```
   */
  retrieve(
    params: ConfigurationRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaClaudeCodeManagedSettingsConfiguration> {
    const { betas } = params ?? {};
    return this._client.get('/v1/organizations/claude_code/managed_settings/configuration', {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-claude-code-managed-settings-2026-10-06'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_code.managed_settings.configuration.retrieve',
        options,
        { route: '/v1/organizations/claude_code/managed_settings/configuration' },
      ),
    });
  }

  /**
   * Change the organization's Claude Code managed settings mode, the RBAC Group
   * order, or both, in one atomic write.
   *
   * To change the order, send `rbac_group_order` with the `rbac_group_order_version`
   * from the read the change is based on. If the order has changed since that read,
   * the request returns `409`: read it again and retry. To switch modes only if the
   * order has not changed, send the current `rbac_group_order` and
   * `rbac_group_order_version` with the new `mode`.
   *
   * A switch to `rbac_groups` mode with no RBAC Group settings and no default
   * settings copies the organization settings into a new default, in the same write,
   * so members keep the settings they had. The copy does not follow later changes to
   * the organization settings. If the organization settings cannot be copied, the
   * request returns `400` and changes nothing. If they cannot be read, are over 1
   * MiB or are not valid, setting the default settings first avoids the copy.
   *
   * After a switch to `rbac_groups` mode, a member in no listed RBAC Group receives
   * the default settings, or no settings if no default is set, not the organization
   * settings.
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
   * @throws {BetaRequestBodyTimeoutError}
   * @throws {BetaSettingsDocumentLimitExceededError}
   * @throws {BetaSettingsHistoryLimitExceededError}
   * @throws {SandboxEgressRestrictedError}
   *
   * @example
   * ```ts
   * const betaClaudeCodeManagedSettingsConfiguration =
   *   await client.beta.organization.claudeCode.managedSettings.configuration.update(
   *     {},
   *   );
   * ```
   */
  update(
    params: ConfigurationUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaClaudeCodeManagedSettingsConfiguration> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/claude_code/managed_settings/configuration', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-claude-code-managed-settings-2026-10-06'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_code.managed_settings.configuration.update',
        options,
        { route: '/v1/organizations/claude_code/managed_settings/configuration' },
      ),
    });
  }
}

export interface BetaClaudeCodeManagedSettingsConfiguration {
  /**
   * How the organization serves managed settings. In `organization` mode every
   * member receives the organization settings, which are set in claude.ai. In
   * `rbac_groups` mode each member receives the settings of the first RBAC Group in
   * `rbac_group_order` that they belong to. A member in none of them receives the
   * default settings, or no settings if no default is set.
   */
  mode: BetaClaudeCodeManagedSettingsMode;

  /**
   * When the mode last changed, in RFC 3339 format, or `null` if it never has.
   */
  mode_updated_at: string | null;

  /**
   * The ID of every RBAC Group with settings, deleted groups included, highest
   * precedence first.
   */
  rbac_group_order: Array<string>;

  /**
   * An opaque version of `rbac_group_order`, which changes whenever the order does.
   * Send it back with a new order.
   */
  rbac_group_order_version: string;

  /**
   * Always `claude_code_managed_settings_configuration`.
   */
  type: 'claude_code_managed_settings_configuration';
}

export type BetaClaudeCodeManagedSettingsMode =
  | BetaClaudeCodeManagedSettingsOrganizationMode
  | BetaClaudeCodeManagedSettingsRBACGroupsMode;

export type BetaClaudeCodeManagedSettingsModeParam =
  | BetaClaudeCodeManagedSettingsOrganizationModeParam
  | BetaClaudeCodeManagedSettingsRBACGroupsModeParam;

export interface BetaClaudeCodeManagedSettingsOrganizationMode {
  /**
   * Always `organization`.
   */
  type: 'organization';
}

export interface BetaClaudeCodeManagedSettingsOrganizationModeParam {
  type: 'organization';
}

export interface BetaClaudeCodeManagedSettingsRBACGroupsMode {
  /**
   * Always `rbac_groups`.
   */
  type: 'rbac_groups';
}

export interface BetaClaudeCodeManagedSettingsRBACGroupsModeParam {
  type: 'rbac_groups';
}

export interface ConfigurationRetrieveParams {
  /**
   * This endpoint is in beta: requests must send
   * `ce-claude-code-managed-settings-2026-10-06` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ConfigurationUpdateParams {
  /**
   * Body param: The new mode, as an object such as `{"type": "rbac_groups"}`.
   */
  mode?: BetaClaudeCodeManagedSettingsModeParam;

  /**
   * Body param: Every RBAC Group that has settings, each listed once, in the new
   * order, highest precedence first. Requires `rbac_group_order_version`.
   */
  rbac_group_order?: Array<string>;

  /**
   * Body param: The `rbac_group_order_version` from the read this change is based
   * on. Requires `rbac_group_order`.
   */
  rbac_group_order_version?: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-claude-code-managed-settings-2026-10-06` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Configuration {
  export {
    type BetaClaudeCodeManagedSettingsConfiguration as BetaClaudeCodeManagedSettingsConfiguration,
    type BetaClaudeCodeManagedSettingsMode as BetaClaudeCodeManagedSettingsMode,
    type BetaClaudeCodeManagedSettingsModeParam as BetaClaudeCodeManagedSettingsModeParam,
    type BetaClaudeCodeManagedSettingsOrganizationMode as BetaClaudeCodeManagedSettingsOrganizationMode,
    type BetaClaudeCodeManagedSettingsOrganizationModeParam as BetaClaudeCodeManagedSettingsOrganizationModeParam,
    type BetaClaudeCodeManagedSettingsRBACGroupsMode as BetaClaudeCodeManagedSettingsRBACGroupsMode,
    type BetaClaudeCodeManagedSettingsRBACGroupsModeParam as BetaClaudeCodeManagedSettingsRBACGroupsModeParam,
    type ConfigurationRetrieveParams as ConfigurationRetrieveParams,
    type ConfigurationUpdateParams as ConfigurationUpdateParams,
  };
}
