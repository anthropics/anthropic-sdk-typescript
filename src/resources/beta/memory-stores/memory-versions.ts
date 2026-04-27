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
   * GetMemoryVersion
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
   * ListMemoryVersions
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
   * RedactMemoryVersion
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

export type BetaManagedAgentsActor =
  | BetaManagedAgentsSessionActor
  | BetaManagedAgentsAPIActor
  | BetaManagedAgentsUserActor;

export interface BetaManagedAgentsAPIActor {
  api_key_id: string;

  type: 'api_actor';
}

export interface BetaManagedAgentsMemoryVersion {
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  memory_id: string;

  memory_store_id: string;

  /**
   * MemoryVersionOperation enum
   */
  operation: BetaManagedAgentsMemoryVersionOperation;

  type: 'memory_version';

  content?: string | null;

  content_sha256?: string | null;

  content_size_bytes?: number | null;

  created_by?: BetaManagedAgentsActor;

  path?: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  redacted_at?: string | null;

  redacted_by?: BetaManagedAgentsActor;
}

/**
 * MemoryVersionOperation enum
 */
export type BetaManagedAgentsMemoryVersionOperation = 'created' | 'modified' | 'deleted';

export interface BetaManagedAgentsSessionActor {
  session_id: string;

  type: 'session_actor';
}

export interface BetaManagedAgentsUserActor {
  type: 'user_actor';

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
