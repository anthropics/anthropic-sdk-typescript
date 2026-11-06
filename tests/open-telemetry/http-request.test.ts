import { type Attributes } from '@opentelemetry/api';
import { BasicTracerProvider, SamplingDecision } from '@opentelemetry/sdk-trace-base';
import Anthropic from '@anthropic-ai/sdk';
import type { Middleware } from '@anthropic-ai/sdk';
import { makeClient, json, MESSAGE, PARAMS, onlySpan, spans, setUpTracing } from './utils';

setUpTracing();

const HTTP_ATTRIBUTES = [
  'http.request.method',
  'http.request.resend_count',
  'http.route',
  'url.scheme',
  'url.path',
  'url.query',
  'url.full',
];

/** The HTTP request attributes of `attributes`, without any other. */
const httpAttributes = (attributes: Attributes) =>
  Object.fromEntries(
    HTTP_ATTRIBUTES.flatMap((name) => (name in attributes ? [[name, attributes[name]]] : [])),
  );

const LIST_PAGE = json({ data: [], has_more: false, first_id: null, last_id: null, next_page: null });
const RETRIED = json({ type: 'error', error: { type: 'api_error' } }, 500, { 'retry-after-ms': '0' });

describe('OpenTelemetry spans', () => {
  describe('the HTTP request', () => {
    test('a span has the method, the route and the parts of the URL of its request', async () => {
      const { client } = makeClient([json(MESSAGE), json({ id: 'file_1', type: 'file' })], {
        baseURL: 'https://api.example.com/prefix/',
      });

      await client.messages.create(PARAMS);
      await client.beta.files.retrieveMetadata('file 1');

      expect(httpAttributes(onlySpan('anthropic.messages.create').attributes)).toEqual({
        'http.request.method': 'POST',
        'http.route': '/v1/messages',
        'url.scheme': 'https',
        'url.path': '/prefix/v1/messages',
        'url.full': 'https://api.example.com/prefix/v1/messages',
      });
      expect(httpAttributes(onlySpan('anthropic.files.retrieve_metadata').attributes)).toEqual({
        'http.request.method': 'GET',
        'http.route': '/v1/files/{file_id}',
        'url.scheme': 'https',
        'url.path': '/prefix/v1/files/file%201',
        'url.full': 'https://api.example.com/prefix/v1/files/file%201',
      });
    });

    test('a sampler sees the route', async () => {
      const seen: Attributes[] = [];
      const sampling = new BasicTracerProvider({
        sampler: {
          shouldSample: (_context, _traceId, _name, _kind, attributes) => {
            seen.push(attributes);
            return { decision: SamplingDecision.RECORD_AND_SAMPLED };
          },
          toString: () => 'a sampler that records what it is given',
        },
      });
      const { client } = makeClient([json({ id: 'msgbatch_1' }), LIST_PAGE], {
        openTelemetry: { tracerProvider: sampling },
      });

      await client.messages.batches.retrieve('msgbatch_1');
      await client.beta.sessions.list({ limit: 1 });

      expect(seen.map(httpAttributes)).toEqual([
        { 'http.route': '/v1/messages/batches/{message_batch_id}' },
        { 'http.route': '/v1/sessions' },
      ]);
    });

    test('the URL keeps an explicit port, and the brackets of an IPv6 address', async () => {
      const { client } = makeClient([json(MESSAGE)], { baseURL: 'http://[::1]:8080' });

      await client.messages.create(PARAMS);

      expect(onlySpan('anthropic.messages.create').attributes).toMatchObject({
        'server.address': '::1',
        'server.port': 8080,
        'url.scheme': 'http',
        'url.full': 'http://[::1]:8080/v1/messages',
      });
    });

    test.each([
      ['https://api.example.com', 'api.example.com', 443, 'https://api.example.com/v1/messages'],
      ['http://api.example.com/prefix', 'api.example.com', 80, 'http://api.example.com/prefix/v1/messages'],
      ['https://api.example.com:8443', 'api.example.com', 8443, 'https://api.example.com:8443/v1/messages'],
    ])(
      'the server of %s is its host, and its port or else the one of its scheme',
      async (baseURL, address, port, full) => {
        const { client } = makeClient([json(MESSAGE)], { baseURL });

        await client.messages.create(PARAMS);

        // The URL has a port only when the request's has one.
        expect(onlySpan('anthropic.messages.create').attributes).toMatchObject({
          'server.address': address,
          'server.port': port,
          'url.full': full,
        });
      },
    );

    describe('the query', () => {
      const query = async (call: (client: Anthropic) => PromiseLike<unknown>, options = {}) => {
        const { client, requests } = makeClient([LIST_PAGE], options);
        await call(client);
        const [span] = spans();
        return {
          sent: new URL(requests[0]!.url).search,
          query: span!.attributes['url.query'],
          full: span!.attributes['url.full'],
        };
      };

      test('has the parameters of the endpoint as they were sent, in their order', async () => {
        const recorded = await query((client) =>
          client.beta.files.list({ limit: 2, ids: ['file 1', 'file&2'], scope_id: 'a/b' }),
        );

        expect(recorded.sent).toBe('?limit=2&ids%5B%5D=file%201&ids%5B%5D=file%262&scope_id=a%2Fb');
        expect(recorded.query).toBe('limit=2&ids%5B%5D=file%201&ids%5B%5D=file%262&scope_id=a%2Fb');
        expect(recorded.full).toBe(`http://localhost:4010/v1/files?${recorded.query}`);
      });

      test('keeps a parameter whose name has brackets of its own', async () => {
        const recorded = await query((client) =>
          client.beta.sessions.list({ 'created_at[gte]': '2026-01-01T00:00:00Z', statuses: ['idle'] }),
        );

        expect(recorded.query).toBe('created_at%5Bgte%5D=2026-01-01T00%3A00%3A00Z&statuses%5B%5D=idle');
      });

      test.each([
        [
          'models.list',
          (client: Anthropic) => client.models.list({ lifecycle: ['retired'], limit: 2 }),
          'lifecycle%5B%5D=retired&limit=2',
        ],
        [
          'beta.models.list',
          (client: Anthropic) => client.beta.models.list({ lifecycle: ['retired'], limit: 2 }),
          'lifecycle%5B%5D=retired&limit=2',
        ],
        [
          'organization.workspaces.list',
          (client: Anthropic) => client.organization.workspaces.list({ include_default: true, limit: 2 }),
          'include_default=true&limit=2',
        ],
        [
          'beta.organization.workspaces.list',
          (client: Anthropic) =>
            client.beta.organization.workspaces.list({ include_default: true, limit: 2 }),
          'include_default=true&limit=2',
        ],
        [
          'beta.sessions.threads.list',
          (client: Anthropic) =>
            client.beta.sessions.threads.list('sesn_1', { statuses: ['idle'], limit: 2 }),
          'statuses%5B%5D=idle&limit=2',
        ],
      ])('%s has the filter of its list beside the page parameters', async (_name, call, expected) => {
        const recorded = await query(call);

        expect(recorded.query).toBe(expected);
      });

      test('leaves out what the endpoint does not define', async () => {
        const recorded = await query(
          (client) =>
            client.beta.sessions.list(
              {},
              // `created_at` alone is not a parameter of the endpoint; `created_at[gte]` is.
              {
                query: {
                  token: 'secret',
                  limit: 3,
                  created_at: { gte: 'a', other: 'b' },
                  // `limit` is a parameter of the endpoint; a name that only starts with it is not.
                  'limit[x]': 4,
                  'limit[x][y]': 5,
                },
              },
            ),
          { defaultQuery: { api_key: 'secret' } },
        );

        expect(recorded.sent).toContain('api_key=secret');
        expect(recorded.sent).toContain('token=secret');
        expect(recorded.sent).toContain('created_at%5Bother%5D=b');
        expect(recorded.sent).toContain('limit%5Bx%5D=4');
        expect(recorded.sent).toContain('limit%5Bx%5D%5By%5D=5');
        expect(recorded.query).toBe('limit=3&created_at%5Bgte%5D=a');
      });

      test.each([
        [
          'only parameters that the endpoint does not define',
          (client: Anthropic) => client.beta.files.list(),
        ],
        ['no query string', (client: Anthropic) => client.models.list()],
        [
          'a query string for an endpoint that defines no parameter',
          (client: Anthropic) => client.messages.create(PARAMS, { query: { token: 'secret' } }),
        ],
      ])('is absent from a URL with %s', async (_, call) => {
        const recorded = await query(call);

        expect(recorded.query).toBeUndefined();
        expect(recorded.full).not.toContain('?');
      });

      describe.each([
        // Content on every endpoint that defines them: their methods name no content parameter.
        [
          'email',
          (client: Anthropic) => client.beta.organization.users.list({ email: 'a@example.com', limit: 2 }),
          '/v1/organizations/users',
          'email=a%40example.com&limit=2',
        ],
        [
          'path_prefix',
          (client: Anthropic) =>
            client.beta.memoryStores.memories.list('memstore_1', { path_prefix: '/notes/' }),
          '/v1/memory_stores/memstore_1/memories',
          'path_prefix=%2Fnotes%2F',
        ],
        [
          'expected_content_sha256',
          (client: Anthropic) =>
            client.beta.memoryStores.memories.delete('mem_1', {
              memory_store_id: 'memstore_1',
              expected_content_sha256: 'abc123',
            }),
          '/v1/memory_stores/memstore_1/memories/mem_1',
          'expected_content_sha256=abc123',
        ],
        // These three match a name in `filter` like a search, so it is content on them alone.
        [
          'filter on the analytics skills list',
          (client: Anthropic) =>
            client.beta.organization.analytics.skills.list({ filter: ['skill_name:Quarterly'], limit: 2 }),
          '/v1/organizations/analytics/skills',
          'filter%5B%5D=skill_name%3AQuarterly&limit=2',
        ],
        [
          'filter on the analytics plugins list',
          (client: Anthropic) =>
            client.beta.organization.analytics.plugins.list({ filter: ['plugin_name:Quarterly'] }),
          '/v1/organizations/analytics/plugins',
          'filter%5B%5D=plugin_name%3AQuarterly',
        ],
        [
          'filter on the analytics connectors list',
          (client: Anthropic) =>
            client.beta.organization.analytics.connectors.list({ filter: ['connector_name:Quarterly'] }),
          '/v1/organizations/analytics/connectors',
          'filter%5B%5D=connector_name%3AQuarterly',
        ],
        // The cursor of these two holds a value of the last row: an email address, or a memory's path.
        [
          'page on the analytics users list',
          (client: Anthropic) => client.beta.organization.analytics.users.list({ limit: 2, page: 'page_2' }),
          '/v1/organizations/analytics/users',
          'limit=2&page=page_2',
        ],
        [
          'page on the memories list',
          (client: Anthropic) => client.beta.memoryStores.memories.list('memstore_1', { page: 'page_2' }),
          '/v1/memory_stores/memstore_1/memories',
          'page=page_2',
        ],
      ])('with %s, whose value is content', (_param, call, path, recorded) => {
        test('is absent, with the full URL, unless the client records content', async () => {
          const { client } = makeClient([LIST_PAGE]);

          await call(client);

          const { attributes } = spans()[0]!;
          expect(attributes).not.toHaveProperty('url.query');
          expect(attributes).not.toHaveProperty('url.full');
          expect(attributes).toMatchObject({ 'url.scheme': 'http', 'url.path': path });
          expect(attributes['http.route']).toEqual(expect.any(String));
        });

        test('is present, with the full URL, when the client records content', async () => {
          const { client } = makeClient([LIST_PAGE], {
            openTelemetry: { traces: { contentMode: 'content' } },
          });

          await call(client);

          expect(spans()[0]!.attributes).toMatchObject({
            'url.path': path,
            'url.query': recorded,
            'url.full': `http://localhost:4010${path}?${recorded}`,
          });
        });
      });

      test('a method of the Organization API has its route, and its query follows the same rule', async () => {
        const list = (client: Anthropic) =>
          client.organization.users.list({ email: 'a@example.com', limit: 2 });

        await list(makeClient([LIST_PAGE]).client);
        await list(makeClient([LIST_PAGE], { openTelemetry: { traces: { contentMode: 'content' } } }).client);

        const [withoutContent, withContent] = spans('anthropic.organization.users.list');
        const request = {
          'http.request.method': 'GET',
          'http.route': '/v1/organizations/users',
          'url.scheme': 'http',
          'url.path': '/v1/organizations/users',
        };
        expect(httpAttributes(withoutContent!.attributes)).toEqual(request);
        expect(httpAttributes(withContent!.attributes)).toEqual({
          ...request,
          'url.query': 'email=a%40example.com&limit=2',
          'url.full': 'http://localhost:4010/v1/organizations/users?email=a%40example.com&limit=2',
        });
      });

      test.each(['metadata_only', 'content'] as const)(
        'a parameter whose value is not content is present with contentMode %s',
        async (contentMode) => {
          const recorded = await query(
            // `email_domain` is not a parameter of the endpoint, and `email` is not in the URL.
            (client) => client.beta.organization.users.list({}, { query: { limit: 2, email_domain: 'x' } }),
            { openTelemetry: { traces: { contentMode } } },
          );

          expect(recorded.sent).toContain('email_domain=x');
          expect(recorded.query).toBe('limit=2');
          expect(recorded.full).toBe('http://localhost:4010/v1/organizations/users?limit=2');
        },
      );

      test.each([
        [
          '/v1/organizations/analytics/users',
          (client: Anthropic) =>
            client.beta.organization.analytics.users.list({ filter: ['user_id:user_1'] }),
          'filter%5B%5D=user_id%3Auser_1',
        ],
        [
          '/v1/organizations/analytics/artifacts',
          (client: Anthropic) =>
            client.beta.organization.analytics.artifacts.list({
              date: '2026-01-01',
              filter: ['user_id:user_1'],
            }),
          'date=2026-01-01&filter%5B%5D=user_id%3Auser_1',
        ],
        [
          '/v1/organizations/analytics/apps/chat/projects',
          (client: Anthropic) =>
            client.beta.organization.analytics.apps.chat.projects.list({ filter: ['user_id:user_1'] }),
          'filter%5B%5D=user_id%3Auser_1',
        ],
        [
          '/v1/organizations/analytics/summaries',
          (client: Anthropic) =>
            client.beta.organization.analytics.summaries.list({
              starting_date: '2026-01-01',
              filter: ['product:chat'],
            }),
          'starting_date=2026-01-01&filter%5B%5D=product%3Achat',
        ],
      ])(
        'filter on %s, which takes only IDs and fixed values, is present when the client records no content',
        async (path, call, recorded) => {
          const { client } = makeClient([LIST_PAGE]);

          await call(client);

          expect(spans()[0]!.attributes).toMatchObject({
            'http.route': path,
            'url.path': path,
            'url.query': recorded,
            'url.full': `http://localhost:4010${path}?${recorded}`,
          });
        },
      );

      test('a later page has the content parameters of the first', async () => {
        const { client } = makeClient([json({ data: [], next_page: 'page_2' }), LIST_PAGE]);
        const list = client.beta.organization.analytics.skills.list({ filter: ['skill_name:Quarterly'] });

        await (await list).getNextPage();

        const [first, second] = spans('anthropic.organization.analytics.skills.list');
        expect(httpAttributes(second!.attributes)).toEqual(httpAttributes(first!.attributes));
        expect(second!.attributes).not.toHaveProperty('url.query');
        expect(second!.attributes).not.toHaveProperty('url.full');
      });

      test('a later page has the route and the parameters of the first', async () => {
        const page = (id: string, more: boolean) =>
          json({ data: [{ id, type: 'model' }], has_more: more, first_id: id, last_id: id });
        const { client } = makeClient([page('a', true), page('b', false)]);

        await (await client.models.list({ limit: 1 })).getNextPage();

        expect(spans('anthropic.models.list').map((span) => httpAttributes(span.attributes))).toEqual([
          {
            'http.request.method': 'GET',
            'http.route': '/v1/models',
            'url.scheme': 'http',
            'url.path': '/v1/models',
            'url.query': 'limit=1',
            'url.full': 'http://localhost:4010/v1/models?limit=1',
          },
          {
            'http.request.method': 'GET',
            'http.route': '/v1/models',
            'url.scheme': 'http',
            'url.path': '/v1/models',
            'url.query': 'limit=1&after_id=a',
            'url.full': 'http://localhost:4010/v1/models?limit=1&after_id=a',
          },
        ]);
      });
    });

    describe('a call that the client resends', () => {
      /** Sends each request after the first to a path that says which resend it is. */
      const renumbering = (): Middleware => {
        let sent = 0;
        return (request, next) => {
          const url = new URL(request.url);
          if (sent > 0) {
            url.pathname += `/resend-${sent}`;
            url.searchParams.set('limit', '9');
          }
          sent++;
          return next({ ...request, url: url.href });
        };
      };

      test('a call with one request has no resend count', async () => {
        const { client } = makeClient([json(MESSAGE)], { maxRetries: 2 });

        await client.messages.create(PARAMS);

        expect(onlySpan('anthropic.messages.create').attributes).not.toHaveProperty(
          'http.request.resend_count',
        );
      });

      test('keeps the URL of its first request, and counts the resends', async () => {
        const { client, requests } = makeClient([RETRIED, RETRIED, LIST_PAGE], {
          maxRetries: 2,
          middleware: [renumbering()],
        });

        await client.beta.files.list({ limit: 1 });

        expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
          '/v1/files',
          '/v1/files/resend-1',
          '/v1/files/resend-2',
        ]);
        expect(httpAttributes(onlySpan('anthropic.files.list').attributes)).toEqual({
          'http.request.method': 'GET',
          'http.request.resend_count': 2,
          'http.route': '/v1/files',
          'url.scheme': 'http',
          'url.path': '/v1/files',
          'url.query': 'limit=1',
          'url.full': 'http://localhost:4010/v1/files?limit=1',
        });
      });

      test('counts a request that a middleware sends again', async () => {
        const twice: Middleware = async (request, next) => {
          await next(request);
          return next({ ...request, url: request.url.replace('/v1/', '/v2/') });
        };
        const { client, requests } = makeClient([json(MESSAGE), json(MESSAGE)], { middleware: [twice] });

        await client.messages.create(PARAMS);

        expect(requests).toHaveLength(2);
        expect(onlySpan('anthropic.messages.create').attributes).toMatchObject({
          'http.request.resend_count': 1,
          'url.path': '/v1/messages',
        });
      });

      test('counts the resends of a call that fails', async () => {
        const { client } = makeClient([RETRIED, RETRIED], { maxRetries: 1 });

        await expect(client.messages.create(PARAMS)).rejects.toBeInstanceOf(Anthropic.InternalServerError);

        expect(onlySpan('anthropic.messages.create').attributes['http.request.resend_count']).toBe(1);
      });
    });

    test('a call whose request fails keeps the URL it requested', async () => {
      const refused = () => {
        throw new TypeError('fetch failed');
      };
      const { client } = makeClient(
        [json({ type: 'error', error: { type: 'not_found_error', message: 'no' } }, 404), refused],
        { baseURL: 'https://api.example.com/prefix' },
      );

      await expect(client.beta.files.retrieveMetadata('file_1')).rejects.toBeInstanceOf(
        Anthropic.NotFoundError,
      );
      await expect(client.messages.create(PARAMS)).rejects.toBeInstanceOf(Anthropic.APIConnectionError);

      expect(onlySpan('anthropic.files.retrieve_metadata').attributes['error.type']).toBe('not_found_error');
      expect(httpAttributes(onlySpan('anthropic.files.retrieve_metadata').attributes)).toEqual({
        'http.request.method': 'GET',
        'http.route': '/v1/files/{file_id}',
        'url.scheme': 'https',
        'url.path': '/prefix/v1/files/file_1',
        'url.full': 'https://api.example.com/prefix/v1/files/file_1',
      });
      expect(onlySpan('anthropic.messages.create').attributes['error.type']).toBe('connection_error');
      expect(httpAttributes(onlySpan('anthropic.messages.create').attributes)).toEqual({
        'http.request.method': 'POST',
        'http.route': '/v1/messages',
        'url.scheme': 'https',
        'url.path': '/prefix/v1/messages',
        'url.full': 'https://api.example.com/prefix/v1/messages',
      });
    });

    test('a call that fails before it has a request has the route alone', async () => {
      const failing: Middleware = async () => {
        throw new Error('no request');
      };
      const { client, requests } = makeClient([], { middleware: [failing] });

      await expect(client.messages.create(PARAMS)).rejects.toThrow('no request');

      expect(requests).toHaveLength(0);
      expect(httpAttributes(onlySpan('anthropic.messages.create').attributes)).toEqual({
        'http.route': '/v1/messages',
      });
    });

    test('the results of a batch have the route of their endpoint and the URL they came from', async () => {
      const batch = {
        id: 'msgbatch_1',
        type: 'message_batch',
        processing_status: 'ended',
        results_url: 'https://files.example.com/results/msgbatch_1.jsonl?signature=secret',
      };
      const { client } = makeClient([
        json(batch),
        () => new Response(''),
        json(batch),
        () => new Response(''),
      ]);

      for await (const _ of await client.messages.batches.results('msgbatch_1')) {
      }
      for await (const _ of await client.beta.messages.batches.results('msgbatch_1')) {
      }

      const recorded = spans('anthropic.messages.batches.results');
      expect(recorded).toHaveLength(2);
      for (const span of recorded) {
        expect(httpAttributes(span.attributes)).toEqual({
          'http.request.method': 'GET',
          'http.route': '/v1/messages/batches/{message_batch_id}/results',
          'url.scheme': 'https',
          'url.path': '/results/msgbatch_1.jsonl',
          'url.full': 'https://files.example.com/results/msgbatch_1.jsonl',
        });
      }
    });
  });
});
