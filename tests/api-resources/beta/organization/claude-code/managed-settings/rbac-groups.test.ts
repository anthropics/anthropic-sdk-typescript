import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
  defaultQuery: { beta: 'true' },
});

describe('resource rbacGroups', () => {
  test('retrieve', async () => {
    const responsePromise =
      client.beta.organization.claudeCode.managedSettings.rbacGroups.retrieve('rbac_group_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('retrieve: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.organization.claudeCode.managedSettings.rbacGroups.retrieve(
        'rbac_group_id',
        { betas: ['computer-use-2024-10-22'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('list', async () => {
    const responsePromise = client.beta.organization.claudeCode.managedSettings.rbacGroups.list();
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
      client.beta.organization.claudeCode.managedSettings.rbacGroups.list(
        {
          limit: 1,
          page: 'page',
          betas: ['computer-use-2024-10-22'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('delete', async () => {
    const responsePromise =
      client.beta.organization.claudeCode.managedSettings.rbacGroups.delete('rbac_group_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('delete: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.organization.claudeCode.managedSettings.rbacGroups.delete(
        'rbac_group_id',
        { betas: ['computer-use-2024-10-22'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('set: only required params', async () => {
    const responsePromise = client.beta.organization.claudeCode.managedSettings.rbacGroups.set(
      'rbac_group_id',
      { settings: { foo: 'bar' } },
    );
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('set: required and optional params', async () => {
    const response = await client.beta.organization.claudeCode.managedSettings.rbacGroups.set(
      'rbac_group_id',
      {
        settings: { foo: 'bar' },
        betas: ['computer-use-2024-10-22'],
      },
    );
  });
});
