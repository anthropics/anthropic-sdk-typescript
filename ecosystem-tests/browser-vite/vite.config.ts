import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __BASE_URL__: JSON.stringify(process.env['ANTHROPIC_BASE_URL'] ?? ''),
    __FAKE_API_KEY__: JSON.stringify(process.env['ECOSYSTEM_TESTS_FAKE_KEY'] ?? ''),
  },
  build: { target: 'es2022' },
  logLevel: 'warn',
});
