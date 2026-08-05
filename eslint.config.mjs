// @ts-check
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

const noPackageSelfImport = {
  regex: '^@anthropic-ai/sdk(/.*)?',
  message: 'Use a relative import, not a package import.',
};

// Safe executable resolution (G5): `src/tools/agent-toolset/exec.ts` resolves
// every helper program to an absolute path before it reaches
// `node:child_process`, and is the only module under `src/` allowed to import
// it. Type-only imports are erased at build time and stay allowed. See
// CONTRIBUTING.md, "Spawning external programs".
const SAFE_EXEC_MODULE = 'src/tools/agent-toolset/exec.ts';
const spawnViaSafeExec = {
  message: 'Spawn helpers via src/tools/agent-toolset/exec.ts (safe executable resolution).',
  allowTypeImports: true,
};

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
      'no-restricted-imports': ['error', { patterns: [noPackageSelfImport] }],
    },
  },
  {
    files: ['src/**'],
    ignores: [SAFE_EXEC_MODULE],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'child_process', ...spawnViaSafeExec },
            { name: 'node:child_process', ...spawnViaSafeExec },
          ],
          patterns: [noPackageSelfImport],
        },
      ],
    },
  },
  {
    files: ['tests/**', 'examples/**', 'packages/**'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
