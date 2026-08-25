import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EdgeRuntime } from 'edge-runtime';

const CASES = 9; // keep in sync with shared/cases.ts

// EdgeRuntime evaluates classic scripts in a VM with web APIs only (no require, Buffer, fs), so
// the SDK is bundled into an IIFE exposing the module as `edgeFunction`, the way `vercel dev`
// bundles an edge function before running it under this same runtime. Like Vercel, expose
// `process.env` and nothing else of `process`.
const runtime = new EdgeRuntime({
  extend: (context) => Object.assign(context, { process: { env: { ...process.env } } }),
});
runtime.evaluate(readFileSync(new URL('../dist/handler.js', import.meta.url), 'utf8'));
runtime.evaluate(
  `addEventListener('fetch', (event) => event.respondWith(edgeFunction.default(event.request)))`,
);

async function dispatch(query) {
  const response = await runtime.dispatchFetch(`https://edge.test/api${query}`);
  const body = await response.json();
  await response.waitUntil();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}

test('the VM really is the edge runtime, not Node', () => {
  assert.equal(runtime.evaluate('typeof EdgeRuntime'), 'string');
  assert.equal(runtime.evaluate('typeof require'), 'undefined');
  assert.equal(runtime.evaluate('typeof Buffer'), 'undefined');
  assert.equal(runtime.evaluate('typeof process.version'), 'undefined');
});

// one test per shared case, each run inside the VM by src/handler.ts
const names = await dispatch('');
assert.equal(names.length, CASES, 'every case in shared/cases.ts is listed');
for (const name of names) test(name, () => dispatch(`?case=${encodeURIComponent(name)}`));
