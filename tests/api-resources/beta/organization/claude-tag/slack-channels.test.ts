import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
  defaultQuery: { beta: 'true' },
});

describe('resource slackChannels', () => {
  test('create: only required params', async () => {
    const responsePromise = client.beta.organization.claudeTag.slackChannels.create({
      slack: { channel_id: 'xx', workspace_id: 'xx' },
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
    const response = await client.beta.organization.claudeTag.slackChannels.create({
      slack: { channel_id: 'xx', workspace_id: 'xx' },
      settings: {
        enabled: true,
        environment_id: 'x',
        guest_policy: { type: 'allow' },
        instructions: 'instructions',
        model: 'x',
      },
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('retrieve', async () => {
    const responsePromise = client.beta.organization.claudeTag.slackChannels.retrieve(
      'slch_01SvpyRQK3nN6eH9uhRA7n1q',
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
      client.beta.organization.claudeTag.slackChannels.retrieve(
        'slch_01SvpyRQK3nN6eH9uhRA7n1q',
        { include_inherited: true, betas: ['message-batches-2024-09-24'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('update: only required params', async () => {
    const responsePromise = client.beta.organization.claudeTag.slackChannels.update(
      'slch_01SvpyRQK3nN6eH9uhRA7n1q',
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
    const response = await client.beta.organization.claudeTag.slackChannels.update(
      'slch_01SvpyRQK3nN6eH9uhRA7n1q',
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

  test('list: only required params', async () => {
    const responsePromise = client.beta.organization.claudeTag.slackChannels.list({
      slack_workspace_id: 'slack_workspace_id',
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
    const response = await client.beta.organization.claudeTag.slackChannels.list({
      slack_workspace_id: 'slack_workspace_id',
      include_inherited: true,
      limit: 0,
      page: 'page',
      slack_channel_id: 'slack_channel_id',
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('delete', async () => {
    const responsePromise = client.beta.organization.claudeTag.slackChannels.delete(
      'slch_01SvpyRQK3nN6eH9uhRA7n1q',
    );
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('delete: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.organization.claudeTag.slackChannels.delete(
        'slch_01SvpyRQK3nN6eH9uhRA7n1q',
        { betas: ['message-batches-2024-09-24'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });
});
