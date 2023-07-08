'use strict';
Object.defineProperty(exports, '__esModule', { value: true });

const path = require('path');
const distSrcDir = path.resolve(__dirname, '..', 'dist', 'src');

function replaceSelfReferencingImports({ orig, file, config }) {
  // replace self-referencing imports in source files to reduce errors users will
  // see if they go to definition
  if (!file.startsWith(distSrcDir)) return orig;
  return orig.replace(/['"]([^"'\r\n]+)['"]/, (match, importPath) => {
    if (!importPath.startsWith('@anthropic-ai/sdk/')) return match;
    let relativePath = path.relative(
      path.dirname(file),
      path.join(distSrcDir, importPath.substring('@anthropic-ai/sdk/'.length)),
    );
    if (!relativePath.startsWith('.')) relativePath = `./${relativePath}`;
    return JSON.stringify(relativePath);
  });
}
exports.default = replaceSelfReferencingImports;
