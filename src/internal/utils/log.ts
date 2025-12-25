// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { hasOwn } from './values';
import { type BaseAnthropic } from '../../client';
import { RequestOptions } from '../request-options';

type LogFn = (message: string, ...rest: unknown[]) => void;
export type Logger = {
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  debug: LogFn;
};
export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

const levelNumbers = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500,
};

export const parseLogLevel = (
  maybeLevel: string | undefined,
  sourceName: string,
  client: BaseAnthropic,
): LogLevel | undefined => {
  if (!maybeLevel) {
    return undefined;
  }
  if (hasOwn(levelNumbers, maybeLevel)) {
    return maybeLevel;
  }
  loggerFor(client).warn(
    `${sourceName} was set to ${JSON.stringify(maybeLevel)}, expected one of ${JSON.stringify(
      Object.keys(levelNumbers),
    )}`,
  );
  return undefined;
};

function noop() {}

function makeLogFn(fnLevel: keyof Logger, logger: Logger | undefined, logLevel: LogLevel) {
  if (!logger || levelNumbers[fnLevel] > levelNumbers[logLevel]) {
    return noop;
  } else {
    // Don't wrap logger functions, we want the stacktrace intact!
    return logger[fnLevel].bind(logger);
  }
}

const noopLogger = {
  error: noop,
  warn: noop,
  info: noop,
  debug: noop,
};

let cachedLoggers = /* @__PURE__ */ new WeakMap<Logger, [LogLevel, Logger]>();

export function loggerFor(client: BaseAnthropic): Logger {
  const logger = client.logger;
  const logLevel = client.logLevel ?? 'off';
  if (!logger) {
    return noopLogger;
  }

  const cachedLogger = cachedLoggers.get(logger);
  if (cachedLogger && cachedLogger[0] === logLevel) {
    return cachedLogger[1];
  }

  const levelLogger = {
    error: makeLogFn('error', logger, logLevel),
    warn: makeLogFn('warn', logger, logLevel),
    info: makeLogFn('info', logger, logLevel),
    debug: makeLogFn('debug', logger, logLevel),
  };

  cachedLoggers.set(logger, [logLevel, levelLogger]);

  return levelLogger;
}

/**
 * SECURITY: Sanitizes sensitive headers before logging to prevent information disclosure.
 *
 * This function redacts authentication credentials and other sensitive data from headers
 * before they are logged via debug/info logging. This prevents API keys, bearer tokens,
 * and other secrets from being exposed in logs.
 *
 * @param details - Request/response details that may contain sensitive headers
 * @returns Sanitized details safe for logging
 */
export const formatRequestDetails = (details: {
  options?: RequestOptions | undefined;
  headers?: Headers | Record<string, string> | undefined;
  retryOfRequestLogID?: string | undefined;
  retryOf?: string | undefined;
  url?: string | undefined;
  status?: number | undefined;
  method?: string | undefined;
  durationMs?: number | undefined;
  message?: unknown;
  body?: unknown;
}) => {
  if (details.options) {
    details.options = { ...details.options };
    delete details.options['headers']; // redundant + leaks internals
  }
  if (details.headers) {
    // SECURITY: Redact sensitive authentication and credential headers
    // This prevents API keys, tokens, and other secrets from leaking into logs
    details.headers = Object.fromEntries(
      (details.headers instanceof Headers ? [...details.headers] : Object.entries(details.headers)).map(
        ([name, value]) => {
          const lowerName = name.toLowerCase();
          // Redact authentication-related headers that may contain credentials
          const isSensitive =
            lowerName === 'x-api-key' ||           // Anthropic API key
            lowerName === 'authorization' ||        // Bearer tokens, Basic auth
            lowerName === 'cookie' ||               // Session cookies
            lowerName === 'set-cookie' ||           // Set-Cookie headers
            lowerName.includes('token') ||          // Any header with 'token'
            lowerName.includes('key') ||            // Any header with 'key'
            lowerName.includes('secret') ||         // Any header with 'secret'
            lowerName.includes('password') ||       // Any header with 'password'
            lowerName.includes('auth');             // Any header with 'auth'

          return [name, isSensitive ? '***' : value];
        },
      ),
    );
  }
  if ('retryOfRequestLogID' in details) {
    if (details.retryOfRequestLogID) {
      details.retryOf = details.retryOfRequestLogID;
    }
    delete details.retryOfRequestLogID;
  }
  return details;
};
