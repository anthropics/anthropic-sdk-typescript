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
 * An asynchronous job that reads a memory store and past sessions, then writes a
 * reorganized version of that memory store.
 *
 * By default the dream writes its result to a new memory store and doesn't change
 * the input memory store. With `output_behavior` set to `update_existing`, it
 * writes its result into the input memory store instead. The Dreams API is in
 * research preview, so this resource can still change.
 *
 * See the
 * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#how-it-works)
 * for what a dream reads and produces.
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
   * The model that runs a dream, from the request that created it.
   *
   * The dream uses this model for all of its work. The response always gives the
   * model as an object, even if the request gave only a model ID.
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
   * Where a dream is in its lifecycle.
   *
   * `completed`, `failed`, and `canceled` are final: once a dream has one of these
   * statuses, its status doesn't change again.
   *
   * See the
   * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#lifecycle)
   * for what each status means.
   */
  status: BetaDreamStatus;

  type: 'dream';

  /**
   * The tokens that a dream has used so far.
   *
   * The counts are zero while the dream is `pending` and update while it is
   * `running`. They can keep changing after a cancel.
   *
   * See the
   * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#billing)
   * for how dreams are billed. See the
   * [prompt caching guide](https://platform.claude.com/docs/en/build-with-claude/prompt-caching#tracking-cache-performance)
   * for how the input token counts add up.
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
 * The memory store that a dream reads, given as an entry in `inputs`.
 *
 * With `output_behavior` set to `update_existing`, the dream writes its result
 * into this memory store. Otherwise the dream doesn't change it.
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
 * The memory store that holds a dream's result, as an entry in `outputs`.
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
 * The model that runs a dream, from the request that created it.
 *
 * The dream uses this model for all of its work. The response always gives the
 * model as an object, even if the request gave only a model ID.
 */
export interface BetaDreamModelConfig {
  /**
   * The ID of the model that runs the dream, as given in the request that created
   * it.
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
 * The object form of `model` in a request to create a dream.
 */
export interface BetaDreamModelConfigParam {
  /**
   * The ID of the model to run the dream with.
   *
   * The ID can be 1 to 256 characters long.
   *
   * The
   * [limits table in the Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#limits)
   * lists the supported models.
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
 * The memory store that holds a dream's result, as an entry in `outputs`.
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
 * The sessions that a dream reads, given as an entry in `inputs`.
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
 * Where a dream is in its lifecycle.
 *
 * `completed`, `failed`, and `canceled` are final: once a dream has one of these
 * statuses, its status doesn't change again.
 *
 * See the
 * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#lifecycle)
 * for what each status means.
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
 * - `canceled` - A cancel request stopped the dream before it reached `completed`
 *   or `failed`.
 *
 *   If `outputs` references a memory store, that memory store keeps what the dream
 *   wrote. `usage` can keep changing after the cancel.
 */
export type BetaDreamStatus = 'pending' | 'running' | 'completed' | 'failed' | 'canceled';

/**
 * The tokens that a dream has used so far.
 *
 * The counts are zero while the dream is `pending` and update while it is
 * `running`. They can keep changing after a cancel.
 *
 * See the
 * [Dreams guide](https://platform.claude.com/docs/en/managed-agents/dreams#billing)
 * for how dreams are billed. See the
 * [prompt caching guide](https://platform.claude.com/docs/en/build-with-claude/prompt-caching#tracking-cache-performance)
 * for how the input token counts add up.
 */
export interface BetaDreamUsage {
  /**
   * The dream's input tokens that were written to the prompt cache, for both the
   * 5-minute and 1-hour cache durations.
   */
  cache_creation_input_tokens: number;

  /**
   * The dream's input tokens that were read from the prompt cache.
   */
  cache_read_input_tokens: number;

  /**
   * The dream's input tokens that weren't read from or written to the prompt cache.
   */
  input_tokens: number;

  /**
   * The tokens that the model generated for the dream.
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
 * Write the result to a new memory store that starts as a copy of the input memory
 * store. This is the default.
 *
 * The new memory store is in the same workspace as the dream. The dream doesn't
 * change the input memory store.
 */
export interface BetaOutputBehaviorCreateNew {
  type: 'create_new';
}

/**
 * Write the result into the input memory store instead of a new memory store.
 *
 * The credential must be allowed to write memory stores, or the request returns a
 * 403 error. While another `update_existing` dream on the same memory store hasn't
 * fully stopped, the request returns a 409 error.
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
 * Returned with status 409 when a request to create a dream sets `output_behavior`
 * to `update_existing` and another dream that writes into the same memory store
 * hasn't fully stopped.
 *
 * The other dream is `pending` or `running`, or it has just stopped and is still
 * finishing its last writes. `message` gives the ID of the other dream when the
 * server can identify it. If that dream has already reached `completed`, `failed`,
 * or `canceled`, retry after a short wait. Otherwise, wait for the other dream to
 * end or cancel it, then retry. The response sets the `x-should-retry` header to
 * `false`.
 */
export interface BetaTargetStoreHeldError {
  type: 'conflict_error';

  /**
   * A human-readable explanation of why the memory store can't be used yet, with the
   * ID of the dream that is using it when the server can identify it.
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
   * Query param: Return only dreams created after this time (exclusive), in
   * RFC 3339.
   */
  'created_at[gt]'?: string;

  /**
   * Query param: Return only dreams created before this time (exclusive), in
   * RFC 3339.
   */
  'created_at[lt]'?: string;

  /**
   * Query param: Whether to include archived dreams. Defaults to `false`.
   */
  include_archived?: boolean;

  /**
   * Query param: Return only dreams that have one of these statuses.
   *
   * Repeat the parameter to give more than one status. Leave it out to return dreams
   * of every status.
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
