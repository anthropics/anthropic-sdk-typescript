const fs = require('fs');
const problems = Object.values(JSON.parse(fs.readFileSync('.attw.json', 'utf-8')).problems)
  .flat()
  .filter(
    (problem) =>
      !(
        // This is intentional, if the user specifies .mjs they get ESM.
        (
          (problem.kind === 'CJSResolvesToESM' && problem.entrypoint.endsWith('.mjs')) ||
          // This is intentional for backwards compat reasons.
          (problem.kind === 'MissingExportEquals' && problem.implementationFileName.endsWith('/index.js')) ||
          // this is intentional, internal/types.d.ts deliberately attempts to import types that may not exist from parent
          // node_modules folders to better support various runtimes without triggering automatic type acquisition.
          (problem.kind === 'InternalResolutionError' &&
            /\/internal\/types\.d\.m?ts$/.test(problem.fileName) &&
            problem.moduleSpecifier.includes('node_modules'))
        )
      ),
  );
fs.unlinkSync('.attw.json');
if (problems.length) {
  process.stdout.write('The types are wrong!\n' + JSON.stringify(problems, null, 2) + '\n');
  process.exitCode = 1;
} else {
  process.stdout.write('Types ok!\n');
}
