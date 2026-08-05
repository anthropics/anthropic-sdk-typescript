import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { extractSkillArchive } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { findExecutable } from '@anthropic-ai/sdk/tools/agent-toolset/exec';

const describePosix = process.platform === 'win32' ? describe.skip : describe;

/**
 * Skill version archives are packaged wrapped in a single directory named
 * after the skill (e.g. `pdf/SKILL.md`). Extraction must strip that wrapper so
 * files land at `dest/SKILL.md`, not the doubled `dest/pdf/SKILL.md` the
 * agent's skill discovery does not find. It must also still refuse zip-slip.
 */
describe('extractSkillArchive', () => {
  let work: string;

  beforeEach(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'skilltest-'));
  });
  afterEach(() => {
    fs.rmSync(work, { recursive: true, force: true });
  });

  /** Lay out `files` under a temp tree, then pack it with the given CLI. */
  function pack(kind: 'zip' | 'targz', files: Record<string, string>): Buffer {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'skillsrc-'));
    try {
      for (const [rel, body] of Object.entries(files)) {
        const p = path.join(src, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body);
      }
      const archive = path.join(work, `a.${kind === 'zip' ? 'zip' : 'tgz'}`);
      if (kind === 'zip') {
        execFileSync('zip', ['-rq', archive, '.'], { cwd: src });
      } else {
        execFileSync('tar', ['-czf', archive, '-C', src, '.']);
      }
      const buf = fs.readFileSync(archive);
      fs.rmSync(archive, { force: true });
      return buf;
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  }

  async function extractInto(buf: Buffer, dest: string): Promise<void> {
    await fsp.mkdir(dest, { recursive: true });
    await extractSkillArchive(new Response(buf), dest);
  }

  for (const kind of ['zip', 'targz'] as const) {
    test(`${kind}: strips the skill wrapper directory (no doubling)`, async () => {
      const buf = pack(kind, {
        'pdf/SKILL.md': '# PDF',
        'pdf/scripts/run.py': 'print(1)',
      });
      const dest = path.join(work, 'skills', 'pdf');
      await extractInto(buf, dest);

      expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# PDF');
      expect(fs.readFileSync(path.join(dest, 'scripts', 'run.py'), 'utf8')).toBe('print(1)');
      expect(fs.existsSync(path.join(dest, 'pdf'))).toBe(false);
    });

    test(`${kind}: flat archive (no wrapper) extracts unchanged`, async () => {
      const buf = pack(kind, { 'SKILL.md': '# flat', 'scripts/run.py': 'x' });
      const dest = path.join(work, 'skills', 'flat');
      await extractInto(buf, dest);
      expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# flat');
      expect(fs.readFileSync(path.join(dest, 'scripts', 'run.py'), 'utf8')).toBe('x');
    });
  }

  test('refuses a zip-slip member', async () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'evil-'));
    const archive = path.join(work, 'evil.zip');
    try {
      fs.writeFileSync(path.join(src, 'escape.txt'), 'pwned');
      execFileSync('zip', ['-q', archive, 'escape.txt'], { cwd: src });
      // Rewrite the entry name to a traversal path via zipnote.
      execFileSync('zipnote', ['-w', archive], { input: '@ escape.txt\n@=../escape.txt\n' });

      const dest = path.join(work, 'skills', 'x');
      await fsp.mkdir(dest, { recursive: true });
      await expect(extractSkillArchive(new Response(fs.readFileSync(archive)), dest)).rejects.toThrow(
        /unsafe archive member/,
      );
      expect(fs.existsSync(path.join(work, 'skills', 'escape.txt'))).toBe(false);
      expect(fs.existsSync(path.join(work, 'escape.txt'))).toBe(false);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });
});

/**
 * HackerOne #3901184 regression. `tar`/`unzip` are resolved from the absolute
 * entries of PATH only and run by absolute path: an executable `tar`/`unzip`
 * planted in the working directory — with `.`, empty and relative entries at
 * the front of PATH — must never run. With no real tool reachable the
 * extraction fails with a clear "not found" error instead of falling back to a
 * bare-name spawn; with the real tool on an absolute entry, that one runs.
 */
describePosix('extractSkillArchive helper resolution', () => {
  let work: string;
  let plant: string;
  let marker: string;
  let savedCwd: string;
  let savedPath: string | undefined;

  beforeEach(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'skilltest-'));
    plant = fs.mkdtempSync(path.join(os.tmpdir(), 'skillplant-'));
    marker = path.join(plant, 'planted-tool-ran');
    // The plants record that they ran, so the tests can prove they never did.
    fs.mkdirSync(path.join(plant, 'bin'));
    for (const rel of ['tar', 'unzip', 'bin/tar', 'bin/unzip']) {
      fs.writeFileSync(path.join(plant, rel), `#!/bin/sh\ntouch '${marker}'\n`);
      fs.chmodSync(path.join(plant, rel), 0o755);
    }
    savedCwd = process.cwd();
    savedPath = process.env['PATH'];
    process.chdir(plant);
  });
  afterEach(() => {
    process.chdir(savedCwd);
    if (savedPath === undefined) delete process.env['PATH'];
    else process.env['PATH'] = savedPath;
    fs.rmSync(work, { recursive: true, force: true });
    fs.rmSync(plant, { recursive: true, force: true });
  });

  test.each([
    ['tar', 'definitely not a zip, so handled as tar'],
    ['unzip', 'PK\x03\x04 sniffed as a zip'],
  ])(
    'a %s planted in the working directory never runs; a missing tool is a clear error',
    async (tool, body) => {
      process.env['PATH'] = ['.', '', 'bin', './bin'].join(path.delimiter);
      const dest = path.join(work, 'skills', 'x');
      await fsp.mkdir(dest, { recursive: true });

      await expect(extractSkillArchive(new Response(body), dest)).rejects.toThrow(
        new RegExp(
          `requires the \`${tool}\` command, but it was not found on PATH \\(only absolute PATH entries`,
        ),
      );
      expect(fs.existsSync(marker)).toBe(false);
    },
  );

  test('with "." ahead of it on PATH, the real tar from an absolute entry is still the one that runs', async () => {
    const realTar = await findExecutable('tar');
    expect(realTar).not.toBeNull();
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'skillsrc-'));
    try {
      fs.mkdirSync(path.join(src, 'pdf'));
      fs.writeFileSync(path.join(src, 'pdf', 'SKILL.md'), '# PDF');
      // Uncompressed, so the outcome depends on `tar` alone (a .tgz would have
      // tar look up `gzip` through the PATH it inherits).
      const archive = path.join(work, 'a.tar');
      execFileSync(realTar!, ['-cf', archive, '-C', src, '.']);

      process.env['PATH'] = ['.', '', 'bin', path.dirname(realTar!)].join(path.delimiter);
      const dest = path.join(work, 'skills', 'pdf');
      await fsp.mkdir(dest, { recursive: true });
      await extractSkillArchive(new Response(fs.readFileSync(archive)), dest);

      expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# PDF');
      expect(fs.existsSync(marker)).toBe(false);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });
});
