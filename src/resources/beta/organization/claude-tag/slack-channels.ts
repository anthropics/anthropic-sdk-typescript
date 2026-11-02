import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as ClaudeTagAPI from './claude-tag';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';
import { path } from '../../../../internal/utils/path';

export class SlackChannels extends APIResource {
  /**
   * Set a Slack channel up for Claude Tag and return it with its identifier. If the
   * channel is already set up, whether in claude.ai, by Claude's first use in it or
   * by an earlier request, the existing channel is returned, so the request can be
   * repeated. `settings`, when sent, is applied as an update applies it. Before a
   * channel is set up, Claude's Slack app confirms with Slack that the channel is in
   * the workspace, is not archived and is visible to the app; a channel that fails
   * the confirmation returns 404. Setting the channel up and applying `settings` are
   * two steps: when the second is refused, the response is the refusal, the channel
   * stays set up with every setting unset, and the error's
   * `details.slack_channel_id` holds the channel's identifier.
   *
   * @example
   * ```ts
   * const betaClaudeTagSlackChannel =
   *   await client.beta.organization.claudeTag.slackChannels.create(
   *     { slack: { channel_id: 'xx', workspace_id: 'xx' } },
   *   );
   * ```
   */
  create(params: SlackChannelCreateParams, options?: RequestOptions): APIPromise<BetaClaudeTagSlackChannel> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/claude_tag/slack_channels', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_tag.slack_channels.create',
        options,
        {
          route: '/v1/organizations/claude_tag/slack_channels',
          createdIDAttribute: 'anthropic.organization.claude_tag.slack_channel.id',
        },
      ),
    });
  }

  /**
   * Get one Slack channel and its settings. By default `settings` holds what the
   * channel itself stores: a setting that is null there is not set on the channel
   * and is inherited. With `include_inherited=true`, `settings` holds what applies
   * in the channel once the settings levels above it are taken into account, and the
   * request fails with 503 rather than resolve against a settings level that could
   * not be read. Either way `sources` names the settings level each value comes
   * from, so a caller tells the channel's own value from an inherited one by its
   * source, not by whether it is null.
   *
   * @example
   * ```ts
   * const betaClaudeTagSlackChannel =
   *   await client.beta.organization.claudeTag.slackChannels.retrieve(
   *     'slch_01SvpyRQK3nN6eH9uhRA7n1q',
   *   );
   * ```
   */
  retrieve(
    id: string,
    params: SlackChannelRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaClaudeTagSlackChannel> {
    const { betas, ...query } = params ?? {};
    return this._client.get(path`/v1/organizations/claude_tag/slack_channels/${id}`, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_tag.slack_channels.retrieve',
        options,
        {
          route: '/v1/organizations/claude_tag/slack_channels/{id}',
          queryParams: ['include_inherited'],
          attributes: { 'anthropic.organization.claude_tag.slack_channel.id': id },
        },
      ),
    });
  }

  /**
   * Change the settings a Slack channel stores. The update is partial: a setting
   * left out is unchanged, and a setting sent as null is cleared, so the channel
   * inherits it. If any value is refused, no setting in the request is stored. A
   * group direct message takes no settings and returns 400.
   *
   * @example
   * ```ts
   * const betaClaudeTagSlackChannel =
   *   await client.beta.organization.claudeTag.slackChannels.update(
   *     'slch_01SvpyRQK3nN6eH9uhRA7n1q',
   *     { settings: {} },
   *   );
   * ```
   */
  update(
    id: string,
    params: SlackChannelUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaClaudeTagSlackChannel> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/claude_tag/slack_channels/${id}`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_tag.slack_channels.update',
        options,
        {
          route: '/v1/organizations/claude_tag/slack_channels/{id}',
          attributes: { 'anthropic.organization.claude_tag.slack_channel.id': id },
        },
      ),
    });
  }

  /**
   * List the set-up Slack channels of one Slack workspace, newest first by
   * `created_at`. A channel that is not set up is not listed: Slack holds the full
   * list of a workspace's channels. Pass `slack_channel_id` as well to look one
   * channel up by its Slack identifiers: `data` then holds that channel, or is empty
   * when it is not set up, and `limit` and `page` are ignored. A workspace that the
   * organization owns only through a Slack Enterprise Grid returns 404 until it is
   * set up. With `include_inherited=true` each channel's `settings` holds what
   * applies in it, and the request fails with 503 rather than resolve against a
   * settings level that could not be read. A `page` cursor resumes only a request
   * with the same `include_inherited`.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaClaudeTagSlackChannel of client.beta.organization.claudeTag.slackChannels.list(
   *   { slack_workspace_id: 'slack_workspace_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: SlackChannelListParams,
    options?: RequestOptions,
  ): PagePromise<BetaClaudeTagSlackChannelsPageCursor, BetaClaudeTagSlackChannel> {
    const { betas, ...query } = params;
    return this._client.getAPIList(
      '/v1/organizations/claude_tag/slack_channels',
      PageCursor<BetaClaudeTagSlackChannel>,
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
          'anthropic.organization.claude_tag.slack_channels.list',
          options,
          {
            route: '/v1/organizations/claude_tag/slack_channels',
            queryParams: ['include_inherited', 'limit', 'page', 'slack_channel_id', 'slack_workspace_id'],
          },
        ),
      },
    );
  }

  /**
   * Remove a Slack channel from Claude Tag. This deletes the channel's stored
   * settings and its Bundle Targets at once, and then, in the background, the
   * channel's sessions and their transcripts, its memory, its routines and the
   * artifacts published from it. None of it can be restored. The channel in Slack
   * and its messages are unchanged. The request is refused with 400 and
   * `error.details.error_code` `slack_channel_enabled` while `enabled` resolves to
   * `true` for the channel, as a read with `include_inherited=true` returns it: set
   * `enabled` to `false` on the channel first. This guards against removing a
   * channel in use by mistake; it is not a way to keep Claude out, because the
   * removal deletes the channel's own `enabled: false` with its other settings,
   * after which the channel inherits again and Claude's next use of it can set it up
   * anew with a new identifier. The identifier returns 404 as soon as the request
   * returns, so a repeated removal returns 404. A group direct message returns 400,
   * and so does a channel that holds configuration this API does not manage.
   *
   * @example
   * ```ts
   * const betaClaudeTagDeletedSlackChannel =
   *   await client.beta.organization.claudeTag.slackChannels.delete(
   *     'slch_01SvpyRQK3nN6eH9uhRA7n1q',
   *   );
   * ```
   */
  delete(
    id: string,
    params: SlackChannelDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaClaudeTagDeletedSlackChannel> {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/organizations/claude_tag/slack_channels/${id}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_tag.slack_channels.delete',
        options,
        {
          route: '/v1/organizations/claude_tag/slack_channels/{id}',
          attributes: { 'anthropic.organization.claude_tag.slack_channel.id': id },
        },
      ),
    });
  }
}

export type BetaClaudeTagSlackChannelsPageCursor = PageCursor<BetaClaudeTagSlackChannel>;

/**
 * Confirms that a Slack channel was removed from Claude Tag.
 */
export interface BetaClaudeTagDeletedSlackChannel {
  /**
   * The removed channel's identifier.
   */
  id: string;

  type: 'slack_channel_deleted';
}

/**
 * A Slack channel set up for Claude Tag, with the settings it stores or, with
 * `include_inherited`, the settings that apply in it.
 */
export interface BetaClaudeTagSlackChannel {
  /**
   * The channel's identifier. Starts with `slch_`. It does not change for as long as
   * the channel is set up, with one exception: a channel that is not configured gets
   * a new one when claude.ai replaces its record, which happens only while the
   * organization's read-only mode is off. A channel that is removed and set up again
   * also has a new one. The old one keeps returning 404; look the channel up by its
   * Slack identifiers for the new one.
   */
  id: string;

  /**
   * Time the channel was set up, by whichever route. It does not change for as long
   * as `id` does not.
   */
  created_at: string;

  /**
   * What the channel itself stores or, with `include_inherited`, what applies in it.
   * `sources` says which.
   */
  settings: ClaudeTagAPI.BetaClaudeTagSettings;

  /**
   * Slack's own identifiers for the channel.
   */
  slack: ClaudeTagAPI.BetaClaudeTagSlackChannelIdentifiers;

  /**
   * For each setting, the settings level its value in `settings` comes from.
   */
  sources: ClaudeTagAPI.BetaClaudeTagSettingSources;

  type: 'slack_channel';

  /**
   * Time Claude Tag's record of the channel last changed. It moves on every change
   * to a setting, and can also move when something no response holds changes, so a
   * later value says to read the channel again, not that a setting changed.
   * Attaching or detaching a Bundle does not by itself move it.
   */
  updated_at: string;
}

export interface SlackChannelCreateParams {
  /**
   * Body param: Slack's own identifiers for the channel to set up. The organization
   * must own the workspace.
   */
  slack: ClaudeTagAPI.BetaClaudeTagSlackChannelIdentifiers;

  /**
   * Body param: Settings to store on the channel, applied as Update Slack Channel
   * applies them.
   */
  settings?: ClaudeTagAPI.BetaClaudeTagSettingsCreate;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SlackChannelRetrieveParams {
  /**
   * Query param: When `true`, `settings` holds what applies in the channel once the
   * settings levels above it are taken into account, and every member of `sources`
   * names the level a value comes from. When `false` or left out, `settings` holds
   * what the channel itself stores.
   */
  include_inherited?: boolean;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SlackChannelUpdateParams {
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

export interface SlackChannelListParams extends PageCursorParams {
  /**
   * Query param: The Slack workspace whose channels to list: Slack's identifier for
   * it, as in the channel object's `slack.workspace_id`, not the workspace object's
   * `id`.
   */
  slack_workspace_id: string;

  /**
   * Query param: When `true`, `settings` holds what applies in each channel once the
   * settings levels above it are taken into account, and every member of `sources`
   * names the level a value comes from. When `false` or left out, `settings` holds
   * what each channel itself stores.
   */
  include_inherited?: boolean;

  /**
   * Query param: Slack's identifier for one channel of that workspace, as in the
   * channel object's `slack.channel_id`. It is not the channel object's `id`. With
   * it `data` holds that channel alone, or nothing when the channel is not set up.
   */
  slack_channel_id?: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SlackChannelDeleteParams {
  /**
   * This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace SlackChannels {
  export {
    type BetaClaudeTagDeletedSlackChannel as BetaClaudeTagDeletedSlackChannel,
    type BetaClaudeTagSlackChannel as BetaClaudeTagSlackChannel,
    type BetaClaudeTagSlackChannelsPageCursor as BetaClaudeTagSlackChannelsPageCursor,
    type SlackChannelCreateParams as SlackChannelCreateParams,
    type SlackChannelRetrieveParams as SlackChannelRetrieveParams,
    type SlackChannelUpdateParams as SlackChannelUpdateParams,
    type SlackChannelListParams as SlackChannelListParams,
    type SlackChannelDeleteParams as SlackChannelDeleteParams,
  };
}
