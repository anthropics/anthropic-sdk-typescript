// Runs "Are The Types Wrong?" against the built package and writes the
// problems to .attw.json for attw-report.cjs to filter and report.
//
// We use @arethetypeswrong/core directly instead of the CLI to reduce the number of deps we have.
import { createPackageFromTarballData, checkPackage } from '@arethetypeswrong/core';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] ?? 'dist';
const manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
const tgz = path.join(dir, `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`);

execSync('npm pack', { cwd: dir, stdio: 'ignore' });
try {
  const analysis = await checkPackage(createPackageFromTarballData(new Uint8Array(readFileSync(tgz))));
  writeFileSync('.attw.json', JSON.stringify({ problems: analysis.problems ?? [] }));
} finally {
  unlinkSync(tgz);
}
