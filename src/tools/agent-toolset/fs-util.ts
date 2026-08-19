/**
 * Shared, Node-only filesystem helpers for the agent toolset's file tools:
 * path confinement (symlink-aware), an atomic write, and language-independent
 * error messages. Kept out of `node.ts` so the tool implementations stay focused
 * and these helpers can be reused by every file tool.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ToolError } from '../../lib/tools/ToolError';

/** Mode for directories the file tools create — not world-writable under a 0 umask. */
export const DIR_CREATE_MODE = 0o755;
/** Mode for files the file tools create. */
export const FILE_CREATE_MODE = 0o644;

/** True when `p` is `root` itself or lexically contained within it. */
export function isWithin(root: string, p: string): boolean {
  const rel = path.relative(root, p);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

/**
 * The first entry of `roots` whose canonical form contains the
 * already-canonical `target`, returned as configured; `undefined` when none
 * does. Each root goes through {@link canonicalize} at check time, exactly like
 * the workdir in {@link confineToRoot}, so granting access (`allowedRoots`)
 * and refusing writes (`readOnlyRoots`) can never resolve the same entry two
 * different ways.
 */
export async function containingRoot(roots: readonly string[], target: string): Promise<string | undefined> {
  for (const root of roots) {
    if (isWithin(await canonicalize(path.resolve(root)), target)) return root;
  }
  return undefined;
}

/** Matches Linux MAXSYMLINKS, the threshold at which `realpath` itself reports ELOOP. */
const MAX_SYMLINK_HOPS = 40;

/** The `code` of a Node system error, or `undefined` for anything else. */
export function errnoCode(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Fully resolve `abs`: `realpath` the longest existing ancestor and re-append
 * the rest, but never re-append a component that is itself a symlink — read the
 * link and continue from its target instead. This handles paths being created
 * (write/edit) without letting a symlink leaf (e.g. a dangling one pointing
 * outside a confinement root) slip through unresolved.
 *
 * Returns a symlink-free path or throws an errno-carrying error (`ELOOP` for a
 * cycle or more than {@link MAX_SYMLINK_HOPS} links, the `lstat`/`realpath`
 * error for an unreadable component); it never returns `abs` unresolved. Only
 * symlink hops count against the cap, so any depth of not-yet-existing
 * directories still resolves.
 */
export async function canonicalize(abs: string): Promise<string> {
  const tail: string[] = [];
  let prefix = abs;
  let hops = 0;
  for (;;) {
    let real: string;
    try {
      real = await fs.realpath(prefix);
    } catch (realpathErr) {
      let isLink: boolean;
      try {
        isLink = (await fs.lstat(prefix)).isSymbolicLink();
      } catch (lstatErr) {
        const code = errnoCode(lstatErr);
        if (code !== 'ENOENT' && code !== 'ENOTDIR') throw lstatErr;
        const parent = path.dirname(prefix);
        if (parent === prefix) throw lstatErr;
        tail.push(path.basename(prefix));
        prefix = parent;
        continue;
      }
      if (!isLink) throw realpathErr;
      if (++hops > MAX_SYMLINK_HOPS) {
        throw Object.assign(new Error('too many levels of symbolic links'), { code: 'ELOOP' });
      }
      prefix = path.resolve(path.dirname(prefix), await fs.readlink(prefix));
      continue;
    }
    return tail.length ? path.join(real, ...tail.reverse()) : real;
  }
}

/**
 * Resolve `p` against `root` and confine it to `root` or one of `allowedRoots`
 * (absolute paths, resolved at check time exactly like `root`).
 *
 * Absolute and relative inputs go through the same canonicalise-then-contain
 * check — an absolute path that lands inside a permitted root is accepted,
 * only paths that resolve *outside* all of them are rejected. Every symlink in
 * `p` (including the leaf, even a dangling one) is resolved before the
 * confinement check, and the resolved path is what the caller then operates
 * on, so a symlink inside `root` that points outside it can neither pass the
 * check nor be followed afterwards. `..` is collapsed lexically before any
 * symlink is followed. A path that cannot be resolved (symlink loop, unreadable
 * component) is rejected with a `ToolError` naming `p`, never the host's
 * absolute path.
 *
 * Residual TOCTOU: a component could still be swapped for a symlink between this
 * call and the eventual `fs` operation. Closing that fully needs per-component
 * `O_NOFOLLOW`/`openat`, which Node does not expose ergonomically; this is why a
 * sandbox is still recommended for the toolset as a whole.
 */
export async function confineToRoot(
  root: string,
  p: string,
  opts?: { allowedRoots?: readonly string[] },
): Promise<string> {
  const allowedRoots = opts?.allowedRoots ?? [];
  const realRoot = await canonicalize(path.resolve(root));
  let real: string;
  try {
    real = await canonicalize(path.resolve(realRoot, p));
  } catch (err) {
    throw new ToolError(fsErrorMessage(err, `path ${JSON.stringify(p)}`));
  }
  if (isWithin(realRoot, real) || (await containingRoot(allowedRoots, real)) !== undefined) {
    return real;
  }
  const permitted =
    allowedRoots.length ?
      "the session's working directory and its other permitted directories"
    : "the session's working directory";
  throw new ToolError(`path ${JSON.stringify(p)} is outside ${permitted}`);
}

/**
 * Atomically write `content` to `targetPath`: write a sibling temp file, fsync
 * it, then rename over the target. The rename is atomic on most filesystems, so
 * a crash mid-write never leaves the target half-written.
 */
export async function atomicWriteFile(targetPath: string, content: string): Promise<void> {
  const dir = path.dirname(targetPath);
  const tempPath = path.join(dir, `.tmp-${process.pid}-${randomUUID()}`);
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(tempPath, 'wx', FILE_CREATE_MODE);
    await handle.writeFile(content, 'utf-8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(tempPath, targetPath);
  } catch (err) {
    if (handle) await handle.close().catch(() => {});
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  }
}

/**
 * Map a thrown filesystem error to a consistent, language-independent message,
 * so the model sees the same wording regardless of the runtime (Node's raw
 * `ENOENT: no such file...` text would otherwise leak through). Codes we don't
 * special-case render as the bare code, never Node's message, which embeds the
 * host's absolute path.
 */
export function fsErrorMessage(err: unknown, file: string): string {
  const code = errnoCode(err);
  switch (code) {
    case 'ENOENT':
      return `${file}: no such file or directory`;
    case 'EACCES':
    case 'EPERM':
      return `${file}: permission denied`;
    case 'ENOTDIR':
      return `${file}: not a directory`;
    case 'EISDIR':
      return `${file}: is a directory`;
    case 'ELOOP':
      return `${file}: too many levels of symbolic links`;
    case 'ENAMETOOLONG':
      return `${file}: file name too long`;
    case 'ENOSPC':
      return `${file}: no space left on device`;
    case 'EMFILE':
    case 'ENFILE':
      return `${file}: too many open files`;
    default:
      return `${file}: ${code !== undefined ? `i/o error (${code})` : 'i/o error'}`;
  }
}
