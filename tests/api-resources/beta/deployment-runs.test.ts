// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource deploymentRuns', () => {
  // buildURL drops path-level query params (SDK-4349)
  test.skip('retrieve', async () => {
    const responsePromise = client.beta.deploymentRuns.retrieve('deployment_run_id');
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
      client.beta.deploymentRuns.retrieve(
        'deployment_run_id',
        { betas: ['message-batches-2024-09-24'] },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  // buildURL drops path-level query params (SDK-4349)
  test.skip('list', async () => {
    const responsePromise = client.beta.deploymentRuns.list();
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
      client.beta.deploymentRuns.list(
        {
          'created_at[gt]': '2019-12-27T18:11:19.117Z',
          'created_at[gte]': '2019-12-27T18:11:19.117Z',
          'created_at[lt]': '2019-12-27T18:11:19.117Z',
          'created_at[lte]': '2019-12-27T18:11:19.117Z',
          deployment_id: 'deployment_id',
          has_error: true,
          limit: 0,
          page: 'page',
          trigger_type: 'schedule',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });
});
