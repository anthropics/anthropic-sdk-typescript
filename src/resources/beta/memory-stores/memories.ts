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
   * CreateMemory
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
   * GetMemory
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
   * UpdateMemory
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
   * ListMemories
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
   * DeleteMemory
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

export interface BetaManagedAgentsContentSha256Precondition {
  type: 'content_sha256';

  content_sha256?: string;
}

export interface BetaManagedAgentsDeletedMemory {
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

export interface BetaManagedAgentsMemory {
  id: string;

  content_sha256: string;

  content_size_bytes: number;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  memory_store_id: string;

  memory_version_id: string;

  path: string;

  type: 'memory';

  /**
   * A timestamp in RFC 3339 format
   */
  updated_at: string;

  content?: string | null;
}

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

export interface BetaManagedAgentsMemoryPrefix {
  path: string;

  type: 'memory_prefix';
}

/**
 * MemoryView enum
 */
export type BetaManagedAgentsMemoryView = 'basic' | 'full';

export interface BetaManagedAgentsPrecondition {
  type: 'content_sha256';

  content_sha256?: string;
}

export interface MemoryCreateParams {
  /**
   * Body param
   */
  content: string | null;

  /**
   * Body param
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
   * Body param
   */
  content?: string | null;

  /**
   * Body param
   */
  path?: string | null;

  /**
   * Body param
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
