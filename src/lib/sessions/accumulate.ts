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
 *   buffered final event is canonical.
 * - `agent.message` is the buffered final event: a copy of it is returned,
 *   replacing whatever the preview had accumulated.
 * - Every other event type returns `accumulated` unchanged, so new event types
 *   added to the stream union need no change here.
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
      if (fragment.type === 'text' && existing.type === 'text') {
        updated = { ...existing, text: existing.text + fragment.text };
      }

      const content = accumulated.content.slice();
      content[idx] = updated;
      return { ...accumulated, content };
    }

    default:
      // Any other event, including types newer than this SDK, leaves the snapshot unchanged.
      return accumulated;
  }
}
