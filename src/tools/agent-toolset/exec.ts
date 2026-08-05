/**
 * Safe executable resolution and invocation for the agent toolset — the one
 * module under `src/` that spawns processes.
 *
 * **Safe executable resolution.** This SDK never launches a helper program by bare
 * name. Every program it spawns is either an absolute path it constructed itself, or a
 * bare name resolved by the SDK's own `find_executable` — which searches only the
 * fully-absolute entries of `PATH`, never the current working directory (neither
 * implicitly, as Windows `CreateProcess`/`shutil.which`/libuv do, nor via `.`/empty/
 * relative `PATH` entries), and on Windows returns only native executables
 * (`.exe`/`.com`). The absolute path it returns is what is handed to the OS. This holds
 * on every platform, so a file planted in a directory the user merely *works in* (a
 * cloned repository, an extracted archive) is never selected as a helper binary.
 *
 * (`find_executable` is {@link findExecutable} in this SDK.)
 *
 * Guarantees, named so docs and tests can cross-reference them:
 *
 * - **G1 — absolute argv[0].** The program path handed to `node:child_process`
 *   is always absolute. A bare name never reaches `spawn`/`execFile`, so libuv's
 *   own lookup — which on Windows tries the working directory before `PATH` —
 *   never runs.
 * - **G2 — the working directory is never a search location.** Only fully
 *   absolute `PATH` entries are searched: POSIX `/…`; Windows `C:\…` / `C:/…`
 *   or UNC `\\server\share…` (a pair of surrounding double quotes is stripped
 *   first). `.`, empty, and relative entries are skipped, and on Windows so are
 *   drive-relative (`C:bin`) and rooted-but-driveless (`\bin`) ones. No `~` or
 *   `%VAR%`/`$VAR` expansion — the OS does none at spawn time either.
 * - **G3 — Windows: native images only.** A bare name is tried with each
 *   allowed extension appended — by default {@link WINDOWS_NATIVE_EXTENSIONS}
 *   (`.exe`, `.com`); never `.bat`/`.cmd` (they run through `cmd.exe`, which
 *   re-parses the arguments) and never an extensionless file. A name that
 *   already ends in an allowed extension is tried as-is only. On POSIX the name
 *   is tried as-is only.
 * - **G4 — explicit paths are the caller's decision.** A `name` containing a
 *   path separator (`/`, and on Windows also `\`) is not searched for at all: it
 *   is resolved to an absolute path (against the working directory if relative
 *   — `./tool` means exactly that) and accepted iff it names an existing,
 *   executable regular file.
 * - **G5 — one implementation, enforced.** This is the only module under
 *   `src/` allowed to import `node:child_process`; eslint's
 *   `no-restricted-imports` rejects it everywhere else (see CONTRIBUTING.md,
 *   "Spawning external programs").
 *
 * Mirrors Claude Code's `safeExecutableResolver`; keep in sync with the other
 * Anthropic SDKs (claude-agent-sdk-python, anthropic-sdk-python,
 * anthropic-sdk-typescript, anthropic-sdk-go).
 *
 * Node-only, like its siblings `skills.ts` and `fs-util.ts`: it is reachable
 * only through `tools/agent-toolset/node`, which browser builds replace with
 * `node.browser.ts` (the package.json `browser` field), so `node:child_process`
 * never enters a browser bundle.
 */

import * as cp from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as fssync from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { AnthropicError } from '../../core/error';

const execFileAsync = promisify(cp.execFile);

/** G3: the only extensions a bare name may resolve to on Windows — native images. */
export const WINDOWS_NATIVE_EXTENSIONS = ['.exe', '.com'] as const;

export interface FindExecutableOptions {
  /**
   * The `PATH` value to search. Defaults to this process's `PATH`. An empty or
   * unset `PATH` searches nothing: there is no built-in fallback list, and the
   * working directory is never consulted.
   */
  path?: string | undefined;
  /**
   * Windows only (G3): the extensions a bare `name` may resolve to, in
   * preference order. Defaults to {@link WINDOWS_NATIVE_EXTENSIONS}. Widen it
   * only to *detect* a `.cmd`/`.bat` shim (e.g. to explain why it is refused),
   * never to run one.
   */
  windowsExtensions?: readonly string[] | undefined;
  /**
   * Which platform's rules to apply — the `PATH` delimiter, what counts as a
   * fully-absolute entry, whether `\` is a separator, and executable
   * extensions. Defaults to `process.platform`. Filesystem access always uses
   * the host's own path semantics; this exists so the win32 rules are
   * unit-testable on any host.
   */
  platform?: NodeJS.Platform | undefined;
}

/**
 * Nothing acceptable was found for the requested program: no executable by
 * that name in any absolute `PATH` entry (bare name), or no executable regular
 * file at that location (explicit path).
 */
export class ExecutableNotFoundError extends AnthropicError {
  /** The name or path that was asked for. */
  readonly executable: string;

  constructor(executable: string, message?: string) {
    super(message ?? `executable not found: ${executable}`);
    this.name = 'ExecutableNotFoundError';
    this.executable = executable;
  }
}

const WIN32_DRIVE_ABSOLUTE_RE = /^[A-Za-z]:[\\/]/;
const WIN32_UNC_RE = /^[\\/]{2}[^\\/]+[\\/]+[^\\/]+/;

/** Strip one pair of surrounding double quotes — legal around a Windows `PATH` entry. */
function unquoteWin32PathEntry(entry: string): string {
  return entry.length >= 2 && entry.startsWith('"') && entry.endsWith('"') ? entry.slice(1, -1) : entry;
}

/**
 * G2: whether one `PATH` entry may be searched — i.e. it is *fully* absolute
 * under `platform`'s rules. POSIX: starts with `/`. Windows (after stripping a
 * pair of surrounding double quotes): `X:\` / `X:/` drive-absolute, or a UNC
 * `\\server\share` prefix. Everything else — `""`, `.`, `bin`, `..\x`, and on
 * Windows the drive-relative `C:bin` and rooted-but-driveless `\bin` forms —
 * would be resolved against the working directory, so it is skipped.
 */
export function isSearchablePathEntry(entry: string, platform: NodeJS.Platform): boolean {
  if (platform === 'win32') {
    const unquoted = unquoteWin32PathEntry(entry);
    return WIN32_DRIVE_ABSOLUTE_RE.test(unquoted) || WIN32_UNC_RE.test(unquoted);
  }
  return entry.startsWith('/');
}

/**
 * G3: the file names a bare `name` may match inside a `PATH` entry, in
 * preference order. POSIX: the name itself. Windows: with no extension, the
 * name plus each of `windowsExtensions`; with an allowed extension
 * (case-insensitive), the name as-is; with any other extension (`.cmd`, `.js`,
 * …), nothing.
 */
export function candidateNames(
  name: string,
  platform: NodeJS.Platform,
  windowsExtensions: readonly string[] = WINDOWS_NATIVE_EXTENSIONS,
): string[] {
  if (platform !== 'win32') return [name];
  const ext = path.win32.extname(name).toLowerCase();
  if (ext === '') return windowsExtensions.map((allowed) => name + allowed);
  return windowsExtensions.some((allowed) => allowed.toLowerCase() === ext) ? [name] : [];
}

/** G4: a `name` with a separator is an explicit path, not something to search for. */
function hasPathSeparator(name: string, platform: NodeJS.Platform): boolean {
  return name.includes('/') || (platform === 'win32' && name.includes('\\'));
}

/**
 * The match test: an existing regular file (symlinks followed — a *directory*
 * named `rg` on `PATH` is skipped) that, on POSIX, this process may execute.
 * On Windows existence plus an allowed extension (G3) is the whole test.
 */
async function isExecutableFile(file: string, platform: NodeJS.Platform): Promise<boolean> {
  try {
    if (!(await fs.stat(file)).isFile()) return false;
    if (platform !== 'win32') await fs.access(file, fssync.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve `name` to the absolute path of an executable, or `null`.
 *
 * A bare name is looked up in the fully-absolute entries of `PATH` only (G2),
 * as a native executable on Windows (G3); a name containing a path separator
 * is taken as an explicit path and only checked, not searched for (G4). The
 * result is absolute and normalised but deliberately not `realpath`ed, so
 * symlink-farm spellings (Homebrew, Scoop) are preserved. Nothing is cached —
 * `PATH` and the working directory can change between calls and the walk is
 * cheap. See the module docs for the full contract.
 */
export async function findExecutable(name: string, opts?: FindExecutableOptions): Promise<string | null> {
  const platform = opts?.platform ?? process.platform;
  if (name === '' || name === '.' || name === '..') return null;

  if (hasPathSeparator(name, platform)) {
    const explicit = path.resolve(name);
    return (await isExecutableFile(explicit, platform)) ? explicit : null;
  }
  // `:` cannot appear in a Windows file name; as a bare name it would only ever
  // spell a drive-relative path (`C:rg`) or an NTFS stream, neither of which is
  // a child of a `PATH` entry.
  if (platform === 'win32' && name.includes(':')) return null;

  const candidates = candidateNames(name, platform, opts?.windowsExtensions);
  if (candidates.length === 0) return null;
  const searchPath = opts?.path ?? process.env['PATH'] ?? '';
  const delimiter = platform === 'win32' ? path.win32.delimiter : path.posix.delimiter;
  for (const rawEntry of searchPath.split(delimiter)) {
    if (!isSearchablePathEntry(rawEntry, platform)) continue;
    const entry = platform === 'win32' ? unquoteWin32PathEntry(rawEntry) : rawEntry;
    for (const candidate of candidates) {
      // `join` normalises (`/usr//bin/./rg` → `/usr/bin/rg`) without resolving symlinks.
      const file = path.join(entry, candidate);
      if (await isExecutableFile(file, platform)) return file;
    }
  }
  return null;
}

/** {@link findExecutable}, or throw an {@link ExecutableNotFoundError} naming what was missing. */
export async function requireExecutable(name: string, opts?: FindExecutableOptions): Promise<string> {
  const found = await findExecutable(name, opts);
  if (found !== null) return found;
  throw new ExecutableNotFoundError(
    name,
    hasPathSeparator(name, opts?.platform ?? process.platform) ?
      `\`${name}\` is not an existing executable file`
    : `\`${name}\` was not found on PATH (only absolute PATH entries are searched, never the working directory)`,
  );
}

// ---- spawning ---------------------------------------------------------------

// `shell` is left out of every options type on purpose: a shell would take the
// (joined, re-parsed) command line and do its own bare-name lookup, which is
// exactly what this module exists to prevent.
type WithoutShell<T> = Omit<T, 'shell'>;

/** Options for {@link execFileSafe}: `execFile`'s (minus `shell`), plus how to resolve `file`. */
export type ExecFileSafeOptions = WithoutShell<cp.ExecFileOptionsWithStringEncoding> & FindExecutableOptions;
/** Options for {@link spawnSafe}: `spawn`'s (minus `shell`), plus how to resolve `file`. */
export type SpawnSafeOptions = WithoutShell<cp.SpawnOptions> & FindExecutableOptions;
/** Options for {@link spawnAbsolute}: `spawn`'s, minus `shell`. */
export type SpawnAbsoluteOptions = WithoutShell<cp.SpawnOptions>;

/** Drop the resolver-only keys and pin `shell: false` before handing options to `node:child_process`. */
function childProcessOptions<T extends FindExecutableOptions>(
  options: T,
): Omit<T, keyof FindExecutableOptions> & { shell: false } {
  const { path: _path, platform: _platform, windowsExtensions: _windowsExtensions, ...rest } = options;
  return { ...rest, shell: false as const };
}

/**
 * `execFile` with safe resolution: `file` (a bare name or an explicit path) is
 * resolved by {@link requireExecutable} and the resulting absolute path is what
 * runs (G1). Resolves with the child's decoded stdout/stderr; rejects with
 * {@link ExecutableNotFoundError} when nothing acceptable is found — there is no
 * fallback to a bare-name spawn — or with `execFile`'s own error (carrying
 * `stdout`/`stderr`/`code`) when the child fails.
 */
export async function execFileSafe(
  file: string,
  args: readonly string[],
  options: ExecFileSafeOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  const executable = await requireExecutable(file, options);
  const { stdout, stderr } = await execFileAsync(executable, args, {
    ...childProcessOptions(options),
    encoding: options.encoding ?? 'utf8',
  });
  return { stdout, stderr };
}

/**
 * `spawn` with safe resolution: `file` is resolved by {@link requireExecutable}
 * first and the absolute result is what is spawned (G1). Rejects with
 * {@link ExecutableNotFoundError} before any process is created when nothing
 * acceptable is found.
 */
export function spawnSafe(
  file: string,
  args: readonly string[],
  options?: WithoutShell<cp.SpawnOptionsWithoutStdio> & FindExecutableOptions,
): Promise<cp.ChildProcessWithoutNullStreams>;
export function spawnSafe(
  file: string,
  args: readonly string[],
  options: SpawnSafeOptions,
): Promise<cp.ChildProcess>;
export async function spawnSafe(
  file: string,
  args: readonly string[],
  options: SpawnSafeOptions = {},
): Promise<cp.ChildProcess> {
  const executable = await requireExecutable(file, options);
  return cp.spawn(executable, args, childProcessOptions(options));
}

/**
 * Synchronous `spawn` for a path the caller already holds as absolute — a fixed
 * system path such as `/bin/bash`, or a {@link findExecutable} result. Throws
 * without spawning unless `file` is absolute, so G1 holds by construction; use
 * {@link spawnSafe} for anything that still needs resolving.
 */
export function spawnAbsolute(
  file: string,
  args: readonly string[],
  options?: WithoutShell<cp.SpawnOptionsWithoutStdio>,
): cp.ChildProcessWithoutNullStreams;
export function spawnAbsolute(
  file: string,
  args: readonly string[],
  options: SpawnAbsoluteOptions,
): cp.ChildProcess;
export function spawnAbsolute(
  file: string,
  args: readonly string[],
  options: SpawnAbsoluteOptions = {},
): cp.ChildProcess {
  if (!path.isAbsolute(file)) {
    throw new AnthropicError(`refusing to spawn ${JSON.stringify(file)}: an absolute path is required`);
  }
  return cp.spawn(file, args, { ...options, shell: false });
}
