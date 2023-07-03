// File generated from our OpenAPI spec by Stainless.

import * as qs from 'qs';
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
  baseURL?: string;
  timeout?: number;
  httpAgent?: Agent;
  maxRetries?: number;
  defaultHeaders?: Core.Headers;
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

  protected override qsOptions(): qs.IStringifyOptions {
    return { arrayFormat: 'comma' };
  }

  static HUMAN_PROMPT = '\n\nHuman:';
  static AI_PROMPT = '\n\nAssistant:';

  static APIError = Errors.APIError;
  static APIConnectionError = Errors.APIConnectionError;
  static APIConnectionTimeoutError = Errors.APIConnectionTimeoutError;
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
