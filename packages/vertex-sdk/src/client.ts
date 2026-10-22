import { APIRequest, BaseAnthropic, ClientOptions as CoreClientOptions } from '@anthropic-ai/sdk/client';
import * as Resources from '@anthropic-ai/sdk/resources/index';
import { VERSION } from '@anthropic-ai/sdk/version';
import { VERSION as PACKAGE_VERSION } from './version';
import { GoogleAuth, AuthClient } from 'google-auth-library';
import { AnthropicError, APIConnectionError } from './core/error';
import type { Middleware } from './core/middleware';
import { castToError } from './internal/errors';
import { readEnv } from './internal/utils/env';
import { FinalRequestOptions } from './internal/request-options';
import {
  isObj,
  rejectUnsupportedCredentials,
  safeJSON,
  type PlatformCredentials,
} from './internal/utils/values';
import type { NullableHeaders } from './internal/headers';
import { buildHeaders } from './internal/headers';

export { BaseAnthropic } from '@anthropic-ai/sdk/client';

const MODEL_ENDPOINTS = new Set<string>(['/v1/messages', '/v1/messages?beta=true']);

const CREDENTIALS: PlatformCredentials = {
  accepts: [],
  unsupportedOptionMessage: (option) =>
    `The \`${option}\` option is not supported by AnthropicVertex; authentication uses Google credentials (\`googleAuth\`, \`authClient\`, or Application Default Credentials).`,
};

export type ClientOptions = Omit<CoreClientOptions, 'apiKey' | 'authToken'> & {
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

  /**
   * Provide a pre-configured `AuthClient` instance from the
   * [google-auth-library](https://www.npmjs.com/package/google-auth-library) package.
   *
   * This is useful when you want to use a specific authentication method like
   * [Impersonated credentials](https://www.npmjs.com/package/google-auth-library#impersonated-credentials-client):
   * ```ts
   * new AnthropicVertex({
   *   authClient: new Impersonated({
   *     sourceClient: await new GoogleAuth().getClient(),
   *     targetPrincipal: 'impersonated-account@projectID.iam.gserviceaccount.com',
   *     lifetime: 30,
   *     delegates: [],
   *     targetScopes: ['https://www.googleapis.com/auth/cloud-platform']
   *   })
   * })
   * ```
   */
  authClient?: AuthClient | null | undefined;
};

export class AnthropicVertex extends BaseAnthropic {
  /** @internal */
  override _genAIProviderName = 'gcp.vertex_ai';

  /** @internal */
  override _instrumentationScope() {
    return { platform: 'vertex', version: PACKAGE_VERSION };
  }

  region: string;
  projectId: string | null;
  accessToken: string | null;

  private _auth?: GoogleAuth;
  private _authClientPromise: Promise<AuthClient>;

  /**
   * API Client for interfacing with the Anthropic Vertex API.
   *
   * The `apiKey`, `authToken`, `credentials`, `config`, and `profile`
   * options throw an `AnthropicError`.
   *
   * @param {string | null} opts.accessToken
   * @param {string | null} opts.projectId
   * @param {GoogleAuth} opts.googleAuth - Override the default google auth config
   * @param {AuthClient} opts.authClient - Provide a pre-configured AuthClient instance (alternative to googleAuth)
   * @param {string | null} [opts.region=process.env['CLOUD_ML_REGION']] - The region to use for the API. Use 'global' for global endpoint. [More details here](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations).
   * @param {string} [opts.baseURL=process.env['ANTHROPIC_VERTEX__BASE_URL'] ?? https://${region}-aiplatform.googleapis.com/v1] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor({
    baseURL = readEnv('ANTHROPIC_VERTEX_BASE_URL'),
    region = readEnv('CLOUD_ML_REGION') ?? null,
    projectId = readEnv('ANTHROPIC_VERTEX_PROJECT_ID') ?? null,
    ...opts
  }: ClientOptions = {}) {
    rejectUnsupportedCredentials(opts, CREDENTIALS);

    if (!region) {
      throw new Error(
        'No region was given. The client should be instantiated with the `region` option or the `CLOUD_ML_REGION` environment variable should be set.',
      );
    }

    if (!baseURL) {
      switch (region) {
        case 'global':
          baseURL = 'https://aiplatform.googleapis.com/v1';
          break;
        case 'us':
          baseURL = 'https://aiplatform.us.rep.googleapis.com/v1';
          break;
        case 'eu':
          baseURL = 'https://aiplatform.eu.rep.googleapis.com/v1';
          break;
        default:
          baseURL = `https://${region}-aiplatform.googleapis.com/v1`;
      }
    }

    super({
      baseURL,
      // `null`, not `undefined`: `undefined` makes the base client fall back
      // to the ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN env vars, which are
      // not auth sources for Vertex — they must never be sent to the Google
      // endpoint alongside the Google OAuth credentials.
      apiKey: null,
      authToken: null,
      ...opts,
    });

    this.region = region;
    this.projectId = projectId;
    this.accessToken = opts.accessToken ?? null;

    if (opts.authClient && opts.googleAuth) {
      throw new Error(
        'You cannot provide both `authClient` and `googleAuth`. Please provide only one of them.',
      );
    } else if (opts.authClient) {
      this._authClientPromise = Promise.resolve(opts.authClient);
    } else {
      this._auth =
        opts.googleAuth ?? new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
      this._authClientPromise = this._auth.getClient();
    }
  }

  messages: MessagesResource = makeMessagesResource(this);
  beta: BetaResource = makeBetaResource(this);

  /** Vertex AI does not serve the user profile endpoints, so reading this throws. */
  get userProfiles(): never {
    return throwUserProfilesUnavailable();
  }

  /**
   * Create a new client instance re-using the same options given to the
   * current client, including `region` and `projectId`, with optional overriding.
   */
  override withOptions(options: Partial<ClientOptions>): this {
    return super.withOptions({
      region: this.region,
      projectId: this.projectId,
      // The constructor takes only one of the two, so the one given here replaces the other.
      ...(options.authClient ? { googleAuth: null } : {}),
      ...(options.googleAuth ? { authClient: null } : {}),
      ...options,
    });
  }

  protected override validateHeaders() {
    // auth validation is handled in the backend middleware since it needs to be async
  }

  // Auth is Google OAuth only; never resolve unrelated local Anthropic
  // credentials (which could also supply a base URL).
  protected override _shouldResolveDefaultCredentials(): boolean {
    return false;
  }

  // Google OAuth is applied in the backend middleware; no first-party
  // Authorization header may reach the Vertex endpoint.
  protected override async authHeaders(): Promise<NullableHeaders | undefined> {
    return undefined;
  }

  protected override getUserAgent(): string {
    return `AnthropicVertex/JS ${VERSION}`;
  }

  protected override backendMiddleware(): ReadonlyArray<Middleware> {
    return [async (request, next, ctx) => next(await this.#adaptRequest(request, ctx.options))];
  }

  /**
   * Rewrites the canonical Anthropic-shaped request into Vertex's wire shape
   * and applies Google OAuth. Runs inside the user middleware chain: the
   * OAuth token is a backend credential transformation, so middleware never
   * observes it, and each `next()` invocation applies a fresh token.
   */
  async #adaptRequest(request: APIRequest, options: FinalRequestOptions | undefined): Promise<APIRequest> {
    let authClient: AuthClient;
    let googleAuthHeaders: Awaited<ReturnType<AuthClient['getRequestHeaders']>>;
    try {
      authClient = await this._authClientPromise;
      googleAuthHeaders = await authClient.getRequestHeaders();
    } catch (err) {
      // OAuth token acquisition is network-bound (metadata server, token
      // endpoint), so its failures stay on the SDK's connection-error retry
      // policy instead of propagating as non-retryable middleware errors.
      throw new APIConnectionError({
        message: 'Failed to acquire Google OAuth credentials.',
        cause: castToError(err),
      });
    }
    const projectId = authClient.projectId ?? googleAuthHeaders.get('x-goog-user-project');
    if (!this.projectId && projectId) {
      this.projectId = projectId;
    }

    const url = new URL(request.url);

    let parsedBody: Record<string, unknown> | undefined;
    if (typeof request.body === 'string') {
      const parsed = safeJSON(request.body);
      if (isObj(parsed)) parsedBody = parsed;
    }

    const version = request.headers.get('anthropic-version');
    if (parsedBody && version && !parsedBody['anthropic_version']) {
      parsedBody['anthropic_version'] = version;
    }

    if (options && MODEL_ENDPOINTS.has(options.path) && options.method === 'post') {
      // Rewrite by canonical-suffix replacement so base URLs with path
      // prefixes keep working. If middleware rewrote the path away from the
      // canonical shape, it took control of the wire shape: leave it alone.
      const canonicalPath = options.path.split('?')[0]!;
      if (url.pathname.endsWith(canonicalPath)) {
        if (!this.projectId) {
          throw new Error(
            'No projectId was given and it could not be resolved from credentials. The client should be instantiated with the `projectId` option or the `ANTHROPIC_VERTEX_PROJECT_ID` environment variable should be set.',
          );
        }

        if (!parsedBody) {
          throw new Error('Expected request body to be an object for post /v1/messages');
        }

        const model = parsedBody['model'];
        delete parsedBody['model'];

        const stream = parsedBody['stream'] ?? false;

        const specifier = stream ? 'streamRawPredict' : 'rawPredict';

        const prefix = url.pathname.slice(0, url.pathname.length - canonicalPath.length);
        url.pathname = `${prefix}/projects/${this.projectId}/locations/${this.region}/publishers/anthropic/models/${model}:${specifier}`;
        // The canonical `?beta=true` marker has no meaning on Vertex.
        url.searchParams.delete('beta');
      }
    }

    if (
      options &&
      (options.path === '/v1/messages/count_tokens' ||
        (options.path == '/v1/messages/count_tokens?beta=true' && options.method === 'post'))
    ) {
      const canonicalPath = options.path.split('?')[0]!;
      if (url.pathname.endsWith(canonicalPath)) {
        if (!this.projectId) {
          throw new Error(
            'No projectId was given and it could not be resolved from credentials. The client should be instantiated with the `projectId` option or the `ANTHROPIC_VERTEX_PROJECT_ID` environment variable should be set.',
          );
        }

        const prefix = url.pathname.slice(0, url.pathname.length - canonicalPath.length);
        url.pathname = `${prefix}/projects/${this.projectId}/locations/${this.region}/publishers/anthropic/models/count-tokens:rawPredict`;
        url.searchParams.delete('beta');
      }
    }

    const adapted = {
      ...request,
      url: url.toString(),
      // Request/middleware-set headers win over the OAuth headers, preserving
      // the ability to override `Authorization` explicitly. Vertex takes the
      // API version from the body.
      headers: buildHeaders([googleAuthHeaders, request.headers, { 'anthropic-version': null }]).values,
    } as APIRequest;
    if (parsedBody) {
      adapted.body = JSON.stringify(parsedBody);
    }
    return adapted;
  }
}

/**
 * The Vertex SDK does not currently support the Batch API.
 */
type MessagesResource = Omit<Resources.Messages, 'batches'>;

function makeMessagesResource(client: AnthropicVertex): MessagesResource {
  const resource = new Resources.Messages(client);

  // @ts-expect-error we're deleting non-optional properties
  delete resource.batches;

  return resource;
}

/**
 * The Vertex API does not currently support the Batch API or the user profile endpoints.
 */
type BetaResource = Omit<Resources.Beta, 'messages' | 'userProfiles'> & {
  messages: Omit<Resources.Beta['messages'], 'batches'>;
};

function makeBetaResource(client: AnthropicVertex): BetaResource {
  const resource = new Resources.Beta(client);

  // @ts-expect-error we're deleting non-optional properties
  delete resource.messages.batches;

  Object.defineProperty(resource, 'userProfiles', { enumerable: false, get: throwUserProfilesUnavailable });

  return resource;
}

function throwUserProfilesUnavailable(): never {
  throw new AnthropicError(
    'Managing user profiles is not available on `AnthropicVertex`. To send a profile ID with a request, pass `user_profile_id` to `messages.create`.',
  );
}
