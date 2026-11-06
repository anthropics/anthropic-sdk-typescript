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
  OrgAPIKeyLimitExceededError,
  OrgAPIKeyLimitExceededErrorDetails,
  WorkspaceAPIKeyLimitExceededError,
  WorkspaceAPIKeyLimitExceededErrorDetails,
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
  ExternalKeyChangedError,
  ExternalKeyChangedErrorDetails,
  ExternalKeyCreateParams,
  ExternalKeyDeleteResponse,
  ExternalKeyInWorkspacePolicyError,
  ExternalKeyInWorkspacePolicyErrorDetails,
  ExternalKeyListParams,
  ExternalKeyUnattachedAttachment,
  ExternalKeyUpdateParams,
  ExternalKeyValidateResponse,
  ExternalKeyValidationFailedError,
  ExternalKeyValidationFailedErrorDetails,
  ExternalKeyValidationTimedOutError,
  ExternalKeyValidationTimedOutErrorDetails,
  ExternalKeys,
  ExternalKeysPageCursor,
  GCPExternalKeyConfig,
} from './external-keys';
import * as InvitesAPI from './invites';
import {
  AlreadyMemberError,
  AlreadyMemberErrorDetails,
  CannotInviteEmailsWithUnverifiedDomainsError,
  CannotInviteEmailsWithUnverifiedDomainsErrorDetails,
  EmailDomainNotAllowedError,
  EmailDomainNotAllowedErrorDetails,
  InviteAlreadyExistsError,
  InviteAlreadyExistsErrorDetails,
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
  CannotRemoveLastMemberError,
  CannotRemoveLastMemberErrorDetails,
  OrganizationUser,
  OrganizationUsersPage,
  UserListParams,
  UserRemoveResponse,
  UserUpdateParams,
  Users,
} from './users';
import * as AnalyticsAPI from './analytics/analytics';
import {
  Analytics,
  AnalyticsArtifactActivity,
  AnalyticsArtifactGroupBy,
  AnalyticsChatCoworkUnifiedChatMetrics,
  AnalyticsChatCoworkUnifiedMetrics,
  AnalyticsChatCoworkUnifiedSessionsMetrics,
  AnalyticsChatMetrics,
  AnalyticsClaudeCodeMetrics,
  AnalyticsConnectorActivity,
  AnalyticsConnectorChatCoworkUnifiedChatMetrics,
  AnalyticsConnectorChatCoworkUnifiedMetrics,
  AnalyticsConnectorChatCoworkUnifiedSessionsMetrics,
  AnalyticsConnectorChatMetrics,
  AnalyticsConnectorClaudeCodeMetrics,
  AnalyticsConnectorCoworkMetrics,
  AnalyticsConnectorGroupBy,
  AnalyticsConnectorOfficeMetrics,
  AnalyticsConnectorOfficeProductMetrics,
  AnalyticsCoreCodeMetrics,
  AnalyticsCoworkMetrics,
  AnalyticsDesignMetrics,
  AnalyticsLinesOfCode,
  AnalyticsOfficeMetrics,
  AnalyticsOfficeProductMetrics,
  AnalyticsOrder,
  AnalyticsPluginActivity,
  AnalyticsPluginChatCoworkUnifiedMetrics,
  AnalyticsPluginClaudeCodeMetrics,
  AnalyticsPluginCoworkMetrics,
  AnalyticsPluginGroupBy,
  AnalyticsProjectActivity,
  AnalyticsProjectGroupBy,
  AnalyticsScienceMetrics,
  AnalyticsSingleDayActivitySummary,
  AnalyticsSkillActivity,
  AnalyticsSkillChatCoworkUnifiedChatMetrics,
  AnalyticsSkillChatCoworkUnifiedMetrics,
  AnalyticsSkillChatCoworkUnifiedSessionsMetrics,
  AnalyticsSkillChatMetrics,
  AnalyticsSkillClaudeCodeMetrics,
  AnalyticsSkillCoworkMetrics,
  AnalyticsSkillGroupBy,
  AnalyticsSkillOfficeMetrics,
  AnalyticsSkillOfficeProductMetrics,
  AnalyticsToolActionCounts,
  AnalyticsToolActions,
  AnalyticsUser,
  AnalyticsUserActivity,
  AnalyticsUserGroupBy,
} from './analytics/analytics';
import * as FederationAPI from './federation/federation';
import { Federation } from './federation/federation';
import * as RBACGroupsAPI from './rbac-groups/rbac-groups';
import {
  DeletedRBACGroup,
  RBACGroup,
  RBACGroupCreateParams,
  RBACGroupGrantsOwnerAccessError,
  RBACGroupGrantsOwnerAccessErrorDetails,
  RBACGroupListParams,
  RBACGroupOwnerAccessUnconfirmedError,
  RBACGroupOwnerAccessUnconfirmedErrorDetails,
  RBACGroupUpdateParams,
  RBACGroups,
  RBACGroupsPageCursor,
} from './rbac-groups/rbac-groups';
import * as RBACRolesAPI from './rbac-roles/rbac-roles';
import { RBACRole, RBACRoleListParams, RBACRoles, RBACRolesPageCursor } from './rbac-roles/rbac-roles';
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
import * as SpendLimitsAPI from './spend-limits/spend-limits';
import {
  SpendLimit,
  SpendLimitOrganizationScope,
  SpendLimitOrganizationServiceScope,
  SpendLimitPeriod,
  SpendLimitRBACGroupScope,
  SpendLimitScopedAPIKeyActor,
  SpendLimitSeatTierScope,
  SpendLimitUsageTierScope,
  SpendLimitUserActor,
  SpendLimitUserScope,
  SpendLimitWorkspaceScope,
  SpendLimits,
  SpendSummary,
} from './spend-limits/spend-limits';
import * as WorkspacesAPI from './workspaces/workspaces';
import {
  AllowedInferenceGeo,
  DataResidency,
  DataResidencyCreateConfig,
  DataResidencyUpdateConfig,
  KeyProfileMismatchError,
  KeyProfileMismatchErrorDetails,
  NoBillingWorkspaceRole,
  Workspace,
  WorkspaceCreateParams,
  WorkspaceListParams,
  WorkspaceMember,
  WorkspaceMemberLimitExceededError,
  WorkspaceMemberLimitExceededErrorDetails,
  WorkspacePolicyField,
  WorkspacePolicyViolationError,
  WorkspacePolicyViolationErrorDetails,
  WorkspaceRole,
  WorkspaceUpdateParams,
  Workspaces,
  WorkspacesPage,
} from './workspaces/workspaces';
import { APIPromise } from '../../core/api-promise';
import { BadRequestError, ConflictError } from '../../core/error';
import { RequestOptions } from '../../internal/request-options';
import { startApiCallSpan } from '../../internal/tracing';

/**
 * The organization has reached the member limit that Anthropic set for it. Pending
 * invites count toward the limit.
 */
export class OrgMemberLimitExceededError extends BadRequestError {
  declare readonly errorCode: 'org_member_limit_exceeded';
  declare readonly details: OrgMemberLimitExceededErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'OrgMemberLimitExceededError';
}

/**
 * Another change to the organization's members is in progress. Retry the request
 * once it completes.
 */
export class ConcurrentMembershipChangeError extends ConflictError {
  declare readonly errorCode: 'concurrent_membership_change';
  declare readonly details: ConcurrentMembershipChangeErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'ConcurrentMembershipChangeError';
}

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
  analytics: AnalyticsAPI.Analytics = new AnalyticsAPI.Analytics(this._client);
  spendLimits: SpendLimitsAPI.SpendLimits = new SpendLimitsAPI.SpendLimits(this._client);
  rbacGroups: RBACGroupsAPI.RBACGroups = new RBACGroupsAPI.RBACGroups(this._client);
  rbacRoles: RBACRolesAPI.RBACRoles = new RBACRolesAPI.RBACRoles(this._client);

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
    return this._client.get('/v1/organizations/me', {
      ...options,
      __span: startApiCallSpan(this._client, 'anthropic.organization.retrieve', options, {
        route: '/v1/organizations/me',
      }),
    });
  }
}

/**
 * Another change to the organization's members is in progress. Retry the request
 * once it completes.
 */
export interface ConcurrentMembershipChangeErrorDetails {
  error_code: 'concurrent_membership_change';
}

/**
 * The organization has reached the member limit that Anthropic set for it. Pending
 * invites count toward the limit.
 */
export interface OrgMemberLimitExceededErrorDetails {
  error_code: 'org_member_limit_exceeded';
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

Organization.OrgMemberLimitExceededError = OrgMemberLimitExceededError;
Organization.ConcurrentMembershipChangeError = ConcurrentMembershipChangeError;
Organization.APIKeys = APIKeys;
Organization.OrgAPIKeyLimitExceededError = OrgAPIKeyLimitExceededError;
Organization.WorkspaceAPIKeyLimitExceededError = WorkspaceAPIKeyLimitExceededError;
Organization.ExternalKeys = ExternalKeys;
Organization.ExternalKeyInWorkspacePolicyError = ExternalKeyInWorkspacePolicyError;
Organization.ExternalKeyValidationFailedError = ExternalKeyValidationFailedError;
Organization.ExternalKeyValidationTimedOutError = ExternalKeyValidationTimedOutError;
Organization.ExternalKeyChangedError = ExternalKeyChangedError;
Organization.Federation = Federation;
Organization.Invites = Invites;
Organization.AlreadyMemberError = AlreadyMemberError;
Organization.CannotInviteEmailsWithUnverifiedDomainsError = CannotInviteEmailsWithUnverifiedDomainsError;
Organization.EmailDomainNotAllowedError = EmailDomainNotAllowedError;
Organization.InviteAlreadyExistsError = InviteAlreadyExistsError;
Organization.ServiceAccounts = ServiceAccounts;
Organization.Users = Users;
Organization.CannotRemoveLastMemberError = CannotRemoveLastMemberError;
Organization.Workspaces = Workspaces;
Organization.KeyProfileMismatchError = KeyProfileMismatchError;
Organization.WorkspaceMemberLimitExceededError = WorkspaceMemberLimitExceededError;
Organization.WorkspacePolicyViolationError = WorkspacePolicyViolationError;
Organization.RateLimits = RateLimits;
Organization.ComplianceSettings = ComplianceSettings;
Organization.Analytics = Analytics;
Organization.SpendLimits = SpendLimits;
Organization.RBACGroups = RBACGroups;
Organization.RBACGroupGrantsOwnerAccessError = RBACGroupGrantsOwnerAccessError;
Organization.RBACGroupOwnerAccessUnconfirmedError = RBACGroupOwnerAccessUnconfirmedError;
Organization.RBACRoles = RBACRoles;

export declare namespace Organization {
  export {
    OrgMemberLimitExceededError as OrgMemberLimitExceededError,
    ConcurrentMembershipChangeError as ConcurrentMembershipChangeError,
    type ConcurrentMembershipChangeErrorDetails as ConcurrentMembershipChangeErrorDetails,
    type OrgMemberLimitExceededErrorDetails as OrgMemberLimitExceededErrorDetails,
    type OrganizationInfo as OrganizationInfo,
    type OrganizationRole as OrganizationRole,
  };

  export {
    APIKeys as APIKeys,
    OrgAPIKeyLimitExceededError as OrgAPIKeyLimitExceededError,
    WorkspaceAPIKeyLimitExceededError as WorkspaceAPIKeyLimitExceededError,
    type APIKey as APIKey,
    type APIKeyCreatedBy as APIKeyCreatedBy,
    type APIKeyOrganizationScope as APIKeyOrganizationScope,
    type APIKeyServiceAccountActor as APIKeyServiceAccountActor,
    type APIKeyUserActor as APIKeyUserActor,
    type APIKeyWorkspaceScope as APIKeyWorkspaceScope,
    type OrgAPIKeyLimitExceededErrorDetails as OrgAPIKeyLimitExceededErrorDetails,
    type WorkspaceAPIKeyLimitExceededErrorDetails as WorkspaceAPIKeyLimitExceededErrorDetails,
    type APIKeysPage as APIKeysPage,
    type APIKeyUpdateParams as APIKeyUpdateParams,
    type APIKeyListParams as APIKeyListParams,
  };

  export {
    ExternalKeys as ExternalKeys,
    ExternalKeyInWorkspacePolicyError as ExternalKeyInWorkspacePolicyError,
    ExternalKeyValidationFailedError as ExternalKeyValidationFailedError,
    ExternalKeyValidationTimedOutError as ExternalKeyValidationTimedOutError,
    ExternalKeyChangedError as ExternalKeyChangedError,
    type AWSExternalKeyConfig as AWSExternalKeyConfig,
    type AzureExternalKeyConfig as AzureExternalKeyConfig,
    type AzureExternalKeyConfigParam as AzureExternalKeyConfigParam,
    type ExternalKey as ExternalKey,
    type ExternalKeyAttachedAttachment as ExternalKeyAttachedAttachment,
    type ExternalKeyChangedErrorDetails as ExternalKeyChangedErrorDetails,
    type ExternalKeyInWorkspacePolicyErrorDetails as ExternalKeyInWorkspacePolicyErrorDetails,
    type ExternalKeyUnattachedAttachment as ExternalKeyUnattachedAttachment,
    type ExternalKeyValidationFailedErrorDetails as ExternalKeyValidationFailedErrorDetails,
    type ExternalKeyValidationTimedOutErrorDetails as ExternalKeyValidationTimedOutErrorDetails,
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
    AlreadyMemberError as AlreadyMemberError,
    CannotInviteEmailsWithUnverifiedDomainsError as CannotInviteEmailsWithUnverifiedDomainsError,
    EmailDomainNotAllowedError as EmailDomainNotAllowedError,
    InviteAlreadyExistsError as InviteAlreadyExistsError,
    type AlreadyMemberErrorDetails as AlreadyMemberErrorDetails,
    type CannotInviteEmailsWithUnverifiedDomainsErrorDetails as CannotInviteEmailsWithUnverifiedDomainsErrorDetails,
    type EmailDomainNotAllowedErrorDetails as EmailDomainNotAllowedErrorDetails,
    type InviteAlreadyExistsErrorDetails as InviteAlreadyExistsErrorDetails,
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
    CannotRemoveLastMemberError as CannotRemoveLastMemberError,
    type CannotRemoveLastMemberErrorDetails as CannotRemoveLastMemberErrorDetails,
    type OrganizationUser as OrganizationUser,
    type UserRemoveResponse as UserRemoveResponse,
    type OrganizationUsersPage as OrganizationUsersPage,
    type UserUpdateParams as UserUpdateParams,
    type UserListParams as UserListParams,
  };

  export {
    Workspaces as Workspaces,
    KeyProfileMismatchError as KeyProfileMismatchError,
    WorkspaceMemberLimitExceededError as WorkspaceMemberLimitExceededError,
    WorkspacePolicyViolationError as WorkspacePolicyViolationError,
    type AllowedInferenceGeo as AllowedInferenceGeo,
    type DataResidency as DataResidency,
    type DataResidencyCreateConfig as DataResidencyCreateConfig,
    type DataResidencyUpdateConfig as DataResidencyUpdateConfig,
    type KeyProfileMismatchErrorDetails as KeyProfileMismatchErrorDetails,
    type NoBillingWorkspaceRole as NoBillingWorkspaceRole,
    type Workspace as Workspace,
    type WorkspaceMember as WorkspaceMember,
    type WorkspaceMemberLimitExceededErrorDetails as WorkspaceMemberLimitExceededErrorDetails,
    type WorkspacePolicyField as WorkspacePolicyField,
    type WorkspacePolicyViolationErrorDetails as WorkspacePolicyViolationErrorDetails,
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

  export {
    Analytics as Analytics,
    type AnalyticsArtifactActivity as AnalyticsArtifactActivity,
    type AnalyticsArtifactGroupBy as AnalyticsArtifactGroupBy,
    type AnalyticsChatCoworkUnifiedChatMetrics as AnalyticsChatCoworkUnifiedChatMetrics,
    type AnalyticsChatCoworkUnifiedMetrics as AnalyticsChatCoworkUnifiedMetrics,
    type AnalyticsChatCoworkUnifiedSessionsMetrics as AnalyticsChatCoworkUnifiedSessionsMetrics,
    type AnalyticsChatMetrics as AnalyticsChatMetrics,
    type AnalyticsClaudeCodeMetrics as AnalyticsClaudeCodeMetrics,
    type AnalyticsConnectorActivity as AnalyticsConnectorActivity,
    type AnalyticsConnectorChatCoworkUnifiedChatMetrics as AnalyticsConnectorChatCoworkUnifiedChatMetrics,
    type AnalyticsConnectorChatCoworkUnifiedMetrics as AnalyticsConnectorChatCoworkUnifiedMetrics,
    type AnalyticsConnectorChatCoworkUnifiedSessionsMetrics as AnalyticsConnectorChatCoworkUnifiedSessionsMetrics,
    type AnalyticsConnectorChatMetrics as AnalyticsConnectorChatMetrics,
    type AnalyticsConnectorClaudeCodeMetrics as AnalyticsConnectorClaudeCodeMetrics,
    type AnalyticsConnectorCoworkMetrics as AnalyticsConnectorCoworkMetrics,
    type AnalyticsConnectorGroupBy as AnalyticsConnectorGroupBy,
    type AnalyticsConnectorOfficeMetrics as AnalyticsConnectorOfficeMetrics,
    type AnalyticsConnectorOfficeProductMetrics as AnalyticsConnectorOfficeProductMetrics,
    type AnalyticsCoreCodeMetrics as AnalyticsCoreCodeMetrics,
    type AnalyticsCoworkMetrics as AnalyticsCoworkMetrics,
    type AnalyticsDesignMetrics as AnalyticsDesignMetrics,
    type AnalyticsLinesOfCode as AnalyticsLinesOfCode,
    type AnalyticsOfficeMetrics as AnalyticsOfficeMetrics,
    type AnalyticsOfficeProductMetrics as AnalyticsOfficeProductMetrics,
    type AnalyticsOrder as AnalyticsOrder,
    type AnalyticsPluginActivity as AnalyticsPluginActivity,
    type AnalyticsPluginChatCoworkUnifiedMetrics as AnalyticsPluginChatCoworkUnifiedMetrics,
    type AnalyticsPluginClaudeCodeMetrics as AnalyticsPluginClaudeCodeMetrics,
    type AnalyticsPluginCoworkMetrics as AnalyticsPluginCoworkMetrics,
    type AnalyticsPluginGroupBy as AnalyticsPluginGroupBy,
    type AnalyticsProjectActivity as AnalyticsProjectActivity,
    type AnalyticsProjectGroupBy as AnalyticsProjectGroupBy,
    type AnalyticsScienceMetrics as AnalyticsScienceMetrics,
    type AnalyticsSingleDayActivitySummary as AnalyticsSingleDayActivitySummary,
    type AnalyticsSkillActivity as AnalyticsSkillActivity,
    type AnalyticsSkillChatCoworkUnifiedChatMetrics as AnalyticsSkillChatCoworkUnifiedChatMetrics,
    type AnalyticsSkillChatCoworkUnifiedMetrics as AnalyticsSkillChatCoworkUnifiedMetrics,
    type AnalyticsSkillChatCoworkUnifiedSessionsMetrics as AnalyticsSkillChatCoworkUnifiedSessionsMetrics,
    type AnalyticsSkillChatMetrics as AnalyticsSkillChatMetrics,
    type AnalyticsSkillClaudeCodeMetrics as AnalyticsSkillClaudeCodeMetrics,
    type AnalyticsSkillCoworkMetrics as AnalyticsSkillCoworkMetrics,
    type AnalyticsSkillGroupBy as AnalyticsSkillGroupBy,
    type AnalyticsSkillOfficeMetrics as AnalyticsSkillOfficeMetrics,
    type AnalyticsSkillOfficeProductMetrics as AnalyticsSkillOfficeProductMetrics,
    type AnalyticsToolActionCounts as AnalyticsToolActionCounts,
    type AnalyticsToolActions as AnalyticsToolActions,
    type AnalyticsUser as AnalyticsUser,
    type AnalyticsUserActivity as AnalyticsUserActivity,
    type AnalyticsUserGroupBy as AnalyticsUserGroupBy,
  };

  export {
    SpendLimits as SpendLimits,
    type SpendLimit as SpendLimit,
    type SpendLimitOrganizationScope as SpendLimitOrganizationScope,
    type SpendLimitOrganizationServiceScope as SpendLimitOrganizationServiceScope,
    type SpendLimitPeriod as SpendLimitPeriod,
    type SpendLimitRBACGroupScope as SpendLimitRBACGroupScope,
    type SpendLimitScopedAPIKeyActor as SpendLimitScopedAPIKeyActor,
    type SpendLimitSeatTierScope as SpendLimitSeatTierScope,
    type SpendLimitUsageTierScope as SpendLimitUsageTierScope,
    type SpendLimitUserActor as SpendLimitUserActor,
    type SpendLimitUserScope as SpendLimitUserScope,
    type SpendLimitWorkspaceScope as SpendLimitWorkspaceScope,
    type SpendSummary as SpendSummary,
  };

  export {
    RBACGroups as RBACGroups,
    RBACGroupGrantsOwnerAccessError as RBACGroupGrantsOwnerAccessError,
    RBACGroupOwnerAccessUnconfirmedError as RBACGroupOwnerAccessUnconfirmedError,
    type DeletedRBACGroup as DeletedRBACGroup,
    type RBACGroup as RBACGroup,
    type RBACGroupGrantsOwnerAccessErrorDetails as RBACGroupGrantsOwnerAccessErrorDetails,
    type RBACGroupOwnerAccessUnconfirmedErrorDetails as RBACGroupOwnerAccessUnconfirmedErrorDetails,
    type RBACGroupsPageCursor as RBACGroupsPageCursor,
    type RBACGroupCreateParams as RBACGroupCreateParams,
    type RBACGroupUpdateParams as RBACGroupUpdateParams,
    type RBACGroupListParams as RBACGroupListParams,
  };

  export {
    RBACRoles as RBACRoles,
    type RBACRole as RBACRole,
    type RBACRolesPageCursor as RBACRolesPageCursor,
    type RBACRoleListParams as RBACRoleListParams,
  };
}
