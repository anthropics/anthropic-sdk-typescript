import { copyFileSync, constants, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Extract only this example's two complete TypeScript fences into a fresh project.
const directory = process.argv[2];
if (!directory) {
  throw new Error('Usage: node extract-loom-example.mjs <existing empty directory>');
}
for (const [document, filename] of [
  ['loom.md', 'loom-memory.ts'],
  ['loom.test.md', 'loom-memory.test.ts'],
]) {
  const markdown = readFileSync(new URL(document, import.meta.url), 'utf8');
  const fences = [...markdown.matchAll(/^```typescript\r?\n([\s\S]*?)^```$/gm)];
  if (fences.length !== 1) {
    throw new Error(`${document} must contain exactly one complete TypeScript fence.`);
  }
  writeFileSync(join(directory, filename), fences[0][1], { flag: 'wx' });
}
copyFileSync(
  new URL('loom-project.json', import.meta.url),
  join(directory, 'tsconfig.json'),
  constants.COPYFILE_EXCL,
);
