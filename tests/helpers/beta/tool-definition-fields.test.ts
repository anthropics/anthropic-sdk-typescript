import Anthropic from '@anthropic-ai/sdk';
import * as z from 'zod/v4';
import { betaTool } from '../../../src/helpers/beta/json-schema';
import { betaMemoryTool, type MemoryToolHandlers } from '../../../src/helpers/beta/memory';
import { betaStandardSchemaTool } from '../../../src/helpers/beta/standard-schema';
import { betaZodTool } from '../../../src/helpers/beta/zod';
import type { BetaRunnableTool } from '../../../src/lib/tools/BetaRunnableTool';
import { mockFetch } from '../../lib/mock-fetch';

const shared = {
  allowed_callers: ['direct' as const],
  cache_control: { type: 'ephemeral' as const },
  defer_loading: true,
  input_examples: [{ city: 'Paris' }],
  strict: true,
};
const custom = { ...shared, eager_input_streaming: true };

const base = { name: 'get_weather', description: 'Get the weather', run: () => 'Sunny', close: () => {} };
const zodSchema = z.object({ city: z.string() });

const tools: Array<[string, BetaRunnableTool, Record<string, unknown>]> = [
  ['betaZodTool', betaZodTool({ ...base, inputSchema: zodSchema, ...custom }), custom],
  ['betaStandardSchemaTool', betaStandardSchemaTool({ ...base, inputSchema: zodSchema, ...custom }), custom],
  [
    'betaTool',
    betaTool({
      ...base,
      inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
      ...custom,
    }),
    custom,
  ],
  ['betaMemoryTool', betaMemoryTool({} as MemoryToolHandlers, shared), shared],
];

describe('tool definition fields', () => {
  it.each(tools)('%s sends them through the tool runner', async (_helper, tool, fields) => {
    const { fetch, handleRequest } = mockFetch();
    const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

    let body: any;
    handleRequest(async (_req, init) => {
      body = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Done.' }],
          model: 'claude-opus-4-8',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    });

    await anthropic.beta.messages.toolRunner({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
      tools: [tool],
    });

    expect(body.tools).toHaveLength(1);
    expect(body.tools[0]).toMatchObject({ name: tool.name, type: tool.type, ...fields });
    expect(body.tools[0]).not.toHaveProperty('close');
  });

  it.each(tools.filter(([helper]) => helper !== 'betaMemoryTool'))(
    '%s keeps the close hook',
    (_helper, tool) => {
      expect(tool.close).toBe(base.close);
    },
  );
});
