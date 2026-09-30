import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource usageReport', () => {
  test('list: only required params', async () => {
    const responsePromise = client.beta.organization.analytics.usageReport.list({
      starting_at: '2019-12-27T18:11:19.117Z',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('list: required and optional params', async () => {
    const response = await client.beta.organization.analytics.usageReport.list({
      starting_at: '2019-12-27T18:11:19.117Z',
      bucket_width: '1d',
      claude_tag_categories: ['engaged'],
      claude_tag_user_ids: ['U0123ABCDEF'],
      context_windows: ['0-200k'],
      ending_at: '2019-12-27T18:11:19.117Z',
      group_by: ['claude_tag_category'],
      inference_geos: ['global'],
      limit: 1,
      models: ['string'],
      page: 'page',
      products: ['chat'],
      rbac_group_ids: ['rbac_group_012rppKaSVsmTo6NqRDXQXNF'],
      slack_channel_ids: ['C0123ABCDEF'],
      speeds: ['fast'],
      user_ids: ['string'],
    });
  });
});
