const fs = require('fs');
const pkgJson = require('../dist/package.json');

for (const dep in pkgJson.dependencies) {
  // ensure we point to NPM instead of a local directory
  if (dep === '@anthropic-ai/sdk') {
    // Floor at the base-SDK version this client's internals require: the
    // `_shouldResolveDefaultCredentials()` hook this client overrides so a
    // config/profile `base_url` can't take over the region-derived gateway URL.
    // Older in-range versions never call the hook.
    pkgJson.dependencies[dep] = '>=0.112.4 <1';
  }
}

fs.writeFileSync('dist/package.json', JSON.stringify(pkgJson, null, 2));
