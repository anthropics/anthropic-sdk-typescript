import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

export class Memories extends APIResource {
  /**
   * Create a Memory
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemory =
   *   await client.beta.memoryStores.memories.create(
   *     'memory_store_id',
   *     { content: 'content', path: 'xx' },
   *   );
   * ```
   */
  create(
    memoryStoreID: string,
    params: MemoryCreateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsMemory> {
    const { view, betas, workspace_id, ...body } = params;
    return this._client.post(path`/v1/memory_stores/${memoryStoreID}/memories?beta=true`, {
      query: { view },
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.memory_stores.memories.create', options, {
        route: '/v1/memory_stores/{memory_store_id}/memories',
        queryParams: ['view'],
        attributes: { 'gen_ai.memory.store.id': memoryStoreID },
        createdIDAttribute: 'gen_ai.memory.record.id',
      }),
    });
  }

  /**
   * Retrieve a Memory
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemory =
   *   await client.beta.memoryStores.memories.retrieve(
   *     'memory_id',
   *     { memory_store_id: 'memory_store_id' },
   *   );
   * ```
   */
  retrieve(
    memoryID: string,
    params: MemoryRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsMemory> {
    const { memory_store_id, betas, workspace_id, ...query } = params;
    return this._client.get(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.memory_stores.memories.retrieve', options, {
        route: '/v1/memory_stores/{memory_store_id}/memories/{memory_id}',
        queryParams: ['view'],
        attributes: { 'gen_ai.memory.store.id': memory_store_id, 'gen_ai.memory.record.id': memoryID },
      }),
    });
  }

  /**
   * Update a Memory
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemory =
   *   await client.beta.memoryStores.memories.update(
   *     'memory_id',
   *     { memory_store_id: 'memory_store_id' },
   *   );
   * ```
   */
  update(
    memoryID: string,
    params: MemoryUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsMemory> {
    const { memory_store_id, view, betas, workspace_id, ...body } = params;
    return this._client.post(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
      query: { view },
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.memory_stores.memories.update', options, {
        route: '/v1/memory_stores/{memory_store_id}/memories/{memory_id}',
        queryParams: ['view'],
        attributes: { 'gen_ai.memory.store.id': memory_store_id, 'gen_ai.memory.record.id': memoryID },
      }),
    });
  }

  /**
   * List Memories
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsMemoryListItem of client.beta.memoryStores.memories.list(
   *   'memory_store_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    memoryStoreID: string,
    params: MemoryListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsMemoryListItemsPageCursor, BetaManagedAgentsMemoryListItem> {
    const { betas, workspace_id, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/memory_stores/${memoryStoreID}/memories?beta=true`,
      PageCursor<BetaManagedAgentsMemoryListItem>,
      {
        query,
        ...options,
        headers: buildHeaders([
          {
            'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
            ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
          },
          options?.headers,
        ]),
        __span: startApiCallSpan(this._client, 'anthropic.memory_stores.memories.list', options, {
          route: '/v1/memory_stores/{memory_store_id}/memories',
          queryParams: ['depth', 'limit', 'page', 'path_prefix', 'view'],
          contentQueryParams: ['page'],
          attributes: { 'gen_ai.memory.store.id': memoryStoreID },
        }),
      },
    );
  }

  /**
   * Delete a Memory
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeletedMemory =
   *   await client.beta.memoryStores.memories.delete(
   *     'memory_id',
   *     { memory_store_id: 'memory_store_id' },
   *   );
   * ```
   */
  delete(
    memoryID: string,
    params: MemoryDeleteParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeletedMemory> {
    const { memory_store_id, expected_content_sha256, betas, workspace_id } = params;
    return this._client.delete(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
      query: { expected_content_sha256 },
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.memory_stores.memories.delete', options, {
        route: '/v1/memory_stores/{memory_store_id}/memories/{memory_id}',
        queryParams: ['expected_content_sha256'],
        attributes: { 'gen_ai.memory.store.id': memory_store_id, 'gen_ai.memory.record.id': memoryID },
      }),
    });
  }
}

export type BetaManagedAgentsMemoryListItemsPageCursor = PageCursor<BetaManagedAgentsMemoryListItem>;

export interface BetaManagedAgentsConflictError {
  type: 'conflict_error';

  message?: string;
}

/**
 * A precondition that applies an update only if the memory's current content has
 * the hash in `content_sha256`.
 *
 * If the hashes differ, the request fails with HTTP status 409. Retrieve the
 * memory and retry. If the memory already has exactly the requested `content` and
 * `path`, the request succeeds even though the hashes differ.
 */
export interface BetaManagedAgentsContentSha256Precondition {
  type: 'content_sha256';

  /**
   * Expected `content_sha256` of the stored memory (64 lowercase hexadecimal
   * characters). Typically the `content_sha256` returned by a prior read or list
   * call. Because the server applies no content normalization, clients can also
   * compute this locally as the SHA-256 of the UTF-8 content bytes.
   */
  content_sha256?: string;
}

/**
 * The confirmation that
 * [Delete a Memory](https://platform.claude.com/docs/en/api/beta/memory_stores/memories/delete)
 * returns.
 *
 * Deleting a memory doesn't delete its versions.
 * [List Memory Versions](https://platform.claude.com/docs/en/api/beta/memory_stores/memory_versions/list)
 * returns them while they are retained: each version is kept for at least the
 * version retention period after it was written, unless the store itself is
 * deleted.
 *
 * See the
 * [memory guide](https://platform.claude.com/docs/en/managed-agents/memory#audit-memory-changes)
 * to learn more about how long versions are kept.
 */
export interface BetaManagedAgentsDeletedMemory {
  /**
   * ID of the deleted memory (a `mem_...` value).
   */
  id: string;

  type: 'memory_deleted';
}

export type BetaManagedAgentsError =
  | BetaAPI.BetaInvalidRequestError
  | BetaAPI.BetaAuthenticationError
  | BetaAPI.BetaBillingError
  | BetaAPI.BetaPermissionError
  | BetaAPI.BetaNotFoundError
  | BetaAPI.BetaRateLimitError
  | BetaAPI.BetaGatewayTimeoutError
  | BetaAPI.BetaAPIError
  | BetaAPI.BetaOverloadedError
  | BetaManagedAgentsMemoryPreconditionFailedError
  | BetaManagedAgentsMemoryPathConflictError
  | BetaManagedAgentsConflictError;

/**
 * A text document at a path inside a memory store.
 *
 * `content` is `null` when the response uses `view=basic`. `content_size_bytes`
 * and `content_sha256` are always set, so you can detect changes without fetching
 * the content. To retrieve, update, or delete a memory, pass its ID, which stays
 * the same when its path changes.
 *
 * See the
 * [memory guide](https://platform.claude.com/docs/en/managed-agents/memory#view-and-edit-memories)
 * to learn more about working with memories.
 */
export interface BetaManagedAgentsMemory {
  /**
   * The unique ID of the memory (`mem_...`). It stays the same when the memory's
   * path changes.
   *
   * To retrieve, update, or delete the memory, pass this ID.
   */
  id: string;

  /**
   * Lowercase hex SHA-256 digest of the UTF-8 `content` bytes (64 characters). The
   * server applies no normalization, so clients can compute the same hash locally
   * for staleness checks and as the value for a `content_sha256` precondition on
   * update. Always populated, regardless of `view`.
   */
  content_sha256: string;

  /**
   * The size of the memory's `content` in UTF-8 bytes. It is set regardless of
   * `view`.
   */
  content_size_bytes: number;

  /**
   * When this memory was created, in RFC 3339 format.
   */
  created_at: string;

  /**
   * ID of the memory store this memory belongs to (a `memstore_...` value).
   */
  memory_store_id: string;

  /**
   * The ID of the memory version that holds the memory's current content
   * (`memver_...`).
   *
   * Memory versions don't have a flag that marks the latest one. Compare their IDs
   * with this field instead.
   *
   * See the
   * [memory guide](https://platform.claude.com/docs/en/managed-agents/memory#audit-memory-changes)
   * to learn more about memory versions.
   */
  memory_version_id: string;

  /**
   * Hierarchical path of the memory within the store, e.g. `/projects/foo/notes.md`.
   * Always starts with `/`. Paths are case-sensitive and unique within a store.
   * Maximum 1,024 bytes.
   */
  path: string;

  type: 'memory';

  /**
   * When the memory was last changed, in RFC 3339.
   *
   * To find out who made the change, look at `created_by` on the memory version that
   * `memory_version_id` references.
   */
  updated_at: string;

  /**
   * The memory's UTF-8 text content, or `null` when the response uses `view=basic`.
   *
   * The maximum size is 100 kB (102,400 bytes).
   */
  content?: string | null;
}

/**
 * One item in a
 * [List Memories](https://platform.claude.com/docs/en/api/beta/memory_stores/memories/list)
 * response: a `memory`, or a `memory_prefix` marker when `depth` is `1`.
 */
export type BetaManagedAgentsMemoryListItem = BetaManagedAgentsMemory | BetaManagedAgentsMemoryPrefix;

/**
 * The error returned with HTTP status 409 when you create or rename a memory and
 * the path you give is already used by another memory or overlaps another memory's
 * path.
 *
 * Two paths overlap when one is an ancestor of the other, such as `/notes` and
 * `/notes/todo.md`. To free the path, rename or delete the memory that
 * `conflicting_memory_id` references, then retry. To change that memory instead of
 * creating a new one, update it.
 */
export interface BetaManagedAgentsMemoryPathConflictError {
  type: 'memory_path_conflict_error';

  /**
   * The ID of the memory that blocked the write (`mem_...`), or an empty string if
   * that memory can't be identified.
   *
   * Retry the request when it is empty.
   */
  conflicting_memory_id?: string;

  /**
   * The path that blocked the write: the requested path, or the path of a memory
   * that is an ancestor or descendant of it.
   */
  conflicting_path?: string;

  /**
   * A human-readable explanation of the conflict. To handle the error in code, use
   * `conflicting_path` and `conflicting_memory_id` instead.
   */
  message?: string;
}

/**
 * The error returned with HTTP status 409 when a request's precondition doesn't
 * hold for the memory's current state, such as `precondition` on an update or
 * `expected_content_sha256` on a delete.
 *
 * The error doesn't include the memory's current state. Retrieve the memory to see
 * its current content and `content_sha256` before you retry.
 *
 * See the
 * [memory guide](https://platform.claude.com/docs/en/managed-agents/memory#safe-content-edits-optimistic-concurrency)
 * to learn more about safe content edits with content hash preconditions.
 */
export interface BetaManagedAgentsMemoryPreconditionFailedError {
  type: 'memory_precondition_failed_error';

  /**
   * A human-readable explanation of why the precondition failed.
   */
  message?: string;
}

/**
 * A directory marker that
 * [List Memories](https://platform.claude.com/docs/en/api/beta/memory_stores/memories/list)
 * returns instead of the memories below the requested `depth`.
 *
 * It stands for one or more memories whose paths start with `path`. It isn't a
 * stored object and doesn't have an ID. Each marker counts toward the page
 * `limit`.
 */
export interface BetaManagedAgentsMemoryPrefix {
  /**
   * The rolled-up path prefix, including a trailing `/` (e.g. `/projects/foo/`).
   * Pass this value as `path_prefix` on a subsequent list call to drill into the
   * directory.
   */
  path: string;

  type: 'memory_prefix';
}

/**
 * Whether a `memory` or `memory_version` in the response includes its `content`.
 * Defaults to `full` on retrieve operations and to `basic` on list, create, and
 * update operations.
 *
 * With `full`, list operations return at most 20 items per page.
 *
 * - `basic` - Return the object with `content` set to `null`. The
 *   `content_size_bytes` and `content_sha256` fields remain populated, so sync
 *   clients can diff without fetching content.
 * - `full` - Return the object with `content` populated. On list endpoints,
 *   `view=full` caps `limit` at 20.
 */
export type BetaManagedAgentsMemoryView = 'basic' | 'full';

/**
 * Optional condition that must hold for an update to apply. When omitted, the
 * update is unconditional. Asserts the current state of the memory being updated.
 * When an update changes `path`, the precondition still refers to the memory's
 * current content, not the destination path. Currently the only supported variant
 * is `content_sha256`.
 */
export interface BetaManagedAgentsPrecondition {
  type: 'content_sha256';

  /**
   * Expected `content_sha256` of the stored memory (64 lowercase hexadecimal
   * characters). Typically the `content_sha256` returned by a prior read or list
   * call. Because the server applies no content normalization, clients can also
   * compute this locally as the SHA-256 of the UTF-8 content bytes.
   */
  content_sha256?: string;
}

export interface MemoryCreateParams {
  /**
   * Body param: The UTF-8 text content of the new memory. Pass `""` to create an
   * empty memory.
   *
   * The maximum size is 100 kB (102,400 bytes).
   */
  content: string | null;

  /**
   * Body param: The path of the new memory, such as `/projects/foo/notes.md`. Paths
   * are case-sensitive.
   *
   * A path starts with `/` and has 1 to 20 segments. A segment can't be empty and
   * can't be `.` or `..`. A path can't contain control characters, format
   * characters, or the line and paragraph separators U+2028 and U+2029. It must be
   * in Unicode Normalization Form C and at most 1,024 bytes long.
   */
  path: string;

  /**
   * Query param: Whether a `memory` or `memory_version` in the response includes its
   * `content`. Defaults to `full` on retrieve operations and to `basic` on list,
   * create, and update operations.
   *
   * With `full`, list operations return at most 20 items per page.
   */
  view?: BetaManagedAgentsMemoryView;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `agent-memory-2026-07-22` or `managed-agents-2026-04-01` in this header.
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

export interface MemoryRetrieveParams {
  /**
   * Path param: The ID of the memory store that holds the memory (`memstore_...`).
   */
  memory_store_id: string;

  /**
   * Query param: Whether a `memory` or `memory_version` in the response includes its
   * `content`. Defaults to `full` on retrieve operations and to `basic` on list,
   * create, and update operations.
   *
   * With `full`, list operations return at most 20 items per page.
   */
  view?: BetaManagedAgentsMemoryView;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `agent-memory-2026-07-22` or `managed-agents-2026-04-01` in this header.
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

export interface MemoryUpdateParams {
  /**
   * Path param: The ID of the memory store that holds the memory (`memstore_...`).
   */
  memory_store_id: string;

  /**
   * Query param: Whether a `memory` or `memory_version` in the response includes its
   * `content`. Defaults to `full` on retrieve operations and to `basic` on list,
   * create, and update operations.
   *
   * With `full`, list operations return at most 20 items per page.
   */
  view?: BetaManagedAgentsMemoryView;

  /**
   * Body param: New UTF-8 text content for the memory. Maximum 100 kB (102,400
   * bytes). Omit to leave the content unchanged (e.g., for a rename-only update).
   */
  content?: string | null;

  /**
   * Body param: The new path of the memory, which renames it. Omit it to keep the
   * current path.
   *
   * The memory keeps its `id`. A path starts with `/` and has 1 to 20 segments. A
   * segment can't be empty and can't be `.` or `..`. A path can't contain control
   * characters, format characters, or the line and paragraph separators U+2028 and
   * U+2029. It must be in Unicode Normalization Form C and at most 1,024 bytes long.
   * Paths are case-sensitive.
   */
  path?: string | null;

  /**
   * Body param: The condition that the memory must meet for the update to apply.
   * Omit it to update unconditionally.
   *
   * If the condition fails, the request fails with HTTP status 409.
   */
  precondition?: BetaManagedAgentsPrecondition;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `agent-memory-2026-07-22` or `managed-agents-2026-04-01` in this header.
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

export interface MemoryListParams extends PageCursorParams {
  /**
   * Query param: How far below `path_prefix` to list. Defaults to `0`, which lists
   * every memory below the prefix.
   *
   * Pass `1` to list only the direct children. Deeper memories are then grouped into
   * `memory_prefix` items.
   */
  depth?: number;

  /**
   * Query param: Return only memories whose path starts with this prefix, such as
   * `/notes/`. This value appears in request URLs. Do not include secrets or
   * personally identifiable information.
   *
   * Omit it to list the whole store. The prefix must end with `/` and matches whole
   * segments, so `/notes/` matches `/notes/todo.md` but not
   * `/notes-archive/todo.md`.
   */
  path_prefix?: string;

  /**
   * Query param: Whether each memory in the response includes `content`. Defaults to
   * `basic`, which sets it to `null`.
   *
   * With `full`, a page holds at most 20 items.
   */
  view?: BetaManagedAgentsMemoryView;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `agent-memory-2026-07-22` or `managed-agents-2026-04-01` in this header.
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

export interface MemoryDeleteParams {
  /**
   * Path param: The ID of the memory store that holds the memory (`memstore_...`).
   */
  memory_store_id: string;

  /**
   * Query param: Delete the memory only if its current `content_sha256` equals this
   * value, given as 64 lowercase hexadecimal characters. Omit it to delete
   * unconditionally.
   *
   * If the hashes differ, the request fails with HTTP status 409 and nothing is
   * deleted.
   */
  expected_content_sha256?: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `agent-memory-2026-07-22` or `managed-agents-2026-04-01` in this header.
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

export declare namespace Memories {
  export {
    type BetaManagedAgentsConflictError as BetaManagedAgentsConflictError,
    type BetaManagedAgentsContentSha256Precondition as BetaManagedAgentsContentSha256Precondition,
    type BetaManagedAgentsDeletedMemory as BetaManagedAgentsDeletedMemory,
    type BetaManagedAgentsError as BetaManagedAgentsError,
    type BetaManagedAgentsMemory as BetaManagedAgentsMemory,
    type BetaManagedAgentsMemoryListItem as BetaManagedAgentsMemoryListItem,
    type BetaManagedAgentsMemoryPathConflictError as BetaManagedAgentsMemoryPathConflictError,
    type BetaManagedAgentsMemoryPreconditionFailedError as BetaManagedAgentsMemoryPreconditionFailedError,
    type BetaManagedAgentsMemoryPrefix as BetaManagedAgentsMemoryPrefix,
    type BetaManagedAgentsMemoryView as BetaManagedAgentsMemoryView,
    type BetaManagedAgentsPrecondition as BetaManagedAgentsPrecondition,
    type BetaManagedAgentsMemoryListItemsPageCursor as BetaManagedAgentsMemoryListItemsPageCursor,
    type MemoryCreateParams as MemoryCreateParams,
    type MemoryRetrieveParams as MemoryRetrieveParams,
    type MemoryUpdateParams as MemoryUpdateParams,
    type MemoryListParams as MemoryListParams,
    type MemoryDeleteParams as MemoryDeleteParams,
  };
}
