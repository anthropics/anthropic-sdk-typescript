import { APIResource } from '../../../../core/resource';
import * as SlackChannelsAPI from './slack-channels';
import {
  BetaClaudeTagDeletedSlackChannel,
  BetaClaudeTagSlackChannel,
  BetaClaudeTagSlackChannelsPageCursor,
  SlackChannelCreateParams,
  SlackChannelDeleteParams,
  SlackChannelListParams,
  SlackChannelRetrieveParams,
  SlackChannelUpdateParams,
  SlackChannels,
} from './slack-channels';
import * as SlackWorkspacesAPI from './slack-workspaces';
import {
  BetaClaudeTagSlackWorkspace,
  BetaClaudeTagSlackWorkspacesPageCursor,
  SlackWorkspaceListParams,
  SlackWorkspaceRetrieveParams,
  SlackWorkspaceUpdateParams,
  SlackWorkspaces,
} from './slack-workspaces';
import * as BundlesAPI from './bundles/bundles';
import {
  BetaClaudeTagBundle,
  BetaClaudeTagBundlesPageCursor,
  BundleListParams,
  BundleRetrieveParams,
  Bundles,
} from './bundles/bundles';

export class ClaudeTag extends APIResource {
  slackChannels: SlackChannelsAPI.SlackChannels = new SlackChannelsAPI.SlackChannels(this._client);
  slackWorkspaces: SlackWorkspacesAPI.SlackWorkspaces = new SlackWorkspacesAPI.SlackWorkspaces(this._client);
  bundles: BundlesAPI.Bundles = new BundlesAPI.Bundles(this._client);
}

/**
 * No settings level sets a value, and the built-in default applies.
 */
export interface BetaClaudeTagDefaultSettingSource {
  type: 'default';
}

/**
 * What Claude does in a channel while a Slack guest is in it, for everyone in the
 * channel. It changes nothing in a channel without Slack guests. More types can be
 * added.
 */
export type BetaClaudeTagGuestPolicy =
  | BetaClaudeTagGuestPolicyAllow
  | BetaClaudeTagGuestPolicyRestrict
  | BetaClaudeTagGuestPolicyChannelOnly;

/**
 * Claude answers in the channel.
 */
export interface BetaClaudeTagGuestPolicyAllow {
  type: 'allow';
}

/**
 * Claude answers with only the Bundles attached to the channel itself.
 */
export interface BetaClaudeTagGuestPolicyChannelOnly {
  type: 'channel_only';
}

/**
 * Claude does not answer in the channel.
 */
export interface BetaClaudeTagGuestPolicyRestrict {
  type: 'restrict';
}

/**
 * The settings level a value comes from. More types can be added.
 */
export type BetaClaudeTagSettingSource =
  | BetaClaudeTagSlackChannelSettingSource
  | BetaClaudeTagSlackWorkspaceSettingSource
  | BetaClaudeTagSlackParentChannelSettingSource
  | BetaClaudeTagSlackDefaultSettingSource
  | BetaClaudeTagDefaultSettingSource
  | BetaClaudeTagSlackGridChannelSettingSource;

/**
 * For each setting, the settings level its value in `settings` comes from. Without
 * `include_inherited`, a setting the channel or workspace stores has a source that
 * names the channel or workspace itself, and one it does not store has null, or an
 * empty list for `instructions`. With `include_inherited=true` no member is null:
 * a value that no settings level sets has the source `default`.
 */
export interface BetaClaudeTagSettingSources {
  /**
   * The settings level `enabled` comes from.
   */
  enabled: BetaClaudeTagSettingSource | null;

  /**
   * The settings level `environment_id` comes from.
   */
  environment_id: BetaClaudeTagSettingSource | null;

  /**
   * The settings level `guest_policy` comes from.
   */
  guest_policy: BetaClaudeTagSettingSource | null;

  /**
   * Every settings level that contributes text to `instructions`, broadest first, in
   * the order their text is joined. Empty when none does.
   */
  instructions: Array<BetaClaudeTagSettingSource>;

  /**
   * The settings level `model` comes from.
   */
  model: BetaClaudeTagSettingSource | null;
}

/**
 * Claude Tag settings. Without `include_inherited`, a setting that is null is not
 * set on the settings level and is inherited. With it, `enabled` and
 * `guest_policy` are never null, and `instructions`, `model` and `environment_id`
 * are null when no settings level sets them.
 */
export interface BetaClaudeTagSettings {
  /**
   * Whether Claude is on. The nearest settings level that sets it decides.
   */
  enabled: boolean | null;

  /**
   * The environment Claude's sessions run in, starting with `env_`, or the
   * identifier of a self-hosted runner pool, starting with `ccpool_`. The nearest
   * settings level that sets it decides.
   */
  environment_id: string | null;

  /**
   * What Claude does in a channel while a Slack guest is in it. The nearest settings
   * level that sets it decides.
   */
  guest_policy: BetaClaudeTagGuestPolicy | null;

  /**
   * Instructions for Claude. Instructions add up: the text of every settings level
   * that sets it is joined, broadest first.
   */
  instructions: string | null;

  /**
   * The model Claude uses: a model identifier or the name of a model line. The
   * nearest settings level that sets it decides. When none does, Claude uses the
   * product's default model.
   */
  model: string | null;
}

/**
 * The settings in a request that sets a Slack channel up. A setting left out is
 * not set. A setting sent as null is cleared.
 */
export interface BetaClaudeTagSettingsCreate {
  /**
   * Whether Claude is on. `true` on a channel turns Claude on in it even when its
   * workspace stores `false`. Null clears it.
   */
  enabled?: boolean | null;

  /**
   * The environment Claude's sessions run in: the identifier of an active
   * environment of the organization, starting with `env_`. Null clears it.
   */
  environment_id?: string | null;

  /**
   * What Claude does in a channel while a Slack guest is in it. Null clears it.
   */
  guest_policy?: BetaClaudeTagGuestPolicy | null;

  /**
   * Instructions for Claude, up to 8,192 characters after leading and trailing white
   * space is trimmed. Null or blank text clears them.
   */
  instructions?: string | null;

  /**
   * The model Claude uses: the identifier of a model, or the name of a model line,
   * that the organization is entitled to for Claude Tag. Null clears it.
   */
  model?: string | null;
}

/**
 * The settings to change. A setting left out is unchanged. A setting sent as null
 * is cleared, so it is inherited.
 */
export interface BetaClaudeTagSettingsUpdate {
  /**
   * Whether Claude is on. `true` on a channel turns Claude on in it even when its
   * workspace stores `false`. Null clears it.
   */
  enabled?: boolean | null;

  /**
   * The environment Claude's sessions run in: the identifier of an active
   * environment of the organization, starting with `env_`. Null clears it.
   */
  environment_id?: string | null;

  /**
   * What Claude does in a channel while a Slack guest is in it. Null clears it.
   */
  guest_policy?: BetaClaudeTagGuestPolicy | null;

  /**
   * Instructions for Claude, up to 8,192 characters after leading and trailing white
   * space is trimmed. Null or blank text clears them.
   */
  instructions?: string | null;

  /**
   * The model Claude uses: the identifier of a model, or the name of a model line,
   * that the organization is entitled to for Claude Tag. Null clears it.
   */
  model?: string | null;
}

/**
 * The identifiers Slack shows for a channel. They are Slack's own, not identifiers
 * of this API.
 */
export interface BetaClaudeTagSlackChannelIdentifiers {
  /**
   * Slack's identifier for the channel, starting with `C` or `G`, such as
   * `C0456EFGH`.
   */
  channel_id: string;

  /**
   * Slack's identifier for the workspace the channel is in, starting with `T`, such
   * as `T0123ABCD`.
   */
  workspace_id: string;
}

/**
 * The value comes from the addressed Slack channel itself.
 */
export interface BetaClaudeTagSlackChannelSettingSource {
  /**
   * The channel's identifier, starting with `slch_`.
   */
  slack_channel_id: string;

  type: 'slack_channel';
}

/**
 * The value comes from the organization's Slack defaults, which have no
 * identifier.
 */
export interface BetaClaudeTagSlackDefaultSettingSource {
  type: 'slack_default';
}

/**
 * The value comes from the addressed channel as it is set up under another
 * workspace of its Enterprise Grid: a channel shared across the Grid keeps one
 * Slack channel identifier in every workspace that sees it.
 */
export interface BetaClaudeTagSlackGridChannelSettingSource {
  /**
   * Slack's own identifiers for the channel under that other workspace.
   */
  slack: BetaClaudeTagSlackChannelIdentifiers;

  type: 'slack_grid_channel';
}

/**
 * The value comes from the channel that a code channel was started from. A parent
 * channel contributes `instructions` and `environment_id` only.
 */
export interface BetaClaudeTagSlackParentChannelSettingSource {
  /**
   * The parent channel's identifier, starting with `slch_`.
   */
  slack_channel_id: string;

  type: 'slack_parent_channel';
}

/**
 * The identifier Slack shows for a workspace. It is Slack's own, not an identifier
 * of this API.
 */
export interface BetaClaudeTagSlackWorkspaceIdentifiers {
  /**
   * Slack's identifier for the workspace, starting with `T`, such as `T0123ABCD`.
   */
  workspace_id: string;
}

/**
 * The value comes from a Slack workspace of the organization.
 */
export interface BetaClaudeTagSlackWorkspaceSettingSource {
  /**
   * The workspace's identifier, starting with `slws_`.
   */
  slack_workspace_id: string;

  type: 'slack_workspace';
}

ClaudeTag.SlackChannels = SlackChannels;
ClaudeTag.SlackWorkspaces = SlackWorkspaces;
ClaudeTag.Bundles = Bundles;

export declare namespace ClaudeTag {
  export {
    type BetaClaudeTagDefaultSettingSource as BetaClaudeTagDefaultSettingSource,
    type BetaClaudeTagGuestPolicy as BetaClaudeTagGuestPolicy,
    type BetaClaudeTagGuestPolicyAllow as BetaClaudeTagGuestPolicyAllow,
    type BetaClaudeTagGuestPolicyChannelOnly as BetaClaudeTagGuestPolicyChannelOnly,
    type BetaClaudeTagGuestPolicyRestrict as BetaClaudeTagGuestPolicyRestrict,
    type BetaClaudeTagSettingSource as BetaClaudeTagSettingSource,
    type BetaClaudeTagSettingSources as BetaClaudeTagSettingSources,
    type BetaClaudeTagSettings as BetaClaudeTagSettings,
    type BetaClaudeTagSettingsCreate as BetaClaudeTagSettingsCreate,
    type BetaClaudeTagSettingsUpdate as BetaClaudeTagSettingsUpdate,
    type BetaClaudeTagSlackChannelIdentifiers as BetaClaudeTagSlackChannelIdentifiers,
    type BetaClaudeTagSlackChannelSettingSource as BetaClaudeTagSlackChannelSettingSource,
    type BetaClaudeTagSlackDefaultSettingSource as BetaClaudeTagSlackDefaultSettingSource,
    type BetaClaudeTagSlackGridChannelSettingSource as BetaClaudeTagSlackGridChannelSettingSource,
    type BetaClaudeTagSlackParentChannelSettingSource as BetaClaudeTagSlackParentChannelSettingSource,
    type BetaClaudeTagSlackWorkspaceIdentifiers as BetaClaudeTagSlackWorkspaceIdentifiers,
    type BetaClaudeTagSlackWorkspaceSettingSource as BetaClaudeTagSlackWorkspaceSettingSource,
  };

  export {
    SlackChannels as SlackChannels,
    type BetaClaudeTagDeletedSlackChannel as BetaClaudeTagDeletedSlackChannel,
    type BetaClaudeTagSlackChannel as BetaClaudeTagSlackChannel,
    type BetaClaudeTagSlackChannelsPageCursor as BetaClaudeTagSlackChannelsPageCursor,
    type SlackChannelCreateParams as SlackChannelCreateParams,
    type SlackChannelRetrieveParams as SlackChannelRetrieveParams,
    type SlackChannelUpdateParams as SlackChannelUpdateParams,
    type SlackChannelListParams as SlackChannelListParams,
    type SlackChannelDeleteParams as SlackChannelDeleteParams,
  };

  export {
    SlackWorkspaces as SlackWorkspaces,
    type BetaClaudeTagSlackWorkspace as BetaClaudeTagSlackWorkspace,
    type BetaClaudeTagSlackWorkspacesPageCursor as BetaClaudeTagSlackWorkspacesPageCursor,
    type SlackWorkspaceRetrieveParams as SlackWorkspaceRetrieveParams,
    type SlackWorkspaceUpdateParams as SlackWorkspaceUpdateParams,
    type SlackWorkspaceListParams as SlackWorkspaceListParams,
  };

  export {
    Bundles as Bundles,
    type BetaClaudeTagBundle as BetaClaudeTagBundle,
    type BetaClaudeTagBundlesPageCursor as BetaClaudeTagBundlesPageCursor,
    type BundleRetrieveParams as BundleRetrieveParams,
    type BundleListParams as BundleListParams,
  };
}
