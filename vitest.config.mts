import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    // Tests import the package by name; point that at the sources.
    alias: [
      { find: /^@anthropic-ai\/sdk\/(.*)$/, replacement: `${src}/$1` },
      { find: /^@anthropic-ai\/sdk$/, replacement: `${src}/index.ts` },
    ],
  },
  test: {
    // Generated tests use describe/test/expect without importing them.
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
