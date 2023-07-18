// File generated from our OpenAPI spec by Stainless.

import * as Core from './core';
import * as API from './resources/index';
import * as Errors from './error';
import type { Agent } from '@anthropic-ai/sdk/_shims/agent';
import * as Uploads from './uploads';

type Config = {
  /**
   * Defaults to process.env["ANTHROPIC_API_KEY"]. Set it to null if you want to send unauthenticated requests.
   */
  apiKey?: string | null;

  /**
   * Override the default base URL for the API, e.g., "https://api.example.com/v2/"
   */
  baseURL?: string;

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

  authToken?: string | null;
};

/** Instantiate the API Client. */
export class Anthropic extends Core.APIClient {
  apiKey: string | null;
  authToken?: string | null;

  private _options: Config;

  constructor(config?: Config) {
    const options: Config = {
      apiKey: typeof process === 'undefined' ? '' : process.env['ANTHROPIC_API_KEY'] || '',
      baseURL: 'https://api.anthropic.com',
      ...config,
    };

    super({
      baseURL: options.baseURL!,
      timeout: options.timeout,
      httpAgent: options.httpAgent,
      maxRetries: options.maxRetries,
      fetch: options.fetch,
    });
    this.apiKey = options.apiKey || null;
    this._options = options;

    this.authToken = config?.authToken || process.env['ANTHROPIC_AUTH_TOKEN'] || null;
  }

  completions: API.Completions = new API.Completions(this);

  protected override defaultQuery(): Core.DefaultQuery | undefined {
    return this._options.defaultQuery;
  }

  protected override defaultHeaders(): Core.Headers {
    return {
      ...super.defaultHeaders(),
      'anthropic-version': '2023-06-01',
      ...this._options.defaultHeaders,
    };
  }

  protected override validateHeaders(headers: Core.Headers, customHeaders: Core.Headers) {
    if (this.apiKey && headers['X-Api-Key']) {
      return;
    }
    if (customHeaders['X-Api-Key'] === null) {
      return;
    }

    if (this.authToken && headers['Authorization']) {
      return;
    }
    if (customHeaders['Authorization'] === null) {
      return;
    }

    throw new Error(
      'Could not resolve authentication method. Expected either apiKey or authToken to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted',
    );
  }

  protected override authHeaders(): Core.Headers {
    const apiKeyHeader = this.apiKeyHeader();
    if (apiKeyHeader != null && !Core.isEmptyObj(apiKeyHeader)) {
      return apiKeyHeader;
    }
    const authTokenBearer = this.authTokenBearer();
    if (authTokenBearer != null && !Core.isEmptyObj(authTokenBearer)) {
      return authTokenBearer;
    }
    return {};
  }

  protected apiKeyHeader(): Core.Headers {
    if (this.apiKey == null) {
      return {};
    }
    return { 'X-Api-Key': this.apiKey };
  }

  protected authTokenBearer(): Core.Headers {
    if (this.authToken == null) {
      return {};
    }
    return { Authorization: `Bearer ${this.authToken}` };
  }

  static Anthropic = this;
  static HUMAN_PROMPT = '\n\nHuman:';
  static AI_PROMPT = '\n\nAssistant:';

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
}

export const { HUMAN_PROMPT, AI_PROMPT } = Anthropic;

export const {
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
  // Helper functions
  export import toFile = Uploads.toFile;
  export import fileFromPath = Uploads.fileFromPath;

  export import Completions = API.Completions;
  export import Completion = API.Completion;
  export import CompletionCreateParams = API.CompletionCreateParams;
}

export default Anthropic;
