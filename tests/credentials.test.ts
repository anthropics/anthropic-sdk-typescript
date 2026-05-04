import fs, { mkdtempSync } from 'node:fs';
import {
  AnthropicConfig,
  AnthropicCredentials,
  loadConfig,
  loadCredentials,
} from '@anthropic-ai/sdk/core/credentials';
import path from 'node:path';
import { tmpdir } from 'node:os';

const isRunningInBrowserMock = jest.fn();
const osNameMock = jest.fn();
const runtimeMock = jest.fn();

jest.mock('../src/internal/detect-platform', () => ({
  isRunningInBrowser: () => isRunningInBrowserMock(),
  getPlatformHeaders: () => ({
    'X-Stainless-OS': osNameMock(),
    'X-Stainless-Runtime': runtimeMock(),
  }),
}));

describe('credentials', () => {
  let testFolder = '';
  const originalEnv = [
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_CONFIG_DIR',
    'ANTHROPIC_FEDERATION_RULE_ID',
    'ANTHROPIC_IDENTITY_TOKEN_FILE',
    'ANTHROPIC_ORGANIZATION_ID',
    'ANTHROPIC_PROFILE',
    'ANTHROPIC_SCOPE',
    'ANTHROPIC_SERVICE_ACCOUNT_ID',
    'APPDATA',
    'HOME',
    'XDG_CONFIG_HOME',
  ].reduce(
    (env, name) => {
      env[name] = process.env[name];
      return env;
    },
    {} as Record<string, string | undefined>,
  );

  const writeTestFile = (fileName: string, contents: string) => {
    const upperPath = path.join(testFolder, process.env['ANTHROPIC_CONFIG_DIR'] ? '' : 'Anthropic', fileName);
    fs.mkdirSync(path.dirname(upperPath), { recursive: true });
    fs.writeFileSync(upperPath, contents);
    try {
      const lowerPath = path.join(
        testFolder,
        process.env['ANTHROPIC_CONFIG_DIR'] ? '' : 'anthropic',
        fileName,
      );
      fs.mkdirSync(path.dirname(lowerPath), { recursive: true });
      fs.writeFileSync(lowerPath, contents);
    } catch {
      // Throws on case-insensitive systems
    }
  };

  beforeEach(() => {
    isRunningInBrowserMock.mockClear().mockReturnValue(false);
    runtimeMock.mockClear().mockReturnValue('node');
    if (process.platform === 'win32') {
      osNameMock.mockReturnValue('Windows');
    } else if (process.platform === 'darwin') {
      osNameMock.mockReturnValue('MacOS');
    } else {
      osNameMock.mockReturnValue('Linux');
    }

    testFolder = mkdtempSync(path.join(tmpdir(), 'credentials-test-'));
    process.env['ANTHROPIC_CONFIG_DIR'] = testFolder;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }

    fs.rmSync(testFolder, { recursive: true });
  });

  test('loadConfig returns null if profile does not exist', async () => {
    expect(await loadConfig()).toBe(null);
  });

  test('loadConfig loads default profile', async () => {
    const config: AnthropicConfig = {
      authentication: { type: 'user_oauth' },
    };
    writeTestFile('configs/default.json', JSON.stringify(config));

    expect(await loadConfig()).toEqual(config);
  });

  test('loadConfig loads custom active profile based on active_config file', async () => {
    const config: AnthropicConfig = {
      authentication: { type: 'user_oauth' },
    };
    writeTestFile('active_config', 'mock_test_profile');
    writeTestFile('configs/mock_test_profile.json', JSON.stringify(config));

    expect(await loadConfig()).toEqual(config);
  });

  test('loadConfig with explicit profile arg overrides ANTHROPIC_PROFILE and active_config', async () => {
    const fromEnv: AnthropicConfig = { authentication: { type: 'user_oauth' }, organization_id: 'env' };
    const fromArg: AnthropicConfig = { authentication: { type: 'user_oauth' }, organization_id: 'arg' };
    process.env['ANTHROPIC_PROFILE'] = 'env_profile';
    writeTestFile('active_config', 'pointer_profile');
    writeTestFile('configs/env_profile.json', JSON.stringify(fromEnv));
    writeTestFile('configs/arg_profile.json', JSON.stringify(fromArg));

    expect(await loadConfig('arg_profile')).toEqual(fromArg);
  });

  test('loadConfig prefers ANTHROPIC_PROFILE environment variable over active_config file', async () => {
    const mockTestConfig: AnthropicConfig = {
      authentication: { type: 'user_oauth' },
      organization_id: 'backup_config',
    };
    const preferredTestProfile: AnthropicConfig = {
      authentication: { type: 'user_oauth' },
      organization_id: 'preferred_test_profile',
    };
    process.env['ANTHROPIC_PROFILE'] = 'preferred_test_profile';
    writeTestFile('active_config', 'mock_test_profile');
    writeTestFile('configs/mock_test_profile.json', JSON.stringify(mockTestConfig));
    writeTestFile('configs/preferred_test_profile.json', JSON.stringify(preferredTestProfile));

    expect(await loadConfig()).toEqual(preferredTestProfile);
  });

  test('loadConfig: file organization_id wins over ANTHROPIC_ORGANIZATION_ID; env fills only when absent', async () => {
    writeTestFile(
      'configs/default.json',
      JSON.stringify({ authentication: { type: 'user_oauth' }, organization_id: 'from_file' }),
    );
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'from_env';
    expect((await loadConfig())?.organization_id).toBe('from_file');

    writeTestFile('configs/default.json', JSON.stringify({ authentication: { type: 'user_oauth' } }));
    expect((await loadConfig())?.organization_id).toBe('from_env');
  });

  test('loadConfig: file base_url wins over ANTHROPIC_BASE_URL; env fills only when absent', async () => {
    writeTestFile(
      'configs/default.json',
      JSON.stringify({ authentication: { type: 'user_oauth' }, base_url: 'https://from-file.example.com' }),
    );
    process.env['ANTHROPIC_BASE_URL'] = 'https://from-env.example.com';
    expect((await loadConfig())?.base_url).toBe('https://from-file.example.com');

    writeTestFile('configs/default.json', JSON.stringify({ authentication: { type: 'user_oauth' } }));
    expect((await loadConfig())?.base_url).toBe('https://from-env.example.com');
  });

  test('loadConfig: file federation_rule_id wins over ANTHROPIC_FEDERATION_RULE_ID', async () => {
    writeTestFile(
      'configs/default.json',
      JSON.stringify({
        organization_id: 'org_123',
        authentication: { type: 'oidc_federation', federation_rule_id: 'from_file' },
      }),
    );
    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'from_env';

    const cfg = await loadConfig();
    expect(cfg?.authentication.type === 'oidc_federation' && cfg.authentication.federation_rule_id).toBe(
      'from_file',
    );
  });

  test('loadConfig: file identity_token wins over ANTHROPIC_IDENTITY_TOKEN_FILE', async () => {
    writeTestFile(
      'configs/default.json',
      JSON.stringify({
        organization_id: 'org_123',
        authentication: {
          type: 'oidc_federation',
          federation_rule_id: 'rule_123',
          identity_token: { source: 'file', path: '/original/token/path' },
        },
      }),
    );
    process.env['ANTHROPIC_IDENTITY_TOKEN_FILE'] = '/from-env/token/path';

    const cfg = await loadConfig();
    expect(cfg?.authentication.type === 'oidc_federation' && cfg.authentication.identity_token).toEqual({
      source: 'file',
      path: '/original/token/path',
    });
  });

  test('loadConfig does not apply ANTHROPIC_FEDERATION_RULE_ID to non-oidc_federation configs', async () => {
    const config: AnthropicConfig = {
      authentication: { type: 'user_oauth' },
    };
    writeTestFile('configs/default.json', JSON.stringify(config));

    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'should_be_ignored';

    const result = await loadConfig();
    expect(result).toEqual(config);
    expect(result?.authentication).not.toHaveProperty('federation_rule_id');
  });

  test('loadConfig does not apply ANTHROPIC_IDENTITY_TOKEN_FILE to non-oidc_federation configs', async () => {
    const config: AnthropicConfig = {
      authentication: { type: 'user_oauth' },
    };
    writeTestFile('configs/default.json', JSON.stringify(config));

    process.env['ANTHROPIC_IDENTITY_TOKEN_FILE'] = '/should/be/ignored';

    const result = await loadConfig();
    expect(result).toEqual(config);
    expect(result?.authentication).not.toHaveProperty('identity_token');
  });

  test('loadConfig synthesizes oidc_federation config from env vars when no config file exists', async () => {
    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_01abc';
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-uuid-123';
    process.env['ANTHROPIC_IDENTITY_TOKEN_FILE'] = '/var/run/secrets/token';
    process.env['ANTHROPIC_SERVICE_ACCOUNT_ID'] = 'svac_01abc';
    process.env['ANTHROPIC_SCOPE'] = 'user:inference';

    expect(await loadConfig()).toEqual({
      organization_id: 'org-uuid-123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
        identity_token: {
          source: 'file',
          path: '/var/run/secrets/token',
        },
        service_account_id: 'svac_01abc',
        scope: 'user:inference',
      },
    });
  });

  test('loadConfig synthesizes minimal oidc_federation config from only required env vars', async () => {
    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_01abc';
    process.env['ANTHROPIC_ORGANIZATION_ID'] = 'org-uuid-123';

    expect(await loadConfig()).toEqual({
      organization_id: 'org-uuid-123',
      authentication: {
        type: 'oidc_federation',
        federation_rule_id: 'fdrl_01abc',
      },
    });
  });

  test('loadConfig returns null when no config file and only partial oidc_federation env vars', async () => {
    process.env['ANTHROPIC_FEDERATION_RULE_ID'] = 'fdrl_01abc';
    // ANTHROPIC_ORGANIZATION_ID intentionally not set

    expect(await loadConfig()).toBe(null);
  });

  test('loadConfig surfaces non-ENOENT read errors instead of falling through', async () => {
    // Create configs/default.json as a directory → EISDIR on read
    fs.mkdirSync(path.join(testFolder, 'configs', 'default.json'), { recursive: true });

    await expect(loadConfig()).rejects.toThrow(/failed to read config file/);
  });

  test('loadConfig throws descriptive error on malformed JSON', async () => {
    writeTestFile('configs/default.json', '{not json');

    await expect(loadConfig()).rejects.toThrow(/failed to parse config file .*default\.json/);
  });

  test('loadConfig throws on missing authentication', async () => {
    writeTestFile('configs/default.json', JSON.stringify({ organization_id: 'org-123' }));

    await expect(loadConfig()).rejects.toThrow('missing "authentication"');
  });

  test('loadConfig throws on unknown authentication type', async () => {
    writeTestFile('configs/default.json', JSON.stringify({ authentication: { type: 'mystery' } }));

    await expect(loadConfig()).rejects.toThrow('not a known authentication type');
  });

  test('loadConfig tolerates unknown keys (forward-compat)', async () => {
    writeTestFile(
      'configs/default.json',
      JSON.stringify({
        authentication: { type: 'user_oauth', client_id: 'abc', _comment: 'ignored', future_field: 42 },
        future_top_level: 'ignored',
      }),
    );

    const result = await loadConfig();
    expect(result?.authentication.type).toBe('user_oauth');
    expect((result?.authentication as { client_id?: string }).client_id).toBe('abc');
  });

  test('loadConfig rejects profile names with path separators', async () => {
    process.env['ANTHROPIC_PROFILE'] = '../etc';
    await expect(loadConfig()).rejects.toThrow('must not contain path separators');
  });

  test('loadCredentials returns null if profile does not exist', async () => {
    expect(await loadCredentials()).toBe(null);
  });

  test('loadCredentials loads credentials for default profile', async () => {
    const credentials: AnthropicCredentials = {
      type: 'oauth_token',
      access_token: 'foobar',
      expires_at: 123,
    };
    writeTestFile('credentials/default.json', JSON.stringify(credentials));

    expect(await loadCredentials()).toEqual(credentials);
  });

  test('loadCredentials loads credentials for custom active profile', async () => {
    const credentials: AnthropicCredentials = {
      type: 'oauth_token',
      access_token: 'barbaz',
      expires_at: 456,
    };
    writeTestFile('active_config', 'mock_test_profile');
    writeTestFile('credentials/mock_test_profile.json', JSON.stringify(credentials));

    expect(await loadCredentials()).toEqual(credentials);
  });

  test('loadCredentials rejects unsupported credentials type', async () => {
    writeTestFile('credentials/default.json', JSON.stringify({ type: 'api_key', access_token: 'x' }));

    await expect(loadCredentials()).rejects.toThrow('unsupported type "api_key"');
  });

  test('loadCredentials tolerates missing type (treats as oauth_token)', async () => {
    writeTestFile('credentials/default.json', JSON.stringify({ access_token: 'x' }));

    expect(await loadCredentials()).toEqual({ access_token: 'x' });
  });

  test('loadCredentials loads file from credentials_path in config', async () => {
    process.env['ANTHROPIC_PROFILE'] = 'credentials_path_test';
    const credentialsFilePath = path.join(testFolder, 'test-credentials.json');
    const config: AnthropicConfig = {
      organization_id: '...',
      authentication: { type: 'user_oauth', credentials_path: credentialsFilePath },
    };
    writeTestFile('configs/credentials_path_test.json', JSON.stringify(config));

    const credentials: AnthropicCredentials = {
      type: 'oauth_token',
      access_token: 'token-123',
      expires_at: 789,
    };
    writeTestFile('test-credentials.json', JSON.stringify(credentials));

    expect(await loadCredentials()).toEqual(credentials);
  });
});
