/**
 * Called from the `create-releases.yml` workflow with the output
 * of the release please action as the first argument.
 *
 * Example JSON input:
 *
 * ```json
 {
    "releases_created": "true",
    "release_created": "true",
    "id": "137967744",
    "name": "sdk: v0.14.5",
    "tag_name": "sdk-v0.14.5",
    "sha": "7cc2ba5c694e76a117f731d4cf0b06f8b8361f2e",
    "body": "## 0.14.5 (2024-01-22)\n\n...",
    "html_url": "https://github.com/$org/$repo/releases/tag/sdk-v0.14.5",
    "draft": "false",
    "upload_url": "https://uploads.github.com/repos/$org/$repo/releases/137967744/assets{?name,label}",
    "path": ".",
    "version": "0.14.5",
    "major": "0",
    "minor": "14",
    "patch": "5",
    "packages/additional-sdk--release_created": "true",
    "packages/additional-sdk--id": "137967756",
    "packages/additional-sdk--name": "additional-sdk: v0.5.2",
    "packages/additional-sdk--tag_name": "additional-sdk-v0.5.2",
    "packages/additional-sdk--sha": "7cc2ba5c694e76a117f731d4cf0b06f8b8361f2e",
    "packages/additional-sdk--body": "## 0.5.2 (2024-01-22)\n\n...",
    "packages/additional-sdk--html_url": "https://github.com/$org/$repo/releases/tag/additional-sdk-v0.5.2",
    "packages/additional-sdk--draft": "false",
    "packages/additional-sdk--upload_url": "https://uploads.github.com/repos/$org/$repo/releases/137967756/assets{?name,label}",
    "packages/additional-sdk--path": "packages/additional-sdk",
    "packages/additional-sdk--version": "0.5.2",
    "packages/additional-sdk--major": "0",
    "packages/additional-sdk--minor": "5",
    "packages/additional-sdk--patch": "2",
    "paths_released": "[\".\",\"packages/additional-sdk\"]"
  }
  ```
 */

import { execSync } from 'child_process';
import path from 'path';

function main() {
  const data = process.argv[2] ?? process.env['DATA'];
  if (!data) {
    throw new Error(`Usage: publish-packages.ts '{"json": "obj"}'`);
  }

  const rootDir = path.join(__dirname, '..');
  console.log('root dir', rootDir);
  console.log(`publish-packages called with ${data}`);

  const outputs = JSON.parse(data);

  const rawPaths = outputs.paths_released;

  if (!rawPaths) {
    console.error(JSON.stringify(outputs, null, 2));
    throw new Error('Expected outputs to contain a truthy `paths_released` property');
  }
  if (typeof rawPaths !== 'string') {
    console.error(JSON.stringify(outputs, null, 2));
    throw new Error('Expected outputs `paths_released` property to be a JSON string');
  }

  const paths = JSON.parse(rawPaths);
  if (!Array.isArray(paths)) {
    console.error(JSON.stringify(outputs, null, 2));
    throw new Error('Expected outputs `paths_released` property to be an array');
  }
  if (!paths.length) {
    console.error(JSON.stringify(outputs, null, 2));
    throw new Error('Expected outputs `paths_released` property to contain at least one entry');
  }

  const publishScriptPath = path.join(rootDir, 'bin', 'publish-npm');
  console.log('Using publish script at', publishScriptPath);

  console.log('Ensuring root package is built');
  console.log(`$ pnpm build`);
  execSync(`pnpm build`, { cwd: rootDir, encoding: 'utf8', stdio: 'inherit' });

  for (const relPackagePath of paths) {
    console.log('\n');

    const packagePath = path.join(rootDir, relPackagePath);
    console.log(`Publishing in directory: ${packagePath}`);

    console.log(`$ pnpm install`);
    execSync(`pnpm install`, { cwd: packagePath, encoding: 'utf8', stdio: 'inherit' });

    console.log(`$ bash ${publishScriptPath}`);
    execSync(`bash ${publishScriptPath}`, { cwd: packagePath, encoding: 'utf8', stdio: 'inherit' });
  }

  console.log('Finished publishing packages');
}

main();
