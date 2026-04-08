// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as AgentsAPI from '../agents/agents';
import * as EventsAPI from './events';
import {
  BetaManagedAgentsAgentCustomToolUseEvent,
  BetaManagedAgentsAgentMCPToolResultEvent,
  BetaManagedAgentsAgentMCPToolUseEvent,
  BetaManagedAgentsAgentMessageEvent,
  BetaManagedAgentsAgentThinkingEvent,
  BetaManagedAgentsAgentThreadContextCompactedEvent,
  BetaManagedAgentsAgentToolResultEvent,
  BetaManagedAgentsAgentToolUseEvent,
  BetaManagedAgentsBase64DocumentSource,
  BetaManagedAgentsBase64ImageSource,
  BetaManagedAgentsBillingError,
  BetaManagedAgentsDocumentBlock,
  BetaManagedAgentsEventParams,
  BetaManagedAgentsFileDocumentSource,
  BetaManagedAgentsFileImageSource,
  BetaManagedAgentsImageBlock,
  BetaManagedAgentsMCPAuthenticationFailedError,
  BetaManagedAgentsMCPConnectionFailedError,
  BetaManagedAgentsModelOverloadedError,
  BetaManagedAgentsModelRateLimitedError,
  BetaManagedAgentsModelRequestFailedError,
  BetaManagedAgentsPlainTextDocumentSource,
  BetaManagedAgentsRetryStatusExhausted,
  BetaManagedAgentsRetryStatusRetrying,
  BetaManagedAgentsRetryStatusTerminal,
  BetaManagedAgentsSendSessionEvents,
  BetaManagedAgentsSessionDeletedEvent,
  BetaManagedAgentsSessionEndTurn,
  BetaManagedAgentsSessionErrorEvent,
  BetaManagedAgentsSessionEvent,
  BetaManagedAgentsSessionEventsPageCursor,
  BetaManagedAgentsSessionRequiresAction,
  BetaManagedAgentsSessionRetriesExhausted,
  BetaManagedAgentsSessionStatusIdleEvent,
  BetaManagedAgentsSessionStatusRescheduledEvent,
  BetaManagedAgentsSessionStatusRunningEvent,
  BetaManagedAgentsSessionStatusTerminatedEvent,
  BetaManagedAgentsSpanModelRequestEndEvent,
  BetaManagedAgentsSpanModelRequestStartEvent,
  BetaManagedAgentsSpanModelUsage,
  BetaManagedAgentsStreamSessionEvents,
  BetaManagedAgentsTextBlock,
  BetaManagedAgentsURLDocumentSource,
  BetaManagedAgentsURLImageSource,
  BetaManagedAgentsUnknownError,
  BetaManagedAgentsUserCustomToolResultEvent,
  BetaManagedAgentsUserCustomToolResultEventParams,
  BetaManagedAgentsUserInterruptEvent,
  BetaManagedAgentsUserInterruptEventParams,
  BetaManagedAgentsUserMessageEvent,
  BetaManagedAgentsUserMessageEventParams,
  BetaManagedAgentsUserToolConfirmationEvent,
  BetaManagedAgentsUserToolConfirmationEventParams,
  EventListParams,
  EventSendParams,
  EventStreamParams,
  Events,
} from './events';
import * as ResourcesAPI from './resources';
import {
  BetaManagedAgentsDeleteSessionResource,
  BetaManagedAgentsFileResource,
  BetaManagedAgentsGitHubRepositoryResource,
  BetaManagedAgentsSessionResource,
  BetaManagedAgentsSessionResourcesPageCursor,
  ResourceAddParams,
  ResourceDeleteParams,
  ResourceListParams,
  ResourceRetrieveParams,
  ResourceRetrieveResponse,
  ResourceUpdateParams,
  ResourceUpdateResponse,
  Resources,
} from './resources';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Sessions extends APIResource {
  events: EventsAPI.Events = new EventsAPI.Events(this._client);
  resources: ResourcesAPI.Resources = new ResourcesAPI.Resources(this._client);

  /**
   * Create Session
   *
   * @example
   * ```ts
   * const betaManagedAgentsSession =
   *   await client.beta.sessions.create({
   *     agent: 'agent_011CZkYpogX7uDKUyvBTophP',
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   });
   * ```
   */
  create(params: SessionCreateParams, options?: RequestOptions): APIPromise<BetaManagedAgentsSession> {
    const { betas, ...body } = params;
    return this._client.post('/v1/sessions?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Get Session
   *
   * @example
   * ```ts
   * const betaManagedAgentsSession =
   *   await client.beta.sessions.retrieve(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *   );
   * ```
   */
  retrieve(
    sessionID: string,
    params: SessionRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsSession> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/sessions/${sessionID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Session
   *
   * @example
   * ```ts
   * const betaManagedAgentsSession =
   *   await client.beta.sessions.update(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *   );
   * ```
   */
  update(
    sessionID: string,
    params: SessionUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsSession> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/sessions/${sessionID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List Sessions
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsSession of client.beta.sessions.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: SessionListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsSessionsPageCursor, BetaManagedAgentsSession> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/sessions?beta=true', PageCursor<BetaManagedAgentsSession>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Session
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeletedSession =
   *   await client.beta.sessions.delete(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *   );
   * ```
   */
  delete(
    sessionID: string,
    params: SessionDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsDeletedSession> {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/sessions/${sessionID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Archive Session
   *
   * @example
   * ```ts
   * const betaManagedAgentsSession =
   *   await client.beta.sessions.archive(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *   );
   * ```
   */
  archive(
    sessionID: string,
    params: SessionArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsSession> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/sessions/${sessionID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaManagedAgentsSessionsPageCursor = PageCursor<BetaManagedAgentsSession>;

/**
 * Specification for an Agent. Provide a specific `version` or use the short-form
 * `agent="agent_id"` for the most recent version
 */
export interface BetaManagedAgentsAgentParams {
  /**
   * The `agent` ID.
   */
  id: string;

  type: 'agent';

  /**
   * The specific `agent` version to use. Omit to use the latest version. Must be at
   * least 1 if specified.
   */
  version?: number;
}

export interface BetaManagedAgentsBranchCheckout {
  /**
   * Branch name to check out.
   */
  name: string;

  type: 'branch';
}

/**
 * Prompt-cache creation token usage broken down by cache lifetime.
 */
export interface BetaManagedAgentsCacheCreationUsage {
  /**
   * Tokens used to create 1-hour ephemeral cache entries.
   */
  ephemeral_1h_input_tokens?: number;

  /**
   * Tokens used to create 5-minute ephemeral cache entries.
   */
  ephemeral_5m_input_tokens?: number;
}

export interface BetaManagedAgentsCommitCheckout {
  /**
   * Full commit SHA to check out.
   */
  sha: string;

  type: 'commit';
}

/**
 * Confirmation that a `session` has been permanently deleted.
 */
export interface BetaManagedAgentsDeletedSession {
  id: string;

  type: 'session_deleted';
}

/**
 * Mount a file uploaded via the Files API into the session.
 */
export interface BetaManagedAgentsFileResourceParams {
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
 * Mount a GitHub repository into the session's container.
 */
export interface BetaManagedAgentsGitHubRepositoryResourceParams {
  /**
   * GitHub authorization token used to clone the repository.
   */
  authorization_token: string;

  type: 'github_repository';

  /**
   * Github URL of the repository
   */
  url: string;

  /**
   * Branch or commit to check out. Defaults to the repository's default branch.
   */
  checkout?: BetaManagedAgentsBranchCheckout | BetaManagedAgentsCommitCheckout | null;

  /**
   * Mount path in the container. Defaults to `/workspace/<repo-name>`.
   */
  mount_path?: string | null;
}

/**
 * A Managed Agents `session`.
 */
export interface BetaManagedAgentsSession {
  id: string;

  /**
   * Resolved `agent` definition for a `session`. Snapshot of the `agent` at
   * `session` creation time.
   */
  agent: BetaManagedAgentsSessionAgent;

  /**
   * A timestamp in RFC 3339 format
   */
  archived_at: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  environment_id: string;

  metadata: { [key: string]: string };

  resources: Array<ResourcesAPI.BetaManagedAgentsSessionResource>;

  /**
   * Timing statistics for a session.
   */
  stats: BetaManagedAgentsSessionStats;

  /**
   * SessionStatus enum
   */
  status: 'rescheduling' | 'running' | 'idle' | 'terminated';

  title: string | null;

  type: 'session';

  /**
   * A timestamp in RFC 3339 format
   */
  updated_at: string;

  /**
   * Cumulative token usage for a session across all turns.
   */
  usage: BetaManagedAgentsSessionUsage;

  /**
   * Vault IDs attached to the session at creation. Empty when no vaults were
   * supplied.
   */
  vault_ids: Array<string>;
}

/**
 * Resolved `agent` definition for a `session`. Snapshot of the `agent` at
 * `session` creation time.
 */
export interface BetaManagedAgentsSessionAgent {
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
 * Timing statistics for a session.
 */
export interface BetaManagedAgentsSessionStats {
  /**
   * Cumulative time in seconds the session spent in running status. Excludes idle
   * time.
   */
  active_seconds?: number;

  /**
   * Elapsed time since session creation in seconds. For terminated sessions, frozen
   * at the final update.
   */
  duration_seconds?: number;
}

/**
 * Cumulative token usage for a session across all turns.
 */
export interface BetaManagedAgentsSessionUsage {
  /**
   * Prompt-cache creation token usage broken down by cache lifetime.
   */
  cache_creation?: BetaManagedAgentsCacheCreationUsage;

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

export interface SessionCreateParams {
  /**
   * Body param: Agent identifier. Accepts the `agent` ID string, which pins the
   * latest version for the session, or an `agent` object with both id and version
   * specified.
   */
  agent: string | BetaManagedAgentsAgentParams;

  /**
   * Body param: ID of the `environment` defining the container configuration for
   * this session.
   */
  environment_id: string;

  /**
   * Body param: Arbitrary key-value metadata attached to the session. Maximum 16
   * pairs, keys up to 64 chars, values up to 512 chars.
   */
  metadata?: { [key: string]: string };

  /**
   * Body param: Resources (e.g. repositories, files) to mount into the session's
   * container.
   */
  resources?: Array<BetaManagedAgentsGitHubRepositoryResourceParams | BetaManagedAgentsFileResourceParams>;

  /**
   * Body param: Human-readable session title.
   */
  title?: string | null;

  /**
   * Body param: Vault IDs for stored credentials the agent can use during the
   * session.
   */
  vault_ids?: Array<string>;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SessionRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SessionUpdateParams {
  /**
   * Body param: Metadata patch. Set a key to a string to upsert it, or to null to
   * delete it. Omit the field to preserve.
   */
  metadata?: { [key: string]: string | null } | null;

  /**
   * Body param: Human-readable session title.
   */
  title?: string | null;

  /**
   * Body param: Vault IDs (`vlt_*`) to attach to the session. Not yet supported;
   * requests setting this field are rejected. Reserved for future use.
   */
  vault_ids?: Array<string>;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SessionListParams extends PageCursorParams {
  /**
   * Query param: Filter sessions created with this agent ID.
   */
  agent_id?: string;

  /**
   * Query param: Filter by agent version. Only applies when agent_id is also set.
   */
  agent_version?: number;

  /**
   * Query param: Return sessions created after this time (exclusive).
   */
  'created_at[gt]'?: string;

  /**
   * Query param: Return sessions created at or after this time (inclusive).
   */
  'created_at[gte]'?: string;

  /**
   * Query param: Return sessions created before this time (exclusive).
   */
  'created_at[lt]'?: string;

  /**
   * Query param: Return sessions created at or before this time (inclusive).
   */
  'created_at[lte]'?: string;

  /**
   * Query param: When true, includes archived sessions. Default: false (exclude
   * archived).
   */
  include_archived?: boolean;

  /**
   * Query param: Sort direction for results, ordered by created_at. Defaults to desc
   * (newest first).
   */
  order?: 'asc' | 'desc';

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SessionDeleteParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface SessionArchiveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

Sessions.Events = Events;
Sessions.Resources = Resources;

export declare namespace Sessions {
  export {
    type BetaManagedAgentsAgentParams as BetaManagedAgentsAgentParams,
    type BetaManagedAgentsBranchCheckout as BetaManagedAgentsBranchCheckout,
    type BetaManagedAgentsCacheCreationUsage as BetaManagedAgentsCacheCreationUsage,
    type BetaManagedAgentsCommitCheckout as BetaManagedAgentsCommitCheckout,
    type BetaManagedAgentsDeletedSession as BetaManagedAgentsDeletedSession,
    type BetaManagedAgentsFileResourceParams as BetaManagedAgentsFileResourceParams,
    type BetaManagedAgentsGitHubRepositoryResourceParams as BetaManagedAgentsGitHubRepositoryResourceParams,
    type BetaManagedAgentsSession as BetaManagedAgentsSession,
    type BetaManagedAgentsSessionAgent as BetaManagedAgentsSessionAgent,
    type BetaManagedAgentsSessionStats as BetaManagedAgentsSessionStats,
    type BetaManagedAgentsSessionUsage as BetaManagedAgentsSessionUsage,
    type BetaManagedAgentsSessionsPageCursor as BetaManagedAgentsSessionsPageCursor,
    type SessionCreateParams as SessionCreateParams,
    type SessionRetrieveParams as SessionRetrieveParams,
    type SessionUpdateParams as SessionUpdateParams,
    type SessionListParams as SessionListParams,
    type SessionDeleteParams as SessionDeleteParams,
    type SessionArchiveParams as SessionArchiveParams,
  };

  export {
    Events as Events,
    type BetaManagedAgentsAgentCustomToolUseEvent as BetaManagedAgentsAgentCustomToolUseEvent,
    type BetaManagedAgentsAgentMCPToolResultEvent as BetaManagedAgentsAgentMCPToolResultEvent,
    type BetaManagedAgentsAgentMCPToolUseEvent as BetaManagedAgentsAgentMCPToolUseEvent,
    type BetaManagedAgentsAgentMessageEvent as BetaManagedAgentsAgentMessageEvent,
    type BetaManagedAgentsAgentThinkingEvent as BetaManagedAgentsAgentThinkingEvent,
    type BetaManagedAgentsAgentThreadContextCompactedEvent as BetaManagedAgentsAgentThreadContextCompactedEvent,
    type BetaManagedAgentsAgentToolResultEvent as BetaManagedAgentsAgentToolResultEvent,
    type BetaManagedAgentsAgentToolUseEvent as BetaManagedAgentsAgentToolUseEvent,
    type BetaManagedAgentsBase64DocumentSource as BetaManagedAgentsBase64DocumentSource,
    type BetaManagedAgentsBase64ImageSource as BetaManagedAgentsBase64ImageSource,
    type BetaManagedAgentsBillingError as BetaManagedAgentsBillingError,
    type BetaManagedAgentsDocumentBlock as BetaManagedAgentsDocumentBlock,
    type BetaManagedAgentsEventParams as BetaManagedAgentsEventParams,
    type BetaManagedAgentsFileDocumentSource as BetaManagedAgentsFileDocumentSource,
    type BetaManagedAgentsFileImageSource as BetaManagedAgentsFileImageSource,
    type BetaManagedAgentsImageBlock as BetaManagedAgentsImageBlock,
    type BetaManagedAgentsMCPAuthenticationFailedError as BetaManagedAgentsMCPAuthenticationFailedError,
    type BetaManagedAgentsMCPConnectionFailedError as BetaManagedAgentsMCPConnectionFailedError,
    type BetaManagedAgentsModelOverloadedError as BetaManagedAgentsModelOverloadedError,
    type BetaManagedAgentsModelRateLimitedError as BetaManagedAgentsModelRateLimitedError,
    type BetaManagedAgentsModelRequestFailedError as BetaManagedAgentsModelRequestFailedError,
    type BetaManagedAgentsPlainTextDocumentSource as BetaManagedAgentsPlainTextDocumentSource,
    type BetaManagedAgentsRetryStatusExhausted as BetaManagedAgentsRetryStatusExhausted,
    type BetaManagedAgentsRetryStatusRetrying as BetaManagedAgentsRetryStatusRetrying,
    type BetaManagedAgentsRetryStatusTerminal as BetaManagedAgentsRetryStatusTerminal,
    type BetaManagedAgentsSendSessionEvents as BetaManagedAgentsSendSessionEvents,
    type BetaManagedAgentsSessionDeletedEvent as BetaManagedAgentsSessionDeletedEvent,
    type BetaManagedAgentsSessionEndTurn as BetaManagedAgentsSessionEndTurn,
    type BetaManagedAgentsSessionErrorEvent as BetaManagedAgentsSessionErrorEvent,
    type BetaManagedAgentsSessionEvent as BetaManagedAgentsSessionEvent,
    type BetaManagedAgentsSessionRequiresAction as BetaManagedAgentsSessionRequiresAction,
    type BetaManagedAgentsSessionRetriesExhausted as BetaManagedAgentsSessionRetriesExhausted,
    type BetaManagedAgentsSessionStatusIdleEvent as BetaManagedAgentsSessionStatusIdleEvent,
    type BetaManagedAgentsSessionStatusRescheduledEvent as BetaManagedAgentsSessionStatusRescheduledEvent,
    type BetaManagedAgentsSessionStatusRunningEvent as BetaManagedAgentsSessionStatusRunningEvent,
    type BetaManagedAgentsSessionStatusTerminatedEvent as BetaManagedAgentsSessionStatusTerminatedEvent,
    type BetaManagedAgentsSpanModelRequestEndEvent as BetaManagedAgentsSpanModelRequestEndEvent,
    type BetaManagedAgentsSpanModelRequestStartEvent as BetaManagedAgentsSpanModelRequestStartEvent,
    type BetaManagedAgentsSpanModelUsage as BetaManagedAgentsSpanModelUsage,
    type BetaManagedAgentsStreamSessionEvents as BetaManagedAgentsStreamSessionEvents,
    type BetaManagedAgentsTextBlock as BetaManagedAgentsTextBlock,
    type BetaManagedAgentsUnknownError as BetaManagedAgentsUnknownError,
    type BetaManagedAgentsURLDocumentSource as BetaManagedAgentsURLDocumentSource,
    type BetaManagedAgentsURLImageSource as BetaManagedAgentsURLImageSource,
    type BetaManagedAgentsUserCustomToolResultEvent as BetaManagedAgentsUserCustomToolResultEvent,
    type BetaManagedAgentsUserCustomToolResultEventParams as BetaManagedAgentsUserCustomToolResultEventParams,
    type BetaManagedAgentsUserInterruptEvent as BetaManagedAgentsUserInterruptEvent,
    type BetaManagedAgentsUserInterruptEventParams as BetaManagedAgentsUserInterruptEventParams,
    type BetaManagedAgentsUserMessageEvent as BetaManagedAgentsUserMessageEvent,
    type BetaManagedAgentsUserMessageEventParams as BetaManagedAgentsUserMessageEventParams,
    type BetaManagedAgentsUserToolConfirmationEvent as BetaManagedAgentsUserToolConfirmationEvent,
    type BetaManagedAgentsUserToolConfirmationEventParams as BetaManagedAgentsUserToolConfirmationEventParams,
    type BetaManagedAgentsSessionEventsPageCursor as BetaManagedAgentsSessionEventsPageCursor,
    type EventListParams as EventListParams,
    type EventSendParams as EventSendParams,
    type EventStreamParams as EventStreamParams,
  };

  export {
    Resources as Resources,
    type BetaManagedAgentsDeleteSessionResource as BetaManagedAgentsDeleteSessionResource,
    type BetaManagedAgentsFileResource as BetaManagedAgentsFileResource,
    type BetaManagedAgentsGitHubRepositoryResource as BetaManagedAgentsGitHubRepositoryResource,
    type BetaManagedAgentsSessionResource as BetaManagedAgentsSessionResource,
    type ResourceRetrieveResponse as ResourceRetrieveResponse,
    type ResourceUpdateResponse as ResourceUpdateResponse,
    type BetaManagedAgentsSessionResourcesPageCursor as BetaManagedAgentsSessionResourcesPageCursor,
    type ResourceRetrieveParams as ResourceRetrieveParams,
    type ResourceUpdateParams as ResourceUpdateParams,
    type ResourceListParams as ResourceListParams,
    type ResourceDeleteParams as ResourceDeleteParams,
    type ResourceAddParams as ResourceAddParams,
  };
}
