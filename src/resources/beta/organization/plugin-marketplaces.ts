import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as PluginsAPI from './plugins/plugins';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { type Uploadable } from '../../../core/uploads';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { multipartFormRequestOptions } from '../../../internal/uploads';
import { path } from '../../../internal/utils/path';

export class PluginMarketplaces extends APIResource {
  /**
   * Retrieve a plugin marketplace by ID.
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
   * const betaPluginMarketplace =
   *   await client.beta.organization.pluginMarketplaces.retrieve(
   *     'marketplace_id',
   *   );
   * ```
   */
  retrieve(
    marketplaceID: string,
    params: PluginMarketplaceRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaPluginMarketplace> {
    const { betas, ...query } = params ?? {};
    return this._client.get(path`/v1/organizations/plugin_marketplaces/${marketplaceID}?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Set the default installation setting of one of the organization's own plugin
   * marketplaces. Every Plugin in it without a setting of its own gets this default
   * as its organization-wide setting, including Plugins added later.
   *
   * Pass it as `default_installation_preference`. A member's personal marketplace
   * cannot be updated here (403).
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
   * const betaPluginMarketplace =
   *   await client.beta.organization.pluginMarketplaces.update(
   *     'marketplace_id',
   *     { default_installation_preference: 'available' },
   *   );
   * ```
   */
  update(
    marketplaceID: string,
    params: PluginMarketplaceUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaPluginMarketplace> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/plugin_marketplaces/${marketplaceID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List the plugin marketplaces Plugins live in, newest first: the organization's
   * own and its members' personal ones.
   *
   * Plugin marketplaces are created, connected to a repository and deleted in
   * claude.ai, not through this API. The organization's library marketplace, the
   * organization-owned `manual` marketplace that uploads go to when no marketplace
   * is named, is created the first time something is put in it and is listed from
   * then on.
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
   * for await (const betaPluginMarketplace of client.beta.organization.pluginMarketplaces.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: PluginMarketplaceListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaPluginMarketplacesPageCursor, BetaPluginMarketplace> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      '/v1/organizations/plugin_marketplaces?beta=true',
      PageCursor<BetaPluginMarketplace>,
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
   * Check whether a plugin marketplace, uploaded as a `.zip` of the marketplace
   * directory, would synchronize into claude.ai, without connecting or storing it.
   *
   * To check a public GitHub repository instead, use Validate Plugin Marketplace
   * Repository.
   *
   * The report says whether `marketplace.json` is well-formed, which plugins a
   * synchronization would skip and why, and which plugins would synchronize only in
   * part, with some files left out. An archive that cannot be read as a marketplace
   * is reported, not refused: the response is a report with `valid: false`. Plugin
   * sources outside the marketplace are fetched anonymously from GitHub, so a
   * private one is reported as not found; a source on any other host is not fetched
   * here, and the report notes that it will be checked when the marketplace actually
   * synchronizes.
   *
   * Nothing is recorded on the Compliance API activity feed.
   *
   * For a worked example, see
   * [Validate marketplace content](/docs/en/manage-claude/plugins-api#validate-marketplace-content)
   * in the Plugins API guide.
   *
   * **Accepted credentials:** an Admin API key with the `read:plugins` or
   * `write:plugins` scope; `read:org_audit` and `read:compliance_org_data` do not
   * grant it.
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
   * const betaPluginMarketplaceValidationReport =
   *   await client.beta.organization.pluginMarketplaces.validateArchive(
   *     { archive: fs.createReadStream('path/to/file') },
   *   );
   * ```
   */
  validateArchive(
    params: PluginMarketplaceValidateArchiveParams,
    options?: RequestOptions,
  ): APIPromise<BetaPluginMarketplaceValidationReport> {
    const { betas, ...body } = params;
    return this._client.post(
      '/v1/organizations/plugin_marketplaces/validate_archive?beta=true',
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
   * Check whether a plugin marketplace held in a public GitHub repository would
   * synchronize into claude.ai, without connecting or storing it.
   *
   * To check a `.zip` of the marketplace directory instead, use Validate Plugin
   * Marketplace Archive.
   *
   * The report says whether `marketplace.json` is well-formed, which plugins a
   * synchronization would skip and why, and which plugins would synchronize only in
   * part, with some files left out. A repository that is missing, private, or has no
   * such branch or commit is reported, not refused: the response is a report with
   * `valid: false`. Plugin sources outside the marketplace are fetched anonymously
   * from GitHub, so a private one is reported as not found; a source on any other
   * host is not fetched here, and the report notes that it will be checked when the
   * marketplace actually synchronizes.
   *
   * Nothing is recorded on the Compliance API activity feed.
   *
   * For a worked example, see
   * [Validate marketplace content](/docs/en/manage-claude/plugins-api#validate-marketplace-content)
   * in the Plugins API guide.
   *
   * **Accepted credentials:** an Admin API key with the `read:plugins` or
   * `write:plugins` scope; `read:org_audit` and `read:compliance_org_data` do not
   * grant it.
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
   * const betaPluginMarketplaceValidationReport =
   *   await client.beta.organization.pluginMarketplaces.validateRepository(
   *     {
   *       repository_url:
   *         'https://github.com/example-org/example-marketplace',
   *     },
   *   );
   * ```
   */
  validateRepository(
    params: PluginMarketplaceValidateRepositoryParams,
    options?: RequestOptions,
  ): APIPromise<BetaPluginMarketplaceValidationReport> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/plugin_marketplaces/validate_repository?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'ce-plugins-2026-09-01'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaPluginMarketplacesPageCursor = PageCursor<BetaPluginMarketplace>;

export interface BetaPluginMarketplace {
  /**
   * The plugin marketplace's ID, prefixed `marketplace_`.
   */
  id: string;

  /**
   * RFC 3339.
   */
  created_at: string;

  /**
   * Organization plugin marketplace: the organization-wide setting every Plugin in
   * it with no setting of its own gets. Null for a member's personal plugin
   * marketplace. One of `required`, `auto_install`, `available`, `not_available`; a
   * value this API does not yet name is returned as stored.
   */
  default_installation_preference: 'auto_install' | 'available' | 'not_available' | 'required' | null;

  /**
   * RFC 3339. When the most recent synchronization attempt to finish did so,
   * whatever its outcome; for a repository plugin marketplace no synchronization has
   * run on yet, when it was created. Null for a plugin marketplace that is not
   * synchronized from a repository.
   */
  last_sync_ended_at: string | null;

  /**
   * The commit the last synchronization attempt that reached the repository read,
   * whether or not its content was then accepted (see `sync_status`); an attempt
   * that ends `failed_auth` or `failed_transient` leaves it unchanged. Null until an
   * attempt has first read the repository, and for a plugin marketplace that is not
   * synchronized from a repository.
   */
  last_sync_read_sha: string | null;

  /**
   * Fixed for the plugin marketplace's lifetime.
   */
  name: string;

  /**
   * The organization, or the member whose personal plugin marketplace it is.
   */
  owner: PluginsAPI.BetaPluginOwnerOrganization | PluginsAPI.BetaPluginOwnerUser;

  /**
   * Where the plugin marketplace's Plugins come from: `manual` when they are
   * uploaded; `github`, `gitlab` or `public_git` when they are synchronized from the
   * Git repository the owner connected, into which nothing can be uploaded;
   * `directory` is Anthropic's own catalog, which this API does not list. A value
   * this API does not yet name is returned as stored.
   */
  source: 'directory' | 'github' | 'gitlab' | 'manual' | 'public_git';

  /**
   * Outcome of the plugin marketplace's most recent synchronization: one of
   * `success`, `in_progress`, `failed_content`, `failed_transient`, `failed_auth`,
   * `failed_limits`; a value this API does not yet name is returned as stored. Null
   * until a synchronization is first attempted — so always for a `manual` plugin
   * marketplace.
   */
  sync_status:
    | 'failed_auth'
    | 'failed_content'
    | 'failed_limits'
    | 'failed_transient'
    | 'in_progress'
    | 'success'
    | null;

  /**
   * Always `plugin_marketplace`.
   */
  type: 'plugin_marketplace';
}

export interface BetaPluginMarketplaceValidationPluginError {
  /**
   * Why the plugin would be skipped by a synchronization.
   */
  error: string;

  /**
   * A stable identifier for the reason — the value to branch on.
   */
  error_code: string;

  /**
   * The plugin's name, as its entry in marketplace.json declares it.
   */
  name: string;
}

export interface BetaPluginMarketplaceValidationPluginWarning {
  /**
   * A stable identifier for the kind of warning.
   */
  error_code: string;

  /**
   * What would be left out, and why.
   */
  message: string;
}

export interface BetaPluginMarketplaceValidationPluginWarnings {
  /**
   * The plugin's name, as its entry in marketplace.json declares it.
   */
  name: string;

  /**
   * The parts of the plugin a synchronization would leave out.
   */
  warnings: Array<BetaPluginMarketplaceValidationPluginWarning>;
}

/**
 * The outcome of validating plugin marketplace content: a report, not a stored
 * object, so nothing in it can be retrieved afterwards.
 */
export interface BetaPluginMarketplaceValidationReport {
  /**
   * The full SHA of the commit that was validated: for a repository, the commit that
   * was read; for an uploaded archive, the commit recorded in the archive's comment
   * (as a Git host's download writes it; not verified), else null.
   */
  commit_sha: string | null;

  /**
   * Set when nothing could be validated: the repository or archive could not be
   * read, or marketplace.json is missing, malformed or over a limit. Null otherwise.
   */
  manifest_error: string | null;

  /**
   * A stable identifier for `manifest_error`; null when that is.
   */
  manifest_error_code: string | null;

  /**
   * One entry per plugin a synchronization would skip entirely, keyed by the
   * plugin's name in marketplace.json.
   */
  plugin_errors: Array<BetaPluginMarketplaceValidationPluginError>;

  /**
   * One entry per plugin that would synchronize with some of its contents left out,
   * keyed by the plugin's name in marketplace.json.
   */
  plugin_warnings: Array<BetaPluginMarketplaceValidationPluginWarnings>;

  /**
   * For a repository, the branch that was read by name: the one requested, or else
   * the branch a synchronization of this repository is set to read. Null when no
   * branch is named or set and the repository's default branch was read, for a
   * request by commit SHA, and for an uploaded archive.
   */
  ref: string | null;

  /**
   * How many plugins marketplace.json declares; 0 when it could not be read.
   */
  total_plugin_count: number;

  /**
   * Always `plugin_marketplace_validation_report`.
   */
  type: 'plugin_marketplace_validation_report';

  /**
   * True when marketplace.json is well-formed and no plugin would be skipped;
   * warnings never make it false.
   */
  valid: boolean;
}

export interface PluginMarketplaceRetrieveParams {
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

export interface PluginMarketplaceUpdateParams {
  /**
   * Body param: The organization-wide installation setting every Plugin in the
   * marketplace without one of its own gets: one of `required`, `auto_install`,
   * `available`, `not_available`. Once set it can be changed but not removed.
   */
  default_installation_preference: 'auto_install' | 'available' | 'not_available' | 'required';

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface PluginMarketplaceListParams extends PageCursorParams {
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
   * Query param: `organization` for the organization's plugin marketplaces, `user`
   * for members' personal plugin marketplaces.
   */
  owner_type?: 'organization' | 'user' | null;

  /**
   * Query param: Only plugin marketplaces with this `source`: `manual` for those
   * whose Plugins are uploaded; `github`, `gitlab` or `public_git` for those
   * synchronized from a Git repository. `directory` (Anthropic's catalog) is never
   * listed here.
   */
  source?: 'directory' | 'github' | 'gitlab' | 'manual' | 'public_git' | null;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface PluginMarketplaceValidateArchiveParams {
  /**
   * Body param: A .zip of the marketplace directory (its contents at the root, or
   * wrapped in one folder as a Git host's download produces), sent as a file part
   * with a filename; DEFLATE- or STORE-compressed, at most 32 MB. A part sent
   * without a filename, a second archive part, or any other form field is a 400; a
   * larger archive is a 413.
   */
  archive: Uploadable;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface PluginMarketplaceValidateRepositoryParams {
  /**
   * Body param: The `https://` URL of a public repository on github.com that holds
   * the marketplace. Any other host, a URL with credentials in it, or one that does
   * not name a repository is a 400.
   */
  repository_url: string;

  /**
   * Body param: The branch to validate the tip of, or the full 40-character SHA of
   * the commit to validate. When omitted, the branch a synchronization would read
   * (usually the repository's default branch); if that is not the default branch,
   * the report's `ref` says which branch was read. An empty string, or a value that
   * is neither a branch name nor a 40-character SHA, is a 400.
   */
  ref?: string | null;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace PluginMarketplaces {
  export {
    type BetaPluginMarketplace as BetaPluginMarketplace,
    type BetaPluginMarketplaceValidationPluginError as BetaPluginMarketplaceValidationPluginError,
    type BetaPluginMarketplaceValidationPluginWarning as BetaPluginMarketplaceValidationPluginWarning,
    type BetaPluginMarketplaceValidationPluginWarnings as BetaPluginMarketplaceValidationPluginWarnings,
    type BetaPluginMarketplaceValidationReport as BetaPluginMarketplaceValidationReport,
    type BetaPluginMarketplacesPageCursor as BetaPluginMarketplacesPageCursor,
    type PluginMarketplaceRetrieveParams as PluginMarketplaceRetrieveParams,
    type PluginMarketplaceUpdateParams as PluginMarketplaceUpdateParams,
    type PluginMarketplaceListParams as PluginMarketplaceListParams,
    type PluginMarketplaceValidateArchiveParams as PluginMarketplaceValidateArchiveParams,
    type PluginMarketplaceValidateRepositoryParams as PluginMarketplaceValidateRepositoryParams,
  };
}
