// Fails unless what npm publish reads from the tarball fits the package in the current directory.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');

// The publish job installs nothing, so this uses npm's own pacote, which npm publish reads the tarball with.
const npm = execFileSync('npm', ['exec', '--call', 'echo "$npm_execpath"'], { encoding: 'utf8' }).trim();
const pacote = require(require.resolve('pacote', { paths: [path.dirname(npm)] }));

async function main() {
  const tarball = path.resolve(process.argv[2]);
  const packed = await pacote.manifest(`file:${tarball}`, { fullReadJson: true });
  const { name, version, publishConfig } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  // `directory` is for this repo's workspace only: a built package.json doesn't have it.
  const { directory, ...expectedConfig } = publishConfig ?? {};

  const expected = { name, version, publishConfig: expectedConfig, tag: undefined, gitHead: undefined };
  const actual = { ...packed, publishConfig: packed.publishConfig ?? {} };
  const different = Object.keys(expected).filter((key) => !isDeepStrictEqual(actual[key], expected[key]));
  if (different.length) {
    throw new Error(`the build made a package.json with the wrong ${different.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(`Not publishing ${process.argv[2]}: ${error.message}`);
  process.exit(1);
});
