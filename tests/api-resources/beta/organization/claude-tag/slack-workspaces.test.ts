import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
  defaultQuery: { beta: 'true' },
});

describe('resource slackWorkspaces', () => {
  test('retrieve', async () => {
    const responsePromise = client.beta.organization.claudeTag.slackWorkspaces.retrieve(
      'slws_01Hq8TzW5mKc2YbX7vNd4RfJ',
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
      client.beta.organization.claudeTag.slackWorkspaces.retrieve(
        'slws_01Hq8TzW5mKc2YbX7vNd4RfJ',
        { include_inherited: true, betas: ['message-batches-2024-09-24'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('update: only required params', async () => {
    const responsePromise = client.beta.organization.claudeTag.slackWorkspaces.update(
      'slws_01Hq8TzW5mKc2YbX7vNd4RfJ',
      { settings: {} },
    );
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('update: required and optional params', async () => {
    const response = await client.beta.organization.claudeTag.slackWorkspaces.update(
      'slws_01Hq8TzW5mKc2YbX7vNd4RfJ',
      {
        settings: {
          enabled: true,
          environment_id: 'x',
          guest_policy: { type: 'allow' },
          instructions: 'instructions',
          model: 'x',
        },
        betas: ['message-batches-2024-09-24'],
      },
    );
  });

  test('list', async () => {
    const responsePromise = client.beta.organization.claudeTag.slackWorkspaces.list();
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
      client.beta.organization.claudeTag.slackWorkspaces.list(
        {
          include_inherited: true,
          limit: 0,
          page: 'page',
          slack_workspace_id: 'slack_workspace_id',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });
});
