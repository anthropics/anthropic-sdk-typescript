/**
 * Node-only skill plumbing for the agent toolset: downloading a session
 * agent's skills into the workdir and extracting the archives. Kept in its own
 * file because it is a distinct concern from the tool implementations in
 * `node.ts` — distinct enough, and large enough, to review on its own.
 */

import * as fs from 'node:fs/promises';
import * as fssync from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AnthropicError } from '../../core/error';
import { loggerFor } from '../../internal/utils/log';
import { DIR_CREATE_MODE, errnoCode } from './fs-util';
import type { AgentToolContext } from './node';

const execFileAsync = promisify(execFile);

/**
 * Download the session agent's skills into `{ctx.workdir}/skills/<name>/`.
 *
 * No-op (returns a no-op cleanup) unless `ctx.client` is set together with
 * `ctx.session` (or the deprecated `ctx.sessionId`). Reads the resolved agent
 * off the session and, for each skill, fetches its files via
 * `client.beta.skills.versions.download` and extracts the archive (a zip or
 * tar.* archive) into a directory named after the skill. A failure on one skill
 * is logged and does not block the others. Call this before starting the
 * session tool runner (e.g. right after the bash session / workdir is ready).
 *
 * Pass `ctx.session`. A session's resources cannot change while it runs, so the
 * caller fetches it once and shares that snapshot with the memory-store
 * download — the two can then never disagree about the attached resources.
 *
 * `ctx.sessionId` is deprecated: it costs an extra `sessions.retrieve` round
 * trip on every call, and a caller that uses it for both this and the
 * memory-store download fetches the session twice. It remains supported for
 * callers written before `session` existed.
 *
 * Returns a cleanup function that removes the skill directories this call
 * created — call it once the work item is done so downloaded skills do not
 * accumulate in the workdir across sessions.
 */
export async function setupSkills(ctx: AgentToolContext): Promise<() => Promise<void>> {
  const { client, sessionId } = ctx;
  if (!client) return async () => {};
  const log = loggerFor(client);
  let session = ctx.session;
  if (!session) {
    if (sessionId === undefined) return async () => {};
    log.warn(
      'AgentToolContext.sessionId is deprecated and costs an extra session fetch; ' +
        'fetch the session once and set `session` instead',
      { component: 'agent-tool-context' },
    );
    // The sessions/skills resources inject their anthropic-beta headers
    // (managed-agents / skills) themselves — no need to pass `betas` here.
    session = await client.beta.sessions.retrieve(sessionId);
  }
  const skillsRoot = path.resolve(ctx.workdir, 'skills');
  const created: string[] = [];
  for (const skill of session.agent.skills) {
    try {
      const version = await client.beta.skills.versions.retrieve(skill.version, { skill_id: skill.skill_id });
      // The directory is the skill's name, reduced to a single safe path
      // component so a hostile name can't escape `skillsRoot`.
      let dirname = path.basename(version.name.trim());
      if (dirname === '' || dirname === '.' || dirname === '..') dirname = skill.skill_id;
      const dest = path.resolve(skillsRoot, dirname);
      if (dest !== skillsRoot && !dest.startsWith(skillsRoot + path.sep)) {
        log.warn('skill name escapes the skills dir; skipping', {
          component: 'agent-tool-context',
          name: version.name,
        });
        continue;
      }
      // `skill.version` may be the alias `"latest"`, which only the retrieve
      // endpoint resolves; download by the concrete id it returned.
      const resp = await client.beta.skills.versions.download(version.id, { skill_id: skill.skill_id });
      await fs.rm(dest, { recursive: true, force: true });
      await fs.mkdir(dest, { recursive: true, mode: DIR_CREATE_MODE });
      created.push(dest);
      await extractSkillArchive(resp, dest);
      log.info('downloaded skill', {
        component: 'agent-tool-context',
        skill_id: skill.skill_id,
        version: version.id,
        dest,
      });
    } catch (e) {
      log.warn('failed to download skill', {
        component: 'agent-tool-context',
        skill_id: skill.skill_id,
        error: String(e),
      });
    }
  }
  return async () => {
    for (const dest of created) {
      await fs.rm(dest, { recursive: true, force: true }).catch((e) => {
        log.warn('failed to clean up skill', { component: 'agent-tool-context', dest, error: String(e) });
      });
    }
  };
}

/** Reject archive members that are absolute or contain a `..` component. */
function assertSafeMemberNames(names: string[]): void {
  for (const raw of names) {
    const entry = raw.trim();
    if (!entry) continue;
    if (path.isAbsolute(entry) || entry.split(/[\\/]/).includes('..')) {
      throw new AnthropicError(`refusing to extract unsafe archive member: ${entry}`);
    }
  }
}

const INCONSISTENT_LISTING = 'skill archive listing is inconsistent; refusing to extract';

/**
 * Type chars (first byte of each `ls`-style line from `unzip -Z` / `tar -tvf`)
 * that denote a regular file or directory. `zipinfo` prints `?` for entries
 * with no Unix type bits, which `unzip` extracts as regular files; GNU tar
 * prints `C` for contiguous files. Everything else — `l` symlink, `h`
 * hardlink, `b`/`c` device, `p` fifo, `s` socket, unknown tar types — is a
 * special member.
 */
const PLAIN_TYPE_CHARS = { unzip: new Set(['-', 'd', '?']), tar: new Set(['-', 'd', 'C']) };

function listingLines(listing: string): string[] {
  const lines = listing.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * A special member is excluded by handing its listed name back to the CLI as
 * a pattern, so the name must be byte-identical to what is stored. `tar`,
 * `bsdtar` and `unzip` print bytes they cannot show literally as `\ooo`, `^X`
 * or `#U` escapes, or as raw non-ASCII; any such name cannot be excluded
 * reliably. A leading `-` would let `unzip` parse the pattern as an option.
 */
function canExcludeVerbatim(cmd: 'unzip' | 'tar', name: string): boolean {
  return /^[\x20-\x7E]+$/.test(name) && !/[\\^#]/.test(name) && !(cmd === 'unzip' && name.startsWith('-'));
}

/**
 * Pair an archive's name listing (`unzip -Z1` / `tar -tf`) with its typed
 * listing (`unzip -Z --h --t` / `tar -tvf`) and split the members into plain
 * (regular file or directory) and special (everything else). Special members
 * are excluded from extraction rather than rejected; the archive is refused
 * only when the two listings disagree in length or a special member's name
 * cannot be passed back to the CLI verbatim (see {@link canExcludeVerbatim}).
 */
export function classifyArchiveListing(
  cmd: 'unzip' | 'tar',
  names: string,
  typed: string,
): { plain: string[]; special: string[] } {
  const nameLines = listingLines(names);
  const typedLines = listingLines(typed);
  if (nameLines.length !== typedLines.length) throw new AnthropicError(INCONSISTENT_LISTING);
  const plain: string[] = [];
  const special: string[] = [];
  nameLines.forEach((name, i) => {
    if (PLAIN_TYPE_CHARS[cmd].has(typedLines[i]!.charAt(0))) {
      plain.push(name);
      return;
    }
    if (!canExcludeVerbatim(cmd, name)) {
      throw new AnthropicError(
        `refusing to extract archive: cannot safely exclude member ${JSON.stringify(name)}`,
      );
    }
    special.push(name);
  });
  return { plain, special };
}

/**
 * Walk `dir` with `lstat` semantics and reject anything that is not a regular
 * file or directory. Never follows a link and never descends into anything
 * but a real directory.
 */
export async function assertOnlyPlainEntries(dir: string): Promise<void> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) await assertOnlyPlainEntries(path.join(dir, entry.name));
    else if (!entry.isFile()) throw new AnthropicError(INCONSISTENT_LISTING);
  }
}

/**
 * Run an archive CLI (`unzip` for zip archives, `tar` for everything else),
 * returning its stdout. Both binaries must be on `PATH`; a missing one would
 * otherwise surface as an opaque `ENOENT` spawn failure, so it is turned into a
 * clear, specific error naming the missing command.
 */
async function runArchiveTool(cmd: 'unzip' | 'tar', args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args);
    return stdout;
  } catch (e) {
    if (errnoCode(e) === 'ENOENT') {
      throw new AnthropicError(
        `skill extraction requires the \`${cmd}\` command, but it was not found on PATH`,
      );
    }
    throw e;
  }
}

/**
 * The single top-level directory shared by every entry in an archive listing,
 * or `''` if entries don't all live under one common directory. Skill bundles
 * are packaged wrapped in one directory named after the skill (e.g.
 * `pdf/SKILL.md`, `pdf/scripts/...`); the extractor strips it so contents land
 * directly in the skill's dir instead of a redundant nested `<skill>/<skill>/`
 * level. A flat or multi-root archive yields `''`.
 */
function archiveTopDir(names: string[]): string {
  let top: string | undefined;
  let nested = false;
  for (const raw of names) {
    // Drop `.` / empty segments so a `./pdf/...`-style listing (e.g. from
    // `tar -C dir .`) is treated the same as `pdf/...`.
    const parts = raw
      .trim()
      .split('/')
      .filter((p) => p !== '' && p !== '.');
    if (parts.length === 0) continue;
    const first = parts[0]!;
    if (top === undefined) top = first;
    else if (first !== top) return '';
    if (parts.length > 1) nested = true;
  }
  return top !== undefined && nested ? top : '';
}

/**
 * Extract a skill download (a zip or tar.* archive) into `dest`. Streams the
 * response body straight to a temp file beside `dest` (so the whole archive is
 * never buffered in memory — skills can contain large binaries), then shells out
 * to `unzip`/`tar` — consistent with the rest of the toolset, which already
 * invokes `bash` and `rg`. Both `unzip` and `tar` must be available on `PATH`; a
 * missing binary surfaces as a clear error (see {@link runArchiveTool}). Refuses
 * any member that would escape `dest` (zip-slip / tar-slip): skill archives
 * come from the API, but skills can be third-party. Members that are not a
 * regular file or directory (symlink, hardlink, device, fifo) are excluded
 * from extraction rather than rejected; an archive whose special members
 * cannot be excluded reliably is refused (see {@link classifyArchiveListing}).
 * `tar` matches exclusions unanchored, so a plain member sharing a special
 * member's name may be dropped too. The staging tree is verified to hold only
 * regular files and directories before anything is promoted into `dest`.
 *
 * The skill bundle's single wrapper directory is stripped: the archive is
 * extracted into a staging dir and the wrapper's contents are promoted into
 * `dest`, so files land at `dest/SKILL.md` rather than a doubled
 * `dest/<skill>/SKILL.md` (`unzip` has no `--strip-components`, so this is
 * done uniformly by staging + promote rather than per-tool flags).
 */
export async function extractSkillArchive(resp: Response, dest: string): Promise<void> {
  const tmp = path.join(dest, `.skill-archive-${process.pid}-${Date.now()}`);
  if (!resp.body) {
    throw new AnthropicError('skill download response had no body');
  }
  await pipeline(
    Readable.fromWeb(resp.body as Parameters<typeof Readable.fromWeb>[0]),
    fssync.createWriteStream(tmp),
  );
  const stage = path.join(path.dirname(dest), `.skill-stage-${process.pid}-${Date.now()}`);
  const excludeFile = path.join(path.dirname(dest), `.skill-exclude-${process.pid}-${Date.now()}`);
  try {
    // Sniff the first bytes: zip archives start with "PK\x03\x04"; treat
    // anything else as a tar.* archive (`tar -xf` autodetects gzip/bzip2/xz).
    const head = await readHead(tmp, 4);
    const isZip =
      head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
    const archiveCmd = isZip ? 'unzip' : 'tar';
    // List first, validate, then extract — `tar`/`unzip` will happily write a
    // `../` member (or follow a symlink member) outside `-C`/`-d` otherwise.
    const names = await runArchiveTool(archiveCmd, isZip ? ['-Z1', tmp] : ['-tf', tmp]);
    const typed = await runArchiveTool(archiveCmd, isZip ? ['-Z', '--h', '--t', tmp] : ['-tvf', tmp]);
    const { plain, special } = classifyArchiveListing(archiveCmd, names, typed);
    assertSafeMemberNames([...plain, ...special]);
    const top = archiveTopDir(plain);
    await fs.mkdir(stage, { recursive: true, mode: DIR_CREATE_MODE });
    // `unzip` exits non-zero when every member is excluded, so only run the
    // extractor when there is something to extract.
    if (plain.length > 0) {
      await runArchiveTool(archiveCmd, await extractArgs(archiveCmd, tmp, stage, special, excludeFile));
    }
    await assertOnlyPlainEntries(stage);
    // Promote the wrapper's contents (or the staged tree itself, if the
    // archive wasn't wrapped) into the already-created empty `dest`. `stage`
    // is a sibling of `dest`, so each rename stays on one filesystem.
    const srcRoot = top ? path.join(stage, top) : stage;
    const entries = await fs.readdir(srcRoot).catch((e: unknown) => {
      throw errnoCode(e) === 'ENOENT' ? new AnthropicError(INCONSISTENT_LISTING) : e;
    });
    for (const entry of entries) {
      await fs.rename(path.join(srcRoot, entry), path.join(dest, entry));
    }
  } finally {
    await fs.rm(tmp, { force: true });
    await fs.rm(excludeFile, { force: true });
    await fs.rm(stage, { recursive: true, force: true });
  }
}

/**
 * Arguments that extract `archive` into `stage` while excluding every member
 * in `special`. Names are glob-escaped because both CLIs treat exclusions as
 * patterns; `tar` reads them from `excludeFile`, `unzip` takes them after
 * `-x`, which must follow `-d` so no pattern is parsed as an option.
 */
async function extractArgs(
  cmd: 'unzip' | 'tar',
  archive: string,
  stage: string,
  special: string[],
  excludeFile: string,
): Promise<string[]> {
  const patterns = special.map((name) => name.replace(/[*?[\\]/g, '\\$&'));
  if (cmd === 'unzip') {
    return ['-oq', archive, '-d', stage, ...(patterns.length > 0 ? ['-x', ...patterns] : [])];
  }
  if (patterns.length === 0) return ['-xf', archive, '-C', stage];
  await fs.writeFile(excludeFile, patterns.join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  return ['-xf', archive, '-C', stage, '-X', excludeFile];
}

/** Read the first `n` bytes of `file`. */
async function readHead(file: string, n: number): Promise<Buffer> {
  const handle = await fs.open(file, 'r');
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await handle.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
