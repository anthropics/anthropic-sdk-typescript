// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic, { toFile } from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource skills', () => {
  test('create: only required params', async () => {
    const responsePromise = client.skills.create({
      files: [await toFile(Buffer.from('Example data'), 'README.md')],
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
    const response = await client.skills.create({
      files: [await toFile(Buffer.from('Example data'), 'README.md')],
      display_name: 'display_name',
      workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy',
    });
  });

  test('retrieve', async () => {
    const responsePromise = client.skills.retrieve('skill_id');
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
      client.skills.retrieve(
        'skill_id',
        { workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('list', async () => {
    const responsePromise = client.skills.list();
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
      client.skills.list(
        {
          limit: 1,
          page: 'page',
          source: 'source',
          workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy',
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('delete', async () => {
    const responsePromise = client.skills.delete('skill_id');
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
      client.skills.delete(
        'skill_id',
        { workspace_id: 'wrkspc_011CZkZaBF1tNoB5wlCeusgy' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });
});
