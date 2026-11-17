import { APIResource } from '../../../../../core/resource';
import * as BetaAPI from '../../../beta';
import * as TargetsAPI from './targets';
import {
  BetaClaudeTagBundleTarget,
  BetaClaudeTagBundleTargetCreate,
  BetaClaudeTagBundleTargetsPageCursor,
  BetaClaudeTagDeletedBundleTarget,
  BetaClaudeTagSlackChannelBundleTarget,
  BetaClaudeTagSlackChannelBundleTargetCreate,
  BetaClaudeTagSlackWorkspaceBundleTarget,
  BetaClaudeTagSlackWorkspaceBundleTargetCreate,
  TargetCreateParams,
  TargetDeleteParams,
  TargetListParams,
  TargetRetrieveParams,
  Targets,
} from './targets';
import { APIPromise } from '../../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../../core/pagination';
import { buildHeaders } from '../../../../../internal/headers';
import { RequestOptions } from '../../../../../internal/request-options';
import { startApiCallSpan } from '../../../../../internal/tracing';
import { path } from '../../../../../internal/utils/path';

export class Bundles extends APIResource {
  targets: TargetsAPI.Targets = new TargetsAPI.Targets(this._client);

  /**
   * Get one Bundle. What the Bundle grants (connectors, repositories and
   * credentials) is never returned.
   *
   * @throws {BetaAPIKeyScopeMissingError}
   * @throws {BetaClaudeTagWritesNotEnabledError}
   * @throws {BetaComplianceConfigurationRestrictedError}
   * @throws {BetaOrganizationLevelScopedAPIKeyRequiredError}
   *
   * @example
   * ```ts
   * const betaClaudeTagBundle =
   *   await client.beta.organization.claudeTag.bundles.retrieve(
   *     'capp_011CZkZjLP1cWxj5EtMmdgbq',
   *   );
   * ```
   */
  retrieve(
    bundleID: string,
    params: BundleRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaClaudeTagBundle> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/organizations/claude_tag/bundles/${bundleID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.claude_tag.bundles.retrieve', options, {
        route: '/v1/organizations/claude_tag/bundles/{bundle_id}',
        attributes: { 'anthropic.organization.claude_tag.bundle.id': bundleID },
      }),
    });
  }

  /**
   * Change a Bundle's instructions. The update is partial: a field left out is
   * unchanged, and `instructions` sent as null or as an empty string clears them.
   * The later of two updates wins. Sessions that start after the change use the new
   * instructions; sessions already running keep the ones they started with. Some
   * Bundles are managed in claude.ai, and an update of one returns 400.
   *
   * @throws {BetaBundleAttachmentNotSupportedError}
   * @throws {BetaBundleOnCallError}
   * @throws {BetaAPIKeyScopeMissingError}
   * @throws {BetaClaudeTagWritesNotEnabledError}
   * @throws {BetaComplianceConfigurationRestrictedError}
   * @throws {BetaOrganizationLevelScopedAPIKeyRequiredError}
   * @throws {BetaSlackChannelSetUpSettingsConflictError}
   *
   * @example
   * ```ts
   * const betaClaudeTagBundle =
   *   await client.beta.organization.claudeTag.bundles.update(
   *     'capp_011CZkZjLP1cWxj5EtMmdgbq',
   *     {},
   *   );
   * ```
   */
  update(
    bundleID: string,
    params: BundleUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaClaudeTagBundle> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/claude_tag/bundles/${bundleID}`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.claude_tag.bundles.update', options, {
        route: '/v1/organizations/claude_tag/bundles/{bundle_id}',
        attributes: { 'anthropic.organization.claude_tag.bundle.id': bundleID },
      }),
    });
  }

  /**
   * List the organization's Bundles, newest first by `created_at`. A Bundle that
   * Claude Tag manages for itself is not listed.
   *
   * @throws {BetaAPIKeyScopeMissingError}
   * @throws {BetaClaudeTagWritesNotEnabledError}
   * @throws {BetaComplianceConfigurationRestrictedError}
   * @throws {BetaOrganizationLevelScopedAPIKeyRequiredError}
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaClaudeTagBundle of client.beta.organization.claudeTag.bundles.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: BundleListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaClaudeTagBundlesPageCursor, BetaClaudeTagBundle> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/organizations/claude_tag/bundles', PageCursor<BetaClaudeTagBundle>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'experimental-claude-tag-2026-10-21'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.claude_tag.bundles.list', options, {
        route: '/v1/organizations/claude_tag/bundles',
        queryParams: ['limit', 'page'],
      }),
    });
  }
}

export type BetaClaudeTagBundlesPageCursor = PageCursor<BetaClaudeTagBundle>;

/**
 * A named set of access that Claude can use in a Slack channel or a Slack
 * workspace: connectors, repositories and credentials. Created and edited in
 * claude.ai; Update Bundle also changes its instructions.
 */
export interface BetaClaudeTagBundle {
  /**
   * The Bundle's identifier. Starts with `capp_`.
   */
  id: string;

  /**
   * Time the Bundle was created.
   */
  created_at: string;

  /**
   * What the Bundle is for. Null when it has none. Read-only.
   */
  description: string | null;

  /**
   * The Bundle's name. Always set. Read-only.
   */
  display_name: string;

  /**
   * Instructions for Claude, added to the instructions of every session that can use
   * the Bundle. Null when it has none.
   */
  instructions: string | null;

  type: 'bundle';

  /**
   * Time of the last change to the Bundle.
   */
  updated_at: string;
}

export interface BundleRetrieveParams {
  /**
   * This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface BundleUpdateParams {
  /**
   * Body param: Instructions for Claude, up to 10,000 bytes (UTF-8), added to the
   * instructions of every session that can use the Bundle. Null or an empty string
   * clears them.
   */
  instructions?: string | null;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface BundleListParams extends PageCursorParams {
  /**
   * Header param: This endpoint is in beta: requests must send
   * `experimental-claude-tag-2026-10-21` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

Bundles.Targets = Targets;

export declare namespace Bundles {
  export {
    type BetaClaudeTagBundle as BetaClaudeTagBundle,
    type BetaClaudeTagBundlesPageCursor as BetaClaudeTagBundlesPageCursor,
    type BundleRetrieveParams as BundleRetrieveParams,
    type BundleUpdateParams as BundleUpdateParams,
    type BundleListParams as BundleListParams,
  };

  export {
    Targets as Targets,
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
