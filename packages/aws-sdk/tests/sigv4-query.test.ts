import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import { AnthropicAws } from '../src';

const credentials = {
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
};
const region = 'us-east-1';

// Acts like the AWS gateway: recomputes the SigV4 signature over the request
// exactly as received and rejects it unless the Authorization header matches.
const verifyingFetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
  const url = new URL(input instanceof Request ? input.url : input);
  const received = new Headers(init.headers);
  const authorization = received.get('authorization') ?? '';
  const signedHeaders = /SignedHeaders=([^,]+)/.exec(authorization)?.[1]?.split(';') ?? [];
  const amzDate = received.get('x-amz-date') ?? '';

  const signer = new SignatureV4({ service: 'aws-external-anthropic', region, credentials, sha256: Sha256 });
  const expected = await signer.sign(
    new HttpRequest({
      method: init.method ?? 'GET',
      protocol: url.protocol,
      hostname: url.hostname,
      path: url.pathname,
      query: Object.fromEntries([...url.searchParams.keys()].map((k) => [k, url.searchParams.getAll(k)])),
      headers: {
        ...Object.fromEntries(signedHeaders.map((name) => [name, received.get(name) ?? ''])),
        host: url.host,
      },
      body: init.body,
    }),
    { signingDate: amzDate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z') },
  );

  if (expected.headers['authorization'] !== authorization) {
    return new Response(JSON.stringify({ message: 'signature mismatch' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ data: [], next_page: null }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

const makeClient = (baseURL?: string) =>
  new AnthropicAws({
    baseURL,
    awsRegion: region,
    awsAccessKey: credentials.accessKeyId,
    awsSecretAccessKey: credentials.secretAccessKey,
    workspaceId: 'ws-test',
    maxRetries: 0,
    fetch: verifyingFetch,
  });
const client = makeClient();

describe('SigV4 signing of query parameters', () => {
  test('signs a single-valued query parameter', async () => {
    await expect(client.files.list({ ids: ['file_a'] })).resolves.toBeDefined();
  });

  test('signs every value of a repeated query parameter', async () => {
    await expect(client.files.list({ ids: ['file_a', 'file_b'] })).resolves.toBeDefined();
  });

  test('signs repeated query parameters mixed with others via request options', async () => {
    await expect(
      client.get('/v1/files', { query: { ids: ['file_b', 'file_a'], limit: 2 } }),
    ).resolves.toBeDefined();
  });

  test('signs the host with its port for a base URL on a non-default port', async () => {
    await expect(makeClient('http://localhost:4010').files.list({ ids: ['file_a'] })).resolves.toBeDefined();
  });
});
