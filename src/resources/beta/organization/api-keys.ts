// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import { APIPromise } from '../../../core/api-promise';
import { Page, type PageParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class APIKeys extends APIResource {
  /**
   * Get API Key
   *
   * @example
   * ```ts
   * const betaAPIKey =
   *   await client.beta.organization.apiKeys.retrieve(
   *     'api_key_id',
   *   );
   * ```
   */
  retrieve(apiKeyID: string, options?: RequestOptions): APIPromise<BetaAPIKey> {
    return this._client.get(path`/v1/organizations/api_keys/${apiKeyID}?beta=true`, options);
  }

  /**
   * Update API Key
   *
   * @example
   * ```ts
   * const betaAPIKey =
   *   await client.beta.organization.apiKeys.update(
   *     'api_key_id',
   *   );
   * ```
   */
  update(apiKeyID: string, body: APIKeyUpdateParams, options?: RequestOptions): APIPromise<BetaAPIKey> {
    return this._client.post(path`/v1/organizations/api_keys/${apiKeyID}?beta=true`, { body, ...options });
  }

  /**
   * List API Keys
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaAPIKey of client.beta.organization.apiKeys.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: APIKeyListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaAPIKeysPage, BetaAPIKey> {
    return this._client.getAPIList('/v1/organizations/api_keys?beta=true', Page<BetaAPIKey>, {
      query,
      ...options,
    });
  }
}

export type BetaAPIKeysPage = Page<BetaAPIKey>;

export interface BetaAPIKey {
  /**
   * ID of the API key.
   */
  id: string;

  /**
   * RFC 3339 datetime string indicating when the API Key was created.
   */
  created_at: string;

  /**
   * The ID and type of the actor that created the API key, or `null` when the
   * creator is not recorded (legacy, workload-identity-federated, or system-created
   * keys).
   */
  created_by: BetaAPIKeyCreatedBy | null;

  /**
   * RFC 3339 datetime string indicating when the API Key expires, or `null` if it
   * never expires.
   */
  expires_at: string | null;

  /**
   * Name of the API key.
   */
  name: string;

  /**
   * Partially redacted hint for the API key.
   */
  partial_key_hint: string | null;

  /**
   * The principal the API key acts as (a User or a Service Account), or `null` if
   * the API key is not bound to a principal.
   */
  principal: BetaAPIKeyUserActor | BetaAPIKeyServiceAccountActor | null;

  /**
   * Where the API key belongs: its Workspace
   * (`{"type": "workspace", "workspace_id": "wrkspc_..."}`, with the Workspace's
   * real ID even when it is the organization's default Workspace), or the
   * organization (`{"type": "organization"}`) for a principal-bound API key that has
   * no Workspace.
   */
  scope: BetaAPIKeyOrganizationScope | BetaAPIKeyWorkspaceScope;

  /**
   * Status of the API key.
   */
  status: 'active' | 'archived' | 'expired' | 'inactive';

  /**
   * Object type.
   *
   * For API Keys, this is always `"api_key"`.
   */
  type: 'api_key';

  /**
   * @deprecated Use `scope` instead. `workspace_id` is `null` both for an API key in
   * the default Workspace and for a principal-bound API key that has no Workspace.
   */
  workspace_id: string | null;
}

export interface BetaAPIKeyCreatedBy {
  /**
   * ID of the actor that created the object.
   */
  id: string;

  /**
   * Type of the actor that created the object.
   */
  type: 'service_account' | 'user';
}

export interface BetaAPIKeyOrganizationScope {
  /**
   * Scope type. Always `"organization"`: the API key has no Workspace. Only a
   * principal-bound API key can have this scope.
   */
  type: 'organization';
}

export interface BetaAPIKeyServiceAccountActor {
  /**
   * ID of the Service Account the API key acts as.
   */
  service_account_id: string;

  /**
   * Principal type. Always `"service_account_actor"` for a Service Account.
   */
  type: 'service_account_actor';
}

export interface BetaAPIKeyUserActor {
  /**
   * Principal type. Always `"user_actor"` for a User.
   */
  type: 'user_actor';

  /**
   * ID of the User the API key acts as.
   */
  user_id: string;
}

export interface BetaAPIKeyWorkspaceScope {
  /**
   * Scope type. Always `"workspace"`: the API key belongs to one Workspace.
   */
  type: 'workspace';

  /**
   * ID of the Workspace the API key belongs to. Unlike the deprecated top-level
   * `workspace_id`, this is the Workspace's real ID even for the organization's
   * default Workspace.
   */
  workspace_id: string;
}

export interface APIKeyUpdateParams {
  /**
   * Name of the API key.
   */
  name?: string | null;

  /**
   * Status of the API key.
   */
  status?: 'active' | 'archived' | 'inactive' | null;
}

export interface APIKeyListParams extends PageParams {
  /**
   * Filter by the ID of the User who created the object.
   */
  created_by_user_id?: string | null;

  /**
   * Filter by API key status.
   */
  status?: 'active' | 'archived' | 'expired' | 'inactive' | null;

  /**
   * Filter by Workspace ID.
   */
  workspace_id?: string | null;
}

export declare namespace APIKeys {
  export {
    type BetaAPIKey as BetaAPIKey,
    type BetaAPIKeyCreatedBy as BetaAPIKeyCreatedBy,
    type BetaAPIKeyOrganizationScope as BetaAPIKeyOrganizationScope,
    type BetaAPIKeyServiceAccountActor as BetaAPIKeyServiceAccountActor,
    type BetaAPIKeyUserActor as BetaAPIKeyUserActor,
    type BetaAPIKeyWorkspaceScope as BetaAPIKeyWorkspaceScope,
    type BetaAPIKeysPage as BetaAPIKeysPage,
    type APIKeyUpdateParams as APIKeyUpdateParams,
    type APIKeyListParams as APIKeyListParams,
  };
}
