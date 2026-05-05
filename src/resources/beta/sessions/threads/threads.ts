// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as AgentsAPI from '../../agents/agents';
import * as EventsAPI from '../events';
import * as SessionsAPI from '../sessions';
import * as ThreadsEventsAPI from './events';
import { EventListParams, EventStreamParams, Events } from './events';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class Threads extends APIResource {
  events: ThreadsEventsAPI.Events = new ThreadsEventsAPI.Events(this._client);

  /**
   * Get Session Thread
   *
   * @example
   * ```ts
   * const betaManagedAgentsSessionThread =
   *   await client.beta.sessions.threads.retrieve(
   *     'sthr_011CZkZVWa6oIjw0rgXZpnBt',
   *     { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   *   );
   * ```
   */
  retrieve(
    threadID: string,
    params: ThreadRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsSessionThread> {
    const { session_id, betas } = params;
    return this._client.get(path`/v1/sessions/${session_id}/threads/${threadID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List Session Threads
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsSessionThread of client.beta.sessions.threads.list(
   *   'sesn_011CZkZAtmR3yMPDzynEDxu7',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    sessionID: string,
    params: ThreadListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsSessionThreadsPageCursor, BetaManagedAgentsSessionThread> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/sessions/${sessionID}/threads?beta=true`,
      PageCursor<BetaManagedAgentsSessionThread>,
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
   * Archive Session Thread
   *
   * @example
   * ```ts
   * const betaManagedAgentsSessionThread =
   *   await client.beta.sessions.threads.archive(
   *     'sthr_011CZkZVWa6oIjw0rgXZpnBt',
   *     { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   *   );
   * ```
   */
  archive(
    threadID: string,
    params: ThreadArchiveParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsSessionThread> {
    const { session_id, betas } = params;
    return this._client.post(path`/v1/sessions/${session_id}/threads/${threadID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaManagedAgentsSessionThreadsPageCursor = PageCursor<BetaManagedAgentsSessionThread>;

/**
 * An execution thread within a `session`. Each session has one primary thread plus
 * zero or more child threads spawned by the coordinator.
 */
export interface BetaManagedAgentsSessionThread {
  /**
   * Unique identifier for this thread.
   */
  id: string;

  /**
   * Resolved `agent` definition for a single `session_thread`. Snapshot of the agent
   * at thread creation time. The multiagent roster is not repeated here; read it
   * from `Session.agent`.
   */
  agent: BetaManagedAgentsSessionThreadAgent;

  /**
   * A timestamp in RFC 3339 format
   */
  archived_at: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  /**
   * Parent thread that spawned this thread. Null for the primary thread.
   */
  parent_thread_id: string | null;

  /**
   * The session this thread belongs to.
   */
  session_id: string;

  /**
   * Timing statistics for a session thread.
   */
  stats: BetaManagedAgentsSessionThreadStats | null;

  /**
   * SessionThreadStatus enum
   */
  status: BetaManagedAgentsSessionThreadStatus;

  type: 'session_thread';

  /**
   * A timestamp in RFC 3339 format
   */
  updated_at: string;

  /**
   * Cumulative token usage for a session thread across all turns.
   */
  usage: BetaManagedAgentsSessionThreadUsage | null;
}

/**
 * Resolved `agent` definition for a single `session_thread`. Snapshot of the agent
 * at thread creation time. The multiagent roster is not repeated here; read it
 * from `Session.agent`.
 */
export interface BetaManagedAgentsSessionThreadAgent {
  id: string;

  description: string | null;

  mcp_servers: Array<AgentsAPI.BetaManagedAgentsMCPServerURLDefinition>;

  /**
   * Model identifier and configuration.
   */
  model: AgentsAPI.BetaManagedAgentsModelConfig;

  name: string;

  skills: Array<AgentsAPI.BetaManagedAgentsAnthropicSkill | AgentsAPI.BetaManagedAgentsCustomSkill>;

  system: string | null;

  tools: Array<
    | AgentsAPI.BetaManagedAgentsAgentToolset20260401
    | AgentsAPI.BetaManagedAgentsMCPToolset
    | AgentsAPI.BetaManagedAgentsCustomTool
  >;

  type: 'agent';

  version: number;
}

/**
 * Timing statistics for a session thread.
 */
export interface BetaManagedAgentsSessionThreadStats {
  /**
   * Cumulative time in seconds the thread spent actively running. Excludes idle
   * time.
   */
  active_seconds?: number;

  /**
   * Elapsed time since thread creation in seconds. For archived threads, frozen at
   * the final update.
   */
  duration_seconds?: number;

  /**
   * Time in seconds for the thread to begin running. Zero for child threads, which
   * start immediately.
   */
  startup_seconds?: number;
}

/**
 * SessionThreadStatus enum
 */
export type BetaManagedAgentsSessionThreadStatus = 'running' | 'idle' | 'rescheduling' | 'terminated';

/**
 * Cumulative token usage for a session thread across all turns.
 */
export interface BetaManagedAgentsSessionThreadUsage {
  /**
   * Prompt-cache creation token usage broken down by cache lifetime.
   */
  cache_creation?: SessionsAPI.BetaManagedAgentsCacheCreationUsage;

  /**
   * Total tokens read from prompt cache.
   */
  cache_read_input_tokens?: number;

  /**
   * Total input tokens consumed across all turns.
   */
  input_tokens?: number;

  /**
   * Total output tokens generated across all turns.
   */
  output_tokens?: number;
}

/**
 * Server-sent event in a single thread's stream.
 */
export type BetaManagedAgentsStreamSessionThreadEvents =
  | EventsAPI.BetaManagedAgentsUserMessageEvent
  | EventsAPI.BetaManagedAgentsUserInterruptEvent
  | EventsAPI.BetaManagedAgentsUserToolConfirmationEvent
  | EventsAPI.BetaManagedAgentsUserCustomToolResultEvent
  | EventsAPI.BetaManagedAgentsAgentCustomToolUseEvent
  | EventsAPI.BetaManagedAgentsAgentMessageEvent
  | EventsAPI.BetaManagedAgentsAgentThinkingEvent
  | EventsAPI.BetaManagedAgentsAgentMCPToolUseEvent
  | EventsAPI.BetaManagedAgentsAgentMCPToolResultEvent
  | EventsAPI.BetaManagedAgentsAgentToolUseEvent
  | EventsAPI.BetaManagedAgentsAgentToolResultEvent
  | EventsAPI.BetaManagedAgentsAgentThreadMessageReceivedEvent
  | EventsAPI.BetaManagedAgentsAgentThreadMessageSentEvent
  | EventsAPI.BetaManagedAgentsAgentThreadContextCompactedEvent
  | EventsAPI.BetaManagedAgentsSessionErrorEvent
  | EventsAPI.BetaManagedAgentsSessionStatusRescheduledEvent
  | EventsAPI.BetaManagedAgentsSessionStatusRunningEvent
  | EventsAPI.BetaManagedAgentsSessionStatusIdleEvent
  | EventsAPI.BetaManagedAgentsSessionStatusTerminatedEvent
  | EventsAPI.BetaManagedAgentsSessionThreadCreatedEvent
  | EventsAPI.BetaManagedAgentsSpanOutcomeEvaluationStartEvent
  | EventsAPI.BetaManagedAgentsSpanOutcomeEvaluationEndEvent
  | EventsAPI.BetaManagedAgentsSpanModelRequestStartEvent
  | EventsAPI.BetaManagedAgentsSpanModelRequestEndEvent
  | EventsAPI.BetaManagedAgentsSpanOutcomeEvaluationOngoingEvent
  | EventsAPI.BetaManagedAgentsUserDefineOutcomeEvent
  | EventsAPI.BetaManagedAgentsSessionDeletedEvent
  | EventsAPI.BetaManagedAgentsSessionThreadStatusRunningEvent
  | EventsAPI.BetaManagedAgentsSessionThreadStatusIdleEvent
  | EventsAPI.BetaManagedAgentsSessionThreadStatusTerminatedEvent
  | EventsAPI.BetaManagedAgentsSessionThreadStatusRescheduledEvent;

export interface ThreadRetrieveParams {
  /**
   * Path param: Path parameter session_id
   */
  session_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ThreadListParams extends PageCursorParams {
  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ThreadArchiveParams {
  /**
   * Path param: Path parameter session_id
   */
  session_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

Threads.Events = Events;

export declare namespace Threads {
  export {
    type BetaManagedAgentsSessionThread as BetaManagedAgentsSessionThread,
    type BetaManagedAgentsSessionThreadAgent as BetaManagedAgentsSessionThreadAgent,
    type BetaManagedAgentsSessionThreadStats as BetaManagedAgentsSessionThreadStats,
    type BetaManagedAgentsSessionThreadStatus as BetaManagedAgentsSessionThreadStatus,
    type BetaManagedAgentsSessionThreadUsage as BetaManagedAgentsSessionThreadUsage,
    type BetaManagedAgentsStreamSessionThreadEvents as BetaManagedAgentsStreamSessionThreadEvents,
    type BetaManagedAgentsSessionThreadsPageCursor as BetaManagedAgentsSessionThreadsPageCursor,
    type ThreadRetrieveParams as ThreadRetrieveParams,
    type ThreadListParams as ThreadListParams,
    type ThreadArchiveParams as ThreadArchiveParams,
  };

  export {
    Events as Events,
    type EventListParams as EventListParams,
    type EventStreamParams as EventStreamParams,
  };
}
