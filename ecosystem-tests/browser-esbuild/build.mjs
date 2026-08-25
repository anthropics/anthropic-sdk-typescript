// Bundles src/main.ts for the browser twice: an ES module and a classic-script IIFE.
import * as esbuild from 'esbuild';
import * as fs from 'node:fs';

const shared = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  define: {
    __BASE_URL__: JSON.stringify(process.env.ANTHROPIC_BASE_URL ?? ''),
    __API_KEY__: JSON.stringify(process.env.ANTHROPIC_API_KEY ?? ''),
  },
  metafile: true,
  logLevel: 'info',
};

for (const [format, outfile] of [
  ['esm', 'dist/main.js'],
  ['iife', 'dist/main.iife.js'],
]) {
  // esbuild has already printed the errors; skip the stack trace
  const { metafile } = await esbuild.build({ ...shared, format, outfile }).catch(() => process.exit(1));
  fs.writeFileSync(`${outfile}.meta.json`, JSON.stringify(metafile.outputs[outfile], null, 2));
}
