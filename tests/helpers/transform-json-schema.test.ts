import { detailedDiff } from 'deep-object-diff';
import { transformJSONSchema } from '../../src/lib/transform-json-schema';

describe('transformJsonSchema', () => {
  it('should not mutate the original schema', () => {
    const input = {
      type: 'object',
      properties: {
        bonus: {
          type: 'integer',
          default: 100000,
          minimum: 100000,
          title: 'Bonus',
          description: 'Annual bonus in USD',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
        },
      },
      title: 'Employee',
      additionalProperties: true,
    };

    const inputCopy = JSON.parse(JSON.stringify(input));

    transformJSONSchema(input);

    expect(input).toEqual(inputCopy);
  });

  it('should remove unsupported properties and add them to description', () => {
    const input = {
      type: 'object',
      properties: {
        bonus: {
          type: 'integer',
          default: 100000,
          minimum: 100000,
          title: 'Bonus',
          description: 'Annual bonus in USD',
        },
      },
      title: 'Employee',
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {
    "additionalProperties": false,
  },
  "deleted": {
    "properties": {
      "bonus": {
        "default": undefined,
        "minimum": undefined,
      },
    },
  },
  "updated": {
    "properties": {
      "bonus": {
        "description": "Annual bonus in USD

{default: 100000, minimum: 100000}",
      },
    },
  },
}
`);
  });

  it('should handle objects without existing description', () => {
    const input = {
      type: 'object',
      properties: {
        count: {
          type: 'integer',
          maximum: 10,
          minimum: 1,
        },
      },
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {
    "additionalProperties": false,
    "properties": {
      "count": {
        "description": "{maximum: 10, minimum: 1}",
      },
    },
  },
  "deleted": {
    "properties": {
      "count": {
        "maximum": undefined,
        "minimum": undefined,
      },
    },
  },
  "updated": {},
}
`);
  });

  it('should preserve supported minItems values (0 and 1)', () => {
    const input = {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {},
  "deleted": {},
  "updated": {},
}
`);
  });

  it('should remove unsupported minItems values (> 1)', () => {
    const input = {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      description: 'List of items',
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {},
  "deleted": {
    "minItems": undefined,
  },
  "updated": {
    "description": "List of items

{minItems: 3}",
  },
}
`);
  });

  it('should handle nested objects recursively', () => {
    const input = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            age: {
              type: 'integer',
              minimum: 0,
              maximum: 120,
            },
          },
        },
      },
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {
    "additionalProperties": false,
    "properties": {
      "user": {
        "additionalProperties": false,
        "properties": {
          "age": {
            "description": "{minimum: 0, maximum: 120}",
          },
        },
      },
    },
  },
  "deleted": {
    "properties": {
      "user": {
        "properties": {
          "age": {
            "maximum": undefined,
            "minimum": undefined,
          },
        },
      },
    },
  },
  "updated": {},
}
`);
  });

  it('should handle $defs and definitions recursively', () => {
    const input = {
      type: 'object',
      $defs: {
        Person: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              pattern: '^[A-Za-z]+$',
            },
          },
        },
      },
      properties: {
        person: {
          $ref: '#/$defs/Person',
        },
      },
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {
    "$defs": {
      "Person": {
        "additionalProperties": false,
        "properties": {
          "name": {
            "description": "{pattern: "^[A-Za-z]+$"}",
          },
        },
      },
    },
    "additionalProperties": false,
  },
  "deleted": {
    "$defs": {
      "Person": {
        "properties": {
          "name": {
            "pattern": undefined,
          },
        },
      },
    },
  },
  "updated": {},
}
`);
  });

  it('should keep $defs when the root schema is a $ref', () => {
    const input = {
      $ref: '#/$defs/Item',
      $defs: {
        Item: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              pattern: '^[A-Za-z]+$',
            },
          },
        },
      },
    };

    const result = transformJSONSchema(input);
    expect(result).toEqual({
      $ref: '#/$defs/Item',
      $defs: {
        Item: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: '{pattern: "^[A-Za-z]+$"}',
            },
          },
          additionalProperties: false,
        },
      },
    });

    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {
    "$defs": {
      "Item": {
        "additionalProperties": false,
        "properties": {
          "name": {
            "description": "{pattern: "^[A-Za-z]+$"}",
          },
        },
      },
    },
  },
  "deleted": {
    "$defs": {
      "Item": {
        "properties": {
          "name": {
            "pattern": undefined,
          },
        },
      },
    },
  },
  "updated": {},
}
`);
  });

  it('should remove additionalProperties: true', () => {
    const input = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      additionalProperties: true,
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {},
  "deleted": {},
  "updated": {
    "additionalProperties": false,
  },
}
`);
  });

  it('should set additionalProperties when missing', () => {
    const input = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {
    "additionalProperties": false,
  },
  "deleted": {},
  "updated": {},
}
`);
  });

  it('should preserve supported string formats', () => {
    const input = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        date: { type: 'string', format: 'date-time' },
        website: { type: 'string', format: 'uri' },
      },
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {
    "additionalProperties": false,
  },
  "deleted": {},
  "updated": {},
}
`);
  });

  it('should preserve const and enum', () => {
    const input = {
      anyOf: [
        {
          type: 'object',
          properties: {
            action: { type: 'string', const: 'set_title' },
            title: { type: 'string' },
          },
          required: ['action', 'title'],
        },
        {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['add_members', 'remove_members'] },
            emails: { type: 'array', items: { type: 'string' } },
          },
          required: ['action', 'emails'],
        },
      ],
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {
    "anyOf": {
      "0": {
        "additionalProperties": false,
      },
      "1": {
        "additionalProperties": false,
      },
    },
  },
  "deleted": {
    "anyOf": {
      "0": {
        "properties": {
          "action": {
            "type": undefined,
          },
        },
      },
      "1": {
        "properties": {
          "action": {
            "type": undefined,
          },
        },
      },
    },
  },
  "updated": {},
}
`);
  });

  it.each([
    ['a string const', { type: 'string', const: 'a' }, { const: 'a' }],
    ['a null const', { type: 'null', const: null }, { const: null }],
    ['an integer enum', { type: 'integer', enum: [1, 2] }, { enum: [1, 2] }],
    ['a const with no type', { const: 'a' }, { const: 'a' }],
    ['an enum with no type', { enum: ['a', 1, null] }, { enum: ['a', 1, null] }],
    ['an enum with a list of types', { type: ['string', 'null'], enum: ['a', null] }, { enum: ['a', null] }],
    [
      'an enum beside a format',
      { type: 'string', format: 'date', enum: ['2020-01-01'] },
      { enum: ['2020-01-01'], description: '{format: "date"}' },
    ],
    [
      'an enum beside anyOf',
      { anyOf: [{ type: 'string' }, { type: 'number' }], enum: ['a', 1] },
      { enum: ['a', 1], anyOf: [{ type: 'string' }, { type: 'number' }] },
    ],
  ])('should keep %s and drop the type', (_, input, expected) => {
    expect(transformJSONSchema(input)).toEqual(expected);
  });

  it.each([
    ['an array const', { type: 'array', const: [1] }, { type: 'array', description: '{const: [1]}' }],
    [
      'an enum with an object value',
      { type: ['string', 'object'], enum: ['a', { x: 1 }] },
      { type: ['string', 'object'], description: '{enum: ["a",{"x":1}]}' },
    ],
    ['an empty enum', { type: 'string', enum: [] }, { type: 'string', description: '{enum: []}' }],
  ])('should move %s into the description', (_, input, expected) => {
    expect(transformJSONSchema(input)).toEqual(expected);
  });

  it('should report a boolean subschema as a schema with no type', () => {
    expect(() => transformJSONSchema({ type: 'array', items: true })).toThrow('must have a type defined');
  });

  it('should remove unsupported string formats', () => {
    const input = {
      type: 'object',
      properties: {
        password: {
          type: 'string',
          format: 'password',
          description: 'User password',
        },
        customField: {
          type: 'string',
          format: 'custom-format',
        },
      },
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {
    "additionalProperties": false,
    "properties": {
      "customField": {
        "description": "{format: "custom-format"}",
      },
    },
  },
  "deleted": {
    "properties": {
      "customField": {
        "format": undefined,
      },
      "password": {
        "format": undefined,
      },
    },
  },
  "updated": {
    "properties": {
      "password": {
        "description": "User password

{format: "password"}",
      },
    },
  },
}
`);
  });

  it('should transform all subschemas in allOf recursively', () => {
    const input = {
      allOf: [
        {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              minimum: 1,
              maximum: 999,
            },
          },
        },
        {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              pattern: '^[A-Z]',
              minLength: 2,
            },
          },
          additionalProperties: true,
        },
        {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              minItems: 5,
            },
          },
        },
      ],
    };

    const result = transformJSONSchema(input);
    const diff = detailedDiff(input, result);
    expect(diff).toMatchInlineSnapshot(`
{
  "added": {
    "allOf": {
      "0": {
        "additionalProperties": false,
        "properties": {
          "id": {
            "description": "{minimum: 1, maximum: 999}",
          },
        },
      },
      "1": {
        "properties": {
          "name": {
            "description": "{pattern: "^[A-Z]", minLength: 2}",
          },
        },
      },
      "2": {
        "additionalProperties": false,
        "properties": {
          "tags": {
            "description": "{minItems: 5}",
          },
        },
      },
    },
  },
  "deleted": {
    "allOf": {
      "0": {
        "properties": {
          "id": {
            "maximum": undefined,
            "minimum": undefined,
          },
        },
      },
      "1": {
        "properties": {
          "name": {
            "minLength": undefined,
            "pattern": undefined,
          },
        },
      },
      "2": {
        "properties": {
          "tags": {
            "minItems": undefined,
          },
        },
      },
    },
  },
  "updated": {
    "allOf": {
      "1": {
        "additionalProperties": false,
      },
    },
  },
}
`);
  });

  it('should drop $schema without adding it to description', () => {
    const input = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        name: {
          type: 'string',
        },
      },
    };

    const result = transformJSONSchema(input);
    expect(result['description']).toBeUndefined();
    expect(result['$schema']).toBeUndefined();
    expect(result).toEqual({
      type: 'object',
      properties: {
        name: {
          type: 'string',
        },
      },
      additionalProperties: false,
    });
  });

  it('should drop $schema while preserving existing description', () => {
    const input = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      description: 'A person entity',
      type: 'object',
      properties: {
        name: {
          type: 'string',
        },
      },
    };

    const result = transformJSONSchema(input);
    expect(result['description']).toBe('A person entity');
    expect(result['$schema']).toBeUndefined();
  });
});
