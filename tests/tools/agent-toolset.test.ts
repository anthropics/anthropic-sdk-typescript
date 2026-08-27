import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  resolvePath,
  betaAgentToolset20260401,
  betaBashTool,
  betaReadTool,
  betaWriteTool,
  betaEditTool,
  betaGlobTool,
  betaGrepTool,
  BashSession,
  BashTimeoutError,
  type AgentToolContext,
} from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { AnthropicError } from '@anthropic-ai/sdk';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-'));
}

const testPosix = process.platform === 'win32' ? test.skip : test;
const describePosix = process.platform === 'win32' ? describe.skip : describe;

// F1 / PATH-13: a cycle of symlinks (which `realpath` cannot resolve) must be
// rejected at resolve time — never spin, never fall back to the unresolved
// path, and never let a lexical `..` after the loop reach an outside file.
describePosix('canonicalize symlink-loop bound', () => {
  let dir: string;
  let outside: string;
  const FIXTURE = ['L', 'evil_link', 'loop_a', 'loop_b', 'self'];
  beforeEach(() => {
    dir = tmpdir();
    outside = tmpdir();
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'SECRET');
    fs.symlinkSync(path.join(dir, 'loop_b'), path.join(dir, 'loop_a'));
    fs.symlinkSync(path.join(dir, 'loop_a'), path.join(dir, 'loop_b'));
    fs.symlinkSync('self', path.join(dir, 'self'));
    fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(dir, 'evil_link'));
    fs.symlinkSync('loop_a/../evil_link', path.join(dir, 'L'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  for (const p of ['loop_a', 'loop_a/child.txt', 'self', 'self/x']) {
    test(`resolvePath(${JSON.stringify(p)}) rejects with the loop error and no host path`, async () => {
      const err = await resolvePath({ workdir: dir }, p).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ToolError);
      expect((err as Error).message).toBe(`path ${JSON.stringify(p)}: too many levels of symbolic links`);
      expect((err as Error).message).not.toContain(dir);
    }, 2000);
  }

  test('a lexical .. after a looping component is collapsed first, so the escape is still caught', async () => {
    await expect(resolvePath({ workdir: dir }, 'loop_a/../evil_link')).rejects.toThrow(
      /is outside the session's working directory/,
    );
    await expect(resolvePath({ workdir: dir }, 'self/../evil_link')).rejects.toThrow(
      /is outside the session's working directory/,
    );
    await expect(resolvePath({ workdir: dir }, 'L')).rejects.toThrow(
      /too many levels of symbolic links|is outside the session's working directory/,
    );
  });

  test('read of a looping path reports the loop and never returns outside content', async () => {
    const read = betaReadTool({ workdir: dir });
    await expect(read.run({ file_path: 'loop_a' })).rejects.toThrow(
      new ToolError('path "loop_a": too many levels of symbolic links'),
    );
    for (const p of ['loop_a/../evil_link', 'L']) {
      const err = await Promise.resolve(read.run({ file_path: p })).then(
        (out) => new Error(`unexpectedly read ${String(out).length} bytes`),
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(ToolError);
      expect((err as Error).message).not.toContain('SECRET');
    }
  });

  test('write under a looping path is rejected before anything is created', async () => {
    await expect(
      betaWriteTool({ workdir: dir }).run({ file_path: 'loop_a/child.txt', content: 'x' }),
    ).rejects.toThrow(/too many levels of symbolic links/);
    expect(fs.readdirSync(dir).sort()).toEqual(FIXTURE);
  });

  test('glob silently drops looping entries and still lists regular files', async () => {
    fs.writeFileSync(path.join(dir, 'ok.txt'), 'ok');
    const out = await betaGlobTool({ workdir: dir }).run({ pattern: '*' });
    expect(String(out).split('\n')).toEqual([path.join(dir, 'ok.txt')]);
  });
});

describePosix('resolvePath symlink regressions', () => {
  let dir: string;
  let outside: string;
  beforeEach(() => {
    dir = tmpdir();
    outside = tmpdir();
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'SECRET');
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  test('write through a dangling in-workdir symlink creates the target and its missing parents', async () => {
    fs.symlinkSync(path.join(dir, 'newdir', 'f.txt'), path.join(dir, 'd'));
    await betaWriteTool({ workdir: dir }).run({ file_path: 'd', content: 'via-link' });
    expect(fs.readFileSync(path.join(dir, 'newdir', 'f.txt'), 'utf8')).toBe('via-link');
  });

  test('read follows a short in-workdir symlink chain to its final target', async () => {
    fs.writeFileSync(path.join(dir, 'real.txt'), 'chained');
    fs.symlinkSync('real.txt', path.join(dir, 'c2'));
    fs.symlinkSync('c2', path.join(dir, 'c1'));
    fs.symlinkSync('c1', path.join(dir, 'c0'));
    expect(await betaReadTool({ workdir: dir }).run({ file_path: 'c0' })).toBe('chained');
  });

  test('live and dangling symlinks pointing outside the workdir are both rejected', async () => {
    fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(dir, 'out'));
    fs.symlinkSync(path.join(outside, 'nope'), path.join(dir, 'dangle_out'));
    await expect(resolvePath({ workdir: dir }, 'out')).rejects.toThrow(
      /is outside the session's working directory/,
    );
    await expect(resolvePath({ workdir: dir }, 'dangle_out')).rejects.toThrow(
      /is outside the session's working directory/,
    );
  });

  test('an unreadable directory is reported as permission denied without the host path', async () => {
    if (process.getuid?.() === 0) return;
    fs.mkdirSync(path.join(dir, 'noperm'), { mode: 0o000 });
    try {
      const err = await Promise.resolve(betaReadTool({ workdir: dir }).run({ file_path: 'noperm/x' })).catch(
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(ToolError);
      expect((err as Error).message).toBe('path "noperm/x": permission denied');
    } finally {
      fs.chmodSync(path.join(dir, 'noperm'), 0o755);
    }
  });
});

describe('betaAgentToolset20260401', () => {
  test('returns the agent_toolset_20260401 tool list as BetaRunnableTool objects so it can be filtered or extended', () => {
    const tools = betaAgentToolset20260401({ workdir: '.' });
    expect(tools.map((t) => t.name)).toEqual(['bash', 'read', 'write', 'edit', 'glob', 'grep']);
    for (const t of tools) {
      expect(typeof t.run).toBe('function');
      expect(typeof t.parse).toBe('function');
      expect(t.type).toBe('custom');
    }
  });
});

describe('resolvePath', () => {
  const root = '/tmp/work';
  const cases: { description: string; env: AgentToolContext; p: string; want?: string; wantErr?: RegExp }[] =
    [
      {
        description: 'relative path under workdir resolves to an absolute child of the workdir',
        env: { workdir: root },
        p: 'a/b.txt',
        want: path.resolve(root, 'a/b.txt'),
      },
      {
        description: 'dot-dot that escapes the workdir is rejected',
        env: { workdir: root },
        p: '../etc/passwd',
        wantErr: /is outside the session's working directory/,
      },
      {
        description: 'absolute path outside workdir is rejected',
        env: { workdir: root },
        p: '/etc/passwd',
        wantErr: /is outside the session's working directory/,
      },
      {
        description: 'absolute path inside workdir is permitted by default',
        env: { workdir: root },
        p: path.resolve(root, 'a.txt'),
        want: path.resolve(root, 'a.txt'),
      },
      {
        description: 'absolute path naming the workdir itself is permitted',
        env: { workdir: root },
        p: root,
        want: root,
      },
      {
        description: 'sibling directory with a shared prefix (work vs workdir2) is correctly rejected',
        env: { workdir: '/tmp/work' },
        p: '../work2/file',
        wantErr: /is outside the session's working directory/,
      },
      {
        description: 'dot-dot that stays inside the workdir after normalisation is permitted',
        env: { workdir: root },
        p: 'a/../b.txt',
        want: path.resolve(root, 'b.txt'),
      },
    ];

  for (const tc of cases) {
    test(tc.description, async () => {
      if (tc.wantErr) {
        await expect(resolvePath(tc.env, tc.p)).rejects.toThrow(tc.wantErr);
      } else {
        await expect(resolvePath(tc.env, tc.p)).resolves.toEqual(tc.want);
      }
    });
  }
});

describe('resolvePath with allowedRoots', () => {
  let tmp: string;
  let work: string;
  let mount: string;
  const OUTSIDE_ALL = /outside the session's working directory and its other permitted directories/;

  beforeEach(() => {
    tmp = fs.realpathSync(tmpdir());
    work = path.join(tmp, 'work');
    mount = path.join(tmp, 'mount');
    fs.mkdirSync(work);
    fs.mkdirSync(mount);
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test('a path under an allowed root is accepted, by absolute path', async () => {
    const ctx: AgentToolContext = { workdir: work, allowedRoots: [mount] };
    await expect(resolvePath(ctx, path.join(mount, 'note.md'))).resolves.toBe(path.join(mount, 'note.md'));
    await expect(resolvePath(ctx, 'inside.txt')).resolves.toBe(path.join(work, 'inside.txt'));
  });

  test('a path outside the workdir and every allowed root is rejected with the long message', async () => {
    const ctx: AgentToolContext = { workdir: work, allowedRoots: [mount] };
    await expect(resolvePath(ctx, path.join(tmp, 'elsewhere', 'x'))).rejects.toThrow(OUTSIDE_ALL);
    await expect(resolvePath(ctx, '../elsewhere/x')).rejects.toThrow(OUTSIDE_ALL);
  });

  test('without allowedRoots the message names only the working directory', async () => {
    const err = await resolvePath({ workdir: work }, path.join(mount, 'note.md')).catch((e: Error) => e);
    expect(String(err)).toMatch(/is outside the session's working directory/);
    expect(String(err)).not.toMatch(/other permitted directories/);
  });

  testPosix('a symlink out of an allowed root is rejected', async () => {
    fs.symlinkSync('/etc/passwd', path.join(mount, 'leak'));
    const ctx: AgentToolContext = { workdir: work, allowedRoots: [mount] };
    await expect(resolvePath(ctx, path.join(mount, 'leak'))).rejects.toThrow(OUTSIDE_ALL);
  });

  testPosix('an allowed root under a symlinked ancestor is reachable, existing or not', async () => {
    const real = path.join(tmp, 'real');
    const via = path.join(tmp, 'via');
    fs.mkdirSync(path.join(real, 'store'), { recursive: true });
    fs.symlinkSync(real, via, 'dir');
    const ctx: AgentToolContext = {
      workdir: work,
      allowedRoots: [path.join(via, 'store'), path.join(via, 'newstore')],
    };
    await expect(resolvePath(ctx, path.join(via, 'store', 'a.md'))).resolves.toBe(
      path.join(real, 'store', 'a.md'),
    );
    await expect(resolvePath(ctx, path.join(via, 'newstore', 'b.md'))).resolves.toBe(
      path.join(real, 'newstore', 'b.md'),
    );
  });
});

describe('unrestrictedPaths deprecation', () => {
  const factories = {
    betaAgentToolset20260401,
    betaBashTool,
    betaReadTool,
    betaWriteTool,
    betaEditTool,
    betaGlobTool,
    betaGrepTool,
  };
  const GUIDANCE = /unrestrictedPaths[\s\S]*is no longer supported[\s\S]*allowedRoots/;
  const cases = Object.entries(factories).flatMap(([name, factory]) =>
    [true, false].map((value) => [name, value, factory] as const),
  );

  test.each(cases)('%s rejects unrestrictedPaths=%s with guidance', (_name, value, factory) => {
    const construct = () => factory({ workdir: '/tmp/work', unrestrictedPaths: value });
    expect(construct).toThrow(AnthropicError);
    expect(construct).toThrow(GUIDANCE);
  });

  test('resolvePath rejects a context still carrying unrestrictedPaths, including one mutated after construction', async () => {
    await expect(resolvePath({ workdir: '/tmp/work', unrestrictedPaths: true }, 'a')).rejects.toThrow(
      GUIDANCE,
    );
    const ctx: AgentToolContext = { workdir: '/tmp/work' };
    const read = betaReadTool(ctx);
    ctx.unrestrictedPaths = false;
    await expect(read.run({ file_path: 'a.txt' })).rejects.toThrow(GUIDANCE);
  });

  test('nothing reads unrestrictedPaths except the deprecation guard', () => {
    const repo = path.resolve(__dirname, '..', '..');
    for (const rel of [
      'src/tools/agent-toolset/node.ts',
      'src/tools/agent-toolset/fs-util.ts',
      'src/lib/environments/worker.ts',
      'src/resources/beta/environments/work.ts',
    ]) {
      const source = fs.readFileSync(path.join(repo, rel), 'utf8');
      const reads = source.match(/\b[a-z_$][\w$]*\.unrestrictedPaths\b/g) ?? [];
      const guarded =
        source.match(
          /rejectUnrestrictedPaths\(\s*[a-z_$][\w$]*\.unrestrictedPaths\s*\)|[a-z_$][\w$]*\.unrestrictedPaths !== undefined\b/g,
        ) ?? [];
      expect({ rel, reads: reads.length }).toEqual({ rel, reads: guarded.length });
    }
  });
});

describe('fs tools (read/write/edit)', () => {
  let dir: string;
  let env: AgentToolContext;

  beforeEach(() => {
    dir = tmpdir();
    env = { workdir: dir };
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('write creates a file then read returns its content verbatim', async () => {
    await betaWriteTool(env).run({ file_path: 'a.txt', content: 'hello' });
    const out = await betaReadTool(env).run({ file_path: 'a.txt' });
    expect(out).toBe('hello');
  });

  test('write under many not-yet-existing directories succeeds because only symlink hops are capped', async () => {
    const rel = path.join(...Array.from({ length: 50 }, (_, i) => `d${i}`), 'f.txt');
    await betaWriteTool(env).run({ file_path: rel, content: 'deep' });
    expect(fs.readFileSync(path.join(dir, rel), 'utf8')).toBe('deep');
  });

  test('read with view_range returns the 1-indexed inclusive line slice', async () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), 'a\nb\nc\nd\n');
    const out = await betaReadTool(env).run({ file_path: 'f.txt', view_range: [2, 3] });
    expect(out).toBe('b\nc');
  });

  const viewRangeCases: { description: string; view_range: number[]; want: string }[] = [
    { description: 'an inverted range yields an empty result, not an error', view_range: [3, 1], want: '' },
    { description: 'an empty range reads the whole file', view_range: [], want: 'line1\nline2\nline3' },
    { description: 'a single-line range', view_range: [2, 2], want: 'line2' },
    { description: 'a non-positive end line reads to EOF', view_range: [2, 0], want: 'line2\nline3' },
    { description: 'a start line past EOF yields an empty result', view_range: [10, 12], want: '' },
  ];
  for (const tc of viewRangeCases) {
    test(`read view_range ${JSON.stringify(tc.view_range)}: ${tc.description}`, async () => {
      fs.writeFileSync(path.join(dir, 'a.txt'), 'line1\nline2\nline3');
      expect(await betaReadTool(env).run({ file_path: 'a.txt', view_range: tc.view_range })).toBe(tc.want);
    });
  }

  test('read view_range with the wrong arity is rejected', async () => {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'line1\nline2\nline3');
    await expect(betaReadTool(env).run({ file_path: 'a.txt', view_range: [2] })).rejects.toThrow(
      'read: view_range must be [start_line, end_line]',
    );
  });

  // 18 bytes against a 16-byte cap: the whole file is over the cap, so a
  // view_range read streams it and caps only the selected lines.
  const viewRangeOverCapCases: { description: string; view_range: number[]; want: string }[] = [
    { description: 'a single-line range', view_range: [2, 2], want: 'line2' },
    {
      description: 'a non-positive end line reads to EOF and keeps the trailing newline',
      view_range: [2, 0],
      want: 'line2\nline3\n',
    },
    { description: 'an inverted range yields an empty result, not an error', view_range: [3, 1], want: '' },
    { description: 'a start line past EOF yields an empty result', view_range: [10, 12], want: '' },
  ];
  for (const tc of viewRangeOverCapCases) {
    test(`read view_range ${JSON.stringify(tc.view_range)} of a file over the size cap: ${
      tc.description
    }`, async () => {
      fs.writeFileSync(path.join(dir, 'a.txt'), 'line1\nline2\nline3\n');
      expect(
        await betaReadTool({ workdir: dir, maxFileBytes: 16 }).run({
          file_path: 'a.txt',
          view_range: tc.view_range,
        }),
      ).toBe(tc.want);
    });
  }

  test('read view_range of a file over the size cap refuses a slice that itself exceeds the cap', async () => {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'line1\nline2\nline3\n');
    const err = await Promise.resolve(
      betaReadTool({ workdir: dir, maxFileBytes: 16 }).run({ file_path: 'a.txt', view_range: [1, 3] }),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect((err as Error).message).toMatch(/exceeds .*limit/);
    expect((err as Error).message).toContain('Narrow the view_range');
    expect((err as Error).message).not.toContain('bash');
  });

  test('read view_range of a file over the size cap explains when a single line alone exceeds the cap', async () => {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'x'.repeat(100) + '\nok\n');
    const read = betaReadTool({ workdir: dir, maxFileBytes: 16 });
    const err = await Promise.resolve(read.run({ file_path: 'a.txt', view_range: [1, 1] })).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ToolError);
    expect((err as Error).message).toContain('cannot return part of a line');
    expect((err as Error).message).not.toContain('bash');
    expect(await read.run({ file_path: 'a.txt', view_range: [2, 2] })).toBe('ok');
  });

  test('read view_range of a file over the size cap returns exact lines across stream chunk boundaries', async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => `row${String(i).padStart(4, '0')}` + '-'.repeat(90));
    fs.writeFileSync(path.join(dir, 'big.txt'), rows.join('\n') + '\n');
    const out = await betaReadTool(env).run({ file_path: 'big.txt', view_range: [1000, 1002] });
    expect(out).toBe(rows.slice(999, 1002).join('\n'));
  });

  test('read view_range with the wrong arity is rejected before the size cap is considered', async () => {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'line1\nline2\nline3\n');
    await expect(
      betaReadTool({ workdir: dir, maxFileBytes: 16 }).run({ file_path: 'a.txt', view_range: [2] }),
    ).rejects.toThrow('read: view_range must be [start_line, end_line]');
  });

  test('read of a missing file throws ToolError so the dispatcher reports is_error', async () => {
    await expect(betaReadTool(env).run({ file_path: 'nope.txt' })).rejects.toThrow(/ENOENT|no such file/);
  });

  test('read preserves CRLF line endings', async () => {
    fs.writeFileSync(path.join(dir, 'crlf.txt'), Buffer.from('line1\r\nline2\r\nline3\r\n'));
    expect(await betaReadTool(env).run({ file_path: 'crlf.txt' })).toBe('line1\r\nline2\r\nline3\r\n');
    expect(await betaReadTool(env).run({ file_path: 'crlf.txt', view_range: [1, 2] })).toBe(
      'line1\r\nline2\r',
    );
  });

  test('read preserves lone CR', async () => {
    fs.writeFileSync(path.join(dir, 'cr.txt'), Buffer.from('a\rb\rc\r'));
    expect(await betaReadTool(env).run({ file_path: 'cr.txt' })).toBe('a\rb\rc\r');
    // A lone CR is not a line separator, so the file is a single line and line 2 is empty.
    expect(await betaReadTool(env).run({ file_path: 'cr.txt', view_range: [2, 2] })).toBe('');
  });

  test('edit with a unique old_string performs exactly one replacement', async () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), 'foo bar foo');
    await betaEditTool(env).run({ file_path: 'f.txt', old_string: 'bar', new_string: 'BAZ' });
    expect(fs.readFileSync(path.join(dir, 'f.txt'), 'utf8')).toBe('foo BAZ foo');
  });

  test('edit refuses a non-unique old_string when replace_all is not set', async () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), 'foo bar foo');
    await expect(
      betaEditTool(env).run({ file_path: 'f.txt', old_string: 'foo', new_string: 'X' }),
    ).rejects.toThrow(/appears 2 times/);
  });

  test('edit with replace_all replaces every occurrence', async () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), 'a a a');
    await betaEditTool(env).run({ file_path: 'f.txt', old_string: 'a', new_string: 'b', replace_all: true });
    expect(fs.readFileSync(path.join(dir, 'f.txt'), 'utf8')).toBe('b b b');
  });

  test('edit inserts new_string literally instead of expanding $& / $1 replacement patterns', async () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), 'echo NAME');
    await betaEditTool(env).run({ file_path: 'f.txt', old_string: 'NAME', new_string: '$&_$1_${HOME}' });
    expect(fs.readFileSync(path.join(dir, 'f.txt'), 'utf8')).toBe('echo $&_$1_${HOME}');
  });

  test('edit with replace_all also inserts $-containing new_string literally', async () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), 'X X');
    await betaEditTool(env).run({ file_path: 'f.txt', old_string: 'X', new_string: '$`', replace_all: true });
    expect(fs.readFileSync(path.join(dir, 'f.txt'), 'utf8')).toBe('$` $`');
  });

  test('edit preserves CRLF line endings', async () => {
    fs.writeFileSync(path.join(dir, 'crlf.txt'), Buffer.from('line1\r\nline2\r\nline3\r\n'));
    await betaEditTool(env).run({ file_path: 'crlf.txt', old_string: 'line2', new_string: 'LINE2' });
    expect(fs.readFileSync(path.join(dir, 'crlf.txt'))).toEqual(Buffer.from('line1\r\nLINE2\r\nline3\r\n'));
  });

  test('read refuses a file over the size cap so a huge file cannot OOM the runner', async () => {
    fs.writeFileSync(path.join(dir, 'big.txt'), Buffer.alloc(257 * 1024, 'a'));
    const err = await Promise.resolve(betaReadTool(env).run({ file_path: 'big.txt' })).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ToolError);
    expect((err as Error).message).toMatch(/exceeds .*limit/);
    expect((err as Error).message).toContain('view_range');
    expect((err as Error).message).not.toContain('bash');
  });

  test('read refuses a directory so it cannot dump a Dirent listing as bytes', async () => {
    fs.mkdirSync(path.join(dir, 'sub'));
    await expect(betaReadTool(env).run({ file_path: 'sub' })).rejects.toThrow(/not a regular file/);
  });

  test('edit refuses a file over the size cap so a huge file cannot OOM the runner', async () => {
    fs.writeFileSync(path.join(dir, 'big.txt'), Buffer.alloc(257 * 1024, 'a'));
    const err = await Promise.resolve(
      betaEditTool(env).run({ file_path: 'big.txt', old_string: 'a', new_string: 'b' }),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect((err as Error).message).toMatch(/exceeds .*limit/);
    expect((err as Error).message).not.toContain('bash');
  });

  test('edit refuses a directory so a non-regular path cannot hang or be misread', async () => {
    fs.mkdirSync(path.join(dir, 'sub'));
    await expect(
      betaEditTool(env).run({ file_path: 'sub', old_string: 'a', new_string: 'b' }),
    ).rejects.toThrow(/not a regular file/);
  });

  test('edit still works on a normal file under the size cap', async () => {
    fs.writeFileSync(path.join(dir, 'ok.txt'), 'foo bar');
    await betaEditTool(env).run({ file_path: 'ok.txt', old_string: 'bar', new_string: 'baz' });
    expect(fs.readFileSync(path.join(dir, 'ok.txt'), 'utf8')).toBe('foo baz');
  });

  test('edit honours a custom maxFileBytes below the file size', async () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), 'OLD' + 'a'.repeat(2000));
    const err = await Promise.resolve(
      betaEditTool({ workdir: dir, maxFileBytes: 1024 }).run({
        file_path: 'f.txt',
        old_string: 'OLD',
        new_string: 'NEW',
      }),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect((err as Error).message).toMatch(/exceeds .*limit/);
    expect((err as Error).message).not.toContain('bash');
  });

  test('edit allows a file over the default cap when maxFileBytes is raised', async () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), 'OLD' + 'a'.repeat(257 * 1024));
    await betaEditTool({ workdir: dir, maxFileBytes: 512 * 1024 }).run({
      file_path: 'f.txt',
      old_string: 'OLD',
      new_string: 'NEW',
    });
    expect(fs.readFileSync(path.join(dir, 'f.txt'), 'utf8').startsWith('NEW')).toBe(true);
  });

  test('edit allows an oversized file when maxFileBytes is null (uncapped)', async () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), 'OLD' + 'a'.repeat(257 * 1024));
    await betaEditTool({ workdir: dir, maxFileBytes: null }).run({
      file_path: 'f.txt',
      old_string: 'OLD',
      new_string: 'NEW',
    });
    expect(fs.readFileSync(path.join(dir, 'f.txt'), 'utf8').startsWith('NEW')).toBe(true);
  });

  test('edit still refuses a directory even when maxFileBytes is null', async () => {
    fs.mkdirSync(path.join(dir, 'sub'));
    await expect(
      betaEditTool({ workdir: dir, maxFileBytes: null }).run({
        file_path: 'sub',
        old_string: 'a',
        new_string: 'b',
      }),
    ).rejects.toThrow(/not a regular file/);
  });

  test('read honours a custom maxFileBytes below the file size', async () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), Buffer.alloc(2000, 'a'));
    const err = await Promise.resolve(
      betaReadTool({ workdir: dir, maxFileBytes: 1024 }).run({ file_path: 'f.txt' }),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect((err as Error).message).toMatch(/exceeds .*limit/);
    expect((err as Error).message).toContain('view_range');
    expect((err as Error).message).not.toContain('bash');
  });

  test('read allows an oversized file when maxFileBytes is null (uncapped)', async () => {
    fs.writeFileSync(path.join(dir, 'big.txt'), Buffer.alloc(257 * 1024, 'a'));
    await expect(
      betaReadTool({ workdir: dir, maxFileBytes: null }).run({ file_path: 'big.txt' }),
    ).resolves.toContain('a');
  });

  test('read still refuses a directory even when maxFileBytes is null', async () => {
    fs.mkdirSync(path.join(dir, 'sub'));
    await expect(
      betaReadTool({ workdir: dir, maxFileBytes: null }).run({ file_path: 'sub' }),
    ).rejects.toThrow(/not a regular file/);
  });

  test('write outside workdir via dot-dot is rejected by the path jail', async () => {
    await expect(betaWriteTool(env).run({ file_path: '../escape.txt', content: 'x' })).rejects.toThrow(
      /is outside the session's working directory/,
    );
  });

  test('file tools confinement matrix: workdir + allowedRoots reachable, readOnlyRoots refuse writes, everything else rejected', async () => {
    const work = path.join(dir, 'work');
    const notes = path.join(dir, 'mnt', 'notes');
    const facts = path.join(dir, 'mnt', 'facts');
    const outside = path.join(dir, 'outside');
    for (const d of [work, notes, facts, outside]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(facts, 'facts.md'), 'immutable');
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
    const ctx: AgentToolContext = { workdir: work, allowedRoots: [notes, facts], readOnlyRoots: [facts] };
    const OUTSIDE_ALL = /outside the session's working directory and its other permitted directories/;

    await betaWriteTool(ctx).run({ file_path: 'w.txt', content: 'in workdir' });
    expect(fs.readFileSync(path.join(work, 'w.txt'), 'utf8')).toBe('in workdir');

    const note = path.join(notes, 'note.md');
    await betaWriteTool(ctx).run({ file_path: note, content: 'remembered fact' });
    expect(await betaReadTool(ctx).run({ file_path: note })).toBe('remembered fact');
    await betaEditTool(ctx).run({ file_path: note, old_string: 'fact', new_string: 'thing' });
    expect(fs.readFileSync(note, 'utf8')).toBe('remembered thing');

    const fact = path.join(facts, 'facts.md');
    expect(await betaReadTool(ctx).run({ file_path: fact })).toBe('immutable');
    await expect(betaWriteTool(ctx).run({ file_path: fact, content: 'x' })).rejects.toThrow(/read-only/);
    await expect(
      betaEditTool(ctx).run({ file_path: fact, old_string: 'immutable', new_string: 'x' }),
    ).rejects.toThrow(/read-only/);
    expect(fs.readFileSync(fact, 'utf8')).toBe('immutable');

    await expect(betaReadTool(ctx).run({ file_path: path.join(outside, 'secret.txt') })).rejects.toThrow(
      OUTSIDE_ALL,
    );
    await expect(
      betaWriteTool(ctx).run({ file_path: path.join(outside, 'new.txt'), content: 'x' }),
    ).rejects.toThrow(OUTSIDE_ALL);
    expect(fs.existsSync(path.join(outside, 'new.txt'))).toBe(false);
  });

  testPosix('a symlinked read-only root that is also an allowed root still refuses writes', async () => {
    const work = path.join(dir, 'work');
    const realStore = path.join(dir, 'real-store');
    const linkStore = path.join(dir, 'link-store');
    fs.mkdirSync(work);
    fs.mkdirSync(realStore);
    fs.symlinkSync(realStore, linkStore, 'dir');
    const leaf: AgentToolContext = { workdir: work, allowedRoots: [linkStore], readOnlyRoots: [linkStore] };
    await expect(resolvePath(leaf, path.join(linkStore, 'note.md'))).resolves.toBe(
      path.join(fs.realpathSync(realStore), 'note.md'),
    );
    await expect(
      betaWriteTool(leaf).run({ file_path: path.join(linkStore, 'note.md'), content: 'x' }),
    ).rejects.toThrow(/read-only/);

    // Same through a symlinked ancestor, for a store that exists and one not yet created.
    const real = path.join(dir, 'real');
    const via = path.join(dir, 'via');
    fs.mkdirSync(path.join(real, 'store'), { recursive: true });
    fs.symlinkSync(real, via, 'dir');
    for (const store of [path.join(via, 'store'), path.join(via, 'newstore')]) {
      const ancestor: AgentToolContext = { workdir: work, allowedRoots: [store], readOnlyRoots: [store] };
      await expect(
        betaWriteTool(ancestor).run({ file_path: path.join(store, 'note.md'), content: 'x' }),
      ).rejects.toThrow(/read-only/);
    }
    expect(fs.existsSync(path.join(real, 'store', 'note.md'))).toBe(false);
    expect(fs.existsSync(path.join(real, 'newstore'))).toBe(false);
  });

  testPosix('a symlink inside the workdir into a read-only root is refused for writes', async () => {
    const work = path.join(dir, 'work');
    const ro = path.join(dir, 'ro');
    fs.mkdirSync(work);
    fs.mkdirSync(ro);
    fs.writeFileSync(path.join(ro, 'f'), 'immutable');
    fs.symlinkSync(path.join(ro, 'f'), path.join(work, 'ln'));
    const ctx: AgentToolContext = { workdir: work, allowedRoots: [ro], readOnlyRoots: [ro] };
    await expect(betaWriteTool(ctx).run({ file_path: 'ln', content: 'x' })).rejects.toThrow(/read-only/);
    expect(fs.readFileSync(path.join(ro, 'f'), 'utf8')).toBe('immutable');
  });
});

describe('search tools (glob/grep)', () => {
  let dir: string;
  let env: AgentToolContext;

  beforeEach(() => {
    dir = tmpdir();
    env = { workdir: dir };
    fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.txt'), 'alpha\nbeta\n');
    fs.writeFileSync(path.join(dir, 'sub', 'b.ts'), 'gamma\n');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('glob with **/*.ts finds nested TypeScript files', async () => {
    const out = await betaGlobTool(env).run({ pattern: '**/*.ts' });
    expect(out).toContain(path.join(dir, 'sub', 'b.ts'));
    expect(out).not.toContain('a.txt');
  });

  test('glob returns the literal "no matches" string when nothing matches', async () => {
    const out = await betaGlobTool(env).run({ pattern: '**/*.nomatch' });
    expect(out).toBe('no matches');
  });

  test('glob with a path argument searches only under that subdirectory', async () => {
    const out = await betaGlobTool(env).run({ pattern: '*.ts', path: 'sub' });
    expect(out).toContain(path.join(dir, 'sub', 'b.ts'));
    expect(out).not.toContain('a.txt');
  });

  test('glob rejects an absolute pattern', async () => {
    await expect(betaGlobTool(env).run({ pattern: path.join(dir, '*.txt') })).rejects.toThrow(
      /absolute pattern not permitted/,
    );
  });

  test('glob rejects a ".." pattern that would walk fs.glob out of the workdir, literal or brace-expanded', async () => {
    for (const pattern of ['../*', '../../**/*.ts', '{..,x}/*', '{a,../outside}/*']) {
      await expect(betaGlobTool(env).run({ pattern })).rejects.toThrow(/not permitted in the pattern/);
    }
  });

  testPosix(
    'glob never returns entries outside the search root for patterns that spell ".." indirectly',
    async () => {
      const outside = tmpdir();
      try {
        fs.writeFileSync(path.join(outside, 'secret.txt'), 'leaked\n');
        expect(await betaGlobTool(env).run({ pattern: '[.][.]/*/secret.txt' })).toBe('no matches');
        expect(await betaGlobTool(env).run({ pattern: `[.][.]/${path.basename(outside)}/*` })).toBe(
          'no matches',
        );
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    },
  );

  test('glob and grep reach an allowed root', async () => {
    const mnt = tmpdir();
    try {
      const notes = path.join(mnt, 'notes');
      fs.mkdirSync(notes);
      fs.writeFileSync(path.join(notes, 'note.md'), 'remembered fact\n');
      const ctx: AgentToolContext = { workdir: dir, allowedRoots: [notes] };
      expect(await betaGlobTool(ctx).run({ pattern: '*.md', path: notes })).toContain('note.md');
      expect(await betaGrepTool(ctx).run({ pattern: 'remembered', path: notes })).toContain('note.md');
    } finally {
      fs.rmSync(mnt, { recursive: true, force: true });
    }
  });

  // F2 / GLOB-07: a pattern that *names* a symlinked directory makes fs.glob
  // descend through it and report entries with the raw parent path
  // (`workdir/link_out/secret.ts`), which a lexical isWithin check would pass.
  // The post-filter must check the *resolved* path instead. Recursive `**`
  // descent does not follow the link, so the explicit-name form is the bypass.
  testPosix('glob drops matches that resolve outside the workdir via a symlinked directory', async () => {
    const outside = tmpdir();
    try {
      fs.writeFileSync(path.join(outside, 'secret.ts'), 'leaked\n');
      fs.symlinkSync(outside, path.join(dir, 'link_out'), 'dir');
      expect(await betaGlobTool(env).run({ pattern: 'link_out/*.ts' })).toBe('no matches');
      expect(await betaGlobTool(env).run({ pattern: 'link_out/**' })).toBe('no matches');
      // The in-jail tree is unaffected.
      expect(await betaGlobTool(env).run({ pattern: '**/*.ts' })).toContain(path.join(dir, 'sub', 'b.ts'));
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  testPosix('glob keeps matches reached via a symlink that stays inside the workdir', async () => {
    fs.symlinkSync(path.join(dir, 'sub'), path.join(dir, 'link_in'), 'dir');
    const out = await betaGlobTool(env).run({ pattern: 'link_in/*.ts' });
    expect(out).toContain('b.ts');
  });

  testPosix('glob still returns matches when the workdir is itself a symlink', async () => {
    const link = path.join(path.dirname(dir), path.basename(dir) + '-link');
    fs.symlinkSync(dir, link, 'dir');
    try {
      const out = await betaGlobTool({ workdir: link }).run({ pattern: '**/*.ts' });
      expect(out).toContain('b.ts');
    } finally {
      fs.rmSync(link, { force: true });
    }
  });

  test('grep finds a line and reports file:lineno:content (works with or without rg on PATH)', async () => {
    const out = await betaGrepTool(env).run({ pattern: 'beta' });
    expect(out).toMatch(/a\.txt:2:beta/);
  });
});

const describeBash = process.platform === 'win32' ? describe.skip : describe;

describeBash('betaBashTool', () => {
  let dir: string;
  let tool: BetaRunnableTool<{ command?: string; restart?: boolean; timeout_ms?: number }>;

  beforeEach(() => {
    dir = tmpdir();
    tool = betaBashTool({ workdir: dir });
  });
  afterEach(() => {
    tool.close?.();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('exporting a variable in one call makes it readable in a later call (state persists across the closure-held session)', async () => {
    expect(await tool.run({ command: 'export FOO=bar; echo set' })).toBe('set');
    expect(await tool.run({ command: 'echo $FOO' })).toBe('bar');
  });

  test('a non-zero exit throws ToolError carrying the captured output', async () => {
    await expect(tool.run({ command: 'echo oops; (exit 7)' })).rejects.toThrow(/oops/);
  });

  test('restart drops state so a previously exported variable is no longer set', async () => {
    await tool.run({ command: 'export FOO=bar' });
    expect(await tool.run({ command: 'echo $FOO', restart: true })).toBe('');
  });

  test('a timed-out call discards the corrupted session so the next call starts a fresh shell instead of seeing the stale sentinel', async () => {
    await expect(tool.run({ command: 'sleep 2', timeout_ms: 200 })).rejects.toThrow(/timed out/);
    expect(await tool.run({ command: 'echo recovered' })).toBe('recovered');
  });

  test('the spawned shell does not inherit ANTHROPIC_* credential env vars', async () => {
    // The runner process holds Anthropic credentials in ANTHROPIC_* env vars;
    // an unrestricted shell must not be able to read them back out.
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-should-not-leak';
    const scoped = betaBashTool({ workdir: dir });
    try {
      expect(await scoped.run({ command: 'echo "[$ANTHROPIC_API_KEY]"' })).toBe('[]');
      // Non-credential vars (PATH etc.) still pass through.
      expect(await scoped.run({ command: 'test -n "$PATH" && echo has-path' })).toBe('has-path');
    } finally {
      scoped.close?.();
      delete process.env['ANTHROPIC_API_KEY'];
    }
  });

  test('ctx.env FULLY REPLACES the scrubbed default environment (verbatim, not merged)', async () => {
    // A var that exists in the real process env must NOT leak through when the
    // caller supplies its own env — the mapping is used verbatim.
    process.env['LEAKY_VAR'] = 'should-not-be-visible';
    const scoped = betaBashTool({ workdir: dir, env: { ONLY_THIS: 'yes', PATH: process.env['PATH'] } });
    try {
      expect(await scoped.run({ command: 'echo "[$ONLY_THIS]"' })).toBe('[yes]');
      // Not merged with the scrubbed process env — LEAKY_VAR is absent.
      expect(await scoped.run({ command: 'echo "[$LEAKY_VAR]"' })).toBe('[]');
    } finally {
      scoped.close?.();
      delete process.env['LEAKY_VAR'];
    }
  });

  test('concurrent run() calls are serialized so the shared shells stdin is not interleaved (e.g. BetaToolRunner Promise.all)', async () => {
    // Each call prints a unique marker. With no mutex, both commands write to
    // the same stdin and the sentinel-match logic would attribute output to
    // the wrong call. With the mutex, the second call only runs once the
    // first has finished, so outputs are clean and ordering is stable.
    const results = await Promise.all([
      tool.run({ command: "sleep 0.05; printf 'A'" }),
      tool.run({ command: "sleep 0.05; printf 'B'" }),
    ]);
    expect(results).toEqual(['A', 'B']);
  });
});

describeBash('BashSession (direct)', () => {
  let dir: string;
  let session: BashSession;

  beforeEach(() => {
    dir = tmpdir();
    session = new BashSession(dir);
  });
  afterEach(() => {
    session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('changing directory persists so a later pwd reports the new location', async () => {
    await session.exec('cd /tmp');
    const r = await session.exec('pwd');
    expect(r.output).toMatch(/\/tmp$/);
  });

  test('a non-zero exit is surfaced via exitCode without throwing', async () => {
    const r = await session.exec('(exit 7)');
    expect(r.exitCode).toBe(7);
  });

  test('exec rejects with a BashTimeoutError carrying the budget when the command exceeds it', async () => {
    const err = await session.exec('sleep 2', { timeoutMs: 200 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BashTimeoutError);
    expect((err as BashTimeoutError).timeoutMs).toBe(200);
    expect((err as BashTimeoutError).message).toBe('bash command timed out after 200ms');
  });

  test("an aborted exec rejects with the signal's own reason", async () => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 100);
    const err = await session
      .exec('sleep 2', { signal: ctrl.signal, timeoutMs: 5000 })
      .catch((e: unknown) => e);
    expect(err).toBe(ctrl.signal.reason);
    expect((err as Error).name).toBe('AbortError');
  });

  test('exec against an already-aborted signal rejects with its reason before running', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const err = await session.exec('echo unreachable', { signal: ctrl.signal }).catch((e: unknown) => e);
    expect(err).toBe(ctrl.signal.reason);
  });

  test("a caller's own abort reason survives, so a timeout signal is not mistaken for a cancel", async () => {
    // `AbortSignal.timeout()` aborts with a 'TimeoutError' reason; matching by
    // reason keeps the distinction that a fixed 'AbortError' name would erase.
    const reason = Object.assign(new Error('deadline'), { name: 'TimeoutError' });
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(reason), 100);
    const err = await session
      .exec('sleep 2', { signal: ctrl.signal, timeoutMs: 5000 })
      .catch((e: unknown) => e);
    expect(err).toBe(reason);
    expect((err as Error).name).toBe('TimeoutError');
  });

  test('a command that prints a hardcoded sentinel-like marker cannot truncate its own output or spoof the exit code', async () => {
    const r = await session.exec("printf '__ANT_CMD_DONE__7\\nafter\\n'; (exit 3)");
    expect(r.output).toContain('__ANT_CMD_DONE__7');
    expect(r.output).toContain('after');
    expect(r.exitCode).toBe(3);
  });

  test('a command that reads stdin gets immediate EOF instead of hanging until the timeout', async () => {
    const r = await session.exec('cat; echo done', { timeoutMs: 2000 });
    expect(r.output).toBe('done');
    expect(r.exitCode).toBe(0);
  });

  test('a command that streams more output than the cap is truncated rather than buffered unbounded', async () => {
    const r = await session.exec("head -c 300000 /dev/zero | tr '\\0' a; echo END");
    expect(r.output).toMatch(/^\[output truncated\]\n/);
    expect(r.output).toMatch(/END$/);
    expect(r.output.length).toBeLessThanOrEqual(101 * 1024);
    expect(r.exitCode).toBe(0);
  });
});
