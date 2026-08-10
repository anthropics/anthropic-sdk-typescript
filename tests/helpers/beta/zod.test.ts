import * as z from 'zod/v4';
import { betaZodOutputFormat, betaZodTool } from '../../../src/helpers/beta/zod';

describe('zod helpers', () => {
  describe('zodTool', () => {
    it('creates a runnable tool with valid zod schema', () => {
      const fn = (args: { name: string; age?: number | undefined }) => `Hello, ${args.name}!`;

      const schema = z.object({
        name: z.string().describe('The name of the user'),
        age: z.number().optional().describe('The age of the user'),
      });

      const tool = betaZodTool({
        name: 'test_tool',
        inputSchema: schema,
        description: 'A test tool',
        run: fn,
      });

      expect(tool).toEqual({
        type: 'custom',
        name: 'test_tool',
        description: 'A test tool',
        input_schema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          additionalProperties: false,
          properties: {
            age: {
              type: 'number',
              description: 'The age of the user',
            },
            name: {
              type: 'string',
              description: 'The name of the user',
            },
          },
          required: ['name'],
          type: 'object',
        },
        parse: expect.any(Function),
        run: fn,
      });

      const input = { name: 'Alice', age: 30 };

      expect(tool.run(input)).toBe('Hello, Alice!');
      expect(tool.parse(input)).toEqual({ name: 'Alice', age: 30 });
    });

    it('throws error for non-object zod schema', () => {
      const schema = z.string();

      expect(() =>
        betaZodTool({
          name: 'invalid_tool',
          inputSchema: schema,
          description: 'Invalid tool',
          run: () => 'result',
        }),
      ).toThrow('Zod schema for tool "invalid_tool" must be an object, but got string');
    });

    it('throws parse error for invalid input', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const tool = betaZodTool({
        name: 'strict_tool',
        inputSchema: schema,
        description: 'Strict tool',
        run: (args) => args.name,
      });

      expect(() => tool.parse({ name: 'Alice' })).toThrow();
      expect(() => tool.parse({ name: 123, age: 30 })).toThrow();
      expect(() => tool.parse({})).toThrow();
    });

    it('handles async run functions', async () => {
      const schema = z.object({
        delay: z.number().default(0),
        message: z.string(),
      });

      const tool = betaZodTool({
        name: 'async_tool',
        inputSchema: schema,
        description: 'Async tool',
        run: async (args) => {
          await new Promise((resolve) => setTimeout(resolve, args.delay));
          return args.message;
        },
      });

      const result = await tool.run({ delay: 1, message: 'done' });
      expect(result).toBe('done');
    });
  });

  describe('betaZodOutputFormat', () => {
    it('preserves const discriminants after transformJSONSchema', () => {
      const format = betaZodOutputFormat(
        z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('set_title'), title: z.string() }),
          z.object({ kind: z.literal('add_members'), emails: z.array(z.string()) }),
        ]),
      );

      const schema = format.schema as {
        anyOf?: Array<{ properties?: { kind?: Record<string, unknown> } }>;
      };
      const kinds = (schema.anyOf ?? []).map((variant) => variant.properties?.kind);

      expect(kinds).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'string', const: 'set_title' }),
          expect.objectContaining({ type: 'string', const: 'add_members' }),
        ]),
      );
      for (const kind of kinds) {
        expect(kind?.description).toBeUndefined();
      }
    });
  });
});
