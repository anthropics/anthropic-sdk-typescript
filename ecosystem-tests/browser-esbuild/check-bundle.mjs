// A browser bundle of the SDK must be self-contained: any import left in the output means
// Node-only code leaked into the browser build.
import * as fs from 'node:fs';

const problems = [];
for (const bundle of ['dist/main.js', 'dist/main.iife.js']) {
  const { imports } = JSON.parse(fs.readFileSync(`${bundle}.meta.json`, 'utf8'));
  for (const { path, kind } of imports) problems.push(`${bundle}: ${kind} ${path}`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('ok');
