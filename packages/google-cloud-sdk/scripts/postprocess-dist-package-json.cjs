const fs = require('fs');
const pkgJson = require('../dist/package.json');

for (const dep in pkgJson.dependencies) {
  // ensure we point to NPM instead of a local directory
  if (dep === '@anthropic-ai/sdk') {
    // Floor at the base-SDK version this client's internals require: the
    // `client`/`core/*` subpath exports and the `__auth` constructor channel
    // that implements the credential-isolation guarantee. Older in-range
    // versions would either fail to import or silently re-enable the base
    // credential chain.
    pkgJson.dependencies[dep] = '>=0.101.0 <1';
  }
}

fs.writeFileSync('dist/package.json', JSON.stringify(pkgJson, null, 2));
