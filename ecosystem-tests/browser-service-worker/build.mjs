// Bundles src/sw.ts twice as an ES module: with code splitting, which keeps every import() the SDK
// makes as a separate chunk, and as a single file.
import * as esbuild from 'esbuild';

for (const [splitting, outdir] of [
  [true, 'dist/esbuild-split'],
  [false, 'dist/esbuild-single'],
]) {
  await esbuild
    .build({
      entryPoints: ['src/sw.ts'],
      bundle: true,
      platform: 'browser',
      target: 'es2022',
      format: 'esm',
      splitting,
      outdir,
      define: {
        __BASE_URL__: JSON.stringify(process.env.ANTHROPIC_BASE_URL ?? ''),
        __FAKE_API_KEY__: JSON.stringify(process.env.ECOSYSTEM_TESTS_FAKE_KEY ?? ''),
      },
      logLevel: 'info',
    })
    // esbuild has already printed the errors; skip the stack trace
    .catch(() => process.exit(1));
}
