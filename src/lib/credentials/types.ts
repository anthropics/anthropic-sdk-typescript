import { AnthropicError } from '../../core/error';

export type AccessToken = {
  token: string;
  /** Unix epoch seconds. `null` means no expiry (cache forever). */
  expiresAt: number | null;
};

/**
 * Mints or returns a cached access token.
 *
 * The optional `opts.forceRefresh` flag, set by {@link TokenCache.invalidate}
 * after a 401, tells providers with on-disk caches (user_oauth, cachedExchange)
 * to bypass their freshness short-circuit and always fetch fresh. Providers
 * without a cache can ignore it.
 */
export type AccessTokenProvider = (opts?: { forceRefresh?: boolean }) => Promise<AccessToken>;

export type IdentityTokenProvider = () => string | Promise<string>;

export type CredentialResult = {
  provider: AccessTokenProvider;
  extraHeaders: Record<string, string>;
  /**
   * The `base_url` from the resolved config/profile, if any. The client
   * applies this to outbound API requests when no explicit `baseURL` (constructor
   * option or `ANTHROPIC_BASE_URL` env) was given, so a profile pointing at a
   * non-default API host both mints its token against that host AND sends
   * subsequent API requests there.
   */
  baseURL?: string | undefined;
};

/** Response body from `POST /v1/oauth/token`. */
export type TokenEndpointResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
};

export const GRANT_TYPE_JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
export const GRANT_TYPE_REFRESH_TOKEN = 'refresh_token';
export const TOKEN_ENDPOINT = '/v1/oauth/token';

/**
 * `anthropic-beta` value required on authenticated API requests using an
 * OAuth bearer token, and on `refresh_token` grants against the token endpoint.
 */
export const OAUTH_API_BETA_HEADER = 'oauth-2025-04-20';

/**
 * `anthropic-beta` value required on jwt-bearer exchanges against the token
 * endpoint. It routes the request to the federation service; it must NOT be
 * sent on `refresh_token` grants, which are handled by a different backend.
 */
export const FEDERATION_BETA_HEADER = 'oidc-federation-2026-04-01';

export const ADVISORY_REFRESH_THRESHOLD_IN_SECONDS = 120;
export const MANDATORY_REFRESH_THRESHOLD_IN_SECONDS = 30;
export const ADVISORY_REFRESH_BACKOFF_IN_SECONDS = 5;

const MAX_TOKEN_RESPONSE_BYTES = 1 << 20;

/**
 * Rejects base URLs that would cause a JWT assertion or refresh token to be
 * sent over cleartext HTTP. Loopback hosts are allowed for local development.
 */
export function requireSecureTokenEndpoint(baseURL: string): void {
  if (!baseURL) return;
  let u: URL;
  try {
    u = new URL(baseURL);
  } catch (err) {
    throw new WorkloadIdentityError(`Invalid token endpoint base URL "${baseURL}": ${err}`);
  }
  if (u.protocol === 'https:') return;
  // WHATWG URL.hostname returns bracketed IPv6 ("[::1]"); Go's net/url strips them.
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (u.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1' || host === '::1')) {
    return;
  }
  throw new WorkloadIdentityError(`Refusing to send credential over non-https token endpoint "${baseURL}"`);
}

/**
 * Reads the response body as text, parses it as a token-endpoint JSON
 * response, validates `access_token` is present, and rejects a non-Bearer
 * `token_type` when one is provided. Reads at most
 * {@link MAX_TOKEN_RESPONSE_BYTES} from the body stream.
 */
export async function parseTokenResponse(
  resp: Response,
  requestId: string | null,
): Promise<TokenEndpointResponse & { access_token: string }> {
  const text = await readLimitedText(resp);
  let data: TokenEndpointResponse & { token_type?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new WorkloadIdentityError(
      `Token endpoint returned non-JSON response (status ${resp.status})`,
      resp.status,
      redactSensitive(text),
      requestId,
    );
  }
  if (!data.access_token) {
    throw new WorkloadIdentityError(
      `Token endpoint response missing access_token: ${JSON.stringify(redactSensitive(data))}`,
      resp.status,
      redactSensitive(data),
      requestId,
    );
  }
  if (data.token_type && data.token_type.toLowerCase() !== 'bearer') {
    throw new WorkloadIdentityError(
      `Token endpoint response: unsupported token_type "${data.token_type}" (want Bearer)`,
      resp.status,
      redactSensitive(data),
      requestId,
    );
  }
  return data as TokenEndpointResponse & { access_token: string };
}

const MAX_ERROR_BODY_CHARS = 2000;
// RFC 6749 §5.2 standard error-response fields. Anything else in a token
// endpoint error body is potentially echoed input (assertion, refresh_token,
// access_token, …) and is dropped rather than allowlisted-with-exceptions.
const SAFE_ERROR_KEYS = new Set(['error', 'error_description', 'error_uri']);

/**
 * Returns a redacted copy of a token-endpoint error body for safe inclusion
 * in an exception. Strings are truncated; objects keep only the RFC 6749
 * §5.2 error fields.
 */
export function redactSensitive(body: unknown): unknown {
  if (body == null) return body;
  if (typeof body === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      if (body.length <= MAX_ERROR_BODY_CHARS) return body;
      return body.slice(0, MAX_ERROR_BODY_CHARS) + `... <${body.length - MAX_ERROR_BODY_CHARS} more chars>`;
    }
    return JSON.stringify(redactSensitive(parsed));
  }
  if (typeof body === 'object' && !Array.isArray(body)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (SAFE_ERROR_KEYS.has(k)) out[k] = v;
    }
    return out;
  }
  return null;
}

/**
 * Best-effort safety check on a credentials file before reading it.
 *
 * On POSIX: resolves symlinks (so containerized deployments that mount the
 * credential as a symlink to a tmpfs-backed file keep working), then rejects
 * the resolved target if it is group- or world- readable or writable. A uid
 * mismatch on the resolved target is surfaced via `onWarn` since
 * root-written/app-read is common in init-container setups. No-op on Windows.
 */
export async function checkCredentialsFileSafety(
  path: string,
  onWarn: (msg: string) => void = (m) => console.warn(`anthropic-sdk: ${m}`),
): Promise<void> {
  if (typeof process === 'undefined' || process.platform === 'win32') return;
  const fs = await import('node:fs');
  let resolved = path;
  let st;
  try {
    resolved = await fs.promises.realpath(path);
    st = await fs.promises.stat(resolved);
  } catch {
    return; // ENOENT etc — let the subsequent read surface a precise error
  }
  const mode = st.mode & 0o777;
  // 0o022 = group/world write; 0o044 = group/world read.
  if (mode & 0o022) {
    throw new WorkloadIdentityError(
      `Credentials file at ${resolved} is group/world-writable (mode 0o${mode.toString(8)}); ` +
        `this allows other local users to plant tokens. Run \`chmod 600 ${resolved}\`.`,
    );
  }
  if (mode & 0o044) {
    throw new WorkloadIdentityError(
      `Credentials file at ${resolved} is group/world-readable (mode 0o${mode.toString(8)}); ` +
        `run \`chmod 600 ${resolved}\` before retrying.`,
    );
  }
  if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
    onWarn(
      `credentials file at ${resolved} is owned by uid ${
        st.uid
      } (current process uid ${process.getuid()}); ` + `verify this is intentional.`,
    );
  }
}

/**
 * Atomically writes JSON to `targetPath` via a `.tmp` sibling + rename,
 * with fsync on the file and (best-effort) on the parent directory.
 * Creates the parent directory with mode 0700 and the file with mode 0600.
 */
export async function writeCredentialsFileAtomic(targetPath: string, data: unknown): Promise<void> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.dirname(targetPath);
  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
  // Unique temp name avoids two concurrent writers (different processes or
  // SDK instances) racing on the same '.tmp' sibling and corrupting each
  // other's bytes mid-write before the rename.
  const tmpPath = `${targetPath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    const fh = await fs.promises.open(tmpPath, 'w', 0o600);
    try {
      await fh.writeFile(JSON.stringify(data, null, 2));
      await fh.sync();
    } finally {
      await fh.close();
    }
    await fs.promises.rename(tmpPath, targetPath);
  } catch (err) {
    // Don't leak the temp file if anything between create and rename failed.
    await fs.promises.unlink(tmpPath).catch(() => {});
    throw err;
  }
  // fsync the parent directory so the rename survives a crash.
  try {
    const dirFh = await fs.promises.open(dir, 'r');
    try {
      await dirFh.sync();
    } finally {
      await dirFh.close();
    }
  } catch {
    // Directory fsync is best-effort (unsupported on some platforms, e.g. Windows).
  }
}

async function readLimitedText(resp: Response): Promise<string> {
  if (!resp.body) {
    return '';
  }
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.length > MAX_TOKEN_RESPONSE_BYTES) {
      const remaining = MAX_TOKEN_RESPONSE_BYTES - received;
      if (remaining > 0) chunks.push(value.subarray(0, remaining));
      await reader.cancel();
      break;
    }
    chunks.push(value);
    received += value.length;
  }
  let merged: Uint8Array;
  if (chunks.length === 1) {
    merged = chunks[0]!;
  } else {
    merged = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
  }
  return new TextDecoder('utf-8').decode(merged);
}

export class WorkloadIdentityError extends AnthropicError {
  readonly statusCode: number | null;
  readonly body: unknown;
  readonly requestId: string | null;

  constructor(
    message: string,
    statusCode: number | null = null,
    body: unknown = null,
    requestId: string | null = null,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.body = body;
    this.requestId = requestId;
  }
}
