import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'dist/tsc/src/main.js',
  output: { file: 'dist/rollup/main.mjs', format: 'es', inlineDynamicImports: true },
  // commonjs is only for the SDK's CJS-only dependencies; the SDK itself resolves to its ESM build
  plugins: [nodeResolve({ exportConditions: ['node'], preferBuiltins: true }), commonjs()],
};
