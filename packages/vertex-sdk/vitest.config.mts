import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@anthropic-ai\/vertex-sdk\/(.*)$/, replacement: `${src}/$1` },
      { find: /^@anthropic-ai\/vertex-sdk$/, replacement: `${src}/index.ts` },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
