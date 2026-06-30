// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import type { Anthropic } from '../../../client';
import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';
import {
  WorkPoller,
  type WorkPollerOptions as RunnerWorkPollerOptions,
} from '../../../lib/environments/poller';
import {
  EnvironmentWorker,
  type EnvironmentWorkerOptions as RunnerEnvironmentWorkerOptions,
} from '../../../lib/environments/worker';

export class Work extends APIResource {
  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Retrieve detailed information about a specific work item.
   *
   * @example
   * ```ts
   * const betaSelfHostedWork =
   *   await client.beta.environments.work.retrieve('work_id', {
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   });
   * ```
   */
  retrieve(
    workID: string,
    params: WorkRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<BetaSelfHostedWork> {
    const { environment_id, betas } = params;
    return this._client.get(path`/v1/environments/${environment_id}/work/${workID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Update work item metadata with merge semantics.
   *
   * @example
   * ```ts
   * const betaSelfHostedWork =
   *   await client.beta.environments.work.update('work_id', {
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *     metadata: { foo: 'string' },
   *   });
   * ```
   */
  update(workID: string, params: WorkUpdateParams, options?: RequestOptions): APIPromise<BetaSelfHostedWork> {
    const { environment_id, betas, ...body } = params;
    return this._client.post(path`/v1/environments/${environment_id}/work/${workID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * List work items in an environment.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaSelfHostedWork of client.beta.environments.work.list(
   *   'env_011CZkZ9X2dpNyB7HsEFoRfW',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    environmentID: string,
    params: WorkListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaSelfHostedWorksPageCursor, BetaSelfHostedWork> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/environments/${environmentID}/work?beta=true`,
      PageCursor<BetaSelfHostedWork>,
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

  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Acknowledge receipt of a work item, transitioning it from 'queued' to 'starting'
   * and removing it from the queue.
   *
   * @example
   * ```ts
   * const betaSelfHostedWork =
   *   await client.beta.environments.work.ack('work_id', {
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   });
   * ```
   */
  ack(workID: string, params: WorkAckParams, options?: RequestOptions): APIPromise<BetaSelfHostedWork> {
    const { environment_id, betas } = params;
    return this._client.post(path`/v1/environments/${environment_id}/work/${workID}/ack?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Record a heartbeat for a work item to maintain the lease.
   *
   * @example
   * ```ts
   * const betaSelfHostedWorkHeartbeatResponse =
   *   await client.beta.environments.work.heartbeat('work_id', {
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   });
   * ```
   */
  heartbeat(
    workID: string,
    params: WorkHeartbeatParams,
    options?: RequestOptions,
  ): APIPromise<BetaSelfHostedWorkHeartbeatResponse> {
    const { environment_id, desired_ttl_seconds, expected_last_heartbeat, betas } = params;
    return this._client.post(path`/v1/environments/${environment_id}/work/${workID}/heartbeat?beta=true`, {
      query: { desired_ttl_seconds, expected_last_heartbeat },
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Long poll for work items in the queue.
   *
   * @example
   * ```ts
   * const betaSelfHostedWork =
   *   await client.beta.environments.work.poll(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  poll(
    environmentID: string,
    params: WorkPollParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaSelfHostedWork | null> {
    const { betas, 'Anthropic-Worker-ID': anthropicWorkerID, ...query } = params ?? {};
    return this._client.get(path`/v1/environments/${environmentID}/work/poll?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString(),
          ...(anthropicWorkerID != null ? { 'Anthropic-Worker-ID': anthropicWorkerID } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * Get statistics about the work queue for an environment.
   *
   * @example
   * ```ts
   * const betaSelfHostedWorkQueueStats =
   *   await client.beta.environments.work.stats(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  stats(
    environmentID: string,
    params: WorkStatsParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaSelfHostedWorkQueueStats> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/environments/${environmentID}/work/stats?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Stop a work item, initiating graceful or forced shutdown.
   *
   * @example
   * ```ts
   * const betaSelfHostedWork =
   *   await client.beta.environments.work.stop('work_id', {
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   });
   * ```
   */
  stop(workID: string, params: WorkStopParams, options?: RequestOptions): APIPromise<BetaSelfHostedWork> {
    const { environment_id, betas, ...body } = params;
    return this._client.post(path`/v1/environments/${environment_id}/work/${workID}/stop?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Continuously claim work from a self-hosted environment, ack each item,
   * and yield it. Posts `stop` automatically when the consumer's loop body
   * returns or when iteration ends.
   *
   * @example
   * ```ts
   * for await (const work of client.beta.environments.work.poller({
   *   environmentId,
   *   environmentKey,
   * })) {
   *   if (work.data.type !== 'session') continue;
   *   // ...service the work...
   * }
   * ```
   */
  poller(opts: Omit<RunnerWorkPollerOptions, 'client'>): WorkPoller {
    return new WorkPoller({ ...opts, client: this._client as Anthropic });
  }

  /**
   * The self-hosted environment runner: poll for work, and for each claimed
   * session set up the workdir, download the agent's skills, run the tools while
   * heartbeating the lease, and force-stop on exit.
   *
   * @example
   * ```ts
   * // Long-running daemon — poll, serve each session, loop:
   * await client.beta.environments.work
   *   .worker({ environmentId, environmentKey, workdir: '/workspace' })
   *   .run();
   *
   * // Or service one already-claimed work item (e.g. inside a sandbox spawned
   * // by `ant worker poll --on-work`) — handleItem() reads the ANTHROPIC_* env vars:
   * await client.beta.environments.work.worker({ workdir: '/workspace' }).handleItem();
   * ```
   */
  worker(opts: Omit<RunnerEnvironmentWorkerOptions, 'client'>): EnvironmentWorker {
    return new EnvironmentWorker({ ...opts, client: this._client as Anthropic });
  }
}

export type BetaSelfHostedWorksPageCursor = PageCursor<BetaSelfHostedWork>;

/**
 * Work data for environment health checks.
 *
 * This resource type is used for assessing the health of containers where work
 * occurs. The data is opaque to users; the runner handles the health check by
 * probing connectivity to required services.
 */
export interface BetaHealthCheckWorkData {
  /**
   * Health check identifier
   */
  id: string;

  /**
   * Type of work data
   */
  type?: 'healthcheck';
}

/**
 * Work resource representing a unit of work in a self-hosted environment.
 *
 * Work items are queued when sessions are created or when long-dormant sessions
 * receive new messages. The Environment Manager polls for work items and executes
 * them on customer-hosted infrastructure.
 */
export interface BetaSelfHostedWork {
  /**
   * Work identifier (e.g., 'work\_...')
   */
  id: string;

  /**
   * RFC 3339 timestamp when work was acknowledged by Environment Manager
   */
  acknowledged_at: string | null;

  /**
   * RFC 3339 timestamp when work was created
   */
  created_at: string;

  /**
   * The actual work to be performed (session or health check)
   */
  data: BetaSessionWorkData | BetaHealthCheckWorkData;

  /**
   * Environment identifier this work belongs to (e.g., `env_...`)
   */
  environment_id: string;

  /**
   * RFC 3339 timestamp of the most recent heartbeat
   */
  latest_heartbeat_at: string | null;

  /**
   * User-provided metadata key-value pairs associated with this work item
   */
  metadata: { [key: string]: string };

  /**
   * Credential payload used by the environment worker to execute this work item. May
   * be populated when polling for work; null on all other retrieval paths.
   */
  secret: string | null;

  /**
   * RFC 3339 timestamp when work execution started
   */
  started_at: string | null;

  /**
   * Current state of the work item
   */
  state: 'queued' | 'starting' | 'active' | 'stopping' | 'stopped';

  /**
   * RFC 3339 timestamp when stop was requested
   */
  stop_requested_at: string | null;

  /**
   * RFC 3339 timestamp when work execution stopped
   */
  stopped_at: string | null;

  /**
   * The type of object (always 'work')
   */
  type: 'work';
}

/**
 * Response after recording a heartbeat for a work item.
 */
export interface BetaSelfHostedWorkHeartbeatResponse {
  /**
   * RFC 3339 timestamp of the actual heartbeat from DB
   */
  last_heartbeat: string;

  /**
   * Whether the heartbeat succeeded in extending the lease
   */
  lease_extended: boolean;

  /**
   * Current state of the work item (active/stopping/stopped)
   */
  state: 'queued' | 'starting' | 'active' | 'stopping' | 'stopped';

  /**
   * Effective TTL applied to the lease
   */
  ttl_seconds: number;

  /**
   * The type of response
   */
  type: 'work_heartbeat';
}

/**
 * Response when listing work items with cursor-based pagination.
 */
export interface BetaSelfHostedWorkListResponse {
  /**
   * List of work items
   */
  data: Array<BetaSelfHostedWork>;

  /**
   * Opaque cursor for fetching the next page of results
   */
  next_page: string | null;
}

/**
 * Statistics about the work queue for an environment.
 *
 * Uses Redis Stream consumer group metrics for O(1) queries.
 */
export interface BetaSelfHostedWorkQueueStats {
  /**
   * Number of work items waiting to be picked up (lag from consumer group)
   */
  depth: number;

  /**
   * RFC 3339 timestamp of oldest item in the work stream (includes both queued and
   * pending items), null if stream empty
   */
  oldest_queued_at: string | null;

  /**
   * Number of work items being processed (polled but not acknowledged)
   */
  pending: number;

  /**
   * The type of object
   */
  type: 'work_queue_stats';

  /**
   * Number of workers that have polled for work in the last 30 seconds. Requires
   * worker_id to be sent with poll requests.
   */
  workers_polling: number | null;
}

/**
 * Request to stop a work item.
 */
export interface BetaSelfHostedWorkStopRequest {
  /**
   * If true, immediately stop work without graceful shutdown
   */
  force?: boolean;
}

/**
 * Request to update work item metadata.
 */
export interface BetaSelfHostedWorkUpdateRequest {
  /**
   * Metadata patch. Set a key to a string to upsert it, or to null to delete it.
   * Omit the field to preserve existing metadata.
   */
  metadata: { [key: string]: string | null };
}

/**
 * Work data for session work items.
 *
 * This resource type is used when work represents a session that needs to be
 * executed in a self-hosted environment.
 */
export interface BetaSessionWorkData {
  /**
   * Session identifier (e.g., 'session\_...')
   */
  id: string;

  /**
   * Type of work data
   */
  type: 'session';
}

/**
 * Decoded payload of the `secret` field on a self-hosted work item. The wire value
 * of `secret` is a base64url-encoded JSON document matching this schema. SDKs that
 * ship a runner helper for self-hosted environments use this type as the return
 * value of their secret-decoding utility.
 */
export interface BetaWorkSecret {
  /**
   * Bearer credential the runner uses for all per-session downstream calls
   * (heartbeat, ack, event stream, send, stop). Format: `sk-ant-req-...`.
   */
  sessions_token: string;

  /**
   * API base URL the runner should use for downstream calls. When absent the runner
   * falls back to its default Anthropic endpoint.
   */
  api_base_url?: string;
}

export interface WorkRetrieveParams {
  /**
   * Path param
   */
  environment_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkUpdateParams {
  /**
   * Path param
   */
  environment_id: string;

  /**
   * Body param: Metadata patch. Set a key to a string to upsert it, or to null to
   * delete it. Omit the field to preserve existing metadata.
   */
  metadata: { [key: string]: string | null };

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkListParams extends PageCursorParams {
  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkAckParams {
  /**
   * Path param
   */
  environment_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkHeartbeatParams {
  /**
   * Path param
   */
  environment_id: string;

  /**
   * Query param: Desired TTL in seconds
   */
  desired_ttl_seconds?: number | null;

  /**
   * Query param: Expected last_heartbeat for conditional update (optimistic
   * concurrency). Use literal 'NO_HEARTBEAT' to claim an unclaimed lease (first
   * heartbeat). For subsequent heartbeats, echo the server's previous last_heartbeat
   * value exactly. Returns 412 Precondition Failed if the actual value doesn't
   * match.
   */
  expected_last_heartbeat?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkPollParams {
  /**
   * Query param: How long to wait for work to arrive before returning. Must be 1-999
   * in milliseconds. Defaults to non-blocking (returns immediately if no work is
   * available).
   */
  block_ms?: number | null;

  /**
   * Query param: Reclaim unacknowledged work items older than this many
   * milliseconds. If omitted, uses the default (5000ms).
   */
  reclaim_older_than_ms?: number | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Unique identifier for the specific worker polling, used to track
   * aggregated environment-level work metrics in Console
   */
  'Anthropic-Worker-ID'?: string;
}

export interface WorkStatsParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkStopParams {
  /**
   * Path param
   */
  environment_id: string;

  /**
   * Body param: If true, immediately stop work without graceful shutdown
   */
  force?: boolean;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export { WorkPoller, type WorkPollerOptions } from '../../../lib/environments/poller';
export { EnvironmentWorker, type EnvironmentWorkerOptions } from '../../../lib/environments/worker';

Work.WorkPoller = WorkPoller;
Work.EnvironmentWorker = EnvironmentWorker;

export declare namespace Work {
  export { WorkPoller, EnvironmentWorker };

  export {
    type BetaHealthCheckWorkData as BetaHealthCheckWorkData,
    type BetaSelfHostedWork as BetaSelfHostedWork,
    type BetaSelfHostedWorkHeartbeatResponse as BetaSelfHostedWorkHeartbeatResponse,
    type BetaSelfHostedWorkListResponse as BetaSelfHostedWorkListResponse,
    type BetaSelfHostedWorkQueueStats as BetaSelfHostedWorkQueueStats,
    type BetaSelfHostedWorkStopRequest as BetaSelfHostedWorkStopRequest,
    type BetaSelfHostedWorkUpdateRequest as BetaSelfHostedWorkUpdateRequest,
    type BetaSessionWorkData as BetaSessionWorkData,
    type BetaWorkSecret as BetaWorkSecret,
    type BetaSelfHostedWorksPageCursor as BetaSelfHostedWorksPageCursor,
    type WorkRetrieveParams as WorkRetrieveParams,
    type WorkUpdateParams as WorkUpdateParams,
    type WorkListParams as WorkListParams,
    type WorkAckParams as WorkAckParams,
    type WorkHeartbeatParams as WorkHeartbeatParams,
    type WorkPollParams as WorkPollParams,
    type WorkStatsParams as WorkStatsParams,
    type WorkStopParams as WorkStopParams,
  };
}
