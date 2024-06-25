import assert from 'assert';
import { SignatureV4 } from '@smithy/signature-v4';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { HttpRequest } from '@smithy/protocol-http';
import { Sha256 } from '@aws-crypto/sha256-js';
import type { RequestInit } from '@anthropic-ai/sdk/_shims/index';

type AuthProps = {
  url: string;
  regionName: string;
  awsAccessKey: string | null | undefined;
  awsSecretKey: string | null | undefined;
  awsSessionToken: string | null | undefined;
};

export const getAuthHeaders = async (req: RequestInit, props: AuthProps): Promise<Record<string, string>> => {
  assert(req.method, 'Expected request method property to be set');

  const providerChain = fromNodeProviderChain();

  const credentials = await withTempEnv(
    () => {
      // Temporarily set the appropriate environment variables if we've been
      // explicitly given credentials so that the credentials provider can
      // resolve them.
      //
      // Note: the environment provider is only not run first if the `AWS_PROFILE`
      // environment variable is set.
      // https://github.com/aws/aws-sdk-js-v3/blob/44a18a34b2c93feccdfcd162928d13e6dbdcaf30/packages/credential-provider-node/src/defaultProvider.ts#L49
      if (props.awsAccessKey) {
        process.env['AWS_ACCESS_KEY_ID'] = props.awsAccessKey;
      }
      if (props.awsSecretKey) {
        process.env['AWS_SECRET_ACCESS_KEY'] = props.awsSecretKey;
      }
      if (props.awsSessionToken) {
        process.env['AWS_SESSION_TOKEN'] = props.awsSessionToken;
      }
    },
    () => providerChain(),
  );

  const signer = new SignatureV4({
    service: 'bedrock',
    region: props.regionName,
    credentials,
    sha256: Sha256,
  });

  const url = new URL(props.url);

  const headers =
    !req.headers ? {}
    : Symbol.iterator in req.headers ?
      Object.fromEntries(Array.from(req.headers).map((header) => [...header]))
    : { ...req.headers };

  // The connection header may be stripped by a proxy somewhere, so the receiver
  // of this message may not see this header, so we remove it from the set of headers
  // that are signed.
  delete headers['connection'];
  headers['host'] = url.hostname;

  const request = new HttpRequest({
    method: req.method.toUpperCase(),
    protocol: url.protocol,
    path: url.pathname,
    headers,
    body: req.body,
  });

  const signed = await signer.sign(request);
  return signed.headers;
};

const withTempEnv = async <R>(updateEnv: () => void, fn: () => Promise<R>): Promise<R> => {
  const previousEnv = { ...process.env };

  try {
    updateEnv();
    return await fn();
  } finally {
    process.env = previousEnv;
  }
};
