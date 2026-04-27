import { z } from 'zod';
import { betaZodOutputFormat } from '../../../../src/helpers/beta/zod';
import { Messages } from '../../../../src/resources/beta/messages/messages';
import { AnthropicError } from '../../../../src/error';

// Mock the APIResource base class methods
const mockPost = jest.fn();
const mockClient = {
  post: mockPost,
  calculateNonstreamingTimeout: jest.fn().mockReturnValue(600000),
  _options: {
    timeout: null,
  },
} as any;

// Create a mock Messages instance
const messages = new Messages(mockClient);

describe('Messages.parse()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses structured output correctly', async () => {
    const schema = z.object({
      city: z.string(),
      temperature: z.number(),
      conditions: z.array(z.string()),
    });

    const mockResponse = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-latest',
      content: [
        {
          type: 'text',
          text: '{"city":"San Francisco","temperature":72,"conditions":["sunny","clear"]}',
        },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 25,
      },
    };

    mockPost.mockResolvedValue(mockResponse);

    const result = await messages.parse({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'What is the weather in SF?' }],
      output_format: betaZodOutputFormat(schema),
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/v1/messages?beta=true',
      expect.objectContaining({
        body: expect.objectContaining({
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'What is the weather in SF?' }],
          output_config: {
            format: expect.objectContaining({
              type: 'json_schema',
              schema: expect.objectContaining({
                type: 'object',
              }),
            }),
          },
        }),
      }),
    );

    expect(result.parsed_output).toEqual({
      city: 'San Francisco',
      temperature: 72,
      conditions: ['sunny', 'clear'],
    });

    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: '{"city":"San Francisco","temperature":72,"conditions":["sunny","clear"]}',
      parsed_output: {
        city: 'San Francisco',
        temperature: 72,
        conditions: ['sunny', 'clear'],
      },
    });
  });

  it('handles validation errors gracefully', async () => {
    const schema = z.object({
      count: z.number(),
      active: z.boolean(),
    });

    const mockResponse = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-latest',
      content: [
        {
          type: 'text',
          text: '{"count":"not a number","active":true}', // Invalid: count should be number
        },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 15,
      },
    };

    mockPost.mockResolvedValue(mockResponse);

    await expect(
      messages.parse({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Generate some data' }],
        output_format: betaZodOutputFormat(schema),
      }),
    ).rejects.toThrow();
  });

  it('throws error when both output_format and output_config.format are provided', async () => {
    const schema = z.object({
      city: z.string(),
      temperature: z.number(),
    });

    try {
      await messages.parse({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'What is the weather in SF?' }],
        output_format: betaZodOutputFormat(schema),
        output_config: {
          format: betaZodOutputFormat(schema),
        },
      } as any);
      fail('Expected an error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AnthropicError);
      expect((error as AnthropicError).message).toContain('output_format');
      expect((error as AnthropicError).message).toContain('output_config.format');
    }
  });

  it('transforms output_format to output_config.format in request', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const mockResponse = {
      id: 'msg_456',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-latest',
      content: [
        {
          type: 'text',
          text: '{"name":"Alice","age":30}',
        },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
      },
    };

    mockPost.mockResolvedValue(mockResponse);

    await messages.parse({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Generate user data' }],
      output_format: betaZodOutputFormat(schema),
    });

    // Verify output_format is NOT in the request body
    expect(mockPost).toHaveBeenCalledWith(
      '/v1/messages?beta=true',
      expect.objectContaining({
        body: expect.not.objectContaining({
          output_format: expect.anything(),
        }),
      }),
    );

    // Verify it was transformed to output_config.format
    expect(mockPost).toHaveBeenCalledWith(
      '/v1/messages?beta=true',
      expect.objectContaining({
        body: expect.objectContaining({
          output_config: {
            format: expect.objectContaining({
              type: 'json_schema',
              schema: expect.any(Object),
            }),
          },
        }),
      }),
    );
  });
});
