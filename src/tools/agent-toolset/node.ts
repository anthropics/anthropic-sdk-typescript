/**
 * Node implementation of the `agent_toolset_20260401` tools — `bash`, `read`,
 * `write`, `edit`, `glob`, `grep` — plus the workdir/skills
 * {@link AgentToolContext}.
 *
 * This mirrors `@anthropic-ai/sdk/tools/memory/node`: it is the explicit,
 * Node-only entry point for these implementations. Importing it pulls in
 * `node:child_process`, `node:fs`, etc., so it is kept separate from the rest of
 * the SDK — depending on it is an opt-in.
 *
 * **Node 22+ is required** for this module: the `glob` tool uses the native
 * `fs.glob`, added in Node 22. The rest of the SDK still supports Node 18+; only
 * the agent toolset has this requirement.
 *
 * The result of {@link betaAgentToolset20260401} is a plain `BetaRunnableTool[]`;
 * hand it to any tool runner — `client.beta.messages.toolRunner({ …, tools })`
 * for the Messages API, or `client.beta.sessions.events.toolRunner({ …, tools })`
 * for a managed-agents session:
 *
 * ```ts
 * import { betaAgentToolset20260401 } from '@anthropic-ai/sdk/tools/agent-toolset/node';
 *
 * const tools = betaAgentToolset20260401({ workdir: '/work' });
 * const tools2 = betaAgentToolset20260401({ workdir: '/work' }).filter((t) => t.name !== 'bash');
 * ```
 *
 * Trust model: the file tools confine to `workdir` plus any `allowedRoots`
 * (symlink-aware) and are safe without a sandbox; `bash` is unrestricted and
 * should run inside one. See {@link AgentToolContext}.
 */

import * as fs from 'node:fs/promises';
import * as fssync from 'node:fs';
import * as path from 'node:path';
import * as cp from 'node:child_process';
import * as crypto from 'node:crypto';
import * as readline from 'node:readline';
import type { Anthropic } from '../../client';
import type { BetaManagedAgentsSession } from '../../resources/beta/sessions/sessions';
import { AnthropicError } from '../../core/error';
import type { BetaRunnableTool } from '../../lib/tools/BetaRunnableTool';
import { ToolError } from '../../lib/tools/ToolError';
import { betaTool } from '../../helpers/beta/json-schema';
import { promiseWithResolvers } from '../../internal/utils/promise';
import {
  atomicWriteFile,
  canonicalize,
  confineToRoot,
  containingRoot,
  DIR_CREATE_MODE,
  fsErrorMessage,
  isWithin,
} from './fs-util';

export { setupSkills, resolveSkillVersion, extractSkillArchive } from './skills';
export {
  SessionMemoryStores,
  SessionMemoryError,
  DEFAULT_MEMORY_SYNC_INTERVAL_MS,
  MIN_MEMORY_SYNC_INTERVAL_MS,
  MEMORY_FLUSH_TIMEOUT_MS,
  MARKER_PATH,
  type MemoryDeleteMode,
  type SessionMemoryStoresOptions,
} from './memories';

const BASH_OUTPUT_LIMIT = 100 * 1024;
const BASH_DEFAULT_TIMEOUT_MS = 120_000;
// Default size cap for the read/edit tools (both load the whole file into
// memory) when AgentToolContext.maxFileBytes is unset. The reject-vs-truncate
// behaviour remains a separate question pending CMA validation.
const DEFAULT_MAX_FILE_BYTES = 256 * 1024;
const GREP_OUTPUT_LIMIT = 100 * 1024;
const GREP_MAX_LINE_LENGTH = 2000;
const GLOB_RESULT_LIMIT = 200;

/**
 * A bash command exceeded its `timeoutMs`. Carries the timeout so a caller can
 * tell it apart from an abort without matching on the message text.
 */
export class BashTimeoutError extends AnthropicError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`bash command timed out after ${timeoutMs}ms`);
    this.name = 'BashTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

// `fs.glob` is Node 22+. `@types/node` may still target an older line, so the
// surface this module uses is typed locally rather than relying on the ambient
// declaration. At runtime this module requires Node 22 (see the file header).
type GlobFn = (
  pattern: string,
  options: {
    cwd?: string;
    withFileTypes?: boolean;
    exclude?: (entry: fssync.Dirent) => boolean;
  },
) => AsyncIterable<fssync.Dirent>;
const fsGlob = (fs as unknown as { glob: GlobFn }).glob;

function resolveMaxBytes(configured: number | null | undefined): number | null {
  return configured === undefined ? DEFAULT_MAX_FILE_BYTES : configured;
}

/**
 * Throw when the deprecated {@link AgentToolContext.unrestrictedPaths} was
 * passed at all. Nothing else reads that property.
 */
function rejectUnrestrictedPaths(value: boolean | undefined): void {
  if (value === undefined) return;
  throw new AnthropicError(
    'The `unrestrictedPaths` option you passed to the agent toolset (AgentToolContext) is no longer ' +
      "supported. The toolset's file tools (read, write, edit, glob, grep) are now always confined to " +
      'the working directory plus the directories listed in `allowedRoots`. Remove `unrestrictedPaths` ' +
      'from your context; to let the file tools reach any other directory, add it to `allowedRoots`.',
  );
}

/**
 * Workdir + path-policy for the agent toolset.
 *
 * Trust model — two tiers:
 *
 * - The file tools ({@link betaReadTool}, {@link betaWriteTool},
 *   {@link betaEditTool}, {@link betaGlobTool}, {@link betaGrepTool}) confine to
 *   `workdir` plus any `allowedRoots`. {@link resolvePath} canonicalizes the
 *   target (resolving every symlink, including the leaf) before the check
 *   *and* returns that canonical path for the operation, so a symlink inside
 *   the workdir that points outside it neither passes the check nor gets
 *   followed afterwards — this is a real boundary, not a lexical hint (modulo
 *   the residual TOCTOU noted on {@link resolvePath}).
 * - {@link betaBashTool} runs an unrestricted `/bin/bash` and cannot be
 *   confined. Run it — and, for defense in depth, the whole toolset — inside a
 *   sandbox the host controls (e.g. a self-hosted environment runner).
 */
export interface AgentToolContext {
  /** Base directory for resolving relative tool paths. */
  workdir: string;
  /**
   * @deprecated No longer accepted: the file tools are always confined to
   * `workdir` plus `allowedRoots`, which is neither behavior this flag used to
   * select, so passing either value throws. Remove it; list extra directories
   * in {@link AgentToolContext.allowedRoots}. The property is removed in a
   * future release.
   */
  unrestrictedPaths?: boolean;
  /**
   * Absolute directories outside `workdir` the file tools may also reach,
   * resolved at check time. The environment worker sets this to the session's
   * memory-store folders. Does **not** constrain {@link betaBashTool}.
   */
  allowedRoots?: string[];
  /**
   * Anthropic client. Optional — the bare toolset needs no client; it is only
   * used by `setupSkills`, which (together with {@link AgentToolContext.session},
   * or the deprecated {@link AgentToolContext.sessionId}) downloads each of the
   * session agent's skills into `{workdir}/skills/<name>/`.
   */
  client?: Anthropic;
  /**
   * The already-fetched session whose agent's skills `setupSkills` downloads.
   * A session's resources cannot change while it runs, so the caller fetches it
   * once and shares that snapshot with the memory-store download; the two can
   * then never disagree about them.
   */
  session?: BetaManagedAgentsSession;
  /**
   * @deprecated `setupSkills` fetches the session itself when given only an id,
   * one extra round trip per context. Prefer {@link AgentToolContext.session}.
   * Kept for callers written before `session` existed; ignored when `session`
   * is set.
   */
  sessionId?: string;
  /**
   * Directories the write and edit tools refuse to modify, resolved at check
   * time exactly like `allowedRoots`. The worker sets this to the roots of
   * read-only memory stores so the agent sees the error at write time instead
   * of the change silently never syncing; the mechanism is generic to any
   * directory.
   */
  readOnlyRoots?: string[];
  /**
   * Optional environment for the bash subprocess. When unset, the bash tool
   * inherits the process environment with the runner's `ANTHROPIC_*`
   * credentials scrubbed. When provided, it FULLY REPLACES that default
   * environment — the mapping is used verbatim and is NOT merged with or added
   * to the scrubbed process environment. To keep the defaults plus extra vars,
   * build the combined mapping yourself before passing it.
   */
  env?: Record<string, string | undefined>;
  /**
   * Size cap for the `read` and `edit` tools, which both load the whole file into
   * memory. `undefined` (default) uses the built-in 256 KiB cap; a positive number
   * sets a custom cap; `null` disables the cap entirely. Disabling it reintroduces
   * the OOM risk on a model-controlled path, so pass `null` only when the sandbox
   * can absorb arbitrarily large files. The non-regular-file (FIFO/device) guard
   * always applies regardless of this value.
   */
  maxFileBytes?: number | null;
}

/**
 * Returns the `agent_toolset_20260401` implementations bound to `ctx`. The
 * result is a plain array of `BetaRunnableTool`; filter or extend it before
 * handing it to a tool runner:
 *
 * ```ts
 * const tools = [...betaAgentToolset20260401(ctx), myCustomTool];
 * const tools = betaAgentToolset20260401(ctx).filter((t) => t.name !== 'grep');
 * ```
 *
 * Concurrency note: `client.beta.sessions.events.toolRunner` dispatches a
 * session's tool calls serially (the sessions API delivers one `agent.tool_use`
 * at a time). `client.beta.messages.toolRunner` runs a turn's `tool.run` calls
 * via `Promise.all`. The toolset below is safe under either model —
 * {@link betaBashTool} serializes its persistent shell internally and the FS
 * tools are independent per call — but {@link betaEditTool}/{@link betaWriteTool}
 * cannot synchronize concurrent writes to the *same* file across processes, so a
 * multi-edit turn touching one path is still subject to inherent FS lost-update
 * races. Custom tools that close over mutable state should do their own queueing.
 */
export function betaAgentToolset20260401(ctx: AgentToolContext): BetaRunnableTool[] {
  return [
    betaBashTool(ctx),
    betaReadTool(ctx),
    betaWriteTool(ctx),
    betaEditTool(ctx),
    betaGlobTool(ctx),
    betaGrepTool(ctx),
  ];
}

/**
 * Resolve `p` against `ctx.workdir`; reject results outside `ctx.workdir` and
 * `ctx.allowedRoots`. Absolute and relative inputs go through the same
 * canonicalise-then-contain check — an absolute path that lands inside a
 * permitted root is accepted, only paths that resolve *outside* all of them
 * are rejected. Every symlink in `p` (including the leaf, even a dangling one)
 * is resolved before the check, and the resolved path is what the tool then
 * operates on, so a symlink inside the workdir that points outside it can
 * neither pass the check nor be followed afterwards. See the trust model on
 * {@link AgentToolContext}.
 *
 * Residual TOCTOU: a component could still be swapped for a symlink between this
 * call and the eventual `fs` operation. Closing that fully needs per-component
 * `O_NOFOLLOW`/`openat`, which Node does not expose ergonomically; the same
 * residual exposure exists in `tools/memory/node` and is why a sandbox is still
 * recommended for the toolset as a whole.
 */
export async function resolvePath(ctx: AgentToolContext, p: string): Promise<string> {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return confineToRoot(ctx.workdir, p, { allowedRoots: ctx.allowedRoots ?? [] });
}

/**
 * The read-only root `target` falls under, or `undefined`. `target` arrives
 * fully canonicalized (from {@link resolvePath}), so each root is
 * canonicalized too — a root recorded through a symlinked workdir must still
 * match the resolved write target.
 */
function readOnlyRootFor(ctx: AgentToolContext, target: string): Promise<string | undefined> {
  return containingRoot(ctx.readOnlyRoots ?? [], target);
}

// ---- bash ----------------------------------------------------------------

/**
 * Build the environment for the spawned bash shell. The runner process holds
 * Anthropic credentials in `ANTHROPIC_*` env vars — the API key, the auth token,
 * and the per-work session token among them. `bash` runs an unrestricted shell,
 * so any command the agent runs could read those straight out of `process.env`;
 * strip the whole `ANTHROPIC_*` namespace from the child's environment.
 * Everything else (PATH, HOME, locale, …) is passed through unchanged.
 *
 * Passing an explicit `env` to {@link AgentToolContext} does NOT add to this
 * default — it FULLY REPLACES it. The provided mapping becomes the entire bash
 * environment verbatim; nothing here is merged in, so callers who want the
 * scrubbed process environment plus extras must build that mapping themselves.
 */
function scrubbedShellEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('ANTHROPIC_')) continue;
    env[key] = value;
  }
  return env;
}

/**
 * A persistent /bin/bash process. State (cwd, env, background jobs) survives
 * across exec() calls. Uses pipes rather than a PTY so input is never echoed.
 */
export class BashSession {
  #proc: cp.ChildProcessWithoutNullStreams;
  #buf = '';
  #truncated = false;
  #closed = false;
  // While a command is in flight, the resolver to fire once its sentinel lands
  // in `#buf` (or once the shell dies). Event-driven: no polling loop.
  #waiting: { sentinel: string; resolve: () => void } | null = null;

  constructor(dir: string, env: Record<string, string | undefined> = scrubbedShellEnv()) {
    this.#proc = cp.spawn('/bin/bash', ['--noprofile', '--norc'], {
      cwd: dir,
      // `env` is the full base environment (the scrubbed process env by
      // default, or the verbatim replacement from `AgentToolContext.env`).
      // PS1/PS2/TERM are shell-control settings BashSession always applies so
      // the pipe-based sentinel exec parsing works — not part of the
      // user-facing environment.
      env: { ...env, PS1: '', PS2: '', TERM: 'dumb' },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });
    this.#proc.stdout.setEncoding('utf8');
    this.#proc.stderr.setEncoding('utf8');
    this.#proc.stdout.on('data', (d: string) => this.#append(d));
    this.#proc.stderr.on('data', (d: string) => this.#append(d));
    this.#proc.once('close', () => {
      this.#closed = true;
      // Wake any in-flight exec so it fails fast instead of waiting for its deadline.
      const w = this.#waiting;
      this.#waiting = null;
      w?.resolve();
    });
  }

  /** Whether the underlying shell process has exited. */
  get closed(): boolean {
    return this.#closed;
  }

  // Cap the buffer during accumulation so a command that streams unboundedly
  // can't OOM the runner. Keeps the tail so the sentinel stays detectable.
  // Also resolves the in-flight exec the instant its sentinel is buffered.
  #append(d: string): void {
    this.#buf += d;
    if (this.#buf.length > BASH_OUTPUT_LIMIT) {
      this.#buf = this.#buf.slice(this.#buf.length - BASH_OUTPUT_LIMIT);
      this.#truncated = true;
    }
    if (this.#waiting && this.#buf.indexOf(this.#waiting.sentinel) >= 0) {
      const w = this.#waiting;
      this.#waiting = null;
      w.resolve();
    }
  }

  async exec(
    command: string,
    opts: { timeoutMs?: number; signal?: AbortSignal | null | undefined } = {},
  ): Promise<{ output: string; exitCode: number }> {
    if (this.#closed) {
      throw new AnthropicError('bash session terminated');
    }
    const timeoutMs = opts.timeoutMs ?? BASH_DEFAULT_TIMEOUT_MS;
    const signal = opts.signal;
    // Reject with the signal's own reason, so a caller telling a user cancel
    // apart from an `AbortSignal.timeout()` sees the platform's name intact.
    signal?.throwIfAborted();
    this.#buf = '';
    this.#truncated = false;
    // Per-call nonce so a command that prints a fixed marker can't spoof the
    // exit-code framing. The `''` split keeps the literal out of what we write
    // to stdin — only the shell's printf reassembles it.
    const sentinel = `__ANT_CMD_${crypto.randomUUID()}_DONE__`;
    const sentinelSplit = `${sentinel.slice(0, 8)}''${sentinel.slice(8)}`;
    // </dev/null: a stdin-reading command (`cat`, `read`) gets EOF instead of
    // blocking on the shared pipe until the timeout.
    const wrapped = `{ ${command}\n} </dev/null 2>&1; printf '\\n${sentinelSplit}%d\\n' $?\n`;
    this.#proc.stdin.write(wrapped);

    if (this.#buf.indexOf(sentinel) < 0) {
      // Park until the sentinel lands, the deadline passes, the caller aborts,
      // or the shell dies — whichever comes first. `#append` (and the `close`
      // handler) resolve `sentinelSeen`; the deadline / abort reject.
      const { promise: sentinelSeen, resolve } = promiseWithResolvers<void>();
      this.#waiting = { sentinel, resolve };
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      try {
        await Promise.race([
          sentinelSeen,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new BashTimeoutError(timeoutMs)), timeoutMs);
          }),
          new Promise<never>((_, reject) => {
            if (!signal) return;
            onAbort = () => reject(signal.reason);
            signal.addEventListener('abort', onAbort, { once: true });
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
        if (onAbort && signal) signal.removeEventListener('abort', onAbort);
        this.#waiting = null;
      }
    }

    const idx = this.#buf.indexOf(sentinel);
    if (idx < 0) {
      // The shell closed (or was killed) before emitting the sentinel.
      throw new AnthropicError('bash session terminated');
    }
    const tail = this.#buf.slice(idx + sentinel.length);
    const m = tail.match(/^(-?\d+)/);
    const exitCode = m ? parseInt(m[1]!, 10) : -1;
    let out = this.#buf.slice(0, idx).replace(ANSI_RE, '').replace(/\n+$/, '');
    if (this.#truncated) {
      out = `[output truncated]\n${out}`;
    }
    return { output: out, exitCode };
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    const w = this.#waiting;
    this.#waiting = null;
    w?.resolve();
    this.#proc.stdout.destroy();
    this.#proc.stderr.destroy();
    this.#proc.stdin.destroy();
    try {
      // Negative PID targets the process group so foreground jobs (e.g. a
      // hung sleep) die with the shell.
      process.kill(-this.#proc.pid!, 'SIGKILL');
    } catch {
      this.#proc.kill('SIGKILL');
    }
    this.#proc.unref();
  }
}

export function betaBashTool(ctx: AgentToolContext): BetaRunnableTool {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  let session: BashSession | undefined;
  // Concurrent run() callers chain onto this promise so writes to the shared
  // shell's stdin can't interleave (which would corrupt the sentinel-match
  // exit-code parsing in BashSession.exec). Each call replaces `tail` with a
  // promise that resolves only after its own exec settles.
  let tail: Promise<unknown> = Promise.resolve();
  return betaTool({
    name: 'bash',
    description: 'Run a bash command in a persistent shell. State (cwd, env vars) persists across calls.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to run' },
        restart: { type: 'boolean', description: 'Restart the persistent shell before running' },
        timeout_ms: { type: 'integer', description: 'Per-call timeout in milliseconds' },
      },
    },
    run: async ({ command, restart, timeout_ms }, context) => {
      const prev = tail;
      const gate = promiseWithResolvers<void>();
      tail = gate.promise;
      // Swallow prior rejections — earlier callers got their own error path;
      // we just need to wait for the shell to be free.
      try {
        await prev;
      } catch {
        // ignore
      }
      try {
        if (restart) {
          session?.close();
          session = undefined;
        }
        if (!command) {
          if (restart) return 'bash session restarted';
          throw new ToolError('bash: command is required');
        }
        session ??= new BashSession(ctx.workdir, ctx.env);
        try {
          const { output, exitCode } = await session.exec(command, {
            timeoutMs: timeout_ms ?? BASH_DEFAULT_TIMEOUT_MS,
            signal: context?.signal,
          });
          if (exitCode !== 0) throw new ToolError(output || `exit ${exitCode}`);
          return output;
        } catch (e) {
          if (e instanceof ToolError) throw e;
          // Timeout, abort, or terminated: the still-running command will emit
          // a stale sentinel, so discard this session and let the next call
          // start fresh.
          session.close();
          session = undefined;
          throw new ToolError(`bash: ${e instanceof Error ? e.message : String(e)}`);
        }
      } finally {
        gate.resolve();
      }
    },
    close: () => {
      session?.close();
      session = undefined;
    },
  });
}

// ---- fs ------------------------------------------------------------------

export function betaReadTool(ctx: AgentToolContext): BetaRunnableTool {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return betaTool({
    name: 'read',
    description: 'Read a UTF-8 text file relative to the workdir.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string' },
        view_range: {
          type: 'array',
          items: { type: 'integer' },
          description: '[start_line, end_line] 1-indexed inclusive',
        },
      },
      required: ['file_path'],
    },
    run: async ({ file_path, view_range }) => {
      if (!file_path) throw new ToolError('read: file_path is required');
      const abs = await resolvePath(ctx, file_path);
      let data: string;
      try {
        // stat() before any open(): the size cap stops a multi-GB file from
        // OOM'ing the runner, and isFile() rejects FIFOs/devices/dirs without
        // opening them (open() on an unconnected FIFO blocks indefinitely).
        const st = await fs.stat(abs);
        if (!st.isFile()) {
          throw new ToolError(`read: ${file_path} is not a regular file`);
        }
        const limit = resolveMaxBytes(ctx.maxFileBytes);
        if (limit !== null && st.size > limit) {
          throw new ToolError(
            `read: ${file_path} is ${st.size} bytes, exceeds ${limit}-byte limit. ` +
              'Use bash (head/tail/sed) to read a slice.',
          );
        }
        data = await fs.readFile(abs, 'utf8');
      } catch (e) {
        if (e instanceof ToolError) throw e;
        throw new ToolError(`read: ${fsErrorMessage(e, file_path)}`);
      }
      if (!view_range?.length) return data;
      if (view_range.length !== 2) throw new ToolError('read: view_range must be [start_line, end_line]');
      const [startLine, endLine] = view_range as [number, number];
      const lines = data.split('\n');
      const start = Math.max(0, startLine - 1);
      const end = endLine > 0 ? endLine : lines.length;
      return lines.slice(start, end).join('\n');
    },
  });
}

export function betaWriteTool(ctx: AgentToolContext): BetaRunnableTool {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return betaTool({
    name: 'write',
    description: 'Write a UTF-8 text file relative to the workdir, creating parent directories as needed.',
    inputSchema: {
      type: 'object',
      properties: { file_path: { type: 'string' }, content: { type: 'string' } },
      required: ['file_path', 'content'],
    },
    run: async ({ file_path, content }) => {
      if (!file_path) throw new ToolError('write: file_path is required');
      const abs = await resolvePath(ctx, file_path);
      const ro = await readOnlyRootFor(ctx, abs);
      if (ro !== undefined) {
        throw new ToolError(`write: ${file_path} is inside read-only directory ${ro}`);
      }
      try {
        await fs.mkdir(path.dirname(abs), { recursive: true, mode: DIR_CREATE_MODE });
        await atomicWriteFile(abs, content ?? '');
      } catch (e) {
        throw new ToolError(`write: ${fsErrorMessage(e, file_path)}`);
      }
      return `wrote ${Buffer.byteLength(content ?? '')} bytes to ${file_path}`;
    },
  });
}

export function betaEditTool(ctx: AgentToolContext): BetaRunnableTool {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return betaTool({
    name: 'edit',
    description:
      'Replace old_string with new_string in a file. old_string must be unique unless replace_all.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string' },
        old_string: { type: 'string' },
        new_string: { type: 'string' },
        replace_all: { type: 'boolean' },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
    run: async ({ file_path, old_string, new_string, replace_all }) => {
      if (!file_path) throw new ToolError('edit: file_path is required');
      if (!old_string) throw new ToolError('edit: old_string is required');
      const abs = await resolvePath(ctx, file_path);
      const ro = await readOnlyRootFor(ctx, abs);
      if (ro !== undefined) {
        throw new ToolError(`edit: ${file_path} is inside read-only directory ${ro}`);
      }
      let data: string;
      try {
        // stat() before any open() — same guard as `read`: the size cap stops a
        // multi-GB file from OOM'ing the runner, and isFile() rejects
        // FIFOs/devices/dirs without opening them (open() on an unconnected FIFO
        // blocks indefinitely). The edit path is model-controlled, so it needs
        // the same bound `read` already has.
        const st = await fs.stat(abs);
        if (!st.isFile()) {
          throw new ToolError(`edit: ${file_path} is not a regular file`);
        }
        const limit = resolveMaxBytes(ctx.maxFileBytes);
        if (limit !== null && st.size > limit) {
          throw new ToolError(
            `edit: ${file_path} is ${st.size} bytes, exceeds ${limit}-byte limit. ` +
              'Use bash (sed/awk) to edit a large file.',
          );
        }
        data = await fs.readFile(abs, 'utf8');
      } catch (e) {
        if (e instanceof ToolError) throw e;
        throw new ToolError(`edit: ${fsErrorMessage(e, file_path)}`);
      }
      const count = data.split(old_string).length - 1;
      if (count === 0) throw new ToolError(`edit: old_string not found in ${file_path}`);
      let updated: string;
      if (replace_all) {
        updated = data.split(old_string).join(new_string);
      } else {
        if (count > 1)
          throw new ToolError(`edit: old_string appears ${count} times in ${file_path} (must be unique)`);
        // Callback form so `$&`/`$1`/`` $` `` in new_string are inserted
        // literally instead of expanded as replacement patterns.
        updated = data.replace(old_string, () => new_string);
      }
      try {
        await atomicWriteFile(abs, updated);
      } catch (e) {
        throw new ToolError(`edit: write: ${fsErrorMessage(e, file_path)}`);
      }
      return `edited ${file_path} (${replace_all ? count : 1} replacement(s))`;
    },
  });
}

// ---- search --------------------------------------------------------------

/**
 * Best-effort: stops `fs.glob` from walking out of the root via a literal or
 * brace-expanded `..`. The realpath post-filter in {@link betaGlobTool} is the
 * boundary; this only avoids the walk.
 */
function patternCanAscend(pattern: string): boolean {
  return pattern.split(/[\\/{},]/).includes('..');
}

export function betaGlobTool(ctx: AgentToolContext): BetaRunnableTool {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return betaTool({
    name: 'glob',
    description:
      'Match files under the workdir against a glob pattern. Results are mtime-sorted, newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        path: { type: 'string', description: 'Directory to search in. Defaults to the workdir.' },
      },
      required: ['pattern'],
    },
    run: async ({ pattern, path: searchPath }) => {
      if (!pattern) throw new ToolError('glob: pattern is required');
      if (path.isAbsolute(pattern)) {
        throw new ToolError(
          'glob: absolute pattern not permitted; pass a relative pattern (and optionally path)',
        );
      }
      if (patternCanAscend(pattern)) {
        throw new ToolError('glob: ".." is not permitted in the pattern');
      }
      const root = searchPath ? await resolvePath(ctx, searchPath) : path.resolve(ctx.workdir);
      // Compare canonical against canonical: a workdir that is itself a
      // symlink would otherwise falsely reject every realpath'd match below.
      const realRoot = searchPath ? root : await canonicalize(root);
      const matches: { path: string; mtime: number }[] = [];
      // Bounds the walk for patterns that match, or brace-expand into,
      // enormous trees.
      let remaining = WALK_MAX_ENTRIES;
      try {
        // Native `fs.glob` (Node 22+). `exclude` prunes the noisy dirs the
        // legacy walker skipped; only regular files are collected.
        for await (const entry of fsGlob(pattern, {
          cwd: root,
          withFileTypes: true,
          exclude: (d) => d.name === '.git' || d.name === 'node_modules',
        })) {
          if (remaining-- <= 0) break;
          if (!entry.isFile()) continue;
          const full = path.join(entry.parentPath, entry.name);
          // Drop any match that resolves outside the search root. A pattern
          // that *names* a symlinked directory (the model controls the
          // pattern, and the bash tool in the same session can plant the
          // link) makes `fs.glob` descend through it and report entries with
          // the raw parent path, so a lexical check on `full` alone would
          // pass `root/link_out/secret` even though it lives outside the
          // jail. Resolve-failure (ELOOP, EACCES, a racing unlink) is a deny.
          let real: string;
          try {
            real = await fs.realpath(full);
          } catch {
            continue;
          }
          if (!isWithin(realRoot, real)) continue;
          let mtime = 0;
          try {
            mtime = (await fs.stat(full)).mtimeMs;
          } catch {
            // unreadable — keep it in the list with mtime 0
          }
          matches.push({ path: full, mtime });
        }
      } catch (e) {
        throw new ToolError(`glob: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (matches.length === 0) return 'no matches';
      matches.sort((a, b) => b.mtime - a.mtime);
      return matches
        .slice(0, GLOB_RESULT_LIMIT)
        .map((m) => m.path)
        .join('\n');
    },
  });
}

export function betaGrepTool(ctx: AgentToolContext): BetaRunnableTool {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return betaTool({
    name: 'grep',
    description: 'Search file contents for a regex. Uses ripgrep if available, otherwise a built-in walker.',
    inputSchema: {
      type: 'object',
      properties: { pattern: { type: 'string' }, path: { type: 'string' } },
      required: ['pattern'],
    },
    run: async ({ pattern, path: p }, context) => {
      if (!pattern) throw new ToolError('grep: pattern is required');
      let searchPath = path.resolve(ctx.workdir);
      if (p) searchPath = await resolvePath(ctx, p);
      const rg = await findRg();
      return rg ?
          runRipgrep(rg, pattern, searchPath, context?.signal)
        : runWalkGrep(pattern, searchPath, context?.signal);
    },
  });
}

function runRipgrep(
  rg: string,
  pattern: string,
  searchPath: string,
  signal?: AbortSignal | null | undefined,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = cp.spawn(rg, ['-n', '--no-heading', '-e', pattern, '--', searchPath], {
      ...(signal ? { signal } : {}),
    });
    let out = '';
    let errOut = '';
    let truncated = false;
    proc.stdout.on('data', (d) => {
      if (truncated) return;
      out += d;
      if (out.length > GREP_OUTPUT_LIMIT) {
        truncated = true;
        out = out.slice(0, GREP_OUTPUT_LIMIT);
        proc.kill('SIGKILL');
      }
    });
    proc.stderr.on('data', (d) => (errOut += d));
    proc.on('close', (code) => {
      if (signal?.aborted) return reject(new ToolError('grep: aborted'));
      if (truncated) return resolve(out + `\n[output truncated at ${GREP_OUTPUT_LIMIT} bytes]`);
      if (code === 0) return resolve(out);
      if (code === 1) return resolve('no matches');
      reject(new ToolError(`grep: rg failed: ${errOut || `exit ${code}`}`));
    });
    proc.on('error', (e) => {
      if (signal?.aborted) return reject(new ToolError('grep: aborted'));
      reject(new ToolError(`grep: rg failed: ${e.message}`));
    });
  });
}

async function runWalkGrep(
  pattern: string,
  root: string,
  signal?: AbortSignal | null | undefined,
): Promise<string> {
  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch (e) {
    throw new ToolError(`grep: invalid regex: ${e instanceof Error ? e.message : String(e)}`);
  }
  const hits: string[] = [];
  let budget = GREP_OUTPUT_LIMIT;
  const push = (line: string): boolean => {
    budget -= line.length + 1;
    if (budget < 0) {
      hits.push(`[output truncated at ${GREP_OUTPUT_LIMIT} bytes]`);
      return false;
    }
    hits.push(line);
    return true;
  };
  const stat = await fs.stat(root).catch(() => null);
  if (stat?.isFile()) {
    await grepFile(root, re, push);
  } else {
    await walk(root, '', (rel) => grepFile(path.join(root, rel), re, push), signal);
  }
  if (signal?.aborted) throw new ToolError('grep: aborted');
  if (hits.length === 0) return 'no matches';
  return hits.join('\n');
}

async function grepFile(file: string, re: RegExp, push: (line: string) => boolean): Promise<boolean> {
  const stream = fssync.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let i = 0;
  try {
    for await (const line of rl) {
      i++;
      // Cap line length: `pattern` is model-supplied and JS regexes backtrack,
      // so a pathological pattern against a very long line is a ReDoS.
      if (line.length > GREP_MAX_LINE_LENGTH) continue;
      if (re.test(line) && !push(`${file}:${i}:${line}`)) return false;
    }
  } catch {
    // unreadable / binary
  } finally {
    stream.destroy();
  }
  return true;
}

// ---- utils ---------------------------------------------------------------

const WALK_MAX_DEPTH = 40;
const WALK_MAX_ENTRIES = 50_000;

/**
 * Bounded recursive walk. `fn` may return `false` to abort. Only real
 * directories are descended into and only real files are handed to `fn` —
 * symlinks (and devices/fifos/sockets) are skipped entirely so a symlink inside
 * the root cannot be followed out of it.
 */
async function walk(
  root: string,
  rel: string,
  fn: (rel: string) => boolean | void | Promise<boolean | void>,
  signal?: AbortSignal | null | undefined,
): Promise<void> {
  let remaining = WALK_MAX_ENTRIES;
  async function inner(rel: string, depth: number): Promise<boolean> {
    if (depth > WALK_MAX_DEPTH) return true;
    if (signal?.aborted) return false;
    let entries: fssync.Dirent[];
    try {
      entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
    } catch {
      return true;
    }
    for (const e of entries) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      if (remaining-- <= 0) return false;
      if (signal?.aborted) return false;
      const childRel = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) {
        if (!(await inner(childRel, depth + 1))) return false;
      } else if (e.isFile()) {
        if ((await fn(childRel)) === false) return false;
      }
      // Symlinks, devices, fifos and sockets are intentionally skipped.
    }
    return true;
  }
  await inner(rel, 0);
}

async function findRg(): Promise<string | null> {
  const dirs = (process.env['PATH'] ?? '').split(path.delimiter);
  for (const d of dirs) {
    const candidate = path.join(d, 'rg');
    try {
      await fs.access(candidate, fssync.constants.X_OK);
      return candidate;
    } catch {
      // not here
    }
  }
  return null;
}
