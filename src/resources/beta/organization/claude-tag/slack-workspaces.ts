import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as ClaudeTagAPI from './claude-tag';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';
import { path } from '../../../../internal/utils/path';

export class SlackWorkspaces extends APIResource {
  /**
   * Get one Slack workspace and its settings. By default `settings` holds what the
   * workspace itself stores: a setting that is null there is not set on the
   * workspace and is inherited. With `include_inherited=true`, `settings` holds what
   * applies in the workspace once the organization's Slack defaults are taken into
   * account, and the request fails with 503 rather than resolve against a settings
   * level that could not be read. Either way `sources` names the settings level each
   * value comes from.
   *
   * @example
   * ```ts
   * const betaClaudeTagSlackWorkspace =
   *   await client.beta.organization.claudeTag.slackWorkspaces.retrieve(
   *     'slws_01Hq8TzW5mKc2YbX7vNd4RfJ',
   *   );
   * ```
   */
  retrieve(
    id: string,
    params: SlackWorkspaceRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaClaudeTagSlackWorkspace> {
    const { betas, ...query } = params ?? {};
    return this._client.get(path`/v1/organizations/claude_tag/slack_workspaces/${id}`, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_tag.slack_workspaces.retrieve',
        options,
        {
          route: '/v1/organizations/claude_tag/slack_workspaces/{id}',
          queryParams: ['include_inherited'],
          attributes: { 'anthropic.organization.claude_tag.slack_workspace.id': id },
        },
      ),
    });
  }

  /**
   * Change the settings a Slack workspace stores. The update is partial: a setting
   * left out is unchanged, and a setting sent as null is cleared, so the workspace
   * inherits it. If any value is refused, no setting in the request is stored.
   *
   * @example
   * ```ts
   * const betaClaudeTagSlackWorkspace =
   *   await client.beta.organization.claudeTag.slackWorkspaces.update(
   *     'slws_01Hq8TzW5mKc2YbX7vNd4RfJ',
   *     { settings: {} },
   *   );
   * ```
   */
  update(
    id: string,
    params: SlackWorkspaceUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaClaudeTagSlackWorkspace> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/claude_tag/slack_workspaces/${id}`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_tag.slack_workspaces.update',
        options,
        {
          route: '/v1/organizations/claude_tag/slack_workspaces/{id}',
          attributes: { 'anthropic.organization.claude_tag.slack_workspace.id': id },
        },
      ),
    });
  }

  /**
   * List the set-up Slack workspaces the organization owns, newest first by
   * `created_at`. Pass `slack_workspace_id` to look one workspace up by its Slack
   * identifier: `data` then holds that workspace, or is empty when it is not set up.
   * A workspace of a Slack Enterprise Grid the organization has connected returns
   * 404 until it is set up. With `include_inherited=true` each workspace's
   * `settings` holds what applies in it, and the request fails with 503 rather than
   * resolve against a settings level that could not be read. A `page` cursor resumes
   * only a request with the same `include_inherited`.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaClaudeTagSlackWorkspace of client.beta.organization.claudeTag.slackWorkspaces.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: SlackWorkspaceListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaClaudeTagSlackWorkspacesPageCursor, BetaClaudeTagSlackWorkspace> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      '/v1/organizations/claude_tag/slack_workspaces',
      PageCursor<BetaClaudeTagSlackWorkspace>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
          options?.headers,
        ]),
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.claude_tag.slack_workspaces.list',
          options,
          {
            route: '/v1/organizations/claude_tag/slack_workspaces',
            queryParams: ['include_inherited', 'limit', 'page', 'slack_workspace_id'],
          },
        ),
      },
    );
  }
}

export type BetaClaudeTagSlackWorkspacesPageCursor = PageCursor<BetaClaudeTagSlackWorkspace>;

/**
 * A Slack workspace the organization has connected, itself or through its Slack
 * Enterprise Grid, with the settings it stores or, with `include_inherited`, the
 * settings that apply in it.
 */
export interface BetaClaudeTagSlackWorkspace {
  /**
   * The workspace's identifier. Starts with `slws_`. It does not change for as long
   * as the workspace is set up. A workspace that is removed and set up again has a
   * new one, and the old one keeps returning 404; look the workspace up by its Slack
   * identifier for the new one.
   */
  id: string;

  /**
   * Time the workspace was set up, by whichever route. It does not change for as
   * long as `id` does not.
   */
  created_at: string;

  /**
   * What the workspace itself stores or, with `include_inherited`, what applies in
   * it. `sources` says which.
   */
  settings: ClaudeTagAPI.BetaClaudeTagSettings;

  /**
   * Slack's own identifier for the workspace.
   */
  slack: ClaudeTagAPI.BetaClaudeTagSlackWorkspaceIdentifiers;

  /**
   * For each setting, the settings level its value in `settings` comes from.
   */
  sources: ClaudeTagAPI.BetaClaudeTagSettingSources;

  type: 'slack_workspace';

  /**
   * Time Claude Tag's record of the workspace last changed. It moves on every change
   * to a setting, and can also move when something no response holds changes, so a
   * later value says to read the workspace again, not that a setting changed.
   * Attaching or detaching a Bundle does not by itself move it.
   */
  updated_at: string;
}

export interface SlackWorkspaceRetrieveParams {
  /**
   * Query param: When `true`, `settings` holds what applies in the workspace once
   * the organization's Slack defaults are taken into account, and every member of
   * `sources` names the level a value comes from. When `false` or left out,
   * `settings` holds what the workspace itself stores.
   */
  include_inherited?: boolean;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SlackWorkspaceUpdateParams {
  /**
   * Body param: The settings to change.
   */
  settings: ClaudeTagAPI.BetaClaudeTagSettingsUpdate;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SlackWorkspaceListParams extends PageCursorParams {
  /**
   * Query param: When `true`, `settings` holds what applies in each workspace once
   * the organization's Slack defaults are taken into account, and every member of
   * `sources` names the level a value comes from. When `false` or left out,
   * `settings` holds what each workspace itself stores.
   */
  include_inherited?: boolean;

  /**
   * Query param: Slack's identifier for one workspace, as in the workspace object's
   * `slack.workspace_id`, not its `id`. With it `data` holds that workspace alone,
   * or nothing when it is not set up.
   */
  slack_workspace_id?: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace SlackWorkspaces {
  export {
    type BetaClaudeTagSlackWorkspace as BetaClaudeTagSlackWorkspace,
    type BetaClaudeTagSlackWorkspacesPageCursor as BetaClaudeTagSlackWorkspacesPageCursor,
    type SlackWorkspaceRetrieveParams as SlackWorkspaceRetrieveParams,
    type SlackWorkspaceUpdateParams as SlackWorkspaceUpdateParams,
    type SlackWorkspaceListParams as SlackWorkspaceListParams,
  };
}
