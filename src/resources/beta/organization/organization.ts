// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as APIKeysAPI from './api-keys';
import {
  APIKeyListParams,
  APIKeyUpdateParams,
  APIKeys,
  BetaAPIKey,
  BetaAPIKeyCreatedBy,
  BetaAPIKeyOrganizationScope,
  BetaAPIKeyServiceAccountActor,
  BetaAPIKeyUserActor,
  BetaAPIKeyWorkspaceScope,
  BetaAPIKeysPage,
} from './api-keys';
import * as ExternalKeysAPI from './external-keys';
import {
  BetaAWSExternalKeyConfig,
  BetaAzureExternalKeyConfig,
  BetaAzureExternalKeyConfigParam,
  BetaExternalKey,
  BetaExternalKeyAttachedAttachment,
  BetaExternalKeyUnattachedAttachment,
  BetaExternalKeysPageCursor,
  BetaGCPExternalKeyConfig,
  ExternalKeyCreateParams,
  ExternalKeyDeleteResponse,
  ExternalKeyListParams,
  ExternalKeyUpdateParams,
  ExternalKeyValidateResponse,
  ExternalKeys,
} from './external-keys';
import * as InvitesAPI from './invites';
import {
  BetaOrganizationInvite,
  BetaOrganizationInvitesPage,
  InviteCreateParams,
  InviteDeleteResponse,
  InviteListParams,
  Invites,
} from './invites';
import * as RateLimitsAPI from './rate-limits';
import {
  BetaOrganizationRateLimit,
  BetaOrganizationRateLimitValue,
  BetaOrganizationRateLimitsPageCursor,
  RateLimitListParams,
  RateLimits,
} from './rate-limits';
import * as UsersAPI from './users';
import {
  BetaOrganizationUser,
  BetaOrganizationUsersPage,
  UserListParams,
  UserRemoveResponse,
  UserUpdateParams,
  Users,
} from './users';
import * as FederationAPI from './federation/federation';
import { Federation } from './federation/federation';
import * as ServiceAccountsAPI from './service-accounts/service-accounts';
import {
  BetaServiceAccount,
  BetaServiceAccountWorkspaceMember,
  BetaServiceAccountsPageCursor,
  ServiceAccountArchiveParams,
  ServiceAccountCreateParams,
  ServiceAccountListParams,
  ServiceAccountRetrieveParams,
  ServiceAccountUpdateParams,
  ServiceAccounts,
} from './service-accounts/service-accounts';
import * as WorkspacesAPI from './workspaces/workspaces';
import {
  BetaAllowedInferenceGeo,
  BetaDataResidency,
  BetaDataResidencyCreateConfig,
  BetaDataResidencyUpdateConfig,
  BetaNoBillingWorkspaceRole,
  BetaWorkspace,
  BetaWorkspaceMember,
  BetaWorkspaceRole,
  BetaWorkspacesPage,
  WorkspaceCreateParams,
  WorkspaceListParams,
  WorkspaceUpdateParams,
  Workspaces,
} from './workspaces/workspaces';
import { APIPromise } from '../../../core/api-promise';
import { RequestOptions } from '../../../internal/request-options';

export class Organization extends APIResource {
  apiKeys: APIKeysAPI.APIKeys = new APIKeysAPI.APIKeys(this._client);
  externalKeys: ExternalKeysAPI.ExternalKeys = new ExternalKeysAPI.ExternalKeys(this._client);
  federation: FederationAPI.Federation = new FederationAPI.Federation(this._client);
  invites: InvitesAPI.Invites = new InvitesAPI.Invites(this._client);
  serviceAccounts: ServiceAccountsAPI.ServiceAccounts = new ServiceAccountsAPI.ServiceAccounts(this._client);
  users: UsersAPI.Users = new UsersAPI.Users(this._client);
  workspaces: WorkspacesAPI.Workspaces = new WorkspacesAPI.Workspaces(this._client);
  rateLimits: RateLimitsAPI.RateLimits = new RateLimitsAPI.RateLimits(this._client);

  /**
   * Retrieve information about the organization associated with the authenticated
   * API key.
   *
   * @example
   * ```ts
   * const betaOrganization =
   *   await client.beta.organization.retrieve();
   * ```
   */
  retrieve(options?: RequestOptions): APIPromise<BetaOrganization> {
    return this._client.get('/v1/organizations/me?beta=true', options);
  }
}

export interface BetaOrganization {
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

export type BetaOrganizationRole =
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

export declare namespace Organization {
  export { type BetaOrganization as BetaOrganization, type BetaOrganizationRole as BetaOrganizationRole };

  export {
    APIKeys as APIKeys,
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

  export {
    ExternalKeys as ExternalKeys,
    type BetaAWSExternalKeyConfig as BetaAWSExternalKeyConfig,
    type BetaAzureExternalKeyConfig as BetaAzureExternalKeyConfig,
    type BetaAzureExternalKeyConfigParam as BetaAzureExternalKeyConfigParam,
    type BetaExternalKey as BetaExternalKey,
    type BetaExternalKeyAttachedAttachment as BetaExternalKeyAttachedAttachment,
    type BetaExternalKeyUnattachedAttachment as BetaExternalKeyUnattachedAttachment,
    type BetaGCPExternalKeyConfig as BetaGCPExternalKeyConfig,
    type ExternalKeyDeleteResponse as ExternalKeyDeleteResponse,
    type ExternalKeyValidateResponse as ExternalKeyValidateResponse,
    type BetaExternalKeysPageCursor as BetaExternalKeysPageCursor,
    type ExternalKeyCreateParams as ExternalKeyCreateParams,
    type ExternalKeyUpdateParams as ExternalKeyUpdateParams,
    type ExternalKeyListParams as ExternalKeyListParams,
  };

  export { Federation as Federation };

  export {
    Invites as Invites,
    type BetaOrganizationInvite as BetaOrganizationInvite,
    type InviteDeleteResponse as InviteDeleteResponse,
    type BetaOrganizationInvitesPage as BetaOrganizationInvitesPage,
    type InviteCreateParams as InviteCreateParams,
    type InviteListParams as InviteListParams,
  };

  export {
    ServiceAccounts as ServiceAccounts,
    type BetaServiceAccount as BetaServiceAccount,
    type BetaServiceAccountWorkspaceMember as BetaServiceAccountWorkspaceMember,
    type BetaServiceAccountsPageCursor as BetaServiceAccountsPageCursor,
    type ServiceAccountCreateParams as ServiceAccountCreateParams,
    type ServiceAccountRetrieveParams as ServiceAccountRetrieveParams,
    type ServiceAccountUpdateParams as ServiceAccountUpdateParams,
    type ServiceAccountListParams as ServiceAccountListParams,
    type ServiceAccountArchiveParams as ServiceAccountArchiveParams,
  };

  export {
    Users as Users,
    type BetaOrganizationUser as BetaOrganizationUser,
    type UserRemoveResponse as UserRemoveResponse,
    type BetaOrganizationUsersPage as BetaOrganizationUsersPage,
    type UserUpdateParams as UserUpdateParams,
    type UserListParams as UserListParams,
  };

  export {
    Workspaces as Workspaces,
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
    type BetaOrganizationRateLimit as BetaOrganizationRateLimit,
    type BetaOrganizationRateLimitValue as BetaOrganizationRateLimitValue,
    type BetaOrganizationRateLimitsPageCursor as BetaOrganizationRateLimitsPageCursor,
    type RateLimitListParams as RateLimitListParams,
  };
}
