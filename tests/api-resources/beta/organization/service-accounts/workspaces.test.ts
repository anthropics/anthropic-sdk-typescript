// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource workspaces', () => {
  test('list', async () => {
    const responsePromise = client.beta.organization.serviceAccounts.workspaces.list('service_account_id');
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
      client.beta.organization.serviceAccounts.workspaces.list(
        'service_account_id',
        {
          limit: 1,
          page: 'page',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('add: only required params', async () => {
    const responsePromise = client.beta.organization.serviceAccounts.workspaces.add('service_account_id', {
      workspace_id: 'workspace_id',
      workspace_role: 'workspace_admin',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('add: required and optional params', async () => {
    const response = await client.beta.organization.serviceAccounts.workspaces.add('service_account_id', {
      workspace_id: 'workspace_id',
      workspace_role: 'workspace_admin',
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('remove: only required params', async () => {
    const responsePromise = client.beta.organization.serviceAccounts.workspaces.remove('workspace_id', {
      service_account_id: 'service_account_id',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('remove: required and optional params', async () => {
    const response = await client.beta.organization.serviceAccounts.workspaces.remove('workspace_id', {
      service_account_id: 'service_account_id',
      betas: ['message-batches-2024-09-24'],
    });
  });
});
