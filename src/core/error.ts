import { castToError } from '../internal/errors';
import type * as Shared from '../resources/shared';

export class AnthropicError extends Error {
  /** @internal */
  static readonly _errorName: string = 'AnthropicError';

  /** @internal */
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    Object.defineProperty(this, 'name', { value: new.target._errorName, writable: true, configurable: true });
  }
}

export class APIError<
  TStatus extends number | undefined = number | undefined,
  THeaders extends Headers | undefined = Headers | undefined,
  TError extends Object | undefined = Object | undefined,
> extends AnthropicError {
  /** HTTP status for the response that caused the error */
  readonly status: TStatus;
  /** HTTP headers for the response that caused the error */
  readonly headers: THeaders;
  /** JSON body of the response that caused the error */
  readonly error: TError;

  readonly requestID: string | null | undefined;
  readonly workspaceID: string | null | undefined;

  /**
   * A human-readable explanation of the error. Its wording can change, so don't
   * match on it.
   *
   * `error.message` from the response body, if present.
   */
  readonly apiMessage: string | null;

  /**
   * The broad category of the error.
   *
   * `error.type` from the response body, if present.
   */
  readonly type: Shared.ErrorType | null;

  /**
   * A stable code that names the cause.
   *
   * `error.details.error_code` from the response body, if present and a string.
   */
  readonly errorCode: string | null;

  /**
   * Machine-readable detail about the cause of the error. `error_code` names the
   * cause; branch on it rather than on `message`. Absent when the error has no code.
   * Treat an unrecognized `error_code` as the bare `type`.
   *
   * `error.details` from the response body, if present.
   */
  readonly details: Shared.ErrorDetails | null;

  constructor(
    status: TStatus,
    error: TError,
    message: string | undefined,
    headers: THeaders,
    type?: Shared.ErrorType | null,
  ) {
    super(`${APIError.makeMessage(status, error, message)}`);
    this.status = status;
    this.headers = headers;
    this.requestID = headers?.get('request-id');
    this.workspaceID = headers?.get('anthropic-workspace-id');
    this.error = error;
    const body = (error ?? {}) as any;
    this.apiMessage = body.error?.message ?? null;
    this.type = type ?? body.error?.type ?? null;

    const errorCode = body.error?.details?.error_code;
    this.errorCode = typeof errorCode === 'string' ? errorCode : null;
    this.details = body.error?.details ?? null;
  }

  private static makeMessage(status: number | undefined, error: any, message: string | undefined) {
    const msg =
      error?.message ?
        typeof error.message === 'string' ?
          error.message
        : JSON.stringify(error.message)
      : error ? JSON.stringify(error)
      : message;

    if (status && msg) {
      return `${status} ${msg}`;
    }
    if (status) {
      return `${status} status code (no body)`;
    }
    if (msg) {
      return msg;
    }
    return '(no status code or body)';
  }

  static generate(
    status: number | undefined,
    errorResponse: Object | undefined,
    message: string | undefined,
    headers: Headers | undefined,
  ): APIError {
    if (!status || !headers) {
      return new APIConnectionError({ message, cause: castToError(errorResponse) });
    }

    const error = errorResponse as Record<string, any>;

    const errorClass = STATUS_ERROR_CLASSES.get(status);
    if (errorClass) {
      return new errorClass(status, error, message, headers);
    }

    if (status >= 500) {
      return new InternalServerError(status, error, message, headers);
    }

    return new APIError(status, error, message, headers);
  }

  /** @internal */
  static override readonly _errorName: string = 'APIError';
}

export class APIUserAbortError extends APIError<undefined, undefined, undefined> {
  constructor({ message }: { message?: string } = {}) {
    super(undefined, undefined, message || 'Request was aborted.', undefined);
  }

  /** @internal */
  static override readonly _errorName: string = 'APIUserAbortError';
}

export class APIConnectionError extends APIError<undefined, undefined, undefined> {
  constructor({ message, cause }: { message?: string | undefined; cause?: Error | undefined }) {
    super(undefined, undefined, message || 'Connection error.', undefined);
    // in some environments the 'cause' property is already declared
    // @ts-ignore
    if (cause) this.cause = cause;
  }

  /** @internal */
  static override readonly _errorName: string = 'APIConnectionError';
}

export class APIConnectionTimeoutError extends APIConnectionError {
  constructor({ message }: { message?: string } = {}) {
    super({ message: message ?? 'Request timed out.' });
  }

  /** @internal */
  static override readonly _errorName: string = 'APIConnectionTimeoutError';
}

/**
 * An error that opts into the SDK's retry policy: throw it (e.g. from
 * middleware) to have the attempt retried.
 *
 * Note that the request will only be retried when `maxRetries` has not been exhausted.
 */
export class RetryableError extends AnthropicError {
  constructor(message?: string, { cause }: { cause?: unknown } = {}) {
    super(message ?? 'Retryable error.');
    // in some environments the 'cause' property is already declared
    // @ts-ignore
    if (cause !== undefined) this.cause = cause;
  }

  /** @internal */
  static override readonly _errorName: string = 'RetryableError';
}

export class BadRequestError extends APIError<400, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'BadRequestError';
}

export class AuthenticationError extends APIError<401, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'AuthenticationError';
}

export class PermissionDeniedError extends APIError<403, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'PermissionDeniedError';
}

export class NotFoundError extends APIError<404, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'NotFoundError';
}

export class RequestTimeoutError extends APIError<408, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'RequestTimeoutError';
}

export class ConflictError extends APIError<409, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'ConflictError';
}

export class PreconditionFailedError extends APIError<412, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'PreconditionFailedError';
}

export class ContentTooLargeError extends APIError<413, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'ContentTooLargeError';
}

export class UnprocessableEntityError extends APIError<422, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'UnprocessableEntityError';
}

export class RateLimitError extends APIError<429, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'RateLimitError';
}

export class RequestHeaderFieldsTooLargeError extends APIError<431, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'RequestHeaderFieldsTooLargeError';
}

export class ClientClosedRequestError extends APIError<499, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'ClientClosedRequestError';
}

export class InternalServerError extends APIError<number, Headers> {
  /** @internal */
  static override readonly _errorName: string = 'InternalServerError';
}

export class NotImplementedError extends InternalServerError {
  declare readonly status: 501;

  /** @internal */
  static override readonly _errorName: string = 'NotImplementedError';
}

export class ServiceUnavailableError extends InternalServerError {
  declare readonly status: 503;

  /** @internal */
  static override readonly _errorName: string = 'ServiceUnavailableError';
}

export class GatewayTimeoutError extends InternalServerError {
  declare readonly status: 504;

  /** @internal */
  static override readonly _errorName: string = 'GatewayTimeoutError';
}

export class OverloadedError extends InternalServerError {
  declare readonly status: 529;

  /** @internal */
  static override readonly _errorName: string = 'OverloadedError';
}

const STATUS_ERROR_CLASSES = /* @__PURE__ */ new Map<number, typeof APIError<number, Headers>>([
  [400, BadRequestError],
  [401, AuthenticationError],
  [403, PermissionDeniedError],
  [404, NotFoundError],
  [408, RequestTimeoutError],
  [409, ConflictError],
  [412, PreconditionFailedError],
  [413, ContentTooLargeError],
  [422, UnprocessableEntityError],
  [429, RateLimitError],
  [431, RequestHeaderFieldsTooLargeError],
  [499, ClientClosedRequestError],
  [501, NotImplementedError],
  [503, ServiceUnavailableError],
  [504, GatewayTimeoutError],
  [529, OverloadedError],
]);
