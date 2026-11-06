import { FromSchema, JSONSchema } from 'json-schema-to-ts';
import { Promisable, BetaRunnableTool, BetaToolRunContext } from '../../lib/tools/BetaRunnableTool';
import { BetaTool, BetaToolResultContentBlockParam } from '../../resources/beta';
import { AutoParseableBetaOutputFormat } from '../../lib/beta-parser';
import { AnthropicError } from '../..';
import { transformJSONSchema } from '../../lib/transform-json-schema';

type NoInfer<T> = T extends infer R ? R : never;

/**
 * Creates a Tool with a provided JSON schema that can be passed
 * to the `.toolRunner()` method. The schema is used to automatically validate
 * the input arguments for the tool.
 *
 * Every other field of the tool definition, such as `strict` or `cache_control`,
 * can be passed too and is sent to the API as given.
 */
export function betaTool<const Schema extends Exclude<JSONSchema, boolean> & { type: 'object' }>(
  options: {
    name: string;
    inputSchema: Schema;
    description: string;
    run: (
      args: NoInfer<FromSchema<Schema>>,
      context?: BetaToolRunContext,
    ) => Promisable<string | Array<BetaToolResultContentBlockParam>>;
    /**
     * Optional cleanup hook for tools that hold process-level resources (e.g. a
     * persistent shell). `client.beta.sessions.events.toolRunner` calls it once
     * when iteration ends.
     */
    close?: () => void | Promise<void>;
  } & Omit<BetaTool, 'type' | 'name' | 'description' | 'input_schema'>,
): BetaRunnableTool<NoInfer<FromSchema<Schema>>> {
  const { name, inputSchema, description, run, ...extraProps } = options;

  if (inputSchema.type !== 'object') {
    throw new Error(`JSON schema for tool "${name}" must be an object, but got ${inputSchema.type}`);
  }

  return {
    ...extraProps,
    type: 'custom',
    name,
    input_schema: inputSchema,
    description,
    run,
    parse: (content: unknown) => content as FromSchema<Schema>,
  } as any;
}

/**
 * Creates a JSON schema output format object from the given JSON schema.
 * If this is passed to the `.parse()` method then the response message will contain a
 * `.parsed_output` property that is the result of parsing the content with the given JSON schema.
 *
 */
export function betaJSONSchemaOutputFormat<
  const Schema extends Exclude<JSONSchema, boolean> & { type: 'object' },
>(
  jsonSchema: Schema,
  options?: {
    transform?: boolean;
  },
): AutoParseableBetaOutputFormat<NoInfer<FromSchema<Schema>>> {
  if (jsonSchema.type !== 'object') {
    throw new Error(`JSON schema for tool must be an object, but got ${jsonSchema.type}`);
  }

  const transform = options?.transform ?? true;
  if (transform) {
    // todo: doing this is arguably necessary, but it does change the schema the user passed in
    // so I'm not sure how we should handle that
    jsonSchema = transformJSONSchema(jsonSchema) as Schema;
  }

  return {
    type: 'json_schema',
    schema: {
      ...jsonSchema,
    },
    parse: (content) => {
      try {
        return JSON.parse(content);
      } catch (error) {
        throw new AnthropicError(`Failed to parse structured output: ${error}`);
      }
    },
  };
}
