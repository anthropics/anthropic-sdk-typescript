import { APIResource } from '../../../../../core/resource';
import * as BetaAPI from '../../../beta';
import { APIPromise } from '../../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../../core/pagination';
import { buildHeaders } from '../../../../../internal/headers';
import { RequestOptions } from '../../../../../internal/request-options';
import { startApiCallSpan } from '../../../../../internal/tracing';
import { path } from '../../../../../internal/utils/path';

export class Targets extends APIResource {
  /**
   * Attach a Bundle to a Slack channel or a Slack workspace. A Bundle attached to a
   * workspace can be used in the workspace and in every channel in it. Attaching a
   * Bundle to a channel or workspace it is already attached to returns the existing
   * Bundle Target. The channel or workspace must be set up: attaching never sets a
   * channel up. A group direct message takes no Bundle and returns 400.
   *
   * @example
   * ```ts
   * const betaClaudeTagBundleTarget =
   *   await client.beta.organization.claudeTag.bundles.targets.create(
   *     'capp_011CZkZjLP1cWxj5EtMmdgbq',
   *     {
   *       target: {
   *         slack_channel_id: 'xxxxxxxx',
   *         type: 'slack_channel',
   *       },
   *     },
   *   );
   * ```
   */
  create(
    bundleID: string,
    params: TargetCreateParams,
    options?: RequestOptions,
  ): APIPromise<BetaClaudeTagBundleTarget> {
    const { target, betas } = params;
    return this._client.post(path`/v1/organizations/claude_tag/bundles/${bundleID}/targets`, {
      body: target,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_tag.bundles.targets.create',
        options,
        {
          route: '/v1/organizations/claude_tag/bundles/{bundle_id}/targets',
          attributes: { 'anthropic.organization.claude_tag.bundle.id': bundleID },
        },
      ),
    });
  }

  /**
   * Get one Bundle Target. Returns 404 when `target_id` is the identifier of another
   * Bundle's Bundle Target, or the Bundle Target was detached.
   *
   * @example
   * ```ts
   * const betaClaudeTagBundleTarget =
   *   await client.beta.organization.claudeTag.bundles.targets.retrieve(
   *     'btgt_01SvpyRQK3nN6eH9uhRA7n1qHq8TzW5mKc2YbX7vNd4RfJ',
   *     { bundle_id: 'capp_011CZkZjLP1cWxj5EtMmdgbq' },
   *   );
   * ```
   */
  retrieve(
    targetID: string,
    params: TargetRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<BetaClaudeTagBundleTarget> {
    const { bundle_id, betas } = params;
    return this._client.get(path`/v1/organizations/claude_tag/bundles/${bundle_id}/targets/${targetID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_tag.bundles.targets.retrieve',
        options,
        {
          route: '/v1/organizations/claude_tag/bundles/{bundle_id}/targets/{target_id}',
          attributes: {
            'anthropic.organization.claude_tag.bundle.id': bundle_id,
            'anthropic.organization.claude_tag.bundle.target.id': targetID,
          },
        },
      ),
    });
  }

  /**
   * List the Slack channels and Slack workspaces a Bundle is attached to, newest
   * first by `created_at`. Only channels and workspaces the organization owns are
   * listed; a Bundle that is attached to anything else has no Bundle Target for it.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaClaudeTagBundleTarget of client.beta.organization.claudeTag.bundles.targets.list(
   *   'capp_011CZkZjLP1cWxj5EtMmdgbq',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    bundleID: string,
    params: TargetListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaClaudeTagBundleTargetsPageCursor, BetaClaudeTagBundleTarget> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/organizations/claude_tag/bundles/${bundleID}/targets`,
      PageCursor<BetaClaudeTagBundleTarget>,
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
          'anthropic.organization.claude_tag.bundles.targets.list',
          options,
          {
            route: '/v1/organizations/claude_tag/bundles/{bundle_id}/targets',
            queryParams: ['limit', 'page'],
            attributes: { 'anthropic.organization.claude_tag.bundle.id': bundleID },
          },
        ),
      },
    );
  }

  /**
   * Detach a Bundle from a Slack channel or a Slack workspace. A repeated detach
   * returns 404.
   *
   * @example
   * ```ts
   * const betaClaudeTagDeletedBundleTarget =
   *   await client.beta.organization.claudeTag.bundles.targets.delete(
   *     'btgt_01SvpyRQK3nN6eH9uhRA7n1qHq8TzW5mKc2YbX7vNd4RfJ',
   *     { bundle_id: 'capp_011CZkZjLP1cWxj5EtMmdgbq' },
   *   );
   * ```
   */
  delete(
    targetID: string,
    params: TargetDeleteParams,
    options?: RequestOptions,
  ): APIPromise<BetaClaudeTagDeletedBundleTarget> {
    const { bundle_id, betas } = params;
    return this._client.delete(path`/v1/organizations/claude_tag/bundles/${bundle_id}/targets/${targetID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.claude_tag.bundles.targets.delete',
        options,
        {
          route: '/v1/organizations/claude_tag/bundles/{bundle_id}/targets/{target_id}',
          attributes: {
            'anthropic.organization.claude_tag.bundle.id': bundle_id,
            'anthropic.organization.claude_tag.bundle.target.id': targetID,
          },
        },
      ),
    });
  }
}

export type BetaClaudeTagBundleTargetsPageCursor = PageCursor<BetaClaudeTagBundleTarget>;

/**
 * One Bundle attached to one Slack channel or one Slack workspace. More types of
 * target can be added.
 */
export type BetaClaudeTagBundleTarget =
  | BetaClaudeTagSlackChannelBundleTarget
  | BetaClaudeTagSlackWorkspaceBundleTarget;

export type BetaClaudeTagBundleTargetCreate =
  | BetaClaudeTagSlackChannelBundleTargetCreate
  | BetaClaudeTagSlackWorkspaceBundleTargetCreate;

/**
 * Confirms that a Bundle was detached.
 */
export interface BetaClaudeTagDeletedBundleTarget {
  /**
   * The identifier the Bundle Target had.
   */
  id: string;

  type: 'bundle_target_deleted';
}

/**
 * One Bundle attached to one Slack channel. The Bundle can be used in that channel
 * only.
 */
export interface BetaClaudeTagSlackChannelBundleTarget {
  /**
   * The Bundle Target's identifier. Starts with `btgt_`. No two Bundle Targets have
   * the same one, and the same Bundle and target always give the same one, also
   * after a detach and a new attach. It is opaque.
   */
  id: string;

  /**
   * Time the Bundle was attached.
   */
  created_at: string;

  /**
   * The identifier of the Slack channel the Bundle is attached to, starting with
   * `slch_`. It is the channel object's `id`, not Slack's `channel_id`.
   */
  slack_channel_id: string;

  type: 'slack_channel';
}

/**
 * Attach the Bundle to a Slack channel.
 */
export interface BetaClaudeTagSlackChannelBundleTargetCreate {
  /**
   * The identifier of the Slack channel to attach the Bundle to, starting with
   * `slch_`. It is the channel object's `id`, not Slack's `channel_id`.
   */
  slack_channel_id: string;

  type: 'slack_channel';
}

/**
 * One Bundle attached to one Slack workspace. The Bundle can be used in the
 * workspace and in every channel in it.
 */
export interface BetaClaudeTagSlackWorkspaceBundleTarget {
  /**
   * The Bundle Target's identifier. Starts with `btgt_`. No two Bundle Targets have
   * the same one, and the same Bundle and target always give the same one, also
   * after a detach and a new attach. It is opaque.
   */
  id: string;

  /**
   * Time the Bundle was attached.
   */
  created_at: string;

  /**
   * The identifier of the Slack workspace the Bundle is attached to, starting with
   * `slws_`.
   */
  slack_workspace_id: string;

  type: 'slack_workspace';
}

/**
 * Attach the Bundle to a Slack workspace.
 */
export interface BetaClaudeTagSlackWorkspaceBundleTargetCreate {
  /**
   * The identifier of the Slack workspace to attach the Bundle to, starting with
   * `slws_`.
   */
  slack_workspace_id: string;

  type: 'slack_workspace';
}

export interface TargetCreateParams {
  /**
   * Body param
   */
  target: BetaClaudeTagBundleTargetCreate;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface TargetRetrieveParams {
  /**
   * Path param: The Bundle's identifier, starting with `capp_`.
   */
  bundle_id: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface TargetListParams extends PageCursorParams {
  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface TargetDeleteParams {
  /**
   * Path param: The Bundle's identifier, starting with `capp_`.
   */
  bundle_id: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Targets {
  export {
    type BetaClaudeTagBundleTarget as BetaClaudeTagBundleTarget,
    type BetaClaudeTagBundleTargetCreate as BetaClaudeTagBundleTargetCreate,
    type BetaClaudeTagDeletedBundleTarget as BetaClaudeTagDeletedBundleTarget,
    type BetaClaudeTagSlackChannelBundleTarget as BetaClaudeTagSlackChannelBundleTarget,
    type BetaClaudeTagSlackChannelBundleTargetCreate as BetaClaudeTagSlackChannelBundleTargetCreate,
    type BetaClaudeTagSlackWorkspaceBundleTarget as BetaClaudeTagSlackWorkspaceBundleTarget,
    type BetaClaudeTagSlackWorkspaceBundleTargetCreate as BetaClaudeTagSlackWorkspaceBundleTargetCreate,
    type BetaClaudeTagBundleTargetsPageCursor as BetaClaudeTagBundleTargetsPageCursor,
    type TargetCreateParams as TargetCreateParams,
    type TargetRetrieveParams as TargetRetrieveParams,
    type TargetListParams as TargetListParams,
    type TargetDeleteParams as TargetDeleteParams,
  };
}
