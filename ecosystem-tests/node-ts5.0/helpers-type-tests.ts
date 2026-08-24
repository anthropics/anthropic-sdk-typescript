// Dependency-free helper subpaths, checked in their own step so a helper-only break stays
// distinguishable from the core entrypoints (helpers/zod is left out: it needs zod installed).
import { betaTool, betaJSONSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { betaMemoryTool } from '@anthropic-ai/sdk/helpers/beta/memory';

export const weather = betaTool({
  name: 'get_weather',
  description: 'Get the weather',
  inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
  run: ({ city }) => `sunny in ${city.toUpperCase()}`,
});
export const format = jsonSchemaOutputFormat({ type: 'object', properties: { n: { type: 'number' } } });
void [betaJSONSchemaOutputFormat, betaMemoryTool];
