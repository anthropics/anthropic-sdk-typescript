import { APIResource } from '../../core/resource';
import * as BetaAPI from './beta';
import * as AgentsAPI from './agents/agents';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { startApiCallSpan } from '../../internal/tracing';
import { path } from '../../internal/utils/path';

export class DeploymentRuns extends APIResource {
  /**
   * Get Deployment Run
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeploymentRun =
   *   await client.beta.deploymentRuns.retrieve(
   *     'deployment_run_id',
   *   );
   * ```
   */
  retrieve(
    deploymentRunID: string,
    params: DeploymentRunRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeploymentRun> {
    const { betas, workspace_id } = params ?? {};
    return this._client.get(path`/v1/deployment_runs/${deploymentRunID}`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.deployment_runs.retrieve', options, {
        route: '/v1/deployment_runs/{deployment_run_id}',
        attributes: { 'anthropic.deployment_run.id': deploymentRunID },
      }),
    });
  }

  /**
   * List Deployment Runs
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsDeploymentRun of client.beta.deploymentRuns.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: DeploymentRunListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsDeploymentRunsPageCursor, BetaManagedAgentsDeploymentRun> {
    const { betas, workspace_id, ...query } = params ?? {};
    return this._client.getAPIList('/v1/deployment_runs', PageCursor<BetaManagedAgentsDeploymentRun>, {
      query,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.deployment_runs.list', options, {
        route: '/v1/deployment_runs',
        queryParams: [
          'created_at[gt]',
          'created_at[gte]',
          'created_at[lt]',
          'created_at[lte]',
          'deployment_id',
          'has_error',
          'limit',
          'page',
          'trigger_type',
        ],
      }),
    });
  }
}

export type BetaManagedAgentsDeploymentRunsPageCursor = PageCursor<BetaManagedAgentsDeploymentRun>;

/**
 * The deployment's agent was archived.
 */
export interface BetaManagedAgentsAgentArchivedRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'agent_archived_error';
}

/**
 * A persistent, append-only record of a single deployment execution. Records
 * session creation success or failure — no session lifecycle tracking.
 */
export interface BetaManagedAgentsDeploymentRun {
  /**
   * Unique identifier for this run (`drun_...`).
   */
  id: string;

  /**
   * Snapshot of the agent at fire time. Always fully resolved — deployments pin
   * agent + version.
   */
  agent: AgentsAPI.BetaManagedAgentsAgentReference;

  /**
   * Time this run record was persisted.
   */
  created_at: string;

  /**
   * ID of the deployment that produced this run.
   */
  deployment_id: string;

  /**
   * Populated on creation failure. Null on success. Exactly one of `session_id` or
   * `error` is non-null.
   */
  error:
    | BetaManagedAgentsEnvironmentArchivedRunErrorObject
    | BetaManagedAgentsAgentArchivedRunErrorObject
    | BetaManagedAgentsEnvironmentNotFoundRunErrorObject
    | BetaManagedAgentsVaultNotFoundRunErrorObject
    | BetaManagedAgentsVaultArchivedRunErrorObject
    | BetaManagedAgentsFileNotFoundRunErrorObject
    | BetaManagedAgentsMemoryStoreArchivedRunErrorObject
    | BetaManagedAgentsSkillNotFoundRunErrorObject
    | BetaManagedAgentsSessionResourceNotFoundRunErrorObject
    | BetaManagedAgentsWorkspaceArchivedRunErrorObject
    | BetaManagedAgentsOrganizationDisabledRunErrorObject
    | BetaManagedAgentsSessionRateLimitedRunErrorObject
    | BetaManagedAgentsSessionCreationRejectedRunErrorObject
    | BetaManagedAgentsUnknownRunErrorObject
    | BetaManagedAgentsSelfHostedResourcesUnsupportedRunErrorObject
    | BetaManagedAgentsMCPEgressBlockedRunErrorObject
    | null;

  /**
   * Populated on success. Null on creation failure. Exactly one of `session_id` or
   * `error` is non-null.
   */
  session_id: string | null;

  /**
   * What triggered this run and trigger-specific metadata.
   */
  trigger_context: BetaManagedAgentsTriggerContext;

  type: 'deployment_run';
}

/**
 * The deployment's environment was archived.
 */
export interface BetaManagedAgentsEnvironmentArchivedRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'environment_archived_error';
}

/**
 * The deployment's environment no longer exists.
 */
export interface BetaManagedAgentsEnvironmentNotFoundRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'environment_not_found_error';
}

/**
 * A file resource referenced by the deployment no longer exists.
 */
export interface BetaManagedAgentsFileNotFoundRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'file_not_found_error';
}

/**
 * The run was started manually by creating a session directly against the
 * deployment.
 */
export interface BetaManagedAgentsManualTriggerContext {
  type: 'manual';
}

/**
 * An MCP server host used by the deployment's agent is blocked by the
 * environment's network policy.
 */
export interface BetaManagedAgentsMCPEgressBlockedRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'mcp_egress_blocked_error';
}

/**
 * A memory store referenced by the deployment is archived.
 */
export interface BetaManagedAgentsMemoryStoreArchivedRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'memory_store_archived_error';
}

/**
 * The deployment's organization is disabled.
 */
export interface BetaManagedAgentsOrganizationDisabledRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'organization_disabled_error';
}

/**
 * The run was fired by the deployment's cron schedule.
 */
export interface BetaManagedAgentsScheduleTriggerContext {
  /**
   * The UTC instant at which the cron expression matched in the configured timezone,
   * before jitter is applied. At most one run is recorded per (`deployment_id`,
   * `scheduled_at`) pair.
   */
  scheduled_at: string;

  type: 'schedule';
}

/**
 * The deployment configures resources, but its environment is self-hosted and
 * cannot mount them.
 */
export interface BetaManagedAgentsSelfHostedResourcesUnsupportedRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'self_hosted_resources_unsupported_error';
}

/**
 * The session create request was rejected with a non-retryable validation error.
 */
export interface BetaManagedAgentsSessionCreationRejectedRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'session_creation_rejected_error';
}

/**
 * Session creation was rejected due to rate limiting. The schedule keeps firing;
 * subsequent runs may succeed.
 */
export interface BetaManagedAgentsSessionRateLimitedRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'session_rate_limited_error';
}

/**
 * A referenced resource no longer exists and its kind was not reported.
 */
export interface BetaManagedAgentsSessionResourceNotFoundRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'session_resource_not_found_error';
}

/**
 * A skill referenced by the deployment's agent no longer exists.
 */
export interface BetaManagedAgentsSkillNotFoundRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'skill_not_found_error';
}

/**
 * Describes what triggered a deployment run, with trigger-specific metadata.
 */
export type BetaManagedAgentsTriggerContext =
  | BetaManagedAgentsScheduleTriggerContext
  | BetaManagedAgentsManualTriggerContext;

/**
 * What triggered a deployment run.
 *
 * - `schedule` - The run was fired by the deployment's cron schedule.
 * - `manual` - The run was started manually by creating a session directly against
 *   the deployment.
 */
export type BetaManagedAgentsTriggerType = 'schedule' | 'manual';

/**
 * An unknown or unexpected error caused the run to fail. A fallback variant;
 * clients that do not recognize a new error type can match on message alone.
 */
export interface BetaManagedAgentsUnknownRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'unknown_error';
}

/**
 * A vault referenced by the deployment is archived.
 */
export interface BetaManagedAgentsVaultArchivedRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'vault_archived_error';
}

/**
 * A vault referenced by the deployment no longer exists.
 */
export interface BetaManagedAgentsVaultNotFoundRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'vault_not_found_error';
}

/**
 * The deployment's workspace was archived.
 */
export interface BetaManagedAgentsWorkspaceArchivedRunErrorObject {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'workspace_archived_error';
}

/**
 * @deprecated BetaManagedAgentsEnvironmentArchivedRunError has been renamed to BetaManagedAgentsEnvironmentArchivedRunErrorObject
 */
export type BetaManagedAgentsEnvironmentArchivedRunError = BetaManagedAgentsEnvironmentArchivedRunErrorObject;

/**
 * @deprecated BetaManagedAgentsAgentArchivedRunError has been renamed to BetaManagedAgentsAgentArchivedRunErrorObject
 */
export type BetaManagedAgentsAgentArchivedRunError = BetaManagedAgentsAgentArchivedRunErrorObject;

/**
 * @deprecated BetaManagedAgentsEnvironmentNotFoundRunError has been renamed to BetaManagedAgentsEnvironmentNotFoundRunErrorObject
 */
export type BetaManagedAgentsEnvironmentNotFoundRunError = BetaManagedAgentsEnvironmentNotFoundRunErrorObject;

/**
 * @deprecated BetaManagedAgentsVaultNotFoundRunError has been renamed to BetaManagedAgentsVaultNotFoundRunErrorObject
 */
export type BetaManagedAgentsVaultNotFoundRunError = BetaManagedAgentsVaultNotFoundRunErrorObject;

/**
 * @deprecated BetaManagedAgentsVaultArchivedRunError has been renamed to BetaManagedAgentsVaultArchivedRunErrorObject
 */
export type BetaManagedAgentsVaultArchivedRunError = BetaManagedAgentsVaultArchivedRunErrorObject;

/**
 * @deprecated BetaManagedAgentsFileNotFoundRunError has been renamed to BetaManagedAgentsFileNotFoundRunErrorObject
 */
export type BetaManagedAgentsFileNotFoundRunError = BetaManagedAgentsFileNotFoundRunErrorObject;

/**
 * @deprecated BetaManagedAgentsMemoryStoreArchivedRunError has been renamed to BetaManagedAgentsMemoryStoreArchivedRunErrorObject
 */
export type BetaManagedAgentsMemoryStoreArchivedRunError = BetaManagedAgentsMemoryStoreArchivedRunErrorObject;

/**
 * @deprecated BetaManagedAgentsSkillNotFoundRunError has been renamed to BetaManagedAgentsSkillNotFoundRunErrorObject
 */
export type BetaManagedAgentsSkillNotFoundRunError = BetaManagedAgentsSkillNotFoundRunErrorObject;

/**
 * @deprecated BetaManagedAgentsSessionResourceNotFoundRunError has been renamed to BetaManagedAgentsSessionResourceNotFoundRunErrorObject
 */
export type BetaManagedAgentsSessionResourceNotFoundRunError =
  BetaManagedAgentsSessionResourceNotFoundRunErrorObject;

/**
 * @deprecated BetaManagedAgentsWorkspaceArchivedRunError has been renamed to BetaManagedAgentsWorkspaceArchivedRunErrorObject
 */
export type BetaManagedAgentsWorkspaceArchivedRunError = BetaManagedAgentsWorkspaceArchivedRunErrorObject;

/**
 * @deprecated BetaManagedAgentsOrganizationDisabledRunError has been renamed to BetaManagedAgentsOrganizationDisabledRunErrorObject
 */
export type BetaManagedAgentsOrganizationDisabledRunError =
  BetaManagedAgentsOrganizationDisabledRunErrorObject;

/**
 * @deprecated BetaManagedAgentsSessionRateLimitedRunError has been renamed to BetaManagedAgentsSessionRateLimitedRunErrorObject
 */
export type BetaManagedAgentsSessionRateLimitedRunError = BetaManagedAgentsSessionRateLimitedRunErrorObject;

/**
 * @deprecated BetaManagedAgentsSessionCreationRejectedRunError has been renamed to BetaManagedAgentsSessionCreationRejectedRunErrorObject
 */
export type BetaManagedAgentsSessionCreationRejectedRunError =
  BetaManagedAgentsSessionCreationRejectedRunErrorObject;

/**
 * @deprecated BetaManagedAgentsUnknownRunError has been renamed to BetaManagedAgentsUnknownRunErrorObject
 */
export type BetaManagedAgentsUnknownRunError = BetaManagedAgentsUnknownRunErrorObject;

/**
 * @deprecated BetaManagedAgentsSelfHostedResourcesUnsupportedRunError has been renamed to BetaManagedAgentsSelfHostedResourcesUnsupportedRunErrorObject
 */
export type BetaManagedAgentsSelfHostedResourcesUnsupportedRunError =
  BetaManagedAgentsSelfHostedResourcesUnsupportedRunErrorObject;

/**
 * @deprecated BetaManagedAgentsMCPEgressBlockedRunError has been renamed to BetaManagedAgentsMCPEgressBlockedRunErrorObject
 */
export type BetaManagedAgentsMCPEgressBlockedRunError = BetaManagedAgentsMCPEgressBlockedRunErrorObject;

export interface DeploymentRunRetrieveParams {
  /**
   * This endpoint is in beta: requests must send `managed-agents-2026-04-01` in this
   * header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Optional header to select the Workspace for this request. The value is a
   * Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface DeploymentRunListParams extends PageCursorParams {
  /**
   * Query param: Return runs created strictly after this time (exclusive).
   */
  'created_at[gt]'?: string;

  /**
   * Query param: Return runs created at or after this time (inclusive).
   */
  'created_at[gte]'?: string;

  /**
   * Query param: Return runs created strictly before this time (exclusive).
   */
  'created_at[lt]'?: string;

  /**
   * Query param: Return runs created at or before this time (inclusive).
   */
  'created_at[lte]'?: string;

  /**
   * Query param: Filter to a specific deployment. Omit to list across all
   * deployments in the workspace. Filtering by a non-existent `deployment_id`
   * returns 200 with empty data.
   */
  deployment_id?: string;

  /**
   * Query param: Filter: true for runs with non-null `error`, false for runs with
   * non-null `session_id`. Omit for all.
   */
  has_error?: boolean;

  /**
   * Query param: Filter runs by what triggered them. Omit to return all runs.
   */
  trigger_type?: BetaManagedAgentsTriggerType;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `managed-agents-2026-04-01` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export declare namespace DeploymentRuns {
  export {
    type BetaManagedAgentsAgentArchivedRunErrorObject as BetaManagedAgentsAgentArchivedRunErrorObject,
    type BetaManagedAgentsDeploymentRun as BetaManagedAgentsDeploymentRun,
    type BetaManagedAgentsEnvironmentArchivedRunErrorObject as BetaManagedAgentsEnvironmentArchivedRunErrorObject,
    type BetaManagedAgentsEnvironmentNotFoundRunErrorObject as BetaManagedAgentsEnvironmentNotFoundRunErrorObject,
    type BetaManagedAgentsFileNotFoundRunErrorObject as BetaManagedAgentsFileNotFoundRunErrorObject,
    type BetaManagedAgentsManualTriggerContext as BetaManagedAgentsManualTriggerContext,
    type BetaManagedAgentsMCPEgressBlockedRunErrorObject as BetaManagedAgentsMCPEgressBlockedRunErrorObject,
    type BetaManagedAgentsMemoryStoreArchivedRunErrorObject as BetaManagedAgentsMemoryStoreArchivedRunErrorObject,
    type BetaManagedAgentsOrganizationDisabledRunErrorObject as BetaManagedAgentsOrganizationDisabledRunErrorObject,
    type BetaManagedAgentsScheduleTriggerContext as BetaManagedAgentsScheduleTriggerContext,
    type BetaManagedAgentsSelfHostedResourcesUnsupportedRunErrorObject as BetaManagedAgentsSelfHostedResourcesUnsupportedRunErrorObject,
    type BetaManagedAgentsSessionCreationRejectedRunErrorObject as BetaManagedAgentsSessionCreationRejectedRunErrorObject,
    type BetaManagedAgentsSessionRateLimitedRunErrorObject as BetaManagedAgentsSessionRateLimitedRunErrorObject,
    type BetaManagedAgentsSessionResourceNotFoundRunErrorObject as BetaManagedAgentsSessionResourceNotFoundRunErrorObject,
    type BetaManagedAgentsSkillNotFoundRunErrorObject as BetaManagedAgentsSkillNotFoundRunErrorObject,
    type BetaManagedAgentsTriggerContext as BetaManagedAgentsTriggerContext,
    type BetaManagedAgentsTriggerType as BetaManagedAgentsTriggerType,
    type BetaManagedAgentsUnknownRunErrorObject as BetaManagedAgentsUnknownRunErrorObject,
    type BetaManagedAgentsVaultArchivedRunErrorObject as BetaManagedAgentsVaultArchivedRunErrorObject,
    type BetaManagedAgentsVaultNotFoundRunErrorObject as BetaManagedAgentsVaultNotFoundRunErrorObject,
    type BetaManagedAgentsWorkspaceArchivedRunErrorObject as BetaManagedAgentsWorkspaceArchivedRunErrorObject,
    type BetaManagedAgentsEnvironmentArchivedRunError as BetaManagedAgentsEnvironmentArchivedRunError,
    type BetaManagedAgentsAgentArchivedRunError as BetaManagedAgentsAgentArchivedRunError,
    type BetaManagedAgentsEnvironmentNotFoundRunError as BetaManagedAgentsEnvironmentNotFoundRunError,
    type BetaManagedAgentsVaultNotFoundRunError as BetaManagedAgentsVaultNotFoundRunError,
    type BetaManagedAgentsVaultArchivedRunError as BetaManagedAgentsVaultArchivedRunError,
    type BetaManagedAgentsFileNotFoundRunError as BetaManagedAgentsFileNotFoundRunError,
    type BetaManagedAgentsMemoryStoreArchivedRunError as BetaManagedAgentsMemoryStoreArchivedRunError,
    type BetaManagedAgentsSkillNotFoundRunError as BetaManagedAgentsSkillNotFoundRunError,
    type BetaManagedAgentsSessionResourceNotFoundRunError as BetaManagedAgentsSessionResourceNotFoundRunError,
    type BetaManagedAgentsWorkspaceArchivedRunError as BetaManagedAgentsWorkspaceArchivedRunError,
    type BetaManagedAgentsOrganizationDisabledRunError as BetaManagedAgentsOrganizationDisabledRunError,
    type BetaManagedAgentsSessionRateLimitedRunError as BetaManagedAgentsSessionRateLimitedRunError,
    type BetaManagedAgentsSessionCreationRejectedRunError as BetaManagedAgentsSessionCreationRejectedRunError,
    type BetaManagedAgentsUnknownRunError as BetaManagedAgentsUnknownRunError,
    type BetaManagedAgentsSelfHostedResourcesUnsupportedRunError as BetaManagedAgentsSelfHostedResourcesUnsupportedRunError,
    type BetaManagedAgentsMCPEgressBlockedRunError as BetaManagedAgentsMCPEgressBlockedRunError,
    type BetaManagedAgentsDeploymentRunsPageCursor as BetaManagedAgentsDeploymentRunsPageCursor,
    type DeploymentRunRetrieveParams as DeploymentRunRetrieveParams,
    type DeploymentRunListParams as DeploymentRunListParams,
  };
}
