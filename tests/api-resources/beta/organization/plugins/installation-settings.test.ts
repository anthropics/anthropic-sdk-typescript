import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource installationSettings', () => {
  test('list', async () => {
    const responsePromise = client.beta.organization.plugins.installationSettings.list('plugin_id');
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
      client.beta.organization.plugins.installationSettings.list(
        'plugin_id',
        {
          limit: 1,
          organization_id: 'organization_id',
          page: 'page',
          target_type: 'organization',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('remove: only required params', async () => {
    const responsePromise = client.beta.organization.plugins.installationSettings.remove('target', {
      plugin_id: 'plugin_id',
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
    const response = await client.beta.organization.plugins.installationSettings.remove('target', {
      plugin_id: 'plugin_id',
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('set: only required params', async () => {
    const responsePromise = client.beta.organization.plugins.installationSettings.set('target', {
      plugin_id: 'plugin_id',
      installation_preference: 'required',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('set: required and optional params', async () => {
    const response = await client.beta.organization.plugins.installationSettings.set('target', {
      plugin_id: 'plugin_id',
      installation_preference: 'required',
      betas: ['message-batches-2024-09-24'],
    });
  });
});
