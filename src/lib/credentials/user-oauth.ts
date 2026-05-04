import type { Fetch } from '../../internal/builtin-types';
import { CREDENTIALS_FILE_VERSION, type AnthropicCredentials } from '../../core/credentials';
import type { AccessTokenProvider } from './types';
import {
  GRANT_TYPE_REFRESH_TOKEN,
  MANDATORY_REFRESH_THRESHOLD_IN_SECONDS,
  OAUTH_API_BETA_HEADER,
  TOKEN_ENDPOINT,
  WorkloadIdentityError,
  checkCredentialsFileSafety,
  parseTokenResponse,
  redactSensitive,
  requireSecureTokenEndpoint,
  writeCredentialsFileAtomic,
} from './types';
import { nowAsSeconds } from '../../internal/utils/time';
import { VERSION } from '../../version';

export type UserOAuthConfig = {
  credentialsPath: string;
  clientId?: string | undefined;
  baseURL: string;
  fetch: Fetch;
  userAgent?: string | undefined;
  onSafetyWarning?: ((msg: string) => void) | undefined;
};

/**
 * Reads a user-oauth credential file. Returns the cached access token while
 * fresh; on expiry performs a `refresh_token` grant and writes the new
 * tokens back to the credentials file (atomic replace, fsync'd).
 *
 * If `clientId` is empty, the access token is treated as static — the
 * credentials file is read on every call but no refresh is attempted, and
 * an expired token without a `refresh_token` raises.
 */
export function userOAuthProvider(config: UserOAuthConfig): AccessTokenProvider {
  return async (opts) => {
    const fs = await import('node:fs');

    await checkCredentialsFileSafety(config.credentialsPath, config.onSafetyWarning);

    let raw: string;
    try {
      raw = await fs.promises.readFile(config.credentialsPath, 'utf-8');
    } catch (err) {
      throw new WorkloadIdentityError(`Credentials file not found at ${config.credentialsPath}: ${err}`);
    }
    let creds: AnthropicCredentials;
    try {
      creds = JSON.parse(raw);
    } catch (err) {
      throw new WorkloadIdentityError(
        `Credentials file at ${config.credentialsPath} is not valid JSON: ${err}`,
      );
    }

    const accessToken = creds.access_token;
    if (!accessToken) {
      throw new WorkloadIdentityError(
        `Credentials file at ${config.credentialsPath} must include 'access_token'`,
      );
    }

    // Return cached token if still fresh (or no expiry info), unless the
    // caller is forcing a refresh after a 401 — then go straight to refresh
    // even if the file's expires_at still looks valid.
    const expiresAt = creds.expires_at;
    if (
      !opts?.forceRefresh &&
      (expiresAt == null || nowAsSeconds() < expiresAt - MANDATORY_REFRESH_THRESHOLD_IN_SECONDS)
    ) {
      return { token: accessToken, expiresAt: expiresAt ?? null };
    }

    const refreshToken = creds.refresh_token;
    if (!config.clientId || !refreshToken) {
      throw new WorkloadIdentityError(
        `Access token at ${config.credentialsPath} has expired and no refresh is available ` +
          `(client_id ${config.clientId ? 'set' : 'empty'}, refresh_token ${refreshToken ? 'set' : 'empty'})`,
      );
    }

    requireSecureTokenEndpoint(config.baseURL);

    const body: Record<string, string> = {
      grant_type: GRANT_TYPE_REFRESH_TOKEN,
      refresh_token: refreshToken,
      client_id: config.clientId,
    };

    const url = `${config.baseURL}${TOKEN_ENDPOINT}`;
    let resp: Response;
    try {
      resp = await config.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-beta': OAUTH_API_BETA_HEADER,
          'User-Agent': config.userAgent || `anthropic-sdk-typescript/${VERSION} userOAuthProvider`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new WorkloadIdentityError(`User OAuth refresh failed to reach token endpoint: ${err}`);
    }

    const requestId = resp.headers.get('Request-Id');

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new WorkloadIdentityError(
        `User OAuth refresh failed (HTTP ${resp.status}): ${redactSensitive(text)}`,
        resp.status,
        redactSensitive(text),
        requestId,
      );
    }

    const data = await parseTokenResponse(resp, requestId);
    const expiresIn = Number(data.expires_in);
    if (!Number.isFinite(expiresIn)) {
      throw new WorkloadIdentityError(
        `User OAuth refresh response missing or invalid expires_in: ${JSON.stringify(redactSensitive(data))}`,
        resp.status,
        redactSensitive(data),
        requestId,
      );
    }
    const newExpiresAt = nowAsSeconds() + expiresIn;
    const newRefreshToken = data.refresh_token || refreshToken;

    await writeCredentialsFileAtomic(config.credentialsPath, {
      ...creds,
      version: CREDENTIALS_FILE_VERSION,
      type: 'oauth_token',
      access_token: data.access_token,
      expires_at: newExpiresAt,
      refresh_token: newRefreshToken,
    });

    return { token: data.access_token, expiresAt: newExpiresAt };
  };
}
