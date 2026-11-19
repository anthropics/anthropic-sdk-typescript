import { APIResource } from '../../../../../core/resource';
import * as BetaAPI from '../../../beta';
import { APIPromise } from '../../../../../core/api-promise';
import { buildHeaders } from '../../../../../internal/headers';
import { RequestOptions } from '../../../../../internal/request-options';
import { startApiCallSpan } from '../../../../../internal/tracing';

export class RBACGroupDefault extends APIResource {
  /**
   * Retrieve the default Claude Code managed settings, which members who belong to
   * no RBAC Group in `rbac_group_order` receive in `rbac_groups` mode.
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
   *
   * @example
   * ```ts
   * const betaClaudeCodeRBACGroupDefaultManagedSettings =
   *   await client.beta.organization.claudeCode.managedSettings.rbacGroupDefault.retrieve();
   * ```
   */
  retrieve(
    params: RBACGroupDefaultRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaClaudeCodeRBACGroupDefaultManagedSettings> {
    const { betas } = params ?? {};
    return this._client.get('/v1/organizations/claude_code/managed_settings/rbac_group_default', {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-claude-code-managed-settings-2026-10-06'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_code.managed_settings.rbac_group_default.retrieve',
        options,
        { route: '/v1/organizations/claude_code/managed_settings/rbac_group_default' },
      ),
    });
  }

  /**
   * Set or replace the default Claude Code managed settings, or clear them with
   * `null`.
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
   * @throws {BetaRequestBodyTimeoutError}
   * @throws {BetaSettingsDocumentLimitExceededError}
   * @throws {BetaSettingsHistoryLimitExceededError}
   * @throws {SandboxEgressRestrictedError}
   *
   * @example
   * ```ts
   * const betaClaudeCodeRBACGroupDefaultManagedSettings =
   *   await client.beta.organization.claudeCode.managedSettings.rbacGroupDefault.update(
   *     { settings: { foo: 'bar' } },
   *   );
   * ```
   */
  update(
    params: RBACGroupDefaultUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaClaudeCodeRBACGroupDefaultManagedSettings> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/claude_code/managed_settings/rbac_group_default', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-claude-code-managed-settings-2026-10-06'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_code.managed_settings.rbac_group_default.update',
        options,
        { route: '/v1/organizations/claude_code/managed_settings/rbac_group_default' },
      ),
    });
  }
}

export interface BetaClaudeCodeRBACGroupDefaultManagedSettings {
  /**
   * The default settings document, or `null` if none are set or the stored document
   * is damaged and can no longer be read. To tell these apart, `updated_at` is
   * `null` only when none are set. Replacing a damaged document fixes this.
   */
  settings: { [key: string]: unknown } | null;

  /**
   * Always `claude_code_rbac_group_default_managed_settings`.
   */
  type: 'claude_code_rbac_group_default_managed_settings';

  /**
   * When the default settings last changed, in RFC 3339 format, or `null` if none
   * are set.
   */
  updated_at: string | null;
}

export interface RBACGroupDefaultRetrieveParams {
  /**
   * This endpoint is in beta: requests must send
   * `ce-claude-code-managed-settings-2026-10-06` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface RBACGroupDefaultUpdateParams {
  /**
   * Body param: The whole settings document, a JSON object of Claude Code managed
   * settings. It replaces any stored document, or `null` clears the default
   * settings. At most 1 MiB as the server stores it, which can be larger than the
   * request body.
   */
  settings: { [key: string]: unknown } | null;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-claude-code-managed-settings-2026-10-06` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace RBACGroupDefault {
  export {
    type BetaClaudeCodeRBACGroupDefaultManagedSettings as BetaClaudeCodeRBACGroupDefaultManagedSettings,
    type RBACGroupDefaultRetrieveParams as RBACGroupDefaultRetrieveParams,
    type RBACGroupDefaultUpdateParams as RBACGroupDefaultUpdateParams,
  };
}
