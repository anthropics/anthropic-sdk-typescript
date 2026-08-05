// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as EventsAPI from '../events';
import { BetaManagedAgentsSessionEventsPageCursor } from '../events';
import * as SessionsAPI from '../sessions';
import * as ThreadsAPI from './threads';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { Stream } from '../../../../core/streaming';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { path } from '../../../../internal/utils/path';

export class Events extends APIResource {
  /**
   * List Session Thread Events
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsSessionEvent of client.beta.sessions.threads.events.list(
   *   'sthr_011CZkZVWa6oIjw0rgXZpnBt',
   *   { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    threadID: string,
    params: EventListParams,
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsSessionEventsPageCursor, EventsAPI.BetaManagedAgentsSessionEvent> {
    const { session_id, betas, ...query } = params;
    return this._client.getAPIList(
      path`/v1/sessions/${session_id}/threads/${threadID}/events?beta=true`,
      PageCursor<EventsAPI.BetaManagedAgentsSessionEvent>,
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
   * Stream Session Thread Events
   *
   * @example
   * ```ts
   * const betaManagedAgentsStreamSessionThreadEvents =
   *   await client.beta.sessions.threads.events.stream(
   *     'sthr_011CZkZVWa6oIjw0rgXZpnBt',
   *     { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   *   );
   * ```
   */
  stream(
    threadID: string,
    params: EventStreamParams,
    options?: RequestOptions,
  ): APIPromise<Stream<ThreadsAPI.BetaManagedAgentsStreamSessionThreadEvents>> {
    const { session_id, betas, ...query } = params;
    return this._client.get(path`/v1/sessions/${session_id}/threads/${threadID}/stream?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
      stream: true,
    }) as APIPromise<Stream<ThreadsAPI.BetaManagedAgentsStreamSessionThreadEvents>>;
  }
}

export interface EventListParams extends PageCursorParams {
  /**
   * Path param: Path parameter session_id
   */
  session_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface EventStreamParams {
  /**
   * Path param: Path parameter session_id
   */
  session_id: string;

  /**
   * Query param: When set, this connection also receives streaming deltas
   * (`event_start`, `event_delta`) while an event is being produced, before the
   * event itself arrives. Deltas are best-effort; when the final event is produced
   * it carries the complete content. A model request that ends early (an error or
   * interrupt) produces no final event — its terminal `span.model_request_end`
   * closes the preview. Accepts one or more event types to preview and may be
   * repeated: `agent.message` streams `content_delta` fragments; `agent.thinking` is
   * start-only — a signal that the agent has begun extended thinking, concluded by
   * the `agent.thinking` event itself. Only previews of the requested event types
   * are sent.
   */
  event_deltas?: Array<SessionsAPI.BetaManagedAgentsDeltaType>;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Events {
  export { type EventListParams as EventListParams, type EventStreamParams as EventStreamParams };
}

export { type BetaManagedAgentsSessionEventsPageCursor };
