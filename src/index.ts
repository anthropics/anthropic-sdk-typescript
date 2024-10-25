// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import * as Errors from './error';
import * as Uploads from './uploads';
import { type Agent } from './_shims/index';
import * as Core from './core';
import * as Pagination from './pagination';
import * as API from './resources/index';

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
  timeout?: number;

  /**
   * An HTTP agent used to manage HTTP(S) connections.
   *
   * If not provided, an agent will be constructed by default in the Node.js environment,
   * otherwise no agent is used.
   */
  httpAgent?: Agent;

  /**
   * Specify a custom `fetch` function implementation.
   *
   * If not provided, we use `node-fetch` on Node.js and otherwise expect that `fetch` is
   * defined globally.
   */
  fetch?: Core.Fetch | undefined;

  /**
   * The maximum number of times that the client will retry a request in case of a
   * temporary failure, like a network error or a 5XX error from the server.
   *
   * @default 2
   */
  maxRetries?: number;

  /**
   * Default headers to include with every request to the API.
   *
   * These can be removed in individual requests by explicitly setting the
   * header to `undefined` or `null` in request options.
   */
  defaultHeaders?: Core.Headers;

  /**
   * Default query parameters to include with every request to the API.
   *
   * These can be removed in individual requests by explicitly setting the
   * param to `undefined` in request options.
   */
  defaultQuery?: Core.DefaultQuery;

  /**
   * By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   * Only set this option to `true` if you understand the risks and have appropriate mitigations in place.
   */
  dangerouslyAllowBrowser?: boolean;
}

/**
 * API Client for interfacing with the Anthropic API.
 */
export class Anthropic extends Core.APIClient {
  apiKey: string | null;
  authToken: string | null;

  private _options: ClientOptions;

  /**
   * API Client for interfacing with the Anthropic API.
   *
   * @param {string | null | undefined} [opts.apiKey=process.env['ANTHROPIC_API_KEY'] ?? null]
   * @param {string | null | undefined} [opts.authToken=process.env['ANTHROPIC_AUTH_TOKEN'] ?? null]
   * @param {string} [opts.baseURL=process.env['ANTHROPIC_BASE_URL'] ?? https://api.anthropic.com] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
   * @param {Core.Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Core.DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor({
    baseURL = Core.readEnv('ANTHROPIC_BASE_URL'),
    apiKey = Core.readEnv('ANTHROPIC_API_KEY') ?? null,
    authToken = Core.readEnv('ANTHROPIC_AUTH_TOKEN') ?? null,
    ...opts
  }: ClientOptions = {}) {
    const options: ClientOptions = {
      apiKey,
      authToken,
      ...opts,
      baseURL: baseURL || `https://api.anthropic.com`,
    };

    if (!options.dangerouslyAllowBrowser && Core.isRunningInBrowser()) {
      throw new Errors.AnthropicError(
        "It looks like you're running in a browser-like environment.\n\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\nIf you understand the risks and have appropriate mitigations in place,\nyou can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\nnew Anthropic({ apiKey, dangerouslyAllowBrowser: true });\n\nTODO: link!\n",
      );
    }

    super({
      baseURL: options.baseURL!,
      timeout: options.timeout ?? 600000 /* 10 minutes */,
      httpAgent: options.httpAgent,
      maxRetries: options.maxRetries,
      fetch: options.fetch,
    });

    this._options = options;

    this.apiKey = apiKey;
    this.authToken = authToken;
  }

  completions: API.Completions = new API.Completions(this);
  messages: API.Messages = new API.Messages(this);
  beta: API.Beta = new API.Beta(this);

  protected override defaultQuery(): Core.DefaultQuery | undefined {
    return this._options.defaultQuery;
  }

  protected override defaultHeaders(opts: Core.FinalRequestOptions): Core.Headers {
    return {
      ...super.defaultHeaders(opts),
      ...(this._options.dangerouslyAllowBrowser ?
        { 'anthropic-dangerous-direct-browser-access': 'true' }
      : undefined),
      'anthropic-version': '2023-06-01',
      ...this._options.defaultHeaders,
    };
  }

  protected override validateHeaders(headers: Core.Headers, customHeaders: Core.Headers) {
    if (this.apiKey && headers['x-api-key']) {
      return;
    }
    if (customHeaders['x-api-key'] === null) {
      return;
    }

    if (this.authToken && headers['authorization']) {
      return;
    }
    if (customHeaders['authorization'] === null) {
      return;
    }

    throw new Error(
      'Could not resolve authentication method. Expected either apiKey or authToken to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted',
    );
  }

  protected override authHeaders(opts: Core.FinalRequestOptions): Core.Headers {
    const apiKeyAuth = this.apiKeyAuth(opts);
    const bearerAuth = this.bearerAuth(opts);

    if (apiKeyAuth != null && !Core.isEmptyObj(apiKeyAuth)) {
      return apiKeyAuth;
    }

    if (bearerAuth != null && !Core.isEmptyObj(bearerAuth)) {
      return bearerAuth;
    }
    return {};
  }

  protected apiKeyAuth(opts: Core.FinalRequestOptions): Core.Headers {
    if (this.apiKey == null) {
      return {};
    }
    return { 'X-Api-Key': this.apiKey };
  }

  protected bearerAuth(opts: Core.FinalRequestOptions): Core.Headers {
    if (this.authToken == null) {
      return {};
    }
    return { Authorization: `Bearer ${this.authToken}` };
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
  static fileFromPath = Uploads.fileFromPath;
}

export const { HUMAN_PROMPT, AI_PROMPT } = Anthropic;

export const {
  AnthropicError,
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BadRequestError,
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  UnprocessableEntityError,
} = Errors;

export import toFile = Uploads.toFile;
export import fileFromPath = Uploads.fileFromPath;

export namespace Anthropic {
  export type RequestOptions = Core.RequestOptions;

  export import Page = Pagination.Page;
  export type PageParams = Pagination.PageParams;
  export type PageResponse<T> = Pagination.PageResponse<T>;

  export import Completions = API.Completions;
  export type Completion = API.Completion;
  export type CompletionCreateParams = API.CompletionCreateParams;
  export type CompletionCreateParamsNonStreaming = API.CompletionCreateParamsNonStreaming;
  export type CompletionCreateParamsStreaming = API.CompletionCreateParamsStreaming;

  export import Messages = API.Messages;
  export type ContentBlock = API.ContentBlock;
  export type ContentBlockDeltaEvent = API.ContentBlockDeltaEvent;
  export type ContentBlockStartEvent = API.ContentBlockStartEvent;
  export type ContentBlockStopEvent = API.ContentBlockStopEvent;
  export type ImageBlockParam = API.ImageBlockParam;
  export type InputJSONDelta = API.InputJSONDelta;
  export type Message = API.Message;
  export type MessageDeltaEvent = API.MessageDeltaEvent;
  export type MessageDeltaUsage = API.MessageDeltaUsage;
  export type MessageParam = API.MessageParam;
  export type MessageStartEvent = API.MessageStartEvent;
  export type MessageStopEvent = API.MessageStopEvent;
  export type MessageStreamEvent = API.MessageStreamEvent;
  export type Metadata = API.Metadata;
  export type Model = API.Model;
  export type RawContentBlockDeltaEvent = API.RawContentBlockDeltaEvent;
  export type RawContentBlockStartEvent = API.RawContentBlockStartEvent;
  export type RawContentBlockStopEvent = API.RawContentBlockStopEvent;
  export type RawMessageDeltaEvent = API.RawMessageDeltaEvent;
  export type RawMessageStartEvent = API.RawMessageStartEvent;
  export type RawMessageStopEvent = API.RawMessageStopEvent;
  export type RawMessageStreamEvent = API.RawMessageStreamEvent;
  export type TextBlock = API.TextBlock;
  export type TextBlockParam = API.TextBlockParam;
  export type TextDelta = API.TextDelta;
  export type Tool = API.Tool;
  export type ToolChoice = API.ToolChoice;
  export type ToolChoiceAny = API.ToolChoiceAny;
  export type ToolChoiceAuto = API.ToolChoiceAuto;
  export type ToolChoiceTool = API.ToolChoiceTool;
  export type ToolResultBlockParam = API.ToolResultBlockParam;
  export type ToolUseBlock = API.ToolUseBlock;
  export type ToolUseBlockParam = API.ToolUseBlockParam;
  export type Usage = API.Usage;
  export type MessageCreateParams = API.MessageCreateParams;
  export type MessageCreateParamsNonStreaming = API.MessageCreateParamsNonStreaming;
  export type MessageCreateParamsStreaming = API.MessageCreateParamsStreaming;
  export type MessageStreamParams = API.MessageStreamParams;

  export import Beta = API.Beta;
  export type AnthropicBeta = API.AnthropicBeta;
  export type BetaAPIError = API.BetaAPIError;
  export type BetaAuthenticationError = API.BetaAuthenticationError;
  export type BetaError = API.BetaError;
  export type BetaErrorResponse = API.BetaErrorResponse;
  export type BetaInvalidRequestError = API.BetaInvalidRequestError;
  export type BetaNotFoundError = API.BetaNotFoundError;
  export type BetaOverloadedError = API.BetaOverloadedError;
  export type BetaPermissionError = API.BetaPermissionError;
  export type BetaRateLimitError = API.BetaRateLimitError;
}

export default Anthropic;
