import { jsonSchemaOutputFormat } from '../../src/helpers/json-schema';
import { betaJSONSchemaOutputFormat } from '../../src/helpers/beta/json-schema';
import { transformJSONSchema } from '../../src/lib/transform-json-schema';

describe('schema sibling conjunctions', () => {
  it.each(['anyOf', 'oneOf', 'allOf'] as const)('retains a type beside %s', (keyword) => {
    const input = { type: 'integer', [keyword]: [{ type: 'number' }] };
    expect(transformJSONSchema(input)).toEqual({
      type: 'integer',
      [keyword === 'oneOf' ? 'anyOf' : keyword]: [{ type: 'number' }],
    });
  });

  it('keeps anyOf and allOf as independent constraints', () => {
    expect(
      transformJSONSchema({
        anyOf: [{ type: 'string' }, { type: 'number' }],
        allOf: [{ type: 'integer' }],
      }),
    ).toEqual({
      anyOf: [{ type: 'string' }, { type: 'number' }],
      allOf: [{ type: 'integer' }],
    });
  });

  it('conjoins the converted oneOf with an existing anyOf', () => {
    expect(
      transformJSONSchema({
        anyOf: [{ type: 'string' }, { type: 'integer' }],
        oneOf: [{ type: 'integer' }, { type: 'boolean' }],
        allOf: [{ type: 'number' }],
      }),
    ).toEqual({
      anyOf: [{ type: 'string' }, { type: 'integer' }],
      allOf: [{ type: 'number' }, { anyOf: [{ type: 'integer' }, { type: 'boolean' }] }],
    });
  });

  it('retains oneOf together with allOf when there is no anyOf', () => {
    expect(
      transformJSONSchema({
        oneOf: [{ type: 'string' }, { type: 'integer' }],
        allOf: [{ type: 'number' }],
      }),
    ).toEqual({
      anyOf: [{ type: 'string' }, { type: 'integer' }],
      allOf: [{ type: 'number' }],
    });
  });

  it('recurses through combined branches without mutating inputs', () => {
    const input = {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: { anyOf: [{ type: 'number' }], allOf: [{ type: 'integer', minimum: 1 }] },
        },
      },
      allOf: [{ type: 'object', properties: { label: { type: 'string', minLength: 2 } } }],
      $defs: { bounded: { type: 'integer', anyOf: [{ type: 'number' }] } },
    };
    const before = JSON.stringify(input);
    const result = transformJSONSchema(input);
    expect(result).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        values: {
          type: 'array',
          items: {
            anyOf: [{ type: 'number' }],
            allOf: [{ type: 'integer', description: '{minimum: 1}' }],
          },
        },
      },
      allOf: [
        {
          type: 'object',
          additionalProperties: false,
          properties: { label: { type: 'string', description: '{minLength: 2}' } },
        },
      ],
      $defs: { bounded: { type: 'integer', anyOf: [{ type: 'number' }] } },
    });
    expect(JSON.stringify(input)).toBe(before);
    expect(transformJSONSchema(result)).toEqual(result);
  });

  it.each(['stable', 'beta'] as const)('preserves conjunctions in the %s public helper', (surface) => {
    const input = {
      type: 'object',
      properties: {
        value: {
          type: 'integer',
          anyOf: [{ type: 'number' }, { type: 'string' }],
          allOf: [{ type: 'number' }],
        },
      },
      required: ['value'],
    } as const;
    const format = surface === 'beta' ? betaJSONSchemaOutputFormat(input) : jsonSchemaOutputFormat(input);
    expect(format.schema).toEqual({ ...input, additionalProperties: false });
    const untransformed =
      surface === 'beta' ?
        betaJSONSchemaOutputFormat(input, { transform: false })
      : jsonSchemaOutputFormat(input, { transform: false });
    expect(untransformed.schema).toEqual(input);
  });
});
