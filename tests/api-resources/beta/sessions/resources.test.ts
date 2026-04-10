// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource resources', () => {
  // prism can't find endpoint with beta only tag
  test.skip('retrieve: only required params', async () => {
    const responsePromise = client.beta.sessions.resources.retrieve('sesrsc_011CZkZBJq5dWxk9fVLNcPht', {
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

  // prism can't find endpoint with beta only tag
  test.skip('retrieve: required and optional params', async () => {
    const response = await client.beta.sessions.resources.retrieve('sesrsc_011CZkZBJq5dWxk9fVLNcPht', {
      session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7',
      betas: ['message-batches-2024-09-24'],
    });
  });

  // prism can't find endpoint with beta only tag
  test.skip('update: only required params', async () => {
    const responsePromise = client.beta.sessions.resources.update('sesrsc_011CZkZBJq5dWxk9fVLNcPht', {
      session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7',
      authorization_token: 'ghp_exampletoken',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // prism can't find endpoint with beta only tag
  test.skip('update: required and optional params', async () => {
    const response = await client.beta.sessions.resources.update('sesrsc_011CZkZBJq5dWxk9fVLNcPht', {
      session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7',
      authorization_token: 'ghp_exampletoken',
      betas: ['message-batches-2024-09-24'],
    });
  });

  // prism can't find endpoint with beta only tag
  test.skip('list', async () => {
    const responsePromise = client.beta.sessions.resources.list('sesn_011CZkZAtmR3yMPDzynEDxu7');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // prism can't find endpoint with beta only tag
  test.skip('list: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.sessions.resources.list(
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

  // prism can't find endpoint with beta only tag
  test.skip('delete: only required params', async () => {
    const responsePromise = client.beta.sessions.resources.delete('sesrsc_011CZkZBJq5dWxk9fVLNcPht', {
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

  // prism can't find endpoint with beta only tag
  test.skip('delete: required and optional params', async () => {
    const response = await client.beta.sessions.resources.delete('sesrsc_011CZkZBJq5dWxk9fVLNcPht', {
      session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7',
      betas: ['message-batches-2024-09-24'],
    });
  });

  // prism can't find endpoint with beta only tag
  test.skip('add: only required params', async () => {
    const responsePromise = client.beta.sessions.resources.add('sesn_011CZkZAtmR3yMPDzynEDxu7', {
      file_id: 'file_011CNha8iCJcU1wXNR6q4V8w',
      type: 'file',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // prism can't find endpoint with beta only tag
  test.skip('add: required and optional params', async () => {
    const response = await client.beta.sessions.resources.add('sesn_011CZkZAtmR3yMPDzynEDxu7', {
      file_id: 'file_011CNha8iCJcU1wXNR6q4V8w',
      type: 'file',
      mount_path: '/uploads/receipt.pdf',
      betas: ['message-batches-2024-09-24'],
    });
  });
});
