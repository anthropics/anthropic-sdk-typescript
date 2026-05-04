import type { Fetch } from '../../internal/builtin-types';
import { readEnv } from '../../internal/utils/env';
import {
  CREDENTIALS_FILE_VERSION,
  loadConfig,
  getCredentialsPath,
  type AnthropicConfig,
} from '../../core/credentials';
import type { AccessTokenProvider, CredentialResult, IdentityTokenProvider } from './types';
import {
  MANDATORY_REFRESH_THRESHOLD_IN_SECONDS,
  WorkloadIdentityError,
  checkCredentialsFileSafety,
  writeCredentialsFileAtomic,
} from './types';
import { nowAsSeconds } from '../../internal/utils/time';
import { identityTokenFromFile, identityTokenFromValue } from './identity-token';
import { oidcFederationProvider } from './oidc-federation';
import { userOAuthProvider } from './user-oauth';

/**
 * Builds a {@link CredentialResult} from an explicit {@link AnthropicConfig}.
 *
 * Use this when constructing a client from an in-memory config object rather
 * than from profile files or environment variables.
 *
 * For `oidc_federation`, `authentication.credentials_path` is optional —
 * if omitted, every call performs a fresh exchange with no on-disk cache.
 * For `user_oauth`, `authentication.credentials_path` is required (it is
 * where the access/refresh tokens live).
 */
export type ResolverOptions = {
  baseURL: string;
  fetch: Fetch;
  userAgent?: string | undefined;
  onCacheWriteError?: ((err: unknown) => void) | undefined;
  onSafetyWarning?: ((msg: string) => void) | undefined;
};

export function resolveCredentialsFromConfig(
  config: AnthropicConfig,
  options: ResolverOptions,
): CredentialResult {
  const credentialsPath = config.authentication.credentials_path ?? null;
  const effectiveBaseURL = (config.base_url || options.baseURL).replace(/\/+$/, '');

  const provider = buildProvider(config, credentialsPath, effectiveBaseURL, options);

  const extraHeaders: Record<string, string> = {};
  // Workspace scoping for oidc_federation is server-side (the federation rule
  // encodes the workspace and the minted token is workspace-scoped), so the
  // header is only meaningful for user_oauth.
  if (config.workspace_id && config.authentication.type === 'user_oauth') {
    extraHeaders['anthropic-workspace-id'] = config.workspace_id;
  }

  // Surface the profile's own base_url (not the options.baseURL fallback) so
  // the client can adopt it for outbound API requests when the caller didn't
  // pin one explicitly. Echoing options.baseURL back would defeat precedence.
  return { provider, extraHeaders, baseURL: config.base_url || undefined };
}

/**
 * Resolves a {@link CredentialResult} from the environment. Returns `null`
 * when no credentials can be resolved.
 *
 * Resolution order:
 *
 *   1. Config file for the active profile (or the explicit `profile` argument)
 *      → dispatch on `authentication.type` (`oidc_federation`, `user_oauth`)
 *   2. Environment variables `ANTHROPIC_FEDERATION_RULE_ID` +
 *      `ANTHROPIC_ORGANIZATION_ID` (+ identity token) → OIDC federation
 *   3. Nothing matches → `null`
 *
 * Passing `profile` selects `<config_dir>/configs/<profile>.json` directly,
 * skipping `ANTHROPIC_PROFILE` / `active_config` resolution.
 */
export async function defaultCredentials(
  options: ResolverOptions,
  profile?: string,
): Promise<CredentialResult | null> {
  const config = await loadConfig(profile);
  if (!config) {
    return null;
  }

  // For env/file-loaded configs, default credentials_path to the
  // per-profile location so user_oauth and federation caching work.
  // Shallow-clone first so callers that retain a reference to the loaded
  // config don't observe the patched-in default.
  const withPath: AnthropicConfig =
    config.authentication.credentials_path ?
      config
    : {
        ...config,
        authentication: {
          ...config.authentication,
          credentials_path: (await getCredentialsPath(config, profile)) ?? undefined,
        },
      };

  return resolveCredentialsFromConfig(withPath, options);
}

function buildProvider(
  config: AnthropicConfig,
  credentialsPath: string | null,
  baseURL: string,
  options: ResolverOptions,
): AccessTokenProvider {
  switch (config.authentication.type) {
    case 'oidc_federation': {
      const auth = config.authentication;
      const identityProvider = resolveIdentityTokenProvider(auth);
      if (!identityProvider) {
        throw new WorkloadIdentityError(
          'oidc_federation config requires an identity token (set authentication.identity_token, ' +
            'ANTHROPIC_IDENTITY_TOKEN_FILE, or ANTHROPIC_IDENTITY_TOKEN)',
        );
      }
      if (!auth.federation_rule_id) {
        throw new WorkloadIdentityError(
          "oidc_federation config requires 'federation_rule_id'. Set it in authentication.federation_rule_id in your profile, or via ANTHROPIC_FEDERATION_RULE_ID (profile takes precedence).",
        );
      }
      if (!config.organization_id) {
        throw new WorkloadIdentityError(
          'oidc_federation config requires organization_id (set ANTHROPIC_ORGANIZATION_ID or config.organization_id)',
        );
      }

      const exchange = oidcFederationProvider({
        identityTokenProvider: identityProvider,
        federationRuleId: auth.federation_rule_id,
        organizationId: config.organization_id,
        serviceAccountId: auth.service_account_id,
        baseURL,
        fetch: options.fetch,
        userAgent: options.userAgent,
      });

      // If there's a credentials file path, wrap the exchange with file caching
      // (check file for fresh token before exchanging, write back after).
      if (credentialsPath) {
        return cachedExchangeProvider(
          exchange,
          credentialsPath,
          options.onCacheWriteError,
          options.onSafetyWarning,
        );
      }
      return exchange;
    }

    case 'user_oauth': {
      if (!credentialsPath) {
        throw new WorkloadIdentityError(
          'user_oauth config requires authentication.credentials_path ' +
            '(or load via a profile so it defaults to <config_dir>/credentials/<profile>.json)',
        );
      }
      return userOAuthProvider({
        credentialsPath,
        clientId: config.authentication.client_id,
        baseURL,
        fetch: options.fetch,
        userAgent: options.userAgent,
        onSafetyWarning: options.onSafetyWarning,
      });
    }

    default: {
      const t = (config.authentication as { type: string }).type;
      throw new WorkloadIdentityError(`authentication.type "${t}" is not a known authentication type`);
    }
  }
}

/**
 * Resolves the identity token provider from config fields or environment variables.
 *
 * Resolution order:
 *   1. `identity_token.path` from the config (source: "file")
 *   2. `ANTHROPIC_IDENTITY_TOKEN_FILE` env var
 *   3. `ANTHROPIC_IDENTITY_TOKEN` env var (static value)
 */
function resolveIdentityTokenProvider(
  auth: Extract<AnthropicConfig['authentication'], { type: 'oidc_federation' }>,
): IdentityTokenProvider | null {
  if (auth.identity_token) {
    // Cast needed to stringify an unknown source value for the error message:
    // the on-disk JSON may contain a source this SDK version doesn't know about.
    const source = (auth.identity_token as { source: string }).source;
    if (source !== 'file') {
      throw new WorkloadIdentityError(
        `identity_token.source "${source}" is not supported by this SDK version (only "file")`,
      );
    }
    if (!auth.identity_token.path) {
      throw new WorkloadIdentityError(`identity_token.source "file" requires a non-empty path`);
    }
    return identityTokenFromFile(auth.identity_token.path);
  }

  const tokenFile = readEnv('ANTHROPIC_IDENTITY_TOKEN_FILE');
  if (tokenFile) {
    return identityTokenFromFile(tokenFile);
  }

  const tokenValue = readEnv('ANTHROPIC_IDENTITY_TOKEN');
  if (tokenValue) {
    return identityTokenFromValue(tokenValue);
  }

  return null;
}

/**
 * Wraps a federation exchange provider with credential file caching.
 * Checks the file for a fresh token before exchanging, and writes the
 * result back after a successful exchange (best-effort, atomic replace).
 *
 * Note: this is not cross-process serialized — two SDK instances that
 * miss the cache simultaneously will both perform a full exchange and
 * the last writer wins. That is acceptable: federation exchanges are
 * idempotent and the cache is an optimization, not a correctness gate.
 */
function cachedExchangeProvider(
  exchange: AccessTokenProvider,
  credentialsPath: string,
  onCacheWriteError: ((err: unknown) => void) | undefined,
  onSafetyWarning: ((msg: string) => void) | undefined,
): AccessTokenProvider {
  return async (opts) => {
    const fs = await import('node:fs');

    await checkCredentialsFileSafety(credentialsPath, onSafetyWarning);

    // Try cached credentials file
    let existing: Record<string, unknown> | undefined;
    try {
      const raw = await fs.promises.readFile(credentialsPath, 'utf-8');
      existing = JSON.parse(raw);
      const token = existing?.['access_token'] as string | undefined;
      if (token && !opts?.forceRefresh) {
        const expiresAt = existing?.['expires_at'] as number | undefined;
        if (expiresAt == null || nowAsSeconds() < expiresAt - MANDATORY_REFRESH_THRESHOLD_IN_SECONDS) {
          return { token, expiresAt: expiresAt ?? null };
        }
      }
    } catch (err) {
      // ENOENT or invalid-JSON → no usable cache, exchange fresh. Other
      // errors (EACCES, EISDIR, …) indicate a broken cache path; surface to
      // the optional hook so they're at least debuggable, then proceed.
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT' && !(err instanceof SyntaxError)) {
        onCacheWriteError?.(err);
      }
    }

    // Exchange for a new token
    const result = await exchange(opts);

    // Write cache back (best-effort). Preserve any unknown keys from the
    // existing file (notably refresh_token, in the unlikely case this path
    // is shared with a user_oauth profile) so the federation cache writer
    // doesn't clobber material it didn't own.
    try {
      await writeCredentialsFileAtomic(credentialsPath, {
        ...(existing ?? {}),
        version: CREDENTIALS_FILE_VERSION,
        type: 'oauth_token',
        access_token: result.token,
        expires_at: result.expiresAt,
      });
    } catch (err) {
      // Best-effort caching: surface to the optional hook but never fail
      // the exchange itself.
      onCacheWriteError?.(err);
    }

    return result;
  };
}
