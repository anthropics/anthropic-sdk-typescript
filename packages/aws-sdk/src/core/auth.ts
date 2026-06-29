import { Sha256 } from '@aws-crypto/sha256-js';
import { FetchHttpHandler } from '@smithy/fetch-http-handler';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import { AwsCredentialIdentityProvider } from '@smithy/types';
import assert from 'assert';
import { APIConnectionError } from './error';
import { castToError } from '../internal/errors';
import { MergedRequestInit } from '../internal/types';
import { Logger } from '../internal/utils/log';

export type AuthProps = {
  url: string;
  regionName: string;
  serviceName: string;
  awsAccessKey: string | null | undefined;
  awsSecretAccessKey: string | null | undefined;
  awsSessionToken: string | null | undefined;
  awsProfile?: string | null | undefined;
  fetchOptions?: MergedRequestInit | undefined;
  providerChainResolver?: (() => Promise<AwsCredentialIdentityProvider>) | null;
  logger?: Logger | undefined;
};

const defaultProviderChainResolver = (
  profile?: string | null,
  logger?: Logger | undefined,
): Promise<AwsCredentialIdentityProvider> =>
  import('@aws-sdk/credential-providers')
    .then(({ fromNodeProviderChain }) =>
      fromNodeProviderChain({
        ...(profile != null ? { profile } : {}),
        ...(logger != null ? { logger } : {}),
        clientConfig: {
          ...(logger != null ? { logger } : {}),
          requestHandler: new FetchHttpHandler({
            requestInit: (httpRequest) => {
              return {
                ...httpRequest,
              } as RequestInit;
            },
          }),
        },
      }),
    )
    .catch((error) => {
      throw new Error(
        `Failed to import '@aws-sdk/credential-providers'. ` +
          `You can provide a custom \`providerChainResolver\` in the client options if your runtime does not have access to '@aws-sdk/credential-providers': ` +
          `\`new AnthropicAws({ providerChainResolver })\` ` +
          `Original error: ${error.message}`,
      );
    });

export const getAuthHeaders = async (req: RequestInit, props: AuthProps): Promise<Record<string, string>> => {
  assert(req.method, 'Expected request method property to be set');

  let credentials;
  if (props.awsAccessKey && props.awsSecretAccessKey) {
    credentials = {
      accessKeyId: props.awsAccessKey,
      secretAccessKey: props.awsSecretAccessKey,
      ...(props.awsSessionToken != null && { sessionToken: props.awsSessionToken }),
    };
  } else {
    const provider = await (props.providerChainResolver ?
      props.providerChainResolver()
    : defaultProviderChainResolver(props.awsProfile, props.logger));
    try {
      credentials = await provider();
    } catch (err) {
      // Credential resolution is network-bound (IMDS, SSO, STS), so its
      // failures stay on the SDK's connection-error retry policy instead of
      // propagating as non-retryable middleware errors.
      throw new APIConnectionError({
        message: 'Failed to resolve AWS credentials from the credential provider chain.',
        cause: castToError(err),
      });
    }
  }

  const signer = new SignatureV4({
    service: props.serviceName,
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

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const request = new HttpRequest({
    method: req.method.toUpperCase(),
    protocol: url.protocol,
    path: url.pathname,
    query,
    headers,
    body: req.body,
  });

  const signed = await signer.sign(request);
  return signed.headers;
};
