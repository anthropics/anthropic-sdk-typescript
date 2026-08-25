// What pnpm's isolated node_modules must still resolve; the common checks are in shared/type-tests.ts.
import Anthropic from '@anthropic-ai/sdk';
// its .d.ts imports `json-schema-to-ts`, a declared dependency that pnpm's isolated layout
// only exposes next to the SDK's real path; resolving it proves the dependency is declared
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';

const client = new Anthropic();
const messages = [{ role: 'user' as const, content: 'Hi' }];

export async function typedOutput() {
  const format = jsonSchemaOutputFormat({
    type: 'object',
    properties: { answer: { type: 'number' } },
    required: ['answer'],
    additionalProperties: false,
  });
  const parsed = await client.messages.parse({
    model: 'mock-model',
    max_tokens: 1,
    messages,
    output_config: { format },
  });
  const answer: number | undefined = parsed.parsed_output?.answer;
  void answer;
  // @ts-expect-error parsed_output is typed from the schema: no such property
  parsed.parsed_output?.question;
  // @ts-expect-error the schema root must be an object
  jsonSchemaOutputFormat({ type: 'string' });
}
