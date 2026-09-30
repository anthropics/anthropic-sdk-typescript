import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as PluginsAPI from './plugins';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { type Uploadable } from '../../../../core/uploads';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { multipartFormRequestOptions } from '../../../../internal/uploads';
import { path } from '../../../../internal/utils/path';

export class Versions extends APIResource {
  /**
   * Add a version to an organization-owned Plugin by uploading the new version's
   * files; it becomes the version served to members unless the Plugin's served
   * version has been pinned.
   *
   * The upload is the same `multipart/form-data` as creating a Plugin: the version's
   * files (`files`, each part sent as `files[]`) and optional `release_notes`. The
   * uploaded manifest's `name` must equal the Plugin's `name`. Returns the stored
   * version; read the Plugin back to see which version it serves.
   *
   * Only a Plugin in a `manual` marketplace takes uploads; a Plugin synchronized
   * from a repository gets its versions from the repository. When the Plugin is in
   * the organization's library marketplace, a version that adds a skill with the
   * name of an organization skill (a skill an administrator uploaded for the whole
   * organization in claude.ai) is refused with a 409: `error_code`
   * `skill_name_taken`, with that name in `details.skill_name`. A 503 with
   * `error_code` `registration_pending` means the version was stored but is not yet
   * usable; a later version create on the Plugin completes it.
   *
   * For a worked example, see
   * [Create a version](/docs/en/manage-claude/plugins-api#create-a-version) in the
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
   * const betaPluginVersion =
   *   await client.beta.organization.plugins.versions.create(
   *     'plugin_id',
   *     { files: [fs.createReadStream('path/to/file')] },
   *   );
   * ```
   */
  create(
    pluginID: string,
    params: VersionCreateParams,
    options?: RequestOptions,
  ): APIPromise<BetaPluginVersion> {
    const { betas, ...body } = params;
    return this._client.post(
      path`/v1/organizations/plugins/${pluginID}/versions?beta=true`,
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
   * Retrieve one version of a Plugin by its ID, or the Plugin's newest version.
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
   * const betaPluginVersion =
   *   await client.beta.organization.plugins.versions.retrieve(
   *     'version',
   *     { plugin_id: 'plugin_id' },
   *   );
   * ```
   */
  retrieve(
    version: string,
    params: VersionRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<BetaPluginVersion> {
    const { plugin_id, betas, ...query } = params;
    return this._client.get(path`/v1/organizations/plugins/${plugin_id}/versions/${version}?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List a Plugin's versions, newest first.
   *
   * The first item of the first page is the version the Plugin's `latest_version_id`
   * refers to.
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
   * for await (const betaPluginVersion of client.beta.organization.plugins.versions.list(
   *   'plugin_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    pluginID: string,
    params: VersionListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaPluginVersionsPageCursor, BetaPluginVersion> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/organizations/plugins/${pluginID}/versions?beta=true`,
      PageCursor<BetaPluginVersion>,
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
   * Download one version's `.zip` archive, exactly as stored. Each download of a
   * Plugin from a member's personal plugin marketplace is recorded on the Compliance
   * API activity feed.
   *
   * The response body is the archive (`Content-Type: application/zip`), sent as an
   * attachment whose filename is derived from the Plugin's name; name saved files
   * from the IDs in the request path, since that filename is not unique.
   *
   * **Accepted credentials:** an Admin API key with the `read:plugins` or
   * `read:org_audit` scope, or a Compliance Access Key with the
   * `read:compliance_org_data` scope.
   *
   * Every read scope above (`read:plugins`, `read:org_audit`, and
   * `read:compliance_org_data`) can download the files of plugins in members'
   * personal marketplaces, including files that claude.ai's admin settings do not
   * show, and a `read:org_audit` or `read:compliance_org_data` key created for all
   * of your parent organization's linked organizations can do this in any
   * organization under it that has access to this API, by passing `organization_id`.
   * Each such download records a `claude_plugin_archive_accessed` event on the
   * Compliance API activity feed, identifying the key, the plugin, the version, and
   * the member. Downloads of organization-owned plugins are not recorded.
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
   * const response =
   *   await client.beta.organization.plugins.versions.download(
   *     'version',
   *     { plugin_id: 'plugin_id' },
   *   );
   *
   * const content = await response.blob();
   * console.log(content);
   * ```
   */
  download(version: string, params: VersionDownloadParams, options?: RequestOptions): APIPromise<Response> {
    const { plugin_id, betas, ...query } = params;
    return this._client.get(
      path`/v1/organizations/plugins/${plugin_id}/versions/${version}/content?beta=true`,
      {
        query,
        ...options,
        headers: buildHeaders([
          {
            'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString(),
            Accept: 'application/binary',
          },
          options?.headers,
        ]),
        __binaryResponse: true,
      },
    );
  }
}

export type BetaPluginVersionsPageCursor = PageCursor<BetaPluginVersion>;

export interface BetaPluginVersion {
  /**
   * The version's ID.
   */
  id: string;

  /**
   * What the version contains; null when not enumerated.
   */
  components: Array<PluginsAPI.BetaPluginComponent> | null;

  /**
   * This version's content scan; null when it has not been scanned.
   */
  content_scan: PluginsAPI.BetaPluginContentScan | null;

  /**
   * RFC 3339.
   */
  created_at: string;

  /**
   * Who uploaded this version; null when not recorded.
   */
  created_by: PluginsAPI.BetaPluginUserActor | PluginsAPI.BetaPluginAPIActor | null;

  /**
   * The manifest's description; null when it declares none.
   */
  description: string | null;

  /**
   * The manifest's display name; null when it declares none.
   */
  display_name: string | null;

  /**
   * The version string the manifest declares; null when it declares none.
   */
  manifest_version: string | null;

  /**
   * The Plugin's ID.
   */
  plugin_id: string;

  /**
   * How far the version reaches: `remote`, `privileged` or `contained`, as on the
   * Plugin; null when not classifiable.
   */
  reach: 'contained' | 'privileged' | 'remote' | null;

  /**
   * As supplied with the upload; null when none were supplied.
   */
  release_notes: string | null;

  /**
   * Always `plugin_version`.
   */
  type: 'plugin_version';
}

export interface VersionCreateParams {
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

export interface VersionRetrieveParams {
  /**
   * Path param: ID of the Plugin (prefixed `plugin_`).
   */
  plugin_id: string;

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

export interface VersionListParams extends PageCursorParams {
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

export interface VersionDownloadParams {
  /**
   * Path param: ID of the Plugin (prefixed `plugin_`).
   */
  plugin_id: string;

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

export declare namespace Versions {
  export {
    type BetaPluginVersion as BetaPluginVersion,
    type BetaPluginVersionsPageCursor as BetaPluginVersionsPageCursor,
    type VersionCreateParams as VersionCreateParams,
    type VersionRetrieveParams as VersionRetrieveParams,
    type VersionListParams as VersionListParams,
    type VersionDownloadParams as VersionDownloadParams,
  };
}
