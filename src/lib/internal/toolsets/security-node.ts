/**
 * Upload-path allowlist and the Node file policy. Node-only: it resolves symlinks through the real
 * filesystem.
 *
 * Kept apart from the runtime-agnostic modules so that the public `helpers/beta/toolsets` entry stays importable in
 * browser and edge bundles: a static `fs`/`path` import at the top of a module reachable from it would pull the Node
 * built-ins into every bundle. Reached through `helpers/beta/toolsets/node`. The built-ins come through
 * `internal/node`, which browser builds stub, so importing this module there is harmless and using it throws.
 *
 * @internal
 */
import { fs, path } from '../../../internal/node';

import { ToolError } from '../../tools/ToolError';
import { NO_UPLOAD_ROOTS, ToolsetConfigError, UploadRefusedError } from './errors';
import type { BetaFilePolicy, BetaURLContext } from './hooks';

const MAX_UPLOAD_PATH_LENGTH = 4096;
// Two leading separators of either kind: Windows reads "/\\host" and "\\/?" as UNC and device paths too.
const UNC_OR_DEVICE_PATH_RE = /^[\\/]{2}/;
const DOS_DEVICE_NAME_RE =
  /^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[0-9\u00b9\u00b2\u00b3]|LPT[0-9\u00b9\u00b2\u00b3])(?:[.:].*)?$/i;

const MAX_REALPATH_PASSES = 8;

/** The refusal for a path that is not, or cannot be shown to be, under a configured upload root. */
class UploadOutsideRootsError extends UploadRefusedError {
  constructor() {
    super('file_upload path is outside the configured upload roots');
  }
}

/**
 * `realpath` that tolerates a not-yet-existing leaf: resolves the nearest existing ancestor and
 * re-appends the rest.
 *
 * Only a component that does not exist may be re-appended. A bare `catch` would also swallow ELOOP and a
 * dangling symlink, then return the lexical in-root path for an entry that actually points outside
 * every root, so the containment check would pass and the driver would follow the link at open time.
 */
async function realpathLenient(candidate: string, depth = 0): Promise<string> {
  // Made absolute but not normalised: a `..` that follows a symlinked component has to be resolved through
  // the link, as the OS will at open time. Collapsing it against the lexical parent first (path.resolve)
  // would judge `<dir>/link/../x` inside `<dir>` while it opens somewhere else. An upload or download path with a
  // `..` component never reaches here, but configured directories may contain one.
  let current = path.isAbsolute(candidate) ? candidate : process.cwd() + path.sep + candidate;
  const remainder: string[] = [];

  for (;;) {
    try {
      const resolved = path.join(await fs.promises.realpath(current), ...remainder);
      // path.join collapsed any `..` left in the absent tail. A collapsed `..` can point back inside existing
      // (possibly symlinked) directories, so resolve again until the answer stops changing.
      if (remainder.includes('..') && depth < MAX_REALPATH_PASSES)
        return await realpathLenient(resolved, depth + 1);
      return resolved;
    } catch (err) {
      if (err instanceof ToolError) throw err;

      // The entry exists (so this is a dangling symlink or a cycle, not a missing component):
      // there is no safe lexical answer for it.
      let exists = false;
      try {
        await fs.promises.lstat(current);
        exists = true;
      } catch {
        /* really absent */
      }
      if (exists) throw new UploadOutsideRootsError();

      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        throw new UploadOutsideRootsError();
      }

      const parent = path.dirname(current);
      if (parent === current) return path.join(current, ...remainder);
      const base = path.basename(current);
      if (base !== '' && base !== '.') remainder.unshift(base);
      current = parent;
    }
  }
}

function comparable(p: string): string {
  return process.platform === 'win32' ? p.toLowerCase() : p;
}

/** Whether `a` is `b` or a descendant of it by whole path components. Both are compared as given. */
function sameOrUnder(a: string, b: string): boolean {
  return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);
}

/**
 * Whether `candidate` names a network location or a device rather than a file on Windows: a UNC or device path
 * (two leading separators of either kind), or a path component whose stem (the text up to the first "." or
 * ":", trailing spaces and dots dropped, as Win32 reads it) is a DOS device name. Resolving such a path on
 * Windows connects to the named host or opens the device, so it is refused before anything touches the
 * filesystem. On every other platform these are ordinary names (`aux/notes.txt`, `con.pdf`) and this is false.
 * Like the rest of this module, the answer is for the host this process runs on.
 */
function namesNetworkOrDevice(candidate: string): boolean {
  if (process.platform !== 'win32') return false;
  return (
    UNC_OR_DEVICE_PATH_RE.test(candidate) ||
    candidate
      .split(/[\\/:]/)
      .some((part) => DOS_DEVICE_NAME_RE.test((part.split(/[.:]/, 1)[0] ?? '').replace(/[ .]+$/, '')))
  );
}

/** Whether `candidate` resolves to `root` or a descendant of it. Both sides may be not-yet-existing. */
export async function resolvesUnder(candidate: string, root: string): Promise<boolean> {
  // realpathLenient refuses a path it cannot resolve (a dangling symlink or a cycle) by throwing the
  // upload refusal. This is a predicate, and its callers are not the upload gate, so a path that will
  // not resolve is not under the root, and neither is one that names a network location or a device.
  if (namesNetworkOrDevice(candidate)) return false;
  try {
    return sameOrUnder(comparable(await realpathLenient(candidate)), comparable(await realpathLenient(root)));
  } catch {
    return false;
  }
}

/**
 * Default-deny upload allowlist: resolves to the real path when it is one of `roots` or below one by whole path
 * components, with symlinks resolved on both sides, and rejects with `UploadRefusedError` otherwise. The refusal
 * never lists the roots. Empty `roots` refuses everything. A root that does not exist on disk grants
 * nothing. A `..` component (and, on Windows, a UNC path or a DOS device name) is refused outright, before the
 * filesystem is touched. A dangling symlink or a symlink cycle under a root is refused rather than judged by its
 * target. Upload the returned path, not the argument.
 */
export async function betaCheckUploadPath(candidate: string, roots: Iterable<string>): Promise<string> {
  if (candidate === '' || candidate.includes('\0')) {
    throw new UploadRefusedError('file_upload path is empty or contains a NUL byte');
  }
  if (candidate.length > MAX_UPLOAD_PATH_LENGTH) {
    throw new UploadRefusedError('file_upload path is too long');
  }

  if (typeof roots === 'string') {
    // `Iterable<string>` is satisfied by a bare string, whose iteration yields characters: the
    // "/" element resolves to a parent of every absolute path and would approve everything.
    throw new ToolsetConfigError('roots must be a list of paths, not a single path');
  }

  // An empty entry is not "the current directory is a root": `path.resolve('')` is the cwd, so a blank
  // root (an empty env var split on ",") would open the whole working tree.
  const rootList = [...roots].filter((r) => r.trim() !== '');
  if (rootList.length === 0) throw new UploadRefusedError(NO_UPLOAD_ROOTS);

  // Refused before anything touches the filesystem, on Windows only: there, resolving a UNC path makes the
  // redirector connect to the named host with the user's credentials (a forced-auth leak) even
  // though the path is then refused, and a DOS device name (CON, COM1, NUL.txt) fails the
  // existence probe, is re-appended as a not-yet-existing tail under the root, and then opens the
  // device rather than a file.
  if (namesNetworkOrDevice(candidate)) {
    throw new UploadOutsideRootsError();
  }

  // An upload path is model output (the deployer supplies the roots, the model the path), so a `..`
  // component is never legitimate, and it is where a lexical `..` collapse can disagree with symlink
  // resolution. Refuse it outright before resolving.
  if (candidate.split(/[\\/]/).includes('..')) {
    throw new UploadRefusedError("file_upload path must not contain a '..' component");
  }

  // Decided on the text first: a path that does not claim to be under an upload root is refused without
  // touching the filesystem, so the model cannot make the SDK stat or resolve a path of its choosing (an existence
  // probe, an automounted share). A path that does claim to be under a root is still resolved and compared below,
  // so a symlink inside the root cannot lead out of it.
  const claimed = await Promise.all(rootList.map((root) => lexicallyUnder(path.resolve(candidate), root)));
  if (!claimed.includes(true)) {
    throw new UploadOutsideRootsError();
  }

  const resolved = await realpathLenient(candidate);
  if (namesNetworkOrDevice(resolved)) {
    // On Windows, resolving a link to a share has already connected to its host with the user's credentials.
    // Screening the resolved path refuses the upload, but it cannot undo that connection.
    throw new UploadOutsideRootsError();
  }

  for (const root of rootList) {
    let resolvedRoot: string;
    try {
      resolvedRoot = await fs.promises.realpath(path.resolve(root));
    } catch {
      continue;
    }
    if (sameOrUnder(comparable(resolved), comparable(resolvedRoot))) return resolved;
  }

  throw new UploadOutsideRootsError();
}

function conflicts(downloadDir: string, uploadRoots: readonly string[]): boolean {
  // The download-then-upload loop: a page-triggered download written to an upload root is readable back through
  // file_upload. Compared on the anchored paths as written: the constructor cannot wait for a promise, and following
  // symlinks here would need a second, synchronous copy of the resolver. Letter case and the Unicode form of a name
  // are ignored on every platform, since a macOS disk ignores both by default.
  const nests = (a: string, b: string) => sameOrUnder(a, b) || sameOrUnder(b, a);
  const literal = downloadDir.toLowerCase().normalize('NFC');
  return uploadRoots.some((root) => nests(literal, root.toLowerCase().normalize('NFC')));
}

/**
 * Refuses a configured directory that is, or sits under, a link that does not resolve (dangling, or in a cycle): the
 * overlap check compares paths as written, so such a path would pass it now and be followed later. Walks up to the
 * first part that `lstat` finds, then asks `existsSync`, which follows links. No resolver is needed. Only `ENOENT`
 * means "does not exist, go up": any other `lstat` error (`EACCES`, `ENOTDIR`) refuses the path, since a part that
 * cannot be inspected could be hiding a broken link.
 */
function assertResolves(dir: string, option: string): void {
  const refused = () =>
    new ToolsetConfigError(`${option} does not resolve on disk (a dangling symlink or a cycle)`);
  let current = dir;
  for (;;) {
    try {
      fs.lstatSync(current);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw refused();
      const parent = path.dirname(current);
      if (parent === current) return;
      current = parent;
    }
  }
  if (!fs.existsSync(current)) throw refused();
}

export interface BetaNodeFilePolicyOptions {
  /** `file_upload` may read paths under these directories. Empty (the default) refuses every path. */
  uploadRoots?: readonly string[] | undefined;
  /**
   * Where the driver writes downloads. Exposed paths must resolve under it. Its overlap with the upload roots is
   * compared on the paths as written, ignoring letter case, so a `downloadDir` that is, or sits under, a working
   * symlink into an upload root is not caught, nor is an upload root that links into `downloadDir`. A link that
   * does not resolve is refused.
   */
  downloadDir?: string | undefined;
  /** Default false: download paths never reach the model. Has no effect without `downloadDir`. */
  exposeDownloadPaths?: boolean | undefined;
  /** Document ids (files staged with the Files API) `file_upload` may name. Empty (the default) refuses every id. */
  uploadDocumentIds?: readonly string[] | undefined;
}

/**
 * The file policy the SDK ships: `file_upload` may read paths under `uploadRoots` (symlinks resolved,
 * whole components compared, a `..` component refused outright) and may name the document ids listed in
 * `uploadDocumentIds` (none by default), and a `download_completed` path reaches the model only with
 * `exposeDownloadPaths: true` and only when it lies inside `downloadDir`.
 *
 * Keep the roots to one dedicated directory holding only the task's files, and put `downloadDir`
 * outside every upload root and outside anything another tool can reach. The driver decides where
 * downloads are written, and this object only decides what the model may see.
 */
export class BetaNodeFilePolicy implements BetaFilePolicy {
  readonly uploadRoots: readonly string[];
  readonly downloadDir: string | undefined;
  readonly exposeDownloadPaths: boolean;
  readonly uploadDocumentIds: ReadonlySet<string>;

  constructor(options: BetaNodeFilePolicyOptions = {}) {
    const roots = options.uploadRoots ?? [];
    if (roots.some((root) => root.trim() === '')) {
      // Anchoring an empty entry would silently make it the working directory.
      throw new ToolsetConfigError('uploadRoots entries must be non-empty strings');
    }

    if (options.downloadDir !== undefined && !options.downloadDir.trim()) {
      throw new ToolsetConfigError('downloadDir must be a non-empty string');
    }

    // Anchored once, here: re-resolving a relative root against the working directory at check time
    // would move the containment boundary.
    this.uploadRoots = roots.map((root) => path.resolve(root));
    this.downloadDir = options.downloadDir === undefined ? undefined : path.resolve(options.downloadDir);
    this.exposeDownloadPaths = options.exposeDownloadPaths === true;

    this.uploadDocumentIds = new Set(options.uploadDocumentIds ?? []);

    // A configured directory that exists but will not resolve (a dangling link, a cycle) is refused now rather than
    // granting nothing (a root) or skipping the overlap check (downloadDir) and following the link later.
    for (const root of this.uploadRoots) assertResolves(root, 'an uploadRoots entry');
    if (this.downloadDir !== undefined) assertResolves(this.downloadDir, 'downloadDir');
    if (this.downloadDir !== undefined && conflicts(this.downloadDir, this.uploadRoots)) {
      throw new ToolsetConfigError(
        'downloadDir must be outside every upload root, otherwise a page-triggered download landing in an upload root can be read back through file_upload',
      );
    }
  }

  async resolveUploadPaths(_ctx: BetaURLContext, paths: string[]): Promise<string[]> {
    const resolved: string[] = [];
    for (const p of paths) resolved.push(await betaCheckUploadPath(p, this.uploadRoots));
    return resolved;
  }

  resolveUploadDocuments(_ctx: BetaURLContext, documentIds: string[]): string[] {
    for (const id of documentIds) {
      // The refusal contains neither the id nor a count, so a steering page cannot learn which ids exist.
      if (!this.uploadDocumentIds.has(id))
        throw new UploadRefusedError('document not in the upload allowlist');
    }
    return [...documentIds];
  }

  async isPathVisible(candidate: string): Promise<boolean> {
    if (!this.exposeDownloadPaths || this.downloadDir === undefined) return false;
    // Decided on the text alone first: a path that does not claim to be under the download directory is never
    // resolved, so a page cannot make the SDK stat a path of its choosing (an automounted share, an existence probe)
    // by getting it into a download event or an error message.
    if (candidate.split(/[\\/]/).includes('..')) return false;
    if (!(await lexicallyUnder(candidate, this.downloadDir))) return false;
    // Outside the quarantine directory through a symlink: the event still reaches the model, without the path.
    return resolvesUnder(candidate, this.downloadDir);
  }
}

/** Whether `candidate`, normalised as text, is `directory` (as written or as it resolves) or below it. */
async function lexicallyUnder(candidate: string, directory: string): Promise<boolean> {
  const text = comparable(path.normalize(candidate));
  const bases = new Set([directory]);

  try {
    bases.add(await realpathLenient(directory));
  } catch {
    // compared as written only
  }

  for (const base of bases) {
    const folded = comparable(path.normalize(base)).replace(/[\\/]+$/, '');
    if (text === folded || text.startsWith(folded + path.sep)) return true;
  }

  return false;
}
