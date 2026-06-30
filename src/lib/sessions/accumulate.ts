import { AnthropicError } from '../../core/error';
import type {
  BetaManagedAgentsAgentMessageEvent,
  BetaManagedAgentsStreamSessionEvents,
} from '../../resources/beta/sessions/events';

export type AccumulatedEvent = BetaManagedAgentsAgentMessageEvent;

/**
 * Fold one preview event into an `agent.message` snapshot. Returns a fresh
 * snapshot — the `msg` argument is never mutated.
 *
 * - `event_start` opens the preview: a new snapshot with empty content is
 *   returned (so `msg` may be `undefined`). Returns `undefined` when the
 *   previewed event is not an `agent.message` — this helper only tracks
 *   `agent.message` previews.
 * - `event_delta` is folded into `msg`: a new `delta.index` inserts the
 *   fragment as a fresh content entry; an existing index returns a copy with
 *   that entry appended to. An unrecognised fragment type on an existing
 *   index passes the entry through unchanged — deltas are best-effort and the
 *   buffered final event is canonical — but is a compile-time error via the
 *   exhaustiveness guard, matching `MessageStream#accumulateMessage`.
 * - `agent.message` is the buffered final event: a copy of it is returned,
 *   replacing whatever the preview had accumulated.
 */
export function accumulateManagedAgentsEvent<T extends AccumulatedEvent>(
  accumulated: AccumulatedEvent | undefined,
  event: T,
): T;
export function accumulateManagedAgentsEvent(
  accumulated: AccumulatedEvent | undefined,
  event: BetaManagedAgentsStreamSessionEvents,
): AccumulatedEvent | undefined;
export function accumulateManagedAgentsEvent(
  accumulated: AccumulatedEvent | undefined,
  event: BetaManagedAgentsStreamSessionEvents,
): AccumulatedEvent | undefined {
  switch (event.type) {
    case 'event_start': {
      if (event.event.type === 'agent.message') {
        return { id: event.event.id, type: 'agent.message', content: [], processed_at: '' };
      }

      return accumulated;
    }

    case 'agent.message': {
      return { ...event, content: event.content.map((block) => ({ ...block })) };
    }

    case 'event_delta': {
      if (accumulated === undefined) {
        throw new AnthropicError(`event_delta for ${event.event_id} received before its event_start`);
      }

      const idx = event.delta.index ?? 0;
      const fragment = event.delta.content;

      // Indices arrive in order — the first delta at a new index opens the slot.
      // A gap means deltas arrived out of order or were mis-routed.
      if (idx > accumulated.content.length) {
        throw new AnthropicError(
          `event_delta index ${idx} is beyond the end of content (length ${accumulated.content.length})`,
        );
      }

      const existing = accumulated.content[idx];
      if (existing === undefined) {
        // New index: pass the fragment through as a fresh block.
        return { ...accumulated, content: [...accumulated.content, { ...fragment }] };
      }

      let updated = existing;
      switch (fragment.type) {
        case 'text':
          if (existing.type === 'text') {
            updated = { ...existing, text: existing.text + fragment.text };
          }
          break;
        default:
          checkNever(fragment.type);
      }

      const content = accumulated.content.slice();
      content[idx] = updated;
      return { ...accumulated, content };
    }
    case 'user.message':
    case 'user.interrupt':
    case 'user.tool_confirmation':
    case 'user.tool_result':
    case 'user.custom_tool_result':
    case 'user.define_outcome':
    case 'agent.thinking':
    case 'agent.tool_use':
    case 'agent.tool_result':
    case 'agent.custom_tool_use':
    case 'agent.mcp_tool_use':
    case 'agent.mcp_tool_result':
    case 'agent.thread_message_received':
    case 'agent.thread_message_sent':
    case 'agent.thread_context_compacted':
    case 'session.error':
    case 'session.updated':
    case 'session.deleted':
    case 'session.status_running':
    case 'session.status_idle':
    case 'session.status_rescheduled':
    case 'session.status_terminated':
    case 'session.thread_created':
    case 'session.thread_status_running':
    case 'session.thread_status_idle':
    case 'session.thread_status_rescheduled':
    case 'session.thread_status_terminated':
    case 'span.model_request_start':
    case 'span.model_request_end':
    case 'span.outcome_evaluation_start':
    case 'span.outcome_evaluation_ongoing':
    case 'span.outcome_evaluation_end':
    case 'system.message':
      return accumulated;
    default:
      checkNever(event);
      return accumulated;
  }
}

// Compile-time exhaustiveness guard.
function checkNever(_x: never): void {}
