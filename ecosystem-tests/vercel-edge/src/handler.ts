// Shaped like a Vercel Edge Function: web Request in, web Response out, no Node.js APIs.
// ?case=<name> runs that shared case inside the edge VM and reports how it went; without it the
// response lists the case names, for tests/edge.test.mjs to drive them from outside the VM.
import Anthropic from '@anthropic-ai/sdk';
import { cases } from '../shared/cases';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const name = new URL(request.url).searchParams.get('case');
  if (name === null) return Response.json(Object.keys(cases));
  const run = cases[name];
  if (!run) return Response.json({ error: `unknown case ${name}` }, { status: 404 });
  // Vercel's edge runtime provides `process.env` (and no other part of `process`); the SDK reads
  // ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY from it just as a deployed function would
  const client = new Anthropic();
  try {
    await run(client);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String((err as Error)?.stack ?? err) }, { status: 500 });
  }
}
