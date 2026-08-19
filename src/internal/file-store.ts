/**
 * `FileStore` — one confined folder; a relative path cannot escape it.
 *
 * Beta scope: symlinks are refused or skipped wherever the store meets them,
 * but there is no hardening against a process racing the store's own
 * syscalls; fsync durability, non-POSIX hosts, and read-size caps are out of
 * scope.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { constants as C } from 'node:fs';
import type { BigIntStats, Dirent } from 'node:fs';
import type * as util from 'node:util';
import { createHash, randomBytes } from 'node:crypto';
import { encodeUTF8 } from './utils/bytes';

// Owner-only regardless of umask: the store holds downloaded user/model content.
const OWNER_ONLY_DIR_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;
const OWNER_ONLY_EXEC_MODE = 0o700;

// 0 where the platform lacks them; `open` refuses such platforms.
const O_NOFOLLOW: number = (C as { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;
const O_NONBLOCK: number = (C as { O_NONBLOCK?: number }).O_NONBLOCK ?? 0;

/** A refused operation — input the store will not act on. OS errors propagate with their `.code`. */
export class FileStoreError extends Error {
  static readonly ESCAPES_ROOT = 'escapes the store root';
  static readonly IS_A_SYMLINK = 'is a symlink';
  static readonly NOT_A_FILE = 'is not a regular file';
  static readonly NOT_A_DIRECTORY = 'is not a directory';
  static readonly NOT_UTF8 = 'is not valid utf-8';
  static readonly MOVE_DESTINATION_EXISTS = 'already exists';

  readonly reason: string;
  readonly relPath: string;

  constructor(reason: string, relPath: string) {
    super(`path ${JSON.stringify(relPath)} ${reason}`);
    this.name = 'FileStoreError';
    this.reason = reason;
    this.relPath = relPath;
  }
}

/**
 * The store's resolved root, and what {@link FileStore.dispose} will do to it.
 *
 * `removedOnDispose` is true when `open` found no root, so `dispose` removes
 * it. A root that was already there is someone else's — a pre-seeded mount, a
 * caller's workdir — and is kept.
 */
export type Root = { path: string; removedOnDispose: boolean };

/** Options for {@link FileStore.open} / {@link openFileStore}. */
export interface OpenFileStoreOptions {
  /**
   * Restrict the store to valid UTF-8 (default `false`): a `put` of binary
   * bytes and a `get` of a binary file are refused with
   * {@link FileStoreError}, so a caller that decodes what `get` returns can
   * never hit a decode error.
   */
  utf8?: boolean;
}

/** Resolve `root`; creates nothing — only {@link FileStore.createRoot} makes the folder. */
export async function openFileStore(root: string, opts?: OpenFileStoreOptions): Promise<FileStore> {
  return FileStore.open(root, opts);
}

/**
 * True for a path usable verbatim as a store location: absolute, with no `..`
 * components. Paths are judged in POSIX terms — they are wire values naming
 * locations inside a POSIX container, not host-native paths.
 */
export function isPathLegal(p: string): boolean {
  return p.startsWith('/') && !p.split('/').includes('..');
}

/** One hashed file version: the stat identity it had, and its sha. */
type Hashed = {
  mtimeNs: bigint;
  // Userspace cannot set ctime, so writers that preserve mtimes
  // (`rsync -t`, `cp -p`) still miss the cache.
  ctimeNs: bigint;
  size: bigint;
  sha: string;
};

/**
 * One confined folder of regular files.
 *
 * Every `relPath` is relative to the root (a leading `/` also means the root)
 * and refused with {@link FileStoreError} when it escapes. The store holds
 * regular files only: symlinks are refused on read and skipped by listings —
 * {@link findSymlinks} reports them. A `relPath` resolving to the root itself
 * is banned by this interface: `put` and `get` refuse it, `move` and `remove`
 * do nothing. A store opened with `utf8: true` refuses binary content the
 * same way — on `put` of such bytes and on `get` of such a file. Only
 * {@link createRoot} makes the root: writes create directories below it,
 * never the root itself, so a root removed while the store is open stays
 * removed and the write fails with `ENOENT`.
 */
export class FileStore {
  private readonly rootPath: string;
  /** True ⇒ this open created the root, so {@link dispose} removes it. */
  private readonly removedOnDispose: boolean;
  /** Set iff the store refuses non-UTF-8 content; {@link requireUtf8} decodes against it, on both put and get. */
  private readonly decoder: util.TextDecoder | undefined;
  /** `hashtree`'s advisory cache; every hit re-validates against a fresh stat. */
  private readonly hashes = new Map<string, Hashed>();

  static isPathLegal = isPathLegal;

  /** @internal — use {@link FileStore.open} / {@link openFileStore}. */
  constructor(root: string, removedOnDispose: boolean, utf8Only: boolean = false) {
    this.rootPath = root;
    this.removedOnDispose = removedOnDispose;
    this.decoder = utf8Only ? new TextDecoder('utf-8', { fatal: true }) : undefined;
  }

  /** Resolve `root`; creates nothing — only {@link createRoot} makes the folder. */
  static async open(root: string, opts?: OpenFileStoreOptions): Promise<FileStore> {
    // A deployment condition, not refused caller input — hence not FileStoreError.
    if (!platformSupported()) {
      throw new Error('FileStore requires O_NOFOLLOW support on this platform');
    }
    let removedOnDispose = false;
    try {
      // lstat, not a follow-and-swallow existence check: following symlinks or
      // swallowing permission errors would mark a real directory ours to
      // delete on dispose.
      await fsp.lstat(root);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      removedOnDispose = true;
    }
    return new FileStore(path.resolve(root), removedOnDispose, opts?.utf8 ?? false);
  }

  /** Create the root directory and any missing ancestors; already existing is fine. */
  async createRoot(): Promise<void> {
    await makeDirAndAncestors(this.rootPath);
  }

  /** The resolved root, and what {@link dispose} will do to it. */
  root(): Root {
    return { path: this.rootPath, removedOnDispose: this.removedOnDispose };
  }

  /**
   * Remove the root iff `open` created it; pre-existing roots are kept.
   *
   * Wired to `Symbol.asyncDispose` at runtime when the host provides it, so
   * `await using` works on engines with explicit resource management.
   */
  async dispose(): Promise<void> {
    if (!this.removedOnDispose) return;
    await fsp.rm(this.rootPath, { recursive: true, force: true });
  }

  /**
   * Write `data` (`string` UTF-8 or bytes) atomically to the file at `relPath`.
   *
   * Missing directories below the root are created; a missing root is not —
   * the write fails with `ENOENT`.
   */
  async put(relPath: string, data: string | Uint8Array, opts?: { executable?: boolean }): Promise<void> {
    // "dir/." names a directory just like a trailing "/".
    const tail = relPath.replace(/\\/g, '/');
    if (tail.endsWith('/') || tail.endsWith('/.') || tail === '' || tail === '.') {
      throw new FileStoreError(FileStoreError.NOT_A_FILE, relPath);
    }
    const dest = this.resolveUnderRoot(relPath);
    const payload = typeof data === 'string' ? encodeUTF8(data) : data;
    this.requireUtf8(relPath, payload);
    await makeDirsBelowRoot(this.rootPath, path.dirname(dest));
    await replaceViaTemp(dest, payload, opts?.executable ?? false);
  }

  /** The file's bytes; `null` when absent. */
  async get(relPath: string): Promise<Uint8Array | null> {
    const dest = this.resolveUnderRoot(relPath);
    let handle: fsp.FileHandle;
    try {
      handle = await openRegularFile(relPath, dest);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
    let data: Uint8Array;
    try {
      const buf = await handle.readFile();
      data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } finally {
      await handle.close();
    }
    this.requireUtf8(relPath, data);
    return data;
  }

  /** The relative path of every file under the directory `under`. */
  async ls(under: string = '/'): Promise<Set<string>> {
    const base = this.resolveUnderRoot(under);
    return new Set((await filenamesInDir(this.rootPath, under, base)).map(([rel]) => rel));
  }

  /**
   * Every symlink under `under` — listings skip them and reads refuse them,
   * so a caller that must know they exist asks here.
   */
  async findSymlinks(under: string = '/'): Promise<Set<string>> {
    const base = this.resolveUnderRoot(under);
    return symlinksInDir(this.rootPath, under, base);
  }

  /**
   * `{relPath: sha256Hex}` of every file under the directory `under`.
   *
   * Unchanged files — same size, mtime, and ctime since the last call —
   * reuse their recorded hash instead of being re-read.
   */
  async hashtree(under: string = '/'): Promise<Record<string, string>> {
    const base = this.resolveUnderRoot(under);
    const walkStartNs = _internals.nowNs();
    // Null prototype so a file named `__proto__` (or `constructor`) is an
    // ordinary own key instead of a silent prototype write / inherited read.
    const out: Record<string, string> = Object.create(null);
    for (const [rel, full] of await filenamesInDir(this.rootPath, under, base)) {
      const sha = await this.hashViaCache(rel, full, walkStartNs);
      if (sha !== null) out[rel] = sha;
    }
    return out;
  }

  /** One file's sha256; `null` when absent. Shares {@link hashtree}'s cache. */
  async hashFile(relPath: string): Promise<string | null> {
    const dest = this.resolveUnderRoot(relPath);
    let st: BigIntStats;
    try {
      st = await fsp.lstat(dest, { bigint: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
    if (st.isSymbolicLink()) throw new FileStoreError(FileStoreError.IS_A_SYMLINK, relPath);
    if (!st.isFile()) throw new FileStoreError(FileStoreError.NOT_A_FILE, relPath);
    const rel = path.relative(this.rootPath, dest).split(path.sep).join('/');
    return this.hashViaCache(rel, dest, _internals.nowNs());
  }

  /**
   * Rename `src` to `dst`; an existing `dst` is refused. The banned store
   * root as either end does nothing.
   */
  async move(src: string, dst: string): Promise<void> {
    const s = this.resolveUnderRoot(src);
    const d = this.resolveUnderRoot(dst);
    if (s === this.rootPath || d === this.rootPath) return;
    // stat, not lstat: a dangling symlink at dst reads as absent and is
    // atomically replaced by the rename, like any other rename target.
    const dstExists = await fsp.stat(d).then(
      () => true,
      () => false,
    );
    if (dstExists) throw new FileStoreError(FileStoreError.MOVE_DESTINATION_EXISTS, dst);
    await makeDirsBelowRoot(this.rootPath, path.dirname(d));
    await fsp.rename(s, d);
  }

  /** Delete a file or subtree; absent — and the banned store root — do nothing. */
  async remove(relPath: string): Promise<void> {
    const dest = this.resolveUnderRoot(relPath);
    if (dest === this.rootPath) return;
    let st: BigIntStats;
    try {
      // lstat: a dangling symlink must still be unlinked.
      st = await fsp.lstat(dest, { bigint: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw e;
    }
    if (st.isDirectory()) {
      await fsp.rm(dest, { recursive: true, force: true });
    } else {
      try {
        await fsp.unlink(dest);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
    }
  }

  private resolveUnderRoot(relPath: string): string {
    const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = norm.split('/').filter((p) => p !== '' && p !== '.');
    if (path.posix.isAbsolute(norm) || parts.includes('..')) {
      throw new FileStoreError(FileStoreError.ESCAPES_ROOT, relPath);
    }
    return parts.length === 0 ? this.rootPath : path.join(this.rootPath, ...parts);
  }

  private requireUtf8(relPath: string, data: Uint8Array): void {
    if (!this.decoder) return;
    try {
      this.decoder.decode(data);
    } catch {
      throw new FileStoreError(FileStoreError.NOT_UTF8, relPath);
    }
  }

  private async hashViaCache(rel: string, full: string, walkStartNs: bigint): Promise<string | null> {
    let st: BigIntStats;
    try {
      st = await fsp.lstat(full, { bigint: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; // vanished since the walk: not in this snapshot
      throw e;
    }
    if (!st.isFile()) return null;
    const cached = this.hashes.get(rel);
    let sha: string;
    if (cached !== undefined && unchangedSinceHashed(cached, st)) {
      sha = cached.sha;
    } else {
      try {
        sha = await _internals.hashFile(full);
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' || e instanceof FileStoreError) return null;
        // FreeBSD reports EMLINK rather than ELOOP for O_NOFOLLOW.
        if (code === 'ELOOP' || code === 'EMLINK') return null;
        throw e;
      }
    }
    if (oldEnoughToCache(st, walkStartNs)) {
      this.hashes.set(rel, { mtimeNs: st.mtimeNs, ctimeNs: st.ctimeNs, size: st.size, sha });
    }
    return sha;
  }
}

function platformSupported(): boolean {
  return O_NOFOLLOW !== 0;
}

async function makeDirAndAncestors(dir: string): Promise<void> {
  const missing: string[] = [];
  let current = dir;
  for (;;) {
    try {
      await fsp.stat(current);
      break;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR' && code !== 'ELOOP') throw e;
    }
    missing.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const directory of missing.reverse()) {
    try {
      await fsp.mkdir(directory, { mode: OWNER_ONLY_DIR_MODE });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
  }
}

async function makeDirsBelowRoot(root: string, dir: string): Promise<void> {
  // Never the root itself: only createRoot() makes it, so a write racing an
  // rm -rf of the folder fails with ENOENT instead of re-creating it.
  const below = path.relative(root, dir);
  if (below === '') return;
  let current = root;
  for (const part of below.split(path.sep)) {
    current = path.join(current, part);
    try {
      await fsp.mkdir(current, { mode: OWNER_ONLY_DIR_MODE });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
  }
}

async function replaceViaTemp(dest: string, data: Uint8Array, isExecutable: boolean): Promise<void> {
  const mode = isExecutable ? OWNER_ONLY_EXEC_MODE : OWNER_ONLY_FILE_MODE;
  const tmp = path.join(path.dirname(dest), `.fs-${randomBytes(8).toString('hex')}.tmp`);
  let handle: fsp.FileHandle | undefined;
  try {
    handle = await fsp.open(tmp, C.O_WRONLY | C.O_CREAT | C.O_EXCL | O_NOFOLLOW, mode);
    await handle.writeFile(data);
    await handle.close();
    handle = undefined;
    await fsp.rename(tmp, dest);
  } catch (err) {
    // Best-effort temp cleanup; never mask the original error.
    if (handle) await handle.close().catch(() => {});
    await fsp.unlink(tmp).catch(() => {});
    throw err;
  }
}

async function openRegularFile(relPath: string, dest: string): Promise<fsp.FileHandle> {
  // O_NONBLOCK: a FIFO fails the fstat check below instead of blocking the open.
  let handle: fsp.FileHandle;
  try {
    handle = await fsp.open(dest, C.O_RDONLY | O_NOFOLLOW | O_NONBLOCK);
  } catch (e) {
    // FreeBSD reports EMLINK rather than ELOOP for O_NOFOLLOW.
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ELOOP' || code === 'EMLINK') {
      throw new FileStoreError(FileStoreError.IS_A_SYMLINK, relPath);
    }
    throw e;
  }
  try {
    const st = await handle.stat();
    if (!st.isFile()) throw new FileStoreError(FileStoreError.NOT_A_FILE, relPath);
  } catch (e) {
    await handle.close().catch(() => {});
    throw e;
  }
  return handle;
}

/** sha256 of a file's contents, streamed — constant memory on any file size. */
async function hashFile(full: string): Promise<string> {
  const digest = createHash('sha256');
  const handle = await openRegularFile(path.basename(full), full);
  const buf = new Uint8Array(1024 * 1024);
  try {
    for (;;) {
      const { bytesRead } = await handle.read(buf, 0, buf.length);
      if (bytesRead === 0) break;
      digest.update(buf.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
  return digest.digest('hex');
}

/**
 * `[rel, path]` for every regular file under the directory `base`; an absent
 * `base` is empty, a present non-directory is refused. The walk never
 * descends symlinked directories.
 */
async function filenamesInDir(root: string, under: string, base: string): Promise<[string, string][]> {
  if (!(await requireDir(under, base))) return [];
  const out: [string, string][] = [];
  await walk(base, (full, entry) => {
    if (entry.isFile()) out.push([path.relative(root, full).split(path.sep).join('/'), full]);
  });
  out.sort();
  return out;
}

async function symlinksInDir(root: string, under: string, base: string): Promise<Set<string>> {
  const relOf = (full: string) => path.relative(root, full).split(path.sep).join('/');
  let st: BigIntStats;
  try {
    st = await fsp.lstat(base, { bigint: true });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return new Set();
    throw e;
  }
  if (st.isSymbolicLink()) return new Set([relOf(base)]);
  if (!st.isDirectory()) throw new FileStoreError(FileStoreError.NOT_A_DIRECTORY, under);
  const out = new Set<string>();
  // Symlinks to directories are reported, never descended, like the rest.
  await walk(base, (full, entry) => {
    if (entry.isSymbolicLink()) out.add(relOf(full));
  });
  return out;
}

/** `false` when `base` is absent, refused when present but not a directory. */
async function requireDir(under: string, base: string): Promise<boolean> {
  let st: BigIntStats;
  try {
    st = await fsp.lstat(base, { bigint: true });
  } catch (e) {
    // Absent — including "under a file" (ENOTDIR) — is an empty listing.
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw e;
  }
  if (!st.isDirectory()) throw new FileStoreError(FileStoreError.NOT_A_DIRECTORY, under);
  return true;
}

/** Visit every entry under `base` without descending symlinked directories. */
async function walk(base: string, visit: (full: string, entry: Dirent) => void): Promise<void> {
  const stack: string[] = [base];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue; // a listing is a snapshot, not a lock
      throw e;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      visit(full, entry);
      if (entry.isDirectory() && !entry.isSymbolicLink()) stack.push(full);
    }
  }
}

function unchangedSinceHashed(cached: Hashed, st: BigIntStats): boolean {
  return st.mtimeNs === cached.mtimeNs && st.ctimeNs === cached.ctimeNs && st.size === cached.size;
}

function oldEnoughToCache(st: BigIntStats, walkStartNs: bigint): boolean {
  const newestNs = st.mtimeNs > st.ctimeNs ? st.mtimeNs : st.ctimeNs;
  return newestNs < walkStartNs - _internals.timestampTrustMarginNs;
}

// Filesystems stamp times with coarse clocks, so a rewrite shortly after a
// hashed write can reuse the exact stamps. Files younger than the margin are
// simply re-hashed next walk.
const TIMESTAMP_TRUST_MARGIN_NS = 2_000_000_000n;

/** Test seam — the hasher, the trust margin, and the walk clock. @internal */
export const _internals = {
  hashFile,
  timestampTrustMarginNs: TIMESTAMP_TRUST_MARGIN_NS,
  nowNs: (): bigint => BigInt(Date.now()) * 1_000_000n,
};

export const LocalFileStore = FileStore;

// Wire `Symbol.asyncDispose` at runtime when the host provides it — the
// repo's tsconfig targets ES2020 so the type-level `AsyncDisposable` lib is
// not available, but `await using` callers on newer engines still work.
const asyncDispose = (Symbol as { asyncDispose?: symbol }).asyncDispose;
if (asyncDispose) {
  Object.defineProperty(FileStore.prototype, asyncDispose, {
    value: FileStore.prototype.dispose,
    configurable: true,
    writable: true,
  });
}
