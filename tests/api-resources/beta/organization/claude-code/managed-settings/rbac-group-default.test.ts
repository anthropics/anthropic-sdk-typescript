import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
  defaultQuery: { beta: 'true' },
});

describe('resource rbacGroupDefault', () => {
  test('retrieve', async () => {
    const responsePromise = client.beta.organization.claudeCode.managedSettings.rbacGroupDefault.retrieve();
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
      client.beta.organization.claudeCode.managedSettings.rbacGroupDefault.retrieve(
        { betas: ['computer-use-2024-10-22'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('update: only required params', async () => {
    const responsePromise = client.beta.organization.claudeCode.managedSettings.rbacGroupDefault.update({
      settings: { foo: 'bar' },
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
    const response = await client.beta.organization.claudeCode.managedSettings.rbacGroupDefault.update({
      settings: { foo: 'bar' },
      betas: ['computer-use-2024-10-22'],
    });
  });
});
