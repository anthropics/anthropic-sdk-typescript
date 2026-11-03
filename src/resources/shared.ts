import * as FilesAPI from './files';
import * as BetaAPI from './beta/beta';
import * as MessagesAPI from './messages/messages';
import * as APIKeysAPI from './organization/api-keys';
import * as ExternalKeysAPI from './organization/external-keys';
import * as InvitesAPI from './organization/invites';
import * as OrganizationAPI from './organization/organization';
import * as UsersAPI from './organization/users';
import * as SkillsAPI from './skills/skills';
import * as UserProfilesAPI from './user-profiles/user-profiles';
import * as EnvironmentsAPI from './beta/environments/environments';
import * as WorkAPI from './beta/environments/work';
import * as BetaOrganizationAPI from './beta/organization/organization';
import * as RBACGroupsAPI from './organization/rbac-groups/rbac-groups';
import * as WorkspacesAPI from './organization/workspaces/workspaces';
import * as ClaudeTagAPI from './beta/organization/claude-tag/claude-tag';
import * as PluginsAPI from './beta/organization/plugins/plugins';
import * as SpendLimitsAPI from './beta/organization/spend-limits/spend-limits';

export interface APIErrorObject {
  message: string;

  type: 'api_error';
}

export interface AuthenticationError {
  message: string;

  type: 'authentication_error';
}

export interface BillingError {
  message: string;

  type: 'billing_error';
}

/**
 * The API key belongs to the Claude Code workspace, and the user who created it is
 * no longer a member of the organization or of that workspace.
 */
export interface ClaudeCodeKeyCreatorNotMemberErrorDetails {
  error_code: 'claude_code_key_creator_not_member';
}

/**
 * The request comes from a Claude Code version older than the minimum that the
 * requested model or the organization requires. Update Claude Code, then retry.
 */
export interface ClaudeCodeVersionTooOldErrorDetails {
  error_code: 'claude_code_version_too_old';
}

/**
 * The request's workspace encryption context could not be resolved, so the request
 * was refused. Retry in a few minutes.
 */
export interface CmekContextUnavailableErrorDetails {
  error_code: 'cmek_context_unavailable';
}

/**
 * The workspace's customer-managed encryption key is disabled or revoked.
 * Re-enable the key, then retry.
 */
export interface CmekKeyDisabledErrorDetails {
  error_code: 'cmek_key_disabled';
}

/**
 * The key management service's network access controls blocked the request to the
 * workspace's customer-managed encryption key. The key itself may be healthy.
 */
export interface CmekKeyNetworkBlockedErrorDetails {
  error_code: 'cmek_key_network_blocked';
}

/**
 * The workspace's customer-managed encryption key could not be reached. Retry the
 * request; if this continues, check that the key is available in your key
 * management service, or contact Anthropic support.
 */
export interface CmekKeyUnreachableErrorDetails {
  error_code: 'cmek_key_unreachable';
}

/**
 * The organization has crossed the monthly API usage threshold of its API tier.
 */
export interface EnforcedSpendLimitReachedErrorDetails {
  error_code: 'enforced_spend_limit_reached';
}

export type ErrorDetails =
  | MessagesAPI.AvailableToolsLimitExceededErrorDetails
  | ClaudeCodeKeyCreatorNotMemberErrorDetails
  | ClaudeCodeVersionTooOldErrorDetails
  | CmekKeyDisabledErrorDetails
  | CmekKeyNetworkBlockedErrorDetails
  | MessagesAPI.CompactionBlockAmbiguousErrorDetails
  | MessagesAPI.CompactionBlockMisplacedErrorDetails
  | MessagesAPI.CompactionContentMismatchErrorDetails
  | MessagesAPI.CompactionIncompleteTurnErrorDetails
  | MessagesAPI.CompactionNothingToSummarizeErrorDetails
  | MessagesAPI.CompactionSignatureInvalidErrorDetails
  | MessagesAPI.CompactionTooManyToolReferencesErrorDetails
  | MessagesAPI.CompactionToolChangesMismatchErrorDetails
  | OrganizationOnHoldErrorDetails
  | RequestBodyEncodingInvalidErrorDetails
  | RequestBodyEncodingUnsupportedErrorDetails
  | MessagesAPI.ThreadAlreadyContinuedErrorDetails
  | MessagesAPI.ThreadContinueInFlightErrorDetails
  | MessagesAPI.ThreadFingerprintMismatchErrorDetails
  | MessagesAPI.ThreadUnsupportedRequestErrorDetails
  | MessagesAPI.ToolNameConflictErrorDetails
  | MessagesAPI.ToolReferenceUnresolvedErrorDetails
  | MessagesAPI.ThreadNotFoundErrorDetails
  | SkillsAPI.SkillReadBlockedUndecryptableErrorDetails
  | RequestBodyTooLargeAfterDecodingErrorDetails
  | EnforcedSpendLimitReachedErrorDetails
  | CmekKeyUnreachableErrorDetails
  | MessagesAPI.CompactionUnavailableErrorDetails
  | FilesAPI.StorageQuotaExceededErrorDetails
  | FilesAPI.FileNotDownloadableErrorDetails
  | FilesAPI.FileExpiredErrorDetails
  | CmekContextUnavailableErrorDetails
  | APIKeysAPI.OrgAPIKeyLimitExceededErrorDetails
  | APIKeysAPI.WorkspaceAPIKeyLimitExceededErrorDetails
  | UserProfilesAPI.UserProfileNotFoundErrorDetails
  | ExternalKeysAPI.ExternalKeyInWorkspacePolicyErrorDetails
  | InvitesAPI.AlreadyMemberErrorDetails
  | InvitesAPI.CannotInviteEmailsWithUnverifiedDomainsErrorDetails
  | InvitesAPI.EmailDomainNotAllowedErrorDetails
  | InvitesAPI.InviteAlreadyExistsErrorDetails
  | OrganizationAPI.OrgMemberLimitExceededErrorDetails
  | RBACGroupsAPI.RBACGroupGrantsOwnerAccessErrorDetails
  | RBACGroupsAPI.RBACGroupOwnerAccessUnconfirmedErrorDetails
  | UsersAPI.CannotRemoveLastMemberErrorDetails
  | OrganizationAPI.ConcurrentMembershipChangeErrorDetails
  | WorkspacesAPI.KeyProfileMismatchErrorDetails
  | WorkspacesAPI.WorkspacePolicyViolationErrorDetails
  | ExternalKeysAPI.ExternalKeyChangedErrorDetails
  | WorkspacesAPI.WorkspaceMemberLimitExceededErrorDetails
  | OrganizationTypeNotSupportedErrorDetails
  | EnvironmentsAPI.BetaEnvironmentCreateDisabledErrorDetails
  | EnvironmentsAPI.BetaEnvironmentArchivedErrorDetails
  | EnvironmentsAPI.BetaInvalidConfigTypeChangeErrorDetails
  | EnvironmentsAPI.BetaEnvironmentUpdateDisabledErrorDetails
  | WorkAPI.BetaHeartbeatPreconditionFailedErrorDetails
  | EnvironmentsAPI.BetaInvalidMetadataErrorDetails
  | BetaOrganizationAPI.BetaBillingFrozenErrorDetails
  | SpendLimitsAPI.BetaSpendLimitsAdminAPIWritesNotEnabledErrorDetails
  | BetaAPI.BetaUnsupportedCharsetErrorDetails
  | PluginsAPI.BetaPluginNameTakenErrorDetails
  | PluginsAPI.BetaSkillNameTakenErrorDetails
  | PluginsAPI.BetaRegistrationPendingErrorDetails
  | PluginsAPI.BetaScanFailedErrorDetails
  | PluginsAPI.BetaScanPendingErrorDetails
  | ClaudeTagAPI.BetaSlackChannelSetUpSettingsRefusedErrorDetails
  | ClaudeTagAPI.BetaAPIKeyScopeMissingErrorDetails
  | ClaudeTagAPI.BetaClaudeTagWritesNotEnabledErrorDetails
  | ClaudeTagAPI.BetaComplianceConfigurationRestrictedErrorDetails
  | ClaudeTagAPI.BetaOrganizationLevelScopedAPIKeyRequiredErrorDetails
  | EnvironmentsAPI.BetaEnvironmentNotFoundErrorDetails
  | ClaudeTagAPI.BetaSlackChannelSetUpEnvironmentNotFoundErrorDetails
  | ClaudeTagAPI.BetaSlackChannelSetUpSettingsConflictErrorDetails;

export type ErrorObject =
  | InvalidRequestError
  | AuthenticationError
  | BillingError
  | PermissionError
  | NotFoundError
  | RateLimitError
  | GatewayTimeoutError
  | APIErrorObject
  | OverloadedError;

export interface ErrorResponse {
  error: ErrorObject;

  request_id: string | null;

  type: 'error';
}

export type ErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'billing_error'
  | 'permission_error'
  | 'not_found_error'
  | 'rate_limit_error'
  | 'timeout_error'
  | 'api_error'
  | 'overloaded_error'
  | 'memory_precondition_failed_error'
  | 'memory_path_conflict_error'
  | 'conflict_error';

export interface GatewayTimeoutError {
  message: string;

  type: 'timeout_error';
}

export interface InvalidRequestError {
  message: string;

  type: 'invalid_request_error';
}

export interface NotFoundError {
  message: string;

  type: 'not_found_error';
}

/**
 * Anthropic has disabled the organization for trust and safety reasons. An
 * organization disabled for any other reason, such as billing, does not get this
 * code. `appeal_url`, when present, is where the organization can appeal.
 */
export interface OrganizationOnHoldErrorDetails {
  error_code: 'organization_on_hold';

  appeal_url?: string | null;
}

/**
 * The endpoint does not support the organization's type. Each endpoint's
 * description says which organization types it supports.
 */
export interface OrganizationTypeNotSupportedErrorDetails {
  error_code: 'organization_type_not_supported';
}

export interface OverloadedError {
  message: string;

  type: 'overloaded_error';
}

export interface PermissionError {
  message: string;

  type: 'permission_error';
}

export interface RateLimitError {
  message: string;

  type: 'rate_limit_error';
}

/**
 * The request body is not valid for its `Content-Encoding`.
 */
export interface RequestBodyEncodingInvalidErrorDetails {
  error_code: 'request_body_encoding_invalid';
}

/**
 * The request's `Content-Encoding` is not supported.
 */
export interface RequestBodyEncodingUnsupportedErrorDetails {
  error_code: 'request_body_encoding_unsupported';
}

/**
 * The compressed request body exceeds the request size limit once decoded.
 */
export interface RequestBodyTooLargeAfterDecodingErrorDetails {
  error_code: 'request_body_too_large_after_decoding';
}
