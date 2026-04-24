import { HttpRequest } from '@smithy/protocol-http';

const mockSign = jest.fn().mockImplementation((request: HttpRequest) => {
  return Promise.resolve({ headers: request.headers });
});

jest.mock('@smithy/signature-v4', () => ({
  SignatureV4: jest.fn().mockImplementation(() => ({
    sign: mockSign,
  })),
}));

import { getAuthHeaders, AuthProps } from '../src/core/auth';

const baseProps: AuthProps = {
  url: 'https://aws-external-anthropic.us-east-1.api.aws/v1/messages',
  regionName: 'us-east-1',
  serviceName: 'anthropic-api',
  awsAccessKey: 'test-key',
  awsSecretAccessKey: 'test-secret',
  awsSessionToken: null,
};

const baseReq: RequestInit = {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
};

describe('getAuthHeaders', () => {
  beforeEach(() => {
    mockSign.mockClear();
  });

  test('signs request without query parameters', async () => {
    await getAuthHeaders(baseReq, baseProps);

    expect(mockSign).toHaveBeenCalledTimes(1);
    const signed: HttpRequest = mockSign.mock.calls[0]![0];
    expect(signed.method).toBe('POST');
    expect(signed.path).toBe('/v1/messages');
    expect(signed.query).toEqual({});
    expect(signed.headers['host']).toBe('aws-external-anthropic.us-east-1.api.aws');
  });

  test('signs request with query parameters', async () => {
    await getAuthHeaders(baseReq, {
      ...baseProps,
      url: 'https://aws-external-anthropic.us-east-1.api.aws/v1/messages?beta=true',
    });

    expect(mockSign).toHaveBeenCalledTimes(1);
    const signed: HttpRequest = mockSign.mock.calls[0]![0];
    expect(signed.method).toBe('POST');
    expect(signed.path).toBe('/v1/messages');
    expect(signed.query).toEqual({ beta: 'true' });
  });

  test('signs request with multiple query parameters', async () => {
    await getAuthHeaders(baseReq, {
      ...baseProps,
      url: 'https://aws-external-anthropic.us-east-1.api.aws/v1/messages?beta=true&version=2',
    });

    expect(mockSign).toHaveBeenCalledTimes(1);
    const signed: HttpRequest = mockSign.mock.calls[0]![0];
    expect(signed.query).toEqual({ beta: 'true', version: '2' });
  });

  test('excludes connection header from signed request', async () => {
    await getAuthHeaders(
      { ...baseReq, headers: { 'content-type': 'application/json', connection: 'keep-alive' } },
      baseProps,
    );

    const signed: HttpRequest = mockSign.mock.calls[0]![0];
    expect(signed.headers['connection']).toBeUndefined();
  });

  test('includes body in signed request', async () => {
    const body = JSON.stringify({ model: 'claude-sonnet-4-20250514', messages: [] });
    await getAuthHeaders({ ...baseReq, body }, baseProps);

    const signed: HttpRequest = mockSign.mock.calls[0]![0];
    expect(signed.body).toBe(body);
  });
});
