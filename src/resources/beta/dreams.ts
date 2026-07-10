// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as BetaAPI from './beta';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Dreams extends APIResource {
  /**
   * Create a Dream
   *
   * @example
   * ```ts
   * const betaDream = await client.beta.dreams.create({
   *   inputs: [{ memory_store_id: 'x', type: 'memory_store' }],
   *   model: 'string',
   * });
   * ```
   */
  create(params: DreamCreateParams, options?: RequestOptions): APIPromise<BetaDream> {
    const { betas, ...body } = params;
    return this._client.post('/v1/dreams?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'dreaming-2026-04-21'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Get a Dream
   *
   * @example
   * ```ts
   * const betaDream = await client.beta.dreams.retrieve(
   *   'dream_id',
   * );
   * ```
   */
  retrieve(
    dreamID: string,
    params: DreamRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaDream> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/dreams/${dreamID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'dreaming-2026-04-21'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List Dreams
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaDream of client.beta.dreams.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: DreamListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaDreamsPageCursor, BetaDream> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/dreams?beta=true', PageCursor<BetaDream>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'dreaming-2026-04-21'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Archive a Dream
   *
   * @example
   * ```ts
   * const betaDream = await client.beta.dreams.archive(
   *   'dream_id',
   * );
   * ```
   */
  archive(
    dreamID: string,
    params: DreamArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaDream> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/dreams/${dreamID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'dreaming-2026-04-21'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Cancel a Dream
   *
   * @example
   * ```ts
   * const betaDream = await client.beta.dreams.cancel(
   *   'dream_id',
   * );
   * ```
   */
  cancel(
    dreamID: string,
    params: DreamCancelParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaDream> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/dreams/${dreamID}/cancel?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'dreaming-2026-04-21'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaDreamsPageCursor = PageCursor<BetaDream>;

/**
 * An asynchronous memory-consolidation job that reads a memory store plus a set of
 * session transcripts and writes consolidated memories into a new output memory
 * store. The Dreams API is in research preview: the request and response shapes
 * are volatile and may change without the deprecation period that applies to
 * generally-available endpoints.
 */
export interface BetaDream {
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  archived_at: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  /**
   * A timestamp in RFC 3339 format
   */
  ended_at: string | null;

  /**
   * Failure detail for a Dream whose `status` is `failed`.
   */
  error: BetaDreamError | null;

  inputs: Array<BetaDreamInput>;

  instructions: string | null;

  /**
   * Model identifier and configuration applied to every pipeline stage. Same wire
   * shape as the Agents API ModelConfig.
   */
  model: BetaDreamModelConfig;

  outputs: Array<BetaDreamOutput>;

  session_id: string | null;

  /**
   * Lifecycle status of a Dream.
   */
  status: BetaDreamStatus;

  type: 'dream';

  /**
   * Cumulative token usage for the dream across every pipeline stage.
   */
  usage: BetaDreamUsage;
}

/**
 * Failure detail for a Dream whose `status` is `failed`.
 */
export interface BetaDreamError {
  message: string;

  type: string;
}

/**
 * An input memory store the dream reads from. The dream never mutates this store.
 */
export type BetaDreamInput = BetaDreamMemoryStoreInput | BetaDreamSessionsInput;

/**
 * An input memory store the dream reads from. The dream never mutates this store.
 */
export interface BetaDreamMemoryStoreInput {
  memory_store_id: string;

  type: 'memory_store';
}

/**
 * An output memory store the dream writes consolidated memories into.
 */
export interface BetaDreamMemoryStoreOutput {
  memory_store_id: string;

  type: 'memory_store';
}

/**
 * Model identifier and configuration applied to every pipeline stage. Same wire
 * shape as the Agents API ModelConfig.
 */
export interface BetaDreamModelConfig {
  /**
   * Model identifier, e.g. "claude-opus-4-7". 1-256 characters.
   */
  id: string;

  /**
   * Inference speed mode. `fast` provides significantly faster output token
   * generation at premium pricing. Not all models support `fast`; invalid
   * combinations are rejected at create time.
   */
  speed?: 'standard' | 'fast';
}

/**
 * Model identifier and configuration applied to every pipeline stage.
 */
export interface BetaDreamModelConfigParam {
  /**
   * Model identifier, e.g. "claude-opus-4-7". 1-256 characters.
   */
  id: string;

  /**
   * Inference speed mode. `fast` provides significantly faster output token
   * generation at premium pricing. Not all models support `fast`; invalid
   * combinations are rejected at create time.
   */
  speed?: 'standard' | 'fast' | null;
}

/**
 * An output memory store the dream writes consolidated memories into.
 */
export interface BetaDreamOutput {
  memory_store_id: string;

  type: 'memory_store';
}

/**
 * Input session transcripts the dream reads.
 */
export interface BetaDreamSessionsInput {
  session_ids: Array<string>;

  type: 'sessions';
}

/**
 * Lifecycle status of a Dream.
 */
export type BetaDreamStatus = 'pending' | 'running' | 'completed' | 'failed' | 'canceled';

/**
 * Cumulative token usage for the dream across every pipeline stage.
 */
export interface BetaDreamUsage {
  /**
   * Total tokens used to create prompt-cache entries (sum of all TTL tiers).
   */
  cache_creation_input_tokens: number;

  /**
   * Total tokens read from prompt cache.
   */
  cache_read_input_tokens: number;

  /**
   * Total uncached input tokens consumed across every pipeline stage.
   */
  input_tokens: number;

  /**
   * Total output tokens generated across every pipeline stage.
   */
  output_tokens: number;
}

export interface DreamCreateParams {
  /**
   * Body param
   */
  inputs: Array<BetaDreamInput>;

  /**
   * Body param: Model identifier and configuration applied to every pipeline stage.
   */
  model: string | BetaDreamModelConfigParam;

  /**
   * Body param
   */
  instructions?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DreamRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DreamListParams extends PageCursorParams {
  /**
   * Query param: Return dreams with `created_at` strictly after this timestamp
   * (exclusive lower bound, RFC 3339). Unset applies no lower bound.
   */
  'created_at[gt]'?: string;

  /**
   * Query param: Return dreams with `created_at` strictly before this timestamp
   * (exclusive upper bound, RFC 3339). Unset applies no upper bound.
   */
  'created_at[lt]'?: string;

  /**
   * Query param: Query parameter for include_archived
   */
  include_archived?: boolean;

  /**
   * Query param: Filter by lifecycle status. Repeat the parameter to match any of
   * multiple statuses. Empty applies no status filter.
   */
  statuses?: Array<BetaDreamStatus>;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DreamArchiveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DreamCancelParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Dreams {
  export {
    type BetaDream as BetaDream,
    type BetaDreamError as BetaDreamError,
    type BetaDreamInput as BetaDreamInput,
    type BetaDreamMemoryStoreInput as BetaDreamMemoryStoreInput,
    type BetaDreamMemoryStoreOutput as BetaDreamMemoryStoreOutput,
    type BetaDreamModelConfig as BetaDreamModelConfig,
    type BetaDreamModelConfigParam as BetaDreamModelConfigParam,
    type BetaDreamOutput as BetaDreamOutput,
    type BetaDreamSessionsInput as BetaDreamSessionsInput,
    type BetaDreamStatus as BetaDreamStatus,
    type BetaDreamUsage as BetaDreamUsage,
    type BetaDreamsPageCursor as BetaDreamsPageCursor,
    type DreamCreateParams as DreamCreateParams,
    type DreamRetrieveParams as DreamRetrieveParams,
    type DreamListParams as DreamListParams,
    type DreamArchiveParams as DreamArchiveParams,
    type DreamCancelParams as DreamCancelParams,
  };
}
