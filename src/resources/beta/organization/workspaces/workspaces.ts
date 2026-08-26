// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as MembersAPI from './members';
import {
  MemberAddParams,
  MemberListParams,
  MemberRemoveParams,
  MemberRemoveResponse,
  MemberRetrieveParams,
  MemberUpdateParams,
  Members,
} from './members';
import * as RateLimitsAPI from './rate-limits';
import {
  BetaWorkspaceRateLimit,
  BetaWorkspaceRateLimitValue,
  BetaWorkspaceRateLimitsPageCursor,
  RateLimitListParams,
  RateLimits,
} from './rate-limits';
import * as ServiceAccountsAPI from './service-accounts';
import {
  ServiceAccountAddParams,
  ServiceAccountListParams,
  ServiceAccountRemoveParams,
  ServiceAccountRemoveResponse,
  ServiceAccountRetrieveParams,
  ServiceAccountUpdateParams,
  ServiceAccounts,
} from './service-accounts';
import { APIPromise } from '../../../../core/api-promise';
import { Page, type PageParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class Workspaces extends APIResource {
  rateLimits: RateLimitsAPI.RateLimits = new RateLimitsAPI.RateLimits(this._client);
  members: MembersAPI.Members = new MembersAPI.Members(this._client);
  serviceAccounts: ServiceAccountsAPI.ServiceAccounts = new ServiceAccountsAPI.ServiceAccounts(this._client);

  /**
   * Create Workspace
   *
   * @example
   * ```ts
   * const betaWorkspace =
   *   await client.beta.organization.workspaces.create({
   *     name: 'x',
   *   });
   * ```
   */
  create(params: WorkspaceCreateParams, options?: RequestOptions): APIPromise<BetaWorkspace> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/workspaces?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Get Workspace
   *
   * @example
   * ```ts
   * const betaWorkspace =
   *   await client.beta.organization.workspaces.retrieve(
   *     'workspace_id',
   *   );
   * ```
   */
  retrieve(workspaceID: string, options?: RequestOptions): APIPromise<BetaWorkspace> {
    return this._client.get(path`/v1/organizations/workspaces/${workspaceID}?beta=true`, options);
  }

  /**
   * Update Workspace
   *
   * @example
   * ```ts
   * const betaWorkspace =
   *   await client.beta.organization.workspaces.update(
   *     'workspace_id',
   *   );
   * ```
   */
  update(
    workspaceID: string,
    body: WorkspaceUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaWorkspace> {
    return this._client.post(path`/v1/organizations/workspaces/${workspaceID}?beta=true`, {
      body,
      ...options,
    });
  }

  /**
   * List Workspaces
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaWorkspace of client.beta.organization.workspaces.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: WorkspaceListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaWorkspacesPage, BetaWorkspace> {
    return this._client.getAPIList('/v1/organizations/workspaces?beta=true', Page<BetaWorkspace>, {
      query,
      ...options,
    });
  }

  /**
   * Archive Workspace
   *
   * @example
   * ```ts
   * const betaWorkspace =
   *   await client.beta.organization.workspaces.archive(
   *     'workspace_id',
   *   );
   * ```
   */
  archive(workspaceID: string, options?: RequestOptions): APIPromise<BetaWorkspace> {
    return this._client.post(path`/v1/organizations/workspaces/${workspaceID}/archive?beta=true`, options);
  }
}

export type BetaWorkspacesPage = Page<BetaWorkspace>;

export type BetaWorkspaceMembersPage = Page<BetaWorkspaceMember>;

export type BetaAllowedInferenceGeo = 'global' | 'us';

export interface BetaDataResidency {
  /**
   * Permitted inference geo values. 'unrestricted' means all geos are allowed.
   */
  allowed_inference_geos: Array<string> | 'unrestricted';

  /**
   * Default inference geo applied when requests omit the parameter.
   */
  default_inference_geo: string;

  /**
   * Geographic region for workspace data storage. Immutable after creation.
   */
  workspace_geo: string;
}

export interface BetaDataResidencyCreateConfig {
  /**
   * Permitted inference geo values. Defaults to 'unrestricted' if omitted, which
   * allows all geos. Use the string 'unrestricted' to allow all geos, or a list of
   * specific geos.
   */
  allowed_inference_geos?: Array<BetaAllowedInferenceGeo> | 'unrestricted' | null;

  /**
   * Default inference geo applied when requests omit the parameter. Defaults to
   * 'global' if omitted. Must be a member of `allowed_inference_geos` unless
   * `allowed_inference_geos` is `"unrestricted"`.
   */
  default_inference_geo?: 'global' | 'us' | null;

  /**
   * Geographic region for workspace data storage. Immutable after creation. Defaults
   * to 'us' if omitted.
   */
  workspace_geo?: 'us' | null;
}

export interface BetaDataResidencyUpdateConfig {
  /**
   * Permitted inference geo values. Use 'unrestricted' to allow all geos, or a list
   * of specific geos.
   */
  allowed_inference_geos?: Array<BetaAllowedInferenceGeo> | 'unrestricted' | null;

  /**
   * Default inference geo applied when requests omit the parameter. Must be a member
   * of `allowed_inference_geos` unless `allowed_inference_geos` is `"unrestricted"`.
   */
  default_inference_geo?: 'global' | 'us' | null;
}

export type BetaNoBillingWorkspaceRole =
  | 'workspace_admin'
  | 'workspace_developer'
  | 'workspace_restricted_developer'
  | 'workspace_user';

export interface BetaWorkspace {
  /**
   * ID of the Workspace.
   */
  id: string;

  /**
   * RFC 3339 datetime string indicating when the Workspace was archived, or `null`
   * if the Workspace is not archived.
   */
  archived_at: string | null;

  /**
   * Identifier for this Workspace's encryption compartment. When you configure a
   * customer-managed encryption key (CMEK) on AWS, reference this value in your KMS
   * key-policy condition so the key is scoped to this compartment. On GCP and Azure,
   * Anthropic enforces the compartment binding automatically; you do not need to
   * reference this value in your key configuration. See the CMEK integration guide
   * for the required key configuration, including the value used during key
   * validation.
   */
  compartment_id: string;

  /**
   * RFC 3339 datetime string indicating when the Workspace was created.
   */
  created_at: string;

  /**
   * Data residency configuration.
   */
  data_residency: BetaDataResidency;

  /**
   * Hex color code representing the Workspace in the Anthropic Console.
   */
  display_color: string;

  /**
   * ID of the customer-managed encryption key (CMEK) configuration to use for this
   * Workspace. Setting this field requires CMEK to be enabled for your organization.
   * When set, data stored for this Workspace is encrypted with the referenced key.
   * Create key configurations with the External Keys API. This field is write-once:
   * once a key is attached to a Workspace it cannot be detached or replaced. To
   * rotate key material, rotate the underlying key on your cloud KMS; the
   * `external_key_id` stays the same.
   */
  external_key_id: string | null;

  /**
   * Name of the Workspace.
   */
  name: string;

  /**
   * User-defined tags as string key-value pairs. Keys may not begin with
   * `anthropic`.
   */
  tags: { [key: string]: string };

  /**
   * Object type.
   *
   * For Workspaces, this is always `"workspace"`.
   */
  type: 'workspace';
}

export interface BetaWorkspaceMember {
  /**
   * Object type.
   *
   * For Workspace Members, this is always `"workspace_member"`.
   */
  type: 'workspace_member';

  /**
   * ID of the User.
   */
  user_id: string;

  /**
   * ID of the Workspace.
   */
  workspace_id: string;

  /**
   * Role of the Workspace Member.
   */
  workspace_role: BetaWorkspaceRole;
}

export type BetaWorkspaceRole =
  | 'workspace_admin'
  | 'workspace_billing'
  | 'workspace_developer'
  | 'workspace_restricted_developer'
  | 'workspace_user';

export interface WorkspaceCreateParams {
  /**
   * Body param: Name of the Workspace.
   */
  name: string;

  /**
   * Body param: Data residency configuration for the workspace. If omitted, defaults
   * to `workspace_geo: "us"`, `allowed_inference_geos: "unrestricted"`, and
   * `default_inference_geo: "global"`.
   */
  data_residency?: BetaDataResidencyCreateConfig | null;

  /**
   * Body param: Hex color code representing the Workspace in the Anthropic Console.
   */
  display_color?: string | null;

  /**
   * Body param: ID of the customer-managed encryption key (CMEK) configuration to
   * use for this Workspace. Setting this field requires CMEK to be enabled for your
   * organization. When set, data stored for this Workspace is encrypted with the
   * referenced key. Create key configurations with the External Keys API. This field
   * is write-once: once a key is attached to a Workspace it cannot be detached or
   * replaced. To rotate key material, rotate the underlying key on your cloud KMS;
   * the `external_key_id` stays the same.
   */
  external_key_id?: string | null;

  /**
   * Body param: User-defined tags as string key-value pairs. Keys may not begin with
   * `anthropic`.
   */
  tags?: { [key: string]: string } | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkspaceUpdateParams {
  /**
   * Data residency configuration for the workspace.
   */
  data_residency?: BetaDataResidencyUpdateConfig | null;

  /**
   * Hex color code representing the Workspace in the Anthropic Console.
   */
  display_color?: string;

  /**
   * ID of the customer-managed encryption key (CMEK) configuration to use for this
   * Workspace. Setting this field requires CMEK to be enabled for your organization.
   * When set, data stored for this Workspace is encrypted with the referenced key.
   * Create key configurations with the External Keys API. This field is write-once:
   * once a key is attached to a Workspace it cannot be detached or replaced. To
   * rotate key material, rotate the underlying key on your cloud KMS; the
   * `external_key_id` stays the same.
   */
  external_key_id?: string;

  /**
   * Name of the Workspace.
   */
  name?: string;

  /**
   * User-defined tags as string key-value pairs. Keys may not begin with
   * `anthropic`.
   */
  tags?: { [key: string]: string | null } | null;
}

export interface WorkspaceListParams extends PageParams {
  /**
   * Whether to include Workspaces that have been archived in the response
   */
  include_archived?: boolean;
}

Workspaces.RateLimits = RateLimits;
Workspaces.Members = Members;
Workspaces.ServiceAccounts = ServiceAccounts;

export declare namespace Workspaces {
  export {
    type BetaAllowedInferenceGeo as BetaAllowedInferenceGeo,
    type BetaDataResidency as BetaDataResidency,
    type BetaDataResidencyCreateConfig as BetaDataResidencyCreateConfig,
    type BetaDataResidencyUpdateConfig as BetaDataResidencyUpdateConfig,
    type BetaNoBillingWorkspaceRole as BetaNoBillingWorkspaceRole,
    type BetaWorkspace as BetaWorkspace,
    type BetaWorkspaceMember as BetaWorkspaceMember,
    type BetaWorkspaceRole as BetaWorkspaceRole,
    type BetaWorkspacesPage as BetaWorkspacesPage,
    type WorkspaceCreateParams as WorkspaceCreateParams,
    type WorkspaceUpdateParams as WorkspaceUpdateParams,
    type WorkspaceListParams as WorkspaceListParams,
  };

  export {
    RateLimits as RateLimits,
    type BetaWorkspaceRateLimit as BetaWorkspaceRateLimit,
    type BetaWorkspaceRateLimitValue as BetaWorkspaceRateLimitValue,
    type BetaWorkspaceRateLimitsPageCursor as BetaWorkspaceRateLimitsPageCursor,
    type RateLimitListParams as RateLimitListParams,
  };

  export {
    Members as Members,
    type MemberRemoveResponse as MemberRemoveResponse,
    type MemberRetrieveParams as MemberRetrieveParams,
    type MemberUpdateParams as MemberUpdateParams,
    type MemberListParams as MemberListParams,
    type MemberAddParams as MemberAddParams,
    type MemberRemoveParams as MemberRemoveParams,
  };

  export {
    ServiceAccounts as ServiceAccounts,
    type ServiceAccountRemoveResponse as ServiceAccountRemoveResponse,
    type ServiceAccountRetrieveParams as ServiceAccountRetrieveParams,
    type ServiceAccountUpdateParams as ServiceAccountUpdateParams,
    type ServiceAccountListParams as ServiceAccountListParams,
    type ServiceAccountAddParams as ServiceAccountAddParams,
    type ServiceAccountRemoveParams as ServiceAccountRemoveParams,
  };
}
