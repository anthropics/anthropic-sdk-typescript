import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { extractSkillArchive } from '@anthropic-ai/sdk/tools/agent-toolset/node';

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
