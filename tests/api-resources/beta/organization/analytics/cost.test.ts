import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
  defaultQuery: { beta: 'true' },
});

describe('resource cost', () => {
  test('list: only required params', async () => {
    const responsePromise = client.beta.organization.analytics.cost.list({
      starting_at: '2026-09-01T00:00:00Z',
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
    const response = await client.beta.organization.analytics.cost.list({
      starting_at: '2026-09-01T00:00:00Z',
      actor_ids: ['user_01WCz1FkmYMm4gnmykNKUu3Q'],
      actor_types: ['service_account_actor'],
      agent_ids: ['agent_01VHd3EAGJ6PLkP9LM7DDu3f'],
      api_key_ids: ['apikey_01Rj2N8SVvo6BePZj99NhmiT'],
      claude_tag_categories: ['engaged'],
      claude_tag_user_ids: ['U0123ABCDEF'],
      context_windows: ['0-200k'],
      deployment_ids: ['depl_01JFC6ihzZHtAuyHsaENdJhY'],
      ending_at: '2026-10-01T00:00:00Z',
      environment_ids: ['env_017oTjuGedHtjhJauVC5xGJD'],
      exclude_deleted_users: true,
      group_by: ['actor'],
      inference_geos: ['global'],
      limit: 1,
      models: ['string'],
      order: 'asc',
      order_by: 'amount',
      page: 'page',
      products: ['chat'],
      rbac_group_ids: ['rbac_group_012rppKaSVsmTo6NqRDXQXNF'],
      service_tiers: ['batch'],
      session_ids: ['sesn_0187kPDyNCwibNNvfaPEApCJ'],
      slack_channel_ids: ['C0123ABCDEF'],
      speeds: ['fast'],
      time_bucket_width: '1d',
      user_profile_ids: ['uprof_01M33NeYUQK2WV9PpYcsPHLi'],
      workspace_ids: ['wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ'],
      betas: ['message-batches-2024-09-24'],
    });
  });
});
