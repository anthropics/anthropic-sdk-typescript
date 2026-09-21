// `"sideEffects": false` in a package.json lets a bundler drop any module whose exports go unused. That is
// only safe if no module does work when it is imported. This check imports every module of the packed SDK,
// uses none of them, and requires each bundler to keep nothing.
//
// A bundler that honours the field drops an unused import without reading the code, so the field, if the
// package declares it, is deleted first. Rollup is given no plugins and never reads package.json. All of
// this is done to a copy of the installed package, so the check can be run again on the same install.
import * as fs from 'node:fs';
import { isBuiltin } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import * as esbuild from 'esbuild';
import { rolldown } from 'rolldown';
import { rollup } from 'rollup';
import webpack from 'webpack';

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-shaking-'));
process.on('exit', () => fs.rmSync(workDir, { recursive: true, force: true }));
const pkgDir = path.join(workDir, 'sdk');
// realpath: a linked install (pnpm, `npm link`, a file: dependency) is a symlink, and copying the link would
// leave the edits below landing in the real package.
fs.cpSync(fs.realpathSync('node_modules/@anthropic-ai/sdk'), pkgDir, { recursive: true });
const pkgJsonPath = path.join(pkgDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
delete pkg.sideEffects;
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'src' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.name.endsWith('.mjs')) found.push(full);
  }
  return found;
}

// A bundler cannot look inside a Node built-in, so it has to keep a module that loads one, and browser
// builds replace those modules with stand-ins through the package.json "browser" field anyway. Leave out
// every module from which a Node built-in is reachable; the stand-ins stay in.
const modules = walk(pkgDir);
const imports = new Map(
  modules.map((file) => [
    file,
    [
      ...fs
        .readFileSync(file, 'utf8')
        .matchAll(/^\s*(?:import|export)\b\s*(?:[^'"\n]*?\bfrom\s*)?['"]([^'"]+)['"]/gm),
    ].map(([, specifier]) =>
      specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : specifier,
    ),
  ]),
);
const loadsBuiltin = new Set(modules.filter((file) => imports.get(file).some((dep) => isBuiltin(dep))));
for (let grew = true; grew; ) {
  grew = false;
  for (const file of modules) {
    if (!loadsBuiltin.has(file) && imports.get(file).some((dep) => loadsBuiltin.has(dep))) {
      loadsBuiltin.add(file);
      grew = true;
    }
  }
}
const checked = modules.filter((file) => !loadsBuiltin.has(file)).sort();
if (checked.length < 100) throw new Error(`expected to find the SDK's modules, found ${checked.length}`);
const relative = (file) => path.relative(pkgDir, file);
console.log(`left out, a Node built-in is reachable: ${[...loadsBuiltin].map(relative).sort().join(', ')}\n`);

// Statements that are known to run when their module is imported, and are accepted: each builds state that
// only its own module uses. An entry is the exact compiled text, or a pattern for a statement too long to
// quote, and must occur exactly once. Before bundling, in the installed copy, a `pure` entry gets
// /* @__PURE__ */ in front of its initialiser and any other entry is removed (this check bundles the
// package, it never runs it). Anything else that a bundler keeps fails the check, and so does an entry
// that no longer matches, so the list can only shrink. It empties when the `pure` entries carry that mark
// in the source, the two arithmetic constants become literals, the registry is built inside a pure call,
// and the build keeps a class's private methods inside the class's pure call.
const noEffect =
  "module-level constant built by a constructor with no effect; webpack's minifier does not assume that";
const arithmetic = 'constant arithmetic; esbuild keeps an unused binding whose initialiser uses << or *';
const accepted = [
  {
    file: 'core/middleware.mjs',
    why: noEffect,
    pure: true,
    statement: 'const fetchOriginErrors = new WeakSet();',
  },
  {
    file: 'internal/headers.mjs',
    why: noEffect,
    pure: true,
    statement: "const brand_privateNullableHeaders = Symbol.for('brand.privateNullableHeaders');",
  },
  {
    file: 'internal/headers.mjs',
    why: noEffect,
    pure: true,
    statement: "const clearSentinel = Symbol('clear');",
  },
  {
    file: 'internal/headers.mjs',
    why: noEffect,
    pure: true,
    statement: "export const APPEND_HEADERS = new Set(['x-stainless-helper']);",
  },
  {
    file: 'internal/request-signal.mjs',
    why: noEffect,
    pure: true,
    statement: 'const cleanups = new WeakMap();',
  },
  {
    file: 'internal/request-signal.mjs',
    why: 'registry that releases abort listeners of abandoned requests; module-local',
    statement: `const registry = typeof globalThis.FinalizationRegistry === 'function' ?
    new globalThis.FinalizationRegistry((controller) => releaseRequestSignal(controller))
    : null;`,
  },
  {
    file: 'internal/stainless-helper-header.mjs',
    why: noEffect,
    pure: true,
    statement: "export const SDK_HELPER_SYMBOL = Symbol('anthropic.sdk.stainlessHelper');",
  },
  {
    file: 'lib/credentials/types.mjs',
    why: noEffect,
    pure: true,
    statement: "const SAFE_ERROR_KEYS = new Set(['error', 'error_description', 'error_uri']);",
  },
  {
    file: 'lib/credentials/types.mjs',
    why: arithmetic,
    statement: 'const MAX_TOKEN_RESPONSE_BYTES = 1 << 20;',
  },
  {
    file: 'lib/middleware.mjs',
    why: 'shared TextEncoder for re-serialised stream events; module-local',
    pure: true,
    statement: 'const encoder = new TextEncoder();',
  },
  {
    file: 'lib/tools/SessionToolRunner.mjs',
    why: arithmetic,
    statement: 'const SEND_RETRY_WINDOW_MS = 5 * 60000;',
  },
  {
    file: 'lib/tools/SessionToolRunner.mjs',
    why: "the class's private methods, which the build assigns to module-level variables after the class's pure call instead of inside it; rollup drops unused assignments, the other bundlers do not",
    statement:
      /^_SessionToolRunner_requestOptions = function _SessionToolRunner_requestOptions\(\) \{\n[\s\S]*?\n\};\n/m,
  },
  {
    file: 'lib/transform-json-schema.mjs',
    why: noEffect,
    pure: true,
    statement: `const SUPPORTED_STRING_FORMATS = new Set([
    'date-time',
    'time',
    'date',
    'duration',
    'email',
    'hostname',
    'uri',
    'ipv4',
    'ipv6',
    'uuid',
]);`,
  },
];
for (const { file, statement, pure } of accepted) {
  const full = path.join(pkgDir, file);
  const source = fs.readFileSync(full, 'utf8');
  const occurrences =
    typeof statement === 'string' ?
      source.split(statement).length - 1
    : [...source.matchAll(new RegExp(statement.source, statement.flags + 'g'))].length;
  if (occurrences !== 1) {
    throw new Error(
      `${file}: expected exactly one occurrence of the accepted statement, found ${occurrences}:\n${statement}`,
    );
  }
  fs.writeFileSync(
    full,
    source.replace(statement, pure ? statement.replace(' = ', ' = /* @__PURE__ */ ') : ''),
  );
}

// A lazy `import()` is not work done at import time, but a bundler that meets one wraps the target module
// or adds chunk-loading code, and then cannot drop it. Every module is imported statically by the entry
// below, so turn each lazy load into a call of an unknown function, which an unused function takes with it.
for (const file of modules) {
  const source = fs.readFileSync(file, 'utf8');
  if (/\bimport\(/.test(source)) fs.writeFileSync(file, source.replace(/\bimport\(/g, 'lazyImport('));
}

const entry = path.join(workDir, 'entry.mjs');
fs.writeFileSync(
  entry,
  checked.map((file) => `import ${JSON.stringify(file)};`).join('\n') + "\nconsole.log('nothing kept');\n",
);

// Other packages are not what this checks, and an optional peer may not be installed: leave every bare
// specifier external, and ignore the imports of other packages that a bundler then has to keep.
const isBare = (specifier) => !specifier.startsWith('.') && !path.isAbsolute(specifier);
const withoutBareImports = (code) =>
  code.replace(/(?<=^|[;\n])\s*import\s*(?:[^'";]*?\bfrom\s*)?(['"])[^'"./][^'"]*\1;?/g, '');

const bundlers = {
  async rollup() {
    const bundle = await rollup({ input: entry, external: isBare, onwarn() {} });
    const { output } = await bundle.generate({ format: 'esm' });
    return output[0].code;
  },
  async esbuild() {
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      packages: 'external',
      format: 'esm',
      write: false,
      logLevel: 'silent',
    });
    return result.outputFiles[0].text;
  },
  async rolldown() {
    const bundle = await rolldown({ input: entry, external: isBare, onwarn() {} });
    const { output } = await bundle.generate({ format: 'esm' });
    return output[0].code;
  },
  webpack() {
    return new Promise((resolve, reject) => {
      webpack(
        {
          entry,
          mode: 'production',
          output: { path: workDir, filename: 'webpack.mjs', library: { type: 'module' } },
          experiments: { outputModule: true },
          externalsType: 'module',
          externals: ({ request }, callback) => (isBare(request) ? callback(null, request) : callback()),
        },
        (error, stats) => {
          if (error || stats.hasErrors()) reject(error ?? new Error(stats.toString()));
          else resolve(fs.readFileSync(path.join(workDir, 'webpack.mjs'), 'utf8'));
        },
      );
    });
  },
};

let failed = false;
for (const [name, bundle] of Object.entries(bundlers)) {
  let kept;
  try {
    kept = withoutBareImports(await bundle())
      .replace(/console\.log\((['"])nothing kept\1\);?/, '')
      .replaceAll(/(?:\.\.\/)*[^\s'"]*tree-shaking-[^/\s]+\/sdk\//g, '')
      .trim();
  } catch (error) {
    kept = `the bundler failed: ${error.message}`;
  }
  // esbuild and rolldown label each module's code with a comment; on its own that is not kept code.
  if (kept.replace(/^\s*\/\/.*$/gm, '').trim()) {
    failed = true;
    console.error(`${name} keeps ${kept.length} bytes from unused imports of ${checked.length} modules:\n`);
    console.error(kept.length > 4000 ? kept.slice(0, 4000) + '\n…' : kept);
    console.error();
  } else {
    console.log(`${name}: nothing kept from ${checked.length} modules`);
  }
}
if (failed) {
  console.error(
    'A module above runs code when it is imported. Move that work into a function, mark a call that has no effect with /* @__PURE__ */, or, for state only its own module uses, add the statement to `accepted`.',
  );
  process.exit(1);
}
