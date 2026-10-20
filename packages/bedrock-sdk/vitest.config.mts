import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    // `src/core/aws-auth.ts` is a symlink into aws-sdk; without this its imports would resolve
    // aws-sdk's copy of the core SDK, whose error classes fail `instanceof` checks against ours.
    dedupe: ['@anthropic-ai/sdk'],
    alias: [
      { find: /^@anthropic-ai\/bedrock-sdk\/(.*)$/, replacement: `${src}/$1` },
      { find: /^@anthropic-ai\/bedrock-sdk$/, replacement: `${src}/index.ts` },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
