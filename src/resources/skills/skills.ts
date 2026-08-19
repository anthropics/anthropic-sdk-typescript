// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as VersionsAPI from './versions';
import {
  DeletedSkillVersion,
  SkillVersion,
  SkillVersionsPageCursor,
  VersionCreateParams,
  VersionDeleteParams,
  VersionListParams,
  VersionRetrieveParams,
  Versions,
} from './versions';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { type Uploadable } from '../../core/uploads';
import { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';

export class Skills extends APIResource {
  versions: VersionsAPI.Versions = new VersionsAPI.Versions(this._client);

  /**
   * Create Skill
   */
  create(body: SkillCreateParams, options?: RequestOptions): APIPromise<Skill> {
    return this._client.post(
      '/v1/skills',
      multipartFormRequestOptions({ body, ...options }, this._client, false),
    );
  }

  /**
   * Get Skill
   */
  retrieve(skillID: string, options?: RequestOptions): APIPromise<Skill> {
    return this._client.get(path`/v1/skills/${skillID}`, options);
  }

  /**
   * List Skills
   */
  list(
    query: SkillListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<SkillsPageCursor, Skill> {
    return this._client.getAPIList('/v1/skills', PageCursor<Skill>, { query, ...options });
  }

  /**
   * Delete Skill
   */
  delete(skillID: string, options?: RequestOptions): APIPromise<DeletedSkill> {
    return this._client.delete(path`/v1/skills/${skillID}`, options);
  }
}

export type SkillsPageCursor = PageCursor<Skill>;

export interface DeletedSkill {
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

export interface Skill {
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
  source: SkillSource;

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

export interface SkillSource {
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
   * Files to upload for the skill.
   *
   * All files must be in the same top-level directory and must include a SKILL.md
   * file at the root of that directory.
   */
  files: Array<Uploadable>;

  /**
   * Human-readable, single-line label for the Skill. Maximum 255 characters. Always
   * set: derived from the SKILL.md frontmatter `name` when omitted at creation. Not
   * unique.
   */
  display_name?: string | null;
}

export interface SkillListParams extends PageCursorParams {
  /**
   * Filter skills by source.
   *
   * If provided, only skills from the specified source will be returned:
   *
   * - `"custom"`: only return user-created skills
   * - `"anthropic"`: only return Anthropic-created skills
   */
  source?: string | null;
}

Skills.Versions = Versions;

export declare namespace Skills {
  export {
    type DeletedSkill as DeletedSkill,
    type Skill as Skill,
    type SkillSource as SkillSource,
    type SkillsPageCursor as SkillsPageCursor,
    type SkillCreateParams as SkillCreateParams,
    type SkillListParams as SkillListParams,
  };

  export {
    Versions as Versions,
    type DeletedSkillVersion as DeletedSkillVersion,
    type SkillVersion as SkillVersion,
    type SkillVersionsPageCursor as SkillVersionsPageCursor,
    type VersionCreateParams as VersionCreateParams,
    type VersionRetrieveParams as VersionRetrieveParams,
    type VersionListParams as VersionListParams,
    type VersionDeleteParams as VersionDeleteParams,
  };
}
