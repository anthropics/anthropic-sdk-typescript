import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource actionURLs', () => {
  test('create: only required params', async () => {
    const responsePromise = client.userProfiles.actionURLs.create('uprof_011CZkZCu8hGbp5mYRQgUmz9', {
      action: { type: 'enroll_end_user' },
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('create: required and optional params', async () => {
    const response = await client.userProfiles.actionURLs.create('uprof_011CZkZCu8hGbp5mYRQgUmz9', {
      action: { type: 'enroll_end_user' },
      workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy',
    });
  });
});
