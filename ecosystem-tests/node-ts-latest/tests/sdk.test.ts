// run directly by Node with type stripping: only erasable syntax, `import type` for type-only
// imports, and a relative import names the real .ts file (allowImportingTsExtensions)
import { test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { cases } from '../shared/cases.ts';

const client = new Anthropic();

for (const [name, run] of Object.entries(cases)) test(name, () => run(client));
