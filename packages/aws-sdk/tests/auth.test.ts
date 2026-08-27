import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import fs from 'fs';
import os from 'os';
import path from 'path';

const mockSign = jest.fn().mockImplementation((request: HttpRequest) => {
  return Promise.resolve({ headers: request.headers });
});

jest.mock('@smithy/signature-v4', () => ({
  SignatureV4: jest.fn().mockImplementation(() => ({
    sign: mockSign,
  })),
}));

jest.mock('@aws-sdk/credential-providers', () => {
  const actual = jest.requireActual('@aws-sdk/credential-providers');
  return { ...actual, fromNodeProviderChain: jest.fn(actual.fromNodeProviderChain) };
});

import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
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
    expect(signed.query).toEqual({ beta: ['true'] });
  });

  test('signs request with multiple query parameters', async () => {
    await getAuthHeaders(baseReq, {
      ...baseProps,
      url: 'https://aws-external-anthropic.us-east-1.api.aws/v1/messages?beta=true&version=2',
    });

    expect(mockSign).toHaveBeenCalledTimes(1);
    const signed: HttpRequest = mockSign.mock.calls[0]![0];
    expect(signed.query).toEqual({ beta: ['true'], version: ['2'] });
  });

  test('signs repeated query parameters as multi-value parameters', async () => {
    await getAuthHeaders(baseReq, {
      ...baseProps,
      url: 'https://aws-external-anthropic.us-east-1.api.aws/v1/files?ids[]=file_a&ids[]=file_b&limit=2',
    });

    const signed: HttpRequest = mockSign.mock.calls[0]![0];
    expect(signed.query).toEqual({ 'ids[]': ['file_a', 'file_b'], limit: ['2'] });
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
    const body = JSON.stringify({ model: 'claude-opus-4-8', messages: [] });
    await getAuthHeaders({ ...baseReq, body }, baseProps);

    const signed: HttpRequest = mockSign.mock.calls[0]![0];
    expect(signed.body).toBe(body);
  });
});

describe('default credential chain precedence', () => {
  const originalEnv = process.env;
  let awsDir: string;

  beforeEach(() => {
    jest.mocked(SignatureV4).mockClear();
    jest.mocked(fromNodeProviderChain).mockClear();
    awsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-sdk-auth-'));
    fs.writeFileSync(
      path.join(awsDir, 'credentials'),
      '[someprofile]\naws_access_key_id = AKIDPROFILE\naws_secret_access_key = profile-secret\n',
    );
    fs.writeFileSync(path.join(awsDir, 'config'), '[profile someprofile]\nregion = us-east-1\n');
    process.env = {
      ...originalEnv,
      AWS_SHARED_CREDENTIALS_FILE: path.join(awsDir, 'credentials'),
      AWS_CONFIG_FILE: path.join(awsDir, 'config'),
      AWS_PROFILE: 'someprofile',
      AWS_ACCESS_KEY_ID: 'AKIDENV',
      AWS_SECRET_ACCESS_KEY: 'env-secret',
      AWS_SESSION_TOKEN: 'env-token',
      AWS_EC2_METADATA_DISABLED: 'true',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(awsDir, { recursive: true, force: true });
  });

  const signingCredentials = () => jest.mocked(SignatureV4).mock.calls[0]![0].credentials;

  test('env credentials take precedence over AWS_PROFILE', async () => {
    await getAuthHeaders(baseReq, { ...baseProps, awsAccessKey: null, awsSecretAccessKey: null });

    expect(signingCredentials()).toMatchObject({
      accessKeyId: 'AKIDENV',
      secretAccessKey: 'env-secret',
      sessionToken: 'env-token',
    });
  });

  test('explicit awsProfile takes precedence over env credentials', async () => {
    // The real profile providers are loaded with `import()`, which jest cannot run here.
    jest
      .mocked(fromNodeProviderChain)
      .mockReturnValueOnce(async () => ({ accessKeyId: 'AKIDPROFILE', secretAccessKey: 'profile-secret' }));

    await getAuthHeaders(baseReq, {
      ...baseProps,
      awsAccessKey: null,
      awsSecretAccessKey: null,
      awsProfile: 'someprofile',
    });

    expect(fromNodeProviderChain).toHaveBeenCalledWith(expect.objectContaining({ profile: 'someprofile' }));
    expect(signingCredentials()).toMatchObject({
      accessKeyId: 'AKIDPROFILE',
      secretAccessKey: 'profile-secret',
    });
  });
});
