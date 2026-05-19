// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource work', () => {
  test('retrieve: only required params', async () => {
    const responsePromise = client.beta.environments.work.retrieve('work_id', {
      environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
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
    const response = await client.beta.environments.work.retrieve('work_id', {
      environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('update: only required params', async () => {
    const responsePromise = client.beta.environments.work.update('work_id', {
      environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
      metadata: { foo: 'string' },
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
    const response = await client.beta.environments.work.update('work_id', {
      environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
      metadata: { foo: 'string' },
      betas: ['message-batches-2024-09-24'],
    });
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('list', async () => {
    const responsePromise = client.beta.environments.work.list('env_011CZkZ9X2dpNyB7HsEFoRfW');
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
      client.beta.environments.work.list(
        'env_011CZkZ9X2dpNyB7HsEFoRfW',
        {
          limit: 1,
          page: 'page',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('ack: only required params', async () => {
    const responsePromise = client.beta.environments.work.ack('work_id', {
      environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('ack: required and optional params', async () => {
    const response = await client.beta.environments.work.ack('work_id', {
      environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('heartbeat: only required params', async () => {
    const responsePromise = client.beta.environments.work.heartbeat('work_id', {
      environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('heartbeat: required and optional params', async () => {
    const response = await client.beta.environments.work.heartbeat('work_id', {
      environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
      desired_ttl_seconds: 0,
      expected_last_heartbeat: 'expected_last_heartbeat',
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('poll', async () => {
    const responsePromise = client.beta.environments.work.poll('env_011CZkZ9X2dpNyB7HsEFoRfW');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('poll: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.environments.work.poll(
        'env_011CZkZ9X2dpNyB7HsEFoRfW',
        {
          block_ms: 1,
          reclaim_older_than_ms: 1,
          betas: ['message-batches-2024-09-24'],
          'Anthropic-Worker-ID': 'Anthropic-Worker-ID',
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('stats', async () => {
    const responsePromise = client.beta.environments.work.stats('env_011CZkZ9X2dpNyB7HsEFoRfW');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('stats: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.environments.work.stats(
        'env_011CZkZ9X2dpNyB7HsEFoRfW',
        { betas: ['message-batches-2024-09-24'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('stop: only required params', async () => {
    const responsePromise = client.beta.environments.work.stop('work_id', {
      environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('stop: required and optional params', async () => {
    const response = await client.beta.environments.work.stop('work_id', {
      environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
      force: true,
      betas: ['message-batches-2024-09-24'],
    });
  });
});
