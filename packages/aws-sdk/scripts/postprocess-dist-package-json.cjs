const fs = require('fs');
const pkgJson = require('../dist/package.json');

for (const dep in pkgJson.dependencies) {
  // ensure we point to NPM instead of a local directory
  if (dep === '@anthropic-ai/sdk') {
    // Floor at the base-SDK version this client's internals require: the
    // `_shouldResolveDefaultCredentials()` hook this client overrides so a
    // config/profile `base_url` can't take over the region-derived gateway URL,
    // and the `protected` `getUserAgent()` this client overrides. Older
    // in-range versions have neither.
    pkgJson.dependencies[dep] = '>=0.115.1 <1';
  }
}

fs.writeFileSync('dist/package.json', JSON.stringify(pkgJson, null, 2));
