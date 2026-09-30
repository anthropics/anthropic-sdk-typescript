import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as InstallationSettingsAPI from './installation-settings';
import {
  BetaDeletedPluginInstallationSetting,
  BetaPluginInstallationSetting,
  BetaPluginInstallationSettingsPageCursor,
  InstallationSettingListParams,
  InstallationSettingRemoveParams,
  InstallationSettingSetParams,
  InstallationSettings,
} from './installation-settings';
import * as SharesAPI from './shares';
import { BetaPluginShare, BetaPluginSharesPageCursor, ShareListParams, Shares } from './shares';
import * as VersionsAPI from './versions';
import {
  BetaPluginVersion,
  BetaPluginVersionsPageCursor,
  VersionCreateParams,
  VersionDownloadParams,
  VersionListParams,
  VersionRetrieveParams,
  Versions,
} from './versions';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { type Uploadable } from '../../../../core/uploads';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { multipartFormRequestOptions } from '../../../../internal/uploads';
import { path } from '../../../../internal/utils/path';

export class Plugins extends APIResource {
  versions: VersionsAPI.Versions = new VersionsAPI.Versions(this._client);
  installationSettings: InstallationSettingsAPI.InstallationSettings =
    new InstallationSettingsAPI.InstallationSettings(this._client);
  shares: SharesAPI.Shares = new SharesAPI.Shares(this._client);

  /**
   * Create an organization-owned Plugin and its first version by uploading the
   * version's files.
   *
   * The upload is `multipart/form-data`: the version's files (`files`, each part
   * sent as `files[]`), with an optional `marketplace_id` and `release_notes`. The
   * manifest's `name` becomes the Plugin's `name`, and `display_name`, `description`
   * and `manifest_version` come from the manifest too.
   *
   * `name` may contain lowercase letters (from any alphabet), digits, and hyphens,
   * up to 64 characters. Uppercase letters, spaces, underscores, and other
   * punctuation are rejected.
   *
   * The `name` must be unique within the marketplace: a name already taken returns a
   * 409 with `error_code` `plugin_name_taken` and, when a Plugin holds it, that
   * Plugin's ID in `details.plugin_id`. A Plugin going into the organization's
   * library marketplace is also refused with a 409 when one of its skills has the
   * name of an organization skill (a skill an administrator uploaded for the whole
   * organization in claude.ai): `error_code` `skill_name_taken`, with that name in
   * `details.skill_name`; rename the skill, or remove the organization skill in
   * claude.ai. A 503 with `error_code` `registration_pending` means the Plugin and
   * its version were stored (their IDs are in `details`) but are not yet usable in
   * claude.ai: do not retry the create (the retry would return `plugin_name_taken`);
   * create a version on the stored Plugin instead, which completes it.
   *
   * For a worked example, see
   * [Create a plugin](/docs/en/manage-claude/plugins-api#create-a-plugin) in the
   * Plugins API guide.
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
   * const betaPlugin =
   *   await client.beta.organization.plugins.create({
   *     files: [fs.createReadStream('path/to/file')],
   *   });
   * ```
   */
  create(params: PluginCreateParams, options?: RequestOptions): APIPromise<BetaPlugin> {
    const { betas, ...body } = params;
    return this._client.post(
      '/v1/organizations/plugins?beta=true',
      multipartFormRequestOptions(
        {
          body,
          ...options,
          headers: buildHeaders([
            { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
            options?.headers,
          ]),
        },
        this._client,
      ),
    );
  }

  /**
   * Retrieve a Plugin by ID.
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
   * const betaPlugin =
   *   await client.beta.organization.plugins.retrieve(
   *     'plugin_id',
   *   );
   * ```
   */
  retrieve(
    pluginID: string,
    params: PluginRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaPlugin> {
    const { betas, ...query } = params ?? {};
    return this._client.get(path`/v1/organizations/plugins/${pluginID}?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Change which stored version of an organization-owned Plugin is served to
   * members, for example to roll back to an earlier one. This pins the served
   * version: later uploads are stored but no longer change what is served, and
   * pinning cannot currently be undone, here or in claude.ai.
   *
   * Pass the version as `served_version_id`: an earlier one to roll back, a later
   * one to start serving a version that was stored without being served, or the one
   * already served to pin it without changing what is served. No new version is
   * created.
   *
   * When the organization has content scanning enabled, a version whose scan is
   * still running is refused with a 409 (`error_code` `scan_pending`; retry once the
   * scan finishes) and one whose scan failed, errored or reached no verdict with a
   * 400 (`scan_failed`; a `warn` is accepted). When the Plugin is in the
   * organization's library marketplace, a version other than the one served is also
   * refused with a 409 when one of its skills has a name that an organization skill
   * (one an administrator uploaded for the whole organization in claude.ai) has
   * since taken: `error_code` `skill_name_taken`, with that name in
   * `details.skill_name`. A member-owned Plugin cannot be updated here (403).
   *
   * This endpoint does not write installation settings; they are written at
   * `/v1/organizations/plugins/{plugin_id}/installation_settings/{target}`.
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
   * const betaPlugin =
   *   await client.beta.organization.plugins.update(
   *     'plugin_id',
   *     {
   *       served_version_id:
   *         'pluginver_01KaZmQpRsTuVwXyZ2b4c6d8',
   *     },
   *   );
   * ```
   */
  update(pluginID: string, params: PluginUpdateParams, options?: RequestOptions): APIPromise<BetaPlugin> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/plugins/${pluginID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List the Plugins created under the organization, newest first: those in the
   * organization's own plugin marketplaces and those in members' personal plugin
   * marketplaces.
   *
   * Plugins in members' personal marketplaces are listed with the same detail as the
   * organization's own, and their files can be downloaded through the version
   * archive endpoint, which records each such download on the Compliance API
   * activity feed.
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
   * for await (const betaPlugin of client.beta.organization.plugins.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: PluginListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaPluginsPageCursor, BetaPlugin> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/organizations/plugins?beta=true', PageCursor<BetaPlugin>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Permanently delete a Plugin and every version it holds, exactly as when an
   * administrator deletes it in claude.ai. The Plugin may belong to the organization
   * or to a member, including a member who has since left the organization.
   *
   * An organization-owned Plugin's installation settings go with it; a member-owned
   * Plugin's shares are withdrawn and its owner no longer has it.
   *
   * To take an organization-owned Plugin out of use reversibly, set its
   * organization-wide installation setting to `not_available` instead (and remove or
   * change any group settings, which override it for their members). Only a Plugin
   * in a `manual` marketplace can be deleted here; one synchronized from a
   * repository is removed by removing it from the repository (400).
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
   * const betaDeletedPlugin =
   *   await client.beta.organization.plugins.delete(
   *     'plugin_id',
   *   );
   * ```
   */
  delete(
    pluginID: string,
    params: PluginDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaDeletedPlugin> {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/organizations/plugins/${pluginID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaPluginsPageCursor = PageCursor<BetaPlugin>;

export interface BetaDeletedPlugin {
  /**
   * The deleted Plugin's ID.
   */
  id: string;

  /**
   * Always `plugin_deleted`.
   */
  type: 'plugin_deleted';
}

export interface BetaPlugin {
  /**
   * The Plugin's ID.
   */
  id: string;

  /**
   * What the served version contains; null when not enumerated.
   */
  components: Array<BetaPluginComponent> | null;

  /**
   * The served version's content scan; null when it has not been scanned.
   */
  content_scan: BetaPluginContentScan | null;

  /**
   * RFC 3339.
   */
  created_at: string;

  /**
   * Who created the Plugin; null when no creator is recorded.
   */
  created_by: BetaPluginUserActor | BetaPluginAPIActor | null;

  /**
   * The served version's description.
   */
  description: string | null;

  /**
   * The served version's display name.
   */
  display_name: string | null;

  /**
   * The newest version.
   */
  latest_version_id: string;

  /**
   * The version string the served version's manifest declares.
   */
  manifest_version: string | null;

  /**
   * The ID of the plugin marketplace the Plugin lives in.
   */
  marketplace_id: string;

  /**
   * Lowercase identifier, unique within its plugin marketplace. Fixed for an
   * organization-owned Plugin's lifetime; a member-owned Plugin's changes when its
   * owner renames it in claude.ai, while its `id` stays the same.
   */
  name: string;

  /**
   * Organization-owned Plugin: the organization-wide installation setting every
   * member gets unless an RBAC Group they belong to holds its own — the Plugin's own
   * setting, or its plugin marketplace's default. Null for a member-owned Plugin,
   * which has shares instead. One of `required`, `auto_install`, `available`,
   * `not_available`; a value this API does not yet name is returned as stored.
   */
  organization_installation_preference: 'auto_install' | 'available' | 'not_available' | 'required' | null;

  /**
   * Organization-owned Plugin: true while it has no organization-wide setting of its
   * own and `organization_installation_preference` is its plugin marketplace's
   * default. Null for a member-owned Plugin.
   */
  organization_installation_preference_inherited: boolean | null;

  /**
   * Who owns the Plugin: the organization, or the member whose personal plugin
   * marketplace it lives in.
   */
  owner: BetaPluginOwnerOrganization | BetaPluginOwnerUser;

  /**
   * How far the served version reaches: `remote` when it declares an MCP server or a
   * CLI, `privileged` when it declares a hook, monitor, language server or settings
   * but nothing remote, `contained` otherwise; null when not classifiable.
   */
  reach: 'contained' | 'privileged' | 'remote' | null;

  /**
   * The version claude.ai serves to members.
   */
  served_version_id: string;

  /**
   * False while the served version follows each new version; true once it has been
   * pinned to one.
   */
  served_version_pinned: boolean;

  /**
   * Always `plugin`.
   */
  type: 'plugin';

  /**
   * RFC 3339. Moves on a new version and on a served-version change; a change to the
   * Plugin's installation settings or shares does not move it.
   */
  updated_at: string;
}

export interface BetaPluginAPIActor {
  /**
   * The key's ID.
   */
  api_key_id: string;

  /**
   * An Admin API key, in the same form the Compliance API activity feed uses for it.
   */
  type: 'api_actor';
}

export interface BetaPluginComponent {
  /**
   * What the component declares about itself; always null for MCP servers, hooks,
   * and CLIs.
   */
  description: string | null;

  /**
   * The component's name: a skill's, command's or agent's name, an MCP server's key
   * in the manifest, the event a hook runs on, or a CLI's executable.
   */
  name: string;

  /**
   * The kind of component.
   */
  type: 'agent' | 'cli' | 'command' | 'hook' | 'mcp_server' | 'skill';
}

export interface BetaPluginContentScan {
  /**
   * The scan's verdict; set only when `status` is `completed`.
   */
  assessment: 'fail' | 'pass' | 'unknown' | 'warn' | null;

  /**
   * The primary mechanism behind a `warn` or `fail`, such as `credential-exposure`
   * or `guardrail-tampering`; a mechanism this API does not yet name reads as
   * `other`. Null on a `pass`, whenever `assessment` is null, and when no mechanism
   * is reported for the verdict.
   */
  reason: string | null;

  /**
   * `processing` while a scan runs, `completed` when it ran to completion, `errored`
   * when it could not run or its outcome cannot be read.
   */
  status: 'completed' | 'errored' | 'processing';
}

export interface BetaPluginOwnerOrganization {
  /**
   * The Plugin lives in a plugin marketplace the organization owns.
   */
  type: 'organization';
}

export interface BetaPluginOwnerUser {
  /**
   * The Plugin lives in one member's personal plugin marketplace.
   */
  type: 'user';

  /**
   * The member's User ID.
   */
  user_id: string;
}

export interface BetaPluginTargetOrganization {
  /**
   * Every member of the organization.
   */
  type: 'organization';
}

export interface BetaPluginTargetOrganizationMember {
  /**
   * One member of the organization.
   */
  type: 'organization_member';

  /**
   * The member's User ID.
   */
  user_id: string;
}

export interface BetaPluginTargetRBACGroup {
  /**
   * The RBAC Group's ID.
   */
  rbac_group_id: string;

  /**
   * An RBAC Group.
   */
  type: 'rbac_group';
}

export interface BetaPluginUserActor {
  /**
   * The member's email address; may be null, for example when they are no longer a
   * member of the organization.
   */
  email_address: string | null;

  /**
   * A member of the organization.
   */
  type: 'user_actor';

  /**
   * The member's User ID.
   */
  user_id: string;
}

export interface PluginCreateParams {
  /**
   * Body param: The version's files: one part per file, the part's filename being
   * the file's path within the Plugin (for example `skills/review-pr/SKILL.md`), or
   * a single `.zip` or `.plugin` archive holding them all. On the wire each part is
   * named `files[]`, and a part named plain `files` is not read; with cURL,
   * `-F 'files[]=@SKILL.md;filename=skills/review-pr/SKILL.md'`. The files must
   * include the manifest, `.claude-plugin/plugin.json`.
   */
  files: Array<Uploadable>;

  /**
   * Body param: ID of the organization-owned plugin marketplace to create the Plugin
   * in (prefixed `marketplace_`). It must be a `manual` marketplace, one whose
   * Plugins are uploaded rather than synchronized from a repository. When omitted,
   * the Plugin is created in the organization's library marketplace, an
   * organization-owned `manual` marketplace created on first use.
   */
  marketplace_id?: string;

  /**
   * Body param: Release notes stored with the version and shown in its version
   * history in claude.ai; up to 5,000 characters.
   */
  release_notes?: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface PluginRetrieveParams {
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
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface PluginUpdateParams {
  /**
   * Body param: Serve this version of the Plugin (prefixed `pluginver_`) and pin the
   * served version to it; `latest` is not accepted.
   */
  served_version_id: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface PluginListParams extends PageCursorParams {
  /**
   * Query param: RFC 3339 timestamp bound; combine [gte], [gt], [lte], [lt].
   */
  'created_at[gt]'?: string | null;

  /**
   * Query param: RFC 3339 timestamp bound; combine [gte], [gt], [lte], [lt].
   */
  'created_at[gte]'?: string | null;

  /**
   * Query param: RFC 3339 timestamp bound; combine [gte], [gt], [lte], [lt].
   */
  'created_at[lt]'?: string | null;

  /**
   * Query param: RFC 3339 timestamp bound; combine [gte], [gt], [lte], [lt].
   */
  'created_at[lte]'?: string | null;

  /**
   * Query param: Only Plugins in this plugin marketplace (prefixed `marketplace_`).
   */
  marketplace_id?: string | null;

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
   * Query param: `organization` for Plugins in the organization's plugin
   * marketplaces, `user` for Plugins in members' personal plugin marketplaces.
   */
  owner_type?: 'organization' | 'user' | null;

  /**
   * Query param: Only Plugins in this member's personal plugin marketplaces
   * (prefixed `user_`); a removed member's ID is accepted.
   */
  owner_user_id?: string | null;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface PluginDeleteParams {
  /**
   * This endpoint is in beta: requests must send `ce-plugins-2026-09-01` in this
   * header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

Plugins.Versions = Versions;
Plugins.InstallationSettings = InstallationSettings;
Plugins.Shares = Shares;

export declare namespace Plugins {
  export {
    type BetaDeletedPlugin as BetaDeletedPlugin,
    type BetaPlugin as BetaPlugin,
    type BetaPluginAPIActor as BetaPluginAPIActor,
    type BetaPluginComponent as BetaPluginComponent,
    type BetaPluginContentScan as BetaPluginContentScan,
    type BetaPluginOwnerOrganization as BetaPluginOwnerOrganization,
    type BetaPluginOwnerUser as BetaPluginOwnerUser,
    type BetaPluginTargetOrganization as BetaPluginTargetOrganization,
    type BetaPluginTargetOrganizationMember as BetaPluginTargetOrganizationMember,
    type BetaPluginTargetRBACGroup as BetaPluginTargetRBACGroup,
    type BetaPluginUserActor as BetaPluginUserActor,
    type BetaPluginsPageCursor as BetaPluginsPageCursor,
    type PluginCreateParams as PluginCreateParams,
    type PluginRetrieveParams as PluginRetrieveParams,
    type PluginUpdateParams as PluginUpdateParams,
    type PluginListParams as PluginListParams,
    type PluginDeleteParams as PluginDeleteParams,
  };

  export {
    Versions as Versions,
    type BetaPluginVersion as BetaPluginVersion,
    type BetaPluginVersionsPageCursor as BetaPluginVersionsPageCursor,
    type VersionCreateParams as VersionCreateParams,
    type VersionRetrieveParams as VersionRetrieveParams,
    type VersionListParams as VersionListParams,
    type VersionDownloadParams as VersionDownloadParams,
  };

  export {
    InstallationSettings as InstallationSettings,
    type BetaDeletedPluginInstallationSetting as BetaDeletedPluginInstallationSetting,
    type BetaPluginInstallationSetting as BetaPluginInstallationSetting,
    type BetaPluginInstallationSettingsPageCursor as BetaPluginInstallationSettingsPageCursor,
    type InstallationSettingListParams as InstallationSettingListParams,
    type InstallationSettingRemoveParams as InstallationSettingRemoveParams,
    type InstallationSettingSetParams as InstallationSettingSetParams,
  };

  export {
    Shares as Shares,
    type BetaPluginShare as BetaPluginShare,
    type BetaPluginSharesPageCursor as BetaPluginSharesPageCursor,
    type ShareListParams as ShareListParams,
  };
}
