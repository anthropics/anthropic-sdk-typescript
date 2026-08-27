// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as VersionsAPI from './versions';
import {
  BetaDeletedSkillVersion,
  BetaSkillVersion,
  BetaSkillVersionsPageCursor,
  VersionCreateParams,
  VersionDeleteParams,
  VersionDownloadParams,
  VersionListParams,
  VersionRetrieveParams,
  Versions,
} from './versions';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { type Uploadable } from '../../../core/uploads';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { multipartFormRequestOptions } from '../../../internal/uploads';
import { path } from '../../../internal/utils/path';

export class Skills extends APIResource {
  versions: VersionsAPI.Versions = new VersionsAPI.Versions(this._client);

  /**
   * Create Skill
   *
   * @example
   * ```ts
   * const betaSkill = await client.beta.skills.create({
   *   files: [fs.createReadStream('path/to/file')],
   * });
   * ```
   */
  create(params: SkillCreateParams, options?: RequestOptions): APIPromise<BetaSkill> {
    const { betas, ...body } = params;
    return this._client.post(
      '/v1/skills?beta=true',
      multipartFormRequestOptions(
        {
          body,
          ...options,
          headers: buildHeaders([
            { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
            options?.headers,
          ]),
        },
        this._client,
        false,
      ),
    );
  }

  /**
   * Get Skill
   *
   * @example
   * ```ts
   * const betaSkill = await client.beta.skills.retrieve(
   *   'skill_id',
   * );
   * ```
   */
  retrieve(
    skillID: string,
    params: SkillRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaSkill> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/skills/${skillID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * List Skills
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaSkill of client.beta.skills.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: SkillListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaSkillsPageCursor, BetaSkill> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/skills?beta=true', PageCursor<BetaSkill>, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Skill
   *
   * @example
   * ```ts
   * const betaDeletedSkill = await client.beta.skills.delete(
   *   'skill_id',
   * );
   * ```
   */
  delete(
    skillID: string,
    params: SkillDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaDeletedSkill> {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/skills/${skillID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
    });
  }
}

export type BetaSkillsPageCursor = PageCursor<BetaSkill>;

export interface BetaDeletedSkill {
  /**
   * Unique identifier for the skill.
   *
   * The format and length of IDs may change over time.
   */
  id: string;

  /**
   * Deleted object type.
   *
   * For Skills, this is always `"skill_deleted"`.
   */
  type: 'skill_deleted';
}

export interface BetaSkill {
  /**
   * Unique identifier for the skill.
   *
   * The format and length of IDs may change over time.
   */
  id: string;

  /**
   * ISO 8601 timestamp of when the skill was created.
   */
  created_at: string;

  /**
   * Human-readable, single-line label for the Skill. Maximum 255 characters. Always
   * set: derived from the SKILL.md frontmatter `name` when omitted at creation. Not
   * unique.
   */
  display_name: string;

  /**
   * ID of the newest Skill Version — what `latest` references resolve to. Always
   * set: a Skill holds at least one version.
   */
  latest_version_id: string;

  /**
   * Where the Skill comes from.
   *
   * Possible values:
   *
   * - `"custom"`: authored by the platform user; private to their workspace
   * - `"anthropic"`: published by Anthropic; shared and read-only
   * - `"anthropic_example"`: Anthropic-published sample Skill
   * - `"plugin"`: resolved from an installed plugin
   */
  source: BetaSkillSource;

  /**
   * Object type.
   *
   * For Skills, this is always `"skill"`.
   */
  type: 'skill';

  /**
   * ISO 8601 timestamp of when the skill was last updated.
   */
  updated_at: string;
}

export interface BetaSkillSource {
  /**
   * Where the Skill comes from.
   *
   * Possible values:
   *
   * - `"custom"`: authored by the platform user; private to their workspace
   * - `"anthropic"`: published by Anthropic; shared and read-only
   * - `"anthropic_example"`: Anthropic-published sample Skill
   * - `"plugin"`: resolved from an installed plugin
   */
  type: 'custom' | 'anthropic' | 'anthropic_example' | 'plugin';
}

export interface SkillCreateParams {
  /**
   * Body param: Files to upload for the skill.
   *
   * All files must be in the same top-level directory and must include a SKILL.md
   * file at the root of that directory.
   */
  files: Array<Uploadable>;

  /**
   * Body param: Human-readable, single-line label for the Skill. Maximum 255
   * characters. Always set: derived from the SKILL.md frontmatter `name` when
   * omitted at creation. Not unique.
   */
  display_name?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SkillRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SkillListParams extends PageCursorParams {
  /**
   * Query param: Filter skills by source.
   *
   * If provided, only skills from the specified source will be returned:
   *
   * - `"custom"`: only return user-created skills
   * - `"anthropic"`: only return Anthropic-created skills
   */
  source?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SkillDeleteParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

Skills.Versions = Versions;

export declare namespace Skills {
  export {
    type BetaDeletedSkill as BetaDeletedSkill,
    type BetaSkill as BetaSkill,
    type BetaSkillSource as BetaSkillSource,
    type BetaSkillsPageCursor as BetaSkillsPageCursor,
    type SkillCreateParams as SkillCreateParams,
    type SkillRetrieveParams as SkillRetrieveParams,
    type SkillListParams as SkillListParams,
    type SkillDeleteParams as SkillDeleteParams,
  };

  export {
    Versions as Versions,
    type BetaDeletedSkillVersion as BetaDeletedSkillVersion,
    type BetaSkillVersion as BetaSkillVersion,
    type BetaSkillVersionsPageCursor as BetaSkillVersionsPageCursor,
    type VersionCreateParams as VersionCreateParams,
    type VersionRetrieveParams as VersionRetrieveParams,
    type VersionListParams as VersionListParams,
    type VersionDeleteParams as VersionDeleteParams,
    type VersionDownloadParams as VersionDownloadParams,
  };
}
