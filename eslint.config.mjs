// @ts-check
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

// `src/` must load on non-Node runtimes; Node built-ins may only be imported from modules the
// package.json `browser` field swaps for a stub (e.g. src/internal/node.ts).
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const nodeOnlyFiles = Object.entries(pkg.browser ?? {})
  .filter(([from, to]) => typeof to === 'string' && to !== from)
  .map(([from]) => 'src/' + from.replace(/^\.\//, '').replace(/\.[cm]?js$/, '.ts'));
const builtinRoots = [...new Set(builtinModules.map((m) => m.replace(/^node:/, '').split('/')[0]))];
// `\u002F` instead of `/` keeps the same source valid inside an esquery `/.../` selector.
const NODE_BUILTIN = `^(?:node:|(?:${builtinRoots.join('|')})(?:$|\\u002F))`;
const NODE_BUILTIN_MESSAGE =
  'Import Node built-ins through `./internal/node` (stubbed for browsers via the package.json `browser` field) instead of directly.';

export default tseslint.config(
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { sourceType: 'module' },
    },
    files: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.js', '**/*.mjs', '**/*.cjs'],
    ignores: ['dist/'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'unused-imports': unusedImports,
    },
    rules: {
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@anthropic-ai/sdk(/.*)?',
              message: 'Use a relative import, not a package import.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**'],
    ignores: [...new Set(nodeOnlyFiles)],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [{ regex: NODE_BUILTIN, allowTypeImports: true, message: NODE_BUILTIN_MESSAGE }] },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: `ImportExpression[source.value=/${NODE_BUILTIN}/]`, message: NODE_BUILTIN_MESSAGE },
        {
          selector: `CallExpression[callee.name='require'][arguments.0.value=/${NODE_BUILTIN}/]`,
          message: NODE_BUILTIN_MESSAGE,
        },
      ],
    },
  },
  {
    files: ['tests/**', 'examples/**'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
