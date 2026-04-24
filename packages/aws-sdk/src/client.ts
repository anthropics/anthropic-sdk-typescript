import type { NullableHeaders } from './internal/headers';
import { buildHeaders } from './internal/headers';
import * as Errors from './core/error';
import { readEnv } from './internal/utils';
import { Anthropic, ClientOptions } from '@anthropic-ai/sdk/client';
export { BaseAnthropic } from '@anthropic-ai/sdk/client';
import { AwsCredentialIdentityProvider } from '@smithy/types';
import { loadConfig } from '@smithy/node-config-provider';
import { NODE_REGION_CONFIG_OPTIONS, NODE_REGION_CONFIG_FILE_OPTIONS } from '@smithy/config-resolver';
import { getAuthHeaders } from './core/auth';
import { FinalRequestOptions } from './internal/request-options';
import { FinalizedRequestInit } from './internal/types';

const DEFAULT_SERVICE_NAME = 'aws-external-anthropic';

export interface AwsClientOptions extends ClientOptions {
  /**
   * AWS region for the API gateway.
   *
   * Resolved by precedence: `awsRegion` arg > `AWS_REGION` env var >
   * `AWS_DEFAULT_REGION` env var > region from the AWS shared config file
   * (`~/.aws/config`) for the given `awsProfile` (or `[default]`).
   *
   * When resolution falls through to the config file, the region is loaded
   * asynchronously. It will be available after `await client.ready` or the
   * first request; until then `awsRegion` and `baseURL` are `undefined`.
   */
  awsRegion?: string | undefined;

  /**
   * API key for x-api-key authentication.
   *
   * Takes precedence over AWS credential options. If neither `apiKey` nor
   * AWS credentials are provided, falls back to the `ANTHROPIC_AWS_API_KEY`
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
   * AWS named profile for credential and region resolution.
   *
   * When set, credentials are loaded from the AWS credential chain using this
   * profile, and the profile's `region` from `~/.aws/config` is used as a
   * fallback when no region is provided via arg or environment variable.
   */
  awsProfile?: string | undefined;

  /**
   * Custom provider chain resolver for AWS credentials.
   * Useful for non-Node environments, like edge workers, where the default
   * credential provider chain may not work.
   */
  providerChainResolver?: (() => Promise<AwsCredentialIdentityProvider>) | null;

  /**
   * Workspace ID sent on every request as the `anthropic-workspace-id` header.
   *
   * Resolved by precedence: `workspaceId` arg > `ANTHROPIC_AWS_WORKSPACE_ID` env var.
   */
  workspaceId?: string | undefined;

  /**
   * Skip authentication for requests. This is useful when you have a gateway
   * or proxy that handles authentication on your behalf.
   *
   * @default false
   */
  skipAuth?: boolean;
}

const noRegionError = () =>
  new Errors.AnthropicError(
    'No AWS region or base URL found. Set `awsRegion` in the constructor, the `AWS_REGION` / `AWS_DEFAULT_REGION` ' +
      'environment variable, configure a `region` for your profile in `~/.aws/config`, or provide a `baseURL` / ' +
      '`ANTHROPIC_AWS_BASE_URL` environment variable.',
  );

/** API Client for interfacing with the Anthropic AWS API. */
export class AnthropicAws extends Anthropic {
  awsRegion: string | undefined;
  awsAccessKey: string | null;
  awsSecretAccessKey: string | null;
  awsSessionToken: string | null;
  awsProfile: string | null;
  providerChainResolver: (() => Promise<AwsCredentialIdentityProvider>) | null;
  workspaceId: string | undefined;
  skipAuth: boolean = false;

  /**
   * Resolves once the client is fully configured (region and base URL
   * resolved). Rejects if region resolution fails. Await this to fail fast on
   * misconfiguration instead of waiting for the first request.
   */
  readonly ready: Promise<void>;

  private _useSigV4: boolean;

  /**
   * API Client for interfacing with the Anthropic AWS API.
   *
   * Auth is resolved by precedence: `apiKey` constructor arg > explicit AWS
   * credentials > `awsProfile` > `ANTHROPIC_AWS_API_KEY` env var > default
   * AWS credential chain.
   *
   * @param {string | undefined} [opts.apiKey] - API key for x-api-key authentication.
   * @param {string | null | undefined} [opts.awsAccessKey] - AWS access key ID for SigV4 authentication.
   * @param {string | null | undefined} [opts.awsSecretAccessKey] - AWS secret access key for SigV4 authentication.
   * @param {string | null | undefined} [opts.awsSessionToken] - AWS session token for temporary credentials.
   * @param {string | undefined} [opts.awsProfile] - AWS named profile for credential and region resolution.
   * @param {string | undefined} [opts.awsRegion] - AWS region. Resolved by precedence: arg > `AWS_REGION` env > `AWS_DEFAULT_REGION` env > `~/.aws/config`.
   * @param {(() => Promise<AwsCredentialIdentityProvider>) | null} [opts.providerChainResolver] - Custom provider chain resolver for AWS credentials.
   * @param {string | undefined} [opts.workspaceId] - Workspace ID sent as `anthropic-workspace-id` header. Resolved by precedence: arg > `ANTHROPIC_AWS_WORKSPACE_ID` env var.
   * @param {string} [opts.baseURL=process.env['ANTHROPIC_AWS_BASE_URL'] ?? https://aws-external-anthropic.{awsRegion}.api.aws] - Override the default base URL for the API.
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
    workspaceId,
    skipAuth = false,
    ...opts
  }: AwsClientOptions = {}) {
    // Region resolution: arg > AWS_REGION env > AWS_DEFAULT_REGION env > ~/.aws/config (async).
    // The first three are resolved here; config-file fallback is kicked off below and
    // awaited on `ready` / first request.
    const syncRegion = awsRegion ?? readEnv('AWS_REGION') ?? readEnv('AWS_DEFAULT_REGION');

    const explicitBaseURL = baseURL ?? readEnv('ANTHROPIC_AWS_BASE_URL');
    let resolvedBaseURL: string | undefined;
    if (explicitBaseURL) {
      resolvedBaseURL = explicitBaseURL;
    } else if (syncRegion) {
      resolvedBaseURL = `https://aws-external-anthropic.${syncRegion}.api.aws`;
    } else {
      // No region known yet (or skipAuth) — will be resolved async from ~/.aws/config,
      // or is not needed at all.
      resolvedBaseURL = undefined;
    }

    // Precedence-based auth resolution:
    // 1. apiKey constructor arg
    // 2. awsAccessKey/awsSecretAccessKey constructor args (SigV4)
    // 3. awsProfile constructor arg (SigV4)
    // 4. ANTHROPIC_AWS_API_KEY env var
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
      resolvedApiKey = readEnv('ANTHROPIC_AWS_API_KEY') ?? undefined;
    }

    const resolvedWorkspaceId = workspaceId ?? readEnv('ANTHROPIC_AWS_WORKSPACE_ID');
    if (!resolvedWorkspaceId && !skipAuth) {
      throw new Errors.AnthropicError(
        'No workspace ID found. Set `workspaceId` in the constructor or the `ANTHROPIC_AWS_WORKSPACE_ID` environment variable.',
      );
    }

    super({
      apiKey: resolvedApiKey,
      baseURL: resolvedBaseURL,
      ...opts,
      defaultHeaders: buildHeaders([{ 'anthropic-workspace-id': resolvedWorkspaceId }, opts.defaultHeaders]),
    });

    this.awsRegion = syncRegion;
    this.awsAccessKey = awsAccessKey;
    this.awsSecretAccessKey = awsSecretAccessKey;
    this.awsSessionToken = awsSessionToken;
    this.awsProfile = awsProfile ?? null;
    this.providerChainResolver = providerChainResolver;
    this.workspaceId = resolvedWorkspaceId;
    this.skipAuth = skipAuth;
    this._useSigV4 = resolvedApiKey == null;

    if (syncRegion || explicitBaseURL || skipAuth) {
      this.ready = Promise.resolve();
    } else {
      this.ready = this._resolveRegionFromConfig(awsProfile).then((region: string) => {
        this.awsRegion = region;
        this.baseURL = `https://aws-external-anthropic.${region}.api.aws`;
      });
      // Suppress unhandledRejection; the error surfaces via `await ready` or the first request.
      this.ready.catch(() => {});
    }
  }

  private _resolveRegionFromConfig(profile: string | undefined): Promise<string> {
    return loadConfig(
      {
        ...NODE_REGION_CONFIG_OPTIONS,
        default: () => {
          throw noRegionError();
        },
      },
      {
        ...NODE_REGION_CONFIG_FILE_OPTIONS,
        ...(profile && { profile }),
      },
    )();
  }

  protected override async prepareOptions(options: FinalRequestOptions): Promise<void> {
    await super.prepareOptions(options);
    await this.ready;
  }

  protected override async authHeaders(opts: FinalRequestOptions): Promise<NullableHeaders | undefined> {
    if (this.skipAuth) {
      return undefined;
    }

    if (!this._useSigV4) {
      // API key mode — use inherited x-api-key auth
      return super.authHeaders(opts);
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

    if (!this.awsRegion) {
      // Only reachable when an explicit baseURL was provided without a region.
      throw noRegionError();
    }

    const headers = await getAuthHeaders(request, {
      url,
      regionName: this.awsRegion,
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
