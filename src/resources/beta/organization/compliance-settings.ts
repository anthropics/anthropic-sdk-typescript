// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import { APIPromise } from '../../../core/api-promise';
import { RequestOptions } from '../../../internal/request-options';

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
  retrieve(options?: RequestOptions): APIPromise<BetaComplianceSettings> {
    return this._client.get('/v1/organizations/compliance_settings?beta=true', options);
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
   * const betaComplianceSettings =
   *   await client.beta.organization.complianceSettings.update({
   *     state: { type: 'enabled' },
   *   });
   * ```
   */
  update(body: ComplianceSettingUpdateParams, options?: RequestOptions): APIPromise<BetaComplianceSettings> {
    return this._client.post('/v1/organizations/compliance_settings?beta=true', { body, ...options });
  }
}

export interface BetaComplianceSettings {
  /**
   * Whether the Compliance API is enabled for this organization.
   */
  state: BetaComplianceSettingsStateEnabled | BetaComplianceSettingsStateDisabled;

  type: 'compliance_settings';
}

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

export interface ComplianceSettingUpdateParams {
  /**
   * Desired state. Accepts the string shorthand "enabled" or "disabled" in place of
   * the object form; the response always returns the canonical object form.
   */
  state: BetaComplianceSettingsStateEnabledParam | BetaComplianceSettingsStateDisabledParam;
}

export declare namespace ComplianceSettings {
  export {
    type BetaComplianceSettings as BetaComplianceSettings,
    type BetaComplianceSettingsStateDisabled as BetaComplianceSettingsStateDisabled,
    type BetaComplianceSettingsStateDisabledParam as BetaComplianceSettingsStateDisabledParam,
    type BetaComplianceSettingsStateEnabled as BetaComplianceSettingsStateEnabled,
    type BetaComplianceSettingsStateEnabledParam as BetaComplianceSettingsStateEnabledParam,
    type ComplianceSettingUpdateParams as ComplianceSettingUpdateParams,
  };
}
