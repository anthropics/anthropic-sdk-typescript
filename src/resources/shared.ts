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
import * as OrganizationUsersAPI from './beta/organization/users';
import * as RBACGroupsAPI from './organization/rbac-groups/rbac-groups';
import * as WorkspacesAPI from './organization/workspaces/workspaces';
import * as ClaudeTagAPI from './beta/organization/claude-tag/claude-tag';
import * as PluginsAPI from './beta/organization/plugins/plugins';
import * as SpendLimitsAPI from './beta/organization/spend-limits/spend-limits';
import {
  BadRequestError,
  ContentTooLargeError,
  PermissionDeniedError,
  RateLimitError as ErrorsRateLimitError,
  ServiceUnavailableError,
} from '../core/error';

/**
 * The API key belongs to the Claude Code workspace, and the user who created it is
 * no longer a member of the organization or of that workspace.
 */
export class ClaudeCodeKeyCreatorNotMemberError extends BadRequestError {
  declare readonly errorCode: 'claude_code_key_creator_not_member';
  declare readonly details: ClaudeCodeKeyCreatorNotMemberErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'ClaudeCodeKeyCreatorNotMemberError';
}

/**
 * The request comes from a Claude Code version older than the minimum that the
 * requested model or the organization requires. Update Claude Code, then retry.
 */
export class ClaudeCodeVersionTooOldError extends BadRequestError {
  declare readonly errorCode: 'claude_code_version_too_old';
  declare readonly details: ClaudeCodeVersionTooOldErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'ClaudeCodeVersionTooOldError';
}

/**
 * The workspace's customer-managed encryption key is disabled or revoked.
 * Re-enable the key, then retry.
 */
export class CMEKKeyDisabledError extends BadRequestError {
  declare readonly errorCode: 'cmek_key_disabled';
  declare readonly details: CMEKKeyDisabledErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'CMEKKeyDisabledError';
}

/**
 * The key management service's network access controls blocked the request to the
 * workspace's customer-managed encryption key. The key itself may be healthy.
 */
export class CMEKKeyNetworkBlockedError extends BadRequestError {
  declare readonly errorCode: 'cmek_key_network_blocked';
  declare readonly details: CMEKKeyNetworkBlockedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'CMEKKeyNetworkBlockedError';
}

/**
 * Anthropic has disabled the organization for trust and safety reasons. An
 * organization disabled for any other reason, such as billing, does not get this
 * code. `appeal_url`, when present, is where the organization can appeal.
 */
export class OrganizationOnHoldError extends BadRequestError {
  declare readonly errorCode: 'organization_on_hold';
  declare readonly details: OrganizationOnHoldErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'OrganizationOnHoldError';
}

/**
 * The endpoint does not support the organization's type. Each endpoint's
 * description says which organization types it supports.
 */
export class OrganizationTypeNotSupportedError extends BadRequestError {
  declare readonly errorCode: 'organization_type_not_supported';
  declare readonly details: OrganizationTypeNotSupportedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'OrganizationTypeNotSupportedError';
}

/**
 * The request body is not valid for its `Content-Encoding`.
 */
export class RequestBodyEncodingInvalidError extends BadRequestError {
  declare readonly errorCode: 'request_body_encoding_invalid';
  declare readonly details: RequestBodyEncodingInvalidErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'RequestBodyEncodingInvalidError';
}

/**
 * The request's `Content-Encoding` is not supported.
 */
export class RequestBodyEncodingUnsupportedError extends BadRequestError {
  declare readonly errorCode: 'request_body_encoding_unsupported';
  declare readonly details: RequestBodyEncodingUnsupportedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'RequestBodyEncodingUnsupportedError';
}

/**
 * The request came from a Claude sandbox with restricted network access, which is
 * not allowed to make this change. Send it from outside the sandbox, or from a
 * sandbox with unrestricted network access.
 */
export class SandboxEgressRestrictedError extends PermissionDeniedError {
  declare readonly errorCode: 'sandbox_egress_restricted';
  declare readonly details: SandboxEgressRestrictedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'SandboxEgressRestrictedError';
}

/**
 * The compressed request body exceeds the request size limit once decoded.
 */
export class RequestBodyTooLargeAfterDecodingError extends ContentTooLargeError {
  declare readonly errorCode: 'request_body_too_large_after_decoding';
  declare readonly details: RequestBodyTooLargeAfterDecodingErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'RequestBodyTooLargeAfterDecodingError';
}

/**
 * The organization has crossed the monthly API usage threshold of its API tier.
 */
export class EnforcedSpendLimitReachedError extends ErrorsRateLimitError {
  declare readonly errorCode: 'enforced_spend_limit_reached';
  declare readonly details: EnforcedSpendLimitReachedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'EnforcedSpendLimitReachedError';
}

/**
 * The request would exceed a ramp limit, which caps how fast usage can grow. Retry
 * after the time in the `retry-after` header.
 */
export class RampLimitExceededError extends ErrorsRateLimitError {
  declare readonly errorCode: 'ramp_limit_exceeded';
  declare readonly details: RampLimitExceededErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'RampLimitExceededError';
}

/**
 * The workspace's encryption settings could not be read, so the request was
 * refused. Retry in a few minutes.
 */
export class CMEKContextUnavailableError extends ServiceUnavailableError {
  declare readonly errorCode: 'cmek_context_unavailable';
  declare readonly details: CMEKContextUnavailableErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'CMEKContextUnavailableError';
}

/**
 * The workspace's customer-managed encryption key could not be reached. Retry the
 * request; if this continues, check that the key is available in your key
 * management service, or contact Anthropic support.
 */
export class CMEKKeyUnreachableError extends ServiceUnavailableError {
  declare readonly errorCode: 'cmek_key_unreachable';
  declare readonly details: CMEKKeyUnreachableErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'CMEKKeyUnreachableError';
}

export interface APIErrorObject {
  /**
   * A human-readable explanation of the error. Its wording can change, so don't
   * match on it.
   */
  message: string;

  /**
   * The broad category of the error.
   */
  type: 'api_error';
}

export interface AuthenticationError {
  /**
   * A human-readable explanation of the error. Its wording can change, so don't
   * match on it.
   */
  message: string;

  /**
   * The broad category of the error.
   */
  type: 'authentication_error';
}

export interface BillingError {
  /**
   * A human-readable explanation of the error. Its wording can change, so don't
   * match on it.
   */
  message: string;

  /**
   * The broad category of the error.
   */
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
 * The workspace's encryption settings could not be read, so the request was
 * refused. Retry in a few minutes.
 */
export interface CMEKContextUnavailableErrorDetails {
  error_code: 'cmek_context_unavailable';
}

/**
 * The workspace's customer-managed encryption key is disabled or revoked.
 * Re-enable the key, then retry.
 */
export interface CMEKKeyDisabledErrorDetails {
  error_code: 'cmek_key_disabled';
}

/**
 * The key management service's network access controls blocked the request to the
 * workspace's customer-managed encryption key. The key itself may be healthy.
 */
export interface CMEKKeyNetworkBlockedErrorDetails {
  error_code: 'cmek_key_network_blocked';
}

/**
 * The workspace's customer-managed encryption key could not be reached. Retry the
 * request; if this continues, check that the key is available in your key
 * management service, or contact Anthropic support.
 */
export interface CMEKKeyUnreachableErrorDetails {
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
  | CMEKKeyDisabledErrorDetails
  | CMEKKeyNetworkBlockedErrorDetails
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
  | RampLimitExceededErrorDetails
  | CMEKKeyUnreachableErrorDetails
  | MessagesAPI.CompactionUnavailableErrorDetails
  | FilesAPI.StorageQuotaExceededErrorDetails
  | FilesAPI.FileNotDownloadableErrorDetails
  | FilesAPI.FileExpiredErrorDetails
  | CMEKContextUnavailableErrorDetails
  | APIKeysAPI.OrgAPIKeyLimitExceededErrorDetails
  | APIKeysAPI.WorkspaceAPIKeyLimitExceededErrorDetails
  | SandboxEgressRestrictedErrorDetails
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
  | ExternalKeysAPI.ExternalKeyValidationFailedErrorDetails
  | ExternalKeysAPI.ExternalKeyValidationTimedOutErrorDetails
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
  | OrganizationUsersAPI.BetaCannotSignOutPrimaryOwnerErrorDetails
  | OrganizationUsersAPI.BetaCannotSignOutSelfErrorDetails
  | BetaAPI.BetaOrganizationNotEnrolledInBetaErrorDetails
  | OrganizationUsersAPI.BetaCannotSignOutManagedMemberErrorDetails
  | OrganizationUsersAPI.BetaCannotSignOutMembershipAdminErrorDetails
  | OrganizationUsersAPI.BetaCannotSignOutOwnerErrorDetails
  | OrganizationUsersAPI.BetaCannotSignOutPrivilegedMemberErrorDetails
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
  /**
   * A human-readable explanation of the error. Its wording can change, so don't
   * match on it.
   */
  message: string;

  /**
   * The broad category of the error.
   */
  type: 'timeout_error';
}

export interface InvalidRequestError {
  /**
   * A human-readable explanation of the error. Its wording can change, so don't
   * match on it.
   */
  message: string;

  /**
   * The broad category of the error.
   */
  type: 'invalid_request_error';
}

export interface NotFoundError {
  /**
   * A human-readable explanation of the error. Its wording can change, so don't
   * match on it.
   */
  message: string;

  /**
   * The broad category of the error.
   */
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
  /**
   * A human-readable explanation of the error. Its wording can change, so don't
   * match on it.
   */
  message: string;

  /**
   * The broad category of the error.
   */
  type: 'overloaded_error';
}

export interface PermissionError {
  /**
   * A human-readable explanation of the error. Its wording can change, so don't
   * match on it.
   */
  message: string;

  /**
   * The broad category of the error.
   */
  type: 'permission_error';
}

/**
 * The request would exceed a ramp limit, which caps how fast usage can grow. Retry
 * after the time in the `retry-after` header.
 */
export interface RampLimitExceededErrorDetails {
  error_code: 'ramp_limit_exceeded';
}

export interface RateLimitError {
  /**
   * A human-readable explanation of the error. Its wording can change, so don't
   * match on it.
   */
  message: string;

  /**
   * The broad category of the error.
   */
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

/**
 * The request came from a Claude sandbox with restricted network access, which is
 * not allowed to make this change. Send it from outside the sandbox, or from a
 * sandbox with unrestricted network access.
 */
export interface SandboxEgressRestrictedErrorDetails {
  error_code: 'sandbox_egress_restricted';
}
