import { tmpdir } from 'node:os';
import { SpanKind, SpanStatusCode, type Attributes } from '@opentelemetry/api';
import { BasicTracerProvider, SamplingDecision, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import Anthropic from '@anthropic-ai/sdk';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import {
  exporter,
  json,
  onlySpan,
  openSpans,
  parentId,
  pathID,
  setUpTracing,
  spans,
  tracer,
  type Handler,
} from './utils';

setUpTracing();

const ENVIRONMENT_ID = pathID('beta.environments.work.heartbeat', 'environment_id');
const WORK_ID = pathID('beta.environments.work.heartbeat', 'work_id');
const SESSION_ID = pathID('beta.sessions.retrieve', 'session_id');

const work = (id: string) => ({
  id,
  type: 'work',
  environment_id: 'env_1',
  data: { type: 'session', id: 'sesn_1' },
  secret: null,
});

const HEARTBEAT = { last_heartbeat: 'hb_1', ttl_seconds: 60, state: 'running', lease_extended: true };
const TOOL_USE = { type: 'agent.custom_tool_use', id: 'sevt_1', name: 'echo', input: {} };
const TERMINATED = { type: 'session.status_terminated', id: 'sevt_2' };

const errorResponse = (status: number, type: string): Handler =>
  json({ type: 'error', error: { type, message: 'no' } }, status);

/** The Session's event stream, which stays open after `events` until the request is aborted. */
const eventStream =
  (events: Array<Record<string, unknown>>, opened?: () => void): Handler =>
  (_url, init) => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(event)}\n\n`));
        }
        init.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true });
        opened?.();
      },
    });
    return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
  };

interface Routes {
  /** What each poll returns, in order. The poll after the last stops the poller. */
  items: Array<ReturnType<typeof work>>;
  ack?: Handler;
  stop?: Handler;
  retrieve?: Handler;
  heartbeat?: Handler;
  stream?: Handler;
}

/** A client whose requests an environment's Work queue and the Session `sesn_1` answer. */
function makeEnvironment(routes: Routes, options: Partial<ConstructorParameters<typeof Anthropic>[0]> = {}) {
  const stop = new AbortController();
  const items = [...routes.items];
  const poll: Handler = (url, init) => {
    const item = items.shift();
    if (item) return json(item)(url, init);
    stop.abort();
    return new Response(null, { status: 204 });
  };
  // The first handler whose method and end of path are the request's answers it.
  const handlers: Array<[method: string, pathEnd: string, handler: Handler]> = [
    ['GET', '/work/poll', poll],
    ['POST', '/ack', routes.ack ?? json({})],
    ['POST', '/heartbeat', routes.heartbeat ?? json(HEARTBEAT)],
    ['POST', '/stop', routes.stop ?? json({})],
    [
      'GET',
      '/sessions/sesn_1',
      routes.retrieve ?? json({ id: 'sesn_1', agent: { skills: [] }, resources: [] }),
    ],
    ['GET', '/events/stream', routes.stream ?? eventStream([TOOL_USE, TERMINATED])],
    ['GET', '/events', json({ data: [], next_page: null })],
    ['POST', '/events', json({})],
  ];
  const client = new Anthropic({
    apiKey: 'test-key',
    baseURL: 'http://localhost:4010',
    maxRetries: 0,
    logLevel: 'off',
    fetch: async (url, init = {}) => {
      const { pathname } = new URL(String(url));
      const found = handlers.find(
        ([method, pathEnd]) => init.method?.toUpperCase() === method && pathname.endsWith(pathEnd),
      );
      if (!found) throw new Error(`unexpected request: ${init.method} ${pathname}`);
      return found[2](String(url), init);
    },
    ...options,
  });
  return { client, stop };
}

function echoTool(): BetaRunnableTool {
  return {
    type: 'custom',
    name: 'echo',
    description: 'echo',
    input_schema: { type: 'object', properties: {} },
    parse: (input: unknown) => input as never,
    run: async () => 'ok',
  };
}

function makeWorker(client: Anthropic, stop: AbortController) {
  return client.beta.environments.work.worker({
    environmentId: 'env_1',
    environmentKey: 'env_key',
    tools: [echoTool()],
    workdir: tmpdir(),
    maxIdleMs: 0,
    memorySyncIntervalMs: null,
    signal: stop.signal,
  });
}

function makePoller(client: Anthropic, stop: AbortController) {
  return client.beta.environments.work.poller({
    environmentId: 'env_1',
    environmentKey: 'env_key',
    signal: stop.signal,
  });
}

/** The names of the ended spans whose parent is `parent`. */
function childrenOf(parent: ReturnType<typeof onlySpan>): string[] {
  return spans()
    .filter((span) => parentId(span) === parent.spanContext().spanId)
    .map((span) => span.name);
}

describe('OpenTelemetry spans', () => {
  describe('the environment worker', () => {
    test('handles each Work item in a span of its own under the span that is current for run(), which starts with its attributes', async () => {
      const seen: Array<{ name: string; attributes: Attributes }> = [];
      const sampling = new BasicTracerProvider({
        sampler: {
          shouldSample: (_context, _traceId, name, _kind, attributes) => {
            seen.push({ name, attributes });
            return { decision: SamplingDecision.RECORD_AND_SAMPLED };
          },
          toString: () => 'a sampler that records what it is given',
        },
        spanProcessors: [new SimpleSpanProcessor(exporter)],
      });
      const { client, stop } = makeEnvironment(
        { items: [work('work_1'), work('work_2')] },
        { openTelemetry: { tracerProvider: sampling } },
      );

      await tracer.startActiveSpan('application', async (application) => {
        await makeWorker(client, stop).run();
        application.end();
      });

      const workSpans = spans('anthropic.environment.work');
      expect(workSpans.map((span) => span.attributes[WORK_ID])).toEqual(['work_1', 'work_2']);
      const attributes = (id: string) => ({
        'gen_ai.provider.name': 'anthropic',
        [ENVIRONMENT_ID]: 'env_1',
        [WORK_ID]: id,
        [SESSION_ID]: 'sesn_1',
      });
      for (const [index, span] of workSpans.entries()) {
        expect(parentId(span)).toBe(onlySpan('application').spanContext().spanId);
        expect(span.kind).toBe(SpanKind.INTERNAL);
        expect(span.attributes).toEqual(attributes(`work_${index + 1}`));
        expect(span.status.code).toBe(SpanStatusCode.OK);
        // Everything that the worker does for the item is under the item's span.
        expect(childrenOf(span).sort()).toEqual([
          'anthropic.custom_tool_use echo',
          'anthropic.environments.work.heartbeat',
          'anthropic.environments.work.stop',
          'anthropic.sessions.events.list',
          'anthropic.sessions.events.send',
          'anthropic.sessions.events.stream',
          'anthropic.sessions.retrieve',
        ]);
      }
      expect(seen.filter(({ name }) => name === 'anthropic.environment.work')).toEqual([
        { name: 'anthropic.environment.work', attributes: attributes('work_1') },
        { name: 'anthropic.environment.work', attributes: attributes('work_2') },
      ]);
      expect(openSpans.size).toBe(0);
    });

    test('fails the span of an item whose handling fails, with the error type of the failed API call', async () => {
      const { client, stop } = makeEnvironment({
        items: [work('work_1')],
        retrieve: errorResponse(404, 'not_found_error'),
      });

      await makeWorker(client, stop).run();

      const workSpan = onlySpan('anthropic.environment.work');
      // No span is current for run(), so the item's span is a root span.
      expect(parentId(workSpan)).toBeUndefined();
      expect(workSpan.status.code).toBe(SpanStatusCode.ERROR);
      expect(onlySpan('anthropic.sessions.retrieve').attributes['error.type']).toBe('not_found_error');
      expect(workSpan.attributes['error.type']).toBe('not_found_error');
    });

    test('fails the span with client_error when the failure is not an API call', async () => {
      const { client, stop } = makeEnvironment({ items: [work('work_1')] });
      const worker = client.beta.environments.work.worker({
        environmentId: 'env_1',
        environmentKey: 'env_key',
        tools: () => {
          throw new Error('no tools');
        },
        workdir: tmpdir(),
        memorySyncIntervalMs: null,
        signal: stop.signal,
      });

      await worker.run();

      const workSpan = onlySpan('anthropic.environment.work');
      expect(workSpan.status.code).toBe(SpanStatusCode.ERROR);
      expect(workSpan.attributes['error.type']).toBe('client_error');
    });

    test.each([
      ['loses the lease', errorResponse(412, 'invalid_request_error')],
      ['has a heartbeat rejected for good', errorResponse(403, 'permission_error')],
    ])('leaves the status unset when it %s', async (_, heartbeat) => {
      const { client, stop } = makeEnvironment({ items: [work('work_1')], heartbeat });

      await makeWorker(client, stop).run();

      const workSpan = onlySpan('anthropic.environment.work');
      expect(workSpan.status.code).toBe(SpanStatusCode.UNSET);
      expect(workSpan.attributes).not.toHaveProperty('error.type');
      expect(openSpans.size).toBe(0);
    });

    test('leaves the status unset when it is stopped before it finishes with the item', async () => {
      // The Session is still running when the application stops the worker.
      const { client, stop } = makeEnvironment({
        items: [work('work_1')],
        stream: eventStream([TOOL_USE], () => setTimeout(() => stop.abort(), 10)),
      });

      await makeWorker(client, stop).run();

      const workSpan = onlySpan('anthropic.environment.work');
      expect(childrenOf(workSpan)).toContain('anthropic.sessions.events.stream');
      expect(workSpan.status.code).toBe(SpanStatusCode.UNSET);
      expect(workSpan.attributes).not.toHaveProperty('error.type');
      expect(openSpans.size).toBe(0);
    });

    test('emits no span for an item that something else claimed', async () => {
      const { client, stop } = makeEnvironment({ items: [] });

      await makeWorker(client, stop).handleItem({
        workId: 'work_1',
        environmentId: 'env_1',
        sessionId: 'sesn_1',
      });

      expect(spans('anthropic.sessions.retrieve')).toHaveLength(1);
      expect(spans('anthropic.environment.work')).toHaveLength(0);
    });

    test('runs without spans when the client has them disabled', async () => {
      const { client, stop } = makeEnvironment({ items: [work('work_1')] }, { openTelemetry: false });

      await makeWorker(client, stop).run();

      expect(spans()).toHaveLength(0);
    });

    test.each(['onStart', 'onEnd'] as const)(
      'handles every Work item when a span processor throws from %s',
      async (hook) => {
        const fail = () => {
          throw new Error(`the application's ${hook} failed`);
        };
        const processor = { onStart() {}, onEnd() {}, forceFlush: async () => {}, shutdown: async () => {} };
        const tracerProvider = new BasicTracerProvider({ spanProcessors: [{ ...processor, [hook]: fail }] });
        const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const stopped: string[] = [];
        const { client, stop } = makeEnvironment(
          { items: [work('work_1'), work('work_2')], stop: (url) => (stopped.push(url), json({})(url, {})) },
          { openTelemetry: { tracerProvider }, logger, logLevel: 'debug' },
        );

        await makeWorker(client, stop).run();

        expect(stopped.map((url) => new URL(url).pathname.split('/').at(-2))).toEqual(['work_1', 'work_2']);
        expect(logger.error).not.toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith(
          'could not record telemetry',
          expect.objectContaining({ message: `the application's ${hook} failed` }),
        );
      },
    );
  });

  describe('the work poller', () => {
    test('ends the span of an item with OK when the application asks for the next item or leaves its loop', async () => {
      const { client, stop } = makeEnvironment({ items: [work('work_1'), work('work_2'), work('work_3')] });

      const ended: string[][] = [];
      await tracer.startActiveSpan('application', async (application) => {
        for await (const item of makePoller(client, stop)) {
          // The span of the item that the application holds is open, and the spans before it have ended.
          expect([...openSpans.values()]).toContain('anthropic.environment.work');
          ended.push(spans('anthropic.environment.work').map((span) => String(span.attributes[WORK_ID])));
          tracer.startSpan(`handling ${item.id}`).end();
          if (item.id === 'work_2') break;
        }
        application.end();
      });

      expect(ended).toEqual([[], ['work_1']]);
      const workSpans = spans('anthropic.environment.work');
      expect(workSpans.map((span) => span.attributes[WORK_ID])).toEqual(['work_1', 'work_2']);
      // The span that is current where the application iterates the poller is the parent of each
      // item's span, so the spans that the application starts in its loop are their siblings.
      const application = onlySpan('application').spanContext().spanId;
      expect(parentId(onlySpan('handling work_1'))).toBe(application);
      expect(parentId(onlySpan('handling work_2'))).toBe(application);
      for (const span of workSpans) {
        expect(parentId(span)).toBe(application);
        expect(span.kind).toBe(SpanKind.INTERNAL);
        expect(span.attributes).toEqual({
          'gen_ai.provider.name': 'anthropic',
          [ENVIRONMENT_ID]: 'env_1',
          [WORK_ID]: span.attributes[WORK_ID],
          [SESSION_ID]: 'sesn_1',
        });
        expect(span.status.code).toBe(SpanStatusCode.OK);
      }
      expect(openSpans.size).toBe(0);
    });

    test('starts a root span when no span is current where the application iterates the poller', async () => {
      const { client, stop } = makeEnvironment({ items: [work('work_1')] });

      for await (const _ of makePoller(client, stop)) {
      }

      expect(parentId(onlySpan('anthropic.environment.work'))).toBeUndefined();
    });

    test('leaves the status unset when the application stops polling while it holds the item', async () => {
      const { client, stop } = makeEnvironment({ items: [work('work_1')] });

      for await (const _ of makePoller(client, stop)) {
        stop.abort();
      }

      expect(onlySpan('anthropic.environment.work').status.code).toBe(SpanStatusCode.UNSET);
      expect(openSpans.size).toBe(0);
    });

    test('fails the span of an item that it cannot acknowledge', async () => {
      const { client, stop } = makeEnvironment({
        items: [work('work_1')],
        ack: errorResponse(500, 'api_error'),
      });

      const items: string[] = [];
      for await (const item of makePoller(client, stop)) {
        items.push(item.id);
      }

      expect(items).toEqual([]);
      const workSpan = onlySpan('anthropic.environment.work');
      expect(workSpan.status.code).toBe(SpanStatusCode.ERROR);
      expect(workSpan.attributes['error.type']).toBe('api_error');
    });
  });
});
