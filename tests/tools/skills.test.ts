import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { betaWriteTool, extractSkillArchive, setupSkills } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { assertOnlyPlainEntries, classifyArchiveListing } from '@anthropic-ai/sdk/tools/agent-toolset/skills';
import { promiseWithResolvers } from '@anthropic-ai/sdk/internal/utils/promise';
import type { BetaManagedAgentsSession } from '@anthropic-ai/sdk/resources/beta/sessions/sessions';

const testPosix = process.platform === 'win32' ? test.skip : test;
const describePosix = process.platform === 'win32' ? describe.skip : describe;

const S_IFLNK = 0o120000;
const S_IFIFO = 0o010000;
const S_IFREG = 0o100000;
const S_IFDIR = 0o040000;

interface TarEntry {
  name: string;
  /** ustar typeflag: '0' file, '\0' old file, '1' hardlink, '2' symlink, '3' char, '5' dir, '6' fifo, '7' contiguous, 'g' pax global. */
  type: string;
  body?: string;
  mode?: number;
  linkname?: string;
}

/** Minimal ustar writer, enough to set any typeflag and linkname. */
function makeTar(entries: TarEntry[]): Buffer {
  const octal = (n: number, width: number) => n.toString(8).padStart(width - 1, '0') + '\0';
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const body = Buffer.from(e.body ?? '', 'utf8');
    const h = Buffer.alloc(512, 0);
    h.write(e.name, 0, 100, 'utf8');
    h.write(octal(e.mode ?? 0o644, 8), 100, 8, 'ascii');
    h.write(octal(0, 8), 108, 8, 'ascii');
    h.write(octal(0, 8), 116, 8, 'ascii');
    h.write(octal(body.length, 12), 124, 12, 'ascii');
    h.write(octal(0, 12), 136, 12, 'ascii');
    h.write('        ', 148, 8, 'ascii');
    h.write(e.type, 156, 1, 'latin1');
    h.write(e.linkname ?? '', 157, 100, 'utf8');
    h.write('ustar\0' + '00', 257, 8, 'ascii');
    if (e.type === '3' || e.type === '4') {
      h.write(octal(1, 8), 329, 8, 'ascii');
      h.write(octal(3, 8), 337, 8, 'ascii');
    }
    h.write(
      octal(
        [...h].reduce((a, b) => a + b, 0),
        7,
      ) + ' ',
      148,
      8,
      'ascii',
    );
    blocks.push(h, body, Buffer.alloc((512 - (body.length % 512)) % 512, 0));
  }
  blocks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(blocks);
}

interface ZipEntry {
  name: string;
  body?: string;
  /** `create_system`: 3 = Unix (mode bits in `externalAttr >> 16` are honoured), 0 = FAT. */
  createSystem?: number;
  externalAttr?: number;
}

/** Minimal stored-method zip writer, enough to set create_system and external_attr. */
function makeZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const body = Buffer.from(e.body ?? '', 'utf8');
    const crc = zlib.crc32(body);
    const local = Buffer.alloc(30, 0);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(10, 4);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);
    const central = Buffer.alloc(46, 0);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(((e.createSystem ?? 3) << 8) | 30, 4);
    central.writeUInt16LE(10, 6);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((e.externalAttr ?? (S_IFREG | 0o644) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22, 0);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const zipSymlink = (name: string, target = '/etc/passwd'): ZipEntry => ({
  name,
  body: target,
  createSystem: 3,
  externalAttr: (S_IFLNK | 0o777) << 16,
});

/** Every entry under `root` as `[relative path, lstat type]`, sorted. */
function tree(root: string): Array<[string, 'file' | 'dir' | 'other']> {
  const out: Array<[string, 'file' | 'dir' | 'other']> = [];
  const walk = (dir: string) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.relative(root, path.join(dir, d.name));
      out.push([
        rel,
        d.isFile() ? 'file'
        : d.isDirectory() ? 'dir'
        : 'other',
      ]);
      if (d.isDirectory()) walk(path.join(dir, d.name));
    }
  };
  walk(root);
  return out.sort(([a], [b]) => (a < b ? -1 : 1));
}

/**
 * Skill version archives are packaged wrapped in a single directory named
 * after the skill (e.g. `pdf/SKILL.md`). Extraction must strip that wrapper so
 * files land at `dest/SKILL.md`, not the doubled `dest/pdf/SKILL.md` the
 * agent's skill discovery does not find. It must also still refuse zip-slip,
 * and skip (never materialise) members that are not regular files or
 * directories.
 */
describe('extractSkillArchive', () => {
  let work: string;
  let dest: string;

  beforeEach(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'skilltest-'));
    dest = path.join(work, 'skills', 'pdf');
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

  async function extractInto(buf: Buffer, into: string): Promise<void> {
    await fsp.mkdir(into, { recursive: true });
    await extractSkillArchive(new Response(buf), into);
  }

  for (const kind of ['zip', 'targz'] as const) {
    test(`${kind}: strips the skill wrapper directory (no doubling)`, async () => {
      const buf = pack(kind, {
        'pdf/SKILL.md': '# PDF',
        'pdf/scripts/run.py': 'print(1)',
      });
      await extractInto(buf, dest);

      expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# PDF');
      expect(fs.readFileSync(path.join(dest, 'scripts', 'run.py'), 'utf8')).toBe('print(1)');
      expect(fs.existsSync(path.join(dest, 'pdf'))).toBe(false);
    });

    test(`${kind}: flat archive (no wrapper) extracts unchanged`, async () => {
      const buf = pack(kind, { 'SKILL.md': '# flat', 'scripts/run.py': 'x' });
      const flat = path.join(work, 'skills', 'flat');
      await extractInto(buf, flat);
      expect(fs.readFileSync(path.join(flat, 'SKILL.md'), 'utf8')).toBe('# flat');
      expect(fs.readFileSync(path.join(flat, 'scripts', 'run.py'), 'utf8')).toBe('x');
    });
  }

  testPosix.each([
    ['zip', 'unzip'],
    ['targz', 'tar'],
  ] as const)(
    '%s: does not run %s or gzip from the current directory or the destination',
    async (kind, cmd) => {
      const buf = pack(kind, { 'pdf/SKILL.md': '# PDF' });
      const real = execFileSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).trim();
      const writeScript = (where: string, name: string, script: string) => {
        fs.mkdirSync(path.join(work, where), { recursive: true });
        fs.writeFileSync(path.join(work, where, name), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
      };
      for (const where of ['cwd', path.relative(work, dest)]) {
        writeScript(where, cmd, `: > '${work}/planted-ran'; exit 1`);
        writeScript(where, 'gzip', `: > '${work}/planted-ran'; exit 1`);
      }
      writeScript('system', cmd, `pwd > '${work}/ran-in'; exec '${real}' "$@"`);
      const originalEnv = process.env;
      const originalCwd = process.cwd();
      process.chdir(path.join(work, 'cwd'));
      try {
        process.env = { ...originalEnv, PATH: ['.', ''].join(path.delimiter) };
        await expect(extractInto(buf, dest)).rejects.toThrow(
          `skill extraction requires the \`${cmd}\` command, but it was not found on PATH`,
        );
        process.env = {
          ...originalEnv,
          PATH: ['.', '', path.join(work, 'system'), originalEnv['PATH']].join(path.delimiter),
        };
        await extractInto(buf, dest);
      } finally {
        process.chdir(originalCwd);
        process.env = originalEnv;
      }
      expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# PDF');
      expect(fs.existsSync(path.join(work, 'planted-ran'))).toBe(false);
      expect(fs.readFileSync(path.join(work, 'ran-in'), 'utf8').trim()).toBe(
        fs.realpathSync(path.join(work, 'system')),
      );
    },
  );

  testPosix.each([
    ['zip', 'unzip'],
    ['targz', 'tar'],
  ] as const)('%s: %s does not inherit ANTHROPIC_* credential env vars', async (kind, cmd) => {
    const buf = pack(kind, { 'pdf/SKILL.md': '# PDF' });
    const real = execFileSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).trim();
    const bin = path.join(work, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(
      path.join(bin, cmd),
      `#!/bin/sh\necho "[$ANTHROPIC_API_KEY] [$KEPT]" >> '${work}/saw'\nexec '${real}' "$@"\n`,
      { mode: 0o755 },
    );
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      PATH: [bin, originalEnv['PATH']].join(path.delimiter),
      ANTHROPIC_API_KEY: 'sk-ant-should-not-leak',
      KEPT: 'kept',
    };
    try {
      await extractInto(buf, dest);
    } finally {
      process.env = originalEnv;
    }
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# PDF');
    expect(fs.readFileSync(path.join(work, 'saw'), 'utf8')).toMatch(/^(\[\] \[kept\]\n)+$/);
  });

  test.each(['zip', 'targz'] as const)('%s: extracts into a relative destination', async (kind) => {
    const buf = pack(kind, { 'pdf/SKILL.md': '# PDF' });
    const originalCwd = process.cwd();
    process.chdir(work);
    try {
      await extractInto(buf, 'relative');
    } finally {
      process.chdir(originalCwd);
    }
    expect(fs.readFileSync(path.join(work, 'relative', 'SKILL.md'), 'utf8')).toBe('# PDF');
  });

  test('refuses a zip-slip member', async () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'evil-'));
    const archive = path.join(work, 'evil.zip');
    try {
      fs.writeFileSync(path.join(src, 'escape.txt'), 'pwned');
      execFileSync('zip', ['-q', archive, 'escape.txt'], { cwd: src });
      // Rewrite the entry name to a traversal path via zipnote.
      execFileSync('zipnote', ['-w', archive], { input: '@ escape.txt\n@=../escape.txt\n' });

      const x = path.join(work, 'skills', 'x');
      await fsp.mkdir(x, { recursive: true });
      await expect(extractSkillArchive(new Response(fs.readFileSync(archive)), x)).rejects.toThrow(
        /unsafe archive member/,
      );
      expect(fs.existsSync(path.join(work, 'skills', 'escape.txt'))).toBe(false);
      expect(fs.existsSync(path.join(work, 'escape.txt'))).toBe(false);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  test('tar: symlink, hardlink, fifo and device members are skipped and everything else extracts', async () => {
    const buf = makeTar([
      { name: 'pdf/', type: '5', mode: 0o755 },
      { name: 'pdf/SKILL.md', type: '0', body: '# PDF' },
      { name: 'pdf/scripts/run.sh', type: '0', mode: 0o755, body: 'echo hi' },
      { name: 'pdf/old', type: '\0', body: 'v7' },
      { name: 'pdf/abs', type: '2', linkname: '/etc/passwd' },
      { name: 'pdf/rel', type: '2', linkname: 'SKILL.md' },
      { name: 'pdf/hl', type: '1', linkname: 'pdf/SKILL.md' },
      { name: 'pdf/fifo', type: '6' },
      { name: 'pdf/dev', type: '3' },
    ]);
    await extractInto(buf, dest);

    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# PDF');
    expect(fs.readFileSync(path.join(dest, 'old'), 'utf8')).toBe('v7');
    expect(fs.statSync(path.join(dest, 'scripts', 'run.sh')).mode & 0o777).toBe(0o755);
    for (const skipped of ['abs', 'rel', 'hl', 'fifo', 'dev', 'pdf']) {
      expect(() => fs.lstatSync(path.join(dest, skipped))).toThrow(/ENOENT/);
    }
    expect(tree(work)).toEqual([
      ['skills', 'dir'],
      ['skills/pdf', 'dir'],
      ['skills/pdf/SKILL.md', 'file'],
      ['skills/pdf/old', 'file'],
      ['skills/pdf/scripts', 'dir'],
      ['skills/pdf/scripts/run.sh', 'file'],
    ]);
  });

  test('zip: a Unix-host symlink or fifo entry is skipped, not written out as a file', async () => {
    const buf = makeZip([
      { name: 'pdf/SKILL.md', body: '# PDF' },
      zipSymlink('pdf/lnk'),
      { name: 'pdf/fifo', createSystem: 3, externalAttr: (S_IFIFO | 0o644) << 16 },
    ]);
    await extractInto(buf, dest);
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# PDF');
    expect(() => fs.lstatSync(path.join(dest, 'lnk'))).toThrow(/ENOENT/);
    expect(() => fs.lstatSync(path.join(dest, 'fifo'))).toThrow(/ENOENT/);
  });

  test('zip: symlink type bits on a non-Unix-host entry are data, so the entry is a regular file', async () => {
    const buf = makeZip([
      { name: 'pdf/SKILL.md', body: '# PDF' },
      { ...zipSymlink('pdf/lnk'), createSystem: 0 },
    ]);
    await extractInto(buf, dest);
    expect(fs.lstatSync(path.join(dest, 'lnk')).isFile()).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'lnk'), 'utf8')).toBe('/etc/passwd');
  });

  test('zip: entries with no Unix type bits still extract as files', async () => {
    const buf = makeZip([
      { name: 'pdf/SKILL.md', body: '# PDF', createSystem: 3, externalAttr: 0o755 << 16 },
      { name: 'pdf/notes', body: 'n', createSystem: 3, externalAttr: 0o600 << 16 },
    ]);
    await extractInto(buf, dest);
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# PDF');
    expect(fs.readFileSync(path.join(dest, 'notes'), 'utf8')).toBe('n');
  });

  test('tar: a top-level symlink beside the wrapper does not defeat wrapper stripping', async () => {
    const buf = makeTar([
      { name: 'link', type: '2', linkname: '/tmp' },
      { name: 'pdf/SKILL.md', type: '0', body: '# PDF' },
    ]);
    await extractInto(buf, dest);
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# PDF');
    expect(fs.existsSync(path.join(dest, 'pdf'))).toBe(false);
    expect(() => fs.lstatSync(path.join(dest, 'link'))).toThrow(/ENOENT/);
  });

  for (const kind of ['tar', 'zip'] as const) {
    testPosix(
      `${kind}: setuid/setgid/sticky and group/other-write bits in the archive are dropped`,
      async () => {
        const unix = (type: number, mode: number) => ({ createSystem: 3, externalAttr: (type | mode) << 16 });
        const buf =
          kind === 'tar' ?
            makeTar([
              { name: 'pdf/sub/', type: '5', mode: 0o1777 },
              { name: 'pdf/sub/suid.sh', type: '0', mode: 0o4755, body: '#!/bin/sh' },
              { name: 'pdf/sgid.sh', type: '0', mode: 0o2775, body: '#!/bin/sh' },
              { name: 'pdf/open.txt', type: '0', mode: 0o666, body: 'x' },
              { name: 'pdf/ownerx', type: '0', mode: 0o700, body: '#!/bin/sh' },
            ])
          : makeZip([
              { name: 'pdf/sub/', ...unix(S_IFDIR, 0o1777) },
              { name: 'pdf/sub/suid.sh', body: '#!/bin/sh', ...unix(S_IFREG, 0o4755) },
              { name: 'pdf/sgid.sh', body: '#!/bin/sh', ...unix(S_IFREG, 0o2775) },
              { name: 'pdf/open.txt', body: 'x', ...unix(S_IFREG, 0o666) },
              { name: 'pdf/ownerx', body: '#!/bin/sh', ...unix(S_IFREG, 0o700) },
            ]);
        // A 0 umask (common in containers) is where a non-root `tar` keeps group/other-write bits.
        const umask = process.umask(0);
        try {
          await extractInto(buf, dest);
        } finally {
          process.umask(umask);
        }
        const mode = (rel: string) => fs.statSync(path.join(dest, rel)).mode & 0o7777;
        expect(mode('sub')).toBe(0o700);
        expect(mode('sub/suid.sh')).toBe(0o755);
        expect(mode('sgid.sh')).toBe(0o755);
        expect(mode('open.txt')).toBe(0o644);
        expect(mode('ownerx')).toBe(0o755);
      },
    );
  }

  testPosix('tar: a world-writable `./` member is staged under an owner-only directory', async () => {
    const buf = makeTar([
      { name: './', type: '5', mode: 0o777 },
      { name: './SKILL.md', type: '0', mode: 0o666, body: '# flat' },
    ]);
    const flat = path.join(work, 'skills', 'flat');
    await fsp.mkdir(flat, { recursive: true });
    const gate = promiseWithResolvers<void>();
    const pulling = promiseWithResolvers<void>();
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          pulling.resolve();
          await gate.promise;
          controller.enqueue(buf);
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const umask = process.umask(0);
    const done = extractSkillArchive(new Response(body), flat);
    let stagingModes: number[] = [];
    try {
      await pulling.promise;
      stagingModes = fs
        .readdirSync(path.dirname(flat))
        .filter((name) => name.startsWith('.skill-stage-'))
        .map((name) => fs.statSync(path.join(path.dirname(flat), name)).mode & 0o7777);
    } finally {
      gate.resolve();
      await done.finally(() => process.umask(umask));
    }
    expect(stagingModes).toEqual([0o700]);
    expect(fs.statSync(path.join(flat, 'SKILL.md')).mode & 0o7777).toBe(0o644);
    expect(tree(path.join(work, 'skills'))).toEqual([
      ['flat', 'dir'],
      ['flat/SKILL.md', 'file'],
    ]);
  });

  test('archives extracted at the same time each get their own staging directory', async () => {
    const names = ['a', 'b', 'c'];
    const into = (name: string) => path.join(work, 'skills', name);
    await Promise.all(
      names.map((name) =>
        extractInto(makeTar([{ name: `${name}/SKILL.md`, type: '0', body: name }]), into(name)),
      ),
    );
    expect(names.map((name) => fs.readFileSync(path.join(into(name), 'SKILL.md'), 'utf8'))).toEqual(names);
  });

  describe('with a wrapper around `tar` first on PATH', () => {
    const realPath = process.env['PATH'] ?? '';
    afterEach(() => {
      process.env['PATH'] = realPath;
    });

    /** The wrapper runs the real `tar` and then `after`, which still sees the arguments. */
    function wrapTar(after: string): void {
      const realTar = execFileSync('sh', ['-c', 'command -v tar'], { encoding: 'utf8' }).trim();
      const bin = path.join(work, 'bin');
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, 'tar'), `#!/bin/sh\n'${realTar}' "$@" || exit\n${after}\n`, {
        mode: 0o755,
      });
      process.env['PATH'] = bin + path.delimiter + realPath;
    }

    testPosix.each<[string, TarEntry[]]>([
      ['without exclusions', []],
      ['with exclusions', [{ name: 'pdf/link', type: '2', linkname: '/etc/passwd' }]],
    ])('tar is told not to restore owners or exact modes, %s', async (_, special) => {
      const log = path.join(work, 'tar.log');
      wrapTar(`echo "$*" >> '${log}'`);
      await extractInto(makeTar([{ name: 'pdf/SKILL.md', type: '0', body: '# PDF' }, ...special]), dest);
      const extractions = fs
        .readFileSync(log, 'utf8')
        .split('\n')
        .filter((args) => args.startsWith('-xf '));
      expect(extractions).toEqual([expect.stringContaining(' --no-same-owner --no-same-permissions')]);
    });

    testPosix(
      'a staged file with a second hard link is refused, and its other name keeps its mode',
      async () => {
        const foreign = path.join(work, 'foreign');
        fs.writeFileSync(foreign, 'x', { mode: 0o600 });
        wrapTar(`if [ "$1" = -xf ]; then ln '${foreign}' "$4/pdf/twin"; fi`);
        await expect(
          extractInto(makeTar([{ name: 'pdf/SKILL.md', type: '0', body: '# PDF' }]), dest),
        ).rejects.toThrow(/listing is inconsistent/);
        expect(fs.statSync(foreign).mode & 0o7777).toBe(0o600);
        expect(tree(path.join(work, 'skills'))).toEqual([['pdf', 'dir']]);
      },
    );
  });

  test('tar: a listing too long to hold in memory is refused', async () => {
    const names = Array.from({ length: 11_000 }, (_, i) => `pdf/${String(i).padStart(95, '0')}`);
    await expect(extractInto(makeTar(names.map((name) => ({ name, type: '0' }))), dest)).rejects.toThrow(
      'skill archive lists too many members: `tar` printed more than 1048576 characters',
    );
    expect(tree(path.join(work, 'skills'))).toEqual([['pdf', 'dir']]);
  });

  test('tar: a PAX global header (git archive) leaves no file behind and the wrapper is stripped', async () => {
    const buf = makeTar([
      { name: 'pax_global_header', type: 'g', body: '52 comment=0123456789012345678901234567890123456789\n' },
      { name: 'pdf/SKILL.md', type: '0', body: '# PDF' },
    ]);
    await extractInto(buf, dest);
    expect(tree(dest)).toEqual([['SKILL.md', 'file']]);
  });

  test('tar: a skipped symlink with an unsafe name still fails the whole archive', async () => {
    const buf = makeTar([
      { name: '../x', type: '2', linkname: '/tmp' },
      { name: 'pdf/SKILL.md', type: '0', body: '# PDF' },
    ]);
    await expect(extractInto(buf, dest)).rejects.toThrow(/unsafe archive member/);
    expect(tree(dest)).toEqual([]);
    expect(fs.existsSync(path.join(work, 'skills', 'x'))).toBe(false);
  });

  for (const kind of ['tar', 'zip'] as const) {
    test(`${kind}: glob characters in a skipped member's name are matched literally`, async () => {
      const buf =
        kind === 'tar' ?
          makeTar([
            { name: 'pdf/SKILL.md', type: '0', body: '# PDF' },
            { name: 'pdf/a*', type: '2', linkname: '/tmp' },
            { name: 'pdf/abc', type: '0', body: 'abc' },
          ])
        : makeZip([
            { name: 'pdf/SKILL.md', body: '# PDF' },
            zipSymlink('pdf/a*'),
            { name: 'pdf/abc', body: 'abc' },
          ]);
      await extractInto(buf, dest);
      expect(fs.readFileSync(path.join(dest, 'abc'), 'utf8')).toBe('abc');
      expect(() => fs.lstatSync(path.join(dest, 'a*'))).toThrow(/ENOENT/);
    });

    test(`${kind}: an archive holding only a special member extracts to an empty directory`, async () => {
      const buf =
        kind === 'tar' ?
          makeTar([{ name: 'pdf/lnk', type: '2', linkname: '/etc/passwd' }])
        : makeZip([zipSymlink('pdf/lnk')]);
      await extractInto(buf, dest);
      expect(tree(dest)).toEqual([]);
    });
  }

  const unexcludable: Array<{ description: string; buf: () => Buffer }> = [
    {
      description: 'zip symlink whose name starts with a dash',
      buf: () => makeZip([{ name: 'pdf/SKILL.md', body: '#' }, zipSymlink('-dX/evil')]),
    },
    {
      description: 'zip symlink with a non-ASCII name',
      buf: () => makeZip([{ name: 'pdf/SKILL.md', body: '#' }, zipSymlink('pdf/café')]),
    },
    {
      description: 'zip symlink with a control character in its name',
      buf: () => makeZip([{ name: 'pdf/SKILL.md', body: '#' }, zipSymlink('pdf/c\x01d')]),
    },
    {
      description: 'tar symlink with a non-ASCII name',
      buf: () =>
        makeTar([
          { name: 'pdf/SKILL.md', type: '0', body: '#' },
          { name: 'pdf/café', type: '2', linkname: '/tmp' },
        ]),
    },
    {
      description: 'tar symlink with a control character in its name',
      buf: () =>
        makeTar([
          { name: 'pdf/SKILL.md', type: '0', body: '#' },
          { name: 'pdf/c\x01d', type: '2', linkname: '/tmp' },
        ]),
    },
    {
      description: 'tar symlink with a backslash in its name',
      buf: () =>
        makeTar([
          { name: 'pdf/SKILL.md', type: '0', body: '#' },
          { name: 'pdf/back\\slash', type: '2', linkname: '/tmp' },
        ]),
    },
  ];
  for (const tc of unexcludable) {
    test(`refuses the archive when a special member cannot be excluded by name: ${tc.description}`, async () => {
      await expect(extractInto(tc.buf(), dest)).rejects.toThrow(/cannot safely exclude member/);
      expect(tree(dest)).toEqual([]);
      expect(fs.existsSync(path.join(work, 'skills', 'X'))).toBe(false);
      expect(tree(work).filter(([, type]) => type === 'other')).toEqual([]);
    });
  }

  test('tar: over-exclusion of a name twin never leaves a symlink behind', async () => {
    const buf = makeTar([
      { name: 'SKILL.md', type: '2', linkname: '/etc/passwd' },
      { name: 'pdf/SKILL.md', type: '0', body: '# PDF' },
      { name: 'pdf/x', type: '0', body: 'x' },
    ]);
    await extractInto(buf, dest).catch((e: unknown) => {
      expect(String(e)).toMatch(/listing is inconsistent/);
    });
    expect(tree(work).filter(([, type]) => type === 'other')).toEqual([]);
    if (fs.existsSync(path.join(dest, 'SKILL.md'))) {
      expect(fs.lstatSync(path.join(dest, 'SKILL.md')).isFile()).toBe(true);
    }
  });
});

describe('classifyArchiveListing', () => {
  test('splits members by the typed listing and keeps zipinfo "?" rows as plain', () => {
    const names = 'pdf/SKILL.md\npdf/lnk\npdf/nobits\npdf/sub/\npdf/fifo\n';
    const typed = [
      '-rw-r--r--  3.0 unx        5 b- stor 80-Jan-01 00:00 pdf/SKILL.md',
      'lrwxrwxrwx  3.0 unx       11 b- stor 80-Jan-01 00:00 pdf/lnk',
      '?rwxr-xr-x  3.0 unx        1 b- stor 80-Jan-01 00:00 pdf/nobits',
      'drwxr-xr-x  3.0 unx        0 b- stor 80-Jan-01 00:00 pdf/sub/',
      'prw-r--r--  3.0 unx        0 b- stor 80-Jan-01 00:00 pdf/fifo',
      '',
    ].join('\n');
    expect(classifyArchiveListing('unzip', names, typed)).toEqual({
      plain: ['pdf/SKILL.md', 'pdf/nobits', 'pdf/sub/'],
      special: ['pdf/lnk', 'pdf/fifo'],
    });
  });

  test('treats GNU tar contiguous files as plain and hardlinks as special', () => {
    const names = 'pdf/cont\npdf/hl\n';
    const typed =
      'Crw-r--r-- 0/0 4 1970-01-01 00:00 pdf/cont\nhrw-r--r-- 0/0 0 1970-01-01 00:00 pdf/hl link to pdf/SKILL.md\n';
    expect(classifyArchiveListing('tar', names, typed)).toEqual({ plain: ['pdf/cont'], special: ['pdf/hl'] });
  });

  test('refuses listings whose line counts differ', () => {
    expect(() => classifyArchiveListing('tar', 'a\nb\n', '-rw a\n')).toThrow(/listing is inconsistent/);
  });

  const link = 'lrwxrwxrwx x';
  const cases: Array<{ cmd: 'unzip' | 'tar'; name: string }> = [
    { cmd: 'unzip', name: '-dX/evil' },
    { cmd: 'unzip', name: 'pdf/c^Ad' },
    { cmd: 'unzip', name: 'pdf/café' },
    { cmd: 'unzip', name: 'pdf/#U00e9' },
    { cmd: 'tar', name: 'pdf/café' },
    { cmd: 'tar', name: 'pdf/c\\001d' },
    { cmd: 'tar', name: 'pdf/back\\\\slash' },
  ];
  for (const tc of cases) {
    test(`refuses a special member the CLI cannot exclude verbatim: ${tc.cmd} ${JSON.stringify(
      tc.name,
    )}`, () => {
      expect(() => classifyArchiveListing(tc.cmd, `${tc.name}\n`, `${link}\n`)).toThrow(
        /cannot safely exclude member/,
      );
    });
  }

  test('a leading dash only matters for unzip, and only on special members', () => {
    expect(classifyArchiveListing('tar', '-x\n', `${link}\n`)).toEqual({ plain: [], special: ['-x'] });
    expect(classifyArchiveListing('unzip', '-x\n', '-rw x\n')).toEqual({ plain: ['-x'], special: [] });
  });
});

describe('assertOnlyPlainEntries', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-'));
    fs.mkdirSync(path.join(root, 'd'));
    fs.writeFileSync(path.join(root, 'd', 'f'), 'x');
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('accepts a tree of files and directories', async () => {
    await expect(assertOnlyPlainEntries(root)).resolves.toBeUndefined();
  });

  testPosix('rejects a symlink to a directory without reading through it', async () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-target-'));
    fs.chmodSync(target, 0o000);
    try {
      fs.symlinkSync(target, path.join(root, 'd', 'link'), 'dir');
      await expect(assertOnlyPlainEntries(root)).rejects.toThrow(/listing is inconsistent/);
    } finally {
      fs.chmodSync(target, 0o755);
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  testPosix('rejects a fifo', async () => {
    execFileSync('mkfifo', [path.join(root, 'd', 'pipe')]);
    await expect(assertOnlyPlainEntries(root)).rejects.toThrow(/listing is inconsistent/);
  });
});

/**
 * `setupSkills` prefers the already-fetched session. `sessionId` is the
 * deprecated back-compat path: it still works, it warns, and it costs the
 * extra `sessions.retrieve` the warning names.
 */
describe('setupSkills session resolution', () => {
  function fakeClient(): { client: Anthropic; retrieves: string[]; logs: string[] } {
    const retrieves: string[] = [];
    const logs: string[] = [];
    const logAll = (...args: unknown[]) => logs.push(args.map((a) => JSON.stringify(a)).join(' '));
    const client = {
      logger: { error: logAll, warn: logAll, info: logAll, debug: logAll },
      logLevel: 'debug',
      beta: {
        sessions: {
          retrieve: async (sessionId: string) => {
            retrieves.push(sessionId);
            return { agent: { skills: [] } };
          },
        },
      },
    };
    return { client: client as never, retrieves, logs };
  }

  const session = { agent: { skills: [] } } as unknown as BetaManagedAgentsSession;

  it('is a no-op without a client, or with neither session nor sessionId', async () => {
    const { retrieves } = fakeClient();
    await setupSkills({ workdir: '/tmp', session });
    const { client, retrieves: r2 } = fakeClient();
    await setupSkills({ workdir: '/tmp', client });
    expect(retrieves).toEqual([]);
    expect(r2).toEqual([]);
  });

  it('uses ctx.session without fetching, and says nothing', async () => {
    const { client, retrieves, logs } = fakeClient();
    await setupSkills({ workdir: '/tmp', client, session });
    expect(retrieves).toEqual([]);
    expect(logs.join('\n')).not.toContain('deprecated');
  });

  it('fetches for the deprecated sessionId, warning about the extra round trip', async () => {
    const { client, retrieves, logs } = fakeClient();
    await setupSkills({ workdir: '/tmp', client, sessionId: 's1' });
    expect(retrieves).toEqual(['s1']);
    expect(logs.join('\n')).toContain('sessionId is deprecated');
    expect(logs.join('\n')).toContain('extra session fetch');
  });

  it('prefers session over sessionId, and never fetches', async () => {
    const { client, retrieves, logs } = fakeClient();
    await setupSkills({ workdir: '/tmp', client, session, sessionId: 's1' });
    expect(retrieves).toEqual([]);
    expect(logs.join('\n')).not.toContain('deprecated');
  });
});

describe('setupSkills version resolution', () => {
  it('retrieves by the configured version and downloads by the returned id', async () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'skilltest-'));
    try {
      const retrieves: string[] = [];
      const downloads: string[] = [];
      const client = {
        logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
        beta: {
          skills: {
            versions: {
              retrieve: async (version: string, params: { skill_id: string }) => {
                retrieves.push(`${params.skill_id}@${version}`);
                return { id: 'skillver_123', name: 'pdf' };
              },
              download: async (version: string, params: { skill_id: string }) => {
                downloads.push(`${params.skill_id}@${version}`);
                return new Response(makeTar([{ name: 'pdf/SKILL.md', type: '0', body: '# PDF' }]));
              },
            },
          },
        },
      };
      const session = {
        agent: { skills: [{ skill_id: 'skill_01', version: 'latest' }] },
      } as unknown as BetaManagedAgentsSession;
      const cleanup = await setupSkills({ workdir: work, client: client as never, session });
      expect(retrieves).toEqual(['skill_01@latest']);
      expect(downloads).toEqual(['skill_01@skillver_123']);
      expect(fs.readFileSync(path.join(work, 'skills', 'pdf', 'SKILL.md'), 'utf8')).toBe('# PDF');
      await cleanup();
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });
});

describePosix('the tar, unzip and gzip that setupSkills runs', () => {
  const originalEnv = process.env;
  const which = (name: string) =>
    execFileSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8', env: originalEnv }).trim();
  const archives = {
    tgz: zlib.gzipSync(makeTar([{ name: 'pdf/SKILL.md', type: '0', body: '# PDF' }])),
    zip: makeZip([{ name: 'pdf/SKILL.md', body: '# PDF' }]),
  };
  let host: string;
  let warnings: string[];

  beforeEach(() => {
    host = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'skilltest-')));
    warnings = [];
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(host, { recursive: true, force: true });
  });

  /** A context whose one skill downloads as `archive`. */
  function contextFor(archive: Buffer) {
    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      logLevel: 'warn',
      logger: { ...console, warn: (...args: unknown[]) => warnings.push(JSON.stringify(args)) },
      fetch: async (url) =>
        String(url).endsWith('/content') ?
          new Response(archive)
        : Response.json({ id: 'skillver_123', name: 'pdf' }),
    });
    const session = {
      agent: { skills: [{ skill_id: 'skill_01', version: 'latest' }] },
    } as unknown as BetaManagedAgentsSession;
    return {
      workdir: path.join(host, 'workdir'),
      allowedRoots: [path.join(host, 'allowed')],
      client,
      session,
    };
  }

  const ranLog = (where: string) => path.join(host, `${where.replace('/', '-')}.ran`);
  const ran = (where: string) => (fs.existsSync(ranLog(where)) ? fs.readFileSync(ranLog(where), 'utf8') : '');

  /**
   * A script that records that it ran and then runs the real program. Only GNU `tar` starts
   * `gzip`, so the script for `tar` starts it too.
   */
  const recording = (where: string, name: string) =>
    [
      '#!/bin/sh',
      `echo ${name} >> '${ranLog(where)}'`,
      ...(name === 'tar' ? ['gzip --version > /dev/null'] : []),
      `exec '${which(name)}' "$@"`,
      '',
    ].join('\n');

  function writePrograms(where: string, names: readonly string[]): string {
    fs.mkdirSync(path.join(host, where), { recursive: true });
    for (const name of names) {
      fs.writeFileSync(path.join(host, where, name), recording(where, name), { mode: 0o755 });
    }
    return path.join(host, where);
  }

  const programs = { tgz: ['tar', 'gzip'], zip: ['unzip'] } as const;

  test.each([
    ['tgz', 'tar', 'workdir/bin', 'workdir/bin'],
    ['tgz', 'tar', 'allowed/bin', 'allowed/bin'],
    ['tgz', 'tar', 'workdir/bin', 'linked-dir'],
    ['tgz', 'tar', 'workdir/bin', 'linked-file'],
    ['zip', 'unzip', 'workdir/bin', 'workdir/bin'],
    ['zip', 'unzip', 'allowed/bin', 'allowed/bin'],
    ['zip', 'unzip', 'workdir/bin', 'linked-dir'],
    ['zip', 'unzip', 'workdir/bin', 'linked-file'],
    ['tgz', 'gzip', 'workdir/bin', 'workdir/bin'],
    ['tgz', 'gzip', 'allowed/bin', 'allowed/bin'],
    ['tgz', 'gzip', 'workdir/bin', 'linked-dir'],
    ['tgz', 'gzip', 'workdir/bin', 'linked-file'],
    ['tgz', 'gzip', 'workdir/bin', 'linked-two-entries'],
  ] as const)(
    '%s: a %s that the write tool replaced in %s is passed over for the next one (PATH entry %j)',
    async (kind, name, where, entry) => {
      const ctx = contextFor(archives[kind]);
      fs.mkdirSync(path.join(host, where), { recursive: true });
      fs.writeFileSync(path.join(host, where, name), '#!/bin/sh\n', { mode: 0o755 });
      fs.symlinkSync(path.join(host, where), path.join(host, 'linked-dir'));
      fs.mkdirSync(path.join(host, 'linked-file'));
      fs.symlinkSync(path.join(host, where, name), path.join(host, 'linked-file', name));
      const twoEntries = path.join(host, 'outside') + path.delimiter + path.join(host, where);
      fs.mkdirSync(twoEntries, { recursive: true });
      fs.symlinkSync(twoEntries, path.join(host, 'linked-two-entries'));
      await betaWriteTool(ctx).run({
        file_path: path.join(host, where, name),
        content: recording(where, name),
      });
      expect(fs.statSync(path.join(host, where, name)).mode & 0o777).toBe(0o755);

      process.env['PATH'] = [path.join(host, entry), writePrograms('system', programs[kind])].join(
        path.delimiter,
      );
      await setupSkills(ctx);

      expect(warnings).toEqual([]);
      expect(fs.readFileSync(path.join(ctx.workdir, 'skills', 'pdf', 'SKILL.md'), 'utf8')).toBe('# PDF');
      expect(ran(where)).toBe('');
      expect(ran('system')).toContain(name);
    },
  );

  test.each([
    ['tgz', 'workdir/bin'],
    ['zip', 'workdir/bin'],
    ['tgz', 'workdir/no-such-dir'],
    ['tgz', 'linked-workdir/no-such-dir'],
  ] as const)(
    '%s: programs inside the workdir are still used when no PATH entry is outside it (%s)',
    async (kind, entry) => {
      const ctx = contextFor(archives[kind]);
      const inside = writePrograms('workdir/bin', programs[kind]);
      fs.symlinkSync(ctx.workdir, path.join(host, 'linked-workdir'));
      process.env['PATH'] = [path.join(host, entry), inside].join(path.delimiter);
      await setupSkills(ctx);

      expect(warnings).toEqual([]);
      expect(fs.readFileSync(path.join(ctx.workdir, 'skills', 'pdf', 'SKILL.md'), 'utf8')).toBe('# PDF');
      for (const name of programs[kind]) expect(ran('workdir/bin')).toContain(name);
    },
  );

  test.each([
    ['tgz', 'tar', 'empty'],
    ['zip', 'unzip', 'empty'],
    ['tgz', 'tar', 'linked-gzip'],
    ['tgz', 'tar', 'no-such-dir'],
    ['tgz', 'tar', 'loop'],
  ] as const)(
    '%s: a %s inside the workdir is not used when PATH has an entry outside it (%s)',
    async (kind, name, entry) => {
      const ctx = contextFor(archives[kind]);
      const inside = writePrograms('workdir/bin', programs[kind]);
      fs.mkdirSync(path.join(host, 'empty'));
      fs.mkdirSync(path.join(host, 'linked-gzip'));
      fs.symlinkSync(path.join(inside, 'gzip'), path.join(host, 'linked-gzip', 'gzip'));
      fs.symlinkSync('loop', path.join(host, 'loop'));
      process.env['PATH'] = [inside, path.join(host, entry)].join(path.delimiter);
      await setupSkills(ctx);

      expect(warnings).toEqual([
        expect.stringContaining(
          `requires the \`${name}\` command, but it was not found on PATH outside \`workdir\` and \`allowedRoots\``,
        ),
      ]);
      expect(ran('workdir/bin')).toBe('');
    },
  );

  test('nothing is started when a directory the file tools can write cannot be resolved', async () => {
    const ctx = contextFor(archives.tgz);
    fs.symlinkSync('loop', path.join(host, 'loop'));
    process.env['PATH'] = [
      writePrograms('workdir/bin', programs.tgz),
      writePrograms('system', programs.tgz),
    ].join(path.delimiter);
    await setupSkills({ ...ctx, allowedRoots: [path.join(host, 'loop')] });

    expect(warnings).toEqual([expect.stringContaining('too many levels of symbolic links')]);
    expect(ran('workdir/bin') + ran('system')).toBe('');
  });

  test('tar is started under the name tar', async () => {
    fs.mkdirSync(path.join(host, 'system'));
    fs.symlinkSync(process.execPath, path.join(host, 'system', 'tar'));
    process.env['PATH'] = path.join(host, 'system');
    await setupSkills(contextFor(archives.tgz));
    expect(warnings).toEqual([expect.stringMatching(/`tar` failed \(exit \d+\): tar: /)]);
  });
});
