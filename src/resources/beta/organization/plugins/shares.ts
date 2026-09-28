import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as PluginsAPI from './plugins';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class Shares extends APIResource {
  /**
   * List the shares the owner of a member-owned Plugin has given — to every member
   * of the organization, to an RBAC Group, or to one member — most recently granted
   * first.
   *
   * Shares are read-only in this API: members give and withdraw them in claude.ai,
   * and who gave a share is recorded on the Compliance API activity feed rather than
   * on the share. An organization-owned Plugin has installation settings instead, so
   * this path returns 404 for one.
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
   * for await (const betaPluginShare of client.beta.organization.plugins.shares.list(
   *   'plugin_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    pluginID: string,
    params: ShareListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaPluginSharesPageCursor, BetaPluginShare> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/organizations/plugins/${pluginID}/shares?beta=true`,
      PageCursor<BetaPluginShare>,
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
}

export type BetaPluginSharesPageCursor = PageCursor<BetaPluginShare>;

/**
 * One share the owner of a member-owned Plugin has given. Shares are read-only in
 * this API and have no ID of their own; who gave a share is recorded on the
 * Compliance API activity feed, not here.
 */
export interface BetaPluginShare {
  /**
   * When the share was given; a share whose role is later changed in claude.ai is
   * re-granted and carries the time of that change.
   */
  granted_at: string;

  /**
   * The Plugin's ID.
   */
  plugin_id: string;

  /**
   * Who the Plugin is shared with: `organization` (every member), `rbac_group` (one
   * RBAC Group), or `organization_member` (one member).
   */
  target:
    | PluginsAPI.BetaPluginTargetOrganization
    | PluginsAPI.BetaPluginTargetRBACGroup
    | PluginsAPI.BetaPluginTargetOrganizationMember;

  /**
   * Always `plugin_share`.
   */
  type: 'plugin_share';
}

export interface ShareListParams extends PageCursorParams {
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
   * Query param: Only shares with this kind of target: `organization` (every
   * member), `rbac_group` (one RBAC Group), or `organization_member` (one member).
   */
  target_type?: 'organization' | 'organization_member' | 'rbac_group' | null;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `ce-plugins-2026-09-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Shares {
  export {
    type BetaPluginShare as BetaPluginShare,
    type BetaPluginSharesPageCursor as BetaPluginSharesPageCursor,
    type ShareListParams as ShareListParams,
  };
}
