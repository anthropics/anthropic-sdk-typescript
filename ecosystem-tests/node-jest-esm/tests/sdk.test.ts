import { test } from '@jest/globals';
import Anthropic from '@anthropic-ai/sdk';
import { cases } from '../shared/cases.js';

const client = new Anthropic();

for (const [name, run] of Object.entries(cases)) test(name, () => run(client));
