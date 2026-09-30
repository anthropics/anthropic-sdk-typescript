import Anthropic, { toFile } from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource pluginMarketplaces', () => {
  test('retrieve', async () => {
    const responsePromise = client.beta.organization.pluginMarketplaces.retrieve('marketplace_id');
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
      client.beta.organization.pluginMarketplaces.retrieve(
        'marketplace_id',
        { organization_id: 'organization_id', betas: ['message-batches-2024-09-24'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('update: only required params', async () => {
    const responsePromise = client.beta.organization.pluginMarketplaces.update('marketplace_id', {
      default_installation_preference: 'available',
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
    const response = await client.beta.organization.pluginMarketplaces.update('marketplace_id', {
      default_installation_preference: 'available',
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('list', async () => {
    const responsePromise = client.beta.organization.pluginMarketplaces.list();
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
      client.beta.organization.pluginMarketplaces.list(
        {
          limit: 1,
          organization_id: 'organization_id',
          owner_type: 'organization',
          page: 'page',
          source: 'directory',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('validateArchive: only required params', async () => {
    const responsePromise = client.beta.organization.pluginMarketplaces.validateArchive({
      archive: await toFile(Buffer.from('Example data'), 'README.md'),
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('validateArchive: required and optional params', async () => {
    const response = await client.beta.organization.pluginMarketplaces.validateArchive({
      archive: await toFile(Buffer.from('Example data'), 'README.md'),
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('validateRepository: only required params', async () => {
    const responsePromise = client.beta.organization.pluginMarketplaces.validateRepository({
      repository_url: 'https://github.com/example-org/example-marketplace',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('validateRepository: required and optional params', async () => {
    const response = await client.beta.organization.pluginMarketplaces.validateRepository({
      repository_url: 'https://github.com/example-org/example-marketplace',
      ref: 'main',
      betas: ['message-batches-2024-09-24'],
    });
  });
});
