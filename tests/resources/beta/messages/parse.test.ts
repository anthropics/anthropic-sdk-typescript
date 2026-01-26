import { z } from 'zod';
import { betaZodOutputFormat } from '../../../../src/helpers/beta/zod';
import { Messages } from '../../../../src/resources/beta/messages/messages';

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
          output_format: expect.objectContaining({
            type: 'json_schema',
            schema: expect.objectContaining({
              type: 'object',
            }),
          }),
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
});
