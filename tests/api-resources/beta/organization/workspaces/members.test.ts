// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource members', () => {
  test('retrieve: only required params', async () => {
    const responsePromise = client.beta.organization.workspaces.members.retrieve('user_id', {
      workspace_id: 'workspace_id',
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
    const response = await client.beta.organization.workspaces.members.retrieve('user_id', {
      workspace_id: 'workspace_id',
    });
  });

  test('update: only required params', async () => {
    const responsePromise = client.beta.organization.workspaces.members.update('user_id', {
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

  test('update: required and optional params', async () => {
    const response = await client.beta.organization.workspaces.members.update('user_id', {
      workspace_id: 'workspace_id',
      workspace_role: 'workspace_admin',
    });
  });

  test('list', async () => {
    const responsePromise = client.beta.organization.workspaces.members.list('workspace_id');
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
      client.beta.organization.workspaces.members.list(
        'workspace_id',
        {
          after_id: 'after_id',
          before_id: 'before_id',
          limit: 1,
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('add: only required params', async () => {
    const responsePromise = client.beta.organization.workspaces.members.add('workspace_id', {
      user_id: 'user_01WCz1FkmYMm4gnmykNKUu3Q',
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
    const response = await client.beta.organization.workspaces.members.add('workspace_id', {
      user_id: 'user_01WCz1FkmYMm4gnmykNKUu3Q',
      workspace_role: 'workspace_admin',
    });
  });

  test('remove: only required params', async () => {
    const responsePromise = client.beta.organization.workspaces.members.remove('user_id', {
      workspace_id: 'workspace_id',
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
    const response = await client.beta.organization.workspaces.members.remove('user_id', {
      workspace_id: 'workspace_id',
    });
  });
});
