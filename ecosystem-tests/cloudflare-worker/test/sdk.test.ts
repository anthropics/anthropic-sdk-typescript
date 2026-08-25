// Runs inside workerd via @cloudflare/vitest-pool-workers, so every SDK call in the shared cases
// uses the Workers runtime's fetch, streams, Blob and FormData rather than Node's.
import { env } from 'cloudflare:workers';
import { test } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { cases } from '../shared/cases';

const client = new Anthropic({ baseURL: env.ANTHROPIC_BASE_URL, apiKey: env.ANTHROPIC_API_KEY });

for (const [name, run] of Object.entries(cases)) test(name, () => run(client));
