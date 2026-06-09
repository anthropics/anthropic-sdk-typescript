// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as BetaAPI from './beta';
import * as DeploymentRunsAPI from './deployment-runs';
import * as AgentsAPI from './agents/agents';
import * as EventsAPI from './sessions/events';
import * as SessionsAPI from './sessions/sessions';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Deployments extends APIResource {
  /**
   * Create Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.create({
   *     agent: 'string',
   *     environment_id: 'x',
   *     initial_events: [
   *       {
   *         content: [
   *           {
   *             text: 'Where is my order #1234?',
   *             type: 'text',
   *           },
   *         ],
   *         type: 'user.message',
   *       },
   *     ],
   *     name: 'x',
   *   });
   * ```
   */
  create(params: DeploymentCreateParams, options?: RequestOptions): APIPromise<BetaManagedAgentsDeployment> {
    const { betas, ...body } = params;
    return this._client.post('/v1/deployments?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Get Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.retrieve('deployment_id');
   * ```
   */
  retrieve(
    deploymentID: string,
    params: DeploymentRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeployment> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/deployments/${deploymentID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.update('deployment_id');
   * ```
   */
  update(
    deploymentID: string,
    params: DeploymentUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeployment> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/deployments/${deploymentID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List Deployments
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsDeployment of client.beta.deployments.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: DeploymentListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsDeploymentsPageCursor, BetaManagedAgentsDeployment> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/deployments?beta=true', PageCursor<BetaManagedAgentsDeployment>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Archive Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.archive('deployment_id');
   * ```
   */
  archive(
    deploymentID: string,
    params: DeploymentArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeployment> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/deployments/${deploymentID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Pause Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.pause('deployment_id');
   * ```
   */
  pause(
    deploymentID: string,
    params: DeploymentPauseParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeployment> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/deployments/${deploymentID}/pause?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Run Deployment Now
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeploymentRun =
   *   await client.beta.deployments.run('deployment_id');
   * ```
   */
  run(
    deploymentID: string,
    params: DeploymentRunParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<DeploymentRunsAPI.BetaManagedAgentsDeploymentRun> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/deployments/${deploymentID}/run?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Unpause Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.unpause('deployment_id');
   * ```
   */
  unpause(
    deploymentID: string,
    params: DeploymentUnpauseParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeployment> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/deployments/${deploymentID}/unpause?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaManagedAgentsDeploymentsPageCursor = PageCursor<BetaManagedAgentsDeployment>;

/**
 * The deployment's agent was archived.
 */
export interface BetaManagedAgentsAgentArchivedDeploymentPausedReasonError {
  type: 'agent_archived_error';
}

/**
 * 5-field POSIX cron schedule with computed runtime timestamps.
 */
export interface BetaManagedAgentsCronSchedule {
  /**
   * 5-field POSIX cron expression: minute hour day-of-month month day-of-week (e.g.,
   * "0 9 \* \* 1-5" for weekdays at 9am). Day-of-week is 0-7 where 0 and 7 both mean
   * Sunday. Extended cron syntax - seconds or year fields, and the special
   * characters L, W, #, and ? - is not supported, nor are predefined shortcuts
   * (@daily).
   */
  expression: string;

  /**
   * IANA timezone identifier (e.g., "America/Los_Angeles", "UTC").
   */
  timezone: string;

  type: 'cron';

  /**
   * A timestamp in RFC 3339 format
   */
  last_run_at?: string | null;

  /**
   * Up to 5 timestamps of upcoming cron occurrences. Non-empty for active and paused
   * deployments (reflects what the schedule would do if unpaused); empty once the
   * deployment is archived (`archived_at` set). Each fire is offset by a small
   * per-schedule jitter, so a run will actually start at or shortly after its listed
   * time.
   */
  upcoming_runs_at?: Array<string>;
}

/**
 * 5-field POSIX cron schedule. Literal wall-clock matching in the configured
 * timezone.
 */
export interface BetaManagedAgentsCronScheduleParams {
  /**
   * 5-field POSIX cron expression: minute hour day-of-month month day-of-week (e.g.,
   * "0 9 \* \* 1-5" for weekdays at 9am). Day-of-week is 0-7 where 0 and 7 both mean
   * Sunday. Extended cron syntax - seconds or year fields, and the special
   * characters L, W, #, and ? - is not supported, nor are predefined shortcuts
   * (@daily).
   */
  expression: string;

  /**
   * Required. IANA timezone identifier (e.g., "America/Los_Angeles", "UTC").
   * Validated against the IANA timezone database.
   */
  timezone: string;

  type: 'cron';
}

/**
 * A deployment is a configured instance of an agent — it binds the agent to
 * everything needed to run it autonomously: an environment, credentials, initial
 * events, and an optional schedule.
 */
export interface BetaManagedAgentsDeployment {
  /**
   * Unique identifier for this deployment.
   */
  id: string;

  /**
   * A resolved agent reference with a concrete version.
   */
  agent: AgentsAPI.BetaManagedAgentsAgentReference;

  /**
   * A timestamp in RFC 3339 format
   */
  archived_at: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  /**
   * Description of what the deployment does.
   */
  description: string | null;

  /**
   * ID of the `environment` where sessions run.
   */
  environment_id: string;

  /**
   * Events sent to each session immediately after creation.
   */
  initial_events: Array<BetaManagedAgentsDeploymentInitialEvent>;

  /**
   * Arbitrary key-value metadata. Maximum 16 pairs.
   */
  metadata: { [key: string]: string };

  /**
   * Human-readable name.
   */
  name: string;

  /**
   * Why a deployment is paused. Non-null exactly when `status` is `paused`.
   */
  paused_reason: BetaManagedAgentsDeploymentPausedReason | null;

  /**
   * Resources attached to sessions created from this deployment. Echoes the input
   * minus write-only credentials.
   */
  resources: Array<BetaManagedAgentsSessionResourceConfig>;

  /**
   * 5-field POSIX cron schedule with computed runtime timestamps.
   */
  schedule: BetaManagedAgentsSchedule | null;

  /**
   * Lifecycle status of a deployment.
   */
  status: BetaManagedAgentsDeploymentStatus;

  type: 'deployment';

  /**
   * A timestamp in RFC 3339 format
   */
  updated_at: string;

  /**
   * Vault IDs supplying stored credentials for sessions created from this
   * deployment.
   */
  vault_ids: Array<string>;
}

/**
 * An event sent to a session immediately after it is created. Supports
 * `user.message`, `user.define_outcome`, and `system.message`.
 */
export type BetaManagedAgentsDeploymentInitialEvent =
  | BetaManagedAgentsDeploymentUserMessageEvent
  | BetaManagedAgentsDeploymentUserDefineOutcomeEvent
  | BetaManagedAgentsDeploymentSystemMessageEvent;

/**
 * An event sent to a session immediately after it is created. Supports
 * `user.message`, `user.define_outcome`, and `system.message`.
 */
export type BetaManagedAgentsDeploymentInitialEventParams =
  | EventsAPI.BetaManagedAgentsUserMessageEventParams
  | EventsAPI.BetaManagedAgentsUserDefineOutcomeEventParams
  | EventsAPI.BetaManagedAgentsSystemMessageEventParams;

/**
 * Why a deployment is paused. Non-null exactly when `status` is `paused`.
 */
export type BetaManagedAgentsDeploymentPausedReason =
  | BetaManagedAgentsManualDeploymentPausedReason
  | BetaManagedAgentsErrorDeploymentPausedReason;

/**
 * The error that triggered an auto-pause. Matches the failed run's `error.type`.
 */
export type BetaManagedAgentsDeploymentPausedReasonError =
  | BetaManagedAgentsEnvironmentArchivedDeploymentPausedReasonError
  | BetaManagedAgentsAgentArchivedDeploymentPausedReasonError
  | BetaManagedAgentsEnvironmentNotFoundDeploymentPausedReasonError
  | BetaManagedAgentsVaultNotFoundDeploymentPausedReasonError
  | BetaManagedAgentsFileNotFoundDeploymentPausedReasonError
  | BetaManagedAgentsSessionResourceNotFoundDeploymentPausedReasonError
  | BetaManagedAgentsWorkspaceArchivedDeploymentPausedReasonError
  | BetaManagedAgentsOrganizationDisabledDeploymentPausedReasonError
  | BetaManagedAgentsMemoryStoreArchivedDeploymentPausedReasonError
  | BetaManagedAgentsSkillNotFoundDeploymentPausedReasonError
  | BetaManagedAgentsVaultArchivedDeploymentPausedReasonError
  | BetaManagedAgentsUnknownDeploymentPausedReasonError
  | BetaManagedAgentsSelfHostedResourcesUnsupportedDeploymentPausedReasonError
  | BetaManagedAgentsMCPEgressBlockedDeploymentPausedReasonError;

/**
 * Lifecycle status of a deployment.
 */
export type BetaManagedAgentsDeploymentStatus = 'active' | 'paused';

/**
 * Privileged context for the accompanying turn and all subsequent turns, appended
 * to the session's system context as a `role: "system"` turn rather than replacing
 * the top-level system prompt.
 */
export interface BetaManagedAgentsDeploymentSystemMessageEvent {
  /**
   * System content blocks to append. Text-only.
   */
  content: Array<SessionsAPI.BetaManagedAgentsSystemContentBlock>;

  type: 'system.message';
}

/**
 * An outcome the agent should work toward. The agent begins work on receipt.
 */
export interface BetaManagedAgentsDeploymentUserDefineOutcomeEvent {
  /**
   * What the agent should produce. This is the task specification.
   */
  description: string;

  /**
   * Rubric for grading the quality of an outcome.
   */
  rubric: EventsAPI.BetaManagedAgentsFileRubric | EventsAPI.BetaManagedAgentsTextRubric;

  type: 'user.define_outcome';

  /**
   * Eval→revision cycles before giving up. Default 3, max 20.
   */
  max_iterations?: number | null;
}

/**
 * A user message sent to the session.
 */
export interface BetaManagedAgentsDeploymentUserMessageEvent {
  /**
   * Array of content blocks for the user message.
   */
  content: Array<
    | EventsAPI.BetaManagedAgentsTextBlock
    | EventsAPI.BetaManagedAgentsImageBlock
    | EventsAPI.BetaManagedAgentsDocumentBlock
  >;

  type: 'user.message';
}

/**
 * The deployment's environment was archived.
 */
export interface BetaManagedAgentsEnvironmentArchivedDeploymentPausedReasonError {
  type: 'environment_archived_error';
}

/**
 * The deployment's environment no longer exists.
 */
export interface BetaManagedAgentsEnvironmentNotFoundDeploymentPausedReasonError {
  type: 'environment_not_found_error';
}

/**
 * A scheduled fire recorded a failed run whose error auto-pauses the deployment.
 */
export interface BetaManagedAgentsErrorDeploymentPausedReason {
  /**
   * The error that triggered an auto-pause. Matches the failed run's `error.type`.
   */
  error: BetaManagedAgentsDeploymentPausedReasonError;

  type: 'error';
}

/**
 * A file resource referenced by the deployment no longer exists.
 */
export interface BetaManagedAgentsFileNotFoundDeploymentPausedReasonError {
  type: 'file_not_found_error';
}

/**
 * A file mounted into each session's container.
 */
export interface BetaManagedAgentsFileResourceConfig {
  /**
   * ID of a previously uploaded file.
   */
  file_id: string;

  type: 'file';

  /**
   * Mount path in the container. Defaults to `/mnt/session/uploads/<file_id>`.
   */
  mount_path?: string | null;
}

/**
 * A GitHub repository mounted into each session's container. The authorization
 * token is write-only and never returned.
 */
export interface BetaManagedAgentsGitHubRepositoryResourceConfig {
  type: 'github_repository';

  /**
   * Github URL of the repository
   */
  url: string;

  /**
   * Branch or commit to check out. Defaults to the repository's default branch.
   */
  checkout?: SessionsAPI.BetaManagedAgentsBranchCheckout | SessionsAPI.BetaManagedAgentsCommitCheckout | null;

  /**
   * Mount path in the container. Defaults to `/workspace/<repo-name>`.
   */
  mount_path?: string | null;
}

/**
 * The caller invoked the pause endpoint on the deployment.
 */
export interface BetaManagedAgentsManualDeploymentPausedReason {
  type: 'manual';
}

/**
 * An MCP server host used by the deployment's agent is blocked by the
 * environment's network policy.
 */
export interface BetaManagedAgentsMCPEgressBlockedDeploymentPausedReasonError {
  type: 'mcp_egress_blocked_error';
}

/**
 * A memory store referenced by the deployment is archived.
 */
export interface BetaManagedAgentsMemoryStoreArchivedDeploymentPausedReasonError {
  type: 'memory_store_archived_error';
}

/**
 * A memory store attached to each session created from this deployment.
 */
export interface BetaManagedAgentsMemoryStoreResourceConfig {
  /**
   * The memory store ID (memstore\_...). Must belong to the caller's organization
   * and workspace.
   */
  memory_store_id: string;

  type: 'memory_store';

  /**
   * Access mode for an attached memory store.
   */
  access?: 'read_write' | 'read_only' | null;

  /**
   * Per-attachment guidance for the agent on how to use this store. Rendered into
   * the memory section of the system prompt. Max 4096 chars.
   */
  instructions?: string | null;
}

/**
 * The deployment's organization is disabled.
 */
export interface BetaManagedAgentsOrganizationDisabledDeploymentPausedReasonError {
  type: 'organization_disabled_error';
}

/**
 * 5-field POSIX cron schedule with computed runtime timestamps.
 */
export interface BetaManagedAgentsSchedule {
  /**
   * 5-field POSIX cron expression: minute hour day-of-month month day-of-week (e.g.,
   * "0 9 \* \* 1-5" for weekdays at 9am). Day-of-week is 0-7 where 0 and 7 both mean
   * Sunday. Extended cron syntax - seconds or year fields, and the special
   * characters L, W, #, and ? - is not supported, nor are predefined shortcuts
   * (@daily).
   */
  expression: string;

  /**
   * IANA timezone identifier (e.g., "America/Los_Angeles", "UTC").
   */
  timezone: string;

  type: 'cron';

  /**
   * A timestamp in RFC 3339 format
   */
  last_run_at?: string | null;

  /**
   * Up to 5 timestamps of upcoming cron occurrences. Non-empty for active and paused
   * deployments (reflects what the schedule would do if unpaused); empty once the
   * deployment is archived (`archived_at` set). Each fire is offset by a small
   * per-schedule jitter, so a run will actually start at or shortly after its listed
   * time.
   */
  upcoming_runs_at?: Array<string>;
}

/**
 * 5-field POSIX cron schedule. Literal wall-clock matching in the configured
 * timezone.
 */
export interface BetaManagedAgentsScheduleParams {
  /**
   * 5-field POSIX cron expression: minute hour day-of-month month day-of-week (e.g.,
   * "0 9 \* \* 1-5" for weekdays at 9am). Day-of-week is 0-7 where 0 and 7 both mean
   * Sunday. Extended cron syntax - seconds or year fields, and the special
   * characters L, W, #, and ? - is not supported, nor are predefined shortcuts
   * (@daily).
   */
  expression: string;

  /**
   * Required. IANA timezone identifier (e.g., "America/Los_Angeles", "UTC").
   * Validated against the IANA timezone database.
   */
  timezone: string;

  type: 'cron';
}

/**
 * The deployment configures resources, but its environment is self-hosted and
 * cannot mount them.
 */
export interface BetaManagedAgentsSelfHostedResourcesUnsupportedDeploymentPausedReasonError {
  type: 'self_hosted_resources_unsupported_error';
}

/**
 * A configured session resource. Echoes the input minus write-only credentials.
 */
export type BetaManagedAgentsSessionResourceConfig =
  | BetaManagedAgentsGitHubRepositoryResourceConfig
  | BetaManagedAgentsFileResourceConfig
  | BetaManagedAgentsMemoryStoreResourceConfig;

/**
 * A referenced resource no longer exists and its kind was not reported.
 */
export interface BetaManagedAgentsSessionResourceNotFoundDeploymentPausedReasonError {
  type: 'session_resource_not_found_error';
}

/**
 * A skill referenced by the deployment's agent no longer exists.
 */
export interface BetaManagedAgentsSkillNotFoundDeploymentPausedReasonError {
  type: 'skill_not_found_error';
}

/**
 * An unrecognized error auto-paused the deployment. A fallback variant; matches a
 * run whose `error.type` is `unknown_error`.
 */
export interface BetaManagedAgentsUnknownDeploymentPausedReasonError {
  type: 'unknown_error';
}

/**
 * A vault referenced by the deployment is archived.
 */
export interface BetaManagedAgentsVaultArchivedDeploymentPausedReasonError {
  type: 'vault_archived_error';
}

/**
 * A vault referenced by the deployment no longer exists.
 */
export interface BetaManagedAgentsVaultNotFoundDeploymentPausedReasonError {
  type: 'vault_not_found_error';
}

/**
 * The deployment's workspace was archived.
 */
export interface BetaManagedAgentsWorkspaceArchivedDeploymentPausedReasonError {
  type: 'workspace_archived_error';
}

export interface DeploymentCreateParams {
  /**
   * Body param: Agent to deploy. Accepts the `agent` ID string, which pins the
   * latest version, or an `agent` object with both id and version specified. The
   * agent must exist and not be archived.
   */
  agent: string | SessionsAPI.BetaManagedAgentsAgentParams;

  /**
   * Body param: ID of the `environment` defining the container configuration for
   * sessions created from this deployment.
   */
  environment_id: string;

  /**
   * Body param: Events to send to each session immediately after creation. At least
   * 1, maximum 50.
   */
  initial_events: Array<BetaManagedAgentsDeploymentInitialEventParams>;

  /**
   * Body param: Human-readable name for the deployment.
   */
  name: string;

  /**
   * Body param: Description of what the deployment does.
   */
  description?: string | null;

  /**
   * Body param: Arbitrary key-value metadata. Maximum 16 pairs, keys up to 64 chars,
   * values up to 512 chars.
   */
  metadata?: { [key: string]: string };

  /**
   * Body param: Resources (e.g. repositories, files) to mount into each session's
   * container. Maximum 500.
   */
  resources?: Array<
    | SessionsAPI.BetaManagedAgentsGitHubRepositoryResourceParams
    | SessionsAPI.BetaManagedAgentsFileResourceParams
    | SessionsAPI.BetaManagedAgentsMemoryStoreResourceParam
  >;

  /**
   * Body param: 5-field POSIX cron schedule. Literal wall-clock matching in the
   * configured timezone.
   */
  schedule?: BetaManagedAgentsScheduleParams | null;

  /**
   * Body param: Vault IDs for stored credentials the agent can use during sessions
   * created from this deployment. Maximum 50.
   */
  vault_ids?: Array<string>;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DeploymentRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DeploymentUpdateParams {
  /**
   * Body param: Agent to deploy. Accepts the `agent` ID string, which re-pins to the
   * latest version, or an `agent` object with both id and version specified. Omit to
   * preserve. Cannot be cleared.
   */
  agent?: string | SessionsAPI.BetaManagedAgentsAgentParams;

  /**
   * Body param: Description. Omit to preserve; send empty string or null to clear.
   */
  description?: string | null;

  /**
   * Body param: ID of the `environment` where sessions run. Omit to preserve. Cannot
   * be cleared.
   */
  environment_id?: string;

  /**
   * Body param: Initial events. Full replacement. Omit to preserve. Cannot be
   * cleared. At least 1, maximum 50.
   */
  initial_events?: Array<BetaManagedAgentsDeploymentInitialEventParams>;

  /**
   * Body param: Metadata patch. Set a key to a string to upsert it, or to null to
   * delete it. Omit the field to preserve. The stored bag is limited to 16 keys (up
   * to 64 chars each) with values up to 512 chars.
   */
  metadata?: { [key: string]: string | null } | null;

  /**
   * Body param: Human-readable name. Must be non-empty. Omit to preserve. Cannot be
   * cleared.
   */
  name?: string;

  /**
   * Body param: Session resources. Full replacement. Omit to preserve; send empty
   * array or null to clear. Maximum 500.
   */
  resources?: Array<
    | SessionsAPI.BetaManagedAgentsGitHubRepositoryResourceParams
    | SessionsAPI.BetaManagedAgentsFileResourceParams
    | SessionsAPI.BetaManagedAgentsMemoryStoreResourceParam
  > | null;

  /**
   * Body param: 5-field POSIX cron schedule. Literal wall-clock matching in the
   * configured timezone.
   */
  schedule?: BetaManagedAgentsScheduleParams | null;

  /**
   * Body param: Vault IDs. Full replacement. Omit to preserve; send empty array or
   * null to clear. Maximum 50.
   */
  vault_ids?: Array<string> | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DeploymentListParams extends PageCursorParams {
  /**
   * Query param: Filter by agent ID.
   */
  agent_id?: string;

  /**
   * Query param: Return deployments created at or after this time (inclusive).
   */
  'created_at[gte]'?: string;

  /**
   * Query param: Return deployments created at or before this time (inclusive).
   */
  'created_at[lte]'?: string;

  /**
   * Query param: When true, includes archived deployments. Default: false (exclude
   * archived).
   */
  include_archived?: boolean;

  /**
   * Query param: Filter by status: active or paused. Omit for both. To include
   * archived deployments, use include_archived instead; the two cannot be combined.
   */
  status?: BetaManagedAgentsDeploymentStatus;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DeploymentArchiveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DeploymentPauseParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DeploymentRunParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface DeploymentUnpauseParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Deployments {
  export {
    type BetaManagedAgentsAgentArchivedDeploymentPausedReasonError as BetaManagedAgentsAgentArchivedDeploymentPausedReasonError,
    type BetaManagedAgentsCronSchedule as BetaManagedAgentsCronSchedule,
    type BetaManagedAgentsCronScheduleParams as BetaManagedAgentsCronScheduleParams,
    type BetaManagedAgentsDeployment as BetaManagedAgentsDeployment,
    type BetaManagedAgentsDeploymentInitialEvent as BetaManagedAgentsDeploymentInitialEvent,
    type BetaManagedAgentsDeploymentInitialEventParams as BetaManagedAgentsDeploymentInitialEventParams,
    type BetaManagedAgentsDeploymentPausedReason as BetaManagedAgentsDeploymentPausedReason,
    type BetaManagedAgentsDeploymentPausedReasonError as BetaManagedAgentsDeploymentPausedReasonError,
    type BetaManagedAgentsDeploymentStatus as BetaManagedAgentsDeploymentStatus,
    type BetaManagedAgentsDeploymentSystemMessageEvent as BetaManagedAgentsDeploymentSystemMessageEvent,
    type BetaManagedAgentsDeploymentUserDefineOutcomeEvent as BetaManagedAgentsDeploymentUserDefineOutcomeEvent,
    type BetaManagedAgentsDeploymentUserMessageEvent as BetaManagedAgentsDeploymentUserMessageEvent,
    type BetaManagedAgentsEnvironmentArchivedDeploymentPausedReasonError as BetaManagedAgentsEnvironmentArchivedDeploymentPausedReasonError,
    type BetaManagedAgentsEnvironmentNotFoundDeploymentPausedReasonError as BetaManagedAgentsEnvironmentNotFoundDeploymentPausedReasonError,
    type BetaManagedAgentsErrorDeploymentPausedReason as BetaManagedAgentsErrorDeploymentPausedReason,
    type BetaManagedAgentsFileNotFoundDeploymentPausedReasonError as BetaManagedAgentsFileNotFoundDeploymentPausedReasonError,
    type BetaManagedAgentsFileResourceConfig as BetaManagedAgentsFileResourceConfig,
    type BetaManagedAgentsGitHubRepositoryResourceConfig as BetaManagedAgentsGitHubRepositoryResourceConfig,
    type BetaManagedAgentsManualDeploymentPausedReason as BetaManagedAgentsManualDeploymentPausedReason,
    type BetaManagedAgentsMCPEgressBlockedDeploymentPausedReasonError as BetaManagedAgentsMCPEgressBlockedDeploymentPausedReasonError,
    type BetaManagedAgentsMemoryStoreArchivedDeploymentPausedReasonError as BetaManagedAgentsMemoryStoreArchivedDeploymentPausedReasonError,
    type BetaManagedAgentsMemoryStoreResourceConfig as BetaManagedAgentsMemoryStoreResourceConfig,
    type BetaManagedAgentsOrganizationDisabledDeploymentPausedReasonError as BetaManagedAgentsOrganizationDisabledDeploymentPausedReasonError,
    type BetaManagedAgentsSchedule as BetaManagedAgentsSchedule,
    type BetaManagedAgentsScheduleParams as BetaManagedAgentsScheduleParams,
    type BetaManagedAgentsSelfHostedResourcesUnsupportedDeploymentPausedReasonError as BetaManagedAgentsSelfHostedResourcesUnsupportedDeploymentPausedReasonError,
    type BetaManagedAgentsSessionResourceConfig as BetaManagedAgentsSessionResourceConfig,
    type BetaManagedAgentsSessionResourceNotFoundDeploymentPausedReasonError as BetaManagedAgentsSessionResourceNotFoundDeploymentPausedReasonError,
    type BetaManagedAgentsSkillNotFoundDeploymentPausedReasonError as BetaManagedAgentsSkillNotFoundDeploymentPausedReasonError,
    type BetaManagedAgentsUnknownDeploymentPausedReasonError as BetaManagedAgentsUnknownDeploymentPausedReasonError,
    type BetaManagedAgentsVaultArchivedDeploymentPausedReasonError as BetaManagedAgentsVaultArchivedDeploymentPausedReasonError,
    type BetaManagedAgentsVaultNotFoundDeploymentPausedReasonError as BetaManagedAgentsVaultNotFoundDeploymentPausedReasonError,
    type BetaManagedAgentsWorkspaceArchivedDeploymentPausedReasonError as BetaManagedAgentsWorkspaceArchivedDeploymentPausedReasonError,
    type BetaManagedAgentsDeploymentsPageCursor as BetaManagedAgentsDeploymentsPageCursor,
    type DeploymentCreateParams as DeploymentCreateParams,
    type DeploymentRetrieveParams as DeploymentRetrieveParams,
    type DeploymentUpdateParams as DeploymentUpdateParams,
    type DeploymentListParams as DeploymentListParams,
    type DeploymentArchiveParams as DeploymentArchiveParams,
    type DeploymentPauseParams as DeploymentPauseParams,
    type DeploymentRunParams as DeploymentRunParams,
    type DeploymentUnpauseParams as DeploymentUnpauseParams,
  };
}
