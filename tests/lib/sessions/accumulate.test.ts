import { accumulateManagedAgentsEvent } from '@anthropic-ai/sdk/lib/sessions/accumulate';
import type { BetaManagedAgentsAgentMessageEvent } from '@anthropic-ai/sdk/resources/beta/sessions/events';
import type {
  BetaManagedAgentsDeltaEvent,
  BetaManagedAgentsStartEvent,
} from '@anthropic-ai/sdk/resources/beta/sessions/sessions';

function start(eventId: string): BetaManagedAgentsStartEvent {
  return { type: 'event_start', event: { id: eventId, type: 'agent.message' } };
}

function seed(eventId: string): BetaManagedAgentsAgentMessageEvent {
  const msg = accumulateManagedAgentsEvent(undefined, start(eventId));
  if (!msg) throw new Error('expected agent.message seed');
  return msg;
}

function fold(
  msg: BetaManagedAgentsAgentMessageEvent,
  ev: BetaManagedAgentsDeltaEvent,
): BetaManagedAgentsAgentMessageEvent {
  const next = accumulateManagedAgentsEvent(msg, ev);
  if (!next) throw new Error('expected snapshot after delta');
  return next;
}

function delta(eventId: string, text: string, index?: number): BetaManagedAgentsDeltaEvent {
  return {
    type: 'event_delta',
    event_id: eventId,
    delta: { type: 'content_delta', ...(index !== undefined && { index }), content: { type: 'text', text } },
  };
}

describe('accumulateManagedAgentsEvent', () => {
  test('event_start returns a fresh empty snapshot from undefined', () => {
    const msg = accumulateManagedAgentsEvent(undefined, start('evt_1'));
    expect(msg).toEqual({ id: 'evt_1', type: 'agent.message', content: [], processed_at: '' });
  });

  test('event_start for a non-agent.message preview returns undefined', () => {
    const ev = {
      type: 'event_start',
      event: { id: 'evt_1', type: 'agent.tool_use' },
    } as unknown as BetaManagedAgentsStartEvent;
    expect(accumulateManagedAgentsEvent(undefined, ev)).toBeUndefined();
  });

  test('new index inserts the fragment as a fresh block', () => {
    const msg = seed('evt_1');
    const next = fold(msg, delta('evt_1', 'Hello', 0));
    expect(next.content).toEqual([{ type: 'text', text: 'Hello' }]);
  });

  test('existing text index appends', () => {
    let msg = seed('evt_1');
    msg = fold(msg, delta('evt_1', 'Hel', 0));
    msg = fold(msg, delta('evt_1', 'lo', 0));
    msg = fold(msg, delta('evt_1', 'World', 1));
    expect(msg.content).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: 'World' },
    ]);
  });

  test('defaults index to 0', () => {
    let msg = seed('evt_1');
    msg = fold(msg, delta('evt_1', 'a'));
    msg = fold(msg, delta('evt_1', 'b'));
    expect(msg.content).toEqual([{ type: 'text', text: 'ab' }]);
  });

  test('throws on an index gap', () => {
    const msg = seed('evt_1');
    expect(() => accumulateManagedAgentsEvent(msg, delta('evt_1', 'x', 2))).toThrow(
      'event_delta index 2 is beyond the end of content (length 0)',
    );
  });

  test('throws on event_delta with no prior snapshot', () => {
    expect(() => accumulateManagedAgentsEvent(undefined, delta('evt_1', 'x', 0))).toThrow(
      'event_delta for evt_1 received before its event_start',
    );
  });

  test('next sequential index inserts', () => {
    let msg = seed('evt_1');
    msg = fold(msg, delta('evt_1', 'a', 0));
    msg = fold(msg, delta('evt_1', 'b', 1));
    expect(msg.content).toEqual([
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
    ]);
  });

  test('returns a new snapshot and does not mutate the input', () => {
    const msg = seed('evt_1');
    const next = fold(msg, delta('evt_1', 'x', 0));
    expect(next).not.toBe(msg);
    expect(next.content).not.toBe(msg.content);
    expect(msg.content).toEqual([]);

    const after = fold(next, delta('evt_1', 'y', 0));
    expect(after.content[0]).not.toBe(next.content[0]);
    expect(next.content).toEqual([{ type: 'text', text: 'x' }]);
  });

  test('does not mutate the wire delta when inserting at a new index', () => {
    const d = delta('evt_1', 'x', 0);
    let msg = seed('evt_1');
    msg = fold(msg, d);
    msg = fold(msg, delta('evt_1', 'y', 0));
    expect(d.delta.content.text).toBe('x');
  });

  test('agent.message replaces the preview with a copy of the final event', () => {
    let msg = seed('evt_1');
    msg = fold(msg, delta('evt_1', 'partial', 0));
    const final: BetaManagedAgentsAgentMessageEvent = {
      id: 'evt_1',
      type: 'agent.message',
      content: [{ type: 'text', text: 'complete' }],
      processed_at: '2024-01-01T00:00:00Z',
    };
    const result = accumulateManagedAgentsEvent(msg, final);
    expect(result).toEqual(final);
    expect(result).not.toBe(final);
    expect(result.content).not.toBe(final.content);
    expect(result.content[0]).not.toBe(final.content[0]);
  });

  test('agent.message accepts undefined snapshot', () => {
    const final: BetaManagedAgentsAgentMessageEvent = {
      id: 'evt_1',
      type: 'agent.message',
      content: [{ type: 'text', text: 'complete' }],
      processed_at: '2024-01-01T00:00:00Z',
    };
    expect(accumulateManagedAgentsEvent(undefined, final)).toEqual(final);
  });

  test('unknown block-type pair is a no-op (forward compat)', () => {
    let msg = seed('evt_1');
    // Existing block of a future, non-text type:
    msg = { ...msg, content: [{ type: 'tool_use', id: 't', name: 'n', input: {} } as never] };
    const next = fold(msg, delta('evt_1', 'ignored', 0));
    expect(next.content[0]).toEqual({ type: 'tool_use', id: 't', name: 'n', input: {} });
  });
});
