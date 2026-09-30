import { APIResource } from '../../core/resource';
import * as APIKeysAPI from './api-keys';
import {
  APIKey,
  APIKeyCreatedBy,
  APIKeyListParams,
  APIKeyOrganizationScope,
  APIKeyServiceAccountActor,
  APIKeyUpdateParams,
  APIKeyUserActor,
  APIKeyWorkspaceScope,
  APIKeys,
  APIKeysPage,
} from './api-keys';
import * as ComplianceSettingsAPI from './compliance-settings';
import {
  ComplianceSettingUpdateParams,
  ComplianceSettings,
  ComplianceSettingsState,
  ComplianceSettingsStateDisabled,
  ComplianceSettingsStateDisabledParam,
  ComplianceSettingsStateEnabled,
  ComplianceSettingsStateEnabledParam,
  ComplianceSettingsStateParam,
  OrganizationComplianceSettings,
} from './compliance-settings';
import * as ExternalKeysAPI from './external-keys';
import {
  AWSExternalKeyConfig,
  AzureExternalKeyConfig,
  AzureExternalKeyConfigParam,
  ExternalKey,
  ExternalKeyAttachedAttachment,
  ExternalKeyCreateParams,
  ExternalKeyDeleteResponse,
  ExternalKeyListParams,
  ExternalKeyUnattachedAttachment,
  ExternalKeyUpdateParams,
  ExternalKeyValidateResponse,
  ExternalKeys,
  ExternalKeysPageCursor,
  GCPExternalKeyConfig,
} from './external-keys';
import * as InvitesAPI from './invites';
import {
  InviteCreateParams,
  InviteDeleteResponse,
  InviteListParams,
  Invites,
  OrganizationInvite,
  OrganizationInvitesPage,
} from './invites';
import * as RateLimitsAPI from './rate-limits';
import {
  OrganizationRateLimit,
  OrganizationRateLimitBatchGroup,
  OrganizationRateLimitFilesGroup,
  OrganizationRateLimitModelGroup,
  OrganizationRateLimitSkillsGroup,
  OrganizationRateLimitTokenCountGroup,
  OrganizationRateLimitValue,
  OrganizationRateLimitWebSearchGroup,
  OrganizationRateLimitsPageCursor,
  RateLimitListParams,
  RateLimits,
} from './rate-limits';
import * as UsersAPI from './users';
import {
  OrganizationUser,
  OrganizationUsersPage,
  UserListParams,
  UserRemoveResponse,
  UserUpdateParams,
  Users,
} from './users';
import * as FederationAPI from './federation/federation';
import { Federation } from './federation/federation';
import * as ServiceAccountsAPI from './service-accounts/service-accounts';
import {
  ServiceAccount,
  ServiceAccountCreateParams,
  ServiceAccountListParams,
  ServiceAccountUpdateParams,
  ServiceAccountWorkspaceMember,
  ServiceAccounts,
  ServiceAccountsPageCursor,
} from './service-accounts/service-accounts';
import * as WorkspacesAPI from './workspaces/workspaces';
import {
  AllowedInferenceGeo,
  DataResidency,
  DataResidencyCreateConfig,
  DataResidencyUpdateConfig,
  NoBillingWorkspaceRole,
  Workspace,
  WorkspaceCreateParams,
  WorkspaceListParams,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceUpdateParams,
  Workspaces,
  WorkspacesPage,
} from './workspaces/workspaces';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';

export class Organization extends APIResource {
  apiKeys: APIKeysAPI.APIKeys = new APIKeysAPI.APIKeys(this._client);
  externalKeys: ExternalKeysAPI.ExternalKeys = new ExternalKeysAPI.ExternalKeys(this._client);
  federation: FederationAPI.Federation = new FederationAPI.Federation(this._client);
  invites: InvitesAPI.Invites = new InvitesAPI.Invites(this._client);
  serviceAccounts: ServiceAccountsAPI.ServiceAccounts = new ServiceAccountsAPI.ServiceAccounts(this._client);
  users: UsersAPI.Users = new UsersAPI.Users(this._client);
  workspaces: WorkspacesAPI.Workspaces = new WorkspacesAPI.Workspaces(this._client);
  rateLimits: RateLimitsAPI.RateLimits = new RateLimitsAPI.RateLimits(this._client);
  complianceSettings: ComplianceSettingsAPI.ComplianceSettings = new ComplianceSettingsAPI.ComplianceSettings(
    this._client,
  );

  /**
   * Retrieve information about the organization associated with the authenticated
   * API key.
   *
   * @example
   * ```ts
   * const organizationInfo =
   *   await client.organization.retrieve();
   * ```
   */
  retrieve(options?: RequestOptions): APIPromise<OrganizationInfo> {
    return this._client.get('/v1/organizations/me', options);
  }
}

export interface OrganizationInfo {
  /**
   * ID of the Organization.
   */
  id: string;

  /**
   * Name of the Organization.
   */
  name: string;

  /**
   * Object type.
   *
   * For Organizations, this is always `"organization"`.
   */
  type: 'organization';
}

export type OrganizationRole =
  | 'admin'
  | 'billing'
  | 'claude_code_user'
  | 'developer'
  | 'managed'
  | 'membership_admin'
  | 'owner'
  | 'primary_owner'
  | 'user';

Organization.APIKeys = APIKeys;
Organization.ExternalKeys = ExternalKeys;
Organization.Federation = Federation;
Organization.Invites = Invites;
Organization.ServiceAccounts = ServiceAccounts;
Organization.Users = Users;
Organization.Workspaces = Workspaces;
Organization.RateLimits = RateLimits;
Organization.ComplianceSettings = ComplianceSettings;

export declare namespace Organization {
  export { type OrganizationInfo as OrganizationInfo, type OrganizationRole as OrganizationRole };

  export {
    APIKeys as APIKeys,
    type APIKey as APIKey,
    type APIKeyCreatedBy as APIKeyCreatedBy,
    type APIKeyOrganizationScope as APIKeyOrganizationScope,
    type APIKeyServiceAccountActor as APIKeyServiceAccountActor,
    type APIKeyUserActor as APIKeyUserActor,
    type APIKeyWorkspaceScope as APIKeyWorkspaceScope,
    type APIKeysPage as APIKeysPage,
    type APIKeyUpdateParams as APIKeyUpdateParams,
    type APIKeyListParams as APIKeyListParams,
  };

  export {
    ExternalKeys as ExternalKeys,
    type AWSExternalKeyConfig as AWSExternalKeyConfig,
    type AzureExternalKeyConfig as AzureExternalKeyConfig,
    type AzureExternalKeyConfigParam as AzureExternalKeyConfigParam,
    type ExternalKey as ExternalKey,
    type ExternalKeyAttachedAttachment as ExternalKeyAttachedAttachment,
    type ExternalKeyUnattachedAttachment as ExternalKeyUnattachedAttachment,
    type GCPExternalKeyConfig as GCPExternalKeyConfig,
    type ExternalKeyDeleteResponse as ExternalKeyDeleteResponse,
    type ExternalKeyValidateResponse as ExternalKeyValidateResponse,
    type ExternalKeysPageCursor as ExternalKeysPageCursor,
    type ExternalKeyCreateParams as ExternalKeyCreateParams,
    type ExternalKeyUpdateParams as ExternalKeyUpdateParams,
    type ExternalKeyListParams as ExternalKeyListParams,
  };

  export { Federation as Federation };

  export {
    Invites as Invites,
    type OrganizationInvite as OrganizationInvite,
    type InviteDeleteResponse as InviteDeleteResponse,
    type OrganizationInvitesPage as OrganizationInvitesPage,
    type InviteCreateParams as InviteCreateParams,
    type InviteListParams as InviteListParams,
  };

  export {
    ServiceAccounts as ServiceAccounts,
    type ServiceAccount as ServiceAccount,
    type ServiceAccountWorkspaceMember as ServiceAccountWorkspaceMember,
    type ServiceAccountsPageCursor as ServiceAccountsPageCursor,
    type ServiceAccountCreateParams as ServiceAccountCreateParams,
    type ServiceAccountUpdateParams as ServiceAccountUpdateParams,
    type ServiceAccountListParams as ServiceAccountListParams,
  };

  export {
    Users as Users,
    type OrganizationUser as OrganizationUser,
    type UserRemoveResponse as UserRemoveResponse,
    type OrganizationUsersPage as OrganizationUsersPage,
    type UserUpdateParams as UserUpdateParams,
    type UserListParams as UserListParams,
  };

  export {
    Workspaces as Workspaces,
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
    type OrganizationRateLimit as OrganizationRateLimit,
    type OrganizationRateLimitBatchGroup as OrganizationRateLimitBatchGroup,
    type OrganizationRateLimitFilesGroup as OrganizationRateLimitFilesGroup,
    type OrganizationRateLimitModelGroup as OrganizationRateLimitModelGroup,
    type OrganizationRateLimitSkillsGroup as OrganizationRateLimitSkillsGroup,
    type OrganizationRateLimitTokenCountGroup as OrganizationRateLimitTokenCountGroup,
    type OrganizationRateLimitValue as OrganizationRateLimitValue,
    type OrganizationRateLimitWebSearchGroup as OrganizationRateLimitWebSearchGroup,
    type OrganizationRateLimitsPageCursor as OrganizationRateLimitsPageCursor,
    type RateLimitListParams as RateLimitListParams,
  };

  export {
    ComplianceSettings as ComplianceSettings,
    type ComplianceSettingsState as ComplianceSettingsState,
    type ComplianceSettingsStateDisabled as ComplianceSettingsStateDisabled,
    type ComplianceSettingsStateDisabledParam as ComplianceSettingsStateDisabledParam,
    type ComplianceSettingsStateEnabled as ComplianceSettingsStateEnabled,
    type ComplianceSettingsStateEnabledParam as ComplianceSettingsStateEnabledParam,
    type ComplianceSettingsStateParam as ComplianceSettingsStateParam,
    type OrganizationComplianceSettings as OrganizationComplianceSettings,
    type ComplianceSettingUpdateParams as ComplianceSettingUpdateParams,
  };
}
