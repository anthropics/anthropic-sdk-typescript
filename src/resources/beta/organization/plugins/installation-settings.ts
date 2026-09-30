import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as PluginsAPI from './plugins';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class InstallationSettings extends APIResource {
  /**
   * List an organization-owned Plugin's installation settings, which say which
   * members it is for, most recently created first.
   *
   * The list holds the Plugin's own organization-wide setting (absent while the
   * Plugin inherits its marketplace's default) and each RBAC Group's own setting. A
   * member-owned Plugin has shares instead, so this path returns 404 for one.
   *
   * **Accepted credentials:** an Admin API key with the `read:plugins` or
   * `read:org_audit` scope, or a Compliance Access Key with the
   * `read:compliance_org_data` scope.
   *
   * Every request must include the beta header
   * `anthropic-beta: ce-plugins-2026-09-01`. A request without it returns `404`,
   * exactly as if the endpoint did not exist. The Plugins API is in beta and is
   * available to Claude Enterprise organizations only. It is not available to Claude
   * Platform (Claude Console) organizations, or to organizations with HIPAA
   * readiness enabled.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaPluginInstallationSetting of client.beta.organization.plugins.installationSettings.list(
   *   'plugin_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    pluginID: string,
    params: InstallationSettingListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaPluginInstallationSettingsPageCursor, BetaPluginInstallationSetting> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/organizations/plugins/${pluginID}/installation_settings?beta=true`,
      PageCursor<BetaPluginInstallationSetting>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
          options?.headers,
        ]),
      },
    );
  }

  /**
   * Remove an organization-owned Plugin's own installation setting for the whole
   * organization or for one RBAC Group.
   *
   * Removing the `organization` target returns the Plugin to its marketplace's
   * default installation setting and leaves the groups' settings in place. Removing
   * a group's setting makes the group's members fall back to the Plugin's
   * organization-wide setting or to the settings of their other groups.
   *
   * A target that holds no setting of its own returns 404 (a Plugin that already
   * inherits its marketplace's default holds no `organization` setting), and so does
   * a member-owned Plugin.
   *
   * A removal counts as one of the Plugin's installation-setting writes: send all of
   * those writes one at a time. If several arrive for the same Plugin at the same
   * time, the server handles them one after another and can answer some of them with
   * `503` and `x-should-retry: true` instead of applying them; wait a second or two
   * and send the removal again. A `404` on the repeat means the setting is already
   * gone.
   *
   * **Accepted credentials:** an Admin API key with the `write:plugins` scope.
   *
   * Every request must include the beta header
   * `anthropic-beta: ce-plugins-2026-09-01`. A request without it returns `404`,
   * exactly as if the endpoint did not exist. The Plugins API is in beta and is
   * available to Claude Enterprise organizations only. It is not available to Claude
   * Platform (Claude Console) organizations, or to organizations with HIPAA
   * readiness enabled.
   *
   * @example
   * ```ts
   * const betaDeletedPluginInstallationSetting =
   *   await client.beta.organization.plugins.installationSettings.remove(
   *     'target',
   *     { plugin_id: 'plugin_id' },
   *   );
   * ```
   */
  remove(
    target: string,
    params: InstallationSettingRemoveParams,
    options?: RequestOptions,
  ): APIPromise<BetaDeletedPluginInstallationSetting> {
    const { plugin_id, betas } = params;
    return this._client.delete(
      path`/v1/organizations/plugins/${plugin_id}/installation_settings/${target}?beta=true`,
      {
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
          options?.headers,
        ]),
      },
    );
  }

  /**
   * Set or change an organization-owned Plugin's installation setting for the whole
   * organization or for one RBAC Group.
   *
   * Writing the value a target already holds of its own changes nothing.
   *
   * A member-owned Plugin has shares instead of installation settings, so this path
   * returns 404 for one.
   *
   * Send a Plugin's installation-setting writes one at a time. If several writes for
   * the same Plugin arrive at the same time, the server handles them one after
   * another and can answer some of them with `503` instead of applying them. That
   * `503` carries `x-should-retry: true`, and the write is safe to repeat: wait a
   * second or two, then send it again.
   *
   * **Accepted credentials:** an Admin API key with the `write:plugins` scope.
   *
   * Every request must include the beta header
   * `anthropic-beta: ce-plugins-2026-09-01`. A request without it returns `404`,
   * exactly as if the endpoint did not exist. The Plugins API is in beta and is
   * available to Claude Enterprise organizations only. It is not available to Claude
   * Platform (Claude Console) organizations, or to organizations with HIPAA
   * readiness enabled.
   *
   * @example
   * ```ts
   * const betaPluginInstallationSetting =
   *   await client.beta.organization.plugins.installationSettings.set(
   *     'target',
   *     {
   *       plugin_id: 'plugin_id',
   *       installation_preference: 'required',
   *     },
   *   );
   * ```
   */
  set(
    target: string,
    params: InstallationSettingSetParams,
    options?: RequestOptions,
  ): APIPromise<BetaPluginInstallationSetting> {
    const { plugin_id, betas, ...body } = params;
    return this._client.post(
      path`/v1/organizations/plugins/${plugin_id}/installation_settings/${target}?beta=true`,
      {
        body,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
          options?.headers,
        ]),
      },
    );
  }
}

export type BetaPluginInstallationSettingsPageCursor = PageCursor<BetaPluginInstallationSetting>;

/**
 * Confirmation that one target's installation setting was removed, naming the
 * Plugin and the target in place of an ID.
 */
export interface BetaDeletedPluginInstallationSetting {
  /**
   * The Plugin's ID.
   */
  plugin_id: string;

  /**
   * Whose setting was removed.
   */
  target:
    | PluginsAPI.BetaPluginTargetOrganization
    | PluginsAPI.BetaPluginTargetRBACGroup
    | PluginsAPI.BetaPluginTargetOrganizationMember;

  /**
   * Always `plugin_installation_setting_deleted`.
   */
  type: 'plugin_installation_setting_deleted';
}

/**
 * The installation setting an organization-owned Plugin holds for one target. It
 * has no ID of its own: it is addressed by the Plugin's ID and the target.
 */
export interface BetaPluginInstallationSetting {
  /**
   * When the target was first given a setting for this Plugin.
   */
  created_at: string;

  /**
   * The setting the target holds for this Plugin. One of `required`, `auto_install`,
   * `available`, `not_available`; a value this API does not yet name is returned as
   * stored.
   */
  installation_preference: 'auto_install' | 'available' | 'not_available' | 'required';

  /**
   * The Plugin's ID.
   */
  plugin_id: string;

  /**
   * Whose setting this is: `organization` (the Plugin's own organization-wide
   * setting) or `rbac_group` (one RBAC Group's own setting); `organization_member`
   * does not occur here.
   */
  target:
    | PluginsAPI.BetaPluginTargetOrganization
    | PluginsAPI.BetaPluginTargetRBACGroup
    | PluginsAPI.BetaPluginTargetOrganizationMember;

  /**
   * Always `plugin_installation_setting`.
   */
  type: 'plugin_installation_setting';

  /**
   * When its setting last changed.
   */
  updated_at: string;
}

export interface InstallationSettingListParams extends PageCursorParams {
  /**
   * Query param: For a `read:org_audit` or `read:compliance_org_data` key created
   * for all of a parent organization's linked organizations: a child organization of
   * that parent to read instead of the organization the key was created in, given as
   * the organization's UUID or its `org_`-prefixed ID. A value that is neither
   * returns a 400; an organization that is not a child of the key's parent, or where
   * the Plugins API is not available, returns a 404. Any other key may pass only its
   * own organization's ID here; another organization returns a 404.
   */
  organization_id?: string | null;

  /**
   * Query param: Only settings for this kind of target: `organization` (the
   * organization-wide setting) or `rbac_group` (an RBAC Group's).
   */
  target_type?: 'organization' | 'rbac_group' | null;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface InstallationSettingRemoveParams {
  /**
   * Path param: ID of the Plugin (prefixed `plugin_`).
   */
  plugin_id: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface InstallationSettingSetParams {
  /**
   * Path param: ID of the Plugin (prefixed `plugin_`).
   */
  plugin_id: string;

  /**
   * Body param: The installation setting the target is to hold for this Plugin: one
   * of `required`, `auto_install`, `available`, `not_available`.
   */
  installation_preference: 'auto_install' | 'available' | 'not_available' | 'required';

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace InstallationSettings {
  export {
    type BetaDeletedPluginInstallationSetting as BetaDeletedPluginInstallationSetting,
    type BetaPluginInstallationSetting as BetaPluginInstallationSetting,
    type BetaPluginInstallationSettingsPageCursor as BetaPluginInstallationSettingsPageCursor,
    type InstallationSettingListParams as InstallationSettingListParams,
    type InstallationSettingRemoveParams as InstallationSettingRemoveParams,
    type InstallationSettingSetParams as InstallationSettingSetParams,
  };
}
