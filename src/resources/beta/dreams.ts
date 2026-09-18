import { APIResource } from '../../core/resource';
import * as BetaAPI from './beta';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Dreams extends APIResource {
  /**
   * Start an asynchronous job that uses past sessions to produce a reorganized
   * version of a memory store and get back the dream to poll for the result.
   *
   * By default the dream writes its result to a new memory store and doesn't change
   * the input memory store. The response has `status` set to `pending` and an empty
   * `outputs` array. Poll the dream until `status` is `completed`, `failed`, or
   * `canceled`.
   *
   * See the
   * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#create-a-dream)
   * to learn more about creating dreams.
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
    const { betas, workspace_id, ...body } = params;
    return this._client.post('/v1/dreams?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'dreaming-2026-04-21'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * Get a dream by ID to check its status, output memory store, and token usage.
   *
   * Archived dreams are returned too.
   *
   * See the
   * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#track-progress)
   * for how to poll a dream and what each status means.
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
    const { betas, workspace_id } = params ?? {};
    return this._client.get(path`/v1/dreams/${dreamID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'dreaming-2026-04-21'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * List the dreams in the workspace, newest first.
   *
   * Archived dreams are left out unless `include_archived` is `true`.
   *
   * See the
   * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#list-dreams)
   * for how to page through dreams.
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
    const { betas, workspace_id, ...query } = params ?? {};
    return this._client.getAPIList('/v1/dreams?beta=true', PageCursor<BetaDream>, {
      query,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'dreaming-2026-04-21'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * Hide a `completed`, `failed`, or `canceled` dream from the default list of
   * dreams.
   *
   * Archiving a `pending` or `running` dream returns a 400 error, so cancel it
   * first. Archiving an archived dream returns it unchanged. An archived dream can
   * still be fetched by ID. Archiving can't be undone.
   *
   * See the
   * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#archive-a-dream)
   * to learn more about archiving dreams.
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
    const { betas, workspace_id } = params ?? {};
    return this._client.post(path`/v1/dreams/${dreamID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'dreaming-2026-04-21'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * Stop a `pending` or `running` dream.
   *
   * The response shows `status` as `canceled`, unless the dream reached `completed`
   * or `failed` first. `usage` can keep changing after the response. Canceling a
   * `canceled` dream returns it unchanged. Canceling a `completed` or `failed` dream
   * returns a 400 error.
   *
   * See the
   * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#cancel-a-dream)
   * to learn more about canceling dreams.
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
    const { betas, workspace_id } = params ?? {};
    return this._client.post(path`/v1/dreams/${dreamID}/cancel?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'dreaming-2026-04-21'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }
}

export type BetaDreamsPageCursor = PageCursor<BetaDream>;

/**
 * An asynchronous memory-consolidation job that reads a memory store plus a set of
 * session transcripts and writes consolidated memories into an output memory store
 * — a new store by default, or an existing store chosen via output_behavior. The
 * Dreams API is in research preview: the request and response shapes are volatile
 * and may change without the deprecation period that applies to
 * generally-available endpoints.
 */
export interface BetaDream {
  /**
   * The unique ID of the dream (`drm_...`).
   */
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

  /**
   * The sources that the dream reads, from the request that created it.
   */
  inputs: Array<BetaDreamInput>;

  /**
   * The guidance given when the dream was created, or `null` if none was given.
   */
  instructions: string | null;

  /**
   * Model identifier and configuration applied to every pipeline stage. Same wire
   * shape as the Agents API ModelConfig.
   */
  model: BetaDreamModelConfig;

  /**
   * Which memory store a dream writes its result to. Defaults to `create_new` when
   * left out of a create request.
   */
  output_behavior: BetaOutputBehavior;

  /**
   * The memory store that holds the dream's result, as a one-item array, or an empty
   * array until the dream records that memory store.
   *
   * The array is empty while the dream is `pending` and for a short time after it
   * starts `running`. It can stay empty if the dream fails or is canceled before
   * then. The memory store holds the complete result only once `status` is
   * `completed`.
   *
   * See the
   * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#use-the-output)
   * for how to review and use the result.
   */
  outputs: Array<BetaDreamOutput>;

  /**
   * The ID of the session that runs the dream (`sesn_...`), or `null` if that
   * session hasn't started.
   *
   * Stream that session's events to follow what the dream reads and writes.
   *
   * See the
   * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#watch-the-pipeline-run)
   * for how to watch a running dream.
   */
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
  /**
   * A human-readable explanation of why the dream failed.
   */
  message: string;

  /**
   * A code for why the dream failed, such as `timeout` or `internal_error`.
   *
   * The
   * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#errors)
   * lists common error codes and when they occur.
   */
  type: string;
}

/**
 * A source that a dream reads, such as a memory store or a set of sessions.
 */
export type BetaDreamInput = BetaDreamMemoryStoreInput | BetaDreamSessionsInput;

/**
 * An input memory store the dream reads from. The dream never mutates this store
 * unless it is also the destination: with output_behavior {type:
 * "update_existing"} the job consolidates this store in place.
 */
export interface BetaDreamMemoryStoreInput {
  /**
   * The ID of the memory store for the dream to read (`memstore_...`).
   *
   * The memory store must be in the same workspace as the dream and must not be
   * archived.
   */
  memory_store_id: string;

  type: 'memory_store';
}

/**
 * An output memory store the dream writes consolidated memories into.
 */
export interface BetaDreamMemoryStoreOutput {
  /**
   * The ID of the memory store that the dream writes its result to (`memstore_...`).
   *
   * With `output_behavior` set to `create_new`, this is a new memory store. With
   * `update_existing`, it is the input memory store.
   */
  memory_store_id: string;

  type: 'memory_store';
}

/**
 * Model identifier and configuration applied to every pipeline stage. Same wire
 * shape as the Agents API ModelConfig.
 */
export interface BetaDreamModelConfig {
  /**
   * Model identifier, e.g. "claude-opus-5". 1-256 characters.
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
   * Model identifier, e.g. "claude-opus-5". 1-256 characters.
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
  /**
   * The ID of the memory store that the dream writes its result to (`memstore_...`).
   *
   * With `output_behavior` set to `create_new`, this is a new memory store. With
   * `update_existing`, it is the input memory store.
   */
  memory_store_id: string;

  type: 'memory_store';
}

/**
 * Input session transcripts the dream reads.
 */
export interface BetaDreamSessionsInput {
  /**
   * The IDs of the sessions whose transcripts the dream reads (`sesn_...`).
   *
   * Give 1 to 100 IDs, with no duplicates. Each session must be in the same
   * workspace as the dream. Responses list the IDs in sorted order.
   *
   * The
   * [limits table in the Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#limits)
   * lists all the limits on a dream.
   */
  session_ids: Array<string>;

  type: 'sessions';
}

/**
 * Lifecycle status of a Dream.
 *
 * - `pending` - The dream is waiting to start and hasn't read its inputs yet.
 *
 *   `outputs` is empty and every `usage` count is zero.
 *
 * - `running` - The dream is reading its inputs and writing its result.
 *
 *   `usage` updates while the dream has this status.
 *
 * - `completed` - The dream finished and its output memory store holds the
 *   complete result.
 * - `failed` - The dream stopped with an error, which `error` describes.
 *
 *   If `outputs` references a memory store, that memory store keeps what the dream
 *   wrote before it stopped.
 *
 * - `canceled` - The caller canceled the dream before it completed.
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

export type BetaDreamingError =
  | BetaAPI.BetaInvalidRequestError
  | BetaAPI.BetaAuthenticationError
  | BetaAPI.BetaBillingError
  | BetaAPI.BetaPermissionError
  | BetaAPI.BetaNotFoundError
  | BetaAPI.BetaRateLimitError
  | BetaAPI.BetaGatewayTimeoutError
  | BetaAPI.BetaAPIError
  | BetaAPI.BetaOverloadedError
  | BetaTargetStoreHeldError;

/**
 * Which memory store a dream writes its result to. Defaults to `create_new` when
 * left out of a create request.
 */
export type BetaOutputBehavior = BetaOutputBehaviorCreateNew | BetaOutputBehaviorUpdateExisting;

/**
 * The default destination: the job creates a new output memory store as a clone of
 * the memory_store input and writes the consolidated memories into it. The input
 * store is never mutated.
 */
export interface BetaOutputBehaviorCreateNew {
  type: 'create_new';
}

/**
 * The job writes the consolidated memories into this existing memory store instead
 * of creating one. In EAP the store must be the job's own memory_store input, so
 * the job consolidates the store in place.
 */
export interface BetaOutputBehaviorUpdateExisting {
  /**
   * The ID of the memory store for the dream to write its result to
   * (`memstore_...`). It must be the memory store in the `memory_store` entry of
   * `inputs`.
   */
  memory_store_id: string;

  type: 'update_existing';
}

/**
 * The `output_behavior.memory_store_id` target is still held by a prior
 * `{type: "update_existing"}` dream — one that is `pending` or `running`, or was
 * canceled with its final writes still landing. Rarely the named dream has just
 * finished (`completed`/`failed`) and its execution is still closing; an immediate
 * retry then almost always succeeds. The message names the holding dream when the
 * server can identify it (rarely omitted); poll it to a terminal state or cancel
 * it, then retry. Carried with `x-should-retry: false`.
 */
export interface BetaTargetStoreHeldError {
  type: 'conflict_error';

  /**
   * Human-readable description of the conflict, naming the dream that holds the
   * target store when the server can identify it.
   */
  message?: string;
}

export interface DreamCreateParams {
  /**
   * Body param: The memory store and sessions for the dream to read, as exactly one
   * `memory_store` entry and exactly one `sessions` entry.
   */
  inputs: Array<BetaDreamInput>;

  /**
   * Body param: The model that runs a dream, given as a model ID or as an object
   * with `id` and `speed`.
   *
   * In the object form, `speed` can only be `standard`.
   *
   * The
   * [limits table in the Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#limits)
   * lists the supported models.
   */
  model: string | BetaDreamModelConfigParam;

  /**
   * Body param: Guidance that steers how the dream reads the sessions and organizes
   * the output memory store, from 1 to 4,096 characters.
   *
   * See the
   * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#steer-with-instructions)
   * for what kinds of instructions work well.
   */
  instructions?: string | null;

  /**
   * Body param: Which memory store a dream writes its result to. Defaults to
   * `create_new` when left out of a create request.
   */
  output_behavior?: BetaOutputBehavior;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface DreamRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Optional header to select the Workspace for this request. The value is a
   * Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
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
   * Query param: Whether to include archived dreams. Defaults to `false`.
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

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface DreamArchiveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Optional header to select the Workspace for this request. The value is a
   * Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface DreamCancelParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Optional header to select the Workspace for this request. The value is a
   * Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
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
    type BetaDreamingError as BetaDreamingError,
    type BetaOutputBehavior as BetaOutputBehavior,
    type BetaOutputBehaviorCreateNew as BetaOutputBehaviorCreateNew,
    type BetaOutputBehaviorUpdateExisting as BetaOutputBehaviorUpdateExisting,
    type BetaTargetStoreHeldError as BetaTargetStoreHeldError,
    type BetaDreamsPageCursor as BetaDreamsPageCursor,
    type DreamCreateParams as DreamCreateParams,
    type DreamRetrieveParams as DreamRetrieveParams,
    type DreamListParams as DreamListParams,
    type DreamArchiveParams as DreamArchiveParams,
    type DreamCancelParams as DreamCancelParams,
  };
}
