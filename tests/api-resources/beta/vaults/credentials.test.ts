// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: 'my-anthropic-api-key', baseURL: process.env["TEST_API_BASE_URL"] ?? 'http://127.0.0.1:4010' });

describe('resource credentials', () => {
  test('create: only required params', async () => {
    const responsePromise = client.beta.vaults.credentials.create('vlt_011CZkZDLs7fYzm1hXNPeRjv', { auth: {
    token: 'bearer_exampletoken',
    mcp_server_url: 'https://example-server.modelcontextprotocol.io/sse',
    type: 'static_bearer',
  } });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('create: required and optional params', async () => {
    const response = await client.beta.vaults.credentials.create('vlt_011CZkZDLs7fYzm1hXNPeRjv', {
    auth: {
    token: 'bearer_exampletoken',
    mcp_server_url: 'https://example-server.modelcontextprotocol.io/sse',
    type: 'static_bearer',
  },
    display_name: 'Example credential',
    metadata: { environment: 'production' },
    betas: ['message-batches-2024-09-24'],
  });
  });

  test('retrieve: only required params', async () => {
    const responsePromise = client.beta.vaults.credentials.retrieve('vcrd_011CZkZEMt8gZan2iYOQfSkw', { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('retrieve: required and optional params', async () => {
    const response = await client.beta.vaults.credentials.retrieve('vcrd_011CZkZEMt8gZan2iYOQfSkw', { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv', betas: ['message-batches-2024-09-24'] });
  });

  test('update: only required params', async () => {
    const responsePromise = client.beta.vaults.credentials.update('vcrd_011CZkZEMt8gZan2iYOQfSkw', { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('update: required and optional params', async () => {
    const response = await client.beta.vaults.credentials.update('vcrd_011CZkZEMt8gZan2iYOQfSkw', {
    vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv',
    auth: {
    type: 'mcp_oauth',
    access_token: 'x',
    expires_at: '2019-12-27T18:11:19.117Z',
    refresh: {
    refresh_token: 'x',
    scope: 'scope',
    token_endpoint_auth: { type: 'client_secret_basic', client_secret: 'x' },
  },
  },
    display_name: 'Example credential',
    metadata: { environment: 'production' },
    betas: ['message-batches-2024-09-24'],
  });
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('list', async () => {
    const responsePromise = client.beta.vaults.credentials.list('vlt_011CZkZDLs7fYzm1hXNPeRjv');
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
    await expect(client.beta.vaults.credentials.list('vlt_011CZkZDLs7fYzm1hXNPeRjv', {
    include_archived: true,
    limit: 0,
    page: 'page',
    betas: ['message-batches-2024-09-24'],
  }, { path: '/_stainless_unknown_path' }))
      .rejects
      .toThrow(Anthropic.NotFoundError);
  });

  test('delete: only required params', async () => {
    const responsePromise = client.beta.vaults.credentials.delete('vcrd_011CZkZEMt8gZan2iYOQfSkw', { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('delete: required and optional params', async () => {
    const response = await client.beta.vaults.credentials.delete('vcrd_011CZkZEMt8gZan2iYOQfSkw', { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv', betas: ['message-batches-2024-09-24'] });
  });

  test('archive: only required params', async () => {
    const responsePromise = client.beta.vaults.credentials.archive('vcrd_011CZkZEMt8gZan2iYOQfSkw', { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('archive: required and optional params', async () => {
    const response = await client.beta.vaults.credentials.archive('vcrd_011CZkZEMt8gZan2iYOQfSkw', { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv', betas: ['message-batches-2024-09-24'] });
  });
});
