import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import Anthropic from '@anthropic-ai/sdk';
import resourceIDs from './resource-ids.json';

export const exporter = new InMemorySpanExporter();

/** The names of the spans that have started and not ended. */
export const openSpans = new Map<unknown, string>();
const openSpanTracker: SpanProcessor = {
  onStart: (span) => void openSpans.set(span, span.name),
  onEnd: (span) => {
    for (const started of openSpans.keys()) {
      if ((started as ReadableSpan).spanContext().spanId === span.spanContext().spanId) {
        openSpans.delete(started);
      }
    }
  },
  forceFlush: async () => {},
  shutdown: async () => {},
};

export const provider = new BasicTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter), openSpanTracker],
});
export const tracer = provider.getTracer('test');

/** Registers the tracer provider, propagator and context manager for the tests of one file. */
export function setUpTracing(): void {
  beforeAll(() => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    trace.setGlobalTracerProvider(provider);
  });

  afterEach(() => {
    exporter.reset();
    openSpans.clear();
    delete process.env['ANTHROPIC_OPEN_TELEMETRY'];
  });

  afterAll(() => {
    trace.disable();
    propagation.disable();
    context.disable();
  });
}

export type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** A client whose HTTP requests go to `handlers`, one per attempt, in order. */
export function makeClient(
  handlers: Handler[],
  options: Partial<ConstructorParameters<typeof Anthropic>[0]> = {},
) {
  const requests: Array<{ url: string; headers: Headers; body: any }> = [];
  const client = new Anthropic({
    apiKey: 'test-key',
    baseURL: 'http://localhost:4010',
    maxRetries: 0,
    fetch: async (url, init = {}) => {
      const headers = new Headers(init.headers);
      requests.push({
        url: String(url),
        headers,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      const handler = handlers.shift();
      if (!handler) {
        throw new Error('unexpected request to ' + String(url));
      }
      return handler(String(url), init);
    },
    ...options,
  });
  return { client, requests };
}

export const json =
  (body: unknown, status = 200, headers: Record<string, string> = {}): Handler =>
  () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', 'request-id': 'req_1', ...headers },
    });

export const sse =
  (events: Array<Record<string, any>>): Handler =>
  () =>
    new Response(events.map((e) => `event: ${e['type']}\ndata: ${JSON.stringify(e)}\n\n`).join(''), {
      headers: { 'content-type': 'text/event-stream', 'request-id': 'req_stream' },
    });

export const MESSAGE = {
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'model-served',
  content: [{ type: 'text', text: 'hello' }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: {
    input_tokens: 10,
    output_tokens: 20,
    cache_creation_input_tokens: 2,
    cache_read_input_tokens: 3,
    cache_creation: { ephemeral_5m_input_tokens: 2, ephemeral_1h_input_tokens: 0 },
    output_tokens_details: { thinking_tokens: 7 },
    service_tier: 'standard',
  },
};

export const PARAMS = {
  model: 'model-a',
  max_tokens: 100,
  messages: [{ role: 'user' as const, content: 'hi' }],
};

export const STREAM_EVENTS = [
  {
    type: 'message_start',
    message: {
      ...MESSAGE,
      content: [],
      stop_reason: null,
      usage: { ...MESSAGE.usage, output_tokens: 1, output_tokens_details: null },
    },
  },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hello' } },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: 20, output_tokens_details: { thinking_tokens: 7 } },
  },
  { type: 'message_stop' },
];

export const SESSION_EVENT = { type: 'session.status_idle', id: 'sevt_1', processed_at: null };

export function spans(name?: string): ReadableSpan[] {
  const all = exporter.getFinishedSpans();
  return name ? all.filter((span) => span.name === name) : all;
}

export function onlySpan(name: string): ReadableSpan {
  const found = spans(name);
  expect(found).toHaveLength(1);
  return found[0]!;
}

export function parentId(span: ReadableSpan): string | undefined {
  return span.parentSpanContext?.spanId;
}

/** What `resource-ids.json` says of one SDK method's span. */
export interface ResourceIDOperation {
  span: string;
  /** How the client reaches the method, such as `beta.sessions.threads.retrieve`. */
  call: string;
  /** The attribute of each parameter of the request's path. */
  path: Record<string, string>;
  /** The attribute of the ID of the object that the method creates, and the response field with that ID. */
  created: { attribute: string; field: string } | null;
  /** The HTTP method of the endpoint. */
  verb: string;
  /** The endpoint's path as the API's description gives it, with the names of `path` in braces. */
  route: string;
  /** The names of the query parameters that the API's description defines for the endpoint. */
  query?: string[];
}

/** One method for the table test of `resource-ids.test.ts` to call. */
export interface ResourceIDCase {
  kind: 'path' | 'created' | 'created_field' | 'list';
  method: string;
  call: string;
  span: string;
  /** The arguments that give each path parameter a value. */
  arguments: unknown[];
  /** The ID attributes that the path gives the span. */
  expect: Record<string, string>;
  created: { attribute: string; field: string } | null;
}

/**
 * The resource ID attributes of every SDK method, which the tool that writes them at the call sites
 * also writes to `resource-ids.json`. The tests take every resource ID attribute name from here.
 */
export const RESOURCE_IDS = resourceIDs as {
  operations: Record<string, ResourceIDOperation>;
  cases: ResourceIDCase[];
};

/** The attribute that the span of `method` has for the parameter `param` of its path. */
export function pathID(method: string, param: string): string {
  const attribute = RESOURCE_IDS.operations[method]?.path[param];
  if (!attribute) throw new Error(`resource-ids.json has no ${param} for ${method}`);
  return attribute;
}

/** The attribute that the span of `method` has for the ID of the object it creates. */
export function createdID(method: string): string {
  const attribute = RESOURCE_IDS.operations[method]?.created?.attribute;
  if (!attribute) throw new Error(`resource-ids.json has no created ID for ${method}`);
  return attribute;
}

/**
 * The resource ID attributes of `span`: every ID attribute that the response's headers do not give,
 * besides the conversation ID, which is not a resource's.
 */
export function resourceIDsOf(span: ReadableSpan): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(span.attributes).filter(
      ([name]) =>
        name.endsWith('.id') && name !== 'anthropic.request.id' && name !== 'gen_ai.conversation.id',
    ),
  );
}
