/**
 * Browser stub for `tools/agent-toolset/node`.
 *
 * The real module implements the `agent_toolset_20260401` tools on top of Node
 * built-ins (`node:child_process`, `node:fs`, …), which browser bundlers cannot
 * resolve. The `browser` field in `package.json` substitutes this stub in
 * browser builds so the SDK bundles cleanly for web targets; Node runtimes and
 * node-target bundles ignore the mapping and load the real implementation.
 *
 * Every value export here throws an {@link AnthropicError} when used — the
 * agent toolset only works in Node.js or a Node-compatible runtime. Type
 * exports are re-exported from the real module (erased at build time), so
 * type-level usage is unaffected.
 */

import { AnthropicError } from '../../core/error';
import type { Anthropic } from '../../client';
import type { BetaRunnableTool } from '../../lib/tools/BetaRunnableTool';
import type { AgentToolContext } from './node';

export type { AgentToolContext } from './node';

function nodeOnly(name: string): never {
  throw new AnthropicError(`${name} requires Node.js or a Node-compatible runtime`);
}

export function setupSkills(_ctx: AgentToolContext): Promise<() => Promise<void>> {
  return nodeOnly('setupSkills');
}

export function resolveSkillVersion(_client: Anthropic, _skillId: string, _version: string): Promise<string> {
  return nodeOnly('resolveSkillVersion');
}

export function extractSkillArchive(_resp: Response, _dest: string): Promise<void> {
  return nodeOnly('extractSkillArchive');
}

export function betaAgentToolset20260401(_ctx: AgentToolContext): BetaRunnableTool[] {
  return nodeOnly('betaAgentToolset20260401');
}

export function resolvePath(_ctx: AgentToolContext, _p: string): Promise<string> {
  return nodeOnly('resolvePath');
}

export class BashSession {
  constructor(_dir: string, _env?: NodeJS.ProcessEnv) {
    nodeOnly('BashSession');
  }

  get closed(): boolean {
    return nodeOnly('BashSession');
  }

  exec(
    _command: string,
    _opts: { timeoutMs?: number; signal?: AbortSignal | null | undefined } = {},
  ): Promise<{ output: string; exitCode: number }> {
    return nodeOnly('BashSession');
  }

  close(): void {
    nodeOnly('BashSession');
  }
}

export function betaBashTool(_ctx: AgentToolContext): BetaRunnableTool {
  return nodeOnly('betaBashTool');
}

export function betaReadTool(_ctx: AgentToolContext): BetaRunnableTool {
  return nodeOnly('betaReadTool');
}

export function betaWriteTool(_ctx: AgentToolContext): BetaRunnableTool {
  return nodeOnly('betaWriteTool');
}

export function betaEditTool(_ctx: AgentToolContext): BetaRunnableTool {
  return nodeOnly('betaEditTool');
}

export function betaGlobTool(_ctx: AgentToolContext): BetaRunnableTool {
  return nodeOnly('betaGlobTool');
}

export function betaGrepTool(_ctx: AgentToolContext): BetaRunnableTool {
  return nodeOnly('betaGrepTool');
}
