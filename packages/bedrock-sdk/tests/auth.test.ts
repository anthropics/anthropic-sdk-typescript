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

import { getAuthHeaders } from '../src/core/auth';

const baseReq: RequestInit = {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
};

describe('default credential chain precedence', () => {
  const originalEnv = process.env;
  let awsDir: string;

  beforeEach(() => {
    jest.mocked(SignatureV4).mockClear();
    awsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bedrock-sdk-auth-'));
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

  test('env credentials take precedence over AWS_PROFILE', async () => {
    await getAuthHeaders(baseReq, {
      url: 'https://bedrock-runtime.us-east-1.amazonaws.com/model/some-model/invoke',
      regionName: 'us-east-1',
      awsAccessKey: null,
      awsSecretKey: null,
      awsSessionToken: null,
    });

    expect(jest.mocked(SignatureV4).mock.calls[0]![0].credentials).toMatchObject({
      accessKeyId: 'AKIDENV',
      secretAccessKey: 'env-secret',
      sessionToken: 'env-token',
    });
  });
});
