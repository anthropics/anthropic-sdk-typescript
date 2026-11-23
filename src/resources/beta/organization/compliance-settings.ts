import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import { APIPromise } from '../../../core/api-promise';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';

export class ComplianceSettings extends APIResource {
  /**
   * Retrieve your organization's Compliance Settings.
   *
   * Compliance Settings is a singleton resource: there is exactly one per
   * organization, addressed without an identifier. The `state` field reflects
   * whether the Compliance API is enabled. An organization with a parent
   * organization reads the state inherited from the parent's configuration.
   *
   * @example
   * ```ts
   * const betaComplianceSettings =
   *   await client.beta.organization.complianceSettings.retrieve();
   * ```
   */
  retrieve(
    params: ComplianceSettingRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaComplianceSettings> {
    const { betas } = params ?? {};
    return this._client.get('/v1/organizations/compliance_settings', {
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.compliance_settings.retrieve', options, {
        route: '/v1/organizations/compliance_settings',
      }),
    });
  }

  /**
   * Update your organization's Compliance Settings.
   *
   * Setting `state` to `enabled` turns on the Compliance API and begins capturing
   * organization activity events. Setting it to `disabled` turns both off. Access
   * Transparency events are an exception: they are still captured while the
   * Compliance API is disabled, and the Compliance API activity feed returns them
   * once it is enabled again. `state` reflects whether the Compliance API is
   * enabled.
   *
   * A request that sets `state` to its current value succeeds and leaves the
   * resource unchanged. A `disabled` request stays in effect until a later `enabled`
   * request or the organization's next provisioning action that enables Access
   * Transparency: enabling Access Transparency also enables the Compliance API,
   * which serves its activity events, so such provisioning (including re-runs)
   * re-enables the Compliance API even after a `disabled` request. Automated
   * provisioning never disables compliance settings.
   *
   * @throws {SandboxEgressRestrictedError}
   *
   * @example
   * ```ts
   * const betaComplianceSettings =
   *   await client.beta.organization.complianceSettings.update({
   *     state: { type: 'enabled' },
   *   });
   * ```
   */
  update(
    params: ComplianceSettingUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaComplianceSettings> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/compliance_settings', {
      body,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.compliance_settings.update', options, {
        route: '/v1/organizations/compliance_settings',
      }),
    });
  }
}

/**
 * Whether Access Transparency is on. Read-only.
 */
export interface BetaAccessTransparency {
  type: 'disabled' | 'enabled';
}

export interface BetaComplianceSettings {
  /**
   * Whether the Compliance API is enabled for this organization.
   */
  state: BetaComplianceSettingsState;

  type: 'compliance_settings';

  /**
   * Read-only. Whether Access Transparency is on for the organization. Returned only
   * when the request sends the `anthropic-beta: efs-2026-10-01` header and Access
   * Transparency is available to the organization; otherwise omitted. If the status
   * can't be read, getting Compliance Settings returns an error; an update still
   * saves, but then reports `disabled` whatever the real status, so get the settings
   * again to check it.
   */
  access_transparency?: BetaAccessTransparency;
}

export type BetaComplianceSettingsState =
  | BetaComplianceSettingsStateEnabled
  | BetaComplianceSettingsStateDisabled;

export interface BetaComplianceSettingsStateDisabled {
  type: 'disabled';
}

export interface BetaComplianceSettingsStateDisabledParam {
  type: 'disabled';
}

export interface BetaComplianceSettingsStateEnabled {
  type: 'enabled';
}

export interface BetaComplianceSettingsStateEnabledParam {
  type: 'enabled';
}

export type BetaComplianceSettingsStateParam =
  | BetaComplianceSettingsStateEnabledParam
  | BetaComplianceSettingsStateDisabledParam;

export interface ComplianceSettingRetrieveParams {
  /**
   * Optional. Send `efs-2026-10-01` in this header to use this endpoint's beta
   * features: additional parameters, accepted values and response fields.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ComplianceSettingUpdateParams {
  /**
   * Body param: Desired state. Accepts the string shorthand "enabled" or "disabled"
   * in place of the object form; the response always returns the canonical object
   * form.
   */
  state: BetaComplianceSettingsStateParam;

  /**
   * Header param: Optional. Send `efs-2026-10-01` in this header to use this
   * endpoint's beta features: additional parameters, accepted values and response
   * fields.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace ComplianceSettings {
  export {
    type BetaAccessTransparency as BetaAccessTransparency,
    type BetaComplianceSettings as BetaComplianceSettings,
    type BetaComplianceSettingsState as BetaComplianceSettingsState,
    type BetaComplianceSettingsStateDisabled as BetaComplianceSettingsStateDisabled,
    type BetaComplianceSettingsStateDisabledParam as BetaComplianceSettingsStateDisabledParam,
    type BetaComplianceSettingsStateEnabled as BetaComplianceSettingsStateEnabled,
    type BetaComplianceSettingsStateEnabledParam as BetaComplianceSettingsStateEnabledParam,
    type BetaComplianceSettingsStateParam as BetaComplianceSettingsStateParam,
    type ComplianceSettingRetrieveParams as ComplianceSettingRetrieveParams,
    type ComplianceSettingUpdateParams as ComplianceSettingUpdateParams,
  };
}
