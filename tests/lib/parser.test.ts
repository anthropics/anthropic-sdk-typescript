import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { AnthropicError } from '../../src/core/error';
import {
  BetaParseableMessageCreateParams,
  maybeParseBetaMessage,
  parseBetaMessage,
} from '../../src/lib/beta-parser';
import { ParseableMessageCreateParams, maybeParseMessage, parseMessage } from '../../src/lib/parser';
import type { BetaMessage } from '../../src/resources/beta/messages/messages';
import type { Message } from '../../src/resources/messages/messages';
import { Logger } from '@anthropic-ai/sdk/client';

const opts: { logger: Logger } = { logger: console };

describe('Beta Parser', () => {
  describe('zodOutputFormat', () => {
    it('creates a parseable output format', () => {
      const schema = z.object({
        city: z.string(),
        units: z.enum(['c', 'f']).default('f'),
      });

      const format = betaZodOutputFormat(schema);

      expect(format.type).toBe('json_schema');
      expect(format.schema).toBeDefined();
      expect(typeof format.parse).toBe('function');
    });

    it('handles complex nested schemas', () => {
      const PersonSchema = z.object({
        name: z.string(),
        age: z.number(),
        address: z.object({
          street: z.string(),
          city: z.string(),
          country: z.string(),
        }),
        hobbies: z.array(z.string()),
      });

      const format = betaZodOutputFormat(PersonSchema);

      expect(format.type).toBe('json_schema');
      expect(format.schema).toBeDefined();
    });

    it('handles recursive schemas', () => {
      const TreeNode: any = z.lazy(() =>
        z.object({
          value: z.string(),
          children: z.array(TreeNode),
        }),
      );

      const format = betaZodOutputFormat(TreeNode);

      expect(format.type).toBe('json_schema');
    });
  });

  describe('parseMessage', () => {
    const mockMessage: BetaMessage = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'text',
          text: '{"city":"San Francisco","temperature":72}',
          citations: [],
        },
      ],
      context_management: null,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation: null,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: null,
        service_tier: null,
        inference_geo: null,
        iterations: null,
        speed: null,
      },
      container: null,
    };

    it('parses structured output correctly', () => {
      const schema = z.object({
        city: z.string(),
        temperature: z.number(),
      });

      const params: BetaParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: betaZodOutputFormat(schema) },
      };

      const parsed = parseBetaMessage(mockMessage, params, opts);

      expect(parsed.parsed_output).toEqual({
        city: 'San Francisco',
        temperature: 72,
      });
      expect(parsed.content[0]).toMatchObject({
        type: 'text',
        text: '{"city":"San Francisco","temperature":72}',
        parsed_output: {
          city: 'San Francisco',
          temperature: 72,
        },
      });
    });

    it('validates against schema', () => {
      const schema = z.object({
        city: z.string(),
        temperature: z.number(),
      });

      const params: BetaParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: betaZodOutputFormat(schema) },
      };

      const invalidMessage = {
        ...mockMessage,
        content: [
          {
            type: 'text' as const,
            text: '{"city":"San Francisco","temperature":"not a number"}',
            citations: null,
          },
        ],
      };

      expect(() => parseBetaMessage(invalidMessage, params, opts)).toThrow();
    });

    it('handles invalid JSON', () => {
      const schema = z.object({
        city: z.string(),
      });

      const params: BetaParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: betaZodOutputFormat(schema) },
      };

      const invalidMessage = {
        ...mockMessage,
        content: [
          {
            type: 'text' as const,
            text: 'invalid json',
            citations: null,
          },
        ],
      };

      expect(() => parseBetaMessage(invalidMessage, params, opts)).toThrow(AnthropicError);
    });

    it('handles messages without text blocks', () => {
      const schema = z.object({
        city: z.string(),
      });

      const params: BetaParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: betaZodOutputFormat(schema) },
      };

      const messageWithoutText = {
        ...mockMessage,
        content: [],
      };

      const parsed = parseBetaMessage(messageWithoutText, params, opts);

      expect(parsed.parsed_output).toBe(null);
      expect(parsed.content).toEqual([]);
    });

    it('handles multiple content blocks', () => {
      const schema = z.object({
        city: z.string(),
      });

      const params: BetaParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: betaZodOutputFormat(schema) },
      };

      const multiContentMessage = {
        ...mockMessage,
        content: [
          {
            type: 'text' as const,
            text: '{"city":"San Francisco"}',
            citations: null,
          },
          {
            type: 'text' as const,
            text: '{"city":"Los Angeles"}',
            citations: null,
          },
        ],
      };

      const parsed = parseBetaMessage(multiContentMessage, params, opts);

      expect(parsed.parsed_output).toEqual({ city: 'San Francisco' });
      expect(parsed.content).toHaveLength(2);
      expect(parsed.content[0]).toMatchObject({
        parsed_output: { city: 'San Francisco' },
      });
      expect(parsed.content[1]).toMatchObject({
        parsed_output: { city: 'Los Angeles' },
      });
    });
  });

  describe('maybeParseMessage', () => {
    const mockMessage: BetaMessage = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'text',
          text: '{"city":"San Francisco"}',
          citations: [],
        },
      ],
      context_management: null,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation: null,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: null,
        service_tier: null,
        inference_geo: null,
        iterations: null,
        speed: null,
      },
      container: null,
    };

    it('parses when params have auto-parseable input', () => {
      const schema = z.object({
        city: z.string(),
      });

      const params: BetaParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: betaZodOutputFormat(schema) },
      };

      const parsed = maybeParseBetaMessage(mockMessage, params, opts);

      expect(parsed.parsed_output).toEqual({ city: 'San Francisco' });
    });

    it('reports deprecation warnings for .parsed', () => {
      const params: BetaParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: betaZodOutputFormat(z.object({ city: z.string() })) },
      };

      const mockLogger = { warn: jest.fn() };

      const parsed = maybeParseBetaMessage(mockMessage, params, { logger: mockLogger as any });
      expect(parsed.parsed_output).toEqual({ city: 'San Francisco' });
      expect((parsed.content[0] as any).parsed_output).toEqual({ city: 'San Francisco' });
      expect(mockLogger.warn).toHaveBeenCalledTimes(0);

      expect((parsed.content[0] as any).parsed).toEqual({ city: 'San Francisco' });
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'The `parsed` property on `text` blocks is deprecated, please use `parsed_output` instead.',
      );
    });

    it('does not parse when params have no auto-parseable input', () => {
      const params: BetaParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
      };

      const parsed = maybeParseBetaMessage(mockMessage, params, opts);

      expect(parsed.parsed_output).toBe(null);
      expect(parsed.content[0]).toMatchObject({
        type: 'text',
        text: '{"city":"San Francisco"}',
        parsed_output: null,
      });
    });

    it('handles null params', () => {
      const parsed = maybeParseBetaMessage(mockMessage, null, opts);

      expect(parsed.parsed_output).toBe(null);
      expect(parsed.content[0]).toMatchObject({
        parsed_output: null,
      });
    });
  });

  describe('Complex schemas', () => {
    it('handles union types', () => {
      const schema = z.union([
        z.object({
          type: z.literal('person'),
          name: z.string(),
          age: z.number(),
        }),
        z.object({
          type: z.literal('organization'),
          name: z.string(),
          employees: z.number(),
        }),
      ]);

      const format = betaZodOutputFormat(schema);

      const personData = '{"type":"person","name":"John","age":30}';
      const parsed = format.parse(personData);

      expect(parsed).toEqual({
        type: 'person',
        name: 'John',
        age: 30,
      });
    });

    it('handles arrays and optional fields', () => {
      const schema = z.object({
        items: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().optional(),
            tags: z.array(z.string()).default([]),
          }),
        ),
        total: z.number(),
        hasMore: z.boolean().default(false),
      });

      const format = betaZodOutputFormat(schema);

      const data = JSON.stringify({
        items: [
          { id: '1', name: 'Item 1', tags: ['tag1', 'tag2'] },
          { id: '2', name: 'Item 2', description: 'A description' },
        ],
        total: 2,
      });

      const parsed = format.parse(data);

      expect(parsed.items).toHaveLength(2);
      expect(parsed.items[0]!.tags).toEqual(['tag1', 'tag2']);
      expect(parsed.items[1]!.description).toBe('A description');
      expect(parsed.hasMore).toBe(false); // default value
    });

    it('handles enums', () => {
      const schema = z.object({
        priority: z.enum(['low', 'medium', 'high']),
        status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
      });

      const format = betaZodOutputFormat(schema);

      const data = '{"priority":"high","status":"in_progress"}';
      const parsed = format.parse(data);

      expect(parsed).toEqual({
        priority: 'high',
        status: 'in_progress',
      });
    });
  });
});

describe('GA Parser', () => {
  describe('zodOutputFormat', () => {
    it('creates a parseable output format', () => {
      const schema = z.object({
        city: z.string(),
        units: z.enum(['c', 'f']).default('f'),
      });

      const format = zodOutputFormat(schema);

      expect(format.type).toBe('json_schema');
      expect(format.schema).toBeDefined();
      expect(typeof format.parse).toBe('function');
    });

    it('handles complex nested schemas', () => {
      const PersonSchema = z.object({
        name: z.string(),
        age: z.number(),
        address: z.object({
          street: z.string(),
          city: z.string(),
          country: z.string(),
        }),
        hobbies: z.array(z.string()),
      });

      const format = zodOutputFormat(PersonSchema);

      expect(format.type).toBe('json_schema');
      expect(format.schema).toBeDefined();
    });

    it('handles recursive schemas', () => {
      const TreeNode: any = z.lazy(() =>
        z.object({
          value: z.string(),
          children: z.array(TreeNode),
        }),
      );

      const format = zodOutputFormat(TreeNode);

      expect(format.type).toBe('json_schema');
    });
  });

  describe('parseMessage', () => {
    const mockMessage: Message = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'text',
          text: '{"city":"San Francisco","temperature":72}',
          citations: null,
        },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation: null,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: null,
        service_tier: null,
        inference_geo: null,
      },
    };

    it('parses structured output correctly', () => {
      const schema = z.object({
        city: z.string(),
        temperature: z.number(),
      });

      const params: ParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: zodOutputFormat(schema) },
      };

      const parsed = parseMessage(mockMessage, params, opts);

      expect(parsed.parsed_output).toEqual({
        city: 'San Francisco',
        temperature: 72,
      });
      expect(parsed.content[0]).toMatchObject({
        type: 'text',
        text: '{"city":"San Francisco","temperature":72}',
        parsed_output: {
          city: 'San Francisco',
          temperature: 72,
        },
      });
    });

    it('validates against schema', () => {
      const schema = z.object({
        city: z.string(),
        temperature: z.number(),
      });

      const params: ParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: zodOutputFormat(schema) },
      };

      const invalidMessage: Message = {
        ...mockMessage,
        content: [
          {
            type: 'text' as const,
            text: '{"city":"San Francisco","temperature":"not a number"}',
            citations: null,
          },
        ],
      };

      expect(() => parseMessage(invalidMessage, params, opts)).toThrow();
    });

    it('handles invalid JSON', () => {
      const schema = z.object({
        city: z.string(),
      });

      const params: ParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: zodOutputFormat(schema) },
      };

      const invalidMessage: Message = {
        ...mockMessage,
        content: [
          {
            type: 'text' as const,
            text: 'invalid json',
            citations: null,
          },
        ],
      };

      expect(() => parseMessage(invalidMessage, params, opts)).toThrow(AnthropicError);
    });

    it('handles messages without text blocks', () => {
      const schema = z.object({
        city: z.string(),
      });

      const params: ParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: zodOutputFormat(schema) },
      };

      const messageWithoutText: Message = {
        ...mockMessage,
        content: [],
      };

      const parsed = parseMessage(messageWithoutText, params, opts);

      expect(parsed.parsed_output).toBe(null);
      expect(parsed.content).toEqual([]);
    });

    it('handles multiple content blocks', () => {
      const schema = z.object({
        city: z.string(),
      });

      const params: ParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: zodOutputFormat(schema) },
      };

      const multiContentMessage: Message = {
        ...mockMessage,
        content: [
          {
            type: 'text' as const,
            text: '{"city":"San Francisco"}',
            citations: null,
          },
          {
            type: 'text' as const,
            text: '{"city":"Los Angeles"}',
            citations: null,
          },
        ],
      };

      const parsed = parseMessage(multiContentMessage, params, opts);

      expect(parsed.parsed_output).toEqual({ city: 'San Francisco' });
      expect(parsed.content).toHaveLength(2);
      expect(parsed.content[0]).toMatchObject({
        parsed_output: { city: 'San Francisco' },
      });
      expect(parsed.content[1]).toMatchObject({
        parsed_output: { city: 'Los Angeles' },
      });
    });
  });

  describe('maybeParseMessage', () => {
    const mockMessage: Message = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'text',
          text: '{"city":"San Francisco"}',
          citations: null,
        },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation: null,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: null,
        service_tier: null,
        inference_geo: null,
      },
    };

    it('parses when params have auto-parseable input', () => {
      const schema = z.object({
        city: z.string(),
      });

      const params: ParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
        output_config: { format: zodOutputFormat(schema) },
      };

      const parsed = maybeParseMessage(mockMessage, params, opts);

      expect(parsed.parsed_output).toEqual({ city: 'San Francisco' });
    });

    it('does not parse when params have no auto-parseable input', () => {
      const params: ParseableMessageCreateParams = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test' }],
      };

      const parsed = maybeParseMessage(mockMessage, params, opts);

      expect(parsed.parsed_output).toBe(null);
      expect(parsed.content[0]).toMatchObject({
        type: 'text',
        text: '{"city":"San Francisco"}',
        parsed_output: null,
      });
    });

    it('handles null params', () => {
      const parsed = maybeParseMessage(mockMessage, null, opts);

      expect(parsed.parsed_output).toBe(null);
      expect(parsed.content[0]).toMatchObject({
        parsed_output: null,
      });
    });
  });

  describe('Complex schemas', () => {
    it('handles union types', () => {
      const schema = z.union([
        z.object({
          type: z.literal('person'),
          name: z.string(),
          age: z.number(),
        }),
        z.object({
          type: z.literal('organization'),
          name: z.string(),
          employees: z.number(),
        }),
      ]);

      const format = zodOutputFormat(schema);

      const personData = '{"type":"person","name":"John","age":30}';
      const parsed = format.parse(personData);

      expect(parsed).toEqual({
        type: 'person',
        name: 'John',
        age: 30,
      });
    });

    it('handles arrays and optional fields', () => {
      const schema = z.object({
        items: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().optional(),
            tags: z.array(z.string()).default([]),
          }),
        ),
        total: z.number(),
        hasMore: z.boolean().default(false),
      });

      const format = zodOutputFormat(schema);

      const data = JSON.stringify({
        items: [
          { id: '1', name: 'Item 1', tags: ['tag1', 'tag2'] },
          { id: '2', name: 'Item 2', description: 'A description' },
        ],
        total: 2,
      });

      const parsed = format.parse(data);

      expect(parsed.items).toHaveLength(2);
      expect(parsed.items[0]!.tags).toEqual(['tag1', 'tag2']);
      expect(parsed.items[1]!.description).toBe('A description');
      expect(parsed.hasMore).toBe(false); // default value
    });

    it('handles enums', () => {
      const schema = z.object({
        priority: z.enum(['low', 'medium', 'high']),
        status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
      });

      const format = zodOutputFormat(schema);

      const data = '{"priority":"high","status":"in_progress"}';
      const parsed = format.parse(data);

      expect(parsed).toEqual({
        priority: 'high',
        status: 'in_progress',
      });
    });
  });
});
