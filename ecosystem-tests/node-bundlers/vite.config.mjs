import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/main.ts',
    outDir: 'dist/vite',
    // .mjs throughout so the output runs without a package.json "type" next to it
    rollupOptions: { output: { entryFileNames: 'main.mjs', chunkFileNames: '[name]-[hash].mjs' } },
  },
  // an SSR build externalises dependencies by default, which would leave the SDK unbundled
  ssr: { noExternal: true },
  logLevel: 'warn',
});
