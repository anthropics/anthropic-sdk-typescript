/**
 * Ecosystem test runner: builds + packs the SDK, then for each project under ecosystem-tests/
 * (any directory with a project.json) copies it and shared/ to a temp dir, installs its lockfile
 * plus the tarball there and runs its steps against mock-server.mjs. See README.md.
 */
import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

interface ProjectConfig {
  description: string;
  /** binaries that must be on PATH, e.g. ["node"], ["deno"], ["bun"] */
  requires?: string[];
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  /** each step is an argv array run with cwd = the project's temp copy */
  steps: string[][];
  minNodeVersion?: number;
  /** run once per major given to --node-versions instead of once under the current node */
  perNodeVersion?: boolean;
  /** why this project currently fails because of the SDK; like @ts-expect-error, it must then fail */
  knownFailure?: string;
}

type Status = 'PASS' | 'FAIL' | 'SKIP' | 'XFAIL' | 'XPASS';

const ROOT = path.resolve(__dirname, '..');
const ECO = __dirname;
const TARBALL = path.join(ECO, '.pack', 'anthropic-ai-sdk.tgz');
const API_KEY = 'ecosystem-test-key';
// left behind by running a project in place (shared: a local copy of ../shared, see README.md)
const NOT_COPIED = /^(node_modules|dist|shared|\.wrangler|\.yarn|\.pnp\..*)$/;

const useColor = !process.env['NO_COLOR'] && (process.stdout.isTTY || !!process.env['CI']);
const paint = (code: number) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = paint(31);
const green = paint(32);
const yellow = paint(33);
const bold = paint(1);
const colorFor: Record<Status, (s: string) => string> = {
  PASS: green,
  FAIL: red,
  SKIP: yellow,
  XFAIL: yellow,
  XPASS: red,
};

function parseArgs(argv: string[]) {
  const args = {
    patterns: [] as string[],
    skipBuild: false,
    skipPack: false,
    list: false,
    keep: false,
    jobs: 1,
    nodeVersions: undefined as number[] | undefined,
  };
  const majors = (list: string | undefined) => (list ?? '').split(',').filter(Boolean).map(Number);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--skip-build') args.skipBuild = true;
    else if (arg === '--skip-pack') args.skipPack = true;
    else if (arg === '--list') args.list = true;
    else if (arg === '--keep') args.keep = true;
    else if (arg === '--jobs' || arg === '-j') args.jobs = Number(argv[++i]);
    else if (arg.startsWith('--jobs=')) args.jobs = Number(arg.slice('--jobs='.length));
    else if (arg === '--node-versions') args.nodeVersions = majors(argv[++i]);
    else if (arg.startsWith('--node-versions='))
      args.nodeVersions = majors(arg.slice('--node-versions='.length));
    else if (arg === '--help' || arg === '-h') {
      console.log(
        "usage: pnpm test:ecosystem [project | 'glob-*' ...] [--list] [--skip-build] [--skip-pack] [--keep] [--jobs N] [--node-versions 20,22,24]",
      );
      process.exit(0);
    } else if (arg.startsWith('-')) fail(`unknown flag ${arg}`);
    else args.patterns.push(arg.replace(/^ecosystem-tests\//, '').replace(/\/$/, ''));
  }
  if (!Number.isInteger(args.jobs) || args.jobs < 1) fail('--jobs must be a positive integer');
  if (args.nodeVersions && (!args.nodeVersions.length || !args.nodeVersions.every(Number.isInteger))) {
    fail('--node-versions takes a comma-separated list of majors, e.g. 20,22,24');
  }
  return args;
}

function fail(message: string): never {
  console.error(red(`error: ${message}`));
  process.exit(1);
}

function discoverProjects(): Map<string, ProjectConfig> {
  const projects = new Map<string, ProjectConfig>();
  for (const entry of fs
    .readdirSync(ECO, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const configPath = path.join(ECO, entry.name, 'project.json');
    if (!entry.isDirectory() || !fs.existsSync(configPath)) continue;
    projects.set(entry.name, JSON.parse(fs.readFileSync(configPath, 'utf8')));
  }
  return projects;
}

function select(patterns: string[], names: string[]): string[] {
  if (!patterns.length) return names;
  const selected = new Set<string>();
  for (const pattern of patterns) {
    const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    const matches = names.filter((name) => re.test(name));
    if (!matches.length) fail(`no project matches ${pattern}. Try --list`);
    for (const name of matches) selected.add(name);
  }
  return [...selected];
}

function hasBinary(name: string): boolean {
  return spawnSync('which', [name], { stdio: 'ignore' }).status === 0;
}

/** The bin directory of a Node major: the running one, then $ECOSYSTEM_NODE_<major>, then where setup-node, nvm, fnm and volta install to. */
function findNode(major: number): string | undefined {
  if (major === Number(process.versions.node.split('.')[0])) return path.dirname(process.execPath);
  if (process.env[`ECOSYSTEM_NODE_${major}`]) return process.env[`ECOSYSTEM_NODE_${major}`];
  const home = os.homedir();
  const {
    RUNNER_TOOL_CACHE = '/opt/hostedtoolcache',
    NVM_DIR = `${home}/.nvm`,
    FNM_DIR = `${home}/.local/share/fnm`,
  } = process.env;
  const layouts: [versions: string, prefix: string, bin: string][] = [
    [`${RUNNER_TOOL_CACHE}/node`, '', `${process.arch}/bin`],
    [`${NVM_DIR}/versions/node`, 'v', 'bin'],
    [`${FNM_DIR}/node-versions`, 'v', 'installation/bin'],
    [`${home}/.volta/tools/image/node`, '', 'bin'],
  ];
  for (const [versions, prefix, bin] of layouts) {
    if (!fs.existsSync(versions)) continue;
    const newestFirst = fs
      .readdirSync(versions)
      .filter((v) => v.startsWith(`${prefix}${major}.`))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of newestFirst) {
      if (fs.existsSync(path.join(versions, v, bin, 'node'))) return path.join(versions, v, bin);
    }
  }
  return undefined;
}

function section(title: string) {
  console.log('\n' + bold(`==> ${title}`));
}

/** Runs a command, streaming (jobs=1) or capturing (jobs>1) its output. Resolves to the exit code. */
function run(
  cmd: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv; log: (s: string) => void; capture: boolean },
) {
  opts.log(bold(`$ ${cmd.join(' ')}`) + '\n');
  return new Promise<number>((resolve) => {
    const child = spawn(cmd[0]!, cmd.slice(1), {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
    });
    child.stdout?.on('data', (d) => opts.log(String(d)));
    child.stderr?.on('data', (d) => opts.log(String(d)));
    child.on('error', (err) => {
      opts.log(red(String(err)) + '\n');
      resolve(127);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function buildAndPack(opts: { skipBuild: boolean; skipPack: boolean }) {
  if (!opts.skipBuild) {
    section('Building SDK');
    const code = await run(['./scripts/build'], {
      cwd: ROOT,
      log: (s) => process.stdout.write(s),
      capture: false,
    });
    if (code !== 0) fail(`./scripts/build exited with ${code}`);
  }
  if (opts.skipPack) {
    if (!fs.existsSync(TARBALL)) fail(`--skip-pack given but ${path.relative(ROOT, TARBALL)} does not exist`);
    return;
  }
  section('Packing SDK');
  const dist = path.join(ROOT, 'dist');
  const packDir = path.dirname(TARBALL);
  if (!fs.existsSync(path.join(dist, 'package.json'))) fail('dist/ is missing; run without --skip-build');
  fs.rmSync(packDir, { recursive: true, force: true });
  fs.mkdirSync(packDir, { recursive: true });
  const result = spawnSync('npm', ['pack', '--json', '--pack-destination', packDir], {
    cwd: dist,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (result.status !== 0) fail('npm pack failed');
  const [{ filename }] = JSON.parse(result.stdout) as [{ filename: string }];
  fs.renameSync(path.join(packDir, filename), TARBALL);
  console.log(`packed ${filename} -> ${path.relative(ROOT, TARBALL)}`);
}

interface MockServer {
  url: string;
  close(): void;
}

function startMockServer(): Promise<MockServer> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ECO, 'mock-server.mjs')], {
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, MOCK_API_KEY: API_KEY },
    });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`mock server exited early with ${code}`)));
    const lines = readline.createInterface({ input: child.stdout! });
    lines.once('line', (line) => {
      const { port } = JSON.parse(line) as { port: number };
      resolve({ url: `http://127.0.0.1:${port}`, close: () => child.kill() });
    });
  });
}

const TGZ = '../.pack/anthropic-ai-sdk.tgz';
// a frozen install from the committed lockfile, then the packed SDK on top; only the temp copy's
// package.json/lockfile see the SDK, so a lockfile never pins a previous build's integrity hash.
// The SDK's own dependencies resolve unpinned in that second step. Neither step runs dependency
// lifecycle scripts: everything these projects need ships as plain JS or as prebuilt binaries in
// optionalDependencies.
const INSTALL: Record<ProjectConfig['packageManager'], string[][]> = {
  npm: [
    ['npm', 'ci', '--no-audit', '--no-fund', '--ignore-scripts'],
    ['npm', 'install', '--no-save', '--no-audit', '--no-fund', '--ignore-scripts', TGZ],
  ],
  pnpm: [
    ['pnpm', 'install', '--frozen-lockfile', '--ignore-scripts'],
    ['pnpm', 'add', '--ignore-scripts', TGZ],
  ],
  // works for yarn 1 and berry: berry reads --frozen-lockfile as --immutable; yarn 1 honours
  // YARN_IGNORE_SCRIPTS and berry --mode=skip-build, and each ignores the other's
  yarn: [
    ['env', 'YARN_IGNORE_SCRIPTS=true', 'yarn', 'install', '--frozen-lockfile', '--mode=skip-build'],
    ['env', 'YARN_IGNORE_SCRIPTS=true', 'yarn', 'add', '--mode=skip-build', `@anthropic-ai/sdk@file:${TGZ}`],
  ],
  bun: [
    ['bun', 'install', '--frozen-lockfile', '--ignore-scripts'],
    ['bun', 'add', '--ignore-scripts', TGZ],
  ],
};

/**
 * Installs and runs the steps in `dir` against a fresh mock server, with `nodeBin` (if given) first on PATH.
 * A failed install is told apart from a failed step because knownFailure never covers it.
 */
async function execute(
  config: ProjectConfig,
  dir: string,
  nodeBin: string | undefined,
  log: (s: string) => void,
  capture: boolean,
): Promise<'PASS' | 'FAIL' | 'INSTALL_FAIL'> {
  const mock = await startMockServer();
  // Yarn 1's global cache is not safe for concurrent installs: under --jobs, parallel runs corrupt each
  // other's entries (ENOENT mid-extract, or a half-copied SDK). Each yarn run gets its own cache instead.
  const yarnCache = config.packageManager === 'yarn' ? `${dir}.yarn-cache` : undefined;
  try {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of Object.keys(env)) if (key.startsWith('ANTHROPIC_')) delete env[key];
    Object.assign(env, { ANTHROPIC_BASE_URL: mock.url, ANTHROPIC_API_KEY: API_KEY });
    if (yarnCache) env['YARN_CACHE_FOLDER'] = yarnCache;
    // npm, npx and corepack's pnpm/yarn shims come from that Node too, or run under whichever `node` is first
    if (nodeBin) env['PATH'] = `${nodeBin}${path.delimiter}${env['PATH'] ?? ''}`;

    const install = INSTALL[config.packageManager];
    for (const step of [...install, ...config.steps]) {
      const code = await run(step, { cwd: dir, env, log, capture });
      if (code !== 0) {
        log(red(`exited with ${code}`) + '\n');
        return install.includes(step) ? 'INSTALL_FAIL' : 'FAIL';
      }
    }
    return 'PASS';
  } finally {
    mock.close();
    if (yarnCache) fs.rmSync(yarnCache, { recursive: true, force: true });
  }
}

/** One row of the summary: a project, under a specific Node major if it is expanded by --node-versions. */
interface Run {
  id: string;
  name: string;
  config: ProjectConfig;
  nodeMajor?: number;
}

async function runProject(
  { id, name, config, nodeMajor }: Run,
  opts: { runDir: string; explicit: boolean; capture: boolean; keep: boolean },
): Promise<{ status: Status; output: string }> {
  let output = '';
  const log = opts.capture ? (s: string) => void (output += s) : (s: string) => void process.stdout.write(s);
  const skip = (reason: string, hard = opts.explicit): { status: Status; output: string } => {
    // a project someone asked for must not silently pass as a skip
    log((hard ? red : yellow)(`${hard ? 'FAIL' : 'SKIP'} ${id}: ${reason}`) + '\n');
    return { status: hard ? 'FAIL' : 'SKIP', output };
  };

  const missing = [...new Set([...(config.requires ?? []), config.packageManager])].filter(
    (b) => !hasBinary(b),
  );
  if (missing.length) return skip(`required binaries not on PATH: ${missing.join(', ')}`);
  const nodeBin = nodeMajor === undefined ? undefined : findNode(nodeMajor);
  if (nodeMajor !== undefined && !nodeBin) {
    return skip(
      `node ${nodeMajor} not found; install it (nvm, fnm, volta) or set ECOSYSTEM_NODE_${nodeMajor} to its bin directory`,
      true,
    );
  }
  const major = nodeMajor ?? Number(process.versions.node.split('.')[0]);
  if (config.minNodeVersion && major < config.minNodeVersion) {
    // below the minimum, one of several --node-versions rows is expected rather than asked for
    return skip(
      `needs node >= ${config.minNodeVersion}, have ${major}`,
      opts.explicit && nodeMajor === undefined,
    );
  }

  // A copy outside the repo, so that node/tsc ancestor lookups can't reach the repo's own
  // node_modules (@types/node, zod, undici, ...) and phantom or missing dependencies show up.
  const dir = path.join(opts.runDir, nodeMajor === undefined ? name : `${name}-node${nodeMajor}`);
  fs.cpSync(path.join(ECO, name), dir, {
    recursive: true,
    filter: (src) => !NOT_COPIED.test(path.basename(src)),
  });
  // every project compiles and runs the same cases from ./shared (see README.md)
  fs.cpSync(path.join(ECO, 'shared'), path.join(dir, 'shared'), { recursive: true });
  log(`in ${dir}${nodeBin ? ` with ${nodeBin}` : ''}\n`);

  const outcome = await execute(config, dir, nodeBin, log, opts.capture);
  let status: Status = outcome === 'INSTALL_FAIL' ? 'FAIL' : outcome;
  if (config.knownFailure !== undefined && outcome !== 'INSTALL_FAIL') {
    status = status === 'FAIL' ? 'XFAIL' : 'XPASS';
  }
  if (status === 'FAIL') log(yellow(`kept ${dir}`) + '\n');
  else if (!opts.keep) fs.rmSync(dir, { recursive: true, force: true });
  return { status, output };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const all = discoverProjects();
  const selected = select(args.patterns, [...all.keys()]);

  if (args.list) {
    for (const name of selected) {
      const { description, knownFailure } = all.get(name)!;
      console.log(`${name.padEnd(24)} ${description}`);
      if (knownFailure !== undefined) console.log(`${' '.repeat(24)} ${yellow(`xfail: ${knownFailure}`)}`);
    }
    return;
  }

  await buildAndPack(args);
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anthropic-ecosystem-'));
  // the install step and some projects refer to ../.pack/anthropic-ai-sdk.tgz, which must resolve from the copy
  fs.mkdirSync(path.join(runDir, '.pack'));
  fs.copyFileSync(TARBALL, path.join(runDir, '.pack', path.basename(TARBALL)));

  const runs: Run[] = selected.flatMap((name) => {
    const config = all.get(name)!;
    if (!args.nodeVersions || !config.perNodeVersion) return [{ id: name, name, config }];
    return args.nodeVersions.map((nodeMajor) => ({
      id: `${name} (node ${nodeMajor})`,
      name,
      config,
      nodeMajor,
    }));
  });
  const results = new Map<string, { status: Status; seconds: number }>();
  // named literally rather than matched by a glob: an unmet `requires`/`minNodeVersion` then fails instead of skipping
  const named = new Set(args.patterns.filter((pattern) => !pattern.includes('*')));
  const queue = [...runs];
  const capture = args.jobs > 1;
  const worker = async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const { id, name, config } = next;
      if (!capture) section(`${id}: ${config.description}`);
      const started = Date.now();
      let result: { status: Status; output: string };
      try {
        result = await runProject(next, { runDir, explicit: named.has(name), capture, keep: args.keep });
      } catch (err) {
        result = { status: 'FAIL', output: red(String((err as Error)?.stack ?? err)) + '\n' };
        if (!capture) process.stdout.write(result.output);
      }
      results.set(id, { status: result.status, seconds: (Date.now() - started) / 1000 });
      if (capture) {
        section(`${id}: ${config.description}`);
        process.stdout.write(result.output);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(args.jobs, runs.length) }, worker));

  section('Summary');
  const width = Math.max(24, ...runs.map((r) => r.id.length));
  for (const { id, config } of runs) {
    const { status, seconds } = results.get(id)!;
    const note =
      status === 'XFAIL' ? config.knownFailure
      : status === 'XPASS' ? 'passed despite knownFailure in project.json; remove it'
      : '';
    const time = `${seconds.toFixed(1)}s`.padStart(8);
    console.log(`${colorFor[status](status.padEnd(5))} ${id.padEnd(width)} ${time}  ${note}`.trimEnd());
  }
  const failed = runs.filter((r) => ['FAIL', 'XPASS'].includes(results.get(r.id)!.status)).map((r) => r.id);
  if (args.keep || runs.some((r) => results.get(r.id)!.status === 'FAIL')) {
    console.log(`\nproject directories left in ${runDir}`);
  } else fs.rmSync(runDir, { recursive: true, force: true });
  if (failed.length) {
    console.log(red(`\n${failed.length} of ${runs.length} run(s) failed: ${failed.join(', ')}`));
    process.exit(1);
  }
  console.log(green(`\nall ${runs.length} run(s) passed, failed as expected or were skipped`));
}

main();
