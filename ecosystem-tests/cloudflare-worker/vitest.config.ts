import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        // workerd has no process.env; pass the runner's mock server and key through as plain-text bindings
        bindings: {
          ANTHROPIC_BASE_URL: process.env['ANTHROPIC_BASE_URL'] ?? '',
          FAKE_API_KEY: process.env['ECOSYSTEM_TESTS_FAKE_KEY'] ?? '',
        },
      },
    }),
  ],
  test: { include: ['test/**/*.test.ts'] },
});
