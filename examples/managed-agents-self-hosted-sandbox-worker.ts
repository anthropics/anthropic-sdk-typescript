#!/usr/bin/env -S npm run tsn -T

// Self-contained demo: create an agent and session that target a self-hosted
// environment, then run an `EnvironmentWorker` locally to serve the default
// agent_toolset_20260401 tools plus one custom tool.
//
// Requires:
//   ANTHROPIC_API_KEY          - your API key (read by the SDK client)
//   ANTHROPIC_ENVIRONMENT_ID   - a self-hosted environment to poll
//   ANTHROPIC_ENVIRONMENT_KEY  - the environment key (the runner's single credential)
//
// Security model: the worker executes bash and file operations directly on the
// host. Run inside a container or other isolation boundary you control.

import Anthropic from '@anthropic-ai/sdk';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { betaAgentToolset20260401 } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import type { BetaManagedAgentsSessionEvent } from '@anthropic-ai/sdk/resources/beta/sessions/events';

// Required for sessions to accept a self-hosted environment_id.
const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01';

const client = new Anthropic();

const environmentId = requireEnv('ANTHROPIC_ENVIRONMENT_ID');
const environmentKey = requireEnv('ANTHROPIC_ENVIRONMENT_KEY');
const workdir = process.env['ANTHROPIC_WORKDIR'] ?? '.';

// A custom tool, in the same BetaRunnableTool shape that
// `client.beta.messages.toolRunner` accepts. The worker will execute it
// alongside the defaults whenever the model emits a matching
// `agent.tool_use` event.
const CURRENT_TIME_DESCRIPTION = 'Get the current time in ISO 8601 format.';
const currentTime: BetaRunnableTool<Record<string, never>> = {
  type: 'custom',
  name: 'current_time',
  description: CURRENT_TIME_DESCRIPTION,
  input_schema: { type: 'object', properties: {} },
  parse: (x) => x as Record<string, never>,
  run: async () => new Date().toISOString(),
};

async function main() {
  // 1. Create an agent that exposes both the default toolset and our custom
  //    tool. The custom tool definition here tells the model the tool exists;
  //    the implementation lives in `currentTime` above.
  const agent = await client.beta.agents.create({
    name: 'self-hosted-runner-example',
    model: 'claude-haiku-4-5',
    system: 'You are running in a self-hosted sandbox. Use the available tools to answer.',
    tools: [
      { type: 'agent_toolset_20260401' },
      {
        type: 'custom',
        name: currentTime.name,
        description: CURRENT_TIME_DESCRIPTION,
        input_schema: { type: 'object', properties: {} },
      },
    ],
  });
  console.log('created agent', agent.id);

  // 2. Create a session against the self-hosted environment.
  const session = await client.beta.sessions.create({
    agent: agent.id,
    environment_id: environmentId,
    title: 'self-hosted-runner-example',
    betas: [MANAGED_AGENTS_BETA],
  });
  console.log('created session', session.id);

  try {
    // 3. Send the initial prompt.
    await client.beta.sessions.events.send(session.id, {
      events: [
        {
          type: 'user.message',
          content: [
            {
              type: 'text',
              text: 'What is the current time? Also run `pwd` to show me the working directory.',
            },
          ],
        },
      ],
      betas: [MANAGED_AGENTS_BETA],
    });

    // 4. Run the environment worker. It polls for work, and for each claimed
    //    session sets up the workdir + downloads the agent's skills, then runs
    //    the local tools against the session's `agent.tool_use` events while
    //    heartbeating the work-item lease, force-stopping on exit. `tools` is a
    //    factory so `betaAgentToolset20260401` is bound to each session's
    //    workdir/id. The 60s deadline ends the demo; `run()` returns when it
    //    fires.
    //
    //    If you already hold a single claimed work item, use `handleItem()`
    //    instead of `run()` — it runs the per-item flow once and returns.
    //    Called with no arguments, `handleItem()` reads the work item from the
    //    `ANTHROPIC_WORK_ID` / `ANTHROPIC_ENVIRONMENT_ID` / `ANTHROPIC_SESSION_ID` /
    //    `ANTHROPIC_ENVIRONMENT_KEY` environment variables, so `environmentId` /
    //    `environmentKey` aren't needed:
    //      await client.beta.environments.work.worker({ workdir, tools }).handleItem();
    await client.beta.environments.work
      .worker({
        environmentId,
        environmentKey,
        workdir,
        tools: (ctx) => [...betaAgentToolset20260401(ctx), currentTime],
      })
      .run(AbortSignal.timeout(60_000));

    // 5. Print the resulting transcript.
    console.log('\n--- transcript ---');
    for await (const ev of client.beta.sessions.events.list(session.id, { betas: [MANAGED_AGENTS_BETA] })) {
      console.log(summarise(ev));
    }
  } finally {
    // 6. Clean up.
    await client.beta.sessions.delete(session.id, { betas: [MANAGED_AGENTS_BETA] }).catch(() => {});
    await client.beta.agents.archive(agent.id).catch(() => {});
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function summarise(ev: BetaManagedAgentsSessionEvent): string {
  switch (ev.type) {
    case 'user.message':
    case 'agent.message':
      return `${ev.type}: ${truncate(ev.content.map((b) => (b.type === 'text' ? b.text : '')).join(''))}`;
    case 'agent.tool_use':
      return `${ev.type}: ${ev.name} ${truncate(JSON.stringify(ev.input))}`;
    case 'user.tool_result': {
      const text = ev.content?.map((b) => (b.type === 'text' ? b.text : '')).join('') ?? '';
      return `${ev.type}: ${truncate(text)}${ev.is_error ? ' [error]' : ''}`;
    }
    default:
      return ev.type;
  }
}

function truncate(s: string, n = 120): string {
  return s.length <= n ? s : s.slice(0, n) + '…';
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
