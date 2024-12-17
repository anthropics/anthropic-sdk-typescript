import * as Core from '@anthropic-ai/sdk/core';
import * as Resources from '@anthropic-ai/sdk/resources/index';
import * as API from '@anthropic-ai/sdk/index';
import { getAuthHeaders } from './auth';
import { Stream } from './streaming';

const DEFAULT_VERSION = 'bedrock-2023-05-31';
const MODEL_ENDPOINTS = new Set<string>(['/v1/complete', '/v1/messages', '/v1/messages?beta=true']);

export type ClientOptions = Omit<API.ClientOptions, 'apiKey' | 'authToken'> & {
  awsSecretKey?: string | null | undefined;
  awsAccessKey?: string | null | undefined;

  /**
   * Defaults to process.env['AWS_REGION'].
   */
  awsRegion?: string | undefined;
  awsSessionToken?: string | null | undefined;
};

/** API Client for interfacing with the Anthropic Bedrock API. */
export class AnthropicBedrock extends Core.APIClient {
  awsSecretKey: string | null;
  awsAccessKey: string | null;
  awsRegion: string;
  awsSessionToken: string | null;

  private _options: ClientOptions;

  /**
   * API Client for interfacing with the Anthropic Bedrock API.
   *
   * @param {string | null | undefined} [opts.awsSecretKey]
   * @param {string | null | undefined} [opts.awsAccessKey]
   * @param {string | undefined} [opts.awsRegion=process.env['AWS_REGION'] ?? us-east-1]
   * @param {string | null | undefined} [opts.awsSessionToken]
   * @param {string} [opts.baseURL=process.env['ANTHROPIC_BEDROCK_BASE_URL'] ?? https://bedrock-runtime.${this.awsRegion}.amazonaws.com] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
   * @param {Core.Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Core.DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
   */
  constructor({
    baseURL = Core.readEnv('ANTHROPIC_BEDROCK_BASE_URL'),
    awsSecretKey = null,
    awsAccessKey = null,
    awsRegion = Core.readEnv('AWS_REGION') ?? 'us-east-1',
    awsSessionToken = null,
    ...opts
  }: ClientOptions = {}) {
    const options: ClientOptions = {
      awsSecretKey,
      awsAccessKey,
      awsRegion,
      awsSessionToken,
      ...opts,
      baseURL: baseURL || `https://bedrock-runtime.${awsRegion}.amazonaws.com`,
    };

    super({
      baseURL: options.baseURL!,
      timeout: options.timeout ?? 600000 /* 10 minutes */,
      httpAgent: options.httpAgent,
      maxRetries: options.maxRetries,
      fetch: options.fetch,
    });
    this._options = options;

    this.awsSecretKey = awsSecretKey;
    this.awsAccessKey = awsAccessKey;
    this.awsRegion = awsRegion;
    this.awsSessionToken = awsSessionToken;
  }

  messages: MessagesResource = makeMessagesResource(this);
  completions: Resources.Completions = new Resources.Completions(this);
  beta: BetaResource = makeBetaResource(this);

  protected override defaultQuery(): Core.DefaultQuery | undefined {
    return this._options.defaultQuery;
  }

  protected override defaultHeaders(opts: Core.FinalRequestOptions): Core.Headers {
    return {
      ...super.defaultHeaders(opts),
      ...this._options.defaultHeaders,
    };
  }

  protected override async prepareRequest(
    request: RequestInit,
    { url, options }: { url: string; options: Core.FinalRequestOptions },
  ): Promise<void> {
    const regionName = this.awsRegion;
    if (!regionName) {
      throw new Error(
        'Expected `awsRegion` option to be passed to the client or the `AWS_REGION` environment variable to be present',
      );
    }

    const headers = await getAuthHeaders(request, {
      url,
      regionName,
      awsAccessKey: this.awsAccessKey,
      awsSecretKey: this.awsSecretKey,
      awsSessionToken: this.awsSessionToken,
    });
    request.headers = { ...request.headers, ...headers };
  }

  override buildRequest(options: Core.FinalRequestOptions<unknown>): {
    req: RequestInit;
    url: string;
    timeout: number;
  } {
    options.__streamClass = Stream;

    if (Core.isObj(options.body)) {
      // create a shallow copy of the request body so that code that mutates it later
      // doesn't mutate the original user-provided object
      options.body = { ...options.body };
    }

    if (Core.isObj(options.body)) {
      if (!options.body['anthropic_version']) {
        options.body['anthropic_version'] = DEFAULT_VERSION;
      }

      if (options.headers && !options.body['anthropic_beta']) {
        const betas = Core.getHeader(options.headers, 'anthropic-beta');
        if (betas != null) {
          options.body['anthropic_beta'] = betas.split(',');
        }
      }
    }

    if (MODEL_ENDPOINTS.has(options.path) && options.method === 'post') {
      if (!Core.isObj(options.body)) {
        throw new Error('Expected request body to be an object for post /v1/messages');
      }

      const model = options.body['model'];
      options.body['model'] = undefined;

      const stream = options.body['stream'];
      options.body['stream'] = undefined;

      if (stream) {
        options.path = `/model/${model}/invoke-with-response-stream`;
      } else {
        options.path = `/model/${model}/invoke`;
      }
    }

    return super.buildRequest(options);
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
