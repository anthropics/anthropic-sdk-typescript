// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource threads', () => {
  test('retrieve: only required params', async () => {
    const responsePromise = client.beta.sessions.threads.retrieve('sthr_011CZkZVWa6oIjw0rgXZpnBt', {
      session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7',
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
    const response = await client.beta.sessions.threads.retrieve('sthr_011CZkZVWa6oIjw0rgXZpnBt', {
      session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7',
      betas: ['message-batches-2024-09-24'],
    });
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('list', async () => {
    const responsePromise = client.beta.sessions.threads.list('sesn_011CZkZAtmR3yMPDzynEDxu7');
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
      client.beta.sessions.threads.list(
        'sesn_011CZkZAtmR3yMPDzynEDxu7',
        {
          limit: 0,
          page: 'page',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('archive: only required params', async () => {
    const responsePromise = client.beta.sessions.threads.archive('sthr_011CZkZVWa6oIjw0rgXZpnBt', {
      session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('archive: required and optional params', async () => {
    const response = await client.beta.sessions.threads.archive('sthr_011CZkZVWa6oIjw0rgXZpnBt', {
      session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7',
      betas: ['message-batches-2024-09-24'],
    });
  });
});
