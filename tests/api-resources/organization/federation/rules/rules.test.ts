import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource rules', () => {
  test('create: only required params', async () => {
    const responsePromise = client.organization.federation.rules.create({
      issuer_id: 'fdis_01SDCCSbTxrXDpWc1phhtcfK',
      match: {},
      name: 'prod-deploy-pipeline',
      oauth_scope: 'workspace:developer',
      target: { service_account_id: 'svac_01SDCCSbTxrXDpWc1phhtcfK', type: 'service_account' },
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
    const response = await client.organization.federation.rules.create({
      issuer_id: 'fdis_01SDCCSbTxrXDpWc1phhtcfK',
      match: {
        audience: 'audience',
        claims: {
          event_name: 'push',
          ref: 'refs/heads/main',
          repository_id: '123456789',
          repository_owner_id: '987654321',
        },
        condition: 'condition',
        subject_prefix: 'subject_prefix',
      },
      name: 'prod-deploy-pipeline',
      oauth_scope: 'workspace:developer',
      target: {
        service_account_id: 'svac_01SDCCSbTxrXDpWc1phhtcfK',
        type: 'service_account',
        service_account_name: 'service_account_name',
      },
      applies_to_all_workspaces: true,
      description: 'description',
      token_lifetime_seconds: 60,
      workspace_id: 'wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ',
    });
  });

  test('retrieve', async () => {
    const responsePromise = client.organization.federation.rules.retrieve('federation_rule_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('update', async () => {
    const responsePromise = client.organization.federation.rules.update('federation_rule_id', {});
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('list', async () => {
    const responsePromise = client.organization.federation.rules.list();
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
      client.organization.federation.rules.list(
        {
          include_archived: true,
          issuer_id: 'issuer_id',
          limit: 1,
          page: 'page',
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('archive', async () => {
    const responsePromise = client.organization.federation.rules.archive('federation_rule_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });
});
