import { transformJSONSchema } from '../../src/lib/transform-json-schema';
import { jsonSchemaOutputFormat } from '../../src/helpers/json-schema';

describe('type-array schema constraints', () => {
  it('preserves required fields on a nullable object through the public output helper', () => {
    const input = {
      type: 'object',
      properties: {
        result: {
          type: ['object', 'null'],
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: false,
        },
      },
      required: ['result'],
      additionalProperties: false,
    } as const;
    const original = JSON.parse(JSON.stringify(input));
    expect(jsonSchemaOutputFormat(input).schema).toEqual(input);
    expect(input).toEqual(original);
  });

  it('preserves item validation and supported minimum length on nullable arrays', () => {
    const input = { type: ['array', 'null'], items: { type: 'integer' }, minItems: 1 };
    expect(transformJSONSchema(input)).toEqual(input);
  });

  it('preserves supported string formats on nullable strings', () => {
    const input = { type: ['string', 'null'], format: 'date-time' };
    expect(transformJSONSchema(input)).toEqual(input);
  });

  it('transforms each applicable constraint in an object/array union', () => {
    const input = {
      type: ['object', 'array'],
      properties: { name: { type: 'string' } },
      required: ['name'],
      items: { type: 'object', properties: { id: { type: 'integer' } } },
    };
    expect(transformJSONSchema(input)).toEqual({
      ...input,
      additionalProperties: false,
      items: { ...input.items, additionalProperties: false },
    });
  });

  it('applies normal transformation to single-element type arrays', () => {
    expect(transformJSONSchema({ type: ['object'], properties: {} })).toEqual({
      type: ['object'],
      properties: {},
      additionalProperties: false,
    });
  });

  it('still demotes unsupported constraints and does not mutate nested inputs', () => {
    const input = {
      type: ['array', 'null'],
      items: { type: ['string', 'null'], format: 'unsupported-format' },
      minItems: 3,
    };
    const original = JSON.parse(JSON.stringify(input));
    expect(transformJSONSchema(input)).toEqual({
      type: ['array', 'null'],
      items: { type: ['string', 'null'], description: '{format: "unsupported-format"}' },
      description: '{minItems: 3}',
    });
    expect(input).toEqual(original);
  });

  it.each(['anyOf', 'allOf'])('preserves the type restriction alongside %s', (keyword) => {
    const input = {
      type: ['string', 'null'],
      [keyword]: [{ type: 'string' }, { type: 'number' }],
    };
    expect(transformJSONSchema(input)).toEqual(input);
  });

  it('retains the type restriction when converting oneOf to anyOf', () => {
    const variants = [{ type: 'string' }, { type: 'number' }];
    expect(transformJSONSchema({ type: ['string', 'null'], oneOf: variants })).toEqual({
      type: ['string', 'null'],
      anyOf: variants,
    });
  });

  it('transforms nullable schemas in definitions and retains their references', () => {
    expect(
      transformJSONSchema({
        type: 'object',
        properties: { value: { $ref: '#/$defs/value' } },
        $defs: { value: { type: ['object', 'null'], properties: { id: { type: 'integer' } } } },
      }),
    ).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: { value: { $ref: '#/$defs/value' } },
      $defs: {
        value: {
          type: ['object', 'null'],
          properties: { id: { type: 'integer' } },
          additionalProperties: false,
        },
      },
    });
  });

  it('preserves metadata and handles null-first multi-type unions', () => {
    const input = {
      type: ['null', 'string', 'array'],
      title: 'Values',
      description: 'A date or list of dates.',
      format: 'date',
      items: { type: ['null', 'string'], format: 'date' },
      minItems: 0,
    };
    expect(transformJSONSchema(input)).toEqual(input);
  });
});
