import { APIResource } from '../../../core/resource';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';

export class RateLimits extends APIResource {
  /**
   * List Messages API rate limits for your organization.
   *
   * Each entry corresponds to one rate-limit group (either a model family or an
   * API-surface category such as the Files API or Message Batches) and contains the
   * set of limiter values that apply to it.
   *
   * When `limit` is omitted, every matching entry is returned in a single page; when
   * `limit` truncates the result, follow `next_page` to fetch the remaining entries.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaOrganizationRateLimit of client.beta.organization.rateLimits.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: RateLimitListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaOrganizationRateLimitsPageCursor, BetaOrganizationRateLimit> {
    return this._client.getAPIList(
      '/v1/organizations/rate_limits?beta=true',
      PageCursor<BetaOrganizationRateLimit>,
      { query, ...options },
    );
  }
}

export type BetaOrganizationRateLimitsPageCursor = PageCursor<BetaOrganizationRateLimit>;

export interface BetaOrganizationRateLimit {
  /**
   * Identifier of this rate-limit entry. It is stable within the organization and
   * differs between organizations; the group's own identifier is `group.id`.
   */
  id: string;

  /**
   * The rate-limit group this entry's limits apply to. Its `type` equals
   * `group_type`.
   */
  group:
    | BetaOrganizationRateLimitModelGroup
    | BetaOrganizationRateLimitBatchGroup
    | BetaOrganizationRateLimitTokenCountGroup
    | BetaOrganizationRateLimitFilesGroup
    | BetaOrganizationRateLimitSkillsGroup
    | BetaOrganizationRateLimitWebSearchGroup;

  /**
   * @deprecated Use `group.type` instead. `group_type` is still returned and always
   * equals `group.type`.
   */
  group_type: 'batch' | 'files' | 'model_group' | 'skills' | 'token_count' | 'web_search';

  /**
   * The limiter values that apply to this group.
   */
  limits: Array<BetaOrganizationRateLimitValue>;

  /**
   * Model names this entry's limits apply to, including aliases. `null` when
   * `group_type` is not `"model_group"`.
   */
  models: Array<string> | null;

  /**
   * Object type. Always `rate_limit` for organization rate-limit entries.
   */
  type: 'rate_limit';
}

export interface BetaOrganizationRateLimitBatchGroup {
  /**
   * Opaque identifier of the rate-limit group (for example,
   * `rlg_01VPTCmyiu5ZLsWkcxYG2pY8`). It is the same in every organization and never
   * changes, unlike the entry's own identifier, which differs per organization.
   */
  id: string;

  /**
   * Always `batch`: the Message Batches API.
   */
  type: 'batch';
}

export interface BetaOrganizationRateLimitFilesGroup {
  /**
   * Opaque identifier of the rate-limit group (for example,
   * `rlg_01VPTCmyiu5ZLsWkcxYG2pY8`). It is the same in every organization and never
   * changes, unlike the entry's own identifier, which differs per organization.
   */
  id: string;

  /**
   * Always `files`: the Files API.
   */
  type: 'files';
}

export interface BetaOrganizationRateLimitModelGroup {
  /**
   * Opaque identifier of the rate-limit group (for example,
   * `rlg_01VPTCmyiu5ZLsWkcxYG2pY8`). It is the same in every organization and never
   * changes, unlike the entry's own identifier, which differs per organization.
   */
  id: string;

  /**
   * Human-readable name of the model group (for example, `Claude Sonnet 4.x`). For
   * display only; it may change.
   */
  display_name: string;

  /**
   * Always `model_group`: a family of models.
   */
  type: 'model_group';
}

export interface BetaOrganizationRateLimitSkillsGroup {
  /**
   * Opaque identifier of the rate-limit group (for example,
   * `rlg_01VPTCmyiu5ZLsWkcxYG2pY8`). It is the same in every organization and never
   * changes, unlike the entry's own identifier, which differs per organization.
   */
  id: string;

  /**
   * Always `skills`: the Skills API.
   */
  type: 'skills';
}

export interface BetaOrganizationRateLimitTokenCountGroup {
  /**
   * Opaque identifier of the rate-limit group (for example,
   * `rlg_01VPTCmyiu5ZLsWkcxYG2pY8`). It is the same in every organization and never
   * changes, unlike the entry's own identifier, which differs per organization.
   */
  id: string;

  /**
   * Always `token_count`: the Token Count API.
   */
  type: 'token_count';
}

export interface BetaOrganizationRateLimitValue {
  /**
   * The limiter type (for example, `requests_per_minute` or
   * `input_tokens_per_minute`).
   */
  type: string;

  /**
   * The configured limit value for this limiter type.
   */
  value: number;
}

export interface BetaOrganizationRateLimitWebSearchGroup {
  /**
   * Opaque identifier of the rate-limit group (for example,
   * `rlg_01VPTCmyiu5ZLsWkcxYG2pY8`). It is the same in every organization and never
   * changes, unlike the entry's own identifier, which differs per organization.
   */
  id: string;

  /**
   * Always `web_search`: the Messages API web search tool.
   */
  type: 'web_search';
}

export interface RateLimitListParams extends PageCursorParams {
  /**
   * Filter by group type.
   */
  group_type?: 'batch' | 'files' | 'model_group' | 'skills' | 'token_count' | 'web_search' | null;

  /**
   * Filter to the single entry containing this model. Accepts full model names and
   * aliases. Returns 404 if the model is not found or has no rate limits for this
   * organization.
   */
  model?: string | null;
}

export declare namespace RateLimits {
  export {
    type BetaOrganizationRateLimit as BetaOrganizationRateLimit,
    type BetaOrganizationRateLimitBatchGroup as BetaOrganizationRateLimitBatchGroup,
    type BetaOrganizationRateLimitFilesGroup as BetaOrganizationRateLimitFilesGroup,
    type BetaOrganizationRateLimitModelGroup as BetaOrganizationRateLimitModelGroup,
    type BetaOrganizationRateLimitSkillsGroup as BetaOrganizationRateLimitSkillsGroup,
    type BetaOrganizationRateLimitTokenCountGroup as BetaOrganizationRateLimitTokenCountGroup,
    type BetaOrganizationRateLimitValue as BetaOrganizationRateLimitValue,
    type BetaOrganizationRateLimitWebSearchGroup as BetaOrganizationRateLimitWebSearchGroup,
    type BetaOrganizationRateLimitsPageCursor as BetaOrganizationRateLimitsPageCursor,
    type RateLimitListParams as RateLimitListParams,
  };
}
