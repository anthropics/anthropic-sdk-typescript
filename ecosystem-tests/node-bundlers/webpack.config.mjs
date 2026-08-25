import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default {
  mode: 'production',
  target: 'node20',
  entry: './dist/tsc/src/main.js',
  output: {
    path: path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist/webpack'),
    filename: 'main.cjs',
    // dynamic import()s inside the SDK must not become separate chunk files
    chunkFormat: false,
  },
  externalsPresets: { node: true },
  optimization: { splitChunks: false },
};
