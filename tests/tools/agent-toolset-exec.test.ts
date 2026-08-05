import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  WINDOWS_NATIVE_EXTENSIONS,
  ExecutableNotFoundError,
  candidateNames,
  execFileSafe,
  findExecutable,
  isSearchablePathEntry,
  requireExecutable,
  spawnAbsolute,
  spawnSafe,
} from '@anthropic-ai/sdk/tools/agent-toolset/exec';
import { AnthropicError } from '@anthropic-ai/sdk/core/error';

// Shared cross-SDK test vectors (V1–V12, W1–W3, P1) for safe executable
// resolution — see the contract in src/tools/agent-toolset/exec.ts. The same
// vectors are implemented in claude-agent-sdk-python, anthropic-sdk-python and
// anthropic-sdk-go; keep the IDs so they can be cross-referenced.

const describePosix = process.platform === 'win32' ? describe.skip : describe;

/** Write an executable `#!/bin/sh` script that prints `output`. */
function writeScript(file: string, output: string, mode = 0o755): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `#!/bin/sh\necho ${output}\n`);
  fs.chmodSync(file, mode);
}

/** Run `fn` with `dir` as the working directory, always restoring the previous one. */
async function inDir<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

/** Collect a spawned child's stdout and exit code. */
function collect(proc: import('node:child_process').ChildProcess): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    proc.stdout?.setEncoding('utf8');
    proc.stdout?.on('data', (d: string) => (stdout += d));
    proc.once('error', reject);
    proc.once('close', (code) => resolve({ stdout, code: code ?? -1 }));
  });
}

describe('isSearchablePathEntry (G2)', () => {
  // W1
  test.each([
    ['C:\\bin', true],
    ['c:/bin', true],
    ['\\\\srv\\share\\bin', true],
    ['//srv/share/bin', true],
    ['"C:\\Program Files\\X"', true],
    ['\\bin', false],
    ['/bin', false],
    ['C:bin', false],
    ['C:', false],
    ['.', false],
    ['', false],
    ['bin', false],
    ['..\\x', false],
    ['%SystemRoot%\\system32', false],
    ['~\\bin', false],
  ])('win32: %j → %s', (entry, searchable) => {
    expect(isSearchablePathEntry(entry, 'win32')).toBe(searchable);
  });

  test.each([
    ['/usr/bin', true],
    ['/', true],
    ['//double/slash', true],
    ['', false],
    ['.', false],
    ['bin', false],
    ['./bin', false],
    ['../bin', false],
    ['~/bin', false],
    ['$HOME/bin', false],
    ['C:\\bin', false],
    ['"/' + 'quoted"', false],
  ])('posix: %j → %s', (entry, searchable) => {
    expect(isSearchablePathEntry(entry, 'linux')).toBe(searchable);
  });
});

describe('candidateNames (G3)', () => {
  // W2
  test.each<[string, readonly string[] | undefined, string[]]>([
    ['rg', undefined, ['rg.exe', 'rg.com']],
    ['rg.exe', undefined, ['rg.exe']],
    ['RG.EXE', undefined, ['RG.EXE']],
    ['rg.Com', undefined, ['rg.Com']],
    ['claude.cmd', undefined, []],
    ['claude.bat', undefined, []],
    ['claude.cmd', ['.exe', '.com', '.cmd', '.bat'], ['claude.cmd']],
    ['claude', ['.cmd', '.bat'], ['claude.cmd', 'claude.bat']],
    ['tool.js', undefined, []],
  ])('win32: %j with extensions %j → %j', (name, exts, expected) => {
    expect(candidateNames(name, 'win32', exts)).toEqual(expected);
  });

  test('posix: the name is tried as-is only, whatever it ends in', () => {
    expect(candidateNames('rg', 'linux')).toEqual(['rg']);
    expect(candidateNames('rg.exe', 'darwin')).toEqual(['rg.exe']);
    expect(candidateNames('tool.js', 'linux')).toEqual(['tool.js']);
  });

  test('the default allow-list is the native-image one', () => {
    expect(WINDOWS_NATIVE_EXTENSIONS).toEqual(['.exe', '.com']);
  });
});

describePosix('findExecutable', () => {
  const sep = path.delimiter;
  let root: string;
  let bin: string; // absolute PATH entry holding the real `tool`
  let binTool: string;
  let plant: string; // used as the working directory; holds a planted `tool`
  let noexec: string; // holds a non-executable `tool`
  let dirs: string; // holds a *directory* named `tool`

  beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'exec-test-')));
    bin = path.join(root, 'bin');
    binTool = path.join(bin, 'tool');
    plant = path.join(root, 'plant');
    noexec = path.join(root, 'noexec');
    dirs = path.join(root, 'dirs');
    writeScript(binTool, 'real');
    writeScript(path.join(bin, 'tool.exe'), 'real-exe');
    writeScript(path.join(bin, 'a\\b'), 'backslash');
    writeScript(path.join(plant, 'tool'), 'PLANT');
    writeScript(path.join(plant, 'tool.exe'), 'PLANT-EXE');
    writeScript(path.join(plant, 'rel', 'sub', 'tool'), 'PLANT-REL');
    writeScript(path.join(noexec, 'tool'), 'noexec', 0o644);
    fs.mkdirSync(path.join(dirs, 'tool'), { recursive: true });
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  test('V1: a bare name is found in an absolute PATH entry', async () => {
    expect(await findExecutable('tool', { path: bin })).toBe(binTool);
  });

  test('V2: an empty PATH entry is skipped, never read as the working directory', async () => {
    await inDir(plant, async () => {
      expect(await findExecutable('tool', { path: `${sep}${bin}` })).toBe(binTool);
      expect(await findExecutable('tool', { path: `${bin}${sep}` })).toBe(binTool);
      expect(await findExecutable('tool', { path: '' + sep })).toBeNull();
    });
  });

  test('V3: a "." PATH entry is skipped even when it comes first', async () => {
    await inDir(plant, async () => {
      expect(await findExecutable('tool', { path: `.${sep}${bin}` })).toBe(binTool);
    });
  });

  test('V4: a relative PATH entry is skipped even when it would match under the working directory', async () => {
    await inDir(plant, async () => {
      expect(fs.existsSync(path.join('rel', 'sub', 'tool'))).toBe(true);
      expect(await findExecutable('tool', { path: `rel/sub${sep}${bin}` })).toBe(binTool);
      expect(await findExecutable('tool', { path: `./rel/sub${sep}${bin}` })).toBe(binTool);
    });
  });

  test('V5: with only ".", empty and relative entries nothing is found — the CWD plant is never returned', async () => {
    await inDir(plant, async () => {
      expect(await findExecutable('tool', { path: ['.', '', 'rel/sub', './', '..'].join(sep) })).toBeNull();
    });
  });

  test('V6: a match that is not executable is not a match', async () => {
    expect(await findExecutable('tool', { path: noexec })).toBeNull();
    expect(await findExecutable('tool', { path: `${noexec}${sep}${bin}` })).toBe(binTool);
  });

  test('V7: a directory with the right name is skipped and the search continues', async () => {
    expect(await findExecutable('tool', { path: `${dirs}${sep}${bin}` })).toBe(binTool);
    expect(await findExecutable('tool', { path: dirs })).toBeNull();
  });

  test('V8 (G4): an explicit relative path is honoured against the working directory, not searched for', async () => {
    await inDir(plant, async () => {
      expect(await findExecutable('./tool', { path: bin })).toBe(path.join(plant, 'tool'));
      expect(await findExecutable('rel/sub/tool', { path: bin })).toBe(
        path.join(plant, 'rel', 'sub', 'tool'),
      );
      expect(await findExecutable('./missing', { path: bin })).toBeNull();
    });
  });

  test('V9 (G4): an explicit absolute path resolves to itself iff it is an executable file', async () => {
    expect(await findExecutable(binTool, { path: '' })).toBe(binTool);
    expect(await findExecutable(path.join(bin, 'missing'), { path: bin })).toBeNull();
    expect(await findExecutable(path.join(noexec, 'tool'), { path: bin })).toBeNull();
    expect(await findExecutable(path.join(dirs, 'tool'), { path: bin })).toBeNull();
  });

  test('V10: the result is absolute and normalised (but not realpath-ed)', async () => {
    const found = await findExecutable('tool', { path: `${root}/./bin//` });
    expect(found).toBe(binTool);
    expect(path.isAbsolute(found!)).toBe(true);
    expect(found).toBe(path.normalize(found!));

    const link = path.join(root, 'linkbin');
    fs.symlinkSync(bin, link, 'dir');
    expect(await findExecutable('tool', { path: link })).toBe(path.join(link, 'tool'));
  });

  test('V11: degenerate names find nothing and do not throw', async () => {
    await inDir(plant, async () => {
      for (const name of ['', '.', '..']) {
        expect(await findExecutable(name, { path: `${bin}${sep}.${sep}${plant}` })).toBeNull();
      }
    });
  });

  test('V12: an empty or unset PATH finds nothing — no fallback list, never the working directory', async () => {
    await inDir(plant, async () => {
      expect(await findExecutable('tool', { path: '' })).toBeNull();
      const saved = process.env['PATH'];
      delete process.env['PATH'];
      try {
        expect(await findExecutable('tool')).toBeNull();
      } finally {
        process.env['PATH'] = saved;
      }
    });
  });

  test('the default search path is this process’s PATH', async () => {
    const saved = process.env['PATH'];
    process.env['PATH'] = `.${sep}${sep}${bin}`;
    try {
      await inDir(plant, async () => {
        expect(await findExecutable('tool')).toBe(binTool);
      });
    } finally {
      process.env['PATH'] = saved;
    }
  });

  test('P1: on POSIX a backslash is part of the name, not a separator — the name is searched for, not resolved against the CWD', async () => {
    await inDir(bin, async () => {
      // Searched (and found) via PATH…
      expect(await findExecutable('a\\b', { path: bin })).toBe(path.join(bin, 'a\\b'));
      // …and not treated as the explicit path `./a\b`, which would have resolved here.
      expect(await findExecutable('a\\b', { path: '' })).toBeNull();
    });
  });

  describe('win32 rules (exercised on this host via the platform option)', () => {
    test('W3: "." is skipped and the absolute entry wins — the CWD plant is never picked', async () => {
      // `//tmp/…/bin` satisfies the win32 "fully absolute" rule (UNC form) and is
      // still a valid spelling of `bin` on this host, so the lookup can complete
      // against real files.
      const uncBin = '/' + bin;
      expect(isSearchablePathEntry(uncBin, 'win32')).toBe(true);
      await inDir(plant, async () => {
        expect(await findExecutable('tool', { platform: 'win32', path: `.;${uncBin}` })).toBe(
          path.join(bin, 'tool.exe'),
        );
        expect(await findExecutable('tool.exe', { platform: 'win32', path: `.;;${uncBin}` })).toBe(
          path.join(bin, 'tool.exe'),
        );
        // A POSIX-absolute entry is rooted-but-driveless under win32 rules: skipped,
        // and still nothing falls back to the working directory.
        expect(await findExecutable('tool', { platform: 'win32', path: `.;${bin}` })).toBeNull();
        // Non-native images are never candidates (G3).
        expect(await findExecutable('tool.cmd', { platform: 'win32', path: uncBin })).toBeNull();
      });
    });

    test('a bare name containing ":" is never a PATH child on win32', async () => {
      expect(await findExecutable('C:tool', { platform: 'win32', path: '/' + bin })).toBeNull();
    });
  });
});

describePosix('requireExecutable / execFileSafe / spawnSafe / spawnAbsolute', () => {
  const sep = path.delimiter;
  let root: string;
  let bin: string;
  let plant: string;
  let marker: string;

  beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'exec-spawn-test-')));
    bin = path.join(root, 'bin');
    plant = path.join(root, 'plant');
    marker = path.join(root, 'plant-ran');
    writeScript(path.join(bin, 'tool'), 'real');
    // The plant records that it ran, so a test can prove it never did.
    fs.mkdirSync(plant, { recursive: true });
    fs.writeFileSync(path.join(plant, 'tool'), `#!/bin/sh\ntouch '${marker}'\necho PLANT\n`);
    fs.chmodSync(path.join(plant, 'tool'), 0o755);
  });
  afterEach(() => fs.rmSync(marker, { force: true }));
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  test('requireExecutable returns the path or throws an ExecutableNotFoundError naming the program', async () => {
    expect(await requireExecutable('tool', { path: bin })).toBe(path.join(bin, 'tool'));

    const err = await requireExecutable('tool', { path: `.${sep}` }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExecutableNotFoundError);
    expect(err).toBeInstanceOf(AnthropicError);
    expect((err as ExecutableNotFoundError).executable).toBe('tool');
    expect((err as Error).message).toMatch(/`tool` was not found on PATH .*never the working directory/);

    const explicit = await requireExecutable('./nope', { path: bin }).catch((e: unknown) => e);
    expect(explicit).toBeInstanceOf(ExecutableNotFoundError);
    expect((explicit as Error).message).toMatch(/`\.\/nope` is not an existing executable file/);
  });

  test('execFileSafe runs the PATH executable by absolute path even with "." first and a plant in the CWD (G1/G2)', async () => {
    await inDir(plant, async () => {
      const { stdout, stderr } = await execFileSafe('tool', [], { path: `.${sep}${sep}${bin}` });
      expect(stdout).toBe('real\n');
      expect(stderr).toBe('');
      expect(fs.existsSync(marker)).toBe(false);
    });
  });

  test('execFileSafe rejects with ExecutableNotFoundError — and spawns nothing — when only the CWD has the program', async () => {
    await inDir(plant, async () => {
      await expect(execFileSafe('tool', [], { path: `.${sep}${sep}sub` })).rejects.toBeInstanceOf(
        ExecutableNotFoundError,
      );
      expect(fs.existsSync(marker)).toBe(false);
    });
  });

  test('execFileSafe honours an explicit path (G4) and surfaces the child’s own failure', async () => {
    const failing = path.join(bin, 'failing');
    fs.writeFileSync(failing, '#!/bin/sh\necho out; echo err >&2; exit 3\n');
    fs.chmodSync(failing, 0o755);
    const err = await execFileSafe(failing, [], { path: '' }).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ExecutableNotFoundError);
    expect((err as { code?: unknown }).code).toBe(3);
    expect((err as { stdout?: unknown }).stdout).toBe('out\n');
    expect((err as { stderr?: unknown }).stderr).toBe('err\n');
  });

  test('spawnSafe resolves before spawning: the PATH executable runs, the CWD plant does not', async () => {
    await inDir(plant, async () => {
      const proc = await spawnSafe('tool', [], { path: `.${sep}${bin}` });
      expect(proc.spawnfile).toBe(path.join(bin, 'tool'));
      expect(await collect(proc)).toEqual({ stdout: 'real\n', code: 0 });
      expect(fs.existsSync(marker)).toBe(false);

      await expect(spawnSafe('tool', [], { path: '.' })).rejects.toBeInstanceOf(ExecutableNotFoundError);
      expect(fs.existsSync(marker)).toBe(false);
    });
  });

  test('spawnAbsolute spawns an absolute path and refuses anything else without spawning', async () => {
    const proc = spawnAbsolute(path.join(bin, 'tool'), []);
    expect(await collect(proc)).toEqual({ stdout: 'real\n', code: 0 });

    await inDir(plant, async () => {
      expect(() => spawnAbsolute('tool', [])).toThrow(/an absolute path is required/);
      expect(() => spawnAbsolute('./tool', [])).toThrow(AnthropicError);
      expect(fs.existsSync(marker)).toBe(false);
    });
  });
});
