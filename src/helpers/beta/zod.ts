import type { infer as zodInfer, ZodType } from 'zod/v4';
import * as z from 'zod/v4';
import { Promisable, BetaRunnableTool } from '../../lib/tools/BetaRunnableTool';
import { BetaToolResultContentBlockParam } from '../../resources/beta';

/**
 * Creates a tool using the provided Zod schema that can be passed
 * into the `.toolRunner()` method. The Zod schema will automatically be
 * converted into JSON Schema when passed to the API. The provided function's
 * input arguments will also be validated against the provided schema.
 */
export function betaZodTool<InputSchema extends ZodType>(options: {
  name: string;
  inputSchema: InputSchema;
  description: string;
  run: (args: zodInfer<InputSchema>) => Promisable<string | Array<BetaToolResultContentBlockParam>>;
}): BetaRunnableTool<zodInfer<InputSchema>> {
  const jsonSchema = z.toJSONSchema(options.inputSchema, { reused: 'ref' });

  if (jsonSchema.type !== 'object') {
    throw new Error(`Zod schema for tool "${options.name}" must be an object, but got ${jsonSchema.type}`);
  }

  // TypeScript doesn't narrow the type after the runtime check, so we need to assert it
  const objectSchema = jsonSchema as typeof jsonSchema & { type: 'object' };

  return {
    type: 'custom',
    name: options.name,
    input_schema: objectSchema,
    description: options.description,
    run: options.run,
    parse: (args: unknown) => options.inputSchema.parse(args) as zodInfer<InputSchema>,
  };
}
