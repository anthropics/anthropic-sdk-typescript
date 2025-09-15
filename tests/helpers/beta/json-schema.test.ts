import { betaTool } from '../../../src/helpers/beta/json-schema';

describe('json-schema helpers', () => {
  describe('tool', () => {
    it('creates a runnable tool with valid JSON schema', () => {
      const fn = (args: { name: string; age?: number }) => `Hello, ${args.name}!`;

      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      } as const;

      const t = betaTool({
        name: 'test_tool',
        inputSchema: schema,
        description: 'A test tool',
        run: fn,
      });

      expect(t).toEqual({
        type: 'custom',
        name: 'test_tool',
        input_schema: schema,
        description: 'A test tool',
        run: fn,
        parse: expect.any(Function),
      });

      const input = { name: 'Alice', age: 30 };

      expect(t.run(input)).toBe('Hello, Alice!');
      expect(t.parse(input)).toEqual({ name: 'Alice', age: 30 });
    });

    it('throws error for non-object schema', () => {
      const schema = {
        type: 'string',
      } as const;

      expect(() =>
        betaTool({
          name: 'invalid_tool',
          // @ts-expect-error - testing invalid schema
          inputSchema: schema,
          description: 'Invalid tool',
          run: () => 'result',
        }),
      ).toThrow('JSON schema for tool "invalid_tool" must be an object, but got string');
    });

    it('handles async run functions', async () => {
      const schema = {
        type: 'object',
        properties: {
          delay: { type: 'number' },
        },
      } as const;

      const t = betaTool({
        name: 'async_tool',
        inputSchema: schema,
        description: 'Async tool',
        run: async (args) => {
          await new Promise((resolve) => setTimeout(resolve, args.delay || 0));
          return 'done';
        },
      });

      const result = await t.run({ delay: 1 });
      expect(result).toBe('done');
    });
  });
});
