import { APIRequest, BaseAnthropic, ClientOptions as CoreClientOptions } from '@anthropic-ai/sdk/client';
import * as Resources from '@anthropic-ai/sdk/resources/index';
import { AwsCredentialIdentityProvider } from '@smithy/types';
import { getAuthHeaders } from './core/auth';
import { eventStreamToSSEResponse } from './core/streaming';
import type { Middleware } from './core/middleware';
import { readEnv } from './internal/utils/env';
import { FinalRequestOptions } from './internal/request-options';
import { isObj, safeJSON } from './internal/utils/values';
import type { NullableHeaders } from './internal/headers';
import { buildHeaders } from './internal/headers';
import { path } from './internal/utils/path';
import { loggerFor } from './internal/utils/log';

export { BaseAnthropic } from '@anthropic-ai/sdk/client';

const DEFAULT_VERSION = 'bedrock-2023-05-31';
const MODEL_ENDPOINTS = new Set<string>(['/v1/complete', '/v1/messages', '/v1/messages?beta=true']);

export type ClientOptions = Omit<CoreClientOptions, 'apiKey' | 'authToken'> & {
  /**
   * Defaults to process.env['AWS_BEARER_TOKEN_BEDROCK'].
   */
  apiKey?: string | undefined;

  awsSecretKey?: string | null | undefined;
  awsAccessKey?: string | null | undefined;

  /**
   * Defaults to process.env['AWS_REGION'].
   */
  awsRegion?: string | undefined;
  awsSessionToken?: string | null | undefined;
  skipAuth?: boolean;

  /** Custom provider chain resolver for AWS credentials. Useful for non-Node environments, like edge workers, where the default credential provider chain may not work. */
  providerChainResolver?: (() => Promise<AwsCredentialIdentityProvider>) | null;
};

type BothStaticCreds = {
  awsAccessKey: string;
  awsSecretKey: string;
  awsSessionToken?: string | null | undefined;
};

type NoStaticCreds = {
  awsAccessKey?: null | undefined;
  awsSecretKey?: null | undefined;
  awsSessionToken?: null | undefined;
};

type AccessOnly = {
  awsAccessKey: string;
  awsSecretKey?: null | undefined;
  awsSessionToken?: string | null | undefined;
};

type SecretOnly = {
  awsSecretKey: string;
  awsAccessKey?: null | undefined;
  awsSessionToken?: string | null | undefined;
};

/** API Client for interfacing with the Anthropic Bedrock API. */
export class AnthropicBedrock extends BaseAnthropic {
  awsSecretKey: string | null;
  awsAccessKey: string | null;
  awsRegion: string;
  awsSessionToken: string | null;
  skipAuth: boolean = false;
  providerChainResolver: (() => Promise<AwsCredentialIdentityProvider>) | null;

  constructor(opts: ClientOptions & BothStaticCreds);
  constructor(opts?: ClientOptions & NoStaticCreds);

  /**
   * @deprecated Passing only `awsAccessKey` without `awsSecretKey` is deprecated.
   * Provide both keys, or provide neither and rely on the AWS credential provider chain.
   */
  constructor(opts: ClientOptions & AccessOnly);

  /**
   * @deprecated Passing only `awsSecretKey` without `awsAccessKey` is deprecated.
   * Provide both keys, or provide neither and rely on the AWS credential provider chain.
   */
  constructor(opts: ClientOptions & SecretOnly);

  /**
   * API Client for interfacing with the Anthropic Bedrock API.
   *
   * @param {string | null | undefined} [opts.awsSecretKey]
   * @param {string | null | undefined} [opts.awsAccessKey]
   * @param {string | undefined} [opts.awsRegion=process.env['AWS_REGION'] ?? us-east-1]
   * @param {string | null | undefined} [opts.awsSessionToken]
   * @param {(() => Promise<AwsCredentialIdentityProvider>) | null} [opts.providerChainResolver] - Custom provider chain resolver for AWS credentials. Useful for non-Node environments.
   * @param {string} [opts.baseURL=process.env['ANTHROPIC_BEDROCK_BASE_URL'] ?? https://bedrock-runtime.${this.awsRegion}.amazonaws.com] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   * @param {boolean} [opts.skipAuth=false] - Skip authentication for this request. This is useful if you have an internal proxy that handles authentication for you.
   */
  constructor({
    awsRegion = readEnv('AWS_REGION') ?? 'us-east-1',
    baseURL = readEnv('ANTHROPIC_BEDROCK_BASE_URL') ?? `https://bedrock-runtime.${awsRegion}.amazonaws.com`,
    apiKey = readEnv('AWS_BEARER_TOKEN_BEDROCK'),
    awsSecretKey = null,
    awsAccessKey = null,
    awsSessionToken = null,
    providerChainResolver = null,
    ...opts
  }: ClientOptions = {}) {
    super({ baseURL, authToken: apiKey, ...opts });

    const hasAccess = awsAccessKey != null;
    const hasSecret = awsSecretKey != null;
    if (hasAccess !== hasSecret) {
      loggerFor(this).warn(
        'Warning: Passing only one of `awsAccessKey` or `awsSecretKey` is deprecated. ' +
          'Please provide both keys, or provide neither and rely on the AWS credential provider chain.',
      );
    }

    this.awsSecretKey = awsSecretKey;
    this.awsAccessKey = awsAccessKey;
    this.awsRegion = awsRegion;
    this.awsSessionToken = awsSessionToken;
    this.skipAuth = opts.skipAuth ?? false;
    this.providerChainResolver = providerChainResolver;
  }

  messages: MessagesResource = makeMessagesResource(this);
  completions: Resources.Completions = new Resources.Completions(this);
  beta: BetaResource = makeBetaResource(this);

  protected override validateHeaders() {
    // auth validation is handled in the backend middleware since it needs to be async
  }

  protected override async authHeaders(opts: FinalRequestOptions): Promise<NullableHeaders | undefined> {
    // The bearer token (AWS_BEARER_TOKEN_BEDROCK) is the client's logical
    // credential, applied outside user middleware so middleware can observe
    // it; SigV4 is a backend credential transformation and happens inside,
    // in the backend middleware.
    return this.skipAuth ? undefined : super.authHeaders(opts);
  }

  protected override backendMiddleware(): ReadonlyArray<Middleware> {
    return [
      async (request, next, ctx) => {
        const response = await next(await this.#adaptRequest(request, ctx.options));
        return this.#adaptResponse(response);
      },
    ];
  }

  /**
   * Rewrites the canonical Anthropic-shaped request into Bedrock's wire shape
   * and SigV4-signs it. Runs inside the user middleware chain, so the
   * signature always covers the final, middleware-mutated request.
   */
  async #adaptRequest(request: APIRequest, options: FinalRequestOptions | undefined): Promise<APIRequest> {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);

    let parsedBody: Record<string, unknown> | undefined;
    if (typeof request.body === 'string') {
      const parsed = safeJSON(request.body);
      if (isObj(parsed)) parsedBody = parsed;
    }

    if (parsedBody) {
      if (!parsedBody['anthropic_version']) {
        parsedBody['anthropic_version'] = DEFAULT_VERSION;
      }

      const betas = headers.get('anthropic-beta');
      if (betas != null && !parsedBody['anthropic_beta']) {
        // `Headers.get` joins multiple values with ', '
        parsedBody['anthropic_beta'] = betas.split(',').map((beta) => beta.trim());
      }
    }

    if (options && MODEL_ENDPOINTS.has(options.path) && options.method === 'post') {
      // Rewrite by canonical-suffix replacement so base URLs with path
      // prefixes keep working. If middleware rewrote the path away from the
      // canonical shape, it took control of the wire shape: skip the rewrite
      // but still sign below.
      const canonicalPath = options.path.split('?')[0]!;
      if (url.pathname.endsWith(canonicalPath)) {
        if (!parsedBody) {
          throw new Error(`Expected request body to be a JSON object for post ${canonicalPath}`);
        }

        const model = parsedBody['model'] as string;
        delete parsedBody['model'];

        const stream = parsedBody['stream'];
        delete parsedBody['stream'];

        const prefix = url.pathname.slice(0, url.pathname.length - canonicalPath.length);
        url.pathname =
          prefix +
          (stream ? path`/model/${model}/invoke-with-response-stream` : path`/model/${model}/invoke`);
        // The canonical `?beta=true` marker has no meaning on Bedrock.
        url.searchParams.delete('beta');
      }
    }

    const adapted = { ...request, url: url.toString(), headers } as APIRequest;
    if (parsedBody) {
      adapted.body = JSON.stringify(parsedBody);
    }

    if (!this.skipAuth && !this.authToken) {
      const regionName = this.awsRegion;
      if (!regionName) {
        throw new Error(
          'Expected `awsRegion` option to be passed to the client or the `AWS_REGION` environment variable to be present',
        );
      }

      const authHeaders = await getAuthHeaders(adapted, {
        url: adapted.url,
        regionName,
        awsAccessKey: this.awsAccessKey,
        awsSecretKey: this.awsSecretKey,
        awsSessionToken: this.awsSessionToken,
        fetchOptions: this.fetchOptions,
        providerChainResolver: this.providerChainResolver,
      });
      // Signed headers take precedence: the signature must match what goes
      // over the wire, so it can't be overridden by other header sources.
      adapted.headers = buildHeaders([adapted.headers, authHeaders]).values;
    }

    return adapted;
  }

  /**
   * Normalizes Bedrock's binary AWS EventStream framing back to the SSE
   * format the Anthropic API uses, so user middleware (and the client's own
   * parsing) observe canonical streaming responses.
   */
  #adaptResponse(response: Response): Response {
    // Match the wire content type positively so that anything else — plain
    // JSON, error bodies, or already-SSE responses from a gateway — passes
    // through untouched.
    if (
      response.body &&
      response.headers.get('content-type')?.includes('application/vnd.amazon.eventstream')
    ) {
      return eventStreamToSSEResponse(response);
    }
    return response;
  }
}

/**
 * The Bedrock API does not currently support token counting or the Batch API.
 */
type MessagesResource = Omit<Resources.Messages, 'batches' | 'countTokens'>;

function makeMessagesResource(client: AnthropicBedrock): MessagesResource {
  const resource = new Resources.Messages(client);

  // @ts-expect-error we're deleting non-optional properties
  delete resource.batches;

  // @ts-expect-error we're deleting non-optional properties
  delete resource.countTokens;

  return resource;
}

/**
 * The Bedrock API does not currently support prompt caching, token counting or the Batch API.
 */
type BetaResource = Omit<Resources.Beta, 'promptCaching' | 'messages'> & {
  messages: Omit<Resources.Beta['messages'], 'batches' | 'countTokens'>;
};

function makeBetaResource(client: AnthropicBedrock): BetaResource {
  const resource = new Resources.Beta(client);

  // @ts-expect-error we're deleting non-optional properties
  delete resource.promptCaching;

  // @ts-expect-error we're deleting non-optional properties
  delete resource.messages.batches;

  // @ts-expect-error we're deleting non-optional properties
  delete resource.messages.countTokens;

  return resource;
}
