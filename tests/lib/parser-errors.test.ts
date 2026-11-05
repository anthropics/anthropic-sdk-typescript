import { z } from 'zod/v4';
import { zodOutputFormat } from '../../src/helpers/zod';
import { AnthropicError } from '../../src/core/error';
import { parseBetaMessage } from '../../src/lib/beta-parser';
import { parseMessage } from '../../src/lib/parser';

const opts = { logger: console } as any;

function messageWithText(text: string) {
  return {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    model: 'claude-3-5-sonnet-20241022',
    content: [{ type: 'text', text, citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as any;
}

function paramsWithFormat(format: unknown) {
  return {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'test' }],
    output_config: { format },
  } as any;
}

describe('structured output parse errors', () => {
  it('rethrows an AnthropicError from the output format without wrapping it again', () => {
    const original = new AnthropicError('Failed to parse structured output: bad shape');
    const format = {
      type: 'json_schema',
      schema: {},
      parse: () => {
        throw original;
      },
    };

    for (const parse of [parseMessage, parseBetaMessage] as Array<
      (message: any, params: any, opts: any) => unknown
    >) {
      let thrown: unknown;
      try {
        parse(messageWithText('{}'), paramsWithFormat(format), opts);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBe(original);
    }

    const zodFormat = zodOutputFormat(z.object({ city: z.string() }));
    expect(() => parseMessage(messageWithText('{"city": 1}'), paramsWithFormat(zodFormat), opts)).toThrow(
      /^Failed to parse structured output: (?!Error:)/,
    );
  });

  it('wraps other errors and keeps the original as the cause', () => {
    const schemaless = { type: 'json_schema', schema: {} };
    const failing = {
      type: 'json_schema',
      schema: {},
      parse: () => {
        throw new TypeError('boom');
      },
    };

    for (const parse of [parseMessage, parseBetaMessage] as Array<
      (message: any, params: any, opts: any) => unknown
    >) {
      for (const [format, text, causeType] of [
        [schemaless, '{"incomplete": ', SyntaxError],
        [failing, '{}', TypeError],
      ] as const) {
        let thrown: any;
        try {
          parse(messageWithText(text), paramsWithFormat(format), opts);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(AnthropicError);
        expect(thrown.message).toMatch(/^Failed to parse structured output: (?!Error:)/);
        expect(thrown.cause).toBeInstanceOf(causeType);
      }
    }
  });
});
