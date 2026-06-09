// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as BetaAPI from './beta';
import * as AgentsAPI from './agents/agents';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
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
    const { betas } = params ?? {};
    return this._client.get(path`/v1/deployment_runs/${deploymentRunID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
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
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      '/v1/deployment_runs?beta=true',
      PageCursor<BetaManagedAgentsDeploymentRun>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
          options?.headers,
        ]),
      },
    );
  }
}

export type BetaManagedAgentsDeploymentRunsPageCursor = PageCursor<BetaManagedAgentsDeploymentRun>;

/**
 * The deployment's agent was archived.
 */
export interface BetaManagedAgentsAgentArchivedRunError {
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
   * A resolved agent reference with a concrete version.
   */
  agent: AgentsAPI.BetaManagedAgentsAgentReference;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  /**
   * ID of the deployment that produced this run.
   */
  deployment_id: string;

  /**
   * Why the run failed to create a session. The type identifies the failure; message
   * is human-readable detail.
   */
  error:
    | BetaManagedAgentsEnvironmentArchivedRunError
    | BetaManagedAgentsAgentArchivedRunError
    | BetaManagedAgentsEnvironmentNotFoundRunError
    | BetaManagedAgentsVaultNotFoundRunError
    | BetaManagedAgentsVaultArchivedRunError
    | BetaManagedAgentsFileNotFoundRunError
    | BetaManagedAgentsMemoryStoreArchivedRunError
    | BetaManagedAgentsSkillNotFoundRunError
    | BetaManagedAgentsSessionResourceNotFoundRunError
    | BetaManagedAgentsWorkspaceArchivedRunError
    | BetaManagedAgentsOrganizationDisabledRunError
    | BetaManagedAgentsSessionRateLimitedRunError
    | BetaManagedAgentsSessionCreationRejectedRunError
    | BetaManagedAgentsUnknownRunError
    | BetaManagedAgentsSelfHostedResourcesUnsupportedRunError
    | BetaManagedAgentsMCPEgressBlockedRunError
    | null;

  /**
   * Populated on success. Null on creation failure. Exactly one of session_id or
   * error is non-null.
   */
  session_id: string | null;

  /**
   * Describes what triggered a deployment run, with trigger-specific metadata.
   */
  trigger_context: BetaManagedAgentsTriggerContext;

  type: 'deployment_run';
}

/**
 * The deployment's environment was archived.
 */
export interface BetaManagedAgentsEnvironmentArchivedRunError {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'environment_archived_error';
}

/**
 * The deployment's environment no longer exists.
 */
export interface BetaManagedAgentsEnvironmentNotFoundRunError {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'environment_not_found_error';
}

/**
 * A file resource referenced by the deployment no longer exists.
 */
export interface BetaManagedAgentsFileNotFoundRunError {
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
export interface BetaManagedAgentsMCPEgressBlockedRunError {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'mcp_egress_blocked_error';
}

/**
 * A memory store referenced by the deployment is archived.
 */
export interface BetaManagedAgentsMemoryStoreArchivedRunError {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'memory_store_archived_error';
}

/**
 * The deployment's organization is disabled.
 */
export interface BetaManagedAgentsOrganizationDisabledRunError {
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
   * A timestamp in RFC 3339 format
   */
  scheduled_at: string;

  type: 'schedule';
}

/**
 * The deployment configures resources, but its environment is self-hosted and
 * cannot mount them.
 */
export interface BetaManagedAgentsSelfHostedResourcesUnsupportedRunError {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'self_hosted_resources_unsupported_error';
}

/**
 * The session create request was rejected with a non-retryable validation error.
 */
export interface BetaManagedAgentsSessionCreationRejectedRunError {
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
export interface BetaManagedAgentsSessionRateLimitedRunError {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'session_rate_limited_error';
}

/**
 * A referenced resource no longer exists and its kind was not reported.
 */
export interface BetaManagedAgentsSessionResourceNotFoundRunError {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'session_resource_not_found_error';
}

/**
 * A skill referenced by the deployment's agent no longer exists.
 */
export interface BetaManagedAgentsSkillNotFoundRunError {
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
 */
export type BetaManagedAgentsTriggerType = 'schedule' | 'manual';

/**
 * An unknown or unexpected error caused the run to fail. A fallback variant;
 * clients that do not recognize a new error type can match on message alone.
 */
export interface BetaManagedAgentsUnknownRunError {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'unknown_error';
}

/**
 * A vault referenced by the deployment is archived.
 */
export interface BetaManagedAgentsVaultArchivedRunError {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'vault_archived_error';
}

/**
 * A vault referenced by the deployment no longer exists.
 */
export interface BetaManagedAgentsVaultNotFoundRunError {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'vault_not_found_error';
}

/**
 * The deployment's workspace was archived.
 */
export interface BetaManagedAgentsWorkspaceArchivedRunError {
  /**
   * Human-readable error description.
   */
  message: string;

  type: 'workspace_archived_error';
}

export interface DeploymentRunRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
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
   * deployments in the workspace. Filtering by a non-existent deployment_id returns
   * 200 with empty data.
   */
  deployment_id?: string;

  /**
   * Query param: Filter: true for runs with non-null error, false for runs with
   * non-null session_id. Omit for all.
   */
  has_error?: boolean;

  /**
   * Query param: Filter runs by what triggered them. Omit to return all runs.
   */
  trigger_type?: BetaManagedAgentsTriggerType;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace DeploymentRuns {
  export {
    type BetaManagedAgentsAgentArchivedRunError as BetaManagedAgentsAgentArchivedRunError,
    type BetaManagedAgentsDeploymentRun as BetaManagedAgentsDeploymentRun,
    type BetaManagedAgentsEnvironmentArchivedRunError as BetaManagedAgentsEnvironmentArchivedRunError,
    type BetaManagedAgentsEnvironmentNotFoundRunError as BetaManagedAgentsEnvironmentNotFoundRunError,
    type BetaManagedAgentsFileNotFoundRunError as BetaManagedAgentsFileNotFoundRunError,
    type BetaManagedAgentsManualTriggerContext as BetaManagedAgentsManualTriggerContext,
    type BetaManagedAgentsMCPEgressBlockedRunError as BetaManagedAgentsMCPEgressBlockedRunError,
    type BetaManagedAgentsMemoryStoreArchivedRunError as BetaManagedAgentsMemoryStoreArchivedRunError,
    type BetaManagedAgentsOrganizationDisabledRunError as BetaManagedAgentsOrganizationDisabledRunError,
    type BetaManagedAgentsScheduleTriggerContext as BetaManagedAgentsScheduleTriggerContext,
    type BetaManagedAgentsSelfHostedResourcesUnsupportedRunError as BetaManagedAgentsSelfHostedResourcesUnsupportedRunError,
    type BetaManagedAgentsSessionCreationRejectedRunError as BetaManagedAgentsSessionCreationRejectedRunError,
    type BetaManagedAgentsSessionRateLimitedRunError as BetaManagedAgentsSessionRateLimitedRunError,
    type BetaManagedAgentsSessionResourceNotFoundRunError as BetaManagedAgentsSessionResourceNotFoundRunError,
    type BetaManagedAgentsSkillNotFoundRunError as BetaManagedAgentsSkillNotFoundRunError,
    type BetaManagedAgentsTriggerContext as BetaManagedAgentsTriggerContext,
    type BetaManagedAgentsTriggerType as BetaManagedAgentsTriggerType,
    type BetaManagedAgentsUnknownRunError as BetaManagedAgentsUnknownRunError,
    type BetaManagedAgentsVaultArchivedRunError as BetaManagedAgentsVaultArchivedRunError,
    type BetaManagedAgentsVaultNotFoundRunError as BetaManagedAgentsVaultNotFoundRunError,
    type BetaManagedAgentsWorkspaceArchivedRunError as BetaManagedAgentsWorkspaceArchivedRunError,
    type BetaManagedAgentsDeploymentRunsPageCursor as BetaManagedAgentsDeploymentRunsPageCursor,
    type DeploymentRunRetrieveParams as DeploymentRunRetrieveParams,
    type DeploymentRunListParams as DeploymentRunListParams,
  };
}
