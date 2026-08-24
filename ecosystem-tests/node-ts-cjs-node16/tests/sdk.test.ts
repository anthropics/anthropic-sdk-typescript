import { test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { cases } from '../shared/cases';

const client = new Anthropic();

for (const [name, run] of Object.entries(cases)) test(name, () => run(client));
