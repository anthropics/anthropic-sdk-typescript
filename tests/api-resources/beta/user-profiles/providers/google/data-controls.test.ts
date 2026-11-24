import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
  defaultQuery: { beta: 'true' },
});

describe('resource dataControls', () => {
  test('retrieve', async () => {
    const responsePromise = client.beta.userProfiles.providers.google.dataControls.retrieve(
      'uprof_011CZkZCu8hGbp5mYRQgUmz9',
    );
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
      client.beta.userProfiles.providers.google.dataControls.retrieve(
        'uprof_011CZkZCu8hGbp5mYRQgUmz9',
        { betas: ['computer-use-2024-10-22'], workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('update', async () => {
    const responsePromise = client.beta.userProfiles.providers.google.dataControls.update(
      'uprof_011CZkZCu8hGbp5mYRQgUmz9',
      {},
    );
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });
});
