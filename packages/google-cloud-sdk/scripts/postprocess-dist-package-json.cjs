const fs = require('fs');
const pkgJson = require('../dist/package.json');

for (const dep in pkgJson.dependencies) {
  // ensure we point to NPM instead of a local directory
  if (dep === '@anthropic-ai/sdk') {
    // Floor at the base-SDK version this client's internals require: the
    // `client`/`core/*` subpath exports and the `__auth` constructor channel
    // that implements the credential-isolation guarantee, and the `protected`
    // `getUserAgent()` this client overrides. Older in-range versions would
    // fail to import, silently re-enable the base credential chain, or reject
    // the override.
    pkgJson.dependencies[dep] = '>=0.115.1 <1';
  }
}

fs.writeFileSync('dist/package.json', JSON.stringify(pkgJson, null, 2));
