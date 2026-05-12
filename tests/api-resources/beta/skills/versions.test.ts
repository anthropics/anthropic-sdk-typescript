// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { mockFetch } from '../../../lib/mock-fetch';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource versions', () => {
  test('create', async () => {
    const responsePromise = client.beta.skills.versions.create('skill_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('create: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.beta.skills.versions.create(
        'skill_id',
        {
          files: [await toFile(Buffer.from('Example data'), 'README.md')],
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('create: preserves nested skill filenames in multipart uploads', async () => {
    const { fetch: mock, handleRequest } = mockFetch();
    const fetch: typeof globalThis.fetch = (req, init) => {
      if (typeof req === 'string' && req.startsWith('data:,')) {
        return globalThis.fetch(req, init);
      }

      return mock(req, init);
    };
    const skillsClient = new Anthropic({ apiKey: 'my-anthropic-api-key', fetch, maxRetries: 0 });

    handleRequest(async (_req, init) => {
      expect(init?.body).toBeInstanceOf(FormData);

      const form = init?.body as FormData;
      const file = form.get('files[]');
      expect(file).toBeInstanceOf(File);
      expect((file as File).name).toBe('my-skill/SKILL.md');

      return new Response(JSON.stringify({ id: 'skill_version_123' }), {
        headers: { 'content-type': 'application/json' },
      });
    });

    const response = await skillsClient.beta.skills.versions
      .create('skill_id', {
        files: [await toFile(Buffer.from('Example data'), 'my-skill/SKILL.md')],
      })
      .asResponse();

    expect(response).toBeInstanceOf(Response);
  });

  test('retrieve: only required params', async () => {
    const responsePromise = client.beta.skills.versions.retrieve('version', { skill_id: 'skill_id' });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('retrieve: required and optional params', async () => {
    const response = await client.beta.skills.versions.retrieve('version', {
      skill_id: 'skill_id',
      betas: ['message-batches-2024-09-24'],
    });
  });

  test('list', async () => {
    const responsePromise = client.beta.skills.versions.list('skill_id');
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
      client.beta.skills.versions.list(
        'skill_id',
        {
          limit: 0,
          page: 'page',
          betas: ['message-batches-2024-09-24'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Anthropic.NotFoundError);
  });

  test('delete: only required params', async () => {
    const responsePromise = client.beta.skills.versions.delete('version', { skill_id: 'skill_id' });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('delete: required and optional params', async () => {
    const response = await client.beta.skills.versions.delete('version', {
      skill_id: 'skill_id',
      betas: ['message-batches-2024-09-24'],
    });
  });
});
