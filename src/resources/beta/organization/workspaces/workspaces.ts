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
  BetaWorkspaceRateLimitOrganizationSource,
  BetaWorkspaceRateLimitType,
  BetaWorkspaceRateLimitUpdateValue,
  BetaWorkspaceRateLimitValue,
  BetaWorkspaceRateLimitWorkspaceSource,
  BetaWorkspaceRateLimitsPageCursor,
  RateLimitListParams,
  RateLimitUpdateParams,
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
import { BadRequestError, ConflictError } from '../../../../core/error';
import { Page, type PageParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';
import { path } from '../../../../internal/utils/path';

/**
 * The request would leave the Workspace with
 * `inference_data_privacy.safeguards_storage` set to External Storage and
 * `inference_data_privacy.human_review` enabled. Anthropic doesn't offer human
 * review of data in a customer's own storage. Set `human_review` to `disabled`, or
 * `safeguards_storage` to `internal`.
 */
export class BetaHumanReviewOnWithExternalStorageError extends BadRequestError {
  declare readonly errorCode: 'human_review_on_with_external_storage';
  declare readonly details: BetaHumanReviewOnWithExternalStorageErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaHumanReviewOnWithExternalStorageError';
}

/**
 * In an organization managed through AWS or Google Cloud, the request would leave
 * the Workspace with `inference_data_privacy.human_review` disabled and
 * `inference_data_privacy.transcripts_storage` not set to External Storage. With
 * human review disabled, the organization reviews its own flagged requests, and it
 * receives them only in that storage.
 */
export class BetaTranscriptsStorageRequiredError extends BadRequestError {
  declare readonly errorCode: 'transcripts_storage_required';
  declare readonly details: BetaTranscriptsStorageRequiredErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaTranscriptsStorageRequiredError';
}

/**
 * Another request changed the Workspace, so this request left the setting named in
 * `field` as it is. The error's `message` says which of this request's other
 * changes are in place. Read the Workspace and send the request again if you still
 * want the change.
 */
export class BetaWorkspaceChangedConcurrentlyError extends ConflictError {
  declare readonly errorCode: 'workspace_changed_concurrently';
  declare readonly details: BetaWorkspaceChangedConcurrentlyErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaWorkspaceChangedConcurrentlyError';
}

export class Workspaces extends APIResource {
  rateLimits: RateLimitsAPI.RateLimits = new RateLimitsAPI.RateLimits(this._client);
  members: MembersAPI.Members = new MembersAPI.Members(this._client);
  serviceAccounts: ServiceAccountsAPI.ServiceAccounts = new ServiceAccountsAPI.ServiceAccounts(this._client);

  /**
   * Create Workspace
   *
   * @throws {BetaApprovalRequiredError}
   * @throws {ExternalKeyValidationFailedError}
   * @throws {ExternalKeyValidationTimedOutError}
   * @throws {BetaExternalStorageNotAvailableError}
   * @throws {BetaGrantRequiredError}
   * @throws {BetaHumanReviewNotAvailableError}
   * @throws {BetaHumanReviewOnWithExternalStorageError}
   * @throws {BetaInvalidStorageARNError}
   * @throws {KeyProfileMismatchError}
   * @throws {BetaOrganizationNotEligibleError}
   * @throws {BetaStorageNotAttachableError}
   * @throws {StorageProfileMismatchError}
   * @throws {BetaStorageVerificationFailedError}
   * @throws {BetaTranscriptsStorageRequiredError}
   * @throws {UserProfileNotFoundError}
   * @throws {WorkspacePolicyViolationError}
   * @throws {SandboxEgressRestrictedError}
   * @throws {ExternalKeyChangedError}
   * @throws {BetaAuthorizationCheckUnavailableError}
   * @throws {WorkspaceCreatedIncompleteError}
   *
   * @example
   * ```ts
   * const betaWorkspace =
   *   await client.beta.organization.workspaces.create({
   *     name: 'Workspace Name',
   *   });
   * ```
   */
  create(params: WorkspaceCreateParams, options?: RequestOptions): APIPromise<BetaWorkspace> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/workspaces', {
      body,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.workspaces.create', options, {
        route: '/v1/organizations/workspaces',
        createdIDAttribute: 'anthropic.organization.workspace.id',
      }),
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
  retrieve(
    workspaceID: string,
    params: WorkspaceRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaWorkspace> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/organizations/workspaces/${workspaceID}`, {
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.workspaces.retrieve', options, {
        route: '/v1/organizations/workspaces/{workspace_id}',
        attributes: { 'anthropic.organization.workspace.id': workspaceID },
      }),
    });
  }

  /**
   * Update Workspace
   *
   * @throws {BetaApprovalRequiredError}
   * @throws {ExternalKeyValidationFailedError}
   * @throws {ExternalKeyValidationTimedOutError}
   * @throws {BetaExternalStorageNotAvailableError}
   * @throws {BetaGrantRequiredError}
   * @throws {BetaHumanReviewNotAvailableError}
   * @throws {BetaHumanReviewOnWithExternalStorageError}
   * @throws {BetaInvalidStorageARNError}
   * @throws {KeyProfileMismatchError}
   * @throws {BetaOrganizationNotEligibleError}
   * @throws {BetaStorageAttachLimitReachedError}
   * @throws {BetaStorageNotAttachableError}
   * @throws {StorageProfileMismatchError}
   * @throws {BetaStorageProfileStillRequiredError}
   * @throws {BetaStorageVerificationFailedError}
   * @throws {BetaTranscriptsStorageRequiredError}
   * @throws {UserProfileNotFoundError}
   * @throws {WorkspacePolicyViolationError}
   * @throws {SandboxEgressRestrictedError}
   * @throws {ExternalKeyChangedError}
   * @throws {BetaStorageChangedConcurrentlyError}
   * @throws {BetaWorkspaceChangedConcurrentlyError}
   * @throws {BetaAuthorizationCheckUnavailableError}
   * @throws {ChangeOutcomeUnknownError}
   *
   * @example
   * ```ts
   * const betaWorkspace =
   *   await client.beta.organization.workspaces.update(
   *     'workspace_id',
   *     {},
   *   );
   * ```
   */
  update(
    workspaceID: string,
    params: WorkspaceUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaWorkspace> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/workspaces/${workspaceID}`, {
      body,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.workspaces.update', options, {
        route: '/v1/organizations/workspaces/{workspace_id}',
        attributes: { 'anthropic.organization.workspace.id': workspaceID },
      }),
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
    params: WorkspaceListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaWorkspacesPage, BetaWorkspace> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/organizations/workspaces', Page<BetaWorkspace>, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.workspaces.list', options, {
        route: '/v1/organizations/workspaces',
        queryParams: ['after_id', 'before_id', 'ids', 'include_archived', 'include_default', 'limit'],
      }),
    });
  }

  /**
   * Archive Workspace
   *
   * @throws {SandboxEgressRestrictedError}
   * @throws {StorageAttachedDuringArchiveError}
   *
   * @example
   * ```ts
   * const betaWorkspace =
   *   await client.beta.organization.workspaces.archive(
   *     'workspace_id',
   *   );
   * ```
   */
  archive(
    workspaceID: string,
    params: WorkspaceArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaWorkspace> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/organizations/workspaces/${workspaceID}/archive`, {
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.workspaces.archive', options, {
        route: '/v1/organizations/workspaces/{workspace_id}/archive',
        attributes: { 'anthropic.organization.workspace.id': workspaceID },
      }),
    });
  }
}

export type BetaWorkspacesPage = Page<BetaWorkspace>;

export type BetaWorkspaceMembersPage = Page<BetaWorkspaceMember>;

export type BetaAllowedInferenceGeo = 'global' | 'us';

/**
 * The Workspace's human review setting.
 */
export interface BetaAnthropicHumanReview {
  type: 'disabled' | 'enabled';
}

/**
 * Whether Anthropic's human review applies to the Workspace's inference data.
 */
export interface BetaAnthropicHumanReviewParam {
  type: 'disabled' | 'enabled';
}

export interface BetaDataResidency {
  /**
   * Permitted inference geo values. 'unrestricted' means all geos are allowed.
   */
  allowed_inference_geos: Array<BetaAllowedInferenceGeo> | 'unrestricted';

  /**
   * Default inference geo applied when requests omit the parameter.
   */
  default_inference_geo: 'global' | 'us';

  /**
   * Geographic region for workspace data storage. Immutable after creation.
   */
  workspace_geo: 'us';
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

/**
 * The organization's External Storage that `external_storage_id` names.
 */
export interface BetaExternalStorageMember {
  /**
   * The External Storage ID, which starts with `estrg_`. Through Claude Platform on
   * AWS, storage whose `provider_config.type` is `aws` has its bucket ARN as its ID
   * instead: `arn:<partition>:s3:::<bucket_name>`, where `<partition>` is the
   * partition of the bucket's region.
   */
  external_storage_id: string;

  type: 'external';
}

/**
 * The organization's External Storage that `external_storage_id` names.
 */
export interface BetaExternalStorageMemberParam {
  /**
   * The External Storage ID, which starts with `estrg_`. Through Claude Platform on
   * AWS, storage whose `provider_config.type` is `aws` has its bucket ARN as its ID
   * instead: `arn:<partition>:s3:::<bucket_name>`, where `<partition>` is the
   * partition of the bucket's region.
   */
  external_storage_id: string;

  type: 'external';
}

/**
 * The request would leave the Workspace with
 * `inference_data_privacy.safeguards_storage` set to External Storage and
 * `inference_data_privacy.human_review` enabled. Anthropic doesn't offer human
 * review of data in a customer's own storage. Set `human_review` to `disabled`, or
 * `safeguards_storage` to `internal`.
 */
export interface BetaHumanReviewOnWithExternalStorageErrorDetails {
  error_code: 'human_review_on_with_external_storage';
}

export interface BetaInferenceDataPrivacy {
  /**
   * The Workspace's human review setting. Human review is off only while this is
   * `disabled` and Anthropic's approval stands.
   */
  human_review?: BetaAnthropicHumanReview;

  /**
   * Where the data Anthropic's safeguards systems retain for the Workspace goes.
   * `external` sends it to the External Storage that `external_storage_id` names.
   * `internal` means no External Storage: it goes to Anthropic's storage or, on a
   * cloud provider's platform, to that provider's storage. A recent change may not
   * have taken effect yet.
   */
  safeguards_storage?: BetaStorageMember;

  /**
   * Where copies of the Workspace's transcripts and its cases (Anthropic's safety
   * findings about those transcripts) go. `external` sends them to the External
   * Storage that `external_storage_id` names. `internal` means no External Storage,
   * so no copies are made. A recent change may not have taken effect yet.
   */
  transcripts_storage?: BetaStorageMember;
}

/**
 * Where the Workspace's retained inference data and transcript copies go, and
 * whether Anthropic's human review applies. A member cannot be null; omit it
 * instead.
 */
export interface BetaInferenceDataPrivacyCreateParam {
  /**
   * Whether Anthropic's human review applies to the Workspace. `disabled` needs
   * Anthropic's approval. When omitted, `enabled`. Cannot be null.
   */
  human_review?: BetaAnthropicHumanReviewParam;

  /**
   * Where the data Anthropic's safeguards systems retain for the Workspace goes.
   * `external` sends it, once the attach takes effect, to the External Storage that
   * `external_storage_id` names. `internal` means no External Storage: it goes to
   * Anthropic's storage or, on a cloud provider's platform, to that provider's
   * storage. When omitted, `internal`. Cannot be null.
   */
  safeguards_storage?: BetaStorageMemberParam;

  /**
   * Where copies of the Workspace's transcripts and its cases (Anthropic's safety
   * findings about those transcripts) go. `external` sends them, once the attach
   * takes effect, to the External Storage that `external_storage_id` names.
   * `internal` means no External Storage, so no copies are made. When omitted,
   * `internal`. Cannot be null.
   */
  transcripts_storage?: BetaStorageMemberParam;
}

/**
 * Changes to where the Workspace's retained inference data and transcript copies
 * go, and to whether Anthropic's human review applies. An omitted member is
 * unchanged; a member cannot be null.
 */
export interface BetaInferenceDataPrivacyUpdateParam {
  /**
   * Whether Anthropic's human review applies to the Workspace from now on.
   * `disabled` needs Anthropic's approval. When omitted, unchanged. Cannot be null.
   */
  human_review?: BetaAnthropicHumanReviewParam;

  /**
   * Where the data Anthropic's safeguards systems retain for the Workspace goes once
   * the change takes effect. `external` sends it to the External Storage that
   * `external_storage_id` names. `internal` means no External Storage: it goes to
   * Anthropic's storage or, on a cloud provider's platform, to that provider's
   * storage. When omitted, unchanged. Cannot be null.
   */
  safeguards_storage?: BetaStorageMemberParam;

  /**
   * Where copies of the Workspace's transcripts and its cases (Anthropic's safety
   * findings about those transcripts) go once the change takes effect. `external`
   * sends them to the External Storage that `external_storage_id` names. `internal`
   * means no External Storage, so no more copies are made. When omitted, unchanged.
   * Cannot be null.
   */
  transcripts_storage?: BetaStorageMemberParam;
}

/**
 * No External Storage for this purpose.
 */
export interface BetaInternalStorage {
  type: 'internal';
}

/**
 * No External Storage for this purpose.
 */
export interface BetaInternalStorageParam {
  type: 'internal';
}

export type BetaNoBillingWorkspaceRole =
  | 'workspace_admin'
  | 'workspace_developer'
  | 'workspace_restricted_developer'
  | 'workspace_user';

export type BetaStorageMember = BetaInternalStorage | BetaExternalStorageMember;

export type BetaStorageMemberParam = BetaInternalStorageParam | BetaExternalStorageMemberParam;

/**
 * In an organization managed through AWS or Google Cloud, the request would leave
 * the Workspace with `inference_data_privacy.human_review` disabled and
 * `inference_data_privacy.transcripts_storage` not set to External Storage. With
 * human review disabled, the organization reviews its own flagged requests, and it
 * receives them only in that storage.
 */
export interface BetaTranscriptsStorageRequiredErrorDetails {
  error_code: 'transcripts_storage_required';
}

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
   * Identifier for this Workspace's encryption compartment. When you configure an
   * AWS KMS customer-managed encryption key (CMEK) that isn't bound to a user
   * profile, reference this value in your KMS key-policy condition so the key is
   * scoped to this compartment. On GCP and Azure, Anthropic enforces the compartment
   * binding automatically; you do not need to reference this value in your key
   * configuration. See the CMEK integration guide for the required key
   * configuration; unless your organization is on Claude Platform on AWS, it
   * includes a separate value used during key validation. On Claude Platform on AWS
   * there is no separate validation value: your organization's own key is validated
   * against this Workspace's own value when it is attached, so if its key policy
   * uses the compartment condition, add this value to it before attaching the key.
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
   * Create key configurations with the External Keys API. On Claude Platform on AWS
   * the value for an AWS KMS key is the key's ARN, and your organization's own key
   * must be a single-Region key in the same Region as the Workspace. If that key is
   * outside the Workspace's AWS account, it can be attached only by updating an
   * active Workspace. On that platform the key is validated against this Workspace
   * when it is attached, so a key-policy problem is reported as an error on this
   * request. This field is write-once: once a key is attached to a Workspace it
   * cannot be detached or replaced. To rotate key material, rotate the underlying
   * key on your cloud KMS; the `external_key_id` stays the same.
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

  /**
   * ID of the user profile attached to the Workspace, or null if it has none. Every
   * inference request through a Workspace that has a user profile must name that
   * profile.
   */
  user_profile_id: string | null;

  /**
   * Where the Workspace's retained inference data and transcript copies go, and
   * whether Anthropic's human review applies. Returned only to requests that send
   * the `efs-2026-10-01` `anthropic-beta` value, and each member only to
   * organizations enabled for it.
   */
  inference_data_privacy?: BetaInferenceDataPrivacy;
}

/**
 * Another request changed the Workspace, so this request left the setting named in
 * `field` as it is. The error's `message` says which of this request's other
 * changes are in place. Read the Workspace and send the request again if you still
 * want the change.
 */
export interface BetaWorkspaceChangedConcurrentlyErrorDetails {
  error_code: 'workspace_changed_concurrently';

  /**
   * The request field whose change was refused. Other values may be returned. The
   * value is a name with no data of its own.
   */
  field: BetaWorkspaceChangedConcurrentlyField;
}

export type BetaWorkspaceChangedConcurrentlyField = 'inference_data_privacy.human_review';

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
   * referenced key. Create key configurations with the External Keys API. On Claude
   * Platform on AWS the value for an AWS KMS key is the key's ARN, and your
   * organization's own key must be a single-Region key in the same Region as the
   * Workspace. If that key is outside the Workspace's AWS account, it can be
   * attached only by updating an active Workspace. On that platform the key is
   * validated against this Workspace when it is attached, so a key-policy problem is
   * reported as an error on this request. This field is write-once: once a key is
   * attached to a Workspace it cannot be detached or replaced. To rotate key
   * material, rotate the underlying key on your cloud KMS; the `external_key_id`
   * stays the same.
   */
  external_key_id?: string | null;

  /**
   * Body param: Where the Workspace's retained inference data and transcript copies
   * go, and whether Anthropic's human review applies. Requires the `efs-2026-10-01`
   * `anthropic-beta` value. When omitted, `safeguards_storage` and
   * `transcripts_storage` are `internal` and `human_review` is `enabled`. Cannot be
   * null. An Admin API key can't set this field, because it doesn't belong to a user
   * or a service account. Use an API key that belongs to one, or an OAuth token.
   */
  inference_data_privacy?: BetaInferenceDataPrivacyCreateParam | null;

  /**
   * Body param: User-defined tags as string key-value pairs. Keys may not begin with
   * `anthropic`.
   */
  tags?: { [key: string]: string } | null;

  /**
   * Body param: ID of a user profile to attach to the Workspace. Every inference
   * request through the Workspace must then name this user profile; the API rejects
   * a request that names none or a different one. The user profile can't be replaced
   * or removed later; only deleting the user profile clears it.
   */
  user_profile_id?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkspaceRetrieveParams {
  /**
   * Optional. Send `efs-2026-10-01` in this header to use this endpoint's beta
   * features: additional parameters, accepted values and response fields.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkspaceUpdateParams {
  /**
   * Body param: Data residency configuration for the workspace.
   */
  data_residency?: BetaDataResidencyUpdateConfig | null;

  /**
   * Body param: Hex color code representing the Workspace in the Anthropic Console.
   */
  display_color?: string;

  /**
   * Body param: ID of the customer-managed encryption key (CMEK) configuration to
   * use for this Workspace. Setting this field requires CMEK to be enabled for your
   * organization. When set, data stored for this Workspace is encrypted with the
   * referenced key. Create key configurations with the External Keys API. On Claude
   * Platform on AWS the value for an AWS KMS key is the key's ARN, and your
   * organization's own key must be a single-Region key in the same Region as the
   * Workspace. If that key is outside the Workspace's AWS account, it can be
   * attached only by updating an active Workspace. On that platform the key is
   * validated against this Workspace when it is attached, so a key-policy problem is
   * reported as an error on this request. This field is write-once: once a key is
   * attached to a Workspace it cannot be detached or replaced. To rotate key
   * material, rotate the underlying key on your cloud KMS; the `external_key_id`
   * stays the same.
   */
  external_key_id?: string;

  /**
   * Body param: Changes to where the Workspace's retained inference data and
   * transcript copies go, and to whether Anthropic's human review applies. Requires
   * the `efs-2026-10-01` `anthropic-beta` value. An omitted member is unchanged.
   * Cannot be null. An Admin API key can't set this field, because it doesn't belong
   * to a user or a service account. Use an API key that belongs to one, or an OAuth
   * token.
   */
  inference_data_privacy?: BetaInferenceDataPrivacyUpdateParam | null;

  /**
   * Body param: Name of the Workspace.
   */
  name?: string;

  /**
   * Body param: User-defined tags as string key-value pairs. Keys may not begin with
   * `anthropic`.
   */
  tags?: { [key: string]: string | null } | null;

  /**
   * Body param: ID of a user profile to attach to the Workspace. Every inference
   * request through the Workspace must then name this user profile; the API rejects
   * a request that names none or a different one. Once set, it can't be replaced or
   * removed (sending the same ID again changes nothing); only deleting the user
   * profile clears it. It can't be set on a Workspace whose External Key isn't bound
   * to this user profile. The default Workspace can't have a user profile.
   */
  user_profile_id?: string;

  /**
   * Header param: Optional. Send `efs-2026-10-01` in this header to use this
   * endpoint's beta features: additional parameters, accepted values and response
   * fields.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkspaceListParams extends PageParams {
  /**
   * Query param: Only the Workspaces with these IDs, at most 100. `include_archived`
   * and `include_default` still apply, and IDs of Workspaces the caller can't list
   * are left out.
   */
  ids?: Array<string>;

  /**
   * Query param: Whether to include Workspaces that have been archived in the
   * response
   */
  include_archived?: boolean;

  /**
   * Query param: Whether to include the organization's default Workspace in the
   * response
   */
  include_default?: boolean;

  /**
   * Header param: Optional. Send `efs-2026-10-01` in this header to use this
   * endpoint's beta features: additional parameters, accepted values and response
   * fields.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkspaceArchiveParams {
  /**
   * Optional. Send `efs-2026-10-01` in this header to use this endpoint's beta
   * features: additional parameters, accepted values and response fields.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

Workspaces.BetaHumanReviewOnWithExternalStorageError = BetaHumanReviewOnWithExternalStorageError;
Workspaces.BetaTranscriptsStorageRequiredError = BetaTranscriptsStorageRequiredError;
Workspaces.BetaWorkspaceChangedConcurrentlyError = BetaWorkspaceChangedConcurrentlyError;
Workspaces.RateLimits = RateLimits;
Workspaces.Members = Members;
Workspaces.ServiceAccounts = ServiceAccounts;

export declare namespace Workspaces {
  export {
    BetaHumanReviewOnWithExternalStorageError as BetaHumanReviewOnWithExternalStorageError,
    BetaTranscriptsStorageRequiredError as BetaTranscriptsStorageRequiredError,
    BetaWorkspaceChangedConcurrentlyError as BetaWorkspaceChangedConcurrentlyError,
    type BetaAllowedInferenceGeo as BetaAllowedInferenceGeo,
    type BetaAnthropicHumanReview as BetaAnthropicHumanReview,
    type BetaAnthropicHumanReviewParam as BetaAnthropicHumanReviewParam,
    type BetaDataResidency as BetaDataResidency,
    type BetaDataResidencyCreateConfig as BetaDataResidencyCreateConfig,
    type BetaDataResidencyUpdateConfig as BetaDataResidencyUpdateConfig,
    type BetaExternalStorageMember as BetaExternalStorageMember,
    type BetaExternalStorageMemberParam as BetaExternalStorageMemberParam,
    type BetaHumanReviewOnWithExternalStorageErrorDetails as BetaHumanReviewOnWithExternalStorageErrorDetails,
    type BetaInferenceDataPrivacy as BetaInferenceDataPrivacy,
    type BetaInferenceDataPrivacyCreateParam as BetaInferenceDataPrivacyCreateParam,
    type BetaInferenceDataPrivacyUpdateParam as BetaInferenceDataPrivacyUpdateParam,
    type BetaInternalStorage as BetaInternalStorage,
    type BetaInternalStorageParam as BetaInternalStorageParam,
    type BetaNoBillingWorkspaceRole as BetaNoBillingWorkspaceRole,
    type BetaStorageMember as BetaStorageMember,
    type BetaStorageMemberParam as BetaStorageMemberParam,
    type BetaTranscriptsStorageRequiredErrorDetails as BetaTranscriptsStorageRequiredErrorDetails,
    type BetaWorkspace as BetaWorkspace,
    type BetaWorkspaceChangedConcurrentlyErrorDetails as BetaWorkspaceChangedConcurrentlyErrorDetails,
    type BetaWorkspaceChangedConcurrentlyField as BetaWorkspaceChangedConcurrentlyField,
    type BetaWorkspaceMember as BetaWorkspaceMember,
    type BetaWorkspaceRole as BetaWorkspaceRole,
    type BetaWorkspacesPage as BetaWorkspacesPage,
    type WorkspaceCreateParams as WorkspaceCreateParams,
    type WorkspaceRetrieveParams as WorkspaceRetrieveParams,
    type WorkspaceUpdateParams as WorkspaceUpdateParams,
    type WorkspaceListParams as WorkspaceListParams,
    type WorkspaceArchiveParams as WorkspaceArchiveParams,
  };

  export {
    RateLimits as RateLimits,
    type BetaWorkspaceRateLimit as BetaWorkspaceRateLimit,
    type BetaWorkspaceRateLimitOrganizationSource as BetaWorkspaceRateLimitOrganizationSource,
    type BetaWorkspaceRateLimitType as BetaWorkspaceRateLimitType,
    type BetaWorkspaceRateLimitUpdateValue as BetaWorkspaceRateLimitUpdateValue,
    type BetaWorkspaceRateLimitValue as BetaWorkspaceRateLimitValue,
    type BetaWorkspaceRateLimitWorkspaceSource as BetaWorkspaceRateLimitWorkspaceSource,
    type BetaWorkspaceRateLimitsPageCursor as BetaWorkspaceRateLimitsPageCursor,
    type RateLimitUpdateParams as RateLimitUpdateParams,
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
