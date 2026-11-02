const fs = require('fs');
const pkgJson = require('../dist/package.json');

for (const dep in pkgJson.dependencies) {
  // ensure we point to NPM instead of a local directory
  if (dep === '@anthropic-ai/sdk') {
    pkgJson.dependencies[dep] = '>=1.0.0 <2';
  }
}

fs.writeFileSync('dist/package.json', JSON.stringify(pkgJson, null, 2));
