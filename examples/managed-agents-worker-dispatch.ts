#!/usr/bin/env -S npm run tsn -T

// Self-hosted runner, "worker-dispatch" flavor: this process was handed ONE
// already-claimed work item by an upstream poller/orchestrator — e.g. an
// `ant worker poll --on-work <this script>` loop, or your own dispatcher that
// spawns a fresh sandbox per work item. It does NOT create an agent or session,
// and it does NOT poll for work: something else did that and claimed the item.
//
// `EnvironmentWorker.handleItem()` with no arguments reads the claimed item's
// identity from the environment variables the upstream poller sets:
//   ANTHROPIC_WORK_ID          - the claimed work item to serve
//   ANTHROPIC_ENVIRONMENT_ID   - the self-hosted environment it belongs to
//   ANTHROPIC_SESSION_ID       - the session to run tools for
//   ANTHROPIC_ENVIRONMENT_KEY  - the environment key (the runner's single credential)
// It then runs the session's tools while heartbeating the work-item lease,
// force-stops the item on exit, and returns — one item, then this process exits.
//
// Also required:
//   ANTHROPIC_API_KEY  - your API key (read by the SDK client)
//
// Security model: the worker executes bash and file operations directly on the
// host. This is the "sandbox process" shape — the upstream orchestrator is
// expected to have spawned it inside a container or other isolation boundary.

import Anthropic from '@anthropic-ai/sdk';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { betaAgentToolset20260401 } from '@anthropic-ai/sdk/tools/agent-toolset/node';

const client = new Anthropic();

// Base directory for the per-session AgentToolContext. An orchestrator typically
// points this at the sandbox's scratch space.
const workdir = process.env['ANTHROPIC_WORKDIR'] ?? '.';

// A custom tool, in the same BetaRunnableTool shape that
// `client.beta.messages.toolRunner` accepts. The worker executes it alongside
// the defaults whenever the model emits a matching `agent.tool_use` event.
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
  // Build the worker with a `tools` factory — the standard agent_toolset_20260401
  // set plus our one custom tool — and nothing else. No `environmentId` /
  // `environmentKey` here: `handleItem()` resolves the work item (and the
  // environment key) from the `ANTHROPIC_*` env vars the upstream poller set.
  const worker = client.beta.environments.work.worker({
    workdir,
    tools: (ctx) => [...betaAgentToolset20260401(ctx), currentTime],
  });

  // Service the single claimed item to completion: set up the workdir + download
  // the session agent's skills, run the local tools against the session's
  // `agent.tool_use` events while heartbeating the lease, then force-stop the
  // work item. Returns when the session is done — then this process exits.
  await worker.handleItem();
  console.log('work item handled');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
