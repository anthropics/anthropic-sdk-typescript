// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource certificates', () => {
  test('create: only required params', async () => {
    const responsePromise = client.beta.tunnels.certificates.create('tunnel_id', {
      ca_certificate_pem: 'ca_certificate_pem',
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
    const response = await client.beta.tunnels.certificates.create('tunnel_id', {
      ca_certificate_pem: 'ca_certificate_pem',
      betas: ['message-batches-2024-09-24'],
    });
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('retrieve: only required params', async () => {
    const responsePromise = client.beta.tunnels.certificates.retrieve('certificate_id', {
      tunnel_id: 'tunnel_id',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('retrieve: required and optional params', async () => {
    const response = await client.beta.tunnels.certificates.retrieve('certificate_id', {
      tunnel_id: 'tunnel_id',
      betas: ['message-batches-2024-09-24'],
    });
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('list', async () => {
    const responsePromise = client.beta.tunnels.certificates.list('tunnel_id');
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
      client.beta.tunnels.certificates.list(
        'tunnel_id',
        {
          include_archived: true,
          limit: 0,
          page: 'page',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('archive: only required params', async () => {
    const responsePromise = client.beta.tunnels.certificates.archive('certificate_id', {
      tunnel_id: 'tunnel_id',
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
    const response = await client.beta.tunnels.certificates.archive('certificate_id', {
      tunnel_id: 'tunnel_id',
      betas: ['message-batches-2024-09-24'],
    });
  });
});
