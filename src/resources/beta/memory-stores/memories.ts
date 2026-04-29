// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Memories extends APIResource {
  /**
   * Create a memory
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
    const { view, betas, ...body } = params;
    return this._client.post(path`/v1/memory_stores/${memoryStoreID}/memories?beta=true`, {
      query: { view },
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Retrieve a memory
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
    const { memory_store_id, betas, ...query } = params;
    return this._client.get(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Update a memory
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
    const { memory_store_id, view, betas, ...body } = params;
    return this._client.post(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
      query: { view },
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List memories
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
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/memory_stores/${memoryStoreID}/memories?beta=true`,
      PageCursor<BetaManagedAgentsMemoryListItem>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
          options?.headers,
        ]),
      },
    );
  }

  /**
   * Delete a memory
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
    const { memory_store_id, expected_content_sha256, betas } = params;
    return this._client.delete(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
      query: { expected_content_sha256 },
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaManagedAgentsMemoryListItemsPageCursor = PageCursor<BetaManagedAgentsMemoryListItem>;

export interface BetaManagedAgentsConflictError {
  type: 'conflict_error';

  message?: string;
}

/**
 * Optimistic-concurrency precondition: the update applies only if the memory's
 * stored `content_sha256` equals the supplied value. On mismatch, the request
 * returns `memory_precondition_failed_error` (HTTP 409); re-read the memory and
 * retry against the fresh state. If the precondition fails but the stored state
 * already exactly matches the requested `content` and `path`, the server returns
 * 200 instead of 409.
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
 * Tombstone returned by
 * [Delete a memory](/en/api/beta/memory_stores/memories/delete). The memory's
 * version history persists and remains listable via
 * [List memory versions](/en/api/beta/memory_stores/memory_versions/list) until
 * the store itself is deleted.
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
 * A `memory` object: a single text document at a hierarchical path inside a memory
 * store. The `content` field is populated when `view=full` and `null` when
 * `view=basic`; the `content_size_bytes` and `content_sha256` fields are always
 * populated so sync clients can diff without fetching content. Memories are
 * addressed by their `mem_...` ID; the path is the create key and can be changed
 * via update.
 */
export interface BetaManagedAgentsMemory {
  /**
   * Unique identifier for this memory (a `mem_...` value). Stable across renames;
   * use this ID, not the path, to read, update, or delete the memory.
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
   * Size of `content` in bytes (the UTF-8 plaintext length). Always populated,
   * regardless of `view`.
   */
  content_size_bytes: number;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  /**
   * ID of the memory store this memory belongs to (a `memstore_...` value).
   */
  memory_store_id: string;

  /**
   * ID of the `memory_version` representing this memory's current content (a
   * `memver_...` value). This is the authoritative head pointer; `memory_version`
   * objects do not carry an `is_latest` flag, so compare against this field instead.
   * Enumerate the full history via
   * [List memory versions](/en/api/beta/memory_stores/memory_versions/list).
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
   * A timestamp in RFC 3339 format
   */
  updated_at: string;

  /**
   * The memory's UTF-8 text content. Populated when `view=full`; `null` when
   * `view=basic`. Maximum 100 kB (102,400 bytes).
   */
  content?: string | null;
}

/**
 * One item in a [List memories](/en/api/beta/memory_stores/memories/list)
 * response: either a `memory` object or, when `depth` is set, a `memory_prefix`
 * rollup marker.
 */
export type BetaManagedAgentsMemoryListItem = BetaManagedAgentsMemory | BetaManagedAgentsMemoryPrefix;

export interface BetaManagedAgentsMemoryPathConflictError {
  type: 'memory_path_conflict_error';

  conflicting_memory_id?: string;

  conflicting_path?: string;

  message?: string;
}

export interface BetaManagedAgentsMemoryPreconditionFailedError {
  type: 'memory_precondition_failed_error';

  message?: string;
}

/**
 * A rolled-up directory marker returned by
 * [List memories](/en/api/beta/memory_stores/memories/list) when `depth` is set.
 * Indicates that one or more memories exist deeper than the requested depth under
 * this prefix. This is a list-time rollup, not a stored resource; it has no ID and
 * no lifecycle. Each prefix counts toward the page `limit` and interleaves with
 * `memory` items in path order.
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
 * Selects which projection of a `memory` or `memory_version` the server returns.
 * `basic` returns the object with `content` set to `null`; `full` populates
 * `content`. When omitted, the default is endpoint-specific: retrieve operations
 * default to `full`; list, create, and update operations default to `basic`.
 * Listing with `view=full` caps `limit` at 20.
 */
export type BetaManagedAgentsMemoryView = 'basic' | 'full';

/**
 * Optimistic-concurrency precondition: the update applies only if the memory's
 * stored `content_sha256` equals the supplied value. On mismatch, the request
 * returns `memory_precondition_failed_error` (HTTP 409); re-read the memory and
 * retry against the fresh state. If the precondition fails but the stored state
 * already exactly matches the requested `content` and `path`, the server returns
 * 200 instead of 409.
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
   * Body param: UTF-8 text content for the new memory. Maximum 100 kB (102,400
   * bytes). Required; pass `""` explicitly to create an empty memory.
   */
  content: string | null;

  /**
   * Body param: Hierarchical path for the new memory, e.g. `/projects/foo/notes.md`.
   * Must start with `/`, contain at least one non-empty segment, and be at most
   * 1,024 bytes. Must not contain empty segments, `.` or `..` segments, control or
   * format characters, and must be NFC-normalized. Paths are case-sensitive.
   */
  path: string;

  /**
   * Query param: Query parameter for view
   */
  view?: BetaManagedAgentsMemoryView;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface MemoryRetrieveParams {
  /**
   * Path param: Path parameter memory_store_id
   */
  memory_store_id: string;

  /**
   * Query param: Query parameter for view
   */
  view?: BetaManagedAgentsMemoryView;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface MemoryUpdateParams {
  /**
   * Path param: Path parameter memory_store_id
   */
  memory_store_id: string;

  /**
   * Query param: Query parameter for view
   */
  view?: BetaManagedAgentsMemoryView;

  /**
   * Body param: New UTF-8 text content for the memory. Maximum 100 kB (102,400
   * bytes). Omit to leave the content unchanged (e.g., for a rename-only update).
   */
  content?: string | null;

  /**
   * Body param: New path for the memory (a rename). Must start with `/`, contain at
   * least one non-empty segment, and be at most 1,024 bytes. Must not contain empty
   * segments, `.` or `..` segments, control or format characters, and must be
   * NFC-normalized. Paths are case-sensitive. The memory's `id` is preserved across
   * renames. Omit to leave the path unchanged.
   */
  path?: string | null;

  /**
   * Body param: Optimistic-concurrency precondition: the update applies only if the
   * memory's stored `content_sha256` equals the supplied value. On mismatch, the
   * request returns `memory_precondition_failed_error` (HTTP 409); re-read the
   * memory and retry against the fresh state. If the precondition fails but the
   * stored state already exactly matches the requested `content` and `path`, the
   * server returns 200 instead of 409.
   */
  precondition?: BetaManagedAgentsPrecondition;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface MemoryListParams extends PageCursorParams {
  /**
   * Query param: Query parameter for depth
   */
  depth?: number;

  /**
   * Query param: Query parameter for order
   */
  order?: 'asc' | 'desc';

  /**
   * Query param: Query parameter for order_by
   */
  order_by?: string;

  /**
   * Query param: Optional path prefix filter (raw string-prefix match; include a
   * trailing slash for directory-scoped lists). This value appears in request URLs.
   * Do not include secrets or personally identifiable information.
   */
  path_prefix?: string;

  /**
   * Query param: Query parameter for view
   */
  view?: BetaManagedAgentsMemoryView;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface MemoryDeleteParams {
  /**
   * Path param: Path parameter memory_store_id
   */
  memory_store_id: string;

  /**
   * Query param: Query parameter for expected_content_sha256
   */
  expected_content_sha256?: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
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
