const fs = require('fs');
const pkgJson = require('../dist/package.json');

for (const dep in pkgJson.dependencies) {
  // ensure we point to NPM instead of a local directory
  if (dep === '@anthropic-ai/sdk') {
    // Floor at the base-SDK version this client's internals require: the
    // `_shouldResolveDefaultCredentials()` hook this client overrides so a
    // config/profile `base_url` can't take over the region-derived gateway URL,
    // the `protected` `getUserAgent()` this client overrides, and the
    // `UserProfiles` resource this client constructs. Older versions lack at
    // least one of these.
    pkgJson.dependencies[dep] = '>=0.136.0 <1';
  }
}

fs.writeFileSync('dist/package.json', JSON.stringify(pkgJson, null, 2));
