// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource memoryVersions', () => {
  test('retrieve: only required params', async () => {
    const responsePromise = client.beta.memoryStores.memoryVersions.retrieve('memory_version_id', {
      memory_store_id: 'memory_store_id',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('retrieve: required and optional params', async () => {
    const response = await client.beta.memoryStores.memoryVersions.retrieve('memory_version_id', {
      memory_store_id: 'memory_store_id',
      view: 'basic',
      betas: ['message-batches-2024-09-24'],
    });
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('list', async () => {
    const responsePromise = client.beta.memoryStores.memoryVersions.list('memory_store_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('list: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.memoryStores.memoryVersions.list(
        'memory_store_id',
        {
          api_key_id: 'api_key_id',
          'created_at[gte]': '2019-12-27T18:11:19.117Z',
          'created_at[lte]': '2019-12-27T18:11:19.117Z',
          limit: 0,
          memory_id: 'memory_id',
          operation: 'created',
          page: 'page',
          session_id: 'session_id',
          view: 'basic',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('redact: only required params', async () => {
    const responsePromise = client.beta.memoryStores.memoryVersions.redact('memory_version_id', {
      memory_store_id: 'memory_store_id',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('redact: required and optional params', async () => {
    const response = await client.beta.memoryStores.memoryVersions.redact('memory_version_id', {
      memory_store_id: 'memory_store_id',
      betas: ['message-batches-2024-09-24'],
    });
  });
});
