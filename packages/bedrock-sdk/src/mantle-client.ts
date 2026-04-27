import type { NullableHeaders } from './internal/headers';
import { buildHeaders } from './internal/headers';
import * as Errors from './core/error';
import { readEnv } from './internal/utils/env';
import { BaseAnthropic, ClientOptions } from '@anthropic-ai/sdk/client';
import * as Resources from '@anthropic-ai/sdk/resources/index';
import { AwsCredentialIdentityProvider } from '@smithy/types';
import { getAuthHeaders } from './core/aws-auth';
import { FinalRequestOptions } from './internal/request-options';
import { FinalizedRequestInit } from './internal/types';

const DEFAULT_SERVICE_NAME = 'bedrock-mantle';

export interface BedrockMantleClientOptions extends ClientOptions {
  /**
   * AWS region for the Bedrock Mantle API.
   *
   * Resolved by precedence: `awsRegion` arg > `AWS_REGION` env var > `AWS_DEFAULT_REGION` env var.
   */
  awsRegion?: string | undefined;

  /**
   * API key for Bearer token authentication.
   *
   * Takes precedence over AWS credential options. If neither `apiKey` nor
   * AWS credentials are provided, falls back to the `AWS_BEARER_TOKEN_BEDROCK`
   * environment variable, then to the default AWS credential chain.
   */
  apiKey?: string | undefined;

  /**
   * AWS access key ID for SigV4 authentication.
   *
   * Must be provided together with `awsSecretAccessKey`.
   */
  awsAccessKey?: string | null | undefined;

  /**
   * AWS secret access key for SigV4 authentication.
   *
   * Must be provided together with `awsAccessKey`.
   */
  awsSecretAccessKey?: string | null | undefined;

  /**
   * AWS session token for temporary credentials.
   */
  awsSessionToken?: string | null | undefined;

  /**
   * AWS named profile for credential resolution.
   *
   * When set, credentials are loaded from the AWS credential chain
   * using this profile.
   */
  awsProfile?: string | undefined;

  /**
   * Custom provider chain resolver for AWS credentials.
   * Useful for non-Node environments, like edge workers, where the default
   * credential provider chain may not work.
   */
  providerChainResolver?: (() => Promise<AwsCredentialIdentityProvider>) | null;

  /**
   * Skip authentication for requests. This is useful when you have a gateway
   * or proxy that handles authentication on your behalf.
   *
   * @default false
   */
  skipAuth?: boolean;
}

/**
 * API Client for interfacing with the Anthropic Bedrock Mantle API.
 *
 * This client uses SigV4 authentication with the `bedrock-mantle` service name
 * and targets `https://bedrock-mantle.{region}.api.aws/anthropic`.
 *
 * Only the `messages` and `beta.messages` resources are supported.
 */
export class AnthropicBedrockMantle extends BaseAnthropic {
  messages: Resources.Messages = new Resources.Messages(this);
  beta: MantleBetaResource = makeMantleBetaResource(this);

  awsRegion: string | undefined;
  awsAccessKey: string | null;
  awsSecretAccessKey: string | null;
  awsSessionToken: string | null;
  awsProfile: string | null;
  providerChainResolver: (() => Promise<AwsCredentialIdentityProvider>) | null;
  skipAuth: boolean = false;

  private _useSigV4: boolean;

  /**
   * API Client for interfacing with the Anthropic Bedrock Mantle API.
   *
   * Auth is resolved by precedence: `apiKey` constructor arg > explicit AWS
   * credentials > `awsProfile` > `AWS_BEARER_TOKEN_BEDROCK` env var > default
   * AWS credential chain.
   *
   * @param {string | undefined} [opts.apiKey] - API key for Bearer token authentication.
   * @param {string | null | undefined} [opts.awsAccessKey] - AWS access key ID for SigV4 authentication.
   * @param {string | null | undefined} [opts.awsSecretAccessKey] - AWS secret access key for SigV4 authentication.
   * @param {string | null | undefined} [opts.awsSessionToken] - AWS session token for temporary credentials.
   * @param {string | undefined} [opts.awsProfile] - AWS named profile for credential resolution.
   * @param {string | undefined} [opts.awsRegion] - AWS region. Resolved by precedence: arg > `AWS_REGION` env > `AWS_DEFAULT_REGION` env.
   * @param {(() => Promise<AwsCredentialIdentityProvider>) | null} [opts.providerChainResolver] - Custom provider chain resolver for AWS credentials.
   * @param {string} [opts.baseURL=process.env['ANTHROPIC_BEDROCK_MANTLE_BASE_URL'] ?? https://bedrock-mantle.{awsRegion}.api.aws/anthropic] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   * @param {boolean} [opts.skipAuth=false] - Skip authentication for requests. This is useful when you have a gateway or proxy that handles authentication on your behalf.
   */
  constructor({
    awsRegion,
    baseURL,
    apiKey,
    awsAccessKey = null,
    awsSecretAccessKey = null,
    awsSessionToken = null,
    awsProfile,
    providerChainResolver = null,
    skipAuth = false,
    ...opts
  }: BedrockMantleClientOptions = {}) {
    // Region resolution: arg > AWS_REGION env > AWS_DEFAULT_REGION env
    const resolvedRegion = awsRegion ?? readEnv('AWS_REGION') ?? readEnv('AWS_DEFAULT_REGION');

    const resolvedBaseURL =
      baseURL ??
      readEnv('ANTHROPIC_BEDROCK_MANTLE_BASE_URL') ??
      (resolvedRegion ? `https://bedrock-mantle.${resolvedRegion}.api.aws/anthropic` : undefined);

    if (!resolvedBaseURL) {
      throw new Errors.AnthropicError(
        'No AWS region or base URL found. Set `awsRegion` in the constructor, the `AWS_REGION` / `AWS_DEFAULT_REGION` environment variable, or provide a `baseURL` / `ANTHROPIC_BEDROCK_MANTLE_BASE_URL` environment variable.',
      );
    }

    // Precedence-based auth resolution:
    // 1. apiKey constructor arg
    // 2. awsAccessKey/awsSecretAccessKey constructor args (SigV4)
    // 3. awsProfile constructor arg (SigV4)
    // 4. AWS_BEARER_TOKEN_BEDROCK env var
    // 5. Default AWS credential chain (SigV4)
    const hasExplicitApiKey = apiKey != null;
    const hasPartialAwsCreds = (awsAccessKey != null) !== (awsSecretAccessKey != null);
    if (hasPartialAwsCreds) {
      throw new Errors.AnthropicError(
        '`awsAccessKey` and `awsSecretAccessKey` must be provided together. You provided only one.',
      );
    }
    const hasExplicitAwsCreds = awsAccessKey != null && awsSecretAccessKey != null;
    const hasAwsProfile = awsProfile != null;

    let resolvedApiKey: string | undefined;
    if (hasExplicitApiKey) {
      resolvedApiKey = apiKey;
    } else if (!hasExplicitAwsCreds && !hasAwsProfile) {
      resolvedApiKey = readEnv('AWS_BEARER_TOKEN_BEDROCK') ?? undefined;
    }

    super({
      apiKey: resolvedApiKey,
      baseURL: resolvedBaseURL,
      ...opts,
    });

    this.awsRegion = resolvedRegion;
    this.awsAccessKey = awsAccessKey;
    this.awsSecretAccessKey = awsSecretAccessKey;
    this.awsSessionToken = awsSessionToken;
    this.awsProfile = awsProfile ?? null;
    this.providerChainResolver = providerChainResolver;
    this.skipAuth = skipAuth;
    this._useSigV4 = resolvedApiKey == null;
  }

  protected override async authHeaders(opts: FinalRequestOptions): Promise<NullableHeaders | undefined> {
    if (this.skipAuth) {
      return undefined;
    }

    if (!this._useSigV4) {
      // API key / bearer token mode — use Authorization: Bearer header
      return buildHeaders([{ Authorization: `Bearer ${this.apiKey}` }]);
    }

    // SigV4 mode — auth is handled in prepareRequest since it needs the full request
    return undefined;
  }

  protected override validateHeaders(): void {
    // Auth validation is handled in the constructor and prepareRequest
  }

  protected override async prepareRequest(
    request: FinalizedRequestInit,
    { url, options }: { url: string; options: FinalRequestOptions },
  ): Promise<void> {
    if (this.skipAuth || !this._useSigV4) {
      return;
    }

    const regionName = this.awsRegion;
    if (!regionName) {
      throw new Errors.AnthropicError(
        'No AWS region found. Set `awsRegion` in the constructor or the `AWS_REGION` / `AWS_DEFAULT_REGION` environment variable.',
      );
    }

    const headers = await getAuthHeaders(request, {
      url,
      regionName,
      serviceName: DEFAULT_SERVICE_NAME,
      awsAccessKey: this.awsAccessKey,
      awsSecretAccessKey: this.awsSecretAccessKey,
      awsSessionToken: this.awsSessionToken,
      awsProfile: this.awsProfile,
      providerChainResolver: this.providerChainResolver,
    });
    request.headers = buildHeaders([headers, request.headers]).values;
  }
}

/**
 * Bedrock Mantle does not support completions, models, or non-messages beta resources.
 */
type MantleBetaResource = Pick<Resources.Beta, 'messages'>;

function makeMantleBetaResource(client: AnthropicBedrockMantle): MantleBetaResource {
  const { messages } = new Resources.Beta(client);
  return { messages };
}
