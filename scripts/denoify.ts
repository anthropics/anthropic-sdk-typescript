import path from 'path';
import * as tm from 'ts-morph';
import { name as pkgName } from '../package.json';

const rootDir = path.resolve(__dirname, '..');
const denoDir = path.join(rootDir, 'deno');
const tsConfigFilePath = path.join(rootDir, 'tsconfig.deno.json');

function denoify() {
  const project = new tm.Project({ tsConfigFilePath });

  for (const file of project.getSourceFiles()) {
    if (!file.getFilePath().startsWith(denoDir + '/')) continue;
    for (const decl of [...file.getImportDeclarations(), ...file.getExportDeclarations()]) {
      const moduleSpecifier = decl.getModuleSpecifier();
      if (!moduleSpecifier) continue;
      let specifier = moduleSpecifier.getLiteralValue().replace(/^node:/, '');
      if (!specifier) continue;

      if (nodeStdModules.has(specifier)) {
        // convert node builtins to deno.land/std
        specifier = `https://deno.land/std@0.177.0/node/${specifier}.ts`;
      } else if (specifier.startsWith(pkgName + '/')) {
        // convert self-referencing module specifiers to relative paths
        specifier = file.getRelativePathAsModuleSpecifierTo(denoDir + specifier.substring(pkgName.length));
      } else if (!decl.isModuleSpecifierRelative()) {
        continue;
      }

      if (decl.isModuleSpecifierRelative()) {
        // there may be CJS directory module specifiers that implicitly resolve
        // to /index.ts.  Add an explicit /index.ts to the end
        const sourceFile = decl.getModuleSpecifierSourceFile();
        if (
          sourceFile &&
          /index\.[cm]?[jt]sx?$/.test(sourceFile.getFilePath()) &&
          !/index(\.[cm]?[jt]sx?)?$/.test(specifier)
        ) {
          specifier += '/' + path.basename(sourceFile.getFilePath());
        }
      }
      // add explicit .ts file extensions to relative module specifiers
      specifier = specifier.replace(/(\.[^./]*)?$/, '.ts');
      moduleSpecifier.replaceWithText(JSON.stringify(specifier));
    }

    let addedBuffer = false,
      addedProcess = false;
    file.forEachDescendant((node) => {
      switch (node.getKind()) {
        case tm.ts.SyntaxKind.ExportDeclaration: {
          const decl: tm.ExportDeclaration = node as any;
          if (decl.isTypeOnly()) return;
          for (const named of decl.getNamedExports()) {
            // Convert `export { Foo } from './foo.ts'`
            // to `export { type Foo } from './foo.ts'`
            // if `./foo.ts` only exports types for `Foo`
            if (!named.isTypeOnly() && !hasValueDeclarations(named)) {
              named.replaceWithText(`type ${named.getText()}`);
            }
          }
          break;
        }
        case tm.ts.SyntaxKind.ImportEqualsDeclaration: {
          const decl: tm.ImportEqualsDeclaration = node as any;
          if (decl.isTypeOnly()) return;

          const ref = decl.getModuleReference();
          if (ref.getText().includes('SinglePageResponse')) {
            debugger;
          }
          if (!hasValueDeclarations(ref)) {
            const params = ref.getType().getTypeArguments();
            if (params.length) {
              const paramsStr = params.map((p: tm.TypeParameter) => p.getText()).join(', ');
              const bindingsStr = params
                .map((p: tm.TypeParameter) => p.getSymbol()?.getName() || p.getText())
                .join(', ');
              decl.replaceWithText(
                `export type ${decl.getName()}<${paramsStr}> = ${ref.getText()}<${bindingsStr}>`,
              );
            } else {
              decl.replaceWithText(`export type ${decl.getName()} = ${ref.getText()}`);
            }
          }
          break;
        }
        case tm.ts.SyntaxKind.Identifier: {
          const id = node as tm.Identifier;
          if (!addedBuffer && id.getText() === 'Buffer') {
            addedBuffer = true;
            file?.addVariableStatement({
              declarations: [
                {
                  name: 'Buffer',
                  type: 'any',
                },
              ],
              hasDeclareKeyword: true,
            });
            file?.addTypeAlias({
              name: 'Buffer',
              type: 'any',
            });
          }
          if (!addedProcess && id.getText() === 'process') {
            addedProcess = true;
            file?.addVariableStatement({
              declarations: [
                {
                  name: 'process',
                  type: 'any',
                },
              ],
              hasDeclareKeyword: true,
            });
          }
        }
      }
    });
  }

  project.save();
}

const nodeStdModules = new Set([
  'assert',
  'assertion_error',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'global',
  'http',
  'http2',
  'https',
  'inspector',
  'module_all',
  'module_esm',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'tty',
  'upstream_modules',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

const typeDeclarationKinds = new Set([
  tm.ts.SyntaxKind.InterfaceDeclaration,
  tm.ts.SyntaxKind.ModuleDeclaration,
  tm.ts.SyntaxKind.TypeAliasDeclaration,
]);

function hasValueDeclarations(nodes?: tm.Node): boolean;
function hasValueDeclarations(nodes?: tm.Node[]): boolean;
function hasValueDeclarations(nodes?: tm.Node | tm.Node[]): boolean {
  if (nodes && !Array.isArray(nodes)) {
    return hasValueDeclarations(nodes.getType().getSymbol()?.getDeclarations());
  }
  return nodes ? nodes.some((n) => !typeDeclarationKinds.has(n.getKind())) : false;
}

denoify();
