import * as Core from '@anthropic-ai/sdk/core';
import * as Resources from '@anthropic-ai/sdk/resources/index';
import * as API from '@anthropic-ai/sdk/index';
import { type RequestInit } from '@anthropic-ai/sdk/_shims/index';
import { GoogleAuth } from 'google-auth-library';

const DEFAULT_VERSION = 'vertex-2023-10-16';

export type ClientOptions = Omit<API.ClientOptions, 'apiKey' | 'authToken'> & {
  region?: string | null | undefined;
  projectId?: string | null | undefined;
  accessToken?: string | null | undefined;

  /**
   * Override the default google auth config using the
   * [google-auth-library](https://www.npmjs.com/package/google-auth-library) package.
   *
   * Note that you'll likely have to set `scopes`, e.g.
   * ```ts
   * new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' })
   * ```
   */
  googleAuth?: GoogleAuth | null | undefined;
};

export class AnthropicVertex extends Core.APIClient {
  region: string;
  projectId: string | null;
  accessToken: string | null;

  private _options: ClientOptions;
  private _auth: GoogleAuth;
  private _authClientPromise: ReturnType<GoogleAuth['getClient']>;

  /**
   * API Client for interfacing with the Anthropic Vertex API.
   *
   * @param {string | null} opts.accessToken
   * @param {string | null} opts.projectId
   * @param {GoogleAuth} opts.googleAuth - Override the default google auth config
   * @param {string | null} [opts.region=process.env['CLOUD_ML_REGION']]
   * @param {string} [opts.baseURL=process.env['ANTHROPIC_VERTEX__BASE_URL'] ?? https://${region}-aiplatform.googleapis.com/v1] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
   * @param {Core.Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Core.DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
   */
  constructor({
    baseURL = Core.readEnv('ANTHROPIC_VERTEX_BASE_URL'),
    region = Core.readEnv('CLOUD_ML_REGION') ?? null,
    projectId = Core.readEnv('ANTHROPIC_VERTEX_PROJECT_ID') ?? null,
    ...opts
  }: ClientOptions = {}) {
    if (!region) {
      throw new Error(
        'No region was given. The client should be instantiated with the `region` option or the `CLOUD_ML_REGION` environment variable should be set.',
      );
    }

    const options: ClientOptions = {
      ...opts,
      baseURL: baseURL || `https://${region}-aiplatform.googleapis.com/v1`,
    };

    super({
      baseURL: options.baseURL!,
      timeout: options.timeout ?? 600000 /* 10 minutes */,
      httpAgent: options.httpAgent,
      maxRetries: options.maxRetries,
      fetch: options.fetch,
    });
    this._options = options;

    this.region = region;
    this.projectId = projectId;
    this.accessToken = options.accessToken ?? null;

    this._auth =
      options.googleAuth ?? new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
    this._authClientPromise = this._auth.getClient();
  }

  messages: Resources.Messages = new Resources.Messages(this);

  protected override defaultQuery(): Core.DefaultQuery | undefined {
    return this._options.defaultQuery;
  }

  protected override defaultHeaders(opts: Core.FinalRequestOptions): Core.Headers {
    return {
      ...super.defaultHeaders(opts),
      ...this._options.defaultHeaders,
    };
  }

  protected override async prepareOptions(options: Core.FinalRequestOptions): Promise<void> {
    const authClient = await this._authClientPromise;

    const authHeaders = await authClient.getRequestHeaders();
    const projectId = authClient.projectId ?? authHeaders['x-goog-user-project'];
    if (!this.projectId && projectId) {
      this.projectId = projectId;
    }

    options.headers = { ...authHeaders, ...options.headers };
  }

  override buildRequest(options: Core.FinalRequestOptions<unknown>): {
    req: RequestInit;
    url: string;
    timeout: number;
  } {
    if (Core.isObj(options.body)) {
      if (!options.body['anthropic_version']) {
        options.body['anthropic_version'] = DEFAULT_VERSION;
      }
    }

    if (options.path === '/v1/messages' && options.method === 'post') {
      if (!this.projectId) {
        throw new Error(
          'No projectId was given and it could not be resolved from credentials. The client should be instantiated with the `projectId` option or the `ANTHROPIC_VERTEX_PROJECT_ID` environment variable should be set.',
        );
      }

      if (!Core.isObj(options.body)) {
        throw new Error('Expected request body to be an object for post /v1/messages');
      }

      const model = options.body['model'];
      options.body['model'] = undefined;

      const stream = options.body['stream'] ?? false;

      const specifier = stream ? 'streamRawPredict' : 'rawPredict';

      options.path = `/projects/${this.projectId}/locations/${this.region}/publishers/anthropic/models/${model}:${specifier}`;
    }

    return super.buildRequest(options);
  }
}
