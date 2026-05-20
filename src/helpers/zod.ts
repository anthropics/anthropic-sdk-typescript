import { transformJSONSchema } from '../lib/transform-json-schema';
import * as z from 'zod/v4';
import { AnthropicError } from '../core/error';
import { AutoParseableOutputFormat } from '../lib/parser';
import { Promisable, RunnableTool, ToolRunContext } from '../lib/tools/RunnableTool';
import { ToolResultBlockParam } from '../resources/messages';

/**
 * Creates a JSON schema output format object from the given Zod schema.
 *
 * If this is passed to the `.parse()` method then the response message will contain a
 * `.parsed_output` property that is the result of parsing the content with the given Zod object.
 *
 * This can be passed directly to the `.create()` method but will not
 * result in any automatic parsing, you'll have to parse the response yourself.
 */
export function zodOutputFormat<ZodInput extends z.ZodType>(
  zodObject: ZodInput,
): AutoParseableOutputFormat<z.infer<ZodInput>> {
  let jsonSchema = z.toJSONSchema(zodObject, { reused: 'ref' });

  jsonSchema = transformJSONSchema(jsonSchema);

  return {
    type: 'json_schema',
    schema: {
      ...jsonSchema,
    },
    parse: (content) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        throw new AnthropicError(
          `Failed to parse structured output as JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      const output = zodObject.safeParse(parsed);

      if (!output.success) {
        const formattedIssues = output.error.issues
          .slice(0, 5)
          .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
          .join('\n');
        const issueCount = output.error.issues.length;
        const suffix = issueCount > 5 ? `\n  ... and ${issueCount - 5} more issue(s)` : '';

        throw new AnthropicError(
          `Failed to parse structured output: ${output.error.message}\nValidation issues:\n${formattedIssues}${suffix}`,
        );
      }

      return output.data;
    },
  };
}

/**
 * Creates a tool using the provided Zod schema for use with the non-beta
 * `messages.create` / `messages.stream` API. The Zod schema is automatically
 * converted to JSON Schema and passed to the API. The `run` callback is invoked
 * with Zod-validated input, and `parse` can be used to validate raw tool inputs
 * before calling `run` manually.
 *
 * The returned `RunnableTool` is a `Tool` and is directly assignable to the
 * `tools` array accepted by `messages.create` and `messages.stream`.
 */
export function zodTool<InputSchema extends z.ZodType>(options: {
  name: string;
  inputSchema: InputSchema;
  description: string;
  run: (
    args: z.infer<InputSchema>,
    context?: ToolRunContext,
  ) => Promisable<string | Array<ToolResultBlockParam>>;
}): RunnableTool<z.infer<InputSchema>> {
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
    parse: (args: unknown) => options.inputSchema.parse(args) as z.infer<InputSchema>,
  } as RunnableTool<z.infer<InputSchema>>;
}
