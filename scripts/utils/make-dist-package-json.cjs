const pkgJson = require(process.env['PKG_JSON_PATH'] || '../../package.json');

function processExportMap(m) {
  for (const key in m) {
    const value = m[key];
    if (typeof value === 'string') m[key] = value.replace(/^\.\/dist\//, './');
    else processExportMap(value);
  }
}
processExportMap(pkgJson.exports);

for (const key of ['types', 'main', 'module']) {
  if (typeof pkgJson[key] === 'string') pkgJson[key] = pkgJson[key].replace(/^(\.\/)?dist\//, './');
}

// `publishConfig.directory` is only there for local development: it makes pnpm link the workspace
// packages in packages/* against ./dist. Strip it because `bin/publish-npm` runs `pnpm publish`
// from inside dist/, where pnpm would otherwise look for dist/dist.
if (pkgJson.publishConfig) delete pkgJson.publishConfig.directory;
delete pkgJson.devDependencies;
delete pkgJson.scripts.prepack;
delete pkgJson.scripts.prepublishOnly;
delete pkgJson.scripts.prepare;

console.log(JSON.stringify(pkgJson, null, 2));
