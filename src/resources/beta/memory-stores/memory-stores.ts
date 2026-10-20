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
  BetaManagedAgentsServiceAccountActor,
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
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

export class MemoryStores extends APIResource {
  memories: MemoriesAPI.Memories = new MemoriesAPI.Memories(this._client);
  memoryVersions: MemoryVersionsAPI.MemoryVersions = new MemoryVersionsAPI.MemoryVersions(this._client);

  /**
   * Create a Memory Store
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
    const { betas, workspace_id, ...body } = params;
    return this._client.post('/v1/memory_stores?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.memory_stores.create', options, {
        route: '/v1/memory_stores',
        createdIDAttribute: 'gen_ai.memory.store.id',
      }),
    });
  }

  /**
   * Retrieve a Memory Store
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
    const { betas, workspace_id } = params ?? {};
    return this._client.get(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.memory_stores.retrieve', options, {
        route: '/v1/memory_stores/{memory_store_id}',
        attributes: { 'gen_ai.memory.store.id': memoryStoreID },
      }),
    });
  }

  /**
   * Update a Memory Store
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
    const { betas, workspace_id, ...body } = params;
    return this._client.post(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.memory_stores.update', options, {
        route: '/v1/memory_stores/{memory_store_id}',
        attributes: { 'gen_ai.memory.store.id': memoryStoreID },
      }),
    });
  }

  /**
   * List Memory Stores
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
    const { betas, workspace_id, ...query } = params ?? {};
    return this._client.getAPIList('/v1/memory_stores?beta=true', PageCursor<BetaManagedAgentsMemoryStore>, {
      query,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.memory_stores.list', options, {
        route: '/v1/memory_stores',
        queryParams: ['created_at[gte]', 'created_at[lte]', 'include_archived', 'limit', 'page'],
      }),
    });
  }

  /**
   * Delete a Memory Store
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
    const { betas, workspace_id } = params ?? {};
    return this._client.delete(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.memory_stores.delete', options, {
        route: '/v1/memory_stores/{memory_store_id}',
        attributes: { 'gen_ai.memory.store.id': memoryStoreID },
      }),
    });
  }

  /**
   * Archive a Memory Store
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
    const { betas, workspace_id } = params ?? {};
    return this._client.post(path`/v1/memory_stores/${memoryStoreID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __span: startApiCallSpan(this._client, 'anthropic.memory_stores.archive', options, {
        route: '/v1/memory_stores/{memory_store_id}/archive',
        attributes: { 'gen_ai.memory.store.id': memoryStoreID },
      }),
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
   * The unique ID of the memory store (`memstore_...`). Use it to attach the store
   * to a session.
   */
  id: string;

  /**
   * When the memory store was archived, in RFC 3339, or `null` if it hasn't been.
   *
   * Archiving can't be undone. An archived store can't be attached to new sessions.
   * You can't create or update its memories or update the store. You can still read
   * and delete its memories, redact their versions, and delete the store.
   *
   * See the
   * [memory guide](https://platform.claude.com/docs/en/managed-agents/memory#archive-a-store)
   * to learn more about archiving.
   */
  archived_at: string | null;

  /**
   * When the memory store was created, in RFC 3339.
   */
  created_at: string;

  /**
   * Free-text description of what the store contains, up to 1,024 characters.
   * Included in the agent's system prompt when the store is attached, so word it to
   * be useful to the agent. Empty string when unset.
   */
  description: string;

  /**
   * Key-value pairs for your own use, such as the end user that the store belongs
   * to.
   *
   * A store has at most 16 pairs. Keys are 1 to 64 characters long and values at
   * most 512 characters. You can't filter lists by metadata.
   */
  metadata: { [key: string]: string };

  /**
   * Human-readable name for the store. 1–255 characters. The store's mount-path slug
   * under `/mnt/memory/` is derived from this name.
   */
  name: string;

  type: 'memory_store';

  /**
   * When the memory store was last changed, in RFC 3339.
   *
   * Changing its `name`, `description`, or `metadata` updates it. Archiving the
   * store does too. Changes to the store's memories don't.
   */
  updated_at: string;
}

export interface MemoryStoreCreateParams {
  /**
   * Body param: The name of the memory store, 1 to 255 characters long, without
   * control characters. Names don't have to be unique in a workspace.
   *
   * In a session, the store's directory under `/mnt/memory/` is based on this name.
   * The name is lowercased and every run of characters other than ASCII letters and
   * digits becomes one hyphen. The session's memory store resource gives the exact
   * path in `mount_path`.
   *
   * See the
   * [memory guide](https://platform.claude.com/docs/en/managed-agents/memory#how-the-agent-accesses-memory)
   * to learn more about how agents access memory stores.
   */
  name: string;

  /**
   * Body param: Free-text description of what the store contains, up to 1,024
   * characters. Included in the agent's system prompt when the store is attached, so
   * word it to be useful to the agent.
   */
  description?: string;

  /**
   * Body param: Key-value pairs for your own use, such as the end user that the
   * store belongs to. The agent doesn't see them.
   *
   * A store has at most 16 pairs. Keys are 1 to 64 characters long and values at
   * most 512 characters.
   */
  metadata?: { [key: string]: string };

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

export interface MemoryStoreRetrieveParams {
  /**
   * This endpoint is in beta: requests must send `agent-memory-2026-07-22` or
   * `managed-agents-2026-04-01` in this header.
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

export interface MemoryStoreUpdateParams {
  /**
   * Body param: New description for the store, up to 1,024 characters. Pass an empty
   * string to clear it.
   */
  description?: string | null;

  /**
   * Body param: Changes to apply to the memory store's metadata. Keys you leave out
   * keep their values.
   *
   * Set a key to a string to add or replace it, or to `null` to remove it. After the
   * change, the metadata can hold at most 16 key-value pairs. Keys are 1 to 64
   * characters long and values at most 512 characters.
   */
  metadata?: { [key: string]: string | null } | null;

  /**
   * Body param: The new name of the memory store, 1 to 255 characters long, without
   * control characters.
   *
   * Sessions created after the change use the new name for the store's directory
   * under `/mnt/memory/`.
   */
  name?: string | null;

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

export interface MemoryStoreListParams extends PageCursorParams {
  /**
   * Query param: Return only memory stores created at or after this time
   * (inclusive).
   */
  'created_at[gte]'?: string;

  /**
   * Query param: Return only memory stores created at or before this time
   * (inclusive).
   */
  'created_at[lte]'?: string;

  /**
   * Query param: When `true`, archived stores are included in the results. Defaults
   * to `false` (archived stores are excluded).
   */
  include_archived?: boolean;

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

export interface MemoryStoreDeleteParams {
  /**
   * This endpoint is in beta: requests must send `agent-memory-2026-07-22` or
   * `managed-agents-2026-04-01` in this header.
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

export interface MemoryStoreArchiveParams {
  /**
   * This endpoint is in beta: requests must send `agent-memory-2026-07-22` or
   * `managed-agents-2026-04-01` in this header.
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
    type BetaManagedAgentsServiceAccountActor as BetaManagedAgentsServiceAccountActor,
    type BetaManagedAgentsSessionActor as BetaManagedAgentsSessionActor,
    type BetaManagedAgentsUserActor as BetaManagedAgentsUserActor,
    type BetaManagedAgentsMemoryVersionsPageCursor as BetaManagedAgentsMemoryVersionsPageCursor,
    type MemoryVersionRetrieveParams as MemoryVersionRetrieveParams,
    type MemoryVersionListParams as MemoryVersionListParams,
    type MemoryVersionRedactParams as MemoryVersionRedactParams,
  };
}
