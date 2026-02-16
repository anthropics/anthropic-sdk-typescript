import { z } from 'zod';
import { betaZodOutputFormat } from '../../src/helpers/beta/zod';
import { zodOutputFormat } from '../../src/helpers/zod';

describe('beta zod helpers', () => {
  describe('betaZodOutputFormat', () => {
    it('creates valid JSON schema from simple Zod object', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean(),
      });

      const format = betaZodOutputFormat(schema);

      const jsonSchema = format.schema as any;
      expect(format.type).toBe('json_schema');
      expect(format.schema).toBeDefined();
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toBeDefined();
      expect(typeof format.parse).toBe('function');
    });

    it('creates JSON schema without name parameter', () => {
      const schema = z.object({
        message: z.string(),
      });

      const format = betaZodOutputFormat(schema);

      expect(format.type).toBe('json_schema');
      expect(format.schema).toBeDefined();
    });

    it('parses valid JSON correctly', () => {
      const schema = z.object({
        city: z.string(),
        temperature: z.number(),
        conditions: z.array(z.string()),
      });

      const format = betaZodOutputFormat(schema);

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

    it('validates data against schema', () => {
      const schema = z.object({
        count: z.number(),
        active: z.boolean(),
      });

      const format = betaZodOutputFormat(schema);

      // Valid data
      const validInput = '{"count": 42, "active": true}';
      expect(() => format.parse(validInput)).not.toThrow();

      // Invalid data - wrong type
      const invalidInput = '{"count": "not a number", "active": true}';
      expect(() => format.parse(invalidInput)).toThrow();

      // Missing required field
      const missingField = '{"count": 42}';
      expect(() => format.parse(missingField)).toThrow();
    });

    it('handles optional and default values', () => {
      const schema = z.object({
        name: z.string(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high']).default('medium'),
        tags: z.array(z.string()).default([]),
      });

      const format = betaZodOutputFormat(schema);

      // Minimal input
      const minimalInput = '{"name": "Test Task"}';
      const parsed = format.parse(minimalInput);

      expect(parsed).toEqual({
        name: 'Test Task',
        priority: 'medium',
        tags: [],
      });
      expect(parsed.description).toBeUndefined();
    });

    it('handles nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
          settings: z.object({
            theme: z.enum(['light', 'dark']),
            notifications: z.boolean(),
          }),
        }),
        lastLogin: z.string().optional(),
      });

      const format = betaZodOutputFormat(schema);

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
      const schema = z.object({
        items: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            price: z.number(),
          }),
        ),
        total: z.number(),
      });

      const format = betaZodOutputFormat(schema);

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

    it('handles union types', () => {
      const schema = z.object({
        result: z.union([
          z.object({
            type: z.literal('success'),
            data: z.string(),
          }),
          z.object({
            type: z.literal('error'),
            message: z.string(),
            code: z.number(),
          }),
        ]),
      });

      const format = betaZodOutputFormat(schema);

      // Success case
      const successInput = JSON.stringify({
        result: {
          type: 'success',
          data: 'Operation completed',
        },
      });

      const successParsed = format.parse(successInput);
      expect(successParsed.result.type).toBe('success');
      if (successParsed.result.type === 'success') {
        expect(successParsed.result.data).toBe('Operation completed');
      }

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
      if (errorParsed.result.type === 'error') {
        expect(errorParsed.result.message).toBe('Something went wrong');
      }
    });

    it('handles recursive schemas', () => {
      const CategorySchema: any = z.lazy(() =>
        z.object({
          name: z.string(),
          subcategories: z.array(CategorySchema),
        }),
      );

      const format = betaZodOutputFormat(CategorySchema);

      const input = JSON.stringify({
        name: 'Electronics',
        subcategories: [
          {
            name: 'Computers',
            subcategories: [
              { name: 'Laptops', subcategories: [] },
              { name: 'Desktops', subcategories: [] },
            ],
          },
          { name: 'Phones', subcategories: [] },
        ],
      });

      const parsed = format.parse(input);

      expect(parsed.name).toBe('Electronics');
      expect(parsed.subcategories).toHaveLength(2);
      expect(parsed.subcategories[0].name).toBe('Computers');
      expect(parsed.subcategories[0].subcategories).toHaveLength(2);
    });

    it('throws on invalid JSON', () => {
      const schema = z.object({
        test: z.string(),
      });

      const format = betaZodOutputFormat(schema);

      expect(() => format.parse('invalid json')).toThrow();
      expect(() => format.parse('{"incomplete": ')).toThrow();
    });
  });
});

describe('GA zod helpers', () => {
  describe('zodOutputFormat', () => {
    it('creates valid JSON schema from simple Zod object', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean(),
      });

      const format = zodOutputFormat(schema);

      const jsonSchema = format.schema as any;
      expect(format.type).toBe('json_schema');
      expect(format.schema).toBeDefined();
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toBeDefined();
      expect(typeof format.parse).toBe('function');
    });

    it('creates JSON schema without name parameter', () => {
      const schema = z.object({
        message: z.string(),
      });

      const format = zodOutputFormat(schema);

      expect(format.type).toBe('json_schema');
      expect(format.schema).toBeDefined();
    });

    it('parses valid JSON correctly', () => {
      const schema = z.object({
        city: z.string(),
        temperature: z.number(),
        conditions: z.array(z.string()),
      });

      const format = zodOutputFormat(schema);

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

    it('validates data against schema', () => {
      const schema = z.object({
        count: z.number(),
        active: z.boolean(),
      });

      const format = zodOutputFormat(schema);

      // Valid data
      const validInput = '{"count": 42, "active": true}';
      expect(() => format.parse(validInput)).not.toThrow();

      // Invalid data - wrong type
      const invalidInput = '{"count": "not a number", "active": true}';
      expect(() => format.parse(invalidInput)).toThrow();

      // Missing required field
      const missingField = '{"count": 42}';
      expect(() => format.parse(missingField)).toThrow();
    });

    it('handles optional and default values', () => {
      const schema = z.object({
        name: z.string(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high']).default('medium'),
        tags: z.array(z.string()).default([]),
      });

      const format = zodOutputFormat(schema);

      // Minimal input
      const minimalInput = '{"name": "Test Task"}';
      const parsed = format.parse(minimalInput);

      expect(parsed).toEqual({
        name: 'Test Task',
        priority: 'medium',
        tags: [],
      });
      expect(parsed.description).toBeUndefined();
    });

    it('handles nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
          settings: z.object({
            theme: z.enum(['light', 'dark']),
            notifications: z.boolean(),
          }),
        }),
        lastLogin: z.string().optional(),
      });

      const format = zodOutputFormat(schema);

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
      const schema = z.object({
        items: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            price: z.number(),
          }),
        ),
        total: z.number(),
      });

      const format = zodOutputFormat(schema);

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

    it('handles union types', () => {
      const schema = z.object({
        result: z.union([
          z.object({
            type: z.literal('success'),
            data: z.string(),
          }),
          z.object({
            type: z.literal('error'),
            message: z.string(),
            code: z.number(),
          }),
        ]),
      });

      const format = zodOutputFormat(schema);

      // Success case
      const successInput = JSON.stringify({
        result: {
          type: 'success',
          data: 'Operation completed',
        },
      });

      const successParsed = format.parse(successInput);
      expect(successParsed.result.type).toBe('success');
      if (successParsed.result.type === 'success') {
        expect(successParsed.result.data).toBe('Operation completed');
      }

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
      if (errorParsed.result.type === 'error') {
        expect(errorParsed.result.message).toBe('Something went wrong');
      }
    });

    it('handles recursive schemas', () => {
      const CategorySchema: any = z.lazy(() =>
        z.object({
          name: z.string(),
          subcategories: z.array(CategorySchema),
        }),
      );

      const format = zodOutputFormat(CategorySchema);

      const input = JSON.stringify({
        name: 'Electronics',
        subcategories: [
          {
            name: 'Computers',
            subcategories: [
              { name: 'Laptops', subcategories: [] },
              { name: 'Desktops', subcategories: [] },
            ],
          },
          { name: 'Phones', subcategories: [] },
        ],
      });

      const parsed = format.parse(input);

      expect(parsed.name).toBe('Electronics');
      expect(parsed.subcategories).toHaveLength(2);
      expect(parsed.subcategories[0].name).toBe('Computers');
      expect(parsed.subcategories[0].subcategories).toHaveLength(2);
    });

    it('throws on invalid JSON', () => {
      const schema = z.object({
        test: z.string(),
      });

      const format = zodOutputFormat(schema);

      expect(() => format.parse('invalid json')).toThrow();
      expect(() => format.parse('{"incomplete": ')).toThrow();
    });
  });
});
