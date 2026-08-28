import { AnthropicError } from '@anthropic-ai/sdk/core/error';
import * as real from '@anthropic-ai/sdk/internal/node';
import * as stub from '@anthropic-ai/sdk/internal/node.browser';

describe('internal/node.browser', () => {
  test('stubs every export of internal/node', () => {
    expect(Object.keys(stub).sort()).toEqual(Object.keys(real).sort());
  });

  test('throws on use', () => {
    expect(real.path.join('a', 'b')).toEqual(expect.any(String));
    expect(() => stub.path.join).toThrow(AnthropicError);
    expect(() => stub.fs.readFileSync).toThrow('`fs.readFileSync` is not available in this environment');
  });
});
