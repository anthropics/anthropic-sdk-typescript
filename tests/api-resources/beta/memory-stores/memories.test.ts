// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource memories', () => {
  test('create: only required params', async () => {
    const responsePromise = client.beta.memoryStores.memories.create('memory_store_id', {
      content: 'content',
      path: 'xx',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('create: required and optional params', async () => {
    const response = await client.beta.memoryStores.memories.create('memory_store_id', {
      content: 'content',
      path: 'xx',
      view: 'basic',
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('retrieve: only required params', async () => {
    const responsePromise = client.beta.memoryStores.memories.retrieve('memory_id', {
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
    const response = await client.beta.memoryStores.memories.retrieve('memory_id', {
      memory_store_id: 'memory_store_id',
      view: 'basic',
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('update: only required params', async () => {
    const responsePromise = client.beta.memoryStores.memories.update('memory_id', {
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

  test('update: required and optional params', async () => {
    const response = await client.beta.memoryStores.memories.update('memory_id', {
      memory_store_id: 'memory_store_id',
      view: 'basic',
      content: 'content',
      path: 'xx',
      precondition: { type: 'content_sha256', content_sha256: 'content_sha256' },
      betas: ['message-batches-2024-09-24'],
    });
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('list', async () => {
    const responsePromise = client.beta.memoryStores.memories.list('memory_store_id');
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
      client.beta.memoryStores.memories.list(
        'memory_store_id',
        {
          depth: 0,
          limit: 0,
          order: 'asc',
          order_by: 'order_by',
          page: 'page',
          path_prefix: 'path_prefix',
          view: 'basic',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('delete: only required params', async () => {
    const responsePromise = client.beta.memoryStores.memories.delete('memory_id', {
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

  test('delete: required and optional params', async () => {
    const response = await client.beta.memoryStores.memories.delete('memory_id', {
      memory_store_id: 'memory_store_id',
      expected_content_sha256: 'expected_content_sha256',
      betas: ['message-batches-2024-09-24'],
    });
  });
});
