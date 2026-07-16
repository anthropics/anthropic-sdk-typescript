import path from 'node:path';
import { AnthropicGoogleCloud } from '../src';
import { GoogleAuth } from 'google-auth-library';

// A fully-resolvable Anthropic profile (config + oauth credentials + base_url)
// that the base client's credential chain would adopt if it ever ran.
const PROFILE_FIXTURE_DIR = path.join(__dirname, 'fixtures', 'anthropic-config');

const mockFetch = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('{}'),
  });
});
const originalFetch = global.fetch;

const makeRequest = async (client: AnthropicGoogleCloud) => {
  await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{ content: 'Test message', role: 'user' }],
  });
};

const getRequestHeaders = (): Headers => {
  const [, options] = mockFetch.mock.calls[0]!;
  return options.headers as Headers;
};

describe('AnthropicGoogleCloud', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockClear();
    // Keep the suite hermetic: without this, constructing a client with no
    // bearerTokenProvider/authClient starts a real ADC probe (keyfile reads
    // and a GCE metadata request) whose outcome depends on the machine.
    jest.spyOn(GoogleAuth.prototype, 'getClient').mockResolvedValue({
      getAccessToken: jest.fn().mockResolvedValue({ token: 'adc-token' }),
    } as any);
    process.env = { ...originalEnv };
    delete process.env['ANTHROPIC_API_KEY'];
    delete process.env['ANTHROPIC_AUTH_TOKEN'];
    delete process.env['ANTHROPIC_BASE_URL'];
    delete process.env['ANTHROPIC_CONFIG_DIR'];
    delete process.env['ANTHROPIC_PROFILE'];
    delete process.env['ANTHROPIC_CUSTOM_HEADERS'];
    delete process.env['ANTHROPIC_GOOGLE_CLOUD_BASE_URL'];
    delete process.env['ANTHROPIC_GOOGLE_CLOUD_PROJECT'];
    delete process.env['ANTHROPIC_GOOGLE_CLOUD_LOCATION'];
    delete process.env['ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID'];
    delete process.env['GOOGLE_CLOUD_PROJECT'];
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('base URL derivation', () => {
    test('derives the gateway URL from project + location + workspace', () => {
      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
      });

      expect(client.baseURL).toBe(
        'https://claude.googleapis.com/v1alpha/projects/my-project/locations/us-central1/workspaces/wrkspc_test/invoke',
      );
    });

    test('location defaults to global', () => {
      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        workspaceId: 'wrkspc_test',
      });

      expect(client.location).toBe('global');
      expect(client.baseURL).toBe(
        'https://claude.googleapis.com/v1alpha/projects/my-project/locations/global/workspaces/wrkspc_test/invoke',
      );
    });

    test('explicit baseURL is used verbatim', () => {
      const client = new AnthropicGoogleCloud({
        baseURL: 'https://my-gateway.example.com',
        workspaceId: 'wrkspc_test',
      });

      expect(client.baseURL).toBe('https://my-gateway.example.com');
    });
  });

  describe('environment resolution', () => {
    test('resolves project, base URL, and workspace from env vars', () => {
      process.env['ANTHROPIC_GOOGLE_CLOUD_PROJECT'] = 'env-project';
      process.env['ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID'] = 'wrkspc_env';

      const client = new AnthropicGoogleCloud({ location: 'europe-west1' });

      expect(client.project).toBe('env-project');
      expect(client.workspaceId).toBe('wrkspc_env');
      expect(client.baseURL).toContain('claude.googleapis.com');
      expect(client.baseURL).toContain('locations/europe-west1');
      expect(client.baseURL).toContain('projects/env-project');
      expect(client.baseURL).toContain('workspaces/wrkspc_env');
    });

    test('ANTHROPIC_GOOGLE_CLOUD_BASE_URL overrides derivation', () => {
      process.env['ANTHROPIC_GOOGLE_CLOUD_BASE_URL'] = 'https://env-gateway.example.com';

      const client = new AnthropicGoogleCloud({ workspaceId: 'wrkspc_test' });

      expect(client.baseURL).toBe('https://env-gateway.example.com');
    });

    test('resolves location from ANTHROPIC_GOOGLE_CLOUD_LOCATION', () => {
      process.env['ANTHROPIC_GOOGLE_CLOUD_LOCATION'] = 'europe-west4';

      const client = new AnthropicGoogleCloud({ project: 'my-project', workspaceId: 'wrkspc_test' });

      expect(client.location).toBe('europe-west4');
      expect(client.baseURL).toContain('locations/europe-west4');
    });

    test('falls back to GOOGLE_CLOUD_PROJECT after ANTHROPIC_GOOGLE_CLOUD_PROJECT', () => {
      process.env['GOOGLE_CLOUD_PROJECT'] = 'gcp-env-project';

      const client = new AnthropicGoogleCloud({ location: 'us-central1', workspaceId: 'wrkspc_test' });

      expect(client.project).toBe('gcp-env-project');
      expect(client.baseURL).toContain('projects/gcp-env-project');
    });

    test('ANTHROPIC_GOOGLE_CLOUD_PROJECT beats GOOGLE_CLOUD_PROJECT', () => {
      process.env['ANTHROPIC_GOOGLE_CLOUD_PROJECT'] = 'anthropic-env-project';
      process.env['GOOGLE_CLOUD_PROJECT'] = 'gcp-env-project';

      const client = new AnthropicGoogleCloud({ location: 'us-central1', workspaceId: 'wrkspc_test' });

      expect(client.project).toBe('anthropic-env-project');
    });

    test('constructor args take precedence over env vars', () => {
      process.env['ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID'] = 'wrkspc_env';

      const client = new AnthropicGoogleCloud({
        location: 'us-central1',
        project: 'my-project',
        workspaceId: 'wrkspc_arg',
      });

      expect(client.workspaceId).toBe('wrkspc_arg');
    });

    test('empty-string ANTHROPIC_GOOGLE_CLOUD_* env vars are treated as unset', () => {
      // Exported-but-empty vars (common in CI templating) must not derive a ""
      // base URL or treat an empty workspace ID as set.
      process.env['ANTHROPIC_GOOGLE_CLOUD_BASE_URL'] = '';
      process.env['ANTHROPIC_GOOGLE_CLOUD_PROJECT'] = '';
      process.env['ANTHROPIC_GOOGLE_CLOUD_LOCATION'] = '';
      process.env['ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID'] = '';
      process.env['GOOGLE_CLOUD_PROJECT'] = '';

      expect(() => new AnthropicGoogleCloud({ project: 'my-project', location: 'us-central1' })).toThrow(
        'No workspace ID found',
      );

      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
      });
      expect(client.baseURL).toContain('claude.googleapis.com');
      expect(client.baseURL).toContain('projects/my-project');
    });
  });

  describe('validation', () => {
    test('throws when skipAuth is set and neither project nor baseURL is given', () => {
      // With skipAuth there are no Google credentials to resolve a project from lazily.
      expect(
        () =>
          new AnthropicGoogleCloud({ location: 'us-central1', workspaceId: 'wrkspc_test', skipAuth: true }),
      ).toThrow('No project was given');
    });

    test('throws when workspaceId is missing and skipAuth is not set', () => {
      expect(() => new AnthropicGoogleCloud({ project: 'my-project', location: 'us-central1' })).toThrow(
        'No workspace ID found',
      );
    });

    test('throws when skipAuth derivation has no workspaceId', () => {
      // The workspace ID is part of the derived base URL, so skipAuth alone no
      // longer waives it — only an explicit baseURL does.
      let error: Error | undefined;
      try {
        new AnthropicGoogleCloud({ project: 'my-project', skipAuth: true });
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toContain('No workspace ID found');
      expect(error?.message).toContain('workspaceId');
      expect(error?.message).toContain('ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID');
    });

    test('throws when both authClient and googleAuth are given', () => {
      expect(
        () =>
          new AnthropicGoogleCloud({
            baseURL: 'https://gw.example.com',
            workspaceId: 'wrkspc_test',
            authClient: {} as any,
            googleAuth: {} as any,
          }),
      ).toThrow('mutually exclusive');
    });

    test.each(['apiKey', 'authToken'])('rejects an explicit `%s` option at runtime', (key) => {
      expect(
        () =>
          new AnthropicGoogleCloud({
            baseURL: 'https://gw.example.com',
            workspaceId: 'wrkspc_test',
            [key]: 'first-party-cred',
          } as any),
      ).toThrow(`The \`${key}\` option is not supported`);
    });

    test.each([
      ['bearerTokenProvider', async () => 'token'],
      ['googleAuth', {}],
      ['authClient', {}],
    ])('throws when skipAuth is combined with %s', (key, value) => {
      expect(
        () =>
          new AnthropicGoogleCloud({
            baseURL: 'https://gw.example.com',
            skipAuth: true,
            [key]: value,
          } as any),
      ).toThrow('mutually exclusive');
    });
  });

  describe('lazy project resolution', () => {
    let getProjectIdSpy: jest.SpyInstance;

    beforeEach(() => {
      getProjectIdSpy = jest.spyOn(GoogleAuth.prototype, 'getProjectId');
    });

    test('back-fills the project from credentials; first request goes to the derived URL', async () => {
      // Must not leak in while the base URL is still unresolved.
      process.env['ANTHROPIC_BASE_URL'] = 'https://api.anthropic.com';
      getProjectIdSpy.mockResolvedValue('adc-project');

      const client = new AnthropicGoogleCloud({
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        maxRetries: 0,
      });

      expect(client.project).toBeNull();

      await makeRequest(client);

      expect(client.project).toBe('adc-project');
      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe(
        'https://claude.googleapis.com/v1alpha/projects/adc-project/locations/us-central1/workspaces/wrkspc_test/invoke/v1/messages',
      );
      expect(getRequestHeaders().get('authorization')).toBe('Bearer adc-token');
    });

    test('ready resolves with the back-filled project and base URL', async () => {
      getProjectIdSpy.mockResolvedValue('adc-project');

      const client = new AnthropicGoogleCloud({ location: 'europe-west1', workspaceId: 'wrkspc_test' });

      await expect(client.ready).resolves.toBeUndefined();
      expect(client.project).toBe('adc-project');
      expect(client.baseURL).toContain('projects/adc-project');
    });

    test('ready resolves immediately when the project is given', async () => {
      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
      });

      await expect(client.ready).resolves.toBeUndefined();
      expect(getProjectIdSpy).not.toHaveBeenCalled();
    });

    test('ready resolves immediately when an explicit baseURL is given', async () => {
      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_test',
      });

      await expect(client.ready).resolves.toBeUndefined();
      expect(getProjectIdSpy).not.toHaveBeenCalled();
    });

    test('resolves the project even when tokens come from a bearerTokenProvider', async () => {
      getProjectIdSpy.mockResolvedValue('adc-project');

      const client = new AnthropicGoogleCloud({
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider: async () => 'my-google-token',
        maxRetries: 0,
      });

      await makeRequest(client);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('projects/adc-project');
      expect(getRequestHeaders().get('authorization')).toBe('Bearer my-google-token');
    });

    test('first request rejects with a clear error when no project is resolvable', async () => {
      getProjectIdSpy.mockRejectedValue(
        new Error('Unable to detect a Project Id in the current environment.'),
      );

      const client = new AnthropicGoogleCloud({
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        maxRetries: 0,
      });

      await expect(makeRequest(client)).rejects.toThrow(
        'No project was given and it could not be resolved from Google credentials. Set `project` or the ' +
          '`ANTHROPIC_GOOGLE_CLOUD_PROJECT` environment variable (or provide `baseURL`).',
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('does not emit unhandledRejection when ready rejects and is not awaited', async () => {
      getProjectIdSpy.mockRejectedValue(new Error('no project'));

      const handler = jest.fn();
      process.on('unhandledRejection', handler);
      try {
        new AnthropicGoogleCloud({ location: 'us-central1', workspaceId: 'wrkspc_test' });
        // Let any microtask/rejection settle
        await new Promise((r) => setImmediate(r));
        expect(handler).not.toHaveBeenCalled();
      } finally {
        process.off('unhandledRejection', handler);
      }
    });

    test('does not emit unhandledRejection when ADC discovery fails; the error surfaces on the first request', async () => {
      jest
        .spyOn(GoogleAuth.prototype, 'getClient')
        .mockRejectedValue(new Error('Could not load the default credentials'));

      const handler = jest.fn();
      process.on('unhandledRejection', handler);
      try {
        const client = new AnthropicGoogleCloud({
          project: 'my-project',
          location: 'us-central1',
          workspaceId: 'wrkspc_test',
          maxRetries: 0,
        });
        await new Promise((r) => setImmediate(r));
        expect(handler).not.toHaveBeenCalled();

        await expect(makeRequest(client)).rejects.toThrow('Could not load the default credentials');
      } finally {
        process.off('unhandledRejection', handler);
      }
    });

    test('prefers a caller-supplied googleAuth for project resolution even when bearerTokenProvider is set', async () => {
      getProjectIdSpy.mockResolvedValue('ambient-project');
      const googleAuth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
      jest.spyOn(googleAuth, 'getProjectId').mockResolvedValue('caller-project');

      const client = new AnthropicGoogleCloud({
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider: async () => 'my-google-token',
        googleAuth,
        maxRetries: 0,
      });

      await makeRequest(client);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('projects/caller-project');
      expect(getRequestHeaders().get('authorization')).toBe('Bearer my-google-token');
    });
  });

  describe('buildRequest gating', () => {
    test('the unresolved-state baseURL is an unroutable placeholder, never the default API host', () => {
      jest.spyOn(GoogleAuth.prototype, 'getProjectId').mockReturnValue(new Promise(() => {}));

      const client = new AnthropicGoogleCloud({ location: 'us-central1', workspaceId: 'wrkspc_test' });

      expect(client.baseURL).toBe('https://unresolved.invalid');
    });

    test('a direct buildRequest() call waits for resolution and targets the derived gateway URL', async () => {
      let resolveProject!: (project: string) => void;
      jest
        .spyOn(GoogleAuth.prototype, 'getProjectId')
        .mockReturnValue(new Promise<string>((r) => (resolveProject = r)));

      const client = new AnthropicGoogleCloud({
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider: async () => 'my-google-token',
      });

      const pending = client.buildRequest({ method: 'post', path: '/v1/messages', body: {} } as any);
      let settled = false;
      pending.then(
        () => (settled = true),
        () => (settled = true),
      );
      await new Promise((r) => setImmediate(r));
      expect(settled).toBe(false);

      resolveProject('adc-project');
      const { url, req } = await pending;
      expect(url).toBe(
        'https://claude.googleapis.com/v1alpha/projects/adc-project/locations/us-central1/workspaces/wrkspc_test/invoke/v1/messages',
      );
      expect(url).not.toContain('api.anthropic.com');
      expect((req.headers as Headers).get('authorization')).toBe('Bearer my-google-token');
    });

    test('buildRequest() rejects when resolution failed — no default-host request can carry the bearer', async () => {
      jest.spyOn(GoogleAuth.prototype, 'getProjectId').mockRejectedValue(new Error('no project'));

      const client = new AnthropicGoogleCloud({
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider: async () => 'my-google-token',
      });

      await expect(
        client.buildRequest({ method: 'post', path: '/v1/messages', body: {} } as any),
      ).rejects.toThrow('No project was given');
      // The failure must leave the unroutable placeholder in place.
      expect(client.baseURL).toBe('https://unresolved.invalid');
    });
  });

  describe('withOptions', () => {
    test('clones keep the gateway options: URL, workspace ID, and token provider', async () => {
      const bearerTokenProvider = jest.fn().mockResolvedValue('my-google-token');
      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_clone',
        bearerTokenProvider,
        maxRetries: 0,
      });

      const clone = client.withOptions({ timeout: 1234 });
      expect(clone.project).toBe('my-project');
      expect(clone.workspaceId).toBe('wrkspc_clone');
      expect(clone.timeout).toBe(1234);

      await makeRequest(clone);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('projects/my-project');
      expect(url).toContain('workspaces/wrkspc_clone');
      const headers = getRequestHeaders();
      expect(headers.get('authorization')).toBe('Bearer my-google-token');
      expect(headers.get('anthropic-workspace-id')).toBeNull();
      expect(bearerTokenProvider).toHaveBeenCalledTimes(1);
    });

    test('clones keep a caller-supplied authClient', async () => {
      const authClient = { getAccessToken: jest.fn().mockResolvedValue({ token: 'impersonated-token' }) };
      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_test',
        authClient: authClient as any,
        maxRetries: 0,
      });

      await makeRequest(client.withOptions({ maxRetries: 1 }));

      expect(authClient.getAccessToken).toHaveBeenCalledTimes(1);
      expect(getRequestHeaders().get('authorization')).toBe('Bearer impersonated-token');
    });

    test('clones keep skipAuth', async () => {
      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        skipAuth: true,
        maxRetries: 0,
      });

      const clone = client.withOptions({ timeout: 999 });
      expect(clone.skipAuth).toBe(true);

      await makeRequest(clone);
      expect(getRequestHeaders().get('authorization')).toBeNull();
    });

    test('a clone created mid-resolution resolves the project itself', async () => {
      jest.spyOn(GoogleAuth.prototype, 'getProjectId').mockResolvedValue('adc-project');

      const client = new AnthropicGoogleCloud({
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        maxRetries: 0,
      });
      const clone = client.withOptions({ timeout: 999 }); // parent still resolving

      await makeRequest(clone);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('projects/adc-project');
      expect(url).not.toContain('api.anthropic.com');
      expect(getRequestHeaders().get('authorization')).toBe('Bearer adc-token');
    });

    test('a clone created post-resolution inherits the derived URL without re-resolving', async () => {
      const getProjectIdSpy = jest
        .spyOn(GoogleAuth.prototype, 'getProjectId')
        .mockResolvedValue('adc-project');

      const client = new AnthropicGoogleCloud({
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        maxRetries: 0,
      });
      await client.ready;

      const clone = client.withOptions({ timeout: 999 });
      expect(clone.project).toBe('adc-project');
      expect(clone.baseURL).toContain('projects/adc-project');

      await makeRequest(clone);
      expect(getProjectIdSpy).toHaveBeenCalledTimes(1);
    });

    test('overriding workspaceId on a derived-URL clone re-derives the URL path', () => {
      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_a',
      });

      const clone = client.withOptions({ workspaceId: 'wrkspc_b' });
      expect(clone.workspaceId).toBe('wrkspc_b');
      expect(clone.project).toBe('my-project');
      expect(clone.baseURL).toBe(
        'https://claude.googleapis.com/v1alpha/projects/my-project/locations/us-central1/workspaces/wrkspc_b/invoke',
      );
    });

    test('overriding location on a derived-URL clone re-derives the URL path', () => {
      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_a',
      });

      const clone = client.withOptions({ location: 'europe-west4' });
      expect(clone.location).toBe('europe-west4');
      expect(clone.baseURL).toBe(
        'https://claude.googleapis.com/v1alpha/projects/my-project/locations/europe-west4/workspaces/wrkspc_a/invoke',
      );
    });

    test('an explicit baseURL passes through clones even when gateway options change', () => {
      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_a',
      });

      const clone = client.withOptions({ workspaceId: 'wrkspc_b' });
      expect(clone.baseURL).toBe('https://gw.example.com');
      expect(clone.workspaceId).toBe('wrkspc_b');
    });

    test('a clone created mid-resolution derives with its overridden workspaceId', async () => {
      jest.spyOn(GoogleAuth.prototype, 'getProjectId').mockResolvedValue('adc-project');

      const client = new AnthropicGoogleCloud({
        location: 'us-central1',
        workspaceId: 'wrkspc_a',
        maxRetries: 0,
      });
      const clone = client.withOptions({ workspaceId: 'wrkspc_b' }); // parent still resolving

      await makeRequest(clone);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('projects/adc-project');
      expect(url).toContain('workspaces/wrkspc_b');
      expect(getRequestHeaders().get('anthropic-workspace-id')).toBeNull();
    });
  });

  describe('auth headers', () => {
    test('sends a bearer token from bearerTokenProvider and no workspace header', async () => {
      const bearerTokenProvider = jest.fn().mockResolvedValue('my-google-token');

      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_abc',
        bearerTokenProvider,
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(bearerTokenProvider).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe(
        'https://claude.googleapis.com/v1alpha/projects/my-project/locations/us-central1/workspaces/wrkspc_abc/invoke/v1/messages',
      );

      const headers = getRequestHeaders();
      expect(headers.get('authorization')).toBe('Bearer my-google-token');
      // The workspace ID travels only in the URL path, never as a header.
      expect(headers.get('anthropic-workspace-id')).toBeNull();
      expect(headers.get('anthropic-version')).toBeTruthy();
    });

    test('uses a google-auth AuthClient when no bearerTokenProvider is given', async () => {
      const authClient = { getAccessToken: jest.fn().mockResolvedValue({ token: 'adc-token' }) };

      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_test',
        authClient: authClient as any,
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(authClient.getAccessToken).toHaveBeenCalledTimes(1);
      const headers = getRequestHeaders();
      expect(headers.get('authorization')).toBe('Bearer adc-token');
    });

    test('a constructor defaultHeaders Authorization suppresses the token fetch', async () => {
      const bearerTokenProvider = jest.fn();
      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_test',
        defaultHeaders: { Authorization: 'Bearer caller-token' },
        bearerTokenProvider,
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(bearerTokenProvider).not.toHaveBeenCalled();
      const headers = getRequestHeaders();
      expect(headers.get('authorization')).toBe('Bearer caller-token');
      expect(headers.get('anthropic-workspace-id')).toBeNull();
    });

    test('a per-request `Authorization: null` sends the request unauthenticated', async () => {
      const bearerTokenProvider = jest.fn();
      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider,
        maxRetries: 0,
      });

      await client.messages.create(
        {
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          messages: [{ content: 'Test message', role: 'user' }],
        },
        { headers: { Authorization: null } },
      );

      expect(bearerTokenProvider).not.toHaveBeenCalled();
      expect(getRequestHeaders().get('authorization')).toBeNull();
    });

    test('an Authorization in ANTHROPIC_CUSTOM_HEADERS wins under the only-if-absent contract', async () => {
      // Exactly one Authorization header goes out — the env-supplied one — and
      // the token provider is never called.
      process.env['ANTHROPIC_CUSTOM_HEADERS'] = 'Authorization: Bearer env-token';
      const bearerTokenProvider = jest.fn();

      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider,
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(bearerTokenProvider).not.toHaveBeenCalled();
      const headers = getRequestHeaders();
      expect(headers.get('authorization')).toBe('Bearer env-token');
      // Headers normalises the merge — guard against a duplicate slipping in.
      expect([...headers.entries()].filter(([k]) => k === 'authorization')).toHaveLength(1);
      expect(headers.get('anthropic-workspace-id')).toBeNull();
    });

    test('an explicit credential source suppresses ADC discovery', async () => {
      const getClientSpy = jest.spyOn(GoogleAuth.prototype, 'getClient');
      getClientSpy.mockClear();

      const provider = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider: async () => 'my-google-token',
        maxRetries: 0,
      });
      await makeRequest(provider);
      expect(getClientSpy).not.toHaveBeenCalled();

      const authClient = { getAccessToken: jest.fn().mockResolvedValue({ token: 'tok' }) };
      const explicit = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_test',
        authClient: authClient as any,
        maxRetries: 0,
      });
      await makeRequest(explicit);
      expect(getClientSpy).not.toHaveBeenCalled();
    });

    test('passes ANTHROPIC_CUSTOM_HEADERS through without a workspace header', async () => {
      process.env['ANTHROPIC_CUSTOM_HEADERS'] = 'x-my-trace: abc';

      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider: async () => 'my-google-token',
        maxRetries: 0,
      });

      await makeRequest(client);

      const headers = getRequestHeaders();
      expect(headers.get('x-my-trace')).toBe('abc');
      expect(headers.get('anthropic-workspace-id')).toBeNull();
      expect(headers.get('authorization')).toBe('Bearer my-google-token');
    });

    test('the bearer token never appears in debug logs', async () => {
      const logged: string[] = [];
      const push = (...args: unknown[]) => {
        logged.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      };
      const logger = { debug: push, info: push, warn: push, error: push };
      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider: async () => 'my-google-token',
        maxRetries: 0,
        logger,
        logLevel: 'debug',
      });

      await makeRequest(client);

      const all = logged.join('\n');
      expect(all).toContain('sending request');
      expect(all).not.toContain('my-google-token');
    });
  });

  describe('no env-credential leak', () => {
    test('does not send x-api-key even when ANTHROPIC_API_KEY is set', async () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-should-not-leak';

      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider: async () => 'my-google-token',
        maxRetries: 0,
      });

      expect(client.apiKey).toBeNull();

      await makeRequest(client);

      const headers = getRequestHeaders();
      expect(headers.get('x-api-key')).toBeNull();
      expect(headers.get('authorization')).toBe('Bearer my-google-token');
    });

    test('does not send a base-derived Authorization even when ANTHROPIC_AUTH_TOKEN is set', async () => {
      process.env['ANTHROPIC_AUTH_TOKEN'] = 'base-token-should-not-leak';

      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider: async () => 'my-google-token',
        maxRetries: 0,
      });

      expect(client.authToken).toBeNull();

      await makeRequest(client);

      // The bearer must be ours only.
      expect(getRequestHeaders().get('authorization')).toBe('Bearer my-google-token');
    });

    test('does not inherit ANTHROPIC_BASE_URL', () => {
      process.env['ANTHROPIC_BASE_URL'] = 'https://api.anthropic.com';

      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
      });

      expect(client.baseURL).toContain('claude.googleapis.com');
    });

    test('skipAuth sends no Authorization even when ANTHROPIC_AUTH_TOKEN is set', async () => {
      process.env['ANTHROPIC_AUTH_TOKEN'] = 'base-token-should-not-leak';

      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        skipAuth: true,
        maxRetries: 0,
      });

      await makeRequest(client);

      expect(getRequestHeaders().get('authorization')).toBeNull();
    });
  });

  describe('profile-chain isolation', () => {
    beforeEach(() => {
      process.env['ANTHROPIC_CONFIG_DIR'] = PROFILE_FIXTURE_DIR;
    });

    test('a resolvable profile cannot rewrite the derived base URL or attach credentials', async () => {
      const client = new AnthropicGoogleCloud({
        project: 'my-project',
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        bearerTokenProvider: async () => 'my-google-token',
        maxRetries: 0,
      });

      await makeRequest(client);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('claude.googleapis.com');
      expect(url).toContain('locations/us-central1');
      expect(url).not.toContain('profile-gateway.example.com');

      const headers = getRequestHeaders();
      expect(headers.get('authorization')).toBe('Bearer my-google-token');
      // The profile token chain stamps an oauth anthropic-beta value; its
      // absence proves the chain never ran.
      expect(headers.get('anthropic-beta') ?? '').not.toContain('oauth');
    });

    test('the profile base_url cannot win the race against lazy project resolution', async () => {
      const getProjectIdSpy: jest.SpyInstance = jest.spyOn(GoogleAuth.prototype, 'getProjectId');
      getProjectIdSpy.mockResolvedValue('adc-project');

      const client = new AnthropicGoogleCloud({
        location: 'us-central1',
        workspaceId: 'wrkspc_test',
        maxRetries: 0,
      });

      await makeRequest(client);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('projects/adc-project');
      expect(url).not.toContain('profile-gateway.example.com');
      expect(getRequestHeaders().get('authorization')).toBe('Bearer adc-token');
    });

    test.each([
      ['credentials', async () => ({ token: 't', expiresAt: 0 })],
      ['config', { authentication: { type: 'user_oauth' } }],
      ['profile', 'default'],
    ])('rejects the base `%s` option at runtime', (key, value) => {
      expect(
        () =>
          new AnthropicGoogleCloud({
            baseURL: 'https://gw.example.com',
            workspaceId: 'wrkspc_test',
            [key]: value,
          } as any),
      ).toThrow(`The \`${key}\` option is not supported`);
    });
  });

  describe('skipAuth', () => {
    test('does not require a workspace ID when baseURL is explicit', () => {
      expect(
        () => new AnthropicGoogleCloud({ baseURL: 'https://gw.example.com', skipAuth: true }),
      ).not.toThrow();
    });

    test('sends neither an Authorization nor an x-api-key header', async () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-should-not-leak';

      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        skipAuth: true,
        maxRetries: 0,
      });

      await makeRequest(client);

      const headers = getRequestHeaders();
      expect(headers.get('authorization')).toBeNull();
      expect(headers.get('x-api-key')).toBeNull();
    });

    test('sends no workspace header even when a workspace ID is given', async () => {
      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_test',
        skipAuth: true,
        maxRetries: 0,
      });

      await makeRequest(client);

      const headers = getRequestHeaders();
      expect(headers.get('anthropic-workspace-id')).toBeNull();
      expect(headers.get('authorization')).toBeNull();
    });
  });

  describe('surface', () => {
    test('drops the deprecated completions resource', () => {
      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_test',
      });

      expect(() => client.completions).toThrow(
        'The deprecated text Completions API is not available on Claude Platform on Google Cloud',
      );
    });

    test('keeps messages, models, beta, and batches', () => {
      const client = new AnthropicGoogleCloud({
        baseURL: 'https://gw.example.com',
        workspaceId: 'wrkspc_test',
      });

      expect(client.messages).toBeDefined();
      expect(client.models).toBeDefined();
      expect(client.beta).toBeDefined();
      expect(client.messages.batches).toBeDefined();
    });
  });
});
