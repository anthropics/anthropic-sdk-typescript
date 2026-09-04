// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as SessionsAPI from './sessions';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Resources extends APIResource {
  /**
   * Get Session Resource
   *
   * @example
   * ```ts
   * const resource =
   *   await client.beta.sessions.resources.retrieve(
   *     'sesrsc_011CZkZBJq5dWxk9fVLNcPht',
   *     { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   *   );
   * ```
   */
  retrieve(
    resourceID: string,
    params: ResourceRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<ResourceRetrieveResponse> {
    const { session_id, betas, workspace_id } = params;
    return this._client.get(path`/v1/sessions/${session_id}/resources/${resourceID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Session Resource
   *
   * @example
   * ```ts
   * const resource =
   *   await client.beta.sessions.resources.update(
   *     'sesrsc_011CZkZBJq5dWxk9fVLNcPht',
   *     {
   *       session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *       authorization_token: 'ghp_exampletoken',
   *     },
   *   );
   * ```
   */
  update(
    resourceID: string,
    params: ResourceUpdateParams,
    options?: RequestOptions,
  ): APIPromise<ResourceUpdateResponse> {
    const { session_id, betas, workspace_id, ...body } = params;
    return this._client.post(path`/v1/sessions/${session_id}/resources/${resourceID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * List Session Resources
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsSessionResource of client.beta.sessions.resources.list(
   *   'sesn_011CZkZAtmR3yMPDzynEDxu7',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    sessionID: string,
    params: ResourceListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsSessionResourcesPageCursor, BetaManagedAgentsSessionResource> {
    const { betas, workspace_id, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/sessions/${sessionID}/resources?beta=true`,
      PageCursor<BetaManagedAgentsSessionResource>,
      {
        query,
        ...options,
        headers: buildHeaders([
          {
            'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
            ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
          },
          options?.headers,
        ]),
      },
    );
  }

  /**
   * Delete Session Resource
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeleteSessionResource =
   *   await client.beta.sessions.resources.delete(
   *     'sesrsc_011CZkZBJq5dWxk9fVLNcPht',
   *     { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   *   );
   * ```
   */
  delete(
    resourceID: string,
    params: ResourceDeleteParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeleteSessionResource> {
    const { session_id, betas, workspace_id } = params;
    return this._client.delete(path`/v1/sessions/${session_id}/resources/${resourceID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * Add Session Resource
   *
   * @example
   * ```ts
   * const betaManagedAgentsFileResource =
   *   await client.beta.sessions.resources.add(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *     {
   *       file_id: 'file_011CNha8iCJcU1wXNR6q4V8w',
   *       type: 'file',
   *     },
   *   );
   * ```
   */
  add(
    sessionID: string,
    params: ResourceAddParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsFileResource> {
    const { betas, workspace_id, ...body } = params;
    return this._client.post(path`/v1/sessions/${sessionID}/resources?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }
}

export type BetaManagedAgentsSessionResourcesPageCursor = PageCursor<BetaManagedAgentsSessionResource>;

/**
 * Confirmation of resource deletion.
 */
export interface BetaManagedAgentsDeleteSessionResource {
  id: string;

  type: 'session_resource_deleted';
}

export interface BetaManagedAgentsFileResource {
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  file_id: string;

  mount_path: string;

  type: 'file';

  /**
   * A timestamp in RFC 3339 format
   */
  updated_at: string;
}

export interface BetaManagedAgentsGitHubRepositoryResource {
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  mount_path: string;

  type: 'github_repository';

  /**
   * A timestamp in RFC 3339 format
   */
  updated_at: string;

  url: string;

  checkout?: SessionsAPI.BetaManagedAgentsBranchCheckout | SessionsAPI.BetaManagedAgentsCommitCheckout | null;
}

/**
 * A memory store attached to an agent session.
 */
export interface BetaManagedAgentsMemoryStoreResource {
  /**
   * The memory store ID (memstore\_...). Must belong to the caller's organization
   * and workspace.
   */
  memory_store_id: string;

  type: 'memory_store';

  /**
   * Access mode for an attached memory store.
   */
  access?: 'read_write' | 'read_only' | null;

  /**
   * Description of the memory store, snapshotted at attach time. Rendered into the
   * agent's system prompt. Empty string when the store has no description.
   */
  description?: string;

  /**
   * Per-attachment guidance for the agent on how to use this store. Rendered into
   * the memory section of the system prompt. Max 4096 chars.
   */
  instructions?: string | null;

  /**
   * Filesystem path where the store is mounted in the session container, e.g.
   * /mnt/memory/user-preferences. Derived from the store's name. Output-only.
   */
  mount_path?: string | null;

  /**
   * Display name of the memory store, snapshotted at attach time. Later edits to the
   * store's name do not propagate to this resource.
   */
  name?: string | null;
}

/**
 * A memory store attached to an agent session.
 */
export type BetaManagedAgentsSessionResource =
  | BetaManagedAgentsGitHubRepositoryResource
  | BetaManagedAgentsFileResource
  | BetaManagedAgentsMemoryStoreResource;

/**
 * The requested session resource.
 */
export type ResourceRetrieveResponse =
  | BetaManagedAgentsGitHubRepositoryResource
  | BetaManagedAgentsFileResource
  | BetaManagedAgentsMemoryStoreResource;

/**
 * The updated session resource.
 */
export type ResourceUpdateResponse =
  | BetaManagedAgentsGitHubRepositoryResource
  | BetaManagedAgentsFileResource
  | BetaManagedAgentsMemoryStoreResource;

export interface ResourceRetrieveParams {
  /**
   * Path param: Path parameter session_id
   */
  session_id: string;

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

export interface ResourceUpdateParams {
  /**
   * Path param: Path parameter session_id
   */
  session_id: string;

  /**
   * Body param: New authorization token for the resource. Currently only
   * `github_repository` resources support token rotation.
   */
  authorization_token: string;

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

export interface ResourceListParams extends PageCursorParams {
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

export interface ResourceDeleteParams {
  /**
   * Path param: Path parameter session_id
   */
  session_id: string;

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

export interface ResourceAddParams {
  /**
   * Body param: ID of a previously uploaded file.
   */
  file_id: string;

  /**
   * Body param
   */
  type: 'file';

  /**
   * Body param: Mount path in the container. Defaults to
   * `/mnt/session/uploads/<file_id>`.
   */
  mount_path?: string | null;

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

export declare namespace Resources {
  export {
    type BetaManagedAgentsDeleteSessionResource as BetaManagedAgentsDeleteSessionResource,
    type BetaManagedAgentsFileResource as BetaManagedAgentsFileResource,
    type BetaManagedAgentsGitHubRepositoryResource as BetaManagedAgentsGitHubRepositoryResource,
    type BetaManagedAgentsMemoryStoreResource as BetaManagedAgentsMemoryStoreResource,
    type BetaManagedAgentsSessionResource as BetaManagedAgentsSessionResource,
    type ResourceRetrieveResponse as ResourceRetrieveResponse,
    type ResourceUpdateResponse as ResourceUpdateResponse,
    type BetaManagedAgentsSessionResourcesPageCursor as BetaManagedAgentsSessionResourcesPageCursor,
    type ResourceRetrieveParams as ResourceRetrieveParams,
    type ResourceUpdateParams as ResourceUpdateParams,
    type ResourceListParams as ResourceListParams,
    type ResourceDeleteParams as ResourceDeleteParams,
    type ResourceAddParams as ResourceAddParams,
  };
}
