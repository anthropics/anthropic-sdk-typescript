// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import type { RequestInit, RequestInfo, BodyInit } from './internal/builtin-types';
import type { HTTPMethod, PromiseOrValue, MergedRequestInit, FinalizedRequestInit } from './internal/types';
import { uuid4 } from './internal/utils/uuid';
import { validatePositiveInteger, isAbsoluteURL, safeJSON } from './internal/utils/values';
import { sleep } from './internal/utils/sleep';
export type { Logger, LogLevel } from './internal/utils/log';
import { castToError, isAbortError } from './internal/errors';
import type { APIResponseProps } from './internal/parse';
import { getPlatformHeaders } from './internal/detect-platform';
import * as Shims from './internal/shims';
import * as Opts from './internal/request-options';
import { stringifyQuery } from './internal/utils/query';
import { VERSION } from './version';
import * as Errors from './core/error';
import type { AccessTokenProvider } from './lib/credentials/types';
import { OAUTH_API_BETA_HEADER } from './lib/credentials/types';
import { TokenCache } from './lib/credentials/token-cache';
import { defaultCredentials, resolveCredentialsFromConfig } from './lib/credentials/credential-chain';
import type { AnthropicConfig } from './core/credentials';
import * as Pagination from './core/pagination';
import {
  type PageCursorParams,
  PageCursorResponse,
  type PageParams,
  PageResponse,
  type TokenPageParams,
  TokenPageResponse,
} from './core/pagination';
import * as Uploads from './core/uploads';
import * as API from './resources/index';
import { APIPromise } from './core/api-promise';
import {
  Completion,
  CompletionCreateParams,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  Completions,
} from './resources/completions';
import {
  CapabilitySupport,
  ContextManagementCapability,
  EffortCapability,
  ModelCapabilities,
  ModelInfo,
  ModelInfosPage,
  ModelListParams,
  ModelRetrieveParams,
  Models,
  ThinkingCapability,
  ThinkingTypes,
} from './resources/models';
import {
  AnthropicBeta,
  Beta,
  BetaAPIError,
  BetaAuthenticationError,
  BetaBillingError,
  BetaError,
  BetaErrorResponse,
  BetaGatewayTimeoutError,
  BetaInvalidRequestError,
  BetaNotFoundError,
  BetaOverloadedError,
  BetaPermissionError,
  BetaRateLimitError,
} from './resources/beta/beta';
import {
  Base64ImageSource,
  Base64PDFSource,
  BashCodeExecutionOutputBlock,
  BashCodeExecutionOutputBlockParam,
  BashCodeExecutionResultBlock,
  BashCodeExecutionResultBlockParam,
  BashCodeExecutionToolResultBlock,
  BashCodeExecutionToolResultBlockParam,
  BashCodeExecutionToolResultError,
  BashCodeExecutionToolResultErrorCode,
  BashCodeExecutionToolResultErrorParam,
  CacheControlEphemeral,
  CacheCreation,
  CitationCharLocation,
  CitationCharLocationParam,
  CitationContentBlockLocation,
  CitationContentBlockLocationParam,
  CitationPageLocation,
  CitationPageLocationParam,
  CitationSearchResultLocationParam,
  CitationWebSearchResultLocationParam,
  CitationsConfig,
  CitationsConfigParam,
  CitationsDelta,
  CitationsSearchResultLocation,
  CitationsWebSearchResultLocation,
  CodeExecutionOutputBlock,
  CodeExecutionOutputBlockParam,
  CodeExecutionResultBlock,
  CodeExecutionResultBlockParam,
  CodeExecutionTool20250522,
  CodeExecutionTool20250825,
  CodeExecutionTool20260120,
  CodeExecutionToolResultBlock,
  CodeExecutionToolResultBlockContent,
  CodeExecutionToolResultBlockParam,
  CodeExecutionToolResultBlockParamContent,
  CodeExecutionToolResultError,
  CodeExecutionToolResultErrorCode,
  CodeExecutionToolResultErrorParam,
  Container,
  ContainerUploadBlock,
  ContainerUploadBlockParam,
  ContentBlock,
  ContentBlockDeltaEvent,
  ContentBlockParam,
  ContentBlockStartEvent,
  ContentBlockStopEvent,
  ContentBlockSource,
  ContentBlockSourceContent,
  DirectCaller,
  DocumentBlock,
  DocumentBlockParam,
  EncryptedCodeExecutionResultBlock,
  EncryptedCodeExecutionResultBlockParam,
  ImageBlockParam,
  InputJSONDelta,
  JSONOutputFormat,
  MemoryTool20250818,
  Message,
  MessageStreamParams,
  MessageCountTokensParams,
  MessageCountTokensTool,
  MessageCreateParams,
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  MessageDeltaEvent,
  MessageDeltaUsage,
  MessageParam,
  MessageStartEvent,
  MessageStopEvent,
  MessageStreamEvent,
  MessageTokensCount,
  Messages,
  Metadata,
  Model,
  OutputConfig,
  PlainTextSource,
  RawContentBlockDelta,
  RawContentBlockDeltaEvent,
  RawContentBlockStartEvent,
  RawContentBlockStopEvent,
  RawMessageDeltaEvent,
  RawMessageStartEvent,
  RawMessageStopEvent,
  RawMessageStreamEvent,
  RedactedThinkingBlock,
  RedactedThinkingBlockParam,
  RefusalStopDetails,
  SearchResultBlockParam,
  ServerToolCaller,
  ServerToolCaller20260120,
  ServerToolUsage,
  ServerToolUseBlock,
  ServerToolUseBlockParam,
  SignatureDelta,
  StopReason,
  TextBlock,
  TextBlockParam,
  TextCitation,
  TextCitationParam,
  TextDelta,
  TextEditorCodeExecutionCreateResultBlock,
  TextEditorCodeExecutionCreateResultBlockParam,
  TextEditorCodeExecutionStrReplaceResultBlock,
  TextEditorCodeExecutionStrReplaceResultBlockParam,
  TextEditorCodeExecutionToolResultBlock,
  TextEditorCodeExecutionToolResultBlockParam,
  TextEditorCodeExecutionToolResultError,
  TextEditorCodeExecutionToolResultErrorCode,
  TextEditorCodeExecutionToolResultErrorParam,
  TextEditorCodeExecutionViewResultBlock,
  TextEditorCodeExecutionViewResultBlockParam,
  ThinkingBlock,
  ThinkingBlockParam,
  ThinkingConfigAdaptive,
  ThinkingConfigDisabled,
  ThinkingConfigEnabled,
  ThinkingConfigParam,
  ThinkingDelta,
  Tool,
  ToolBash20250124,
  ToolChoice,
  ToolChoiceAny,
  ToolChoiceAuto,
  ToolChoiceNone,
  ToolChoiceTool,
  ToolReferenceBlock,
  ToolReferenceBlockParam,
  ToolResultBlockParam,
  ToolSearchToolBm25_20251119,
  ToolSearchToolRegex20251119,
  ToolSearchToolResultBlock,
  ToolSearchToolResultBlockParam,
  ToolSearchToolResultError,
  ToolSearchToolResultErrorCode,
  ToolSearchToolResultErrorParam,
  ToolSearchToolSearchResultBlock,
  ToolSearchToolSearchResultBlockParam,
  ToolTextEditor20250124,
  ToolTextEditor20250429,
  ToolTextEditor20250728,
  ToolUnion,
  ToolUseBlock,
  ToolUseBlockParam,
  URLImageSource,
  URLPDFSource,
  Usage,
  UserLocation,
  WebFetchBlock,
  WebFetchBlockParam,
  WebFetchTool20250910,
  WebFetchTool20260209,
  WebFetchTool20260309,
  WebFetchToolResultBlock,
  WebFetchToolResultBlockParam,
  WebFetchToolResultErrorBlock,
  WebFetchToolResultErrorBlockParam,
  WebFetchToolResultErrorCode,
  WebSearchResultBlock,
  WebSearchResultBlockParam,
  WebSearchTool20250305,
  WebSearchTool20260209,
  WebSearchToolRequestError,
  WebSearchToolResultBlock,
  WebSearchToolResultBlockContent,
  WebSearchToolResultBlockParam,
  WebSearchToolResultBlockParamContent,
  WebSearchToolResultError,
  WebSearchToolResultErrorCode,
} from './resources/messages/messages';
import { type Fetch } from './internal/builtin-types';
import { isRunningInBrowser } from './internal/detect-platform';
import { HeadersLike, NullableHeaders, buildHeaders } from './internal/headers';
import { FinalRequestOptions, RequestOptions } from './internal/request-options';
import { readEnv } from './internal/utils/env';
import {
  type LogLevel,
  type Logger,
  formatRequestDetails,
  loggerFor,
  parseLogLevel,
} from './internal/utils/log';
import { isEmptyObj } from './internal/utils/values';

/**
 * Shared auth state. A `withOptions()` clone receives the parent's instance
 * (unless the caller overrides auth options) so a clone created before lazy
 * resolution settles observes the same provider/tokenCache/error/extraHeaders
 * as the parent rather than starting an independent resolution.
 */
type AuthState = {
  provider: AccessTokenProvider | null;
  tokenCache: TokenCache | null;
  resolution: Promise<void> | null;
  error: unknown;
  extraHeaders: Record<string, string>;
  /**
   * `base_url` from the resolved profile/config, normalized (no trailing
   * slash). Stored on the shared auth state so `withOptions()` clones created
   * before lazy resolution settles can still adopt it on their first request.
   */
  baseURL?: string | undefined;
};

/**
 * Per-request auth flags, keyed by the FinalRequestOptions object so
 * caller-owned options aren't mutated.
 */
type RequestAuthFlags = {
  usedTokenCache: boolean;
  didRefreshFor401: boolean;
};

type InternalClientOptions = ClientOptions & {
  __auth?: AuthState | undefined;
  __baseURLIsExplicit?: boolean | undefined;
};

export type ApiKeySetter = () => Promise<string>;

export interface ClientOptions {
  /**
   * API key used for authentication.
   *
   * - Accepts either a static string or an async function that resolves to a string.
   * - Defaults to process.env['ANTHROPIC_API_KEY'].
   * - When a function is provided, it is invoked before each request so you can rotate
   *   or refresh credentials at runtime.
   * - The function must return a non-empty string; otherwise an AnthropicError is thrown.
   * - If the function throws, the error is wrapped in an AnthropicError with the original
   *   error available as `cause`.
   */
  apiKey?: string | ApiKeySetter | null | undefined;

  /**
   * Defaults to process.env['ANTHROPIC_AUTH_TOKEN'].
   */
  authToken?: string | null | undefined;

  /**
   * An {@link AccessTokenProvider} for OAuth/workload-identity authentication.
   *
   * When set, the provider is wrapped in a {@link TokenCache} and used for
   * Bearer token auth on every request. Takes precedence over `authToken`
   * but not `apiKey`.
   *
   * If omitted (and no `apiKey` or `authToken` is provided), the client
   * automatically resolves credentials from config files or environment
   * variables on the first request.
   */
  credentials?: AccessTokenProvider | null | undefined;

  /**
   * An {@link AnthropicConfig} object to resolve credentials from directly,
   * bypassing config-file and environment-variable lookup. This is the
   * TypeScript equivalent of Go's `option.WithConfig(cfg)`.
   *
   * Ignored when `credentials` is set. For `oidc_federation`, the SDK
   * performs the jwt-bearer exchange in-process; for `user_oauth`,
   * `authentication.credentials_path` must point at the credentials file.
   */
  config?: AnthropicConfig | null | undefined;

  /**
   * Name of a profile to load from `<config_dir>/configs/<profile>.json`.
   *
   * Equivalent to setting the `ANTHROPIC_PROFILE` environment variable, but
   * scoped to this client instance. As an explicit constructor argument it
   * takes precedence over `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` in the
   * environment. Mutually exclusive with `credentials` and `config`.
   */
  profile?: string | null | undefined;

  /**
   * Defaults to process.env['ANTHROPIC_WEBHOOK_SIGNING_KEY'].
   */
  webhookKey?: string | null | undefined;

  /**
   * Override the default base URL for the API, e.g., "https://api.example.com/v2/"
   *
   * Defaults to process.env['ANTHROPIC_BASE_URL'].
   */
  baseURL?: string | null | undefined;

  /**
   * The maximum amount of time (in milliseconds) that the client should wait for a response
   * from the server before timing out a single request.
   *
   * Note that request timeouts are retried by default, so in a worst-case scenario you may wait
   * much longer than this timeout before the promise succeeds or fails.
   *
   * @unit milliseconds
   */
  timeout?: number | undefined;
  /**
   * Additional `RequestInit` options to be passed to `fetch` calls.
   * Properties will be overridden by per-request `fetchOptions`.
   */
  fetchOptions?: MergedRequestInit | undefined;

  /**
   * Specify a custom `fetch` function implementation.
   *
   * If not provided, we expect that `fetch` is defined globally.
   */
  fetch?: Fetch | undefined;

  /**
   * The maximum number of times that the client will retry a request in case of a
   * temporary failure, like a network error or a 5XX error from the server.
   *
   * @default 2
   */
  maxRetries?: number | undefined;

  /**
   * Default headers to include with every request to the API.
   *
   * These can be removed in individual requests by explicitly setting the
   * header to `null` in request options.
   */
  defaultHeaders?: HeadersLike | undefined;

  /**
   * Default query parameters to include with every request to the API.
   *
   * These can be removed in individual requests by explicitly setting the
   * param to `undefined` in request options.
   */
  defaultQuery?: Record<string, string | undefined> | undefined;

  /**
   * By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   * Only set this option to `true` if you understand the risks and have appropriate mitigations in place.
   */
  dangerouslyAllowBrowser?: boolean | undefined;

  /**
   * Set the log level.
   *
   * Defaults to process.env['ANTHROPIC_LOG'] or 'warn' if it isn't set.
   */
  logLevel?: LogLevel | undefined;

  /**
   * Set the logger.
   *
   * Defaults to globalThis.console.
   */
  logger?: Logger | undefined;
}

export const HUMAN_PROMPT = '\\n\\nHuman:';
export const AI_PROMPT = '\\n\\nAssistant:';

/**
 * Base class for Anthropic API clients.
 */
export class BaseAnthropic {
  apiKey: string | null;
  authToken: string | null;
  webhookKey: string | null;

  /**
   * The active credential provider. Default credential resolution runs once
   * at construction time. If it fails, the error is surfaced on every
   * request and the client must be reconstructed — there is no retry path.
   *
   * Clones returned by {@link withOptions} share the parent's auth state
   * (provider, token cache, pending resolution, and any resolution error)
   * unless the caller passes an explicit `apiKey`, `authToken`,
   * `credentials`, `config`, or `profile` override.
   */
  get credentials(): AccessTokenProvider | null {
    return this._authState.provider;
  }
  private _authState: AuthState;
  private _baseURLIsExplicit: boolean;
  private _requestAuthFlags = new WeakMap<FinalRequestOptions, RequestAuthFlags>();

  baseURL: string;
  maxRetries: number;
  timeout: number;
  logger: Logger;
  logLevel: LogLevel | undefined;
  fetchOptions: MergedRequestInit | undefined;

  private fetch: Fetch;
  #encoder: Opts.RequestEncoder;
  protected idempotencyHeader?: string;
  protected _options: ClientOptions;

  /**
   * API Client for interfacing with the Anthropic API.
   *
   * @param {string | null | undefined} [opts.apiKey=process.env['ANTHROPIC_API_KEY'] ?? null]
   * @param {string | null | undefined} [opts.authToken=process.env['ANTHROPIC_AUTH_TOKEN'] ?? null]
   * @param {string | null | undefined} [opts.webhookKey=process.env['ANTHROPIC_WEBHOOK_SIGNING_KEY'] ?? null]
   * @param {string} [opts.baseURL=process.env['ANTHROPIC_BASE_URL'] ?? https://api.anthropic.com] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor({
    baseURL = readEnv('ANTHROPIC_BASE_URL'),
    apiKey,
    authToken,
    webhookKey = readEnv('ANTHROPIC_WEBHOOK_SIGNING_KEY') ?? null,
    ...opts
  }: ClientOptions = {}) {
    // An explicit `profile` is a constructor-level credential choice; when set,
    // do not let env ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN shadow it.
    if (apiKey === undefined) {
      apiKey = opts.profile != null ? null : readEnv('ANTHROPIC_API_KEY') ?? null;
    }
    if (authToken === undefined) {
      authToken = opts.profile != null ? null : readEnv('ANTHROPIC_AUTH_TOKEN') ?? null;
    }
    if (opts.profile != null && (opts.credentials != null || opts.config != null)) {
      throw new TypeError('Pass at most one of `profile`, `credentials`, or `config`.');
    }
    const options: ClientOptions = {
      apiKey,
      authToken,
      webhookKey,
      ...opts,
      baseURL: baseURL || `https://api.anthropic.com`,
    };

    if (!options.dangerouslyAllowBrowser && isRunningInBrowser()) {
      throw new Errors.AnthropicError(
        "It looks like you're running in a browser-like environment.\n\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\nIf you understand the risks and have appropriate mitigations in place,\nyou can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\nnew Anthropic({ apiKey, dangerouslyAllowBrowser: true });\n",
      );
    }

    this.baseURL = options.baseURL!;
    // After destructuring, `baseURL` is the constructor arg or
    // ANTHROPIC_BASE_URL — both count as an explicit choice that a profile
    // base_url must not override. A falsy value means we fell through to the
    // hardcoded default above and a profile may supply the host. withOptions()
    // propagates the parent's flag via __baseURLIsExplicit so a non-overriding
    // clone doesn't mistake the inherited baseURL for a caller-supplied one.
    this._baseURLIsExplicit = (opts as InternalClientOptions).__baseURLIsExplicit ?? !!baseURL;
    this.timeout = options.timeout ?? BaseAnthropic.DEFAULT_TIMEOUT /* 10 minutes */;
    this.logger = options.logger ?? console;
    const defaultLogLevel = 'warn';
    // Set default logLevel early so that we can log a warning in parseLogLevel.
    this.logLevel = defaultLogLevel;
    this.logLevel =
      parseLogLevel(options.logLevel, 'ClientOptions.logLevel', this) ??
      parseLogLevel(readEnv('ANTHROPIC_LOG'), "process.env['ANTHROPIC_LOG']", this) ??
      defaultLogLevel;
    this.fetchOptions = options.fetchOptions;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetch = options.fetch ?? Shims.getDefaultFetch();
    this.#encoder = Opts.FallbackEncoder;

    const customHeadersEnv = readEnv('ANTHROPIC_CUSTOM_HEADERS');
    if (customHeadersEnv) {
      const parsed: Record<string, string> = {};
      for (const line of customHeadersEnv.split('\n')) {
        const colon = line.indexOf(':');
        if (colon >= 0) {
          parsed[line.substring(0, colon).trim()] = line.substring(colon + 1).trim();
        }
      }
      options.defaultHeaders = { ...parsed, ...options.defaultHeaders };
    }

    const inherited = (opts as InternalClientOptions).__auth;
    // Never persist the internal __auth handle on _options — it's a
    // one-shot constructor signal, and leaking it through _options would
    // cause withOptions() to spread a stale value into clones.
    delete (options as InternalClientOptions).__auth;
    delete (options as InternalClientOptions).__baseURLIsExplicit;
    this._options = options;

    this.apiKey = typeof apiKey === 'string' ? apiKey : null;
    this.authToken = authToken;
    this.webhookKey = webhookKey;

    if (inherited) {
      this._authState = inherited;
      if (!this._baseURLIsExplicit && inherited.baseURL) {
        this.baseURL = inherited.baseURL;
      }
    } else {
      this._authState = { provider: null, tokenCache: null, resolution: null, error: null, extraHeaders: {} };

      // apiKey/authToken win over credentials/config/profile; don't build a
      // token cache or resolve a config that the request path will then ignore.
      if (this.apiKey == null && this.authToken == null) {
        const credentials = options.credentials ?? null;
        if (credentials) {
          this._authState.provider = credentials;
          this._authState.tokenCache = this._makeTokenCache(credentials);
        } else if (options.config != null) {
          const result = resolveCredentialsFromConfig(options.config, this._credentialResolverOptions());
          this._authState.provider = result.provider;
          this._authState.tokenCache = this._makeTokenCache(result.provider);
          this._authState.extraHeaders = result.extraHeaders;
          this._applyCredentialBaseURL(result.baseURL);
        } else if (options.profile != null) {
          this._authState.resolution = this._resolveDefaultCredentials(options.profile);
        } else {
          // No explicit auth provided — lazily resolve from the credential
          // chain on first request. Errors are captured into _auth.error and
          // surfaced on first use rather than as an unhandled rejection.
          this._authState.resolution = this._resolveDefaultCredentials();
        }
      }
    }
  }

  /**
   * Stores a profile/config-supplied base URL on the shared auth state and, if
   * the caller did not pin `baseURL` via constructor option or env, adopts it
   * as this client's outbound API host. Precedence: ctor opt > env > profile >
   * hardcoded default.
   */
  private _applyCredentialBaseURL(baseURL: string | undefined): void {
    if (!baseURL) return;
    const normalized = baseURL.replace(/\/+$/, '');
    this._authState.baseURL = normalized;
    if (!this._baseURLIsExplicit) {
      this.baseURL = normalized;
    }
  }

  /**
   * Options bag passed into the credential chain. `baseURL` here is only the
   * fallback host for the token-exchange POST when the config itself omits
   * `base_url`; the chain returns the config's own `base_url` (if any) on
   * {@link CredentialResult.baseURL}, which {@link _applyCredentialBaseURL}
   * then adopts for outbound API requests. The two are deliberately decoupled
   * so this fallback never round-trips into precedence.
   */
  private _credentialResolverOptions() {
    return {
      baseURL: this.baseURL,
      fetch: this.fetch,
      userAgent: this.getUserAgent(),
      onCacheWriteError: (err: unknown) => {
        loggerFor(this).debug('credential cache write failed (best-effort)', err);
      },
      onSafetyWarning: (msg: string) => {
        loggerFor(this).warn(msg);
      },
    };
  }

  private _makeTokenCache(provider: AccessTokenProvider): TokenCache {
    return new TokenCache(provider, (err) => {
      loggerFor(this).debug('advisory token refresh failed; serving cached token', err);
    });
  }

  /**
   * Create a new client instance re-using the same options given to the current client with optional overriding.
   */
  withOptions(options: Partial<ClientOptions>): this {
    // Share the auth state object unless the caller passes any auth-related
    // key. The `in` check is intentional: even `apiKey: undefined` opts the
    // clone out of sharing (it gets its own _auth and TokenCache, though it
    // may still wrap the parent's provider via the credentials spread below).
    const overridesStructuredAuth = 'credentials' in options || 'config' in options || 'profile' in options;
    const overridesAuth = 'apiKey' in options || 'authToken' in options || overridesStructuredAuth;
    const internal: InternalClientOptions = {
      ...this._options,
      // Only forward baseURL when the caller (or env) explicitly chose it.
      // For a non-explicit parent, this.baseURL may have been mutated to the
      // profile-resolved host; pinning that as the clone's options.baseURL
      // would make _options on the clone misreport caller intent and would
      // leave the clone stuck on the parent's host across an auth override.
      // The clone instead receives the construction-time value via
      // ...this._options above and re-adopts the profile host through the
      // shared _authState.baseURL + __baseURLIsExplicit=false path.
      ...(this._baseURLIsExplicit ? { baseURL: this.baseURL } : {}),
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      logger: this.logger,
      logLevel: this.logLevel,
      fetch: this.fetch,
      fetchOptions: this.fetchOptions,
      apiKey: this.apiKey,
      authToken: this.authToken,
      webhookKey: this.webhookKey,
      // credentials: this.credentials is a no-op when __auth is shared (the
      // ctor takes the inherited path and ignores options.credentials); when
      // overridesAuth is true via apiKey/authToken only, it lets the clone
      // build a fresh TokenCache around the parent's provider.
      credentials: this.credentials,
      // When the caller passes a structured-credential override, drop inherited
      // structured-credential options so only `...options` supplies them —
      // otherwise an inherited `credentials`/`config`/`profile` would trip the
      // mutual-exclusion check or precedence over the override.
      ...(overridesStructuredAuth ? { credentials: undefined, config: undefined, profile: undefined } : {}),
      ...options,
      // Always set __auth so any stale value from ...this._options is
      // overwritten. undefined means "build fresh auth from these options".
      __auth: overridesAuth ? undefined : this._authState,
      __baseURLIsExplicit: 'baseURL' in options ? true : this._baseURLIsExplicit,
    };
    return new (this.constructor as any as new (props: ClientOptions) => typeof this)(internal);
  }

  /**
   * Lazily resolves credentials from config files or environment variables.
   * Called once from the constructor when no explicit auth is provided, or
   * when an explicit `profile` was passed (in which case a missing/unresolved
   * profile is surfaced as an error instead of falling through to "no auth").
   * The returned promise is stored and awaited on the first request.
   */
  private async _resolveDefaultCredentials(profile?: string): Promise<void> {
    try {
      const result = await defaultCredentials(this._credentialResolverOptions(), profile);
      if (result) {
        this._authState.provider = result.provider;
        this._authState.tokenCache = this._makeTokenCache(result.provider);
        this._authState.extraHeaders = result.extraHeaders;
        this._applyCredentialBaseURL(result.baseURL);
      } else if (profile != null) {
        throw new Errors.AnthropicError(
          `Profile "${profile}" could not be resolved (no <config_dir>/configs/${profile}.json found).`,
        );
      }
    } catch (err) {
      this._authState.error = err;
    } finally {
      this._authState.resolution = null;
    }
  }

  /**
   * Check whether the base URL is set to its default.
   *
   * A profile-supplied `base_url` counts as an override here: a profile that
   * pins a non-default host is declaring "this whole client targets deployment
   * X", so per-endpoint {@link RequestOptions.defaultBaseURL} hints must not
   * silently route individual calls back to production. No generated resource
   * currently sets `defaultBaseURL`, so this is documenting intent for when
   * one does.
   */
  #baseURLOverridden(): boolean {
    return this.baseURL !== 'https://api.anthropic.com';
  }

  protected defaultQuery(): Record<string, string | undefined> | undefined {
    return this._options.defaultQuery;
  }

  protected validateHeaders({ values, nulls }: NullableHeaders) {
    if (values.get('x-api-key') || values.get('authorization')) {
      return;
    }
    if (this._authState.error) {
      throw this._authState.error;
    }
    if (this._authState.tokenCache || this._authState.resolution) {
      return; // auth will be injected per-request via authHeaders
    }

    if (this.apiKey && values.get('x-api-key')) {
      return;
    }
    if (nulls.has('x-api-key')) {
      return;
    }

    if (this.authToken && values.get('authorization')) {
      return;
    }
    if (nulls.has('authorization')) {
      return;
    }

    throw new Error(
      'Could not resolve authentication method. Expected one of apiKey, authToken, credentials, config, or profile to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted',
    );
  }

  private _authFlags(opts: FinalRequestOptions): RequestAuthFlags {
    let flags = this._requestAuthFlags.get(opts);
    if (!flags) {
      flags = { usedTokenCache: false, didRefreshFor401: false };
      this._requestAuthFlags.set(opts, flags);
    }
    return flags;
  }

  protected async authHeaders(opts: FinalRequestOptions): Promise<NullableHeaders | undefined> {
    // Wait for lazy credential resolution if it's in progress. If it failed,
    // return no auth headers — validateHeaders surfaces the stored error
    // after the explicit-header escape hatch has had a chance to apply.
    if (this._authState.resolution) {
      await this._authState.resolution;
    }
    if (this._authState.error) {
      return undefined;
    }
    // If we have a token cache and no API key is set, use token auth
    if (this._authState.tokenCache && this.apiKey == null) {
      const token = await this._authState.tokenCache.getToken();
      this._authFlags(opts).usedTokenCache = true;
      return buildHeaders([{ Authorization: `Bearer ${token}` }]);
    }
    return buildHeaders([await this.apiKeyAuth(opts), await this.bearerAuth(opts)]);
  }

  protected async apiKeyAuth(opts: FinalRequestOptions): Promise<NullableHeaders | undefined> {
    if (this.apiKey == null) {
      return undefined;
    }
    return buildHeaders([{ 'X-Api-Key': this.apiKey }]);
  }

  protected async bearerAuth(opts: FinalRequestOptions): Promise<NullableHeaders | undefined> {
    if (this.authToken == null) {
      return undefined;
    }
    return buildHeaders([{ Authorization: `Bearer ${this.authToken}` }]);
  }

  protected stringifyQuery(query: object | Record<string, unknown>): string {
    return stringifyQuery(query);
  }

  private getUserAgent(): string {
    return `${this.constructor.name}/JS ${VERSION}`;
  }

  protected defaultIdempotencyKey(): string {
    return `stainless-node-retry-${uuid4()}`;
  }

  protected makeStatusError(
    status: number,
    error: Object,
    message: string | undefined,
    headers: Headers,
  ): Errors.APIError {
    return Errors.APIError.generate(status, error, message, headers);
  }

  buildURL(
    path: string,
    query: Record<string, unknown> | null | undefined,
    defaultBaseURL?: string | undefined,
  ): string {
    const baseURL = (!this.#baseURLOverridden() && defaultBaseURL) || this.baseURL;
    const url =
      isAbsoluteURL(path) ?
        new URL(path)
      : new URL(baseURL + (baseURL.endsWith('/') && path.startsWith('/') ? path.slice(1) : path));

    const defaultQuery = this.defaultQuery();
    const pathQuery = Object.fromEntries(url.searchParams);
    if (!isEmptyObj(defaultQuery) || !isEmptyObj(pathQuery)) {
      query = { ...pathQuery, ...defaultQuery, ...query };
    }

    if (typeof query === 'object' && query && !Array.isArray(query)) {
      url.search = this.stringifyQuery(query);
    }

    return url.toString();
  }

  _calculateNonstreamingTimeout(maxTokens: number): number {
    const defaultTimeout = 10 * 60;
    const expectedTimeout = (60 * 60 * maxTokens) / 128_000;
    if (expectedTimeout > defaultTimeout) {
      throw new Errors.AnthropicError(
        'Streaming is required for operations that may take longer than 10 minutes. ' +
          'See https://github.com/anthropics/anthropic-sdk-typescript#streaming-responses for more details',
      );
    }
    return defaultTimeout * 1000;
  }

  /**
   * Used as a callback for mutating the given `FinalRequestOptions` object.
   */
  protected async prepareOptions(options: FinalRequestOptions): Promise<void> {}

  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  protected async prepareRequest(
    request: RequestInit,
    { url, options }: { url: string; options: FinalRequestOptions },
  ): Promise<void> {
    // Append auth-derived headers when using token auth. Done here (after all
    // header merging) rather than in authHeaders() so we append to any existing
    // anthropic-beta values instead of being overwritten by later header sources.
    if (this._authState.tokenCache && this.apiKey == null) {
      // Normalize to a Headers instance — custom fetch impls or polyfills can
      // hand back arrays / plain objects, and silently dropping the beta
      // header in that case would surface as a confusing server-side 4xx.
      const headers = request.headers instanceof Headers ? request.headers : new Headers(request.headers);
      for (const [k, v] of Object.entries(this._authState.extraHeaders)) {
        if (!headers.has(k)) headers.set(k, v);
      }
      const existing = headers
        .get('anthropic-beta')
        ?.split(',')
        .map((s) => s.trim());
      if (!existing?.includes(OAUTH_API_BETA_HEADER)) {
        headers.append('anthropic-beta', OAUTH_API_BETA_HEADER);
      }
      request.headers = headers;
    }
  }

  get<Rsp>(path: string, opts?: PromiseOrValue<RequestOptions>): APIPromise<Rsp> {
    return this.methodRequest('get', path, opts);
  }

  post<Rsp>(path: string, opts?: PromiseOrValue<RequestOptions>): APIPromise<Rsp> {
    return this.methodRequest('post', path, opts);
  }

  patch<Rsp>(path: string, opts?: PromiseOrValue<RequestOptions>): APIPromise<Rsp> {
    return this.methodRequest('patch', path, opts);
  }

  put<Rsp>(path: string, opts?: PromiseOrValue<RequestOptions>): APIPromise<Rsp> {
    return this.methodRequest('put', path, opts);
  }

  delete<Rsp>(path: string, opts?: PromiseOrValue<RequestOptions>): APIPromise<Rsp> {
    return this.methodRequest('delete', path, opts);
  }

  private methodRequest<Rsp>(
    method: HTTPMethod,
    path: string,
    opts?: PromiseOrValue<RequestOptions>,
  ): APIPromise<Rsp> {
    return this.request(
      Promise.resolve(opts).then((opts) => {
        return { method, path, ...opts };
      }),
    );
  }

  request<Rsp>(
    options: PromiseOrValue<FinalRequestOptions>,
    remainingRetries: number | null = null,
  ): APIPromise<Rsp> {
    return new APIPromise(this, this.makeRequest(options, remainingRetries, undefined));
  }

  private async makeRequest(
    optionsInput: PromiseOrValue<FinalRequestOptions>,
    retriesRemaining: number | null,
    retryOfRequestLogID: string | undefined,
  ): Promise<APIResponseProps> {
    const options = await optionsInput;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    if (retriesRemaining == null) {
      retriesRemaining = maxRetries;
      // Top-level call: reset per-request auth flags so a reused options object
      // (via client.request(opts)) doesn't carry stale 401-refresh state.
      this._requestAuthFlags.delete(options);
    }

    await this.prepareOptions(options);

    const { req, url, timeout } = await this.buildRequest(options, {
      retryCount: maxRetries - retriesRemaining,
    });

    await this.prepareRequest(req, { url, options });

    /** Not an API request ID, just for correlating local log entries. */
    const requestLogID = 'log_' + ((Math.random() * (1 << 24)) | 0).toString(16).padStart(6, '0');
    const retryLogStr = retryOfRequestLogID === undefined ? '' : `, retryOf: ${retryOfRequestLogID}`;
    const startTime = Date.now();

    loggerFor(this).debug(
      `[${requestLogID}] sending request`,
      formatRequestDetails({
        retryOfRequestLogID,
        method: options.method,
        url,
        options,
        headers: req.headers,
      }),
    );

    if (options.signal?.aborted) {
      throw new Errors.APIUserAbortError();
    }

    const controller = new AbortController();
    const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(castToError);
    const headersTime = Date.now();

    if (response instanceof globalThis.Error) {
      const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
      if (options.signal?.aborted) {
        throw new Errors.APIUserAbortError();
      }
      // detect native connection timeout errors
      // deno throws "TypeError: error sending request for url (https://example/): client error (Connect): tcp connect error: Operation timed out (os error 60): Operation timed out (os error 60)"
      // undici throws "TypeError: fetch failed" with cause "ConnectTimeoutError: Connect Timeout Error (attempted address: example:443, timeout: 1ms)"
      // others do not provide enough information to distinguish timeouts from other connection errors
      const isTimeout =
        isAbortError(response) ||
        /timed? ?out/i.test(String(response) + ('cause' in response ? String(response.cause) : ''));
      if (retriesRemaining) {
        loggerFor(this).info(
          `[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} - ${retryMessage}`,
        );
        loggerFor(this).debug(
          `[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} (${retryMessage})`,
          formatRequestDetails({
            retryOfRequestLogID,
            url,
            durationMs: headersTime - startTime,
            message: response.message,
          }),
        );
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID);
      }
      loggerFor(this).info(
        `[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} - error; no more retries left`,
      );
      loggerFor(this).debug(
        `[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} (error; no more retries left)`,
        formatRequestDetails({
          retryOfRequestLogID,
          url,
          durationMs: headersTime - startTime,
          message: response.message,
        }),
      );
      if (isTimeout) {
        throw new Errors.APIConnectionTimeoutError();
      }
      throw new Errors.APIConnectionError({ cause: response });
    }

    const specialHeaders = [...response.headers.entries()]
      .filter(([name]) => name === 'request-id')
      .map(([name, value]) => ', ' + name + ': ' + JSON.stringify(value))
      .join('');
    const responseInfo = `[${requestLogID}${retryLogStr}${specialHeaders}] ${req.method} ${url} ${
      response.ok ? 'succeeded' : 'failed'
    } with status ${response.status} in ${headersTime - startTime}ms`;

    if (!response.ok) {
      const shouldRetry = await this.shouldRetry(response, options);
      if (retriesRemaining && shouldRetry) {
        const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;

        // We don't need the body of this response.
        await Shims.CancelReadableStream(response.body);
        loggerFor(this).info(`${responseInfo} - ${retryMessage}`);
        loggerFor(this).debug(
          `[${requestLogID}] response error (${retryMessage})`,
          formatRequestDetails({
            retryOfRequestLogID,
            url: response.url,
            status: response.status,
            headers: response.headers,
            durationMs: headersTime - startTime,
          }),
        );
        return this.retryRequest(
          options,
          retriesRemaining,
          retryOfRequestLogID ?? requestLogID,
          response.headers,
        );
      }

      const retryMessage = shouldRetry ? `error; no more retries left` : `error; not retryable`;

      loggerFor(this).info(`${responseInfo} - ${retryMessage}`);

      const errText = await response.text().catch((err: any) => castToError(err).message);
      const errJSON = safeJSON(errText) as any;
      const errMessage = errJSON ? undefined : errText;

      loggerFor(this).debug(
        `[${requestLogID}] response error (${retryMessage})`,
        formatRequestDetails({
          retryOfRequestLogID,
          url: response.url,
          status: response.status,
          headers: response.headers,
          message: errMessage,
          durationMs: Date.now() - startTime,
        }),
      );

      const err = this.makeStatusError(response.status, errJSON, errMessage, response.headers);
      throw err;
    }

    loggerFor(this).info(responseInfo);
    loggerFor(this).debug(
      `[${requestLogID}] response start`,
      formatRequestDetails({
        retryOfRequestLogID,
        url: response.url,
        status: response.status,
        headers: response.headers,
        durationMs: headersTime - startTime,
      }),
    );

    return { response, options, controller, requestLogID, retryOfRequestLogID, startTime };
  }

  getAPIList<Item, PageClass extends Pagination.AbstractPage<Item> = Pagination.AbstractPage<Item>>(
    path: string,
    Page: new (...args: any[]) => PageClass,
    opts?: PromiseOrValue<RequestOptions>,
  ): Pagination.PagePromise<PageClass, Item> {
    return this.requestAPIList(
      Page,
      opts && 'then' in opts ?
        opts.then((opts) => ({ method: 'get', path, ...opts }))
      : { method: 'get', path, ...opts },
    );
  }

  requestAPIList<
    Item = unknown,
    PageClass extends Pagination.AbstractPage<Item> = Pagination.AbstractPage<Item>,
  >(
    Page: new (...args: ConstructorParameters<typeof Pagination.AbstractPage>) => PageClass,
    options: PromiseOrValue<FinalRequestOptions>,
  ): Pagination.PagePromise<PageClass, Item> {
    const request = this.makeRequest(options, null, undefined);
    return new Pagination.PagePromise<PageClass, Item>(this as any as Anthropic, request, Page);
  }

  async fetchWithTimeout(
    url: RequestInfo,
    init: RequestInit | undefined,
    ms: number,
    controller: AbortController,
  ): Promise<Response> {
    const { signal, method, ...options } = init || {};
    // Avoid creating a closure over `this`, `init`, or `options` to prevent memory leaks.
    // An arrow function like `() => controller.abort()` captures the surrounding scope,
    // which includes the request body and other large objects. When the user passes a
    // long-lived AbortSignal, the listener prevents those objects from being GC'd for
    // the lifetime of the signal. Using `.bind()` only retains a reference to the
    // controller itself.
    const abort = this._makeAbort(controller);
    if (signal) signal.addEventListener('abort', abort, { once: true });

    const timeout = setTimeout(abort, ms);

    const isReadableBody =
      ((globalThis as any).ReadableStream && options.body instanceof (globalThis as any).ReadableStream) ||
      (typeof options.body === 'object' && options.body !== null && Symbol.asyncIterator in options.body);

    const fetchOptions: RequestInit = {
      signal: controller.signal as any,
      ...(isReadableBody ? { duplex: 'half' } : {}),
      method: 'GET',
      ...options,
    };
    if (method) {
      // Custom methods like 'patch' need to be uppercased
      // See https://github.com/nodejs/undici/issues/2294
      fetchOptions.method = method.toUpperCase();
    }

    try {
      // use undefined this binding; fetch errors if bound to something else in browser/cloudflare
      return await this.fetch.call(undefined, url, fetchOptions);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async shouldRetry(response: Response, options: FinalRequestOptions): Promise<boolean> {
    // Reactive refresh: on a 401 from a request that used the token cache,
    // invalidate and retry once. Only fires when this specific request was
    // bearer-authenticated (not when an apiKey was used) and only once per
    // request — a second 401 after refresh falls through to the normal
    // retry policy below (which treats 4xx as non-retryable).
    const flags = this._authFlags(options);
    if (
      response.status === 401 &&
      this._authState.tokenCache &&
      flags.usedTokenCache &&
      !flags.didRefreshFor401
    ) {
      flags.didRefreshFor401 = true;
      this._authState.tokenCache.invalidate();
      return true;
    }

    // Note this is not a standard header.
    const shouldRetryHeader = response.headers.get('x-should-retry');

    // If the server explicitly says whether or not to retry, obey.
    if (shouldRetryHeader === 'true') return true;
    if (shouldRetryHeader === 'false') return false;

    // Retry on request timeouts.
    if (response.status === 408) return true;

    // Retry on lock timeouts.
    if (response.status === 409) return true;

    // Retry on rate limits.
    if (response.status === 429) return true;

    // Retry internal errors.
    if (response.status >= 500) return true;

    return false;
  }

  private async retryRequest(
    options: FinalRequestOptions,
    retriesRemaining: number,
    requestLogID: string,
    responseHeaders?: Headers | undefined,
  ): Promise<APIResponseProps> {
    let timeoutMillis: number | undefined;

    // Note the `retry-after-ms` header may not be standard, but is a good idea and we'd like proactive support for it.
    const retryAfterMillisHeader = responseHeaders?.get('retry-after-ms');
    if (retryAfterMillisHeader) {
      const timeoutMs = parseFloat(retryAfterMillisHeader);
      if (!Number.isNaN(timeoutMs)) {
        timeoutMillis = timeoutMs;
      }
    }

    // About the Retry-After header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
    const retryAfterHeader = responseHeaders?.get('retry-after');
    if (retryAfterHeader && !timeoutMillis) {
      const timeoutSeconds = parseFloat(retryAfterHeader);
      if (!Number.isNaN(timeoutSeconds)) {
        timeoutMillis = timeoutSeconds * 1000;
      } else {
        timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
      }
    }

    // If the API asks us to wait a certain amount of time, just do what it
    // says, but otherwise calculate a default
    if (timeoutMillis === undefined) {
      const maxRetries = options.maxRetries ?? this.maxRetries;
      timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
    }
    await sleep(timeoutMillis);

    return this.makeRequest(options, retriesRemaining - 1, requestLogID);
  }

  private calculateDefaultRetryTimeoutMillis(retriesRemaining: number, maxRetries: number): number {
    const initialRetryDelay = 0.5;
    const maxRetryDelay = 8.0;

    const numRetries = maxRetries - retriesRemaining;

    // Apply exponential backoff, but not more than the max.
    const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);

    // Apply some jitter, take up to at most 25 percent of the retry time.
    const jitter = 1 - Math.random() * 0.25;

    return sleepSeconds * jitter * 1000;
  }

  public calculateNonstreamingTimeout(maxTokens: number, maxNonstreamingTokens?: number): number {
    const maxTime = 60 * 60 * 1000; // 60 minutes
    const defaultTime = 60 * 10 * 1000; // 10 minutes

    const expectedTime = (maxTime * maxTokens) / 128000;
    if (expectedTime > defaultTime || (maxNonstreamingTokens != null && maxTokens > maxNonstreamingTokens)) {
      throw new Errors.AnthropicError(
        'Streaming is required for operations that may take longer than 10 minutes. See https://github.com/anthropics/anthropic-sdk-typescript#long-requests for more details',
      );
    }

    return defaultTime;
  }

  async buildRequest(
    inputOptions: FinalRequestOptions,
    { retryCount = 0 }: { retryCount?: number } = {},
  ): Promise<{ req: FinalizedRequestInit; url: string; timeout: number }> {
    const options = { ...inputOptions };
    const { method, path, query, defaultBaseURL } = options;

    // Lazy credential resolution may carry a profile-supplied baseURL. Await
    // it before building the request URL so the very first request — and
    // requests on withOptions() clones created before resolution settled —
    // hit the profile's host rather than the hardcoded default.
    if (this._authState.resolution) {
      await this._authState.resolution;
    }
    if (!this._baseURLIsExplicit && this._authState.baseURL && this.baseURL !== this._authState.baseURL) {
      this.baseURL = this._authState.baseURL;
    }

    const url = this.buildURL(path!, query as Record<string, unknown>, defaultBaseURL);
    if ('timeout' in options) validatePositiveInteger('timeout', options.timeout);
    options.timeout = options.timeout ?? this.timeout;
    const { bodyHeaders, body } = this.buildBody({ options });
    const reqHeaders = await this.buildHeaders({ options: inputOptions, method, bodyHeaders, retryCount });

    const req: FinalizedRequestInit = {
      method,
      headers: reqHeaders,
      ...(options.signal && { signal: options.signal }),
      ...((globalThis as any).ReadableStream &&
        body instanceof (globalThis as any).ReadableStream && { duplex: 'half' }),
      ...(body && { body }),
      ...((this.fetchOptions as any) ?? {}),
      ...((options.fetchOptions as any) ?? {}),
    };

    return { req, url, timeout: options.timeout };
  }

  private async buildHeaders({
    options,
    method,
    bodyHeaders,
    retryCount,
  }: {
    options: FinalRequestOptions;
    method: HTTPMethod;
    bodyHeaders: HeadersLike;
    retryCount: number;
  }): Promise<Headers> {
    let idempotencyHeaders: HeadersLike = {};
    if (this.idempotencyHeader && method !== 'get') {
      if (!options.idempotencyKey) options.idempotencyKey = this.defaultIdempotencyKey();
      idempotencyHeaders[this.idempotencyHeader] = options.idempotencyKey;
    }

    const headers = buildHeaders([
      idempotencyHeaders,
      {
        Accept: 'application/json',
        'User-Agent': this.getUserAgent(),
        'X-Stainless-Retry-Count': String(retryCount),
        ...(options.timeout ? { 'X-Stainless-Timeout': String(Math.trunc(options.timeout / 1000)) } : {}),
        ...getPlatformHeaders(),
        ...(this._options.dangerouslyAllowBrowser ?
          { 'anthropic-dangerous-direct-browser-access': 'true' }
        : undefined),
        'anthropic-version': '2023-06-01',
      },
      await this.authHeaders(options),
      this._options.defaultHeaders,
      bodyHeaders,
      options.headers,
    ]);

    this.validateHeaders(headers);

    return headers.values;
  }

  private _makeAbort(controller: AbortController) {
    // note: we can't just inline this method inside `fetchWithTimeout()` because then the closure
    //       would capture all request options, and cause a memory leak.
    return () => controller.abort();
  }

  private buildBody({ options: { body, headers: rawHeaders } }: { options: FinalRequestOptions }): {
    bodyHeaders: HeadersLike;
    body: BodyInit | undefined;
  } {
    if (!body) {
      return { bodyHeaders: undefined, body: undefined };
    }
    const headers = buildHeaders([rawHeaders]);
    if (
      // Pass raw type verbatim
      ArrayBuffer.isView(body) ||
      body instanceof ArrayBuffer ||
      body instanceof DataView ||
      (typeof body === 'string' &&
        // Preserve legacy string encoding behavior for now
        headers.values.has('content-type')) ||
      // `Blob` is superset of `File`
      ((globalThis as any).Blob && body instanceof (globalThis as any).Blob) ||
      // `FormData` -> `multipart/form-data`
      body instanceof FormData ||
      // `URLSearchParams` -> `application/x-www-form-urlencoded`
      body instanceof URLSearchParams ||
      // Send chunked stream (each chunk has own `length`)
      ((globalThis as any).ReadableStream && body instanceof (globalThis as any).ReadableStream)
    ) {
      return { bodyHeaders: undefined, body: body as BodyInit };
    } else if (
      typeof body === 'object' &&
      (Symbol.asyncIterator in body ||
        (Symbol.iterator in body && 'next' in body && typeof body.next === 'function'))
    ) {
      return { bodyHeaders: undefined, body: Shims.ReadableStreamFrom(body as AsyncIterable<Uint8Array>) };
    } else if (
      typeof body === 'object' &&
      headers.values.get('content-type') === 'application/x-www-form-urlencoded'
    ) {
      return {
        bodyHeaders: { 'content-type': 'application/x-www-form-urlencoded' },
        body: this.stringifyQuery(body),
      };
    } else {
      return this.#encoder({ body, headers });
    }
  }

  static Anthropic = this;
  static HUMAN_PROMPT = HUMAN_PROMPT;
  static AI_PROMPT = AI_PROMPT;
  static DEFAULT_TIMEOUT = 600000; // 10 minutes

  static AnthropicError = Errors.AnthropicError;
  static APIError = Errors.APIError;
  static APIConnectionError = Errors.APIConnectionError;
  static APIConnectionTimeoutError = Errors.APIConnectionTimeoutError;
  static APIUserAbortError = Errors.APIUserAbortError;
  static NotFoundError = Errors.NotFoundError;
  static ConflictError = Errors.ConflictError;
  static RateLimitError = Errors.RateLimitError;
  static BadRequestError = Errors.BadRequestError;
  static AuthenticationError = Errors.AuthenticationError;
  static InternalServerError = Errors.InternalServerError;
  static PermissionDeniedError = Errors.PermissionDeniedError;
  static UnprocessableEntityError = Errors.UnprocessableEntityError;

  static toFile = Uploads.toFile;
}

/**
 * API Client for interfacing with the Anthropic API.
 */
export class Anthropic extends BaseAnthropic {
  completions: API.Completions = new API.Completions(this);
  messages: API.Messages = new API.Messages(this);
  models: API.Models = new API.Models(this);
  beta: API.Beta = new API.Beta(this);
}

Anthropic.Completions = Completions;
Anthropic.Messages = Messages;
Anthropic.Models = Models;
Anthropic.Beta = Beta;

export declare namespace Anthropic {
  export type RequestOptions = Opts.RequestOptions;

  export type { ApiKeySetter };

  export import Page = Pagination.Page;
  export { type PageParams as PageParams, type PageResponse as PageResponse };

  export import TokenPage = Pagination.TokenPage;
  export { type TokenPageParams as TokenPageParams, type TokenPageResponse as TokenPageResponse };

  export import PageCursor = Pagination.PageCursor;
  export { type PageCursorParams as PageCursorParams, type PageCursorResponse as PageCursorResponse };

  export {
    Completions as Completions,
    type Completion as Completion,
    type CompletionCreateParams as CompletionCreateParams,
    type CompletionCreateParamsNonStreaming as CompletionCreateParamsNonStreaming,
    type CompletionCreateParamsStreaming as CompletionCreateParamsStreaming,
  };

  export {
    Messages as Messages,
    type Base64ImageSource as Base64ImageSource,
    type Base64PDFSource as Base64PDFSource,
    type BashCodeExecutionOutputBlock as BashCodeExecutionOutputBlock,
    type BashCodeExecutionOutputBlockParam as BashCodeExecutionOutputBlockParam,
    type BashCodeExecutionResultBlock as BashCodeExecutionResultBlock,
    type BashCodeExecutionResultBlockParam as BashCodeExecutionResultBlockParam,
    type BashCodeExecutionToolResultBlock as BashCodeExecutionToolResultBlock,
    type BashCodeExecutionToolResultBlockParam as BashCodeExecutionToolResultBlockParam,
    type BashCodeExecutionToolResultError as BashCodeExecutionToolResultError,
    type BashCodeExecutionToolResultErrorCode as BashCodeExecutionToolResultErrorCode,
    type BashCodeExecutionToolResultErrorParam as BashCodeExecutionToolResultErrorParam,
    type CacheControlEphemeral as CacheControlEphemeral,
    type CacheCreation as CacheCreation,
    type CitationCharLocation as CitationCharLocation,
    type CitationCharLocationParam as CitationCharLocationParam,
    type CitationContentBlockLocation as CitationContentBlockLocation,
    type CitationContentBlockLocationParam as CitationContentBlockLocationParam,
    type CitationPageLocation as CitationPageLocation,
    type CitationPageLocationParam as CitationPageLocationParam,
    type CitationSearchResultLocationParam as CitationSearchResultLocationParam,
    type CitationWebSearchResultLocationParam as CitationWebSearchResultLocationParam,
    type CitationsConfig as CitationsConfig,
    type CitationsConfigParam as CitationsConfigParam,
    type CitationsDelta as CitationsDelta,
    type CitationsSearchResultLocation as CitationsSearchResultLocation,
    type CitationsWebSearchResultLocation as CitationsWebSearchResultLocation,
    type CodeExecutionOutputBlock as CodeExecutionOutputBlock,
    type CodeExecutionOutputBlockParam as CodeExecutionOutputBlockParam,
    type CodeExecutionResultBlock as CodeExecutionResultBlock,
    type CodeExecutionResultBlockParam as CodeExecutionResultBlockParam,
    type CodeExecutionTool20250522 as CodeExecutionTool20250522,
    type CodeExecutionTool20250825 as CodeExecutionTool20250825,
    type CodeExecutionTool20260120 as CodeExecutionTool20260120,
    type CodeExecutionToolResultBlock as CodeExecutionToolResultBlock,
    type CodeExecutionToolResultBlockContent as CodeExecutionToolResultBlockContent,
    type CodeExecutionToolResultBlockParam as CodeExecutionToolResultBlockParam,
    type CodeExecutionToolResultBlockParamContent as CodeExecutionToolResultBlockParamContent,
    type CodeExecutionToolResultError as CodeExecutionToolResultError,
    type CodeExecutionToolResultErrorCode as CodeExecutionToolResultErrorCode,
    type CodeExecutionToolResultErrorParam as CodeExecutionToolResultErrorParam,
    type Container as Container,
    type ContainerUploadBlock as ContainerUploadBlock,
    type ContainerUploadBlockParam as ContainerUploadBlockParam,
    type ContentBlock as ContentBlock,
    type ContentBlockDeltaEvent as ContentBlockDeltaEvent,
    type ContentBlockParam as ContentBlockParam,
    type ContentBlockStartEvent as ContentBlockStartEvent,
    type ContentBlockStopEvent as ContentBlockStopEvent,
    type ContentBlockSource as ContentBlockSource,
    type ContentBlockSourceContent as ContentBlockSourceContent,
    type DirectCaller as DirectCaller,
    type DocumentBlock as DocumentBlock,
    type DocumentBlockParam as DocumentBlockParam,
    type EncryptedCodeExecutionResultBlock as EncryptedCodeExecutionResultBlock,
    type EncryptedCodeExecutionResultBlockParam as EncryptedCodeExecutionResultBlockParam,
    type ImageBlockParam as ImageBlockParam,
    type InputJSONDelta as InputJSONDelta,
    type JSONOutputFormat as JSONOutputFormat,
    type MemoryTool20250818 as MemoryTool20250818,
    type Message as Message,
    type MessageCountTokensTool as MessageCountTokensTool,
    type MessageDeltaEvent as MessageDeltaEvent,
    type MessageDeltaUsage as MessageDeltaUsage,
    type MessageParam as MessageParam,
    type MessageStartEvent as MessageStartEvent,
    type MessageStopEvent as MessageStopEvent,
    type MessageStreamEvent as MessageStreamEvent,
    type MessageTokensCount as MessageTokensCount,
    type Metadata as Metadata,
    type Model as Model,
    type OutputConfig as OutputConfig,
    type PlainTextSource as PlainTextSource,
    type RawContentBlockDelta as RawContentBlockDelta,
    type RawContentBlockDeltaEvent as RawContentBlockDeltaEvent,
    type RawContentBlockStartEvent as RawContentBlockStartEvent,
    type RawContentBlockStopEvent as RawContentBlockStopEvent,
    type RawMessageDeltaEvent as RawMessageDeltaEvent,
    type RawMessageStartEvent as RawMessageStartEvent,
    type RawMessageStopEvent as RawMessageStopEvent,
    type RawMessageStreamEvent as RawMessageStreamEvent,
    type RedactedThinkingBlock as RedactedThinkingBlock,
    type RedactedThinkingBlockParam as RedactedThinkingBlockParam,
    type RefusalStopDetails as RefusalStopDetails,
    type SearchResultBlockParam as SearchResultBlockParam,
    type ServerToolCaller as ServerToolCaller,
    type ServerToolCaller20260120 as ServerToolCaller20260120,
    type ServerToolUsage as ServerToolUsage,
    type ServerToolUseBlock as ServerToolUseBlock,
    type ServerToolUseBlockParam as ServerToolUseBlockParam,
    type SignatureDelta as SignatureDelta,
    type StopReason as StopReason,
    type TextBlock as TextBlock,
    type TextBlockParam as TextBlockParam,
    type TextCitation as TextCitation,
    type TextCitationParam as TextCitationParam,
    type TextDelta as TextDelta,
    type TextEditorCodeExecutionCreateResultBlock as TextEditorCodeExecutionCreateResultBlock,
    type TextEditorCodeExecutionCreateResultBlockParam as TextEditorCodeExecutionCreateResultBlockParam,
    type TextEditorCodeExecutionStrReplaceResultBlock as TextEditorCodeExecutionStrReplaceResultBlock,
    type TextEditorCodeExecutionStrReplaceResultBlockParam as TextEditorCodeExecutionStrReplaceResultBlockParam,
    type TextEditorCodeExecutionToolResultBlock as TextEditorCodeExecutionToolResultBlock,
    type TextEditorCodeExecutionToolResultBlockParam as TextEditorCodeExecutionToolResultBlockParam,
    type TextEditorCodeExecutionToolResultError as TextEditorCodeExecutionToolResultError,
    type TextEditorCodeExecutionToolResultErrorCode as TextEditorCodeExecutionToolResultErrorCode,
    type TextEditorCodeExecutionToolResultErrorParam as TextEditorCodeExecutionToolResultErrorParam,
    type TextEditorCodeExecutionViewResultBlock as TextEditorCodeExecutionViewResultBlock,
    type TextEditorCodeExecutionViewResultBlockParam as TextEditorCodeExecutionViewResultBlockParam,
    type ThinkingBlock as ThinkingBlock,
    type ThinkingBlockParam as ThinkingBlockParam,
    type ThinkingConfigAdaptive as ThinkingConfigAdaptive,
    type ThinkingConfigDisabled as ThinkingConfigDisabled,
    type ThinkingConfigEnabled as ThinkingConfigEnabled,
    type ThinkingConfigParam as ThinkingConfigParam,
    type ThinkingDelta as ThinkingDelta,
    type Tool as Tool,
    type ToolBash20250124 as ToolBash20250124,
    type ToolChoice as ToolChoice,
    type ToolChoiceAny as ToolChoiceAny,
    type ToolChoiceAuto as ToolChoiceAuto,
    type ToolChoiceNone as ToolChoiceNone,
    type ToolChoiceTool as ToolChoiceTool,
    type ToolReferenceBlock as ToolReferenceBlock,
    type ToolReferenceBlockParam as ToolReferenceBlockParam,
    type ToolResultBlockParam as ToolResultBlockParam,
    type ToolSearchToolBm25_20251119 as ToolSearchToolBm25_20251119,
    type ToolSearchToolRegex20251119 as ToolSearchToolRegex20251119,
    type ToolSearchToolResultBlock as ToolSearchToolResultBlock,
    type ToolSearchToolResultBlockParam as ToolSearchToolResultBlockParam,
    type ToolSearchToolResultError as ToolSearchToolResultError,
    type ToolSearchToolResultErrorCode as ToolSearchToolResultErrorCode,
    type ToolSearchToolResultErrorParam as ToolSearchToolResultErrorParam,
    type ToolSearchToolSearchResultBlock as ToolSearchToolSearchResultBlock,
    type ToolSearchToolSearchResultBlockParam as ToolSearchToolSearchResultBlockParam,
    type ToolTextEditor20250124 as ToolTextEditor20250124,
    type ToolTextEditor20250429 as ToolTextEditor20250429,
    type ToolTextEditor20250728 as ToolTextEditor20250728,
    type ToolUnion as ToolUnion,
    type ToolUseBlock as ToolUseBlock,
    type ToolUseBlockParam as ToolUseBlockParam,
    type URLImageSource as URLImageSource,
    type URLPDFSource as URLPDFSource,
    type Usage as Usage,
    type UserLocation as UserLocation,
    type WebFetchBlock as WebFetchBlock,
    type WebFetchBlockParam as WebFetchBlockParam,
    type WebFetchTool20250910 as WebFetchTool20250910,
    type WebFetchTool20260209 as WebFetchTool20260209,
    type WebFetchTool20260309 as WebFetchTool20260309,
    type WebFetchToolResultBlock as WebFetchToolResultBlock,
    type WebFetchToolResultBlockParam as WebFetchToolResultBlockParam,
    type WebFetchToolResultErrorBlock as WebFetchToolResultErrorBlock,
    type WebFetchToolResultErrorBlockParam as WebFetchToolResultErrorBlockParam,
    type WebFetchToolResultErrorCode as WebFetchToolResultErrorCode,
    type WebSearchResultBlock as WebSearchResultBlock,
    type WebSearchResultBlockParam as WebSearchResultBlockParam,
    type WebSearchTool20250305 as WebSearchTool20250305,
    type WebSearchTool20260209 as WebSearchTool20260209,
    type WebSearchToolRequestError as WebSearchToolRequestError,
    type WebSearchToolResultBlock as WebSearchToolResultBlock,
    type WebSearchToolResultBlockContent as WebSearchToolResultBlockContent,
    type WebSearchToolResultBlockParam as WebSearchToolResultBlockParam,
    type WebSearchToolResultBlockParamContent as WebSearchToolResultBlockParamContent,
    type WebSearchToolResultError as WebSearchToolResultError,
    type WebSearchToolResultErrorCode as WebSearchToolResultErrorCode,
    type MessageCreateParams as MessageCreateParams,
    type MessageCreateParamsNonStreaming as MessageCreateParamsNonStreaming,
    type MessageCreateParamsStreaming as MessageCreateParamsStreaming,
    type MessageStreamParams as MessageStreamParams,
    type MessageCountTokensParams as MessageCountTokensParams,
  };

  export {
    Models as Models,
    type CapabilitySupport as CapabilitySupport,
    type ContextManagementCapability as ContextManagementCapability,
    type EffortCapability as EffortCapability,
    type ModelCapabilities as ModelCapabilities,
    type ModelInfo as ModelInfo,
    type ThinkingCapability as ThinkingCapability,
    type ThinkingTypes as ThinkingTypes,
    type ModelInfosPage as ModelInfosPage,
    type ModelRetrieveParams as ModelRetrieveParams,
    type ModelListParams as ModelListParams,
  };

  export {
    Beta as Beta,
    type AnthropicBeta as AnthropicBeta,
    type BetaAPIError as BetaAPIError,
    type BetaAuthenticationError as BetaAuthenticationError,
    type BetaBillingError as BetaBillingError,
    type BetaError as BetaError,
    type BetaErrorResponse as BetaErrorResponse,
    type BetaGatewayTimeoutError as BetaGatewayTimeoutError,
    type BetaInvalidRequestError as BetaInvalidRequestError,
    type BetaNotFoundError as BetaNotFoundError,
    type BetaOverloadedError as BetaOverloadedError,
    type BetaPermissionError as BetaPermissionError,
    type BetaRateLimitError as BetaRateLimitError,
  };

  export type APIErrorObject = API.APIErrorObject;
  export type AuthenticationError = API.AuthenticationError;
  export type BillingError = API.BillingError;
  export type ErrorObject = API.ErrorObject;
  export type ErrorResponse = API.ErrorResponse;
  export type ErrorType = API.ErrorType;
  export type GatewayTimeoutError = API.GatewayTimeoutError;
  export type InvalidRequestError = API.InvalidRequestError;
  export type NotFoundError = API.NotFoundError;
  export type OverloadedError = API.OverloadedError;
  export type PermissionError = API.PermissionError;
  export type RateLimitError = API.RateLimitError;
}
