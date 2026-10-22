import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource members', () => {
  test('list', async () => {
    const responsePromise = client.beta.organization.rbacGroups.members.list('rbac_group_id');
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
      client.beta.organization.rbacGroups.members.list(
        'rbac_group_id',
        { limit: 1, page: 'eyJjdXJzb3IiOiAicmJhY19ncm91cF8wMSJ9' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('add: only required params', async () => {
    const responsePromise = client.beta.organization.rbacGroups.members.add('rbac_group_id', {
      user_id: 'user_01WCz1FkmYMm4gnmykNKUu3Q',
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
    const response = await client.beta.organization.rbacGroups.members.add('rbac_group_id', {
      user_id: 'user_01WCz1FkmYMm4gnmykNKUu3Q',
    });
  });

  test('remove: only required params', async () => {
    const responsePromise = client.beta.organization.rbacGroups.members.remove('user_id', {
      rbac_group_id: 'rbac_group_id',
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
    const response = await client.beta.organization.rbacGroups.members.remove('user_id', {
      rbac_group_id: 'rbac_group_id',
    });
  });
});
