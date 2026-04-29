// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as MemoriesAPI from './memories';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class MemoryVersions extends APIResource {
  /**
   * Retrieve a memory version
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryVersion =
   *   await client.beta.memoryStores.memoryVersions.retrieve(
   *     'memory_version_id',
   *     { memory_store_id: 'memory_store_id' },
   *   );
   * ```
   */
  retrieve(
    memoryVersionID: string,
    params: MemoryVersionRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsMemoryVersion> {
    const { memory_store_id, betas, ...query } = params;
    return this._client.get(
      path`/v1/memory_stores/${memory_store_id}/memory_versions/${memoryVersionID}?beta=true`,
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
   * List memory versions
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsMemoryVersion of client.beta.memoryStores.memoryVersions.list(
   *   'memory_store_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    memoryStoreID: string,
    params: MemoryVersionListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsMemoryVersionsPageCursor, BetaManagedAgentsMemoryVersion> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/memory_stores/${memoryStoreID}/memory_versions?beta=true`,
      PageCursor<BetaManagedAgentsMemoryVersion>,
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
   * Redact a memory version
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryVersion =
   *   await client.beta.memoryStores.memoryVersions.redact(
   *     'memory_version_id',
   *     { memory_store_id: 'memory_store_id' },
   *   );
   * ```
   */
  redact(
    memoryVersionID: string,
    params: MemoryVersionRedactParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsMemoryVersion> {
    const { memory_store_id, betas } = params;
    return this._client.post(
      path`/v1/memory_stores/${memory_store_id}/memory_versions/${memoryVersionID}/redact?beta=true`,
      {
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
          options?.headers,
        ]),
      },
    );
  }
}

export type BetaManagedAgentsMemoryVersionsPageCursor = PageCursor<BetaManagedAgentsMemoryVersion>;

/**
 * Identifies who performed a write or redact operation. Captured at write time on
 * the `memory_version` row. The API key that created a session is not recorded on
 * agent writes; attribution answers who made the write, not who is ultimately
 * responsible. Look up session provenance separately via the
 * [Sessions API](/en/api/sessions-retrieve).
 */
export type BetaManagedAgentsActor =
  | BetaManagedAgentsSessionActor
  | BetaManagedAgentsAPIActor
  | BetaManagedAgentsUserActor;

/**
 * Attribution for a write made directly via the public API (outside of any
 * session).
 */
export interface BetaManagedAgentsAPIActor {
  /**
   * ID of the API key that performed the write. This identifies the key, not the
   * secret.
   */
  api_key_id: string;

  type: 'api_actor';
}

/**
 * A `memory_version` object: one immutable, attributed row in a memory's
 * append-only history. Every non-no-op mutation to a memory produces a new
 * version. Versions belong to the store (not the individual memory) and persist
 * after the memory is deleted. Retrieving a redacted version returns 200 with
 * `content`, `path`, `content_size_bytes`, and `content_sha256` set to `null`;
 * branch on `redacted_at`, not HTTP status.
 */
export interface BetaManagedAgentsMemoryVersion {
  /**
   * Unique identifier for this version (a `memver_...` value).
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  /**
   * ID of the memory this version snapshots (a `mem_...` value). Remains valid after
   * the memory is deleted; pass it as `memory_id` to
   * [List memory versions](/en/api/beta/memory_stores/memory_versions/list) to
   * retrieve the full lineage including the `deleted` row.
   */
  memory_id: string;

  /**
   * ID of the memory store this version belongs to (a `memstore_...` value).
   */
  memory_store_id: string;

  /**
   * The kind of mutation a `memory_version` records. Every non-no-op mutation to a
   * memory appends exactly one version row with one of these values.
   */
  operation: BetaManagedAgentsMemoryVersionOperation;

  type: 'memory_version';

  /**
   * The memory's UTF-8 text content as of this version. `null` when `view=basic`,
   * when `operation` is `deleted`, or when `redacted_at` is set.
   */
  content?: string | null;

  /**
   * Lowercase hex SHA-256 digest of `content` as of this version (64 characters).
   * `null` when `redacted_at` is set or `operation` is `deleted`. Populated
   * regardless of `view` otherwise.
   */
  content_sha256?: string | null;

  /**
   * Size of `content` in bytes as of this version. `null` when `redacted_at` is set
   * or `operation` is `deleted`. Populated regardless of `view` otherwise.
   */
  content_size_bytes?: number | null;

  /**
   * Identifies who performed a write or redact operation. Captured at write time on
   * the `memory_version` row. The API key that created a session is not recorded on
   * agent writes; attribution answers who made the write, not who is ultimately
   * responsible. Look up session provenance separately via the
   * [Sessions API](/en/api/sessions-retrieve).
   */
  created_by?: BetaManagedAgentsActor;

  /**
   * The memory's path at the time of this write. `null` if and only if `redacted_at`
   * is set.
   */
  path?: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  redacted_at?: string | null;

  /**
   * Identifies who performed a write or redact operation. Captured at write time on
   * the `memory_version` row. The API key that created a session is not recorded on
   * agent writes; attribution answers who made the write, not who is ultimately
   * responsible. Look up session provenance separately via the
   * [Sessions API](/en/api/sessions-retrieve).
   */
  redacted_by?: BetaManagedAgentsActor;
}

/**
 * The kind of mutation a `memory_version` records. Every non-no-op mutation to a
 * memory appends exactly one version row with one of these values.
 */
export type BetaManagedAgentsMemoryVersionOperation = 'created' | 'modified' | 'deleted';

/**
 * Attribution for a write made by an agent during a session, through the mounted
 * filesystem at `/mnt/memory/`.
 */
export interface BetaManagedAgentsSessionActor {
  /**
   * ID of the session that performed the write (a `sesn_...` value). Look up the
   * session via [Retrieve a session](/en/api/sessions-retrieve) for further
   * provenance.
   */
  session_id: string;

  type: 'session_actor';
}

/**
 * Attribution for a write made by a human user through the Anthropic Console.
 */
export interface BetaManagedAgentsUserActor {
  type: 'user_actor';

  /**
   * ID of the user who performed the write (a `user_...` value).
   */
  user_id: string;
}

export interface MemoryVersionRetrieveParams {
  /**
   * Path param: Path parameter memory_store_id
   */
  memory_store_id: string;

  /**
   * Query param: Query parameter for view
   */
  view?: MemoriesAPI.BetaManagedAgentsMemoryView;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface MemoryVersionListParams extends PageCursorParams {
  /**
   * Query param: Query parameter for api_key_id
   */
  api_key_id?: string;

  /**
   * Query param: Return versions created at or after this time (inclusive).
   */
  'created_at[gte]'?: string;

  /**
   * Query param: Return versions created at or before this time (inclusive).
   */
  'created_at[lte]'?: string;

  /**
   * Query param: Query parameter for memory_id
   */
  memory_id?: string;

  /**
   * Query param: Query parameter for operation
   */
  operation?: BetaManagedAgentsMemoryVersionOperation;

  /**
   * Query param: Query parameter for session_id
   */
  session_id?: string;

  /**
   * Query param: Query parameter for view
   */
  view?: MemoriesAPI.BetaManagedAgentsMemoryView;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface MemoryVersionRedactParams {
  /**
   * Path param: Path parameter memory_store_id
   */
  memory_store_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace MemoryVersions {
  export {
    type BetaManagedAgentsActor as BetaManagedAgentsActor,
    type BetaManagedAgentsAPIActor as BetaManagedAgentsAPIActor,
    type BetaManagedAgentsMemoryVersion as BetaManagedAgentsMemoryVersion,
    type BetaManagedAgentsMemoryVersionOperation as BetaManagedAgentsMemoryVersionOperation,
    type BetaManagedAgentsSessionActor as BetaManagedAgentsSessionActor,
    type BetaManagedAgentsUserActor as BetaManagedAgentsUserActor,
    type BetaManagedAgentsMemoryVersionsPageCursor as BetaManagedAgentsMemoryVersionsPageCursor,
    type MemoryVersionRetrieveParams as MemoryVersionRetrieveParams,
    type MemoryVersionListParams as MemoryVersionListParams,
    type MemoryVersionRedactParams as MemoryVersionRedactParams,
  };
}
