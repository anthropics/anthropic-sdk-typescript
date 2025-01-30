// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import type { RequestInit, RequestInfo, BodyInit } from './internal/builtin-types';
import type { HTTPMethod, PromiseOrValue, MergedRequestInit } from './internal/types';
import { uuid4 } from './internal/utils/uuid';
import { validatePositiveInteger, isAbsoluteURL } from './internal/utils/values';
import { sleep } from './internal/utils/sleep';
import { castToError, isAbortError } from './internal/errors';
import type { APIResponseProps } from './internal/parse';
import { getPlatformHeaders } from './internal/detect-platform';
import * as Shims from './internal/shims';
import * as Opts from './internal/request-options';
import { VERSION } from './version';
import * as Errors from './error';
import * as Pagination from './pagination';
import { AbstractPage, type PageParams, PageResponse } from './pagination';
import * as Uploads from './uploads';
import * as API from './resources/index';
import { APIPromise } from './api-promise';
import { type Fetch } from './internal/builtin-types';
import { isRunningInBrowser } from './internal/detect-platform';
import { HeadersLike, NullableHeaders, buildHeaders, isEmptyHeaders } from './internal/headers';
import { FinalRequestOptions, RequestOptions } from './internal/request-options';
import {
  Completion,
  CompletionCreateParams,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  Completions,
} from './resources/completions';
import { ModelInfo, ModelInfosPage, ModelListParams, Models } from './resources/models';
import { readEnv } from './internal/utils/env';
import { logger } from './internal/utils/log';
import { isEmptyObj } from './internal/utils/values';
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
  Base64PDFSource,
  CacheControlEphemeral,
  CitationCharLocation,
  CitationCharLocationParam,
  CitationContentBlockLocation,
  CitationContentBlockLocationParam,
  CitationPageLocation,
  CitationPageLocationParam,
  CitationsConfigParam,
  CitationsDelta,
  ContentBlock,
  ContentBlockDeltaEvent,
  ContentBlockParam,
  ContentBlockStartEvent,
  ContentBlockStopEvent,
  ContentBlockSource,
  ContentBlockSourceContent,
  DocumentBlockParam,
  ImageBlockParam,
  InputJSONDelta,
  Message,
  MessageStreamParams,
  MessageCountTokensParams,
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
  PlainTextSource,
  RawContentBlockDeltaEvent,
  RawContentBlockStartEvent,
  RawContentBlockStopEvent,
  RawMessageDeltaEvent,
  RawMessageStartEvent,
  RawMessageStopEvent,
  RawMessageStreamEvent,
  TextBlock,
  TextBlockParam,
  TextCitation,
  TextCitationParam,
  TextDelta,
  Tool,
  ToolChoice,
  ToolChoiceAny,
  ToolChoiceAuto,
  ToolChoiceTool,
  ToolResultBlockParam,
  ToolUseBlock,
  ToolUseBlockParam,
  Usage,
} from './resources/messages/messages';

const safeJSON = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    return undefined;
  }
};

type LogFn = (message: string, ...rest: unknown[]) => void;
export type Logger = {
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  debug: LogFn;
};
export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';
const isLogLevel = (key: string | undefined): key is LogLevel => {
  const levels: Record<LogLevel, true> = {
    off: true,
    error: true,
    warn: true,
    info: true,
    debug: true,
  };
  return key! in levels;
};

export interface ClientOptions {
  /**
   * Defaults to process.env['ANTHROPIC_API_KEY'].
   */
  apiKey?: string | null | undefined;

  /**
   * Defaults to process.env['ANTHROPIC_AUTH_TOKEN'].
   */
  authToken?: string | null | undefined;

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
   * Defaults to process.env['ANTHROPIC_LOG'].
   */
  logLevel?: LogLevel | undefined | null;

  /**
   * Set the logger.
   *
   * Defaults to globalThis.console.
   */
  logger?: Logger | undefined | null;
}

type FinalizedRequestInit = RequestInit & { headers: Headers };

export class BaseAnthropic {
  apiKey: string | null;
  authToken: string | null;

  baseURL: string;
  maxRetries: number;
  timeout: number;
  logger: Logger | undefined;
  logLevel: LogLevel | undefined;
  fetchOptions: MergedRequestInit | undefined;

  private fetch: Fetch;
  #encoder: Opts.RequestEncoder;
  protected idempotencyHeader?: string;
  private _options: ClientOptions;

  /**
   * API Client for interfacing with the Anthropic API.
   *
   * @param {string | null | undefined} [opts.apiKey=process.env['ANTHROPIC_API_KEY'] ?? null]
   * @param {string | null | undefined} [opts.authToken=process.env['ANTHROPIC_AUTH_TOKEN'] ?? null]
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
    apiKey = readEnv('ANTHROPIC_API_KEY') ?? null,
    authToken = readEnv('ANTHROPIC_AUTH_TOKEN') ?? null,
    ...opts
  }: ClientOptions = {}) {
    const options: ClientOptions = {
      apiKey,
      authToken,
      ...opts,
      baseURL: baseURL || `https://api.anthropic.com`,
    };

    if (!options.dangerouslyAllowBrowser && isRunningInBrowser()) {
      throw new Errors.AnthropicError(
        "It looks like you're running in a browser-like environment.\n\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\nIf you understand the risks and have appropriate mitigations in place,\nyou can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\nnew Anthropic({ apiKey, dangerouslyAllowBrowser: true });\n",
      );
    }

    this.baseURL = options.baseURL!;
    this.timeout = options.timeout ?? Anthropic.DEFAULT_TIMEOUT /* 10 minutes */;
    this.logger = options.logger ?? console;
    if (options.logLevel != null) {
      this.logLevel = options.logLevel;
    } else {
      const envLevel = readEnv('ANTHROPIC_LOG');
      if (isLogLevel(envLevel)) {
        this.logLevel = envLevel;
      }
    }
    this.fetchOptions = options.fetchOptions;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetch = options.fetch ?? Shims.getDefaultFetch();
    this.#encoder = Opts.FallbackEncoder;

    this._options = options;

    this.apiKey = apiKey;
    this.authToken = authToken;
  }

  protected defaultQuery(): Record<string, string | undefined> | undefined {
    return this._options.defaultQuery;
  }

  protected validateHeaders({ values, nulls }: NullableHeaders) {
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
      'Could not resolve authentication method. Expected either apiKey or authToken to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted',
    );
  }

  protected authHeaders(opts: FinalRequestOptions): Headers | undefined {
    const apiKeyAuth = this.apiKeyAuth(opts);
    const bearerAuth = this.bearerAuth(opts);

    if (apiKeyAuth != null && !isEmptyHeaders(apiKeyAuth)) {
      return apiKeyAuth;
    }

    if (bearerAuth != null && !isEmptyHeaders(bearerAuth)) {
      return bearerAuth;
    }
    return undefined;
  }

  protected apiKeyAuth(opts: FinalRequestOptions): Headers | undefined {
    if (this.apiKey == null) {
      return undefined;
    }
    return new Headers({ 'X-Api-Key': this.apiKey });
  }

  protected bearerAuth(opts: FinalRequestOptions): Headers | undefined {
    if (this.authToken == null) {
      return undefined;
    }
    return new Headers({ Authorization: `Bearer ${this.authToken}` });
  }

  /**
   * Basic re-implementation of `qs.stringify` for primitive types.
   */
  protected stringifyQuery(query: Record<string, unknown>): string {
    return Object.entries(query)
      .filter(([_, value]) => typeof value !== 'undefined')
      .map(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }
        if (value === null) {
          return `${encodeURIComponent(key)}=`;
        }
        throw new Errors.AnthropicError(
          `Cannot stringify type ${typeof value}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`,
        );
      })
      .join('&');
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

  buildURL(path: string, query: Record<string, unknown> | null | undefined): string {
    const url =
      isAbsoluteURL(path) ?
        new URL(path)
      : new URL(this.baseURL + (this.baseURL.endsWith('/') && path.startsWith('/') ? path.slice(1) : path));

    const defaultQuery = this.defaultQuery();
    if (!isEmptyObj(defaultQuery)) {
      query = { ...defaultQuery, ...query };
    }

    if (typeof query === 'object' && query && !Array.isArray(query)) {
      url.search = this.stringifyQuery(query as Record<string, unknown>);
    }

    return url.toString();
  }

  private calculateContentLength(body: unknown): string | null {
    if (typeof body === 'string') {
      if (typeof (globalThis as any).Buffer !== 'undefined') {
        return (globalThis as any).Buffer.byteLength(body, 'utf8').toString();
      }

      if (typeof (globalThis as any).TextEncoder !== 'undefined') {
        const encoder = new (globalThis as any).TextEncoder();
        const encoded = encoder.encode(body);
        return encoded.length.toString();
      }
    } else if (ArrayBuffer.isView(body)) {
      return body.byteLength.toString();
    }

    return null;
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
  ): Promise<void> {}

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
    return new APIPromise(this, this.makeRequest(options, remainingRetries));
  }

  private async makeRequest(
    optionsInput: PromiseOrValue<FinalRequestOptions>,
    retriesRemaining: number | null,
  ): Promise<APIResponseProps> {
    const options = await optionsInput;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    if (retriesRemaining == null) {
      retriesRemaining = maxRetries;
    }

    await this.prepareOptions(options);

    const { req, url, timeout } = this.buildRequest(options, { retryCount: maxRetries - retriesRemaining });

    await this.prepareRequest(req, { url, options });

    logger(this).debug('request', url, options, req.headers);

    if (options.signal?.aborted) {
      throw new Errors.APIUserAbortError();
    }

    const controller = new AbortController();
    const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(castToError);

    if (response instanceof Error) {
      if (options.signal?.aborted) {
        throw new Errors.APIUserAbortError();
      }
      if (retriesRemaining) {
        return this.retryRequest(options, retriesRemaining);
      }
      if (isAbortError(response)) {
        throw new Errors.APIConnectionTimeoutError();
      }
      throw new Errors.APIConnectionError({ cause: response });
    }

    if (!response.ok) {
      if (retriesRemaining && this.shouldRetry(response)) {
        const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
        logger(this).debug(`response (error; ${retryMessage})`, response.status, url, response.headers);
        return this.retryRequest(options, retriesRemaining, response.headers);
      }

      const errText = await response.text().catch((err: any) => castToError(err).message);
      const errJSON = safeJSON(errText);
      const errMessage = errJSON ? undefined : errText;
      const retryMessage = retriesRemaining ? `(error; no more retries left)` : `(error; not retryable)`;

      logger(this).debug(
        `response (error; ${retryMessage})`,
        response.status,
        url,
        response.headers,
        errMessage,
      );

      const err = this.makeStatusError(response.status, errJSON, errMessage, response.headers);
      throw err;
    }

    return { response, options, controller };
  }

  getAPIList<Item, PageClass extends Pagination.AbstractPage<Item> = Pagination.AbstractPage<Item>>(
    path: string,
    Page: new (...args: any[]) => PageClass,
    opts?: RequestOptions,
  ): Pagination.PagePromise<PageClass, Item> {
    return this.requestAPIList(Page, { method: 'get', path, ...opts });
  }

  requestAPIList<
    Item = unknown,
    PageClass extends Pagination.AbstractPage<Item> = Pagination.AbstractPage<Item>,
  >(
    Page: new (...args: ConstructorParameters<typeof Pagination.AbstractPage>) => PageClass,
    options: FinalRequestOptions,
  ): Pagination.PagePromise<PageClass, Item> {
    const request = this.makeRequest(options, null);
    return new Pagination.PagePromise<PageClass, Item>(this as any as Anthropic, request, Page);
  }

  async fetchWithTimeout(
    url: RequestInfo,
    init: RequestInit | undefined,
    ms: number,
    controller: AbortController,
  ): Promise<Response> {
    const { signal, method, ...options } = init || {};
    if (signal) signal.addEventListener('abort', () => controller.abort());

    const timeout = setTimeout(() => controller.abort(), ms);

    const isReadableBody = Shims.isReadableLike(options.body);

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

    return (
      // use undefined this binding; fetch errors if bound to something else in browser/cloudflare
      this.fetch.call(undefined, url, fetchOptions).finally(() => {
        clearTimeout(timeout);
      })
    );
  }

  private shouldRetry(response: Response): boolean {
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

    // If the API asks us to wait a certain amount of time (and it's a reasonable amount),
    // just do what it says, but otherwise calculate a default
    if (!(timeoutMillis && 0 <= timeoutMillis && timeoutMillis < 60 * 1000)) {
      const maxRetries = options.maxRetries ?? this.maxRetries;
      timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
    }
    await sleep(timeoutMillis);

    return this.makeRequest(options, retriesRemaining - 1);
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

  buildRequest(
    options: FinalRequestOptions,
    { retryCount = 0 }: { retryCount?: number } = {},
  ): { req: FinalizedRequestInit; url: string; timeout: number } {
    const { method, path, query } = options;

    const url = this.buildURL(path!, query as Record<string, unknown>);
    if ('timeout' in options) validatePositiveInteger('timeout', options.timeout);
    const timeout = options.timeout ?? this.timeout;
    const { bodyHeaders, body } = this.buildBody({ options });
    const reqHeaders = this.buildHeaders({ options, method, bodyHeaders, retryCount });

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

    return { req, url, timeout };
  }

  private buildHeaders({
    options,
    method,
    bodyHeaders,
    retryCount,
  }: {
    options: FinalRequestOptions;
    method: HTTPMethod;
    bodyHeaders: HeadersLike;
    retryCount: number;
  }): Headers {
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
        ...getPlatformHeaders(),
        ...(this._options.dangerouslyAllowBrowser ?
          { 'anthropic-dangerous-direct-browser-access': 'true' }
        : undefined),
        'anthropic-version': '2023-06-01',
      },
      this.authHeaders(options),
      this._options.defaultHeaders,
      bodyHeaders,
      options.headers,
    ]);

    this.validateHeaders(headers);

    return headers.values;
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
      body instanceof Blob ||
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
    } else {
      return this.#encoder({ body, headers });
    }
  }

  static Anthropic = this;
  static HUMAN_PROMPT = '\n\nHuman:';
  static AI_PROMPT = '\n\nAssistant:';
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

  export import Page = Pagination.Page;
  export { type PageParams as PageParams, type PageResponse as PageResponse };

  export {
    Completions as Completions,
    type Completion as Completion,
    type CompletionCreateParams as CompletionCreateParams,
    type CompletionCreateParamsNonStreaming as CompletionCreateParamsNonStreaming,
    type CompletionCreateParamsStreaming as CompletionCreateParamsStreaming,
  };

  export {
    Messages as Messages,
    type Base64PDFSource as Base64PDFSource,
    type CacheControlEphemeral as CacheControlEphemeral,
    type CitationCharLocation as CitationCharLocation,
    type CitationCharLocationParam as CitationCharLocationParam,
    type CitationContentBlockLocation as CitationContentBlockLocation,
    type CitationContentBlockLocationParam as CitationContentBlockLocationParam,
    type CitationPageLocation as CitationPageLocation,
    type CitationPageLocationParam as CitationPageLocationParam,
    type CitationsConfigParam as CitationsConfigParam,
    type CitationsDelta as CitationsDelta,
    type ContentBlock as ContentBlock,
    type ContentBlockDeltaEvent as ContentBlockDeltaEvent,
    type ContentBlockParam as ContentBlockParam,
    type ContentBlockStartEvent as ContentBlockStartEvent,
    type ContentBlockStopEvent as ContentBlockStopEvent,
    type ContentBlockSource as ContentBlockSource,
    type ContentBlockSourceContent as ContentBlockSourceContent,
    type DocumentBlockParam as DocumentBlockParam,
    type ImageBlockParam as ImageBlockParam,
    type InputJSONDelta as InputJSONDelta,
    type Message as Message,
    type MessageDeltaEvent as MessageDeltaEvent,
    type MessageDeltaUsage as MessageDeltaUsage,
    type MessageParam as MessageParam,
    type MessageStartEvent as MessageStartEvent,
    type MessageStopEvent as MessageStopEvent,
    type MessageStreamEvent as MessageStreamEvent,
    type MessageTokensCount as MessageTokensCount,
    type Metadata as Metadata,
    type Model as Model,
    type PlainTextSource as PlainTextSource,
    type RawContentBlockDeltaEvent as RawContentBlockDeltaEvent,
    type RawContentBlockStartEvent as RawContentBlockStartEvent,
    type RawContentBlockStopEvent as RawContentBlockStopEvent,
    type RawMessageDeltaEvent as RawMessageDeltaEvent,
    type RawMessageStartEvent as RawMessageStartEvent,
    type RawMessageStopEvent as RawMessageStopEvent,
    type RawMessageStreamEvent as RawMessageStreamEvent,
    type TextBlock as TextBlock,
    type TextBlockParam as TextBlockParam,
    type TextCitation as TextCitation,
    type TextCitationParam as TextCitationParam,
    type TextDelta as TextDelta,
    type Tool as Tool,
    type ToolChoice as ToolChoice,
    type ToolChoiceAny as ToolChoiceAny,
    type ToolChoiceAuto as ToolChoiceAuto,
    type ToolChoiceTool as ToolChoiceTool,
    type ToolResultBlockParam as ToolResultBlockParam,
    type ToolUseBlock as ToolUseBlock,
    type ToolUseBlockParam as ToolUseBlockParam,
    type Usage as Usage,
    type MessageCreateParams as MessageCreateParams,
    type MessageCreateParamsNonStreaming as MessageCreateParamsNonStreaming,
    type MessageCreateParamsStreaming as MessageCreateParamsStreaming,
    type MessageStreamParams as MessageStreamParams,
    type MessageCountTokensParams as MessageCountTokensParams,
  };

  export {
    Models as Models,
    type ModelInfo as ModelInfo,
    type ModelInfosPage as ModelInfosPage,
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
  export type GatewayTimeoutError = API.GatewayTimeoutError;
  export type InvalidRequestError = API.InvalidRequestError;
  export type NotFoundError = API.NotFoundError;
  export type OverloadedError = API.OverloadedError;
  export type PermissionError = API.PermissionError;
  export type RateLimitError = API.RateLimitError;
}
export const { HUMAN_PROMPT, AI_PROMPT } = Anthropic;
