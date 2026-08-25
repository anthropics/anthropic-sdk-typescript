import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __BASE_URL__: JSON.stringify(process.env['ANTHROPIC_BASE_URL'] ?? ''),
    __API_KEY__: JSON.stringify(process.env['ANTHROPIC_API_KEY'] ?? ''),
  },
  build: { target: 'es2022' },
  logLevel: 'warn',
});
