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
  type AgentToolContext,
} from '@anthropic-ai/sdk/tools/agent-toolset/node';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-'));
}

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
        description: 'dot-dot that escapes the workdir is rejected when unrestrictedPaths is false',
        env: { workdir: root },
        p: '../etc/passwd',
        wantErr: /escapes workdir/,
      },
      {
        description: 'absolute path is rejected by default so the jail is the explicit opt-out',
        env: { workdir: root },
        p: '/etc/passwd',
        wantErr: /not permitted/,
      },
      {
        description: 'absolute path is allowed when unrestrictedPaths is set',
        env: { workdir: root, unrestrictedPaths: true },
        p: '/etc/passwd',
        want: '/etc/passwd',
      },
      {
        description: 'sibling directory with a shared prefix (work vs workdir2) is correctly rejected',
        env: { workdir: '/tmp/work' },
        p: '../work2/file',
        wantErr: /escapes workdir/,
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

  test('read with view_range returns the 1-indexed inclusive line slice', async () => {
    fs.writeFileSync(path.join(dir, 'f.txt'), 'a\nb\nc\nd\n');
    const out = await betaReadTool(env).run({ file_path: 'f.txt', view_range: [2, 3] });
    expect(out).toBe('b\nc');
  });

  test('read of a missing file throws ToolError so the dispatcher reports is_error', async () => {
    await expect(betaReadTool(env).run({ file_path: 'nope.txt' })).rejects.toThrow(/ENOENT|no such file/);
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

  test('read refuses a file over the size cap so a huge file cannot OOM the runner', async () => {
    fs.writeFileSync(path.join(dir, 'big.txt'), Buffer.alloc(257 * 1024, 'a'));
    await expect(betaReadTool(env).run({ file_path: 'big.txt' })).rejects.toThrow(/exceeds .*limit/);
  });

  test('read refuses a directory so it cannot dump a Dirent listing as bytes', async () => {
    fs.mkdirSync(path.join(dir, 'sub'));
    await expect(betaReadTool(env).run({ file_path: 'sub' })).rejects.toThrow(/not a regular file/);
  });

  test('edit refuses a file over the size cap so a huge file cannot OOM the runner', async () => {
    fs.writeFileSync(path.join(dir, 'big.txt'), Buffer.alloc(257 * 1024, 'a'));
    await expect(
      betaEditTool(env).run({ file_path: 'big.txt', old_string: 'a', new_string: 'b' }),
    ).rejects.toThrow(/exceeds .*limit/);
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

  test('write outside workdir via dot-dot is rejected by the path jail', async () => {
    await expect(betaWriteTool(env).run({ file_path: '../escape.txt', content: 'x' })).rejects.toThrow(
      /escapes workdir/,
    );
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

  test('glob rejects a ".." pattern that would walk fs.glob out of the workdir', async () => {
    await expect(betaGlobTool(env).run({ pattern: '../*' })).rejects.toThrow(/not permitted in the pattern/);
    await expect(betaGlobTool(env).run({ pattern: '../../**/*.ts' })).rejects.toThrow(
      /not permitted in the pattern/,
    );
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

  test('exec rejects when the command exceeds the timeout budget', async () => {
    await expect(session.exec('sleep 2', { timeoutMs: 200 })).rejects.toThrow(/timed out/);
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
