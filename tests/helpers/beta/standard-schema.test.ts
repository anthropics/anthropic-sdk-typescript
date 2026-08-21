import * as v from 'valibot';
import { z } from 'zod/v4';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import { AnthropicError } from '../../../src/core/error';
import {
  betaStandardSchemaOutputFormat,
  betaStandardSchemaTool,
} from '../../../src/helpers/beta/standard-schema';
import type { StandardSchemaV1 } from '../../../src/lib/standard-schema';
import { Messages } from '../../../src/resources/beta/messages/messages';

type Weather = { city: string; temperature: number };

const weatherJSONSchema = {
  type: 'object',
  properties: { city: { type: 'string' }, temperature: { type: 'number' } },
  required: ['city', 'temperature'],
};

// A minimal hand-rolled Standard Schema (validate only, no `~standard.jsonSchema`).
function validateOnlySchema(
  validate: StandardSchemaV1.Props<unknown, Weather>['validate'],
): StandardSchemaV1<unknown, Weather> {
  return { '~standard': { version: 1, vendor: 'test', validate } };
}

const weatherValidator: StandardSchemaV1.Props<unknown, Weather>['validate'] = (value) => {
  const input = value as any;
  const issues: StandardSchemaV1.Issue[] = [];
  if (typeof input?.city !== 'string') issues.push({ message: 'Expected string', path: ['city'] });
  if (typeof input?.temperature !== 'number') {
    issues.push({ message: 'Expected number', path: [{ key: 'temperature' }] });
  }
  return issues.length ? { issues } : { value: input as Weather };
};

describe('betaStandardSchemaOutputFormat', () => {
  it('derives a strict JSON schema from Standard JSON Schema and parses with the validator (valibot)', () => {
    const schema = toStandardJsonSchema(
      v.object({
        city: v.string(),
        temperature: v.number(),
        conditions: v.optional(v.array(v.string()), []),
      }),
    );

    const format = betaStandardSchemaOutputFormat(schema);

    expect(format.type).toBe('json_schema');
    expect(format.schema).toMatchObject({
      type: 'object',
      properties: {
        city: { type: 'string' },
        temperature: { type: 'number' },
        conditions: { type: 'array', items: { type: 'string' } },
      },
      required: ['city', 'temperature'],
      additionalProperties: false,
    });

    const parsed = format.parse('{"city":"San Francisco","temperature":72}');
    expect(parsed).toEqual({ city: 'San Francisco', temperature: 72, conditions: [] });
    // output type is inferred from the schema
    parsed.conditions satisfies string[];
  });

  it('derives the JSON schema from zod natively (no `jsonSchema` option)', () => {
    const format = betaStandardSchemaOutputFormat(z.object({ name: z.string(), age: z.number().optional() }));

    expect(format.schema).toMatchObject({ type: 'object', required: ['name'], additionalProperties: false });
    expect(format.parse('{"name":"Ada"}')).toEqual({ name: 'Ada' });
    expect(() => format.parse('{"name":1}')).toThrow(
      /Schema validation failed with 1 issue\(s\):\n  - name: /,
    );
  });

  it('uses an explicit `jsonSchema` over the derived one', () => {
    const format = betaStandardSchemaOutputFormat(validateOnlySchema(weatherValidator), {
      jsonSchema: weatherJSONSchema,
    });

    expect(format.schema).toEqual({ ...weatherJSONSchema, additionalProperties: false });
    expect(format.parse('{"city":"Berlin","temperature":20}')).toEqual({ city: 'Berlin', temperature: 20 });

    const derivable = toStandardJsonSchema(v.object({ ignored: v.string() }));
    expect(betaStandardSchemaOutputFormat(derivable, { jsonSchema: weatherJSONSchema }).schema).toEqual(
      format.schema,
    );
  });

  it('throws a helpful error when no JSON schema can be derived', () => {
    expect(() => betaStandardSchemaOutputFormat(validateOnlySchema(weatherValidator))).toThrow(
      /Could not derive a JSON Schema from this test schema.*`jsonSchema` option/,
    );
  });

  it('formats validation issues into an AnthropicError', () => {
    const format = betaStandardSchemaOutputFormat(validateOnlySchema(weatherValidator), {
      jsonSchema: weatherJSONSchema,
    });

    expect(() => format.parse('{"city":1}')).toThrow(AnthropicError);
    expect(() => format.parse('{"city":1}')).toThrow(
      'Schema validation failed with 2 issue(s):\n  - city: Expected string\n  - temperature: Expected number',
    );

    const rootIssue = betaStandardSchemaOutputFormat(
      validateOnlySchema(() => ({ issues: [{ message: 'Expected object' }] })),
      { jsonSchema: weatherJSONSchema },
    );
    expect(() => rootIssue.parse('1')).toThrow(
      'Schema validation failed with 1 issue(s):\n  - Expected object',
    );
  });

  it('truncates long issue lists', () => {
    const issues = Array.from({ length: 7 }, (_, i) => ({ message: `bad ${i}`, path: ['items', i] }));
    const format = betaStandardSchemaOutputFormat(
      validateOnlySchema(() => ({ issues })),
      { jsonSchema: weatherJSONSchema },
    );

    expect(() => format.parse('{}')).toThrow(/  - items\.4: bad 4\n  \.\.\. and 2 more issue\(s\)$/);
  });

  it('throws on invalid JSON', () => {
    const format = betaStandardSchemaOutputFormat(validateOnlySchema(weatherValidator), {
      jsonSchema: weatherJSONSchema,
    });

    expect(() => format.parse('{"incomplete": ')).toThrow(/Failed to parse structured output as JSON/);
  });

  it('rejects async validation', () => {
    const format = betaStandardSchemaOutputFormat(
      validateOnlySchema(async (value) => ({ value: value as Weather })),
      { jsonSchema: weatherJSONSchema },
    );

    expect(() => format.parse('{"city":"Oslo","temperature":3}')).toThrow(
      /Async validation is not supported/,
    );
  });
});

describe('beta Messages.parse() with betaStandardSchemaOutputFormat', () => {
  it('sends the derived schema and attaches parsed_output', async () => {
    const mockPost = jest.fn().mockResolvedValue({
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-latest',
      content: [{ type: 'text', text: '{"city":"San Francisco","temperature":72}' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 25 },
    });
    const messages = new Messages({
      post: mockPost,
      calculateNonstreamingTimeout: jest.fn().mockReturnValue(600000),
      _options: { timeout: null },
    } as any);

    const result = await messages.parse({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'What is the weather in SF?' }],
      output_config: {
        format: betaStandardSchemaOutputFormat(
          toStandardJsonSchema(v.object({ city: v.string(), temperature: v.number() })),
        ),
      },
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/v1/messages?beta=true',
      expect.objectContaining({
        body: expect.objectContaining({
          output_config: {
            format: expect.objectContaining({
              type: 'json_schema',
              schema: expect.objectContaining({ type: 'object', required: ['city', 'temperature'] }),
            }),
          },
        }),
      }),
    );
    expect(result.parsed_output).toEqual({ city: 'San Francisco', temperature: 72 });
    result.parsed_output satisfies { city: string; temperature: number } | null;
  });
});

describe('betaStandardSchemaTool', () => {
  it('creates a runnable tool from a Standard Schema (valibot)', () => {
    const fn = (args: { name: string; age?: number | undefined }) => `Hello, ${args.name}!`;

    const tool = betaStandardSchemaTool({
      name: 'test_tool',
      inputSchema: toStandardJsonSchema(
        v.object({
          name: v.pipe(v.string(), v.description('The name of the user')),
          age: v.optional(v.number()),
        }),
      ),
      description: 'A test tool',
      run: fn,
    });

    expect(tool).toEqual({
      type: 'custom',
      name: 'test_tool',
      description: 'A test tool',
      input_schema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The name of the user' },
          age: { type: 'number' },
        },
        required: ['name'],
      },
      parse: expect.any(Function),
      run: fn,
    });

    expect(tool.parse({ name: 'Alice', age: 30 })).toEqual({ name: 'Alice', age: 30 });
    expect(tool.run(tool.parse({ name: 'Alice' }))).toBe('Hello, Alice!');
  });

  it('validates input and reports issues with paths', () => {
    const tool = betaStandardSchemaTool({
      name: 'strict_tool',
      inputSchema: toStandardJsonSchema(v.object({ user: v.object({ name: v.string(), age: v.number() }) })),
      description: 'Strict tool',
      run: (args) => args.user.name,
    });

    expect(() => tool.parse({ user: { name: 'Alice' } })).toThrow(AnthropicError);
    expect(() => tool.parse({ user: { name: 123, age: 30 } })).toThrow(/ - user\.name: /);
    expect(() => tool.parse({})).toThrow();
  });

  it('applies schema defaults/transforms before `run`', async () => {
    const tool = betaStandardSchemaTool({
      name: 'defaults_tool',
      inputSchema: toStandardJsonSchema(v.object({ message: v.string(), repeat: v.optional(v.number(), 2) })),
      description: 'Defaults tool',
      run: async (args) => args.message.repeat(args.repeat),
    });

    expect(await tool.run(tool.parse({ message: 'ab' }))).toBe('abab');
  });

  it('uses an explicit `jsonSchema` for validate-only schemas', () => {
    const inputSchema: StandardSchemaV1<unknown, { name: string }> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: any) =>
          typeof value?.name === 'string' ?
            { value }
          : { issues: [{ message: 'Expected string', path: ['name'] }] },
      },
    };
    const jsonSchema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };

    const tool = betaStandardSchemaTool({
      name: 'explicit_tool',
      inputSchema,
      jsonSchema,
      description: 'Explicit schema tool',
      run: (args) => args.name,
    });

    expect(tool).toMatchObject({ input_schema: jsonSchema });
    expect(tool.parse({ name: 'Bob' })).toEqual({ name: 'Bob' });
    expect(() => tool.parse({ name: 1 })).toThrow(/ - name: Expected string/);
  });

  it('throws for non-object schemas', () => {
    expect(() =>
      betaStandardSchemaTool({
        name: 'invalid_tool',
        inputSchema: toStandardJsonSchema(v.string()),
        description: 'Invalid tool',
        run: () => 'result',
      }),
    ).toThrow('Schema for tool "invalid_tool" must be an object, but got string');
  });
});
