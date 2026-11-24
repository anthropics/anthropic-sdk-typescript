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
import * as ExternalStorageAPI from './beta/organization/external-storage';
import * as BetaOrganizationAPI from './beta/organization/organization';
import * as OrganizationUsersAPI from './beta/organization/users';
import * as RBACGroupsAPI from './organization/rbac-groups/rbac-groups';
import * as WorkspacesAPI from './organization/workspaces/workspaces';
import * as ClaudeTagAPI from './beta/organization/claude-tag/claude-tag';
import * as PluginsAPI from './beta/organization/plugins/plugins';
import * as OrganizationRBACGroupsAPI from './beta/organization/rbac-groups/rbac-groups';
import * as SpendLimitsAPI from './beta/organization/spend-limits/spend-limits';
import * as OrganizationWorkspacesAPI from './beta/organization/workspaces/workspaces';
import * as ManagedSettingsAPI from './beta/organization/claude-code/managed-settings/managed-settings';
import {
  BadRequestError,
  ContentTooLargeError,
  PaymentRequiredError,
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
 * The endpoint serves only organizations that belong to a parent organization, and
 * this organization belongs to none.
 */
export class ParentOrganizationRequiredError extends BadRequestError {
  declare readonly errorCode: 'parent_organization_required';
  declare readonly details: ParentOrganizationRequiredErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'ParentOrganizationRequiredError';
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
 * The request's Workspace has Human Review turned off, and this operation is not
 * available there. Use a Workspace with Human Review on.
 */
export class WorkspaceHumanReviewDisabledError extends BadRequestError {
  declare readonly errorCode: 'workspace_human_review_disabled';
  declare readonly details: WorkspaceHumanReviewDisabledErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'WorkspaceHumanReviewDisabledError';
}

/**
 * Anthropic cannot currently bill the organization linked to the request's user
 * profile, for a reason that lies with that organization's own account. The
 * response does not say what the reason is.
 */
export class LinkedOrganizationBillingUnavailableError extends PaymentRequiredError {
  declare readonly errorCode: 'linked_organization_billing_unavailable';
  declare readonly details: LinkedOrganizationBillingUnavailableErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'LinkedOrganizationBillingUnavailableError';
}

/**
 * The organization linked to the request's user profile has reached a spend limit
 * that it set, or lacks credit for the request. The response does not say which
 * applies.
 */
export class LinkedOrganizationSpendLimitReachedError extends PaymentRequiredError {
  declare readonly errorCode: 'linked_organization_spend_limit_reached';
  declare readonly details: LinkedOrganizationSpendLimitReachedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'LinkedOrganizationSpendLimitReachedError';
}

/**
 * The request came from a Claude sandbox with restricted network access, which is
 * not allowed to make this request. Send it from outside the sandbox, or from a
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
 * The organization has reached the spend limit of its contract.
 */
export class ContractSpendLimitReachedError extends ErrorsRateLimitError {
  declare readonly errorCode: 'contract_spend_limit_reached';
  declare readonly details: ContractSpendLimitReachedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'ContractSpendLimitReachedError';
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

export interface AuthenticationErrorObject {
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

export interface BillingErrorObject {
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
 * The organization has reached the spend limit of its contract.
 */
export interface ContractSpendLimitReachedErrorDetails {
  error_code: 'contract_spend_limit_reached';
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
  | MessagesAPI.ImageDimensionsTooLargeErrorDetails
  | OrganizationOnHoldErrorDetails
  | RequestBodyEncodingInvalidErrorDetails
  | RequestBodyEncodingUnsupportedErrorDetails
  | MessagesAPI.ThreadAlreadyContinuedErrorDetails
  | MessagesAPI.ThreadContinueInFlightErrorDetails
  | MessagesAPI.ThreadFingerprintMismatchErrorDetails
  | MessagesAPI.ThreadUnsupportedRequestErrorDetails
  | MessagesAPI.ToolNameConflictErrorDetails
  | MessagesAPI.ToolReferenceUnresolvedErrorDetails
  | UserProfilesAPI.UserProfileRequiredErrorDetails
  | LinkedOrganizationBillingUnavailableErrorDetails
  | LinkedOrganizationSpendLimitReachedErrorDetails
  | UserProfilesAPI.UserProfileBillingNotAuthorizedErrorDetails
  | UserProfilesAPI.UserProfileNotBillableErrorDetails
  | MessagesAPI.ThreadNotFoundErrorDetails
  | SkillsAPI.SkillReadBlockedUndecryptableErrorDetails
  | RequestBodyTooLargeAfterDecodingErrorDetails
  | ContractSpendLimitReachedErrorDetails
  | EnforcedSpendLimitReachedErrorDetails
  | RampLimitExceededErrorDetails
  | CMEKKeyUnreachableErrorDetails
  | MessagesAPI.CompactionUnavailableErrorDetails
  | WorkspaceHumanReviewDisabledErrorDetails
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
  | WorkspacesAPI.WorkspaceCreatedIncompleteErrorDetails
  | WorkspacesAPI.StorageProfileMismatchErrorDetails
  | OrganizationAPI.ChangeOutcomeUnknownErrorDetails
  | WorkspacesAPI.StorageAttachedDuringArchiveErrorDetails
  | WorkspacesAPI.WorkspaceMemberLimitExceededErrorDetails
  | OrganizationTypeNotSupportedErrorDetails
  | ParentOrganizationRequiredErrorDetails
  | OrganizationAPI.RBACRoleNotFoundErrorDetails
  | EnvironmentsAPI.BetaEnvironmentCreateDisabledErrorDetails
  | EnvironmentsAPI.BetaEnvironmentArchivedErrorDetails
  | EnvironmentsAPI.BetaInvalidConfigTypeChangeErrorDetails
  | EnvironmentsAPI.BetaEnvironmentUpdateDisabledErrorDetails
  | WorkAPI.BetaHeartbeatPreconditionFailedErrorDetails
  | EnvironmentsAPI.BetaInvalidMetadataErrorDetails
  | ExternalStorageAPI.BetaGrantRequiredErrorDetails
  | BetaOrganizationAPI.BetaOrganizationNotEligibleErrorDetails
  | ExternalStorageAPI.BetaProviderNotAllowedErrorDetails
  | ExternalStorageAPI.BetaUnsupportedRegionErrorDetails
  | ExternalStorageAPI.BetaStorageAlreadyRegisteredErrorDetails
  | BetaOrganizationAPI.BetaAuthorizationCheckUnavailableErrorDetails
  | ExternalStorageAPI.BetaInvalidStorageARNErrorDetails
  | ExternalStorageAPI.BetaExternalStorageInUseErrorDetails
  | ExternalStorageAPI.BetaExternalStorageInWorkspacePolicyErrorDetails
  | ExternalStorageAPI.BetaStorageVerificationFailedErrorDetails
  | BetaAPI.BetaCMEKNotApprovedErrorDetails
  | BetaAPI.BetaExternalKeyNotFoundErrorDetails
  | BetaAPI.BetaExternalKeyProviderMismatchErrorDetails
  | BetaAPI.BetaGCPProjectNotVerifiedErrorDetails
  | BetaAPI.BetaRegionNotSupportedErrorDetails
  | BetaAPI.BetaStorageNotApprovedErrorDetails
  | BetaAPI.BetaGCPProjectControlledByAnotherOrganizationErrorDetails
  | BetaAPI.BetaStorageInUseErrorDetails
  | OrganizationUsersAPI.BetaCannotSignOutPrimaryOwnerErrorDetails
  | OrganizationUsersAPI.BetaCannotSignOutSelfErrorDetails
  | BetaAPI.BetaOrganizationNotEnrolledInBetaErrorDetails
  | OrganizationUsersAPI.BetaCannotSignOutManagedMemberErrorDetails
  | OrganizationUsersAPI.BetaCannotSignOutMembershipAdminErrorDetails
  | OrganizationUsersAPI.BetaCannotSignOutOwnerErrorDetails
  | OrganizationUsersAPI.BetaCannotSignOutPrivilegedMemberErrorDetails
  | BetaOrganizationAPI.BetaApprovalRequiredErrorDetails
  | ExternalStorageAPI.BetaExternalStorageNotAvailableErrorDetails
  | BetaOrganizationAPI.BetaHumanReviewNotAvailableErrorDetails
  | OrganizationWorkspacesAPI.BetaHumanReviewOnWithExternalStorageErrorDetails
  | ExternalStorageAPI.BetaStorageNotAttachableErrorDetails
  | OrganizationWorkspacesAPI.BetaTranscriptsStorageRequiredErrorDetails
  | ExternalStorageAPI.BetaStorageAttachLimitReachedErrorDetails
  | ExternalStorageAPI.BetaStorageProfileStillRequiredErrorDetails
  | ExternalStorageAPI.BetaStorageChangedConcurrentlyErrorDetails
  | OrganizationWorkspacesAPI.BetaWorkspaceChangedConcurrentlyErrorDetails
  | SpendLimitsAPI.BetaSpendLimitsAdminAPIWritesNotEnabledErrorDetails
  | BetaAPI.BetaUnsupportedCharsetErrorDetails
  | PluginsAPI.BetaPluginNameTakenErrorDetails
  | PluginsAPI.BetaSkillNameTakenErrorDetails
  | PluginsAPI.BetaRegistrationPendingErrorDetails
  | PluginsAPI.BetaScanFailedErrorDetails
  | PluginsAPI.BetaScanPendingErrorDetails
  | BetaAPI.BetaRequestBodyTimeoutErrorDetails
  | ManagedSettingsAPI.BetaSettingsDocumentLimitExceededErrorDetails
  | ManagedSettingsAPI.BetaSettingsHistoryLimitExceededErrorDetails
  | ManagedSettingsAPI.BetaCMEKFeatureUnsupportedErrorDetails
  | ManagedSettingsAPI.BetaRBACGroupManagedSettingsNotFoundErrorDetails
  | ManagedSettingsAPI.BetaRBACGroupOrderLimitExceededErrorDetails
  | OrganizationRBACGroupsAPI.BetaRBACGroupNotFoundErrorDetails
  | ClaudeTagAPI.BetaSlackChannelSetUpSettingsRefusedErrorDetails
  | ClaudeTagAPI.BetaAPIKeyScopeMissingErrorDetails
  | ClaudeTagAPI.BetaClaudeTagWritesNotEnabledErrorDetails
  | ClaudeTagAPI.BetaComplianceConfigurationRestrictedErrorDetails
  | ClaudeTagAPI.BetaOrganizationLevelScopedAPIKeyRequiredErrorDetails
  | EnvironmentsAPI.BetaEnvironmentNotFoundErrorDetails
  | ClaudeTagAPI.BetaSlackChannelSetUpEnvironmentNotFoundErrorDetails
  | ClaudeTagAPI.BetaSlackChannelSetUpSettingsConflictErrorDetails
  | ClaudeTagAPI.BetaBundleAttachmentNotSupportedErrorDetails
  | ClaudeTagAPI.BetaBundleOnCallErrorDetails;

export type ErrorObject =
  | InvalidRequestErrorObject
  | AuthenticationErrorObject
  | BillingErrorObject
  | PermissionErrorObject
  | NotFoundErrorObject
  | RateLimitErrorObject
  | GatewayTimeoutErrorObject
  | APIErrorObject
  | OverloadedErrorObject;

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

export interface GatewayTimeoutErrorObject {
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

export interface InvalidRequestErrorObject {
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

/**
 * Anthropic cannot currently bill the organization linked to the request's user
 * profile, for a reason that lies with that organization's own account. The
 * response does not say what the reason is.
 */
export interface LinkedOrganizationBillingUnavailableErrorDetails {
  error_code: 'linked_organization_billing_unavailable';
}

/**
 * The organization linked to the request's user profile has reached a spend limit
 * that it set, or lacks credit for the request. The response does not say which
 * applies.
 */
export interface LinkedOrganizationSpendLimitReachedErrorDetails {
  error_code: 'linked_organization_spend_limit_reached';
}

export interface NotFoundErrorObject {
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

export interface OverloadedErrorObject {
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

/**
 * The endpoint serves only organizations that belong to a parent organization, and
 * this organization belongs to none.
 */
export interface ParentOrganizationRequiredErrorDetails {
  error_code: 'parent_organization_required';
}

export interface PermissionErrorObject {
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

export interface RateLimitErrorObject {
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
 * not allowed to make this request. Send it from outside the sandbox, or from a
 * sandbox with unrestricted network access.
 */
export interface SandboxEgressRestrictedErrorDetails {
  error_code: 'sandbox_egress_restricted';
}

/**
 * The request's Workspace has Human Review turned off, and this operation is not
 * available there. Use a Workspace with Human Review on.
 */
export interface WorkspaceHumanReviewDisabledErrorDetails {
  error_code: 'workspace_human_review_disabled';
}

/**
 * @deprecated AuthenticationError has been renamed to AuthenticationErrorObject
 */
export type AuthenticationError = AuthenticationErrorObject;

/**
 * @deprecated InvalidRequestError has been renamed to InvalidRequestErrorObject
 */
export type InvalidRequestError = InvalidRequestErrorObject;

/**
 * @deprecated BillingError has been renamed to BillingErrorObject
 */
export type BillingError = BillingErrorObject;

/**
 * @deprecated GatewayTimeoutError has been renamed to GatewayTimeoutErrorObject
 */
export type GatewayTimeoutError = GatewayTimeoutErrorObject;

/**
 * @deprecated NotFoundError has been renamed to NotFoundErrorObject
 */
export type NotFoundError = NotFoundErrorObject;

/**
 * @deprecated OverloadedError has been renamed to OverloadedErrorObject
 */
export type OverloadedError = OverloadedErrorObject;

/**
 * @deprecated PermissionError has been renamed to PermissionErrorObject
 */
export type PermissionError = PermissionErrorObject;

/**
 * @deprecated RateLimitError has been renamed to RateLimitErrorObject
 */
export type RateLimitError = RateLimitErrorObject;
