import { FromSchema, JSONSchema } from 'json-schema-to-ts';
import { Promisable, BetaRunnableTool } from '../../lib/tools/BetaRunnableTool';
import { BetaToolResultContentBlockParam } from '../../resources/beta';

type NoInfer<T> = T extends infer R ? R : never;

/**
 * Creates a Tool with a provided JSON schema that can be passed
 * to the `.toolRunner()` method. The schema is used to automatically validate
 * the input arguments for the tool.
 */
export function betaTool<const Schema extends Exclude<JSONSchema, boolean> & { type: 'object' }>(options: {
  name: string;
  inputSchema: Schema;
  description: string;
  run: (args: NoInfer<FromSchema<Schema>>) => Promisable<string | Array<BetaToolResultContentBlockParam>>;
}): BetaRunnableTool<NoInfer<FromSchema<Schema>>> {
  if (options.inputSchema.type !== 'object') {
    throw new Error(
      `JSON schema for tool "${options.name}" must be an object, but got ${options.inputSchema.type}`,
    );
  }

  return {
    type: 'custom',
    name: options.name,
    input_schema: options.inputSchema,
    description: options.description,
    run: options.run,
    parse: (content: unknown) => content as FromSchema<Schema>,
  } as any;
}
