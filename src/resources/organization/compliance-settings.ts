import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';

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
   * const organizationComplianceSettings =
   *   await client.organization.complianceSettings.retrieve();
   * ```
   */
  retrieve(options?: RequestOptions): APIPromise<OrganizationComplianceSettings> {
    return this._client.get('/v1/organizations/compliance_settings', options);
  }

  /**
   * Update your organization's Compliance Settings.
   *
   * Setting `state` to `enabled` turns on the Compliance API and begins capturing
   * organization activity events. Setting it to `disabled` turns both off. `state`
   * reflects whether the Compliance API is enabled.
   *
   * A request that sets `state` to its current value succeeds and leaves the
   * resource unchanged. A `disabled` request stays in effect until a later `enabled`
   * request or the organization's next provisioning action that enables Access
   * Transparency: enabling Access Transparency also enables the Compliance API,
   * which serves its activity events, so such provisioning (including re-runs)
   * re-enables the Compliance API even after a `disabled` request. Automated
   * provisioning never disables compliance settings.
   *
   * @example
   * ```ts
   * const organizationComplianceSettings =
   *   await client.organization.complianceSettings.update({
   *     state: { type: 'enabled' },
   *   });
   * ```
   */
  update(
    body: ComplianceSettingUpdateParams,
    options?: RequestOptions,
  ): APIPromise<OrganizationComplianceSettings> {
    return this._client.post('/v1/organizations/compliance_settings', { body, ...options });
  }
}

export type ComplianceSettingsState = ComplianceSettingsStateEnabled | ComplianceSettingsStateDisabled;

export interface ComplianceSettingsStateDisabled {
  type: 'disabled';
}

export interface ComplianceSettingsStateDisabledParam {
  type: 'disabled';
}

export interface ComplianceSettingsStateEnabled {
  type: 'enabled';
}

export interface ComplianceSettingsStateEnabledParam {
  type: 'enabled';
}

export type ComplianceSettingsStateParam =
  | ComplianceSettingsStateEnabledParam
  | ComplianceSettingsStateDisabledParam;

export interface OrganizationComplianceSettings {
  /**
   * Whether the Compliance API is enabled for this organization.
   */
  state: ComplianceSettingsState;

  type: 'compliance_settings';
}

export interface ComplianceSettingUpdateParams {
  /**
   * Desired state. Accepts the string shorthand "enabled" or "disabled" in place of
   * the object form; the response always returns the canonical object form.
   */
  state: ComplianceSettingsStateParam;
}

export declare namespace ComplianceSettings {
  export {
    type ComplianceSettingsState as ComplianceSettingsState,
    type ComplianceSettingsStateDisabled as ComplianceSettingsStateDisabled,
    type ComplianceSettingsStateDisabledParam as ComplianceSettingsStateDisabledParam,
    type ComplianceSettingsStateEnabled as ComplianceSettingsStateEnabled,
    type ComplianceSettingsStateEnabledParam as ComplianceSettingsStateEnabledParam,
    type ComplianceSettingsStateParam as ComplianceSettingsStateParam,
    type OrganizationComplianceSettings as OrganizationComplianceSettings,
    type ComplianceSettingUpdateParams as ComplianceSettingUpdateParams,
  };
}
