import { transformJSONSchema } from '../..//lib/transform-json-schema';
import type { infer as zodInfer, ZodType } from 'zod';
import * as z from 'zod/v4';
import { AnthropicError } from '../../core/error';
import { AutoParseableBetaOutputFormat } from '../../lib/beta-parser';
import { BetaRunnableTool, BetaToolRunContext, Promisable } from '../../lib/tools/BetaRunnableTool';
import { BetaToolResultContentBlockParam } from '../../resources/beta';
import type { Tool } from '../../resources/messages/messages';
/**
 * Creates a JSON schema output format object from the given Zod schema.
 *
 * If this is passed to the `.parse()` method then the response message will contain a
 * `.parsed_output` property that is the result of parsing the content with the given Zod object.
 *
 * This can be passed directly to the `.create()` method but will not
 * result in any automatic parsing, you'll have to parse the response yourself.
 */
export function betaZodOutputFormat<ZodInput extends ZodType>(
  zodObject: ZodInput,
): AutoParseableBetaOutputFormat<zodInfer<ZodInput>> {
  let jsonSchema = z.toJSONSchema(zodObject, { reused: 'ref' });

  jsonSchema = transformJSONSchema(jsonSchema);

  return {
    type: 'json_schema',
    schema: {
      ...jsonSchema,
    },
    parse: (content) => {
      const output = zodObject.safeParse(JSON.parse(content));

      if (!output.success) {
        throw new AnthropicError(
          `Failed to parse structured output: ${output.error.message} cause: ${output.error.issues}`,
        );
      }

      return output.data;
    },
  };
}

/**
 * Creates a tool using the provided Zod schema that can be passed
 * into the `.toolRunner()` method or used directly with `messages.create` /
 * `messages.stream`.
 *
 * When used with `.toolRunner()`, the tool's `run` function is invoked
 * automatically each time the model calls the tool.
 *
 * When used with `messages.create` / `messages.stream`, the tool definition
 * is sent to the API for the model to reference; you must inspect the response
 * for `tool_use` content blocks and call the tool yourself — the SDK does not
 * auto-execute tools in that flow.
 *
 * The Zod schema will automatically be converted into JSON Schema when passed
 * to the API. The provided function's input arguments will also be validated
 * against the provided schema.
 */
export function betaZodTool<InputSchema extends ZodType>(options: {
  name: string;
  inputSchema: InputSchema;
  description: string;
  run: (
    args: zodInfer<InputSchema>,
    context?: BetaToolRunContext,
  ) => Promisable<string | Array<BetaToolResultContentBlockParam>>;
}): BetaRunnableTool<zodInfer<InputSchema>> & Tool {
  const jsonSchema = z.toJSONSchema(options.inputSchema, { reused: 'ref' });

  if (jsonSchema.type !== 'object') {
    throw new Error(`Zod schema for tool "${options.name}" must be an object, but got ${jsonSchema.type}`);
  }

  // TypeScript doesn't narrow the type after the runtime check, so we need to assert it.
  // Casting to Tool.InputSchema (a structural subtype of BetaTool.InputSchema) lets the
  // return value satisfy both BetaRunnableTool<T> and Tool without a broad `unknown` cast.
  const objectSchema = jsonSchema as Tool.InputSchema;

  return {
    type: 'custom',
    name: options.name,
    input_schema: objectSchema,
    description: options.description,
    run: options.run,
    parse: (args: unknown) => options.inputSchema.parse(args) as zodInfer<InputSchema>,
  };
}
