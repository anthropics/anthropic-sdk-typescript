import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
  defaultQuery: { beta: 'true' },
});

describe('resource cases', () => {
  test('retrieve', async () => {
    const responsePromise = client.beta.compliance.review.cases.retrieve('case_id');
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
      client.beta.compliance.review.cases.retrieve(
        'case_id',
        { betas: ['computer-use-2024-10-22'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('list', async () => {
    const responsePromise = client.beta.compliance.review.cases.list();
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
      client.beta.compliance.review.cases.list(
        {
          'created_at[gt]': '2019-12-27T18:11:19.117Z',
          'created_at[gte]': '2019-12-27T18:11:19.117Z',
          'created_at[lt]': '2019-12-27T18:11:19.117Z',
          'created_at[lte]': '2019-12-27T18:11:19.117Z',
          limit: 0,
          order: 'asc',
          order_by: 'created_at',
          page: 'page',
          status: 'open',
          'updated_at[gt]': '2019-12-27T18:11:19.117Z',
          'updated_at[gte]': '2019-12-27T18:11:19.117Z',
          'updated_at[lt]': '2019-12-27T18:11:19.117Z',
          'updated_at[lte]': '2019-12-27T18:11:19.117Z',
          user_profile_id: 'user_profile_id',
          betas: ['computer-use-2024-10-22'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('respond: only required params', async () => {
    const responsePromise = client.beta.compliance.review.cases.respond('case_id', {
      determination: 'no_violation',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('respond: required and optional params', async () => {
    const response = await client.beta.compliance.review.cases.respond('case_id', {
      determination: 'no_violation',
      policy_categories: ['cyber'],
      verdicts: [
        {
          determination: 'violation',
          item_id: 'item_id',
          policy_category: 'cyber',
        },
      ],
      betas: ['computer-use-2024-10-22'],
    });
  });
});
