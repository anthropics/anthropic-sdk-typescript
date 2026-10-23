import type { NullableHeaders } from './internal/headers';
import { buildHeaders } from './internal/headers';
import * as Errors from './core/error';
import {
  isAbsoluteURL,
  readEnv,
  rejectUnsupportedCredentials,
  type CredentialOption,
  type PlatformCredentials,
} from './internal/utils';
import { FinalRequestOptions } from './internal/request-options';
import { Anthropic, ClientOptions as CoreClientOptions } from '@anthropic-ai/sdk/client';
export { BaseAnthropic } from '@anthropic-ai/sdk/client';
import { VERSION } from '@anthropic-ai/sdk/version';
import { VERSION as PACKAGE_VERSION } from './version';
import { GoogleAuth, AuthClient } from 'google-auth-library';

const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

// The gateway should always be addressed via the global region.
const DEFAULT_LOCATION = 'global';

const deriveLocationURL = (project: string, location: string): string =>
  `https://claude.googleapis.com/v1/projects/${project}/locations/${location}`;

// The gateway base URL; `baseURL` remains the override hatch.
const deriveBaseURL = (project: string, location: string, workspaceId: string): string =>
  `${deriveLocationURL(project, location)}/workspaces/${workspaceId}/invoke`;

// Organization-level routes are served from a base with no workspace in it.
const deriveOrganizationBaseURL = (project: string, location: string): string =>
  `${deriveLocationURL(project, location)}/claudeOrganization/invoke`;

const ORGANIZATION_PATH = /^\/v1\/(?:organizations\/|user_profiles(?:[/?]|$))/;

// A reserved, guaranteed-unroutable host (RFC 2606): a request that slips
// past the gates while no base URL is derived can never carry the Google
// bearer to the default API host.
const UNRESOLVED_BASE_URL = 'https://unresolved.invalid';

const CREDENTIALS: PlatformCredentials = {
  accepts: [],
  unsupportedOptionMessage: (option) =>
    `The \`${option}\` option is not supported by AnthropicGoogleCloud; authentication uses a Google bearer token (\`bearerTokenProvider\`, \`googleAuth\`/\`authClient\`, or Application Default Credentials).`,
};

const NO_PROJECT_HINT =
  'Set `project` or the `ANTHROPIC_GOOGLE_CLOUD_PROJECT` environment variable (or provide `baseURL`).';

// Auth is exclusively a Google bearer token; none of the base client's
// Anthropic credential sources (API key, auth token, credential chain)
// apply here. A runtime guard in the constructor backs this up for
// untyped callers.
/** API Client for interfacing with Claude Models on Google Cloud (Anthropic managed). */
export interface GoogleCloudClientOptions extends Omit<CoreClientOptions, CredentialOption> {
  /**
   * The GCP project id that owns the Claude Models on Google Cloud (Anthropic
   * managed) resource. Used to derive the base URL when one is not given
   * explicitly.
   *
   * When neither this nor its env-var defaults are set (and no `baseURL` is
   * given), the project is resolved lazily from Google credentials (the ADC
   * keyfile, gcloud config, or the GCE metadata server). The resolved value
   * is available after `await client.ready` or the first request; until then
   * `project` and `baseURL` are not yet derived.
   *
   * @default process.env['ANTHROPIC_GOOGLE_CLOUD_PROJECT'] ?? process.env['GOOGLE_CLOUD_PROJECT']
   */
  project?: string | undefined;

  /**
   * The GCP location of the Claude Models on Google Cloud (Anthropic managed)
   * resource. Optional — defaults to `global`, which is the region the gateway
   * should normally be addressed through.
   *
   * @default process.env['ANTHROPIC_GOOGLE_CLOUD_LOCATION'] ?? 'global'
   */
  location?: string | undefined;

  /**
   * The Anthropic workspace ID. Required when the base URL is derived, except
   * for organization-level routes (`/v1/organizations/*` and the
   * `/v1/user_profiles` routes).
   *
   * @default process.env['ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID']
   */
  workspaceId?: string | undefined;

  /**
   * A function that returns a Google bearer access token, invoked on every
   * request. Takes precedence over `googleAuth` / `authClient` and Application
   * Default Credentials.
   */
  bearerTokenProvider?: (() => Promise<string>) | undefined;

  /**
   * Override the default Google auth config using the
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
   * [google-auth-library](https://www.npmjs.com/package/google-auth-library) package,
   * for example to use impersonated credentials.
   */
  authClient?: AuthClient | null | undefined;

  /**
   * Skip authentication. Useful when a gateway or proxy authenticates
   * upstream on your behalf. No token is attached.
   *
   * @default false
   */
  skipAuth?: boolean | undefined;
}

/**
 * API Client for Claude Models on Google Cloud (Anthropic managed): the
 * first-party Anthropic API served through Google Cloud.
 *
 * Unlike `AnthropicVertex` (the `:rawPredict` publisher-model client), this
 * exposes the full first-party surface with no URL or body rewriting — the
 * gateway accepts `/v1/*` paths verbatim — and authenticates with a Google
 * bearer token rather than per-request request signing.
 */
export class AnthropicGoogleCloud extends Anthropic {
  /** @internal */
  override _instrumentationScope() {
    return { platform: 'google-cloud', version: PACKAGE_VERSION };
  }

  project: string | null;
  location: string | null;
  workspaceId: string | undefined;
  skipAuth: boolean;

  /**
   * Resolves once the client is fully configured (project and base URL
   * resolved). Rejects if project resolution from Google credentials fails.
   * Await this to fail fast on misconfiguration instead of waiting for the
   * first request.
   */
  readonly ready: Promise<void>;

  #bearerTokenProvider?: (() => Promise<string>) | undefined;
  #googleAuth?: GoogleAuth | null;
  #authClient?: AuthClient | null;
  #authClientPromise?: Promise<AuthClient>;
  // The base URL this client derived and placed in `baseURL` itself; unset
  // when `baseURL` was supplied explicitly (constructor arg or env var).
  #derivedBaseURL: string | undefined;
  #organizationBaseURL = UNRESOLVED_BASE_URL;

  /**
   * API Client for the first-party Anthropic API on Google Cloud.
   *
   * Auth is resolved by precedence: `bearerTokenProvider` > `authClient` /
   * `googleAuth` > Application Default Credentials.
   *
   * @param [opts.project=process.env['ANTHROPIC_GOOGLE_CLOUD_PROJECT'] ?? process.env['GOOGLE_CLOUD_PROJECT']] - GCP project id used to derive the base URL. Back-filled lazily from Google credentials when not given.
   * @param [opts.location=process.env['ANTHROPIC_GOOGLE_CLOUD_LOCATION'] ?? 'global'] - GCP location; defaults to `global`.
   * @param [opts.workspaceId=process.env['ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID']] - Workspace ID. Required when the base URL is derived, except for organization-level routes.
   * @param [opts.bearerTokenProvider] - Returns a Google access token; invoked on every request.
   * @param [opts.googleAuth] - Override the default Google auth config.
   * @param [opts.authClient] - A pre-configured google-auth-library `AuthClient`.
   * @param [opts.skipAuth=false] - Skip auth (pre-authed proxy).
   * @param [opts.baseURL=process.env['ANTHROPIC_GOOGLE_CLOUD_BASE_URL']] - Override the derived base URL.
   * @param [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param opts.defaultHeaders - Default headers to include with every request to the API.
   * @param opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor({
    baseURL = readEnv('ANTHROPIC_GOOGLE_CLOUD_BASE_URL'),
    project = readEnv('ANTHROPIC_GOOGLE_CLOUD_PROJECT') ?? readEnv('GOOGLE_CLOUD_PROJECT'),
    location = readEnv('ANTHROPIC_GOOGLE_CLOUD_LOCATION'),
    workspaceId = readEnv('ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID'),
    bearerTokenProvider,
    googleAuth,
    authClient,
    skipAuth = false,
    ...opts
  }: GoogleCloudClientOptions = {}) {
    rejectUnsupportedCredentials(opts, CREDENTIALS);

    if (authClient && googleAuth) {
      throw new Errors.AnthropicError(
        'The `authClient` and `googleAuth` arguments are mutually exclusive; only one can be passed at a time.',
      );
    }

    if (skipAuth && (bearerTokenProvider || googleAuth || authClient)) {
      throw new Errors.AnthropicError(
        'The `skipAuth` option is mutually exclusive with `bearerTokenProvider`, `googleAuth`, and `authClient`; `skipAuth` disables authentication entirely.',
      );
    }

    // An exported-but-empty env var (or an explicit '') is the unset case.
    location = location || DEFAULT_LOCATION;

    // Base URL: explicit arg / env, otherwise derive it from project +
    // location + workspace. When no project is known yet, it is back-filled
    // lazily from Google credentials and the base URL is set once resolution
    // lands (see `ready`).
    let resolvedBaseURL = baseURL;
    let lazyProject = false;
    if (!resolvedBaseURL) {
      if (project) {
        if (workspaceId) {
          resolvedBaseURL = deriveBaseURL(project, location, workspaceId);
        }
      } else if (skipAuth) {
        // With skipAuth there are no Google credentials to ask for a project.
        throw new Errors.AnthropicError(`No project was given. ${NO_PROJECT_HINT}`);
      } else {
        lazyProject = true;
      }
    }

    super({
      // Always pass the resolved base URL so ANTHROPIC_BASE_URL can't leak in.
      // Pass null (not undefined) while there is none so the base
      // constructor's env-var default can't kick in either.
      baseURL: resolvedBaseURL ?? null,
      ...opts,
      // Never inherit ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN: auth here is a
      // Google bearer token attached in authHeaders(). Passing null also keeps
      // the base constructor from reading the env vars. Placed after `...opts`
      // so an untyped caller can't smuggle either back in.
      apiKey: null,
      authToken: null,
      // Hand the base constructor a pre-resolved empty auth state through its
      // internal __auth channel (the one withOptions() clones use) so the
      // default credential chain never runs: a profile under
      // ANTHROPIC_CONFIG_DIR would otherwise attach its own headers and could
      // rewrite the base URL out from under the gateway. Placed after
      // `...opts` so a caller cannot supply their own auth state.
      ...({
        __auth: { provider: null, tokenCache: null, resolution: null, error: null, extraHeaders: {} },
      } as {}),
    });

    this.project = project ?? null;
    this.location = location ?? null;
    this.workspaceId = workspaceId;
    this.skipAuth = skipAuth;
    this.#bearerTokenProvider = bearerTokenProvider;
    this.#googleAuth = googleAuth ?? null;
    this.#authClient = authClient ?? null;
    if (!baseURL) {
      // Without a project or a workspace ID there is no workspace base to
      // derive, and the base constructor coerced its hardcoded default host
      // into `baseURL`. Fail closed.
      this.#derivedBaseURL = this.baseURL = resolvedBaseURL ?? UNRESOLVED_BASE_URL;
      if (project) {
        this.#organizationBaseURL = deriveOrganizationBaseURL(project, location);
      }
    }

    let auth: GoogleAuth | undefined;
    if (!skipAuth && !bearerTokenProvider) {
      if (authClient) {
        this.#authClientPromise = Promise.resolve(authClient);
      } else {
        auth = googleAuth ?? new GoogleAuth({ scopes: DEFAULT_SCOPE });
        this.#authClientPromise = auth.getClient();
        // Suppress unhandledRejection if ADC discovery fails before anything
        // awaits the promise; the error surfaces when #getToken() awaits it
        // on the first request.
        this.#authClientPromise.catch(() => {});
      }
    }

    if (!lazyProject) {
      this.ready = Promise.resolve();
    } else {
      // Resolve the project through the caller's credential source where
      // there is one: the token-auth GoogleAuth, else a caller-supplied
      // `googleAuth` (which is skipped above when tokens come from
      // `bearerTokenProvider`), else a fresh GoogleAuth that still resolves
      // from GOOGLE_CLOUD_PROJECT, the ADC keyfile, gcloud config, or the
      // GCE metadata server.
      const projectAuth =
        auth ??
        googleAuth ??
        new GoogleAuth({ scopes: DEFAULT_SCOPE, ...(authClient ? { authClient } : {}) });
      const resolvedLocation = location;
      this.ready = projectAuth.getProjectId().then(
        (project) => {
          this.project = project;
          if (this.#baseURLOverridden()) {
            return;
          }
          this.#organizationBaseURL = deriveOrganizationBaseURL(project, resolvedLocation);
          if (workspaceId) {
            this.#derivedBaseURL = this.baseURL = deriveBaseURL(project, resolvedLocation, workspaceId);
          }
        },
        (err) => {
          const error = new Errors.AnthropicError(
            `No project was given and it could not be resolved from Google credentials. ${NO_PROJECT_HINT}`,
          );
          error.cause = err;
          throw error;
        },
      );
      // Suppress unhandledRejection; the error surfaces via `await ready` or the first request.
      this.ready.catch(() => {});
    }
  }

  /**
   * Create a new client instance re-using the same options — including the
   * gateway-specific ones (`project`, `location`, `workspaceId`, the auth
   * source, `skipAuth`) — with optional overrides.
   *
   * When the base URL was derived (not given explicitly), the clone re-derives
   * it from its effective `project` / `location` / `workspaceId`, so overriding
   * any of them updates the URL path too. An explicit `baseURL` (constructor
   * arg, env var, or a later assignment) is passed through unchanged.
   */
  override withOptions(options: Partial<GoogleCloudClientOptions>): this {
    // The base re-runs this constructor from `_options`, which only carries the
    // keys the base accepted; inject the gateway state from instance fields so
    // clones inherit project/location/workspace and the auth source. `_options`
    // stays purely the base's domain.
    return super.withOptions({
      project: this.project ?? undefined,
      location: this.location ?? undefined,
      workspaceId: this.workspaceId,
      bearerTokenProvider: this.#bearerTokenProvider,
      googleAuth: this.#googleAuth ?? undefined,
      authClient: this.#authClient ?? undefined,
      skipAuth: this.skipAuth,
      // A derived base URL (including the still-deferring lazy-ADC placeholder)
      // is left unset so the clone's constructor re-derives it from the
      // effective gateway options above — a clone whose project is still
      // unresolved keeps deferring. Only an explicit URL passes through.
      baseURL: this.#baseURLOverridden() ? this.baseURL : undefined,
      ...options,
    } as Partial<CoreClientOptions>);
  }

  #baseURLOverridden(): boolean {
    return this.baseURL !== this.#derivedBaseURL;
  }

  override buildURL(
    path: string,
    query: Record<string, unknown> | null | undefined,
    defaultBaseURL?: string | undefined,
  ): string {
    if (this.#baseURLOverridden() || isAbsoluteURL(path)) {
      return super.buildURL(path, query, defaultBaseURL);
    }

    if (ORGANIZATION_PATH.test(path)) {
      return super.buildURL(this.#organizationBaseURL + path, query, defaultBaseURL);
    }

    if (!this.workspaceId) {
      throw new Errors.AnthropicError(
        'No workspace ID found. Set `workspaceId` in the constructor or the `ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID` environment variable.',
      );
    }
    return super.buildURL(path, query, defaultBaseURL);
  }

  protected override async prepareOptions(options: FinalRequestOptions): Promise<void> {
    await super.prepareOptions(options);
    await this.#resolved();
  }

  override async buildRequest(
    options: FinalRequestOptions,
    props: { retryCount?: number } = {},
  ): ReturnType<Anthropic['buildRequest']> {
    // The normal request path awaits `ready` in prepareOptions(), but
    // buildRequest() is public and reachable directly (custom transports);
    // gate it too so a request can never be built against the unroutable
    // placeholder while the project is unresolved (or after resolution failed).
    await this.#resolved();
    return await super.buildRequest(options, props);
  }

  // A base URL the caller assigned needs no project.
  async #resolved(): Promise<void> {
    if (!this.#baseURLOverridden()) {
      await this.ready;
    }
  }

  // No workspace header — the workspace ID is carried by the base URL path.
  protected override async authHeaders(opts: FinalRequestOptions): Promise<NullableHeaders | undefined> {
    if (this.skipAuth) {
      return undefined;
    }

    // Respect an Authorization header the caller supplied (per-request or in
    // defaultHeaders) or explicitly nulled out — mirroring the base merge,
    // where either form would take effect anyway.
    const merged = buildHeaders([this._options.defaultHeaders, opts.headers]);
    if (merged.values.get('authorization') || merged.nulls.has('authorization')) {
      return undefined;
    }

    const token = await this.#getToken();
    return buildHeaders([{ Authorization: `Bearer ${token}` }]);
  }

  protected override validateHeaders(): void {
    // Auth is handled fully in authHeaders(); the base API key validation
    // must not run since this client never carries an API key.
    return;
  }

  protected override getUserAgent(): string {
    return `AnthropicGoogleCloud/JS ${VERSION}`;
  }

  async #getToken(): Promise<string> {
    if (this.#bearerTokenProvider) {
      return await this.#bearerTokenProvider();
    }

    // google-auth-library caches and refreshes the token internally, so it is
    // cheap to ask for it on every request.
    const authClient = await this.#authClientPromise!;
    const { token } = await authClient.getAccessToken();
    if (!token) {
      throw new Errors.AnthropicError(
        'Failed to obtain a Google access token from Application Default Credentials.',
      );
    }
    return token;
  }
}
