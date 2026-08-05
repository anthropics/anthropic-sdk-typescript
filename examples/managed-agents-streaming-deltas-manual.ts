#!/usr/bin/env -S npm run tsn -T

// Same as managed-agents-streaming-deltas.ts but driving
// `accumulateManagedAgentsEvent` directly instead of the `SessionEventStream`
// wrapper — for callers who want to own the preview lifecycle themselves.

import Anthropic from '@anthropic-ai/sdk';
import { accumulateManagedAgentsEvent } from '@anthropic-ai/sdk/lib/sessions/accumulate';
import type { BetaManagedAgentsAgentMessageEvent } from '@anthropic-ai/sdk/resources/beta/sessions/events';

const client = new Anthropic();

async function main() {
  // Create an environment, agent and session.
  const environment = await client.beta.environments.create({
    name: 'streaming-deltas-manual-example',
  });
  console.log('Created environment:', environment.id);

  const agent = await client.beta.agents.create({
    name: 'streaming-deltas-manual-example',
    model: 'claude-sonnet-4-6',
  });
  console.log('Created agent:', agent.id);

  const session = await client.beta.sessions.create({
    environment_id: environment.id,
    agent: { type: 'agent', id: agent.id },
  });
  console.log('Created session:', session.id);

  // Send a user message.
  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text: 'Write a short haiku about the ocean.' }],
      },
    ],
  });

  // Open the event stream with `event_deltas` enabled so `agent.message`
  // text arrives incrementally as `event_start` / `event_delta` previews
  // before the buffered final event.
  const stream = await client.beta.sessions.events.stream(session.id, {
    event_deltas: ['agent.message'],
  });

  // One snapshot per previewed event id.
  const previews = new Map<string, BetaManagedAgentsAgentMessageEvent>();

  console.log('\nStreaming:');
  for await (const ev of stream) {
    const eventId =
      ev.type === 'event_delta' ? ev.event_id
      : 'event' in ev ? ev.event.id
      : 'id' in ev ? ev.id
      : null;

    const prev = eventId ? previews.get(eventId) : undefined;
    const preview = accumulateManagedAgentsEvent(prev, ev);
    if (eventId != null && preview) {
      previews.set(eventId, preview);
    }

    switch (ev.type) {
      case 'event_delta': {
        if (preview && preview.type === 'agent.message') {
          const text = preview.content.map((b) => b.text).join('');
          process.stdout.write(`\r${text}`);
        }
        break;
      }

      case 'agent.message': {
        previews.delete(eventId!);
        process.stdout.write('\n');
        console.log('[final]', ev.content.map((b) => b.text).join(''));
        break;
      }

      case 'span.model_request_end':
        // The model request ended — any open preview will not get a buffered
        // event, so drop it.
        previews.clear();
        break;

      case 'session.status_idle':
        if (ev.stop_reason.type === 'end_turn') {
          stream.controller.abort();
        }
        break;

      case 'session.error':
        console.error('[error]', ev.error.type, ev.error.message);
        break;
    }
  }
}

main();
