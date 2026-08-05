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

/** `realpath` `p`, or return `p` unchanged when it cannot be resolved. */
async function realpathOrSelf(p: string): Promise<string> {
  try {
    return await fs.realpath(p);
  } catch {
    return p;
  }
}

/**
 * Fully resolve `abs`: `realpath` the longest existing ancestor and re-append
 * the rest, but never re-append a component that is itself a symlink — read the
 * link and continue from its target instead. This handles paths being created
 * (write/edit) without letting a symlink leaf (e.g. a dangling one pointing
 * outside a confinement root) slip through unresolved.
 */
export async function canonicalize(abs: string): Promise<string> {
  const tail: string[] = [];
  let prefix = abs;
  let hops = 0;
  for (;;) {
    let real: string;
    try {
      real = await fs.realpath(prefix);
    } catch {
      let isLink = false;
      try {
        isLink = (await fs.lstat(prefix)).isSymbolicLink();
      } catch {
        /* prefix truly doesn't exist (ENOENT) — fall through and walk up */
      }
      if (isLink) {
        // Resolve the symlink ourselves and retry; `tail` (the part below it)
        // still applies to the link's target. The hop cap matches Linux
        // MAXSYMLINKS — the same threshold at which `realpath` itself would
        // have returned ELOOP — so a cycle of unresolvable links terminates.
        if (++hops > 40) {
          throw new ToolError(`path ${JSON.stringify(abs)} has too many levels of symbolic links`);
        }
        prefix = path.resolve(path.dirname(prefix), await fs.readlink(prefix));
        continue;
      }
      const parent = path.dirname(prefix);
      if (parent === prefix) return abs; // walked past the FS root without a hit
      tail.push(path.basename(prefix));
      prefix = parent;
      continue;
    }
    return tail.length ? path.join(real, ...tail.reverse()) : real;
  }
}

/**
 * Resolve `p` and confine it to `root`.
 *
 * Absolute and relative inputs go through the same canonicalise-then-contain
 * check — an absolute path that lands inside `root` is permitted, only paths
 * that resolve *outside* are rejected. Every symlink in `p` (including the
 * leaf, even a dangling one) is resolved before the confinement check, and the
 * resolved path is what the caller then operates on, so a symlink inside `root`
 * that points outside it can neither pass the check nor be followed afterwards.
 *
 * Residual TOCTOU: a component could still be swapped for a symlink between this
 * call and the eventual `fs` operation. Closing that fully needs per-component
 * `O_NOFOLLOW`/`openat`, which Node does not expose ergonomically; this is why a
 * sandbox is still recommended for the toolset as a whole.
 */
export async function confineToRoot(
  root: string,
  p: string,
  opts?: { allowOutside?: boolean },
): Promise<string> {
  const allowOutside = opts?.allowOutside ?? false;
  const realRoot = await realpathOrSelf(path.resolve(root));
  const abs = path.resolve(realRoot, p);
  if (allowOutside) return abs;
  const real = await canonicalize(abs);
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
    throw new ToolError(`path ${JSON.stringify(p)} escapes workdir`);
  }
  return real;
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
 * `ENOENT: no such file...` text would otherwise leak through). Falls back to
 * the raw error message for codes we don't special-case.
 */
export function fsErrorMessage(err: unknown, file: string): string {
  const code = (err as { code?: string } | null)?.code;
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
      return `${file}: ${err instanceof Error ? err.message : String(err)}`;
  }
}
