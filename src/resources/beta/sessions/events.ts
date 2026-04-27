// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { Stream } from '../../../core/streaming';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Events extends APIResource {
  /**
   * List Events
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsSessionEvent of client.beta.sessions.events.list(
   *   'sesn_011CZkZAtmR3yMPDzynEDxu7',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    sessionID: string,
    params: EventListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsSessionEventsPageCursor, BetaManagedAgentsSessionEvent> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/sessions/${sessionID}/events?beta=true`,
      PageCursor<BetaManagedAgentsSessionEvent>,
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
   * Send Events
   *
   * @example
   * ```ts
   * const betaManagedAgentsSendSessionEvents =
   *   await client.beta.sessions.events.send(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *     {
   *       events: [
   *         {
   *           content: [
   *             {
   *               text: 'Where is my order #1234?',
   *               type: 'text',
   *             },
   *           ],
   *           type: 'user.message',
   *         },
   *       ],
   *     },
   *   );
   * ```
   */
  send(
    sessionID: string,
    params: EventSendParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsSendSessionEvents> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/sessions/${sessionID}/events?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Stream Events
   *
   * @example
   * ```ts
   * const betaManagedAgentsStreamSessionEvents =
   *   await client.beta.sessions.events.stream(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *   );
   * ```
   */
  stream(
    sessionID: string,
    params: EventStreamParams | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Stream<BetaManagedAgentsStreamSessionEvents>> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/sessions/${sessionID}/events/stream?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
      stream: true,
    }) as APIPromise<Stream<BetaManagedAgentsStreamSessionEvents>>;
  }
}

export type BetaManagedAgentsSessionEventsPageCursor = PageCursor<BetaManagedAgentsSessionEvent>;

/**
 * Event emitted when the agent calls a custom tool. The session goes idle until
 * the client sends a `user.custom_tool_result` event with the result.
 */
export interface BetaManagedAgentsAgentCustomToolUseEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * Input parameters for the tool call.
   */
  input: { [key: string]: unknown };

  /**
   * Name of the custom tool being called.
   */
  name: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'agent.custom_tool_use';
}

/**
 * Event representing the result of an MCP tool execution.
 */
export interface BetaManagedAgentsAgentMCPToolResultEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * The id of the `agent.mcp_tool_use` event this result corresponds to.
   */
  mcp_tool_use_id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'agent.mcp_tool_result';

  /**
   * The result content returned by the tool.
   */
  content?: Array<BetaManagedAgentsTextBlock | BetaManagedAgentsImageBlock | BetaManagedAgentsDocumentBlock>;

  /**
   * Whether the tool execution resulted in an error.
   */
  is_error?: boolean | null;
}

/**
 * Event emitted when the agent invokes a tool provided by an MCP server.
 */
export interface BetaManagedAgentsAgentMCPToolUseEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * Input parameters for the tool call.
   */
  input: { [key: string]: unknown };

  /**
   * Name of the MCP server providing the tool.
   */
  mcp_server_name: string;

  /**
   * Name of the MCP tool being used.
   */
  name: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'agent.mcp_tool_use';

  /**
   * AgentEvaluatedPermission enum
   */
  evaluated_permission?: 'allow' | 'ask' | 'deny';
}

/**
 * An agent response event in the session conversation.
 */
export interface BetaManagedAgentsAgentMessageEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * Array of text blocks comprising the agent response.
   */
  content: Array<BetaManagedAgentsTextBlock>;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'agent.message';
}

/**
 * Indicates the agent is making forward progress via extended thinking. A progress
 * signal, not a content carrier.
 */
export interface BetaManagedAgentsAgentThinkingEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'agent.thinking';
}

/**
 * Indicates that context compaction (summarization) occurred during the session.
 */
export interface BetaManagedAgentsAgentThreadContextCompactedEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'agent.thread_context_compacted';
}

/**
 * Event representing the result of an agent tool execution.
 */
export interface BetaManagedAgentsAgentToolResultEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  /**
   * The id of the `agent.tool_use` event this result corresponds to.
   */
  tool_use_id: string;

  type: 'agent.tool_result';

  /**
   * The result content returned by the tool.
   */
  content?: Array<BetaManagedAgentsTextBlock | BetaManagedAgentsImageBlock | BetaManagedAgentsDocumentBlock>;

  /**
   * Whether the tool execution resulted in an error.
   */
  is_error?: boolean | null;
}

/**
 * Event emitted when the agent invokes a built-in agent tool.
 */
export interface BetaManagedAgentsAgentToolUseEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * Input parameters for the tool call.
   */
  input: { [key: string]: unknown };

  /**
   * Name of the agent tool being used.
   */
  name: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'agent.tool_use';

  /**
   * AgentEvaluatedPermission enum
   */
  evaluated_permission?: 'allow' | 'ask' | 'deny';
}

/**
 * Base64-encoded document data.
 */
export interface BetaManagedAgentsBase64DocumentSource {
  /**
   * Base64-encoded document data.
   */
  data: string;

  /**
   * MIME type of the document (e.g., "application/pdf").
   */
  media_type: string;

  type: 'base64';
}

/**
 * Base64-encoded image data.
 */
export interface BetaManagedAgentsBase64ImageSource {
  /**
   * Base64-encoded image data.
   */
  data: string;

  /**
   * MIME type of the image (e.g., "image/png", "image/jpeg", "image/gif",
   * "image/webp").
   */
  media_type: string;

  type: 'base64';
}

/**
 * The caller's organization or workspace cannot make model requests — out of
 * credits or spend limit reached. Retrying with the same credentials will not
 * succeed; the caller must resolve the billing state.
 */
export interface BetaManagedAgentsBillingError {
  /**
   * Human-readable error description.
   */
  message: string;

  /**
   * What the client should do next in response to this error.
   */
  retry_status:
    | BetaManagedAgentsRetryStatusRetrying
    | BetaManagedAgentsRetryStatusExhausted
    | BetaManagedAgentsRetryStatusTerminal;

  type: 'billing_error';
}

/**
 * Document content, either specified directly as base64 data, as text, or as a
 * reference via a URL.
 */
export interface BetaManagedAgentsDocumentBlock {
  /**
   * Union type for document source variants.
   */
  source:
    | BetaManagedAgentsBase64DocumentSource
    | BetaManagedAgentsPlainTextDocumentSource
    | BetaManagedAgentsURLDocumentSource
    | BetaManagedAgentsFileDocumentSource;

  type: 'document';

  /**
   * Additional context about the document for the model.
   */
  context?: string | null;

  /**
   * The title of the document.
   */
  title?: string | null;
}

/**
 * Union type for event parameters that can be sent to a session.
 */
export type BetaManagedAgentsEventParams =
  | BetaManagedAgentsUserMessageEventParams
  | BetaManagedAgentsUserInterruptEventParams
  | BetaManagedAgentsUserToolConfirmationEventParams
  | BetaManagedAgentsUserCustomToolResultEventParams;

/**
 * Document referenced by file ID.
 */
export interface BetaManagedAgentsFileDocumentSource {
  /**
   * ID of a previously uploaded file.
   */
  file_id: string;

  type: 'file';
}

/**
 * Image referenced by file ID.
 */
export interface BetaManagedAgentsFileImageSource {
  /**
   * ID of a previously uploaded file.
   */
  file_id: string;

  type: 'file';
}

/**
 * Image content specified directly as base64 data or as a reference via a URL.
 */
export interface BetaManagedAgentsImageBlock {
  /**
   * Union type for image source variants.
   */
  source:
    | BetaManagedAgentsBase64ImageSource
    | BetaManagedAgentsURLImageSource
    | BetaManagedAgentsFileImageSource;

  type: 'image';
}

/**
 * Authentication to an MCP server failed.
 */
export interface BetaManagedAgentsMCPAuthenticationFailedError {
  /**
   * Name of the MCP server that failed authentication.
   */
  mcp_server_name: string;

  /**
   * Human-readable error description.
   */
  message: string;

  /**
   * What the client should do next in response to this error.
   */
  retry_status:
    | BetaManagedAgentsRetryStatusRetrying
    | BetaManagedAgentsRetryStatusExhausted
    | BetaManagedAgentsRetryStatusTerminal;

  type: 'mcp_authentication_failed_error';
}

/**
 * Failed to connect to an MCP server.
 */
export interface BetaManagedAgentsMCPConnectionFailedError {
  /**
   * Name of the MCP server that failed to connect.
   */
  mcp_server_name: string;

  /**
   * Human-readable error description.
   */
  message: string;

  /**
   * What the client should do next in response to this error.
   */
  retry_status:
    | BetaManagedAgentsRetryStatusRetrying
    | BetaManagedAgentsRetryStatusExhausted
    | BetaManagedAgentsRetryStatusTerminal;

  type: 'mcp_connection_failed_error';
}

/**
 * The model is currently overloaded. Emitted after automatic retries are
 * exhausted.
 */
export interface BetaManagedAgentsModelOverloadedError {
  /**
   * Human-readable error description.
   */
  message: string;

  /**
   * What the client should do next in response to this error.
   */
  retry_status:
    | BetaManagedAgentsRetryStatusRetrying
    | BetaManagedAgentsRetryStatusExhausted
    | BetaManagedAgentsRetryStatusTerminal;

  type: 'model_overloaded_error';
}

/**
 * The model request was rate-limited.
 */
export interface BetaManagedAgentsModelRateLimitedError {
  /**
   * Human-readable error description.
   */
  message: string;

  /**
   * What the client should do next in response to this error.
   */
  retry_status:
    | BetaManagedAgentsRetryStatusRetrying
    | BetaManagedAgentsRetryStatusExhausted
    | BetaManagedAgentsRetryStatusTerminal;

  type: 'model_rate_limited_error';
}

/**
 * A model request failed for a reason other than overload or rate-limiting.
 */
export interface BetaManagedAgentsModelRequestFailedError {
  /**
   * Human-readable error description.
   */
  message: string;

  /**
   * What the client should do next in response to this error.
   */
  retry_status:
    | BetaManagedAgentsRetryStatusRetrying
    | BetaManagedAgentsRetryStatusExhausted
    | BetaManagedAgentsRetryStatusTerminal;

  type: 'model_request_failed_error';
}

/**
 * Plain text document content.
 */
export interface BetaManagedAgentsPlainTextDocumentSource {
  /**
   * The plain text content.
   */
  data: string;

  /**
   * MIME type of the text content. Must be "text/plain".
   */
  media_type: 'text/plain';

  type: 'text';
}

/**
 * This turn is dead; queued inputs are flushed and the session returns to idle.
 * Client may send a new prompt.
 */
export interface BetaManagedAgentsRetryStatusExhausted {
  type: 'exhausted';
}

/**
 * The server is retrying automatically. Client should wait; the same error type
 * may fire again as retrying, then once as exhausted when the retry budget runs
 * out.
 */
export interface BetaManagedAgentsRetryStatusRetrying {
  type: 'retrying';
}

/**
 * The session encountered a terminal error and will transition to `terminated`
 * state.
 */
export interface BetaManagedAgentsRetryStatusTerminal {
  type: 'terminal';
}

/**
 * Events that were successfully sent to the session.
 */
export interface BetaManagedAgentsSendSessionEvents {
  /**
   * Sent events
   */
  data?: Array<
    | BetaManagedAgentsUserMessageEvent
    | BetaManagedAgentsUserInterruptEvent
    | BetaManagedAgentsUserToolConfirmationEvent
    | BetaManagedAgentsUserCustomToolResultEvent
  >;
}

/**
 * Emitted when a session has been deleted. Terminates any active event stream — no
 * further events will be emitted for this session.
 */
export interface BetaManagedAgentsSessionDeletedEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'session.deleted';
}

/**
 * The agent completed its turn naturally and is ready for the next user message.
 */
export interface BetaManagedAgentsSessionEndTurn {
  type: 'end_turn';
}

/**
 * An error event indicating a problem occurred during session execution.
 */
export interface BetaManagedAgentsSessionErrorEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * An unknown or unexpected error occurred during session execution. A fallback
   * variant; clients that don't recognize a new error code can match on
   * `retry_status` and `message` alone.
   */
  error:
    | BetaManagedAgentsUnknownError
    | BetaManagedAgentsModelOverloadedError
    | BetaManagedAgentsModelRateLimitedError
    | BetaManagedAgentsModelRequestFailedError
    | BetaManagedAgentsMCPConnectionFailedError
    | BetaManagedAgentsMCPAuthenticationFailedError
    | BetaManagedAgentsBillingError;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'session.error';
}

/**
 * Union type for all event types in a session.
 */
export type BetaManagedAgentsSessionEvent =
  | BetaManagedAgentsUserMessageEvent
  | BetaManagedAgentsUserInterruptEvent
  | BetaManagedAgentsUserToolConfirmationEvent
  | BetaManagedAgentsUserCustomToolResultEvent
  | BetaManagedAgentsAgentCustomToolUseEvent
  | BetaManagedAgentsAgentMessageEvent
  | BetaManagedAgentsAgentThinkingEvent
  | BetaManagedAgentsAgentMCPToolUseEvent
  | BetaManagedAgentsAgentMCPToolResultEvent
  | BetaManagedAgentsAgentToolUseEvent
  | BetaManagedAgentsAgentToolResultEvent
  | BetaManagedAgentsAgentThreadContextCompactedEvent
  | BetaManagedAgentsSessionErrorEvent
  | BetaManagedAgentsSessionStatusRescheduledEvent
  | BetaManagedAgentsSessionStatusRunningEvent
  | BetaManagedAgentsSessionStatusIdleEvent
  | BetaManagedAgentsSessionStatusTerminatedEvent
  | BetaManagedAgentsSpanModelRequestStartEvent
  | BetaManagedAgentsSpanModelRequestEndEvent
  | BetaManagedAgentsSessionDeletedEvent;

/**
 * The agent is idle waiting on one or more blocking user-input events (tool
 * confirmation, custom tool result, etc.). Resolving all of them transitions the
 * session back to running.
 */
export interface BetaManagedAgentsSessionRequiresAction {
  /**
   * The ids of events the agent is blocked on. Resolving fewer than all re-emits
   * `session.status_idle` with the remainder.
   */
  event_ids: Array<string>;

  type: 'requires_action';
}

/**
 * The turn ended because the retry budget was exhausted (`max_iterations` hit or
 * an error escalated to `retry_status: 'exhausted'`).
 */
export interface BetaManagedAgentsSessionRetriesExhausted {
  type: 'retries_exhausted';
}

/**
 * Indicates the agent has paused and is awaiting user input.
 */
export interface BetaManagedAgentsSessionStatusIdleEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  /**
   * The agent completed its turn naturally and is ready for the next user message.
   */
  stop_reason:
    | BetaManagedAgentsSessionEndTurn
    | BetaManagedAgentsSessionRequiresAction
    | BetaManagedAgentsSessionRetriesExhausted;

  type: 'session.status_idle';
}

/**
 * Indicates the session is recovering from an error state and is rescheduled for
 * execution.
 */
export interface BetaManagedAgentsSessionStatusRescheduledEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'session.status_rescheduled';
}

/**
 * Indicates the session is actively running and the agent is working.
 */
export interface BetaManagedAgentsSessionStatusRunningEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'session.status_running';
}

/**
 * Indicates the session has terminated, either due to an error or completion.
 */
export interface BetaManagedAgentsSessionStatusTerminatedEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'session.status_terminated';
}

/**
 * Emitted when a model request completes.
 */
export interface BetaManagedAgentsSpanModelRequestEndEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * Whether the model request resulted in an error.
   */
  is_error: boolean | null;

  /**
   * The id of the corresponding `span.model_request_start` event.
   */
  model_request_start_id: string;

  /**
   * Token usage for a single model request.
   */
  model_usage: BetaManagedAgentsSpanModelUsage;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'span.model_request_end';
}

/**
 * Emitted when a model request is initiated by the agent.
 */
export interface BetaManagedAgentsSpanModelRequestStartEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at: string;

  type: 'span.model_request_start';
}

/**
 * Token usage for a single model request.
 */
export interface BetaManagedAgentsSpanModelUsage {
  /**
   * Tokens used to create prompt cache in this request.
   */
  cache_creation_input_tokens: number;

  /**
   * Tokens read from prompt cache in this request.
   */
  cache_read_input_tokens: number;

  /**
   * Input tokens consumed by this request.
   */
  input_tokens: number;

  /**
   * Output tokens generated by this request.
   */
  output_tokens: number;

  /**
   * Inference speed mode. `fast` provides significantly faster output token
   * generation at premium pricing. Not all models support `fast`; invalid
   * combinations are rejected at create time.
   */
  speed?: 'standard' | 'fast' | null;
}

/**
 * Server-sent event in the session stream.
 */
export type BetaManagedAgentsStreamSessionEvents =
  | BetaManagedAgentsUserMessageEvent
  | BetaManagedAgentsUserInterruptEvent
  | BetaManagedAgentsUserToolConfirmationEvent
  | BetaManagedAgentsUserCustomToolResultEvent
  | BetaManagedAgentsAgentCustomToolUseEvent
  | BetaManagedAgentsAgentMessageEvent
  | BetaManagedAgentsAgentThinkingEvent
  | BetaManagedAgentsAgentMCPToolUseEvent
  | BetaManagedAgentsAgentMCPToolResultEvent
  | BetaManagedAgentsAgentToolUseEvent
  | BetaManagedAgentsAgentToolResultEvent
  | BetaManagedAgentsAgentThreadContextCompactedEvent
  | BetaManagedAgentsSessionErrorEvent
  | BetaManagedAgentsSessionStatusRescheduledEvent
  | BetaManagedAgentsSessionStatusRunningEvent
  | BetaManagedAgentsSessionStatusIdleEvent
  | BetaManagedAgentsSessionStatusTerminatedEvent
  | BetaManagedAgentsSpanModelRequestStartEvent
  | BetaManagedAgentsSpanModelRequestEndEvent
  | BetaManagedAgentsSessionDeletedEvent;

/**
 * Regular text content.
 */
export interface BetaManagedAgentsTextBlock {
  /**
   * The text content.
   */
  text: string;

  type: 'text';
}

/**
 * An unknown or unexpected error occurred during session execution. A fallback
 * variant; clients that don't recognize a new error code can match on
 * `retry_status` and `message` alone.
 */
export interface BetaManagedAgentsUnknownError {
  /**
   * Human-readable error description.
   */
  message: string;

  /**
   * What the client should do next in response to this error.
   */
  retry_status:
    | BetaManagedAgentsRetryStatusRetrying
    | BetaManagedAgentsRetryStatusExhausted
    | BetaManagedAgentsRetryStatusTerminal;

  type: 'unknown_error';
}

/**
 * Document referenced by URL.
 */
export interface BetaManagedAgentsURLDocumentSource {
  type: 'url';

  /**
   * URL of the document to fetch.
   */
  url: string;
}

/**
 * Image referenced by URL.
 */
export interface BetaManagedAgentsURLImageSource {
  type: 'url';

  /**
   * URL of the image to fetch.
   */
  url: string;
}

/**
 * Event sent by the client providing the result of a custom tool execution.
 */
export interface BetaManagedAgentsUserCustomToolResultEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * The id of the `agent.custom_tool_use` event this result corresponds to, which
   * can be found in the last `session.status_idle`
   * [event's](https://platform.claude.com/docs/en/api/beta/sessions/events/list#beta_managed_agents_session_requires_action.event_ids)
   * `stop_reason.event_ids` field.
   */
  custom_tool_use_id: string;

  type: 'user.custom_tool_result';

  /**
   * The result content returned by the tool.
   */
  content?: Array<BetaManagedAgentsTextBlock | BetaManagedAgentsImageBlock | BetaManagedAgentsDocumentBlock>;

  /**
   * Whether the tool execution resulted in an error.
   */
  is_error?: boolean | null;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at?: string | null;
}

/**
 * Parameters for providing the result of a custom tool execution.
 */
export interface BetaManagedAgentsUserCustomToolResultEventParams {
  /**
   * The id of the `agent.custom_tool_use` event this result corresponds to, which
   * can be found in the last `session.status_idle`
   * [event's](https://platform.claude.com/docs/en/api/beta/sessions/events/list#beta_managed_agents_session_requires_action.event_ids)
   * `stop_reason.event_ids` field.
   */
  custom_tool_use_id: string;

  type: 'user.custom_tool_result';

  /**
   * The result content returned by the tool.
   */
  content?: Array<BetaManagedAgentsTextBlock | BetaManagedAgentsImageBlock | BetaManagedAgentsDocumentBlock>;

  /**
   * Whether the tool execution resulted in an error.
   */
  is_error?: boolean | null;
}

/**
 * An interrupt event that pauses agent execution and returns control to the user.
 */
export interface BetaManagedAgentsUserInterruptEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  type: 'user.interrupt';

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at?: string | null;
}

/**
 * Parameters for sending an interrupt to pause the agent.
 */
export interface BetaManagedAgentsUserInterruptEventParams {
  type: 'user.interrupt';
}

/**
 * A user message event in the session conversation.
 */
export interface BetaManagedAgentsUserMessageEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * Array of content blocks comprising the user message.
   */
  content: Array<BetaManagedAgentsTextBlock | BetaManagedAgentsImageBlock | BetaManagedAgentsDocumentBlock>;

  type: 'user.message';

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at?: string | null;
}

/**
 * Parameters for sending a user message to the session.
 */
export interface BetaManagedAgentsUserMessageEventParams {
  /**
   * Array of content blocks for the user message.
   */
  content: Array<BetaManagedAgentsTextBlock | BetaManagedAgentsImageBlock | BetaManagedAgentsDocumentBlock>;

  type: 'user.message';
}

/**
 * A tool confirmation event that approves or denies a pending tool execution.
 */
export interface BetaManagedAgentsUserToolConfirmationEvent {
  /**
   * Unique identifier for this event.
   */
  id: string;

  /**
   * UserToolConfirmationResult enum
   */
  result: 'allow' | 'deny';

  /**
   * The id of the `agent.tool_use` or `agent.mcp_tool_use` event this result
   * corresponds to, which can be found in the last `session.status_idle`
   * [event's](https://platform.claude.com/docs/en/api/beta/sessions/events/list#beta_managed_agents_session_requires_action.event_ids)
   * `stop_reason.event_ids` field.
   */
  tool_use_id: string;

  type: 'user.tool_confirmation';

  /**
   * Optional message providing context for a 'deny' decision. Only allowed when
   * result is 'deny'.
   */
  deny_message?: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  processed_at?: string | null;
}

/**
 * Parameters for confirming or denying a tool execution request.
 */
export interface BetaManagedAgentsUserToolConfirmationEventParams {
  /**
   * UserToolConfirmationResult enum
   */
  result: 'allow' | 'deny';

  /**
   * The id of the `agent.tool_use` or `agent.mcp_tool_use` event this result
   * corresponds to, which can be found in the last `session.status_idle`
   * [event's](https://platform.claude.com/docs/en/api/beta/sessions/events/list#beta_managed_agents_session_requires_action.event_ids)
   * `stop_reason.event_ids` field.
   */
  tool_use_id: string;

  type: 'user.tool_confirmation';

  /**
   * Optional message providing context for a 'deny' decision. Only allowed when
   * result is 'deny'.
   */
  deny_message?: string | null;
}

export interface EventListParams extends PageCursorParams {
  /**
   * Query param: Sort direction for results, ordered by created_at. Defaults to asc
   * (chronological).
   */
  order?: 'asc' | 'desc';

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface EventSendParams {
  /**
   * Body param: Events to send to the `session`.
   */
  events: Array<BetaManagedAgentsEventParams>;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface EventStreamParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Events {
  export {
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
}
