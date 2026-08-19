// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { type Uploadable } from '../../core/uploads';
import { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';

export class Versions extends APIResource {
  /**
   * Create Skill Version
   */
  create(skillID: string, body: VersionCreateParams, options?: RequestOptions): APIPromise<SkillVersion> {
    return this._client.post(
      path`/v1/skills/${skillID}/versions`,
      multipartFormRequestOptions({ body, ...options }, this._client, false),
    );
  }

  /**
   * Get Skill Version
   */
  retrieve(
    version: string,
    params: VersionRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<SkillVersion> {
    const { skill_id } = params;
    return this._client.get(path`/v1/skills/${skill_id}/versions/${version}`, options);
  }

  /**
   * List Skill Versions
   */
  list(
    skillID: string,
    query: VersionListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<SkillVersionsPageCursor, SkillVersion> {
    return this._client.getAPIList(path`/v1/skills/${skillID}/versions`, PageCursor<SkillVersion>, {
      query,
      ...options,
    });
  }

  /**
   * Delete Skill Version
   */
  delete(
    version: string,
    params: VersionDeleteParams,
    options?: RequestOptions,
  ): APIPromise<DeletedSkillVersion> {
    const { skill_id } = params;
    return this._client.delete(path`/v1/skills/${skill_id}/versions/${version}`, options);
  }
}

export type SkillVersionsPageCursor = PageCursor<SkillVersion>;

export interface DeletedSkillVersion {
  /**
   * Unique identifier for this Skill Version. The id addresses the version in paths
   * and pins it in references.
   */
  id: string;

  /**
   * Deleted object type.
   *
   * For Skill Versions, this is always `"skill_version_deleted"`.
   */
  type: 'skill_version_deleted';
}

export interface SkillVersion {
  /**
   * Unique identifier for this Skill Version. The id addresses the version in paths
   * and pins it in references.
   */
  id: string;

  /**
   * ISO 8601 timestamp of when the skill was created.
   */
  created_at: string;

  /**
   * Description of the skill version.
   *
   * This is extracted from the SKILL.md file in the skill upload.
   */
  description: string;

  /**
   * The Skill's immutable kebab-case slug, set at creation from the first upload's
   * SKILL.md frontmatter `name` (or its enclosing directory). Every later upload
   * must resolve to the same value. Also the top-level directory of the Skill's
   * mounted files and the base name of a downloaded archive.
   */
  name: string;

  /**
   * Unique identifier for the skill.
   *
   * The format and length of IDs may change over time.
   */
  skill_id: string;

  /**
   * Object type.
   *
   * For Skill Versions, this is always `"skill_version"`.
   */
  type: 'skill_version';
}

export interface VersionCreateParams {
  /**
   * Files to upload for the skill.
   *
   * All files must be in the same top-level directory and must include a SKILL.md
   * file at the root of that directory.
   */
  files: Array<Uploadable>;
}

export interface VersionRetrieveParams {
  /**
   * Unique identifier for the skill.
   *
   * The format and length of IDs may change over time.
   */
  skill_id: string;
}

export interface VersionListParams extends PageCursorParams {}

export interface VersionDeleteParams {
  /**
   * Unique identifier for the skill.
   *
   * The format and length of IDs may change over time.
   */
  skill_id: string;
}

export declare namespace Versions {
  export {
    type DeletedSkillVersion as DeletedSkillVersion,
    type SkillVersion as SkillVersion,
    type SkillVersionsPageCursor as SkillVersionsPageCursor,
    type VersionCreateParams as VersionCreateParams,
    type VersionRetrieveParams as VersionRetrieveParams,
    type VersionListParams as VersionListParams,
    type VersionDeleteParams as VersionDeleteParams,
  };
}
