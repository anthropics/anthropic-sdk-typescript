// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as MemoriesAPI from './memories';
import {
  BetaManagedAgentsConflictError,
  BetaManagedAgentsContentSha256Precondition,
  BetaManagedAgentsDeletedMemory,
  BetaManagedAgentsError,
  BetaManagedAgentsMemory,
  BetaManagedAgentsMemoryListItem,
  BetaManagedAgentsMemoryListItemsPageCursor,
  BetaManagedAgentsMemoryPathConflictError,
  BetaManagedAgentsMemoryPreconditionFailedError,
  BetaManagedAgentsMemoryPrefix,
  BetaManagedAgentsMemoryView,
  BetaManagedAgentsPrecondition,
  Memories,
  MemoryCreateParams,
  MemoryDeleteParams,
  MemoryListParams,
  MemoryRetrieveParams,
  MemoryUpdateParams,
} from './memories';
import * as MemoryVersionsAPI from './memory-versions';
import {
  BetaManagedAgentsAPIActor,
  BetaManagedAgentsActor,
  BetaManagedAgentsMemoryVersion,
  BetaManagedAgentsMemoryVersionOperation,
  BetaManagedAgentsMemoryVersionsPageCursor,
  BetaManagedAgentsSessionActor,
  BetaManagedAgentsUserActor,
  MemoryVersionListParams,
  MemoryVersionRedactParams,
  MemoryVersionRetrieveParams,
  MemoryVersions,
} from './memory-versions';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class MemoryStores extends APIResource {
  memories: MemoriesAPI.Memories = new MemoriesAPI.Memories(this._client);
  memoryVersions: MemoryVersionsAPI.MemoryVersions = new MemoryVersionsAPI.MemoryVersions(this._client);

  /**
   * Create a memory store
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryStore =
   *   await client.beta.memoryStores.create({ name: 'x' });
   * ```
   */
  create(
    params: MemoryStoreCreateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsMemoryStore> {
    const { betas, ...body } = params;
    return this._client.post('/v1/memory_stores?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Retrieve a memory store
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryStore =
   *   await client.beta.memoryStores.retrieve(
   *     'memory_store_id',
   *   );
   * ```
   */
  retrieve(
    memoryStoreID: string,
    params: MemoryStoreRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsMemoryStore> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Update a memory store
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryStore =
   *   await client.beta.memoryStores.update('memory_store_id');
   * ```
   */
  update(
    memoryStoreID: string,
    params: MemoryStoreUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsMemoryStore> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List memory stores
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsMemoryStore of client.beta.memoryStores.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: MemoryStoreListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsMemoryStoresPageCursor, BetaManagedAgentsMemoryStore> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/memory_stores?beta=true', PageCursor<BetaManagedAgentsMemoryStore>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete a memory store
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeletedMemoryStore =
   *   await client.beta.memoryStores.delete('memory_store_id');
   * ```
   */
  delete(
    memoryStoreID: string,
    params: MemoryStoreDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeletedMemoryStore> {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Archive a memory store
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryStore =
   *   await client.beta.memoryStores.archive('memory_store_id');
   * ```
   */
  archive(
    memoryStoreID: string,
    params: MemoryStoreArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsMemoryStore> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/memory_stores/${memoryStoreID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaManagedAgentsMemoryStoresPageCursor = PageCursor<BetaManagedAgentsMemoryStore>;

/**
 * Confirmation that a `memory_store` was deleted.
 */
export interface BetaManagedAgentsDeletedMemoryStore {
  /**
   * ID of the deleted memory store (a `memstore_...` identifier). The store and all
   * its memories and versions are no longer retrievable.
   */
  id: string;

  type: 'memory_store_deleted';
}

/**
 * A `memory_store`: a named container for agent memories, scoped to a workspace.
 * Attach a store to a session via `resources[]` to mount it as a directory the
 * agent can read and write.
 */
export interface BetaManagedAgentsMemoryStore {
  /**
   * Unique identifier for the memory store (a `memstore_...` tagged ID). Use this
   * when attaching the store to a session, or in the `{memory_store_id}` path
   * parameter of subsequent calls.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  /**
   * Human-readable name for the store. 1–255 characters. The store's mount-path slug
   * under `/mnt/memory/` is derived from this name.
   */
  name: string;

  type: 'memory_store';

  /**
   * A timestamp in RFC 3339 format
   */
  updated_at: string;

  /**
   * A timestamp in RFC 3339 format
   */
  archived_at?: string | null;

  /**
   * Free-text description of what the store contains, up to 1024 characters.
   * Included in the agent's system prompt when the store is attached, so word it to
   * be useful to the agent. Empty string when unset.
   */
  description?: string;

  /**
   * Arbitrary key-value tags for your own bookkeeping (such as the end user a store
   * belongs to). Up to 16 pairs; keys 1–64 characters; values up to 512 characters.
   * Returned on retrieve/list but not filterable.
   */
  metadata?: { [key: string]: string };
}

export interface MemoryStoreCreateParams {
  /**
   * Body param: Human-readable name for the store. Required; 1–255 characters; no
   * control characters. The mount-path slug under `/mnt/memory/` is derived from
   * this name (lowercased, non-alphanumeric runs collapsed to a hyphen). Names need
   * not be unique within a workspace.
   */
  name: string;

  /**
   * Body param: Free-text description of what the store contains, up to 1024
   * characters. Included in the agent's system prompt when the store is attached, so
   * word it to be useful to the agent.
   */
  description?: string;

  /**
   * Body param: Arbitrary key-value tags for your own bookkeeping (such as the end
   * user a store belongs to). Up to 16 pairs; keys 1–64 characters; values up to 512
   * characters. Not visible to the agent.
   */
  metadata?: { [key: string]: string };

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface MemoryStoreRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface MemoryStoreUpdateParams {
  /**
   * Body param: New description for the store, up to 1024 characters. Pass an empty
   * string to clear it.
   */
  description?: string | null;

  /**
   * Body param: Metadata patch. Set a key to a string to upsert it, or to null to
   * delete it. Omit the field to preserve. The stored bag is limited to 16 keys (up
   * to 64 chars each) with values up to 512 chars.
   */
  metadata?: { [key: string]: string | null } | null;

  /**
   * Body param: New human-readable name for the store. 1–255 characters; no control
   * characters. Renaming changes the slug used for the store's `mount_path` in
   * sessions created after the update.
   */
  name?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface MemoryStoreListParams extends PageCursorParams {
  /**
   * Query param: Return only stores whose `created_at` is at or after this time
   * (inclusive). Sent on the wire as `created_at[gte]`.
   */
  'created_at[gte]'?: string;

  /**
   * Query param: Return only stores whose `created_at` is at or before this time
   * (inclusive). Sent on the wire as `created_at[lte]`.
   */
  'created_at[lte]'?: string;

  /**
   * Query param: When `true`, archived stores are included in the results. Defaults
   * to `false` (archived stores are excluded).
   */
  include_archived?: boolean;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface MemoryStoreDeleteParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface MemoryStoreArchiveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

MemoryStores.Memories = Memories;
MemoryStores.MemoryVersions = MemoryVersions;

export declare namespace MemoryStores {
  export {
    type BetaManagedAgentsDeletedMemoryStore as BetaManagedAgentsDeletedMemoryStore,
    type BetaManagedAgentsMemoryStore as BetaManagedAgentsMemoryStore,
    type BetaManagedAgentsMemoryStoresPageCursor as BetaManagedAgentsMemoryStoresPageCursor,
    type MemoryStoreCreateParams as MemoryStoreCreateParams,
    type MemoryStoreRetrieveParams as MemoryStoreRetrieveParams,
    type MemoryStoreUpdateParams as MemoryStoreUpdateParams,
    type MemoryStoreListParams as MemoryStoreListParams,
    type MemoryStoreDeleteParams as MemoryStoreDeleteParams,
    type MemoryStoreArchiveParams as MemoryStoreArchiveParams,
  };

  export {
    Memories as Memories,
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

  export {
    MemoryVersions as MemoryVersions,
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
