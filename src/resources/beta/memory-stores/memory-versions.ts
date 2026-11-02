import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as MemoriesAPI from './memories';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

export class MemoryVersions extends APIResource {
  /**
   * Retrieve a Memory Version
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
    const { memory_store_id, betas, workspace_id, ...query } = params;
    return this._client.get(path`/v1/memory_stores/${memory_store_id}/memory_versions/${memoryVersionID}`, {
      query,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.memory_stores.memory_versions.retrieve', options, {
        route: '/v1/memory_stores/{memory_store_id}/memory_versions/{memory_version_id}',
        queryParams: ['view'],
        attributes: {
          'gen_ai.memory.store.id': memory_store_id,
          'anthropic.memory_store.memory_version.id': memoryVersionID,
        },
      }),
    });
  }

  /**
   * List Memory Versions
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
    const { betas, workspace_id, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/memory_stores/${memoryStoreID}/memory_versions`,
      PageCursor<BetaManagedAgentsMemoryVersion>,
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
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(this._client, 'anthropic.memory_stores.memory_versions.list', options, {
          route: '/v1/memory_stores/{memory_store_id}/memory_versions',
          queryParams: [
            'api_key_id',
            'created_at[gte]',
            'created_at[lte]',
            'limit',
            'memory_id',
            'operation',
            'page',
            'service_account_id',
            'session_id',
            'view',
          ],
          attributes: { 'gen_ai.memory.store.id': memoryStoreID },
        }),
      },
    );
  }

  /**
   * Redact a Memory Version
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
    const { memory_store_id, betas, workspace_id } = params;
    return this._client.post(
      path`/v1/memory_stores/${memory_store_id}/memory_versions/${memoryVersionID}/redact`,
      {
        ...options,
        headers: buildHeaders([
          {
            'anthropic-beta': [...(betas ?? []), 'agent-memory-2026-07-22'].toString(),
            ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
          },
          options?.headers,
        ]),
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(this._client, 'anthropic.memory_stores.memory_versions.redact', options, {
          route: '/v1/memory_stores/{memory_store_id}/memory_versions/{memory_version_id}/redact',
          attributes: {
            'gen_ai.memory.store.id': memory_store_id,
            'anthropic.memory_store.memory_version.id': memoryVersionID,
          },
        }),
      },
    );
  }
}

export type BetaManagedAgentsMemoryVersionsPageCursor = PageCursor<BetaManagedAgentsMemoryVersion>;

/**
 * Identifies who performed an operation. Recorded when the operation happens and
 * not updated afterwards, so the ID may refer to a user, service account, API key,
 * or session that has since been deleted.
 */
export type BetaManagedAgentsActor =
  | BetaManagedAgentsSessionActor
  | BetaManagedAgentsAPIActor
  | BetaManagedAgentsUserActor
  | BetaManagedAgentsServiceAccountActor;

/**
 * A direct caller of the public API, identified by the API key that authenticated
 * the request.
 */
export interface BetaManagedAgentsAPIActor {
  /**
   * ID of the API key (an `apikey_...` value). This identifies the key, not the
   * secret.
   */
  api_key_id: string;

  type: 'api_actor';
}

/**
 * One entry in a memory's history, recording a single change and who made it.
 *
 * Every change to a memory adds one version. Only redaction can change a version
 * after that. Versions belong to the memory store and stay after the memory is
 * deleted. Each version is retained for at least the version retention period
 * after it was written, unless the store itself is deleted.
 *
 * Retrieving a redacted version succeeds, with `content`, `path`,
 * `content_size_bytes`, and `content_sha256` set to `null`. Check `redacted_at` to
 * find out whether a version was redacted.
 *
 * See the
 * [memory guide](https://platform.claude.com/docs/en/managed-agents/memory#audit-memory-changes)
 * to learn more about memory versions.
 */
export interface BetaManagedAgentsMemoryVersion {
  /**
   * Unique identifier for this version (a `memver_...` value).
   */
  id: string;

  /**
   * When this version was written, in RFC 3339 format.
   */
  created_at: string;

  /**
   * The ID of the memory that this version belongs to (`mem_...`).
   *
   * The ID stays valid after the memory is deleted. Pass it as `memory_id` to
   * [List Memory Versions](https://platform.claude.com/docs/en/api/beta/memory_stores/memory_versions/list)
   * to get the memory's retained versions, including its `deleted` version while the
   * lineage is retained.
   */
  memory_id: string;

  /**
   * ID of the memory store this version belongs to (a `memstore_...` value).
   */
  memory_store_id: string;

  /**
   * The kind of mutation this version records: `created`, `modified`, or `deleted`.
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
   * Who made this change to the memory, or `null` if the author wasn't recorded.
   *
   * Redacting the version doesn't change this field. A `session_actor` here is an
   * agent that wrote through the store's mounted filesystem at `/mnt/memory/`. The
   * version doesn't record the API key that created that session. So the author in
   * `created_by` is who made the change, not who is ultimately responsible for it.
   *
   * You can
   * [retrieve the session](https://platform.claude.com/docs/en/api/beta/sessions/retrieve)
   * to learn more about where the change came from.
   */
  created_by?: BetaManagedAgentsActor;

  /**
   * The memory's path at the time of this write. `null` if and only if `redacted_at`
   * is set.
   */
  path?: string | null;

  /**
   * When the version was redacted, in RFC 3339, or `null` if it hasn't been.
   *
   * When set, `content`, `path`, `content_size_bytes`, and `content_sha256` are
   * `null`.
   *
   * See the
   * [memory guide](https://platform.claude.com/docs/en/managed-agents/memory#redact-a-version)
   * to learn more about redaction.
   */
  redacted_at?: string | null;

  /**
   * Who redacted this version, or `null` if it has not been redacted. In practice
   * always an `api_actor`, `user_actor`, or `service_account_actor` (agents do not
   * have a redact capability).
   */
  redacted_by?: BetaManagedAgentsActor;
}

/**
 * The kind of change that a memory version records.
 *
 * Every change to a memory adds one version. If you update a memory and nothing
 * changes, the memory doesn't get a new version.
 *
 * - `created` - The memory was created. The first version in any memory's lineage.
 * - `modified` - The memory's `content`, `path`, or both were changed via update.
 *   Writes the agent makes through the filesystem mount also appear as `modified`.
 * - `deleted` - The memory was deleted. The `content`, `content_size_bytes`, and
 *   `content_sha256` fields are `null` on this version. The preceding version,
 *   while it is retained, records the deleted content's size and hash.
 */
export type BetaManagedAgentsMemoryVersionOperation = 'created' | 'modified' | 'deleted';

/**
 * A workload authenticated as a service account, for example via Workload Identity
 * Federation.
 */
export interface BetaManagedAgentsServiceAccountActor {
  /**
   * ID of the service account (a `svac_...` value).
   */
  service_account_id: string;

  type: 'service_account_actor';
}

/**
 * An agent acting during a session, for example through the session's mounted
 * filesystem. It names the session itself, not the user or API key that started
 * the session.
 */
export interface BetaManagedAgentsSessionActor {
  /**
   * ID of the session (a `sesn_...` value). Look up the session via
   * [Retrieve a session](/en/api/beta/sessions/retrieve) for further provenance.
   */
  session_id: string;

  type: 'session_actor';
}

/**
 * A human user, for example acting through the Anthropic Console.
 */
export interface BetaManagedAgentsUserActor {
  type: 'user_actor';

  /**
   * ID of the user (a `user_...` value).
   */
  user_id: string;
}

export interface MemoryVersionRetrieveParams {
  /**
   * Path param: The ID of the memory store that holds the version (`memstore_...`).
   */
  memory_store_id: string;

  /**
   * Query param: Whether a `memory` or `memory_version` in the response includes its
   * `content`. Defaults to `full` on retrieve operations and to `basic` on list,
   * create, and update operations.
   *
   * With `full`, list operations return at most 20 items per page.
   */
  view?: MemoriesAPI.BetaManagedAgentsMemoryView;

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

export interface MemoryVersionListParams extends PageCursorParams {
  /**
   * Query param: Return only versions written with the API key that has this ID.
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
   * Query param: Return only versions of the memory with this ID (`mem_...`).
   *
   * The filter still works after the memory is deleted. While that memory's versions
   * are retained, the results include the version whose `operation` is `deleted`.
   */
  memory_id?: string;

  /**
   * Query param: Return only versions that record this kind of change.
   */
  operation?: BetaManagedAgentsMemoryVersionOperation;

  /**
   * Query param: Return only versions written by the service account with this ID
   * (`svac_...`).
   */
  service_account_id?: string;

  /**
   * Query param: Return only versions written by the session with this ID.
   */
  session_id?: string;

  /**
   * Query param: Whether a `memory` or `memory_version` in the response includes its
   * `content`. Defaults to `full` on retrieve operations and to `basic` on list,
   * create, and update operations.
   *
   * With `full`, list operations return at most 20 items per page.
   */
  view?: MemoriesAPI.BetaManagedAgentsMemoryView;

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

export interface MemoryVersionRedactParams {
  /**
   * Path param: The ID of the memory store that holds the version (`memstore_...`).
   */
  memory_store_id: string;

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

export declare namespace MemoryVersions {
  export {
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
