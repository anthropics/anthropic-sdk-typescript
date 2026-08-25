// Runs dist/<bundler>/main.* from a temp copy: run in place, an SDK import a bundler left
// external would still resolve from ./node_modules and the bundle would look complete.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'ecosystem-bundle-'));
let status = 0;
try {
  cpSync(process.argv[2], dir, { recursive: true });
  for (const entry of readdirSync(dir).filter((f) => /^main\.[cm]?js$/.test(f))) {
    console.log(`> node ${path.join(process.argv[2], entry)} (copied to ${dir})`);
    status ||= spawnSync(process.execPath, [path.join(dir, entry)], { stdio: 'inherit' }).status ?? 1;
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(status);
