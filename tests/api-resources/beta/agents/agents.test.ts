// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource agents', () => {
  test('create: only required params', async () => {
    const responsePromise = client.beta.agents.create({ model: 'claude-sonnet-4-6', name: 'My First Agent' });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('create: required and optional params', async () => {
    const response = await client.beta.agents.create({
      model: 'claude-sonnet-4-6',
      name: 'My First Agent',
      description: 'A general-purpose starter agent.',
      mcp_servers: [
        {
          name: 'example-mcp',
          type: 'url',
          url: 'https://example-server.modelcontextprotocol.io/sse',
        },
      ],
      metadata: { foo: 'bar' },
      skills: [
        {
          skill_id: 'xlsx',
          type: 'anthropic',
          version: '1',
        },
      ],
      system:
        "You are a general-purpose agent that can research, write code, run commands, and use connected tools to complete the user's task end to end.",
      tools: [
        {
          type: 'agent_toolset_20260401',
          configs: [
            {
              name: 'bash',
              enabled: true,
              permission_policy: { type: 'always_allow' },
            },
          ],
          default_config: {
            enabled: true,
            permission_policy: { type: 'always_allow' },
          },
        },
      ],
      betas: ['string'],
    });
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('retrieve', async () => {
    const responsePromise = client.beta.agents.retrieve('agent_011CZkYpogX7uDKUyvBTophP');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('retrieve: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.agents.retrieve(
        'agent_011CZkYpogX7uDKUyvBTophP',
        { version: 0, betas: ['string'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('update: only required params', async () => {
    const responsePromise = client.beta.agents.update('agent_011CZkYpogX7uDKUyvBTophP', { version: 1 });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('update: required and optional params', async () => {
    const response = await client.beta.agents.update('agent_011CZkYpogX7uDKUyvBTophP', {
      version: 1,
      description: 'description',
      mcp_servers: [
        {
          name: 'example-mcp',
          type: 'url',
          url: 'https://example-server.modelcontextprotocol.io/sse',
        },
      ],
      metadata: { foo: 'string' },
      model: 'claude-opus-4-6',
      name: 'name',
      skills: [
        {
          skill_id: 'xlsx',
          type: 'anthropic',
          version: '1',
        },
      ],
      system:
        "You are a general-purpose agent that can research, write code, run commands, and use connected tools to complete the user's task end to end.",
      tools: [
        {
          type: 'agent_toolset_20260401',
          configs: [
            {
              name: 'bash',
              enabled: true,
              permission_policy: { type: 'always_allow' },
            },
          ],
          default_config: {
            enabled: true,
            permission_policy: { type: 'always_allow' },
          },
        },
      ],
      betas: ['string'],
    });
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('list', async () => {
    const responsePromise = client.beta.agents.list();
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('list: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.agents.list(
        {
          'created_at[gte]': '2019-12-27T18:11:19.117Z',
          'created_at[lte]': '2019-12-27T18:11:19.117Z',
          include_archived: true,
          limit: 0,
          page: 'page',
          betas: ['string'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('archive', async () => {
    const responsePromise = client.beta.agents.archive('agent_011CZkYpogX7uDKUyvBTophP');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('archive: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.agents.archive(
        'agent_011CZkYpogX7uDKUyvBTophP',
        { betas: ['string'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });
});
