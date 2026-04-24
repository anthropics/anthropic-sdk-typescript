// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: 'my-anthropic-api-key', baseURL: process.env["TEST_API_BASE_URL"] ?? 'http://127.0.0.1:4010' });

describe('resource userProfiles', () => {
  test('create', async () => {
    const responsePromise = client.beta.userProfiles.create({});
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('retrieve', async () => {
    const responsePromise = client.beta.userProfiles.retrieve('uprof_011CZkZCu8hGbp5mYRQgUmz9');
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
    await expect(client.beta.userProfiles.retrieve('uprof_011CZkZCu8hGbp5mYRQgUmz9', { betas: ['message-batches-2024-09-24'] }, { path: '/_stainless_unknown_path' }))
      .rejects
      .toThrow(Anthropic.NotFoundError);
  });

  test('update', async () => {
    const responsePromise = client.beta.userProfiles.update('uprof_011CZkZCu8hGbp5mYRQgUmz9', {});
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('list', async () => {
    const responsePromise = client.beta.userProfiles.list();
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
    await expect(client.beta.userProfiles.list({
    limit: 0,
    order: 'asc',
    page: 'page',
    betas: ['message-batches-2024-09-24'],
  }, { path: '/_stainless_unknown_path' }))
      .rejects
      .toThrow(Anthropic.NotFoundError);
  });

  test('createEnrollmentURL', async () => {
    const responsePromise = client.beta.userProfiles.createEnrollmentURL('uprof_011CZkZCu8hGbp5mYRQgUmz9');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('createEnrollmentURL: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(client.beta.userProfiles.createEnrollmentURL('uprof_011CZkZCu8hGbp5mYRQgUmz9', { betas: ['message-batches-2024-09-24'] }, { path: '/_stainless_unknown_path' }))
      .rejects
      .toThrow(Anthropic.NotFoundError);
  });
});
