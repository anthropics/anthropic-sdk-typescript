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
import type { Anthropic } from '../../client';
import { AnthropicError } from '../../core/error';
import { loggerFor } from '../../internal/utils/log';
import { DIR_CREATE_MODE } from './fs-util';
import type { AgentToolContext } from './node';

const execFileAsync = promisify(execFile);

/**
 * Download the session agent's skills into `{ctx.workdir}/skills/<name>/`.
 *
 * No-op (returns a no-op cleanup) unless both `ctx.client` and `ctx.sessionId`
 * are set. Looks up the session's resolved agent and, for each skill, fetches
 * its files via `client.beta.skills.versions.download` and extracts the archive
 * (a zip or tar.* archive) into a directory named after the skill. A failure on
 * one skill is logged and does not block the others. Call this before starting
 * the session tool runner (e.g. right after the bash session / workdir is
 * ready).
 *
 * Returns a cleanup function that removes the skill directories this call
 * created — call it once the work item is done so downloaded skills do not
 * accumulate in the workdir across sessions.
 */
export async function setupSkills(ctx: AgentToolContext): Promise<() => Promise<void>> {
  const { client, sessionId } = ctx;
  if (!client || !sessionId) return async () => {};
  const log = loggerFor(client);
  const session = await client.beta.sessions.retrieve(sessionId);
  const skillsRoot = path.resolve(ctx.workdir, 'skills');
  const created: string[] = [];
  for (const skill of session.agent.skills) {
    try {
      const versionId = await resolveSkillVersion(client, skill.skill_id, skill.version);
      const version = await client.beta.skills.versions.retrieve(versionId, { skill_id: skill.skill_id });
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
      const resp = await client.beta.skills.versions.download(versionId, { skill_id: skill.skill_id });
      await fs.rm(dest, { recursive: true, force: true });
      await fs.mkdir(dest, { recursive: true, mode: DIR_CREATE_MODE });
      created.push(dest);
      await extractSkillArchive(resp, dest);
      log.info('downloaded skill', {
        component: 'agent-tool-context',
        skill_id: skill.skill_id,
        version: versionId,
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

/**
 * Resolve `version` to the concrete numeric timestamp the
 * `/v1/skills/{id}/versions/{version}` endpoints require — `session.agent.skills[].version`
 * can be an alias such as `"latest"`, which those endpoints reject. Numeric
 * versions pass through unchanged.
 */
export async function resolveSkillVersion(
  client: Anthropic,
  skillId: string,
  version: string,
): Promise<string> {
  if (/^\d+$/.test(version)) return version;
  let newest: string | undefined;
  for await (const v of client.beta.skills.versions.list(skillId)) {
    if (/^\d+$/.test(v.version) && (newest === undefined || BigInt(v.version) > BigInt(newest))) {
      newest = v.version;
    }
  }
  if (newest === undefined) {
    throw new AnthropicError(
      `skill ${JSON.stringify(skillId)} has no concrete version to resolve ${JSON.stringify(
        version,
      )} against`,
    );
  }
  return newest;
}

/** Reject archive members that are absolute or contain a `..` component. */
function assertSafeMemberNames(names: string): void {
  for (const raw of names.split('\n')) {
    const entry = raw.trim();
    if (!entry) continue;
    if (path.isAbsolute(entry) || entry.split(/[\\/]/).includes('..')) {
      throw new AnthropicError(`refusing to extract unsafe archive member: ${entry}`);
    }
  }
}

/**
 * Reject archives that contain anything other than regular files and
 * directories. The type char is the first byte of each `ls`-style line emitted
 * by `tar -tvf` / `unzip -Z`: `-` file, `d` dir, `l` symlink, `h` hardlink,
 * `b`/`c` device, `p` fifo, `s` socket. A symlink/hardlink member is how an
 * archive escapes its extraction dir even when no name contains `..`.
 */
function assertNoSpecialMembers(verboseListing: string): void {
  for (const line of verboseListing.split('\n')) {
    const type = line.trimStart()[0];
    if (type === 'l' || type === 'h' || type === 'b' || type === 'c' || type === 'p' || type === 's') {
      throw new AnthropicError('refusing to extract archive with symlink/hardlink/device member');
    }
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
    if (e != null && typeof e === 'object' && (e as { code?: unknown }).code === 'ENOENT') {
      throw new AnthropicError(
        `skill extraction requires the \`${cmd}\` command, but it was not found on PATH`,
      );
    }
    throw e;
  }
}

/**
 * The single top-level directory shared by every entry in a newline-separated
 * archive listing, or `''` if entries don't all live under one common
 * directory. Skill bundles are packaged wrapped in one directory named after
 * the skill (e.g. `pdf/SKILL.md`, `pdf/scripts/...`); the extractor strips it
 * so contents land directly in the skill's dir instead of a redundant nested
 * `<skill>/<skill>/` level. A flat or multi-root archive yields `''`.
 */
function archiveTopDir(listing: string): string {
  let top: string | undefined;
  let nested = false;
  for (const raw of listing.split('\n')) {
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
 * any member that would escape `dest` (zip-slip / tar-slip), including
 * symlink/hardlink members: skill archives come from the API, but skills can be
 * third-party.
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
  try {
    // Sniff the first bytes: zip archives start with "PK\x03\x04"; treat
    // anything else as a tar.* archive (`tar -xf` autodetects gzip/bzip2/xz).
    const head = await readHead(tmp, 4);
    const isZip =
      head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
    const archiveCmd = isZip ? 'unzip' : 'tar';
    // List first, validate, then extract — `tar`/`unzip` will happily write a
    // `../` member (or follow a symlink member) outside `-C`/`-d` otherwise.
    const listing = await runArchiveTool(archiveCmd, isZip ? ['-Z1', tmp] : ['-tf', tmp]);
    assertSafeMemberNames(listing);
    assertNoSpecialMembers(await runArchiveTool(archiveCmd, isZip ? ['-Z', tmp] : ['-tvf', tmp]));
    const top = archiveTopDir(listing);
    await fs.mkdir(stage, { recursive: true, mode: DIR_CREATE_MODE });
    await runArchiveTool(archiveCmd, isZip ? ['-oq', tmp, '-d', stage] : ['-xf', tmp, '-C', stage]);
    // Promote the wrapper's contents (or the staged tree itself, if the
    // archive wasn't wrapped) into the already-created empty `dest`. `stage`
    // is a sibling of `dest`, so each rename stays on one filesystem.
    const srcRoot = top ? path.join(stage, top) : stage;
    for (const entry of await fs.readdir(srcRoot)) {
      await fs.rename(path.join(srcRoot, entry), path.join(dest, entry));
    }
  } finally {
    await fs.rm(tmp, { force: true });
    await fs.rm(stage, { recursive: true, force: true });
  }
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
