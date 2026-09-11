import * as path from 'node:path';
import webpack from 'webpack';

export default {
  mode: 'production',
  target: ['webworker', 'es2022'],
  entry: './src/sw.ts',
  output: { path: path.resolve('dist/webpack'), filename: 'sw.js', clean: true },
  module: {
    rules: [
      // type-checking is the separate `tsc` step
      { test: /\.ts$/, loader: 'ts-loader', options: { transpileOnly: true, compilerOptions: { noEmit: false } } },
    ],
  },
  resolve: { extensions: ['.ts', '.js'] },
  plugins: [
    new webpack.DefinePlugin({
      __BASE_URL__: JSON.stringify(process.env.ANTHROPIC_BASE_URL ?? ''),
      __FAKE_API_KEY__: JSON.stringify(process.env.ECOSYSTEM_TESTS_FAKE_KEY ?? ''),
    }),
  ],
  performance: false,
  stats: 'errors-warnings',
};
