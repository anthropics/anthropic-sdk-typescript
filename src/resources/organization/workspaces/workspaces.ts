import { APIResource } from '../../../core/resource';
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
  RateLimitListParams,
  RateLimits,
  WorkspaceRateLimit,
  WorkspaceRateLimitOrganizationSource,
  WorkspaceRateLimitValue,
  WorkspaceRateLimitWorkspaceSource,
  WorkspaceRateLimitsPageCursor,
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
import { APIPromise } from '../../../core/api-promise';
import { Page, type PageParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Workspaces extends APIResource {
  rateLimits: RateLimitsAPI.RateLimits = new RateLimitsAPI.RateLimits(this._client);
  members: MembersAPI.Members = new MembersAPI.Members(this._client);
  serviceAccounts: ServiceAccountsAPI.ServiceAccounts = new ServiceAccountsAPI.ServiceAccounts(this._client);

  /**
   * Create Workspace
   *
   * @example
   * ```ts
   * const workspace =
   *   await client.organization.workspaces.create({
   *     name: 'x',
   *   });
   * ```
   */
  create(body: WorkspaceCreateParams, options?: RequestOptions): APIPromise<Workspace> {
    return this._client.post('/v1/organizations/workspaces', { body, ...options });
  }

  /**
   * Get Workspace
   *
   * @example
   * ```ts
   * const workspace =
   *   await client.organization.workspaces.retrieve(
   *     'workspace_id',
   *   );
   * ```
   */
  retrieve(workspaceID: string, options?: RequestOptions): APIPromise<Workspace> {
    return this._client.get(path`/v1/organizations/workspaces/${workspaceID}`, options);
  }

  /**
   * Update Workspace
   *
   * @example
   * ```ts
   * const workspace =
   *   await client.organization.workspaces.update(
   *     'workspace_id',
   *   );
   * ```
   */
  update(workspaceID: string, body: WorkspaceUpdateParams, options?: RequestOptions): APIPromise<Workspace> {
    return this._client.post(path`/v1/organizations/workspaces/${workspaceID}`, { body, ...options });
  }

  /**
   * List Workspaces
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const workspace of client.organization.workspaces.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: WorkspaceListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<WorkspacesPage, Workspace> {
    return this._client.getAPIList('/v1/organizations/workspaces', Page<Workspace>, { query, ...options });
  }

  /**
   * Archive Workspace
   *
   * @example
   * ```ts
   * const workspace =
   *   await client.organization.workspaces.archive(
   *     'workspace_id',
   *   );
   * ```
   */
  archive(workspaceID: string, options?: RequestOptions): APIPromise<Workspace> {
    return this._client.post(path`/v1/organizations/workspaces/${workspaceID}/archive`, options);
  }
}

export type WorkspacesPage = Page<Workspace>;

export type WorkspaceMembersPage = Page<WorkspaceMember>;

export type AllowedInferenceGeo = 'global' | 'us';

export interface DataResidency {
  /**
   * Permitted inference geo values. 'unrestricted' means all geos are allowed.
   */
  allowed_inference_geos: Array<AllowedInferenceGeo> | 'unrestricted';

  /**
   * Default inference geo applied when requests omit the parameter.
   */
  default_inference_geo: 'global' | 'us';

  /**
   * Geographic region for workspace data storage. Immutable after creation.
   */
  workspace_geo: 'us';
}

export interface DataResidencyCreateConfig {
  /**
   * Permitted inference geo values. Defaults to 'unrestricted' if omitted, which
   * allows all geos. Use the string 'unrestricted' to allow all geos, or a list of
   * specific geos.
   */
  allowed_inference_geos?: Array<AllowedInferenceGeo> | 'unrestricted' | null;

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

export interface DataResidencyUpdateConfig {
  /**
   * Permitted inference geo values. Use 'unrestricted' to allow all geos, or a list
   * of specific geos.
   */
  allowed_inference_geos?: Array<AllowedInferenceGeo> | 'unrestricted' | null;

  /**
   * Default inference geo applied when requests omit the parameter. Must be a member
   * of `allowed_inference_geos` unless `allowed_inference_geos` is `"unrestricted"`.
   */
  default_inference_geo?: 'global' | 'us' | null;
}

export type NoBillingWorkspaceRole =
  | 'workspace_admin'
  | 'workspace_developer'
  | 'workspace_restricted_developer'
  | 'workspace_user';

export interface Workspace {
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
   * for the required key configuration; unless your organization is on Claude
   * Platform on AWS, it includes a separate value used during key validation. On
   * Claude Platform on AWS there is no separate validation value: the key is
   * validated against this Workspace's own value when it is attached, so if your key
   * policy uses the compartment condition, add this value to it before attaching the
   * key.
   */
  compartment_id: string;

  /**
   * RFC 3339 datetime string indicating when the Workspace was created.
   */
  created_at: string;

  /**
   * Data residency configuration.
   */
  data_residency: DataResidency;

  /**
   * Hex color code representing the Workspace in the Anthropic Console.
   */
  display_color: string;

  /**
   * ID of the customer-managed encryption key (CMEK) configuration to use for this
   * Workspace. Setting this field requires CMEK to be enabled for your organization.
   * When set, data stored for this Workspace is encrypted with the referenced key.
   * Create key configurations with the External Keys API. On Claude Platform on AWS
   * the value is the AWS KMS key ARN, and the key must be a single-Region key in the
   * same AWS account and Region as the Workspace. On that platform the key is
   * validated against this Workspace when it is attached, so a key-policy problem is
   * reported as an error on this request. This field is write-once: once a key is
   * attached to a Workspace it cannot be detached or replaced. To rotate key
   * material, rotate the underlying key on your cloud KMS; the `external_key_id`
   * stays the same.
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

export interface WorkspaceMember {
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
  workspace_role: WorkspaceRole;
}

export type WorkspaceRole =
  | 'workspace_admin'
  | 'workspace_billing'
  | 'workspace_developer'
  | 'workspace_restricted_developer'
  | 'workspace_user';

export interface WorkspaceCreateParams {
  /**
   * Name of the Workspace.
   */
  name: string;

  /**
   * Data residency configuration for the workspace. If omitted, defaults to
   * `workspace_geo: "us"`, `allowed_inference_geos: "unrestricted"`, and
   * `default_inference_geo: "global"`.
   */
  data_residency?: DataResidencyCreateConfig | null;

  /**
   * Hex color code representing the Workspace in the Anthropic Console.
   */
  display_color?: string | null;

  /**
   * ID of the customer-managed encryption key (CMEK) configuration to use for this
   * Workspace. Setting this field requires CMEK to be enabled for your organization.
   * When set, data stored for this Workspace is encrypted with the referenced key.
   * Create key configurations with the External Keys API. On Claude Platform on AWS
   * the value is the AWS KMS key ARN, and the key must be a single-Region key in the
   * same AWS account and Region as the Workspace. On that platform the key is
   * validated against this Workspace when it is attached, so a key-policy problem is
   * reported as an error on this request. This field is write-once: once a key is
   * attached to a Workspace it cannot be detached or replaced. To rotate key
   * material, rotate the underlying key on your cloud KMS; the `external_key_id`
   * stays the same.
   */
  external_key_id?: string | null;

  /**
   * User-defined tags as string key-value pairs. Keys may not begin with
   * `anthropic`.
   */
  tags?: { [key: string]: string } | null;
}

export interface WorkspaceUpdateParams {
  /**
   * Data residency configuration for the workspace.
   */
  data_residency?: DataResidencyUpdateConfig | null;

  /**
   * Hex color code representing the Workspace in the Anthropic Console.
   */
  display_color?: string;

  /**
   * ID of the customer-managed encryption key (CMEK) configuration to use for this
   * Workspace. Setting this field requires CMEK to be enabled for your organization.
   * When set, data stored for this Workspace is encrypted with the referenced key.
   * Create key configurations with the External Keys API. On Claude Platform on AWS
   * the value is the AWS KMS key ARN, and the key must be a single-Region key in the
   * same AWS account and Region as the Workspace. On that platform the key is
   * validated against this Workspace when it is attached, so a key-policy problem is
   * reported as an error on this request. This field is write-once: once a key is
   * attached to a Workspace it cannot be detached or replaced. To rotate key
   * material, rotate the underlying key on your cloud KMS; the `external_key_id`
   * stays the same.
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
    type AllowedInferenceGeo as AllowedInferenceGeo,
    type DataResidency as DataResidency,
    type DataResidencyCreateConfig as DataResidencyCreateConfig,
    type DataResidencyUpdateConfig as DataResidencyUpdateConfig,
    type NoBillingWorkspaceRole as NoBillingWorkspaceRole,
    type Workspace as Workspace,
    type WorkspaceMember as WorkspaceMember,
    type WorkspaceRole as WorkspaceRole,
    type WorkspacesPage as WorkspacesPage,
    type WorkspaceCreateParams as WorkspaceCreateParams,
    type WorkspaceUpdateParams as WorkspaceUpdateParams,
    type WorkspaceListParams as WorkspaceListParams,
  };

  export {
    RateLimits as RateLimits,
    type WorkspaceRateLimit as WorkspaceRateLimit,
    type WorkspaceRateLimitOrganizationSource as WorkspaceRateLimitOrganizationSource,
    type WorkspaceRateLimitValue as WorkspaceRateLimitValue,
    type WorkspaceRateLimitWorkspaceSource as WorkspaceRateLimitWorkspaceSource,
    type WorkspaceRateLimitsPageCursor as WorkspaceRateLimitsPageCursor,
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
