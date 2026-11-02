import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
  defaultQuery: { beta: 'true' },
});

describe('resource rateLimits', () => {
  test('update: only required params', async () => {
    const responsePromise = client.beta.organization.workspaces.rateLimits.update('rate_limit_id', {
      workspace_id: 'workspace_id',
      limits: [{ type: 'fast_itpmca', value: 0 }],
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
    const response = await client.beta.organization.workspaces.rateLimits.update('rate_limit_id', {
      workspace_id: 'workspace_id',
      limits: [{ type: 'fast_itpmca', value: 0 }],
    });
  });

  test('list', async () => {
    const responsePromise = client.beta.organization.workspaces.rateLimits.list('workspace_id');
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
      client.beta.organization.workspaces.rateLimits.list(
        'workspace_id',
        {
          group_type: 'batch',
          include_inherited: true,
          limit: 1,
          page: 'page',
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });
});
