import type { AwsCredentialIdentityProvider } from '@smithy/types';
import { APIConnectionError } from '../src/core/error';
import { AnthropicBedrock, AnthropicBedrockMantle } from '../src';

const mockFetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('{}'),
  }),
);

const createParams = {
  model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  max_tokens: 1024,
  messages: [{ content: 'Hello', role: 'user' as const }],
};

const transientFailure = new Error('could not reach IMDS');
const credentials = { accessKeyId: 'access-key', secretAccessKey: 'secret-key' };

describe.each([
  [
    'AnthropicBedrock',
    (provider: AwsCredentialIdentityProvider, maxRetries: number) =>
      new AnthropicBedrock({
        awsRegion: 'us-east-1',
        baseURL: 'http://localhost:4010',
        fetch: mockFetch as any,
        maxRetries,
        providerChainResolver: async () => provider,
      }),
  ],
  [
    'AnthropicBedrockMantle',
    (provider: AwsCredentialIdentityProvider, maxRetries: number) =>
      new AnthropicBedrockMantle({
        awsRegion: 'us-east-1',
        baseURL: 'http://localhost:4010',
        fetch: mockFetch as any,
        maxRetries,
        providerChainResolver: async () => provider,
      }),
  ],
])('%s credential resolution', (_name, makeClient) => {
  const originalEnv = process.env;

  beforeEach(() => {
    mockFetch.mockClear();
    // A bearer token from the environment would switch the client out of
    // SigV4 mode and skip credential resolution entirely.
    process.env = { ...originalEnv };
    delete process.env['AWS_BEARER_TOKEN_BEDROCK'];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('a transient credential provider failure is retried', async () => {
    const provider = jest
      .fn<Promise<typeof credentials>, []>()
      .mockRejectedValueOnce(transientFailure)
      .mockResolvedValue(credentials);

    await makeClient(provider, 2).messages.create(createParams);

    expect(provider).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('persistent credential failures surface as APIConnectionError once retries are exhausted', async () => {
    const provider = jest.fn<Promise<typeof credentials>, []>().mockRejectedValue(transientFailure);

    await expect(makeClient(provider, 1).messages.create(createParams)).rejects.toThrow(APIConnectionError);

    expect(provider).toHaveBeenCalledTimes(2);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
