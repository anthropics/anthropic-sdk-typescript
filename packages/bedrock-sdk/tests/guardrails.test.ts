jest.mock('../src/core/auth', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({}),
}));

const mockFetch = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('{}'),
  });
});

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

describe('Bedrock guardrail configuration', () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  test('sends guardrail headers when configured via constructor params', async () => {
    const { AnthropicBedrock } = require('../src');

    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
      guardrailIdentifier: 'my-guardrail-id',
      guardrailVersion: '1',
    });

    try {
      await client.messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });
    } catch (e) {
      // Errors expected due to mocking
    }

    expect(mockFetch).toHaveBeenCalled();
    const [, fetchInit] = mockFetch.mock.calls[0];
    const headers = new Headers(fetchInit.headers);
    expect(headers.get('X-Amzn-Bedrock-GuardrailIdentifier')).toBe('my-guardrail-id');
    expect(headers.get('X-Amzn-Bedrock-GuardrailVersion')).toBe('1');
  });

  test('sends guardrail headers on streaming requests', async () => {
    const { AnthropicBedrock } = require('../src');

    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
      guardrailIdentifier: 'my-guardrail-id',
      guardrailVersion: 'DRAFT',
    });

    try {
      await client.messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
        stream: true,
      });
    } catch (e) {
      // Errors expected due to mocking
    }

    expect(mockFetch).toHaveBeenCalled();
    const fetchUrl = mockFetch.mock.calls[0][0];
    expect(fetchUrl).toContain('/invoke-with-response-stream');
    const [, fetchInit] = mockFetch.mock.calls[0];
    const headers = new Headers(fetchInit.headers);
    expect(headers.get('X-Amzn-Bedrock-GuardrailIdentifier')).toBe('my-guardrail-id');
    expect(headers.get('X-Amzn-Bedrock-GuardrailVersion')).toBe('DRAFT');
  });

  test('does not send guardrail headers when not configured', async () => {
    const { AnthropicBedrock } = require('../src');

    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });

    try {
      await client.messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });
    } catch (e) {
      // Errors expected due to mocking
    }

    expect(mockFetch).toHaveBeenCalled();
    const [, fetchInit] = mockFetch.mock.calls[0];
    const headers = new Headers(fetchInit.headers);
    expect(headers.get('X-Amzn-Bedrock-GuardrailIdentifier')).toBeNull();
    expect(headers.get('X-Amzn-Bedrock-GuardrailVersion')).toBeNull();
  });

  test('reads guardrail config from environment variables', async () => {
    process.env['BEDROCK_GUARDRAIL_IDENTIFIER'] = 'env-guardrail-id';
    process.env['BEDROCK_GUARDRAIL_VERSION'] = '3';

    // Clear module cache so env vars are re-read
    jest.resetModules();
    const { AnthropicBedrock } = require('../src');

    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });

    try {
      await client.messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });
    } catch (e) {
      // Errors expected due to mocking
    }

    expect(mockFetch).toHaveBeenCalled();
    const [, fetchInit] = mockFetch.mock.calls[0];
    const headers = new Headers(fetchInit.headers);
    expect(headers.get('X-Amzn-Bedrock-GuardrailIdentifier')).toBe('env-guardrail-id');
    expect(headers.get('X-Amzn-Bedrock-GuardrailVersion')).toBe('3');
  });

  test('constructor params override environment variables', async () => {
    process.env['BEDROCK_GUARDRAIL_IDENTIFIER'] = 'env-guardrail-id';
    process.env['BEDROCK_GUARDRAIL_VERSION'] = '3';

    jest.resetModules();
    const { AnthropicBedrock } = require('../src');

    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
      guardrailIdentifier: 'constructor-guardrail-id',
      guardrailVersion: '7',
    });

    try {
      await client.messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });
    } catch (e) {
      // Errors expected due to mocking
    }

    expect(mockFetch).toHaveBeenCalled();
    const [, fetchInit] = mockFetch.mock.calls[0];
    const headers = new Headers(fetchInit.headers);
    expect(headers.get('X-Amzn-Bedrock-GuardrailIdentifier')).toBe('constructor-guardrail-id');
    expect(headers.get('X-Amzn-Bedrock-GuardrailVersion')).toBe('7');
  });

  test('throws when guardrailIdentifier is set without guardrailVersion', () => {
    const { AnthropicBedrock } = require('../src');

    expect(() => {
      new AnthropicBedrock({
        awsRegion: 'us-east-1',
        baseURL: 'http://localhost:4010',
        guardrailIdentifier: 'my-guardrail-id',
      });
    }).toThrow('guardrailVersion is required when guardrailIdentifier is provided');
  });

  test('preserves other custom headers alongside guardrail headers', async () => {
    const { AnthropicBedrock } = require('../src');

    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
      guardrailIdentifier: 'my-guardrail-id',
      guardrailVersion: '1',
      defaultHeaders: {
        'X-Custom-Header': 'custom-value',
      },
    });

    try {
      await client.messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });
    } catch (e) {
      // Errors expected due to mocking
    }

    expect(mockFetch).toHaveBeenCalled();
    const [, fetchInit] = mockFetch.mock.calls[0];
    const headers = new Headers(fetchInit.headers);
    expect(headers.get('X-Amzn-Bedrock-GuardrailIdentifier')).toBe('my-guardrail-id');
    expect(headers.get('X-Amzn-Bedrock-GuardrailVersion')).toBe('1');
    expect(headers.get('X-Custom-Header')).toBe('custom-value');
  });

  test('guardrail params take precedence over guardrail custom headers', async () => {
    const { AnthropicBedrock } = require('../src');

    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
      guardrailIdentifier: 'param-guardrail-id',
      guardrailVersion: '2',
      defaultHeaders: {
        'X-Amzn-Bedrock-GuardrailIdentifier': 'header-guardrail-id',
        'X-Amzn-Bedrock-GuardrailVersion': '99',
      },
    });

    try {
      await client.messages.create({
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });
    } catch (e) {
      // Errors expected due to mocking
    }

    expect(mockFetch).toHaveBeenCalled();
    const [, fetchInit] = mockFetch.mock.calls[0];
    const headers = new Headers(fetchInit.headers);
    expect(headers.get('X-Amzn-Bedrock-GuardrailIdentifier')).toBe('param-guardrail-id');
    expect(headers.get('X-Amzn-Bedrock-GuardrailVersion')).toBe('2');
  });
});
