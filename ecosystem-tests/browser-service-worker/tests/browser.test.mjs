import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CASES = 10; // keep in sync: shared/cases.ts plus the one in src/sw.ts
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript' };
// webpack's output for target 'webworker' is a classic script
const workers = [
  { script: 'dist/esbuild-split/sw.js', type: 'module' },
  { script: 'dist/esbuild-single/sw.js', type: 'module' },
  { script: 'dist/webpack/sw.js', type: 'classic' },
];

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(root, path.normalize(new URL(req.url ?? '/', 'http://x').pathname));
    if (!file.startsWith(root) || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': contentTypes[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** Registers the worker from a blank page and, once it is active, asks it to run the cases. */
async function runWorker({ script, type }) {
  const server = await serve();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const logs = [];
  try {
    const page = await browser.newPage();
    page.on('console', (m) => logs.push(`console.${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`pageerror: ${e.stack ?? e}`));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.evaluate(
      async ({ script, type }) => {
        navigator.serviceWorker.addEventListener('message', (event) => (window.__results = event.data));
        const registration = await navigator.serviceWorker.register(script, { type });
        const worker = registration.installing ?? registration.waiting ?? registration.active;
        while (worker.state !== 'activated') {
          if (worker.state === 'redundant') throw new Error('the service worker failed to install');
          await new Promise((resolve) => worker.addEventListener('statechange', resolve, { once: true }));
        }
        worker.postMessage('run');
      },
      { script, type },
    );
    await page.waitForFunction(() => window.__results, null, { timeout: 30_000 });
    return { results: await page.evaluate(() => window.__results), logs };
  } catch (e) {
    throw new Error(`${e}\n--- browser console ---\n${logs.join('\n')}`);
  } finally {
    await browser.close();
    server.close();
  }
}

for (const worker of workers) {
  test(`SDK bundle runs in a Chromium service worker: ${worker.script}`, async () => {
    const { results, logs } = await runWorker(worker);
    const failures = results.filter((r) => !r.ok);
    assert.deepEqual(failures, [], `${failures.length} case(s) failed\n--- browser console ---\n${logs.join('\n')}`);
    assert.equal(results.length, CASES, 'every case in src/sw.ts reported');
  });
}
