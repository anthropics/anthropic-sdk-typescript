import { build } from 'esbuild';

const shared = { entryPoints: ['src/main.ts'], bundle: true, platform: 'node', target: 'node20', logLevel: 'info' };
await build({ ...shared, format: 'esm', outfile: 'dist/esbuild/main.mjs' });
await build({ ...shared, format: 'cjs', outfile: 'dist/esbuild/main.cjs' });
