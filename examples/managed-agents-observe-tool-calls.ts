#!/usr/bin/env -S npm run tsn -T

// Self-hosted runner, "observe every tool call" flavor: the low-level
// `client.beta.sessions.events.toolRunner(...)` path. It is an async iterable
// that dispatches a session's `agent.tool_use` / `agent.custom_tool_use` events
// to your local tools, posts each result back, and yields one
// `DispatchedToolCall` per completed call — so you can watch every dispatch
// (name, input, error flag, whether the result posted). Unlike
// `EnvironmentWorker`, it does NOT poll for work and does NOT manage a
// work-item lease.
//
// Two scenarios, two functions in this file:
//
//   main() — PRIMARY. A session you created and drive yourself: no work queue,
//     no lease. `toolRunner` just dispatches tools against the session's
//     events, so it works the same whether or not the session's environment is
//     self-hosted. Reach for this when you want per-call visibility on a
//     session you own.
//
//   observeAsSelfHostedWorker() — SECONDARY (not called by default). If you ARE
//     a self-hosted worker but want per-call visibility, you have to compose the
//     pieces `EnvironmentWorker` would otherwise compose for you: the work
//     poller, the per-session agent tool context, AND your own lease heartbeat
//     running in parallel with the `toolRunner` loop. Reach for
//     `EnvironmentWorker` instead unless you specifically need to see each call.
//
// Requires:
//   ANTHROPIC_API_KEY          - your API key (read by the SDK client)
//   ANTHROPIC_ENVIRONMENT_ID   - the environment the session runs in
//   ANTHROPIC_ENVIRONMENT_KEY  - the environment key, the runner's single
//                                credential (only the secondary scenario needs it)
//
// Security model: the tools execute bash and file operations directly on the
// host. Run inside a container or other isolation boundary you control.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { DispatchedToolCall } from '@anthropic-ai/sdk/helpers/beta/environments';
import {
  betaAgentToolset20260401,
  setupSkills,
  type AgentToolContext,
} from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { z } from 'zod/v4';

// Required for sessions to accept a self-hosted environment_id.
const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01';

const client = new Anthropic();

const environmentId = requireEnv('ANTHROPIC_ENVIRONMENT_ID');
const workdir = process.env['ANTHROPIC_WORKDIR'] ?? '.';

// A custom tool built with the `betaZodTool` helper — the same
// `BetaRunnableTool` shape `client.beta.messages.toolRunner` accepts, with the
// input schema derived from the Zod schema and `run`'s args validated against
// it. `toolRunner` dispatches it alongside the defaults whenever the model
// emits a matching `agent.tool_use` event.
const CURRENT_TIME_DESCRIPTION = 'Get the current time in ISO 8601 format.';
const currentTime = betaZodTool({
  name: 'current_time',
  description: CURRENT_TIME_DESCRIPTION,
  inputSchema: z.object({}),
  run: async () => new Date().toISOString(),
});

// ===== PRIMARY: observe a session you created and drive yourself =====

async function main() {
  // 1. Create an agent that exposes both the default toolset and our custom
  //    tool, then a session and the initial prompt.
  const agent = await client.beta.agents.create({
    name: 'observe-tool-calls-example',
    model: 'claude-haiku-4-5',
    system: 'You are running in a sandbox. Use the available tools to answer.',
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

  const session = await client.beta.sessions.create({
    agent: agent.id,
    environment_id: environmentId,
    title: 'observe-tool-calls-example',
    betas: [MANAGED_AGENTS_BETA],
  });
  console.log('created session', session.id);

  // 2. Build the per-session agent tool context: the workdir the file tools
  //    confine to, plus the session id `setupSkills` uses to download the
  //    agent's skills into `{workdir}/skills/`. `cleanupSkills` removes them.
  const ctx: AgentToolContext = { workdir, client, sessionId: session.id };
  const cleanupSkills = await setupSkills(ctx);

  try {
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

    // 3. Iterate `toolRunner`: it attaches to the session, runs each tool call
    //    locally, posts the result back, and yields one `DispatchedToolCall` per
    //    completed call. `tools` is the standard set bound to `ctx` plus our
    //    custom tool. The runner stops on its own once the session goes idle
    //    (`maxIdleMs` after an `end_turn`); the timeout signal is just a hard
    //    cap for the demo. `toolRunner` does NOT touch any work-item lease.
    console.log('\n--- tool calls ---');
    for await (const call of client.beta.sessions.events.toolRunner(session.id, {
      tools: [...betaAgentToolset20260401(ctx), currentTime],
      maxIdleMs: 10_000,
      signal: AbortSignal.timeout(120_000),
    })) {
      printCall(call);
    }
  } finally {
    // 4. Clean up the downloaded skills, the session, and the agent.
    await cleanupSkills().catch(() => {});
    await client.beta.sessions.delete(session.id, { betas: [MANAGED_AGENTS_BETA] }).catch(() => {});
    await client.beta.agents.archive(agent.id).catch(() => {});
  }
}

// ===== SECONDARY: observe each call while ALSO being a self-hosted worker =====

// NOT called by `main()`. This is the shape you reach for only if you are a
// self-hosted worker AND you want per-call visibility.
//
// IMPORTANT: `toolRunner` does NOT manage the work-item lease — `EnvironmentWorker`
// is what normally does. `EnvironmentWorker` polls for work, runs the equivalent
// of the `toolRunner` loop, AND heartbeats the lease (force-stopping on exit),
// all composed together. Drop down to `toolRunner` for per-call visibility and
// you give up that lease management — so you have to roll it back yourself: the
// heartbeat task below runs in parallel with the `toolRunner` loop for exactly
// that reason. It is a SIMPLIFIED shape (fixed interval, minimal error
// handling); `EnvironmentWorker`'s internal heartbeat loop is the careful
// reference — it adapts the interval to the server's `ttl_seconds` and tolerates
// transient failures with backoff. Rolling your own heartbeat is the cost of
// getting per-call visibility AND lease management together.
async function observeAsSelfHostedWorker(): Promise<void> {
  const environmentKey = requireEnv('ANTHROPIC_ENVIRONMENT_KEY');

  // Every per-session call (the `toolRunner` event stream, the lease heartbeat,
  // the force-stop) authenticates with the environment key. `apiKey: null`
  // clears the parent client's `X-Api-Key` — without it, both `X-Api-Key`
  // AND `Authorization: Bearer …` would land on the wire and the server
  // rejects the dual auth on the events stream with 401.
  const sessionClient = client.withOptions({
    apiKey: null,
    authToken: environmentKey,
    credentials: undefined,
  });

  // The work poller claims items and yields them; it ack's each one and posts
  // `work.stop` after the loop body returns.
  for await (const work of client.beta.environments.work.poller({ environmentId, environmentKey })) {
    const sessionId = work.data.id;
    console.log('claimed work', work.id, 'for session', sessionId);

    // Per-session agent tool context + skills, same as the primary scenario.
    const ctx: AgentToolContext = { workdir, client, sessionId };
    const cleanupSkills = await setupSkills(ctx);

    // A controller shared by the heartbeat task and the `toolRunner` loop:
    // whichever finishes first aborts the other.
    const ctrl = new AbortController();
    const heartbeatTask = heartbeatLease(sessionClient, work, ctrl.signal).finally(() => ctrl.abort());

    try {
      for await (const call of sessionClient.beta.sessions.events.toolRunner(sessionId, {
        tools: [...betaAgentToolset20260401(ctx), currentTime],
        signal: ctrl.signal,
      })) {
        printCall(call);
      }
    } finally {
      ctrl.abort();
      await heartbeatTask;
      await cleanupSkills().catch(() => {});
      // Force-stop the work item — `toolRunner` will not do it for you.
      await sessionClient.beta.environments.work
        .stop(work.id, { environment_id: work.environment_id, force: true })
        .catch(() => {});
    }
  }
}

/**
 * A SIMPLIFIED lease heartbeat — see the comment block on
 * {@link observeAsSelfHostedWorker}. Beats on a fixed 30s interval; the first
 * beat uses the `NO_HEARTBEAT` sentinel, each later one echoes the server's
 * previous `last_heartbeat`. Returns (letting the shared controller abort the
 * `toolRunner` loop) as soon as the control plane reports the work is
 * stopping/stopped or the lease was not extended.
 */
async function heartbeatLease(
  client: Anthropic,
  work: { id: string; environment_id: string },
  signal: AbortSignal,
): Promise<void> {
  let expectedLastHeartbeat = 'NO_HEARTBEAT';
  while (!signal.aborted) {
    const resp = await client.beta.environments.work.heartbeat(work.id, {
      environment_id: work.environment_id,
      expected_last_heartbeat: expectedLastHeartbeat,
    });
    expectedLastHeartbeat = resp.last_heartbeat;
    if (resp.state === 'stopping' || resp.state === 'stopped' || !resp.lease_extended) return;
    await delay(30_000, signal);
  }
}

/** Print one observed tool call: name, input, error flag, and whether the result posted. */
function printCall(call: DispatchedToolCall): void {
  const input = truncate(JSON.stringify(call.event.input));
  const status = call.isError ? 'error' : 'ok';
  // A skipped unowned tool call has no result event and was deliberately
  // left pending for its owner (the other client servicing this split
  // session) — that is not a failed post.
  const note =
    call.posted ? ''
    : call.result === undefined ? ' [skipped — not owned by this runner]'
    : ' [result post failed]';
  console.log(`tool ${call.name}(${input}) -> ${status}${note}`);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

/** Resolve after `ms`, or early when `signal` aborts. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => resolve(), ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function truncate(s: string, n = 120): string {
  return s.length <= n ? s : s.slice(0, n) + '…';
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
