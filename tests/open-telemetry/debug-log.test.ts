import { inspect } from 'node:util';
import { AlwaysOffSampler, BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import type Anthropic from '@anthropic-ai/sdk';
import type { Middleware } from '@anthropic-ai/sdk';
import {
  makeClient,
  json,
  type Handler,
  sse,
  MESSAGE,
  PARAMS,
  STREAM_EVENTS,
  spans,
  setUpTracing,
} from './utils';

setUpTracing();

const HEADERS = { 'x-api-key': 'fake-request-key', Authorization: 'Bearer fake-request-token' };
const COUNT_PARAMS = { model: PARAMS.model, messages: PARAMS.messages };
const SESSION = {
  id: 'sesn_1',
  type: 'session',
  agent: { id: 'agent_1', name: 'a', model: { id: 'model-a' } },
};

/** Every method and helper whose span starts with attributes of its request. */
const CALLS: Array<[string, Handler, (client: Anthropic) => Promise<unknown>]> = [
  ['messages.create', json(MESSAGE), (c) => c.messages.create(PARAMS, { headers: HEADERS })],
  [
    'messages.create with stream: true',
    sse(STREAM_EVENTS),
    async (c) => {
      for await (const _ of await c.messages.create({ ...PARAMS, stream: true }, { headers: HEADERS }));
    },
  ],
  ['messages.stream', sse(STREAM_EVENTS), (c) => c.messages.stream(PARAMS, { headers: HEADERS }).done()],
  ['messages.parse', json(MESSAGE), (c) => c.messages.parse(PARAMS, { headers: HEADERS })],
  [
    'messages.countTokens',
    json({ input_tokens: 1 }),
    (c) => c.messages.countTokens(COUNT_PARAMS, { headers: HEADERS }),
  ],
  ['beta.messages.create', json(MESSAGE), (c) => c.beta.messages.create(PARAMS, { headers: HEADERS })],
  [
    'beta.messages.create with stream: true',
    sse(STREAM_EVENTS),
    async (c) => {
      for await (const _ of await c.beta.messages.create({ ...PARAMS, stream: true }, { headers: HEADERS }));
    },
  ],
  [
    'beta.messages.stream',
    sse(STREAM_EVENTS),
    (c) => c.beta.messages.stream(PARAMS, { headers: HEADERS }).done(),
  ],
  ['beta.messages.parse', json(MESSAGE), (c) => c.beta.messages.parse(PARAMS, { headers: HEADERS })],
  [
    'beta.messages.countTokens',
    json({ input_tokens: 1 }),
    (c) => c.beta.messages.countTokens(COUNT_PARAMS, { headers: HEADERS }),
  ],
  [
    'beta.messages.toolRunner',
    json(MESSAGE),
    (c) => c.beta.messages.toolRunner({ ...PARAMS, tools: [] }, { headers: HEADERS }).runUntilDone(),
  ],
  [
    'beta.sessions.create',
    json(SESSION),
    (c) => c.beta.sessions.create({ agent: 'agent_1', environment_id: 'env_1' }, { headers: HEADERS }),
  ],
];

/** A logger that prints its arguments in full, as `console.dir(args, { depth: null })` does. */
function deepLogger() {
  const lines: string[] = [];
  const log = (...args: unknown[]) => void lines.push(inspect(args, { depth: null }));
  return { lines, logger: { debug: log, info: log, warn: log, error: log } };
}

describe('OpenTelemetry spans', () => {
  describe('debug log', () => {
    test.each(CALLS)(
      '%s keeps the credentials in its request headers out of the log',
      async (_, handler, call) => {
        const { lines, logger } = deepLogger();
        const { client, requests } = makeClient([handler], { logger, logLevel: 'debug' });

        await call(client);

        expect(spans()).not.toHaveLength(0);
        expect(requests[0]!.headers.get('x-api-key')).toBe('fake-request-key');
        const log = lines.join('\n');
        expect(log).toContain('sending request');
        expect(log).not.toContain('fake-request-key');
        expect(log).not.toContain('fake-request-token');
      },
    );

    test.each(CALLS)(
      '%s gives a middleware that logs its options without their headers no other copy of them',
      async (_, handler, call) => {
        const lines: string[] = [];
        const log: Middleware = (request, next, { options }) => {
          lines.push(inspect({ ...options, headers: undefined }, { depth: null }));
          return next(request);
        };
        const { client } = makeClient([handler], { middleware: [log] });

        await call(client);

        expect(spans()).not.toHaveLength(0);
        expect(lines).not.toHaveLength(0);
        expect(lines.join('\n')).not.toContain('fake-request-key');
        expect(lines.join('\n')).not.toContain('fake-request-token');
      },
    );

    test('a span that only propagates keeps them out too', async () => {
      const { lines, logger } = deepLogger();
      const tracerProvider = new BasicTracerProvider({ sampler: new AlwaysOffSampler() });
      const { client, requests } = makeClient([json(MESSAGE)], {
        logger,
        logLevel: 'debug',
        openTelemetry: { tracerProvider },
      });

      await client.messages.create(PARAMS, { headers: HEADERS });

      expect(requests[0]!.headers.get('traceparent')).not.toBeNull();
      const log = lines.join('\n');
      expect(log).toContain('sending request');
      expect(log).not.toContain('fake-request-key');
      expect(log).not.toContain('fake-request-token');
    });

    test('a logger that writes its arguments as JSON does not fail the call', async () => {
      const log = (...args: unknown[]) => void JSON.stringify(args);
      const { client } = makeClient([json(MESSAGE)], {
        logger: { debug: log, info: log, warn: log, error: log },
        logLevel: 'debug',
      });

      await expect(client.messages.create(PARAMS)).resolves.toMatchObject({ id: MESSAGE.id });
    });
  });
});
