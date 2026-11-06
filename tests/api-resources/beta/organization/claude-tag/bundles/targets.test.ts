import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
  defaultQuery: { beta: 'true' },
});

describe('resource targets', () => {
  test('create: only required params', async () => {
    const responsePromise = client.beta.organization.claudeTag.bundles.targets.create(
      'capp_011CZkZjLP1cWxj5EtMmdgbq',
      { target: { slack_channel_id: 'xxxxxxxx', type: 'slack_channel' } },
    );
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('create: required and optional params', async () => {
    const response = await client.beta.organization.claudeTag.bundles.targets.create(
      'capp_011CZkZjLP1cWxj5EtMmdgbq',
      {
        target: { slack_channel_id: 'xxxxxxxx', type: 'slack_channel' },
        betas: ['message-batches-2024-09-24'],
      },
    );
  });

  test('retrieve: only required params', async () => {
    const responsePromise = client.beta.organization.claudeTag.bundles.targets.retrieve(
      'btgt_01SvpyRQK3nN6eH9uhRA7n1qHq8TzW5mKc2YbX7vNd4RfJ',
      { bundle_id: 'capp_011CZkZjLP1cWxj5EtMmdgbq' },
    );
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('retrieve: required and optional params', async () => {
    const response = await client.beta.organization.claudeTag.bundles.targets.retrieve(
      'btgt_01SvpyRQK3nN6eH9uhRA7n1qHq8TzW5mKc2YbX7vNd4RfJ',
      { bundle_id: 'capp_011CZkZjLP1cWxj5EtMmdgbq', betas: ['message-batches-2024-09-24'] },
    );
  });

  test('list', async () => {
    const responsePromise = client.beta.organization.claudeTag.bundles.targets.list(
      'capp_011CZkZjLP1cWxj5EtMmdgbq',
    );
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('list: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.organization.claudeTag.bundles.targets.list(
        'capp_011CZkZjLP1cWxj5EtMmdgbq',
        {
          limit: 0,
          page: 'page',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('delete: only required params', async () => {
    const responsePromise = client.beta.organization.claudeTag.bundles.targets.delete(
      'btgt_01SvpyRQK3nN6eH9uhRA7n1qHq8TzW5mKc2YbX7vNd4RfJ',
      { bundle_id: 'capp_011CZkZjLP1cWxj5EtMmdgbq' },
    );
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('delete: required and optional params', async () => {
    const response = await client.beta.organization.claudeTag.bundles.targets.delete(
      'btgt_01SvpyRQK3nN6eH9uhRA7n1qHq8TzW5mKc2YbX7vNd4RfJ',
      { bundle_id: 'capp_011CZkZjLP1cWxj5EtMmdgbq', betas: ['message-batches-2024-09-24'] },
    );
  });
});
