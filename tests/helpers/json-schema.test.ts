import { jsonSchemaOutputFormat } from '../../src/helpers/json-schema';

describe('GA json-schema helpers', () => {
  describe('jsonSchemaOutputFormat', () => {
    it('creates valid output format from simple JSON schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          active: { type: 'boolean' },
        },
        required: ['name', 'age'],
      } as const;

      const format = jsonSchemaOutputFormat(schema);

      expect(format.type).toBe('json_schema');
      expect(format.schema).toBeDefined();
      expect(typeof format.parse).toBe('function');
    });

    it('parses valid JSON correctly', () => {
      const schema = {
        type: 'object',
        properties: {
          city: { type: 'string' },
          temperature: { type: 'number' },
          conditions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['city', 'temperature'],
      } as const;

      const format = jsonSchemaOutputFormat(schema);

      const jsonInput = JSON.stringify({
        city: 'San Francisco',
        temperature: 72,
        conditions: ['sunny', 'clear'],
      });

      const parsed = format.parse(jsonInput);

      expect(parsed).toEqual({
        city: 'San Francisco',
        temperature: 72,
        conditions: ['sunny', 'clear'],
      });
    });

    it('handles nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              settings: {
                type: 'object',
                properties: {
                  theme: { type: 'string', enum: ['light', 'dark'] },
                  notifications: { type: 'boolean' },
                },
                required: ['theme', 'notifications'],
              },
            },
            required: ['name', 'email', 'settings'],
          },
          lastLogin: { type: 'string' },
        },
        required: ['user'],
      } as const;

      const format = jsonSchemaOutputFormat(schema);

      const input = JSON.stringify({
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
        lastLogin: '2024-01-01T10:00:00Z',
      });

      const parsed = format.parse(input);

      expect(parsed.user.name).toBe('John Doe');
      expect(parsed.user.settings.theme).toBe('dark');
      expect(parsed.lastLogin).toBe('2024-01-01T10:00:00Z');
    });

    it('handles arrays of objects', () => {
      const schema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                price: { type: 'number' },
              },
              required: ['id', 'name', 'price'],
            },
          },
          total: { type: 'number' },
        },
        required: ['items', 'total'],
      } as const;

      const format = jsonSchemaOutputFormat(schema);

      const input = JSON.stringify({
        items: [
          { id: '1', name: 'Item 1', price: 10.99 },
          { id: '2', name: 'Item 2', price: 25.5 },
        ],
        total: 36.49,
      });

      const parsed = format.parse(input);

      expect(parsed.items).toHaveLength(2);
      expect(parsed.items[0]!.name).toBe('Item 1');
      expect(parsed.total).toBe(36.49);
    });

    it('handles enum values', () => {
      const schema = {
        type: 'object',
        properties: {
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
        },
        required: ['priority', 'status'],
      } as const;

      const format = jsonSchemaOutputFormat(schema);

      const input = JSON.stringify({
        priority: 'high',
        status: 'in_progress',
      });

      const parsed = format.parse(input);

      expect(parsed.priority).toBe('high');
      expect(parsed.status).toBe('in_progress');
    });

    it('throws on invalid JSON', () => {
      const schema = {
        type: 'object',
        properties: {
          test: { type: 'string' },
        },
      } as const;

      const format = jsonSchemaOutputFormat(schema);

      expect(() => format.parse('invalid json')).toThrow();
      expect(() => format.parse('{"incomplete": ')).toThrow();
    });

    it('throws error for non-object schema', () => {
      const schema = {
        type: 'string',
      } as const;

      expect(() =>
        jsonSchemaOutputFormat(
          // @ts-expect-error - testing invalid schema
          schema,
        ),
      ).toThrow('JSON schema must be an object, but got string');
    });

    it('transforms schema by default', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'integer', minimum: 0 },
        },
        required: ['name'],
      } as const;

      const format = jsonSchemaOutputFormat(schema);

      // The schema should have additionalProperties set to false after transformation
      expect((format.schema as any).additionalProperties).toBe(false);
    });

    it('allows disabling schema transformation', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: true,
      } as const;

      const format = jsonSchemaOutputFormat(schema, { transform: false });

      // Without transformation, additionalProperties should remain true
      expect((format.schema as any).additionalProperties).toBe(true);
    });

    it('handles oneOf/anyOf schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          result: {
            anyOf: [
              {
                type: 'object',
                properties: {
                  type: { type: 'string', const: 'success' },
                  data: { type: 'string' },
                },
                required: ['type', 'data'],
              },
              {
                type: 'object',
                properties: {
                  type: { type: 'string', const: 'error' },
                  message: { type: 'string' },
                  code: { type: 'number' },
                },
                required: ['type', 'message', 'code'],
              },
            ],
          },
        },
        required: ['result'],
      } as const;

      const format = jsonSchemaOutputFormat(schema);

      // Success case
      const successInput = JSON.stringify({
        result: {
          type: 'success',
          data: 'Operation completed',
        },
      });

      const successParsed = format.parse(successInput);
      expect(successParsed.result.type).toBe('success');

      // Error case
      const errorInput = JSON.stringify({
        result: {
          type: 'error',
          message: 'Something went wrong',
          code: 500,
        },
      });

      const errorParsed = format.parse(errorInput);
      expect(errorParsed.result.type).toBe('error');
    });

    it('handles $ref references', () => {
      const schema = {
        type: 'object',
        $defs: {
          Address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
            },
            required: ['street', 'city', 'country'],
          },
        },
        properties: {
          homeAddress: { $ref: '#/$defs/Address' },
          workAddress: { $ref: '#/$defs/Address' },
        },
        required: ['homeAddress'],
      } as const;

      const format = jsonSchemaOutputFormat(schema);

      const input = JSON.stringify({
        homeAddress: {
          street: '123 Main St',
          city: 'San Francisco',
          country: 'USA',
        },
        workAddress: {
          street: '456 Office Blvd',
          city: 'San Francisco',
          country: 'USA',
        },
      });

      const parsed = format.parse(input);

      expect(parsed.homeAddress.city).toBe('San Francisco');
      expect(parsed.workAddress!.street).toBe('456 Office Blvd');
    });
  });
});
