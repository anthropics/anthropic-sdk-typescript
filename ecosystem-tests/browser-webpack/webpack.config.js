import webpack from 'webpack';

export default {
  mode: 'production',
  target: ['web', 'es2022'],
  entry: './src/main.ts',
  output: { filename: 'main.js', clean: true },
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
      __API_KEY__: JSON.stringify(process.env.ANTHROPIC_API_KEY ?? ''),
    }),
  ],
  performance: false,
  stats: 'errors-warnings',
};
