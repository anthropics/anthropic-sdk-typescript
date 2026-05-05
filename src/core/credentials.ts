import { getPlatformHeaders } from '../internal/detect-platform';
import { readEnv } from '../internal/utils';

/** Current schema version written to `configs/<profile>.json`. Absent on read ⇒ "1.0". */
export const CONFIG_FILE_VERSION = '1.0';
/** Current schema version written to `credentials/<profile>.json`. Absent on read ⇒ "1.0". */
export const CREDENTIALS_FILE_VERSION = '1.0';

/**
 * Authentication-mode-specific configuration. On the wire (configs/<profile>.json)
 * this is a flat JSON object under the top-level `authentication` key — `type`,
 * `credentials_path`, and the variant-specific fields all sit at the same level.
 *
 * Unknown fields are silently ignored for forward compatibility. Unknown
 * authentication types are rejected because the SDK has no way to resolve
 * credentials for them.
 */
export type AuthenticationInfo = {
  /**
   * Filesystem path to the credentials JSON that stores access/refresh tokens.
   * Defaults to `<config_dir>/credentials/<profile>.json` when omitted.
   */
  credentials_path?: string | undefined;
} & (
  | {
      type: 'oidc_federation';
      /** Tagged ID (`fdrl_...`) of the federation rule. Required. */
      federation_rule_id: string;
      /** Optional `svac_...` expected-target check. */
      service_account_id?: string | undefined;
      identity_token?:
        | {
            source: 'file';
            path: string;
          }
        | undefined;
      /** Display-only; the SDK does not send this on the jwt-bearer exchange. */
      scope?: string | undefined;
    }
  | {
      type: 'user_oauth';
      /** OAuth client ID for refresh. Empty → access token is treated as static. */
      client_id?: string | undefined;
      /** Display-only; the SDK does not send this on refresh. */
      scope?: string | undefined;
      /** Console URL the profile was created against. Display-only. */
      console_url?: string | undefined;
    }
);

export type AnthropicConfig = {
  version?: string;
  authentication: AuthenticationInfo;
  base_url?: string | undefined;
  organization_id?: string | undefined;
  workspace_id?: string | undefined;
};

export type AnthropicCredentials = {
  version?: string;
  type: 'oauth_token';
  access_token: string;
  expires_at?: number;
  refresh_token?: string;
  scope?: string;
  organization_uuid?: string;
  organization_name?: string;
  account_email?: string;
};

const PROFILE_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

function validateProfileName(name: string): void {
  if (!name) {
    throw new Error('profile name is empty');
  }
  if (name === '.' || name === '..') {
    throw new Error(`profile name "${name}" is not allowed`);
  }
  if (name.includes('/') || name.includes('\\')) {
    throw new Error(`profile name "${name}" must not contain path separators`);
  }
  if (!PROFILE_NAME_PATTERN.test(name)) {
    throw new Error(
      `profile name "${name}" contains disallowed characters (allowed: letters, digits, '_', '.', '-')`,
    );
  }
}

/**
 * Loads the Anthropic configuration for the given (or active) profile.
 *
 * Returns `null` when running in a browser or no configuration can be resolved.
 * Otherwise, returns the configuration based on the config file and environment variables.
 *
 * **Profile resolution** (first match wins):
 *   1. Explicit `profile` argument
 *   2. `ANTHROPIC_PROFILE` environment variable
 *   3. Contents of `<config_dir>/active_config` file
 *   4. `"default"`
 *
 * **Config resolution:**
 *   - If `<config_dir>/configs/<profile>.json` exists, it is loaded and
 *     missing fields are filled from environment variables. Values present
 *     in the file take precedence — env vars only fill gaps:
 *       - `ANTHROPIC_BASE_URL` → `base_url`
 *       - `ANTHROPIC_ORGANIZATION_ID` → `organization_id`
 *       - `ANTHROPIC_WORKSPACE_ID` → `workspace_id`
 *       - `ANTHROPIC_SCOPE` → `authentication.scope`
 *       - `ANTHROPIC_FEDERATION_RULE_ID` → `authentication.federation_rule_id` (oidc_federation)
 *       - `ANTHROPIC_IDENTITY_TOKEN_FILE` → `authentication.identity_token` (oidc_federation)
 *       - `ANTHROPIC_SERVICE_ACCOUNT_ID` → `authentication.service_account_id` (oidc_federation)
 *   - If no config file exists, an `oidc_federation` config is synthesized
 *     entirely from environment variables when both `ANTHROPIC_FEDERATION_RULE_ID`
 *     and `ANTHROPIC_ORGANIZATION_ID` are set.
 */
export const loadConfig = async (profile?: string): Promise<AnthropicConfig | null> => {
  return (await loadConfigWithSource(profile))?.config ?? null;
};

/**
 * Source-tagged result of {@link loadConfigWithSource}. `fromFile` is `true`
 * when `<config_dir>/configs/<profile>.json` exists on disk; `false` when the
 * config was synthesized purely from environment variables.
 *
 * The credential chain uses this distinction to decide whether to back the
 * federation exchange with a disk cache: file-backed profiles get a cache at
 * `<config_dir>/credentials/<profile>.json`, env-only configs do not.
 */
export type LoadedConfig = { config: AnthropicConfig; fromFile: boolean };

/**
 * Same as {@link loadConfig}, but also reports whether the config was loaded
 * from a profile file on disk (`fromFile: true`) or synthesized entirely from
 * environment variables (`fromFile: false`).
 */
export const loadConfigWithSource = async (profile?: string): Promise<LoadedConfig | null> => {
  const rootConfigPath = await getRootConfigPath();
  if (rootConfigPath === null) {
    return null;
  }

  const profileName = profile ?? (await getActiveProfileName());
  if (profileName === null) {
    return null;
  }
  validateProfileName(profileName);

  const fs = await import('node:fs');
  const path = await import('node:path');
  const configPath = path.join(rootConfigPath, 'configs', `${profileName}.json`);
  let configRaw: string | null;
  try {
    configRaw = await fs.promises.readFile(configPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw new Error(`failed to read config file ${configPath}: ${err}`);
    }
    configRaw = null;
  }
  if (configRaw === null) {
    const organizationId = readEnv('ANTHROPIC_ORGANIZATION_ID');
    const identityTokenFile = readEnv('ANTHROPIC_IDENTITY_TOKEN_FILE');
    const federationRuleId = readEnv('ANTHROPIC_FEDERATION_RULE_ID');
    if (federationRuleId && organizationId) {
      return {
        fromFile: false,
        config: {
          organization_id: organizationId,
          // A defaulted-but-empty CI variable (`ANTHROPIC_WORKSPACE_ID=""`) is
          // treated as unset — readEnv coerces empty to undefined, and the body
          // builder's truthy check skips it — so `"workspace_id": ""` never goes
          // on the wire.
          workspace_id: readEnv('ANTHROPIC_WORKSPACE_ID'),
          base_url: readEnv('ANTHROPIC_BASE_URL'),
          authentication: {
            type: 'oidc_federation',
            federation_rule_id: federationRuleId,
            service_account_id: readEnv('ANTHROPIC_SERVICE_ACCOUNT_ID'),
            identity_token: identityTokenFile ? { source: 'file', path: identityTokenFile } : undefined,
            scope: readEnv('ANTHROPIC_SCOPE'),
          },
        },
      };
    }
    return null;
  }

  let config: AnthropicConfig;
  try {
    config = JSON.parse(configRaw);
  } catch (err) {
    throw new Error(`failed to parse config file ${configPath}: ${err}`);
  }
  if (!config.authentication) {
    throw new Error(`config file ${configPath} is missing "authentication"`);
  }
  const authType = config.authentication.type;
  if (authType !== 'oidc_federation' && authType !== 'user_oauth') {
    throw new Error(`authentication.type "${authType}" is not a known authentication type`);
  }

  // File values are authoritative; env vars only fill fields the file left unset.
  config.organization_id ??= readEnv('ANTHROPIC_ORGANIZATION_ID');
  config.workspace_id ??= readEnv('ANTHROPIC_WORKSPACE_ID');
  config.base_url ??= readEnv('ANTHROPIC_BASE_URL');
  config.authentication.scope ??= readEnv('ANTHROPIC_SCOPE');

  if (config.authentication.type === 'oidc_federation') {
    if (!config.authentication.identity_token) {
      const identityTokenFile = readEnv('ANTHROPIC_IDENTITY_TOKEN_FILE');
      if (identityTokenFile) {
        config.authentication.identity_token = {
          source: 'file',
          path: identityTokenFile,
        };
      }
    }

    // Unlike siblings using `??= readEnv()` (which leaves `undefined`), coerce
    // to '' so the type stays `string` (always set). The downstream required
    // check in credential-chain rejects empty, so semantics match but types are
    // cleaner.
    if (!config.authentication.federation_rule_id) {
      config.authentication.federation_rule_id = readEnv('ANTHROPIC_FEDERATION_RULE_ID') ?? '';
    }
    config.authentication.service_account_id ??= readEnv('ANTHROPIC_SERVICE_ACCOUNT_ID');
  }

  return { config, fromFile: true };
};

/**
 * Loads the credential material for the active profile.
 *
 * Returns the parsed credentials or `null` when running in a browser or
 * no credentials file can be found.
 *
 * **Profile resolution** (first match wins):
 *   1. `ANTHROPIC_PROFILE` environment variable
 *   2. Contents of `<config_dir>/active_config` file
 *   3. `"default"`
 *
 * **Credentials path resolution** (first match wins):
 *   1. `authentication.credentials_path` from the active profile's config (via {@link loadConfig})
 *   2. `<config_dir>/credentials/<profile>.json`
 */
export const loadCredentials = async (): Promise<AnthropicCredentials | null> => {
  const config = await loadConfig();
  const credentialsPath = await getCredentialsPath(config);
  if (!credentialsPath) {
    return null;
  }

  const fs = await import('node:fs');
  let raw: string;
  try {
    raw = await fs.promises.readFile(credentialsPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw new Error(`failed to read credentials file ${credentialsPath}: ${err}`);
    }
    return null;
  }

  let creds: AnthropicCredentials;
  try {
    creds = JSON.parse(raw);
  } catch (err) {
    throw new Error(`failed to parse credentials file ${credentialsPath}: ${err}`);
  }
  if (creds.type && creds.type !== 'oauth_token') {
    throw new Error(
      `credentials file ${credentialsPath} has unsupported type "${creds.type}" (want "oauth_token")`,
    );
  }
  return creds;
};

/**
 * Resolves the credentials file path for the given config.
 *
 * Uses `authentication.credentials_path` from the config if set, otherwise
 * falls back to `<config_dir>/credentials/<profile>.json`.
 *
 * Returns `null` when running in a browser or the path cannot be resolved.
 */
export const getCredentialsPath = async (
  config: AnthropicConfig | null,
  profile?: string,
): Promise<string | null> => {
  if (config?.authentication.credentials_path) {
    return config.authentication.credentials_path;
  }

  const rootConfigPath = await getRootConfigPath();
  if (!rootConfigPath) {
    return null;
  }

  const profileName = profile ?? (await getActiveProfileName());
  if (!profileName) {
    return null;
  }
  validateProfileName(profileName);

  const path = await import('node:path');
  return path.join(rootConfigPath, 'credentials', `${profileName}.json`);
};

const getRootConfigPath = async (): Promise<string | null> => {
  if (!supportsLocalConfigFiles()) {
    return null;
  }

  const path = await import('node:path');

  // ANTHROPIC_CONFIG_DIR is treated as a trusted path: it is set by the
  // process operator, not by remote input, so it is not validated.
  const configDir = readEnv('ANTHROPIC_CONFIG_DIR');
  if (configDir) {
    return configDir;
  }

  const os = getPlatformHeaders()['X-Stainless-OS'];
  if (os === 'Windows') {
    const appData = readEnv('APPDATA');
    if (appData) {
      return path.join(appData, 'Anthropic');
    }
    const userProfile = readEnv('USERPROFILE');
    if (userProfile) {
      return path.join(userProfile, 'AppData', 'Roaming', 'Anthropic');
    }
    // No usable Windows config root — return null so callers fall through to
    // "no config available" rather than silently writing under C:\.
    return null;
  }

  const xdgConfigHome = readEnv('XDG_CONFIG_HOME');
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, 'anthropic');
  }

  const home = readEnv('HOME');
  if (home) {
    return path.join(home, '.config', 'anthropic');
  }
  return null;
};

const supportsLocalConfigFiles = (): boolean => {
  const runtime = getPlatformHeaders()['X-Stainless-Runtime'];
  return runtime === 'node' || runtime === 'deno';
};

const getActiveProfileName = async (): Promise<string | null> => {
  const rootConfigPath = await getRootConfigPath();
  if (!rootConfigPath) {
    return null;
  }

  const profileName = readEnv('ANTHROPIC_PROFILE');
  if (profileName) {
    return profileName;
  }

  const fs = await import('node:fs');
  const path = await import('node:path');
  const filePath = path.join(rootConfigPath, 'active_config');
  try {
    return (await fs.promises.readFile(filePath, 'utf-8')).trim() || 'default';
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw new Error(`failed to read ${filePath}: ${err}`);
    }
    return 'default';
  }
};
