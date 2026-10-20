import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource artifacts', () => {
  test('list: only required params', async () => {
    const responsePromise = client.beta.organization.analytics.artifacts.list({ date: '2019-12-27' });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('list: required and optional params', async () => {
    const response = await client.beta.organization.analytics.artifacts.list({
      date: '2019-12-27',
      filter: ['string'],
      group_by: ['product'],
      limit: 1,
      page: 'page',
    });
  });
});
