import type { Mock } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import type { Fetch, RequestInit } from '@anthropic-ai/sdk/internal/builtin-types';
import type { AutoParseableBetaOutputFormat } from '@anthropic-ai/sdk/lib/beta-parser';
import type { BetaMessageStream } from '@anthropic-ai/sdk/lib/BetaMessageStream';
import type {
  BetaMessageThread,
  BetaMessageThreadCreateParams,
} from '@anthropic-ai/sdk/lib/threads/BetaMessageThread';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import type {
  BetaToolRunner,
  BetaToolRunnerParams,
  BetaToolRunnerRequestOptions,
} from '@anthropic-ai/sdk/lib/tools/BetaToolRunner';
import type {
  BetaContentBlock,
  BetaMessage,
  BetaMessageParam,
  BetaRawMessageStreamEvent,
  BetaStopReason,
} from '@anthropic-ai/sdk/resources/beta';
import { promiseWithResolvers } from '@anthropic-ai/sdk/internal/utils/promise';
import { mockFetch } from '../mock-fetch';

export const MODEL = 'claude-sonnet-5';
export const MAX_TOKENS = 1024;
export const THREADS_BETA = 'message-threads-2026-08-12';
export const CONTEXT_MANAGEMENT_BETA = 'context-management-2025-06-27';
export const INLINE_TOOLS_BETA = 'inline-tools-2026-09-15';
export const CREATE = { type: 'create' };
const FALLBACK_MODEL = 'claude-haiku-4-5';
export const FALLBACKS = [{ model: FALLBACK_MODEL }];
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export type Forecast = { forecast: string };

export const WEATHER_QUESTION: BetaMessageParam = { role: 'user', content: 'What is the weather in SF?' };

/** A runnable `get_weather` tool, matching the tool call in `betaMessage(id, text, { toolUseId })`. */
export const weatherTool: BetaRunnableTool<{ location: string }> = {
  type: 'custom',
  name: 'get_weather',
  description: 'Lookup the weather for a given city.',
  input_schema: {
    type: 'object',
    properties: { location: { type: 'string', description: 'The city, e.g. San Francisco' } },
    required: ['location'],
  },
  run: async ({ location }) => `Sunny in ${location}`,
  parse: (input) => input as { location: string },
};

/** A runnable `get_tides` tool, matching the tool call in `betaMessage(id, text, { toolUseId, toolName: 'get_tides' })`. */
export const tidesTool: BetaRunnableTool<{ location: string }> = {
  ...weatherTool,
  name: 'get_tides',
  description: 'Lookup the tides for a given city.',
  run: async ({ location }) => `High tide in ${location}`,
};

/** The `system` message that gives the model `tidesTool`, as a tool runner's `addTools()` sends it. */
export const TIDES_TOOL_ADDED: BetaMessageParam = {
  role: 'system',
  content: [
    {
      type: 'tool_addition',
      tool: {
        type: 'tool_definition',
        definition: {
          type: 'custom',
          name: tidesTool.name,
          description: tidesTool.description!,
          input_schema: tidesTool.input_schema,
        },
      },
    },
  ],
};

/** The `system` message that takes `weatherTool` away from the model, as a tool runner's `removeTools()` sends it. */
export const WEATHER_TOOL_REMOVED: BetaMessageParam = {
  role: 'system',
  content: [{ type: 'tool_removal', tool: { type: 'tool_reference', name: weatherTool.name } }],
};

/** An `output_format` that parses replies as `Forecast` JSON. */
export const FORECAST_FORMAT: AutoParseableBetaOutputFormat<Forecast> = {
  type: 'json_schema',
  schema: { type: 'object', properties: { forecast: { type: 'string' } }, required: ['forecast'] },
  parse: (content) => JSON.parse(content) as Forecast,
};

/** A response the mock API will give to the next request. */
export type Responder = (init?: RequestInit) => Response | Promise<Response>;

export type CapturedRequest = { method: string; path: string; body: Record<string, any>; headers: Headers };

/** A client on a mock `fetch`, the requests it has sent, and a queue of responses for the requests to come. */
export type MockAPI = {
  client: Anthropic;
  fetch: Fetch;
  requests: CapturedRequest[];
  /** Answer the next `responders.length` requests with `responders`, in order. */
  queue: (...responders: Responder[]) => void;
  /** The JSON body of each request so far. */
  bodies: () => Array<Record<string, any>>;
  /** The `thread` param of each request so far, or `null` for a request sent without one. */
  threads: () => Array<Record<string, unknown> | null>;
  /** The `anthropic-beta` values of each request so far. */
  betas: () => string[][];
  /** The helper telemetry header of each request so far, or `null` for a request sent without one. */
  helpers: () => Array<string | null>;
  logger: { info: Mock; warn: Mock; error: Mock; debug: Mock };
};

export function mockAPI(): MockAPI {
  const { fetch, handleRequest } = mockFetch();
  const requests: CapturedRequest[] = [];
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0, logger, logLevel: 'info' });
  const queue = (...responders: Responder[]) => {
    for (const responder of responders) {
      handleRequest(async (url, init?: RequestInit) => {
        requests.push({
          method: init!.method!,
          path: new URL(String(url)).pathname,
          body: JSON.parse(init!.body as string),
          headers: new Headers(init!.headers as Record<string, string>),
        });
        return responder(init);
      });
    }
  };
  return {
    client,
    fetch,
    requests,
    queue,
    logger,
    bodies: () => requests.map((request) => request.body),
    threads: () => requests.map((request) => (request.body['thread'] as Record<string, unknown>) ?? null),
    helpers: () => requests.map((request) => request.headers.get('x-stainless-helper')),
    betas: () =>
      requests.map((request) =>
        (request.headers.get('anthropic-beta') ?? '')
          .split(',')
          .map((beta) => beta.trim())
          .filter(Boolean),
      ),
  };
}

/**
 * `client.beta.messages.toolRunner(...)` on `api.client`, with the `get_weather` tool and the weather question
 * unless `params` replaces them.
 */
export function makeRunner(
  api: MockAPI,
  params: Partial<BetaToolRunnerParams> = {},
  options?: BetaToolRunnerRequestOptions,
): BetaToolRunner<boolean> {
  return api.client.beta.messages.toolRunner(
    { model: MODEL, max_tokens: MAX_TOKENS, tools: [weatherTool], messages: [WEATHER_QUESTION], ...params },
    options,
  );
}

/** A thread on `api.client`; `model` and `max_tokens` default to values no test depends on. */
export function makeThread<Params extends Partial<BetaMessageThreadCreateParams>>(
  api: MockAPI,
  params: Params = {} as Params,
  options?: Parameters<Anthropic['beta']['messages']['thread']>[1],
): BetaMessageThread<any> {
  return api.client.beta.messages.thread({ model: MODEL, max_tokens: MAX_TOKENS, ...params }, options);
}

export const user = (text: string): BetaMessageParam => ({ role: 'user', content: text });

export const assistant = (text = 'Hi!'): BetaMessageParam => ({
  role: 'assistant',
  content: [textBlock(text)],
});

export const toolUse = (toolUseId: string): BetaMessageParam => ({
  role: 'assistant',
  content: [toolUseBlock(toolUseId)],
});

export const toolResult = (toolUseId: string, content = 'Sunny in San Francisco'): BetaMessageParam => ({
  role: 'user',
  content: [{ type: 'tool_result', tool_use_id: toolUseId, content }],
});

/** `reply` as `FALLBACK_MODEL` writes it: after the block that says `MODEL` handed over to it. */
export const afterFallback = (reply: BetaMessageParam): BetaMessageParam => ({
  role: 'assistant',
  content: [FALLBACK_BLOCK, ...(reply.content as BetaContentBlock[])],
});

export const continueFrom = (previousMessageId: string) => ({
  type: 'continue',
  previous_message_id: previousMessageId,
});

export const roles = (messages: ReadonlyArray<{ role: string }>): string[] =>
  messages.map((message) => message.role);

const FALLBACK_BLOCK: BetaContentBlock = {
  type: 'fallback',
  from: { model: MODEL },
  to: { model: FALLBACK_MODEL },
  trigger: { type: 'refusal', category: null },
};

function textBlock(text: string): BetaContentBlock {
  return { type: 'text', text, citations: null };
}

function toolUseBlock(id: string, name = 'get_weather'): BetaContentBlock {
  return { type: 'tool_use', id, name, input: { location: 'San Francisco' } };
}

type ReplyOptions = {
  toolUseId?: string;
  toolName?: string;
  container?: string;
  stopReason?: BetaStopReason;
  /** Whether `FALLBACK_MODEL` wrote the reply, after `MODEL` declined. */
  fallback?: boolean;
};

const ITERATION_USAGE = {
  input_tokens: 10,
  output_tokens: 5,
  cache_creation: null,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

/** A reply from the API with `id`, either `text` or a call of the tool `toolName` (`get_weather` by default). */
export function betaMessage(
  id: string,
  text = 'Hi!',
  { toolUseId, toolName, container, stopReason, fallback }: ReplyOptions = {},
): BetaMessage {
  return {
    id,
    type: 'message',
    role: 'assistant',
    model: MODEL,
    content: [
      ...(fallback ? [FALLBACK_BLOCK] : []),
      toolUseId === undefined ? textBlock(text) : toolUseBlock(toolUseId, toolName),
    ],
    container:
      container === undefined ? null : { id: container, expires_at: '2026-08-19T00:00:00Z', skills: null },
    context_management: null,
    diagnostics: null,
    stop_details: null,
    stop_reason: stopReason ?? (toolUseId === undefined ? 'end_turn' : 'tool_use'),
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      output_tokens_details: null,
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      fallback_credit: null,
      server_tool_use: null,
      service_tier: null,
      inference_geo: null,
      iterations:
        fallback ?
          [
            { ...ITERATION_USAGE, type: 'message', model: MODEL },
            { ...ITERATION_USAGE, type: 'fallback_message', model: FALLBACK_MODEL },
          ]
        : null,
      speed: null,
    },
  };
}

/** Responds with the reply `betaMessage(id, text, options)` as JSON. */
export function message(id: string, text = 'Hi!', options: ReplyOptions = {}): Responder {
  return () =>
    new Response(JSON.stringify(betaMessage(id, text, options)), {
      headers: { 'content-type': 'application/json', 'request-id': `req_${id}` },
    });
}

/** Responds with the reply `betaMessage(id, text, options)` as a stream. */
export function streamed(id: string, text = 'Hello there!', options: ReplyOptions = {}): Responder {
  return () =>
    new Response(
      toStreamEvents(betaMessage(id, text, options))
        .map(sse)
        .join(''),
      {
        headers: { 'content-type': 'text/event-stream', 'request-id': `req_${id}` },
      },
    );
}

/**
 * Streams the events of a `text` reply up to and including its first `deltas` text deltas, then stalls until the
 * request is aborted, like a reply the client stops reading midway. `deltas: 0` stalls right after `message_start`.
 */
export function stalledText(id: string, text: string, { deltas }: { deltas: number }): Responder {
  // `message_start`, `content_block_start`, then `deltas` text deltas.
  return stalls(id, toStreamEvents(betaMessage(id, text)).slice(0, 2 + deltas));
}

/**
 * Streams a finished text block, then a `tool_use` block whose input is cut off before `content_block_stop`, then
 * stalls until the request is aborted.
 */
export function stalledToolUse(id: string, text: string, { toolUseId }: { toolUseId: string }): Responder {
  const reply = betaMessage(id, text);
  reply.content.push(toolUseBlock(toolUseId));
  const events = toStreamEvents(reply);
  const toolStart = events.findIndex((event) => event.type === 'content_block_start' && event.index === 1);
  const partialInput: BetaRawMessageStreamEvent = {
    type: 'content_block_delta',
    index: 1,
    delta: { type: 'input_json_delta', partial_json: '{"location": "San' },
  };
  return stalls(id, [...events.slice(0, toolStart + 1), partialInput]);
}

/**
 * Streams the events of a `text` reply up to and including its first `deltas` text deltas, then ends the body, like a
 * response the server closes before `message_stop`.
 */
export function truncatedText(id: string, text: string, { deltas }: { deltas: number }): Responder {
  const events = toStreamEvents(betaMessage(id, text)).slice(0, 2 + deltas);
  return () =>
    new Response(events.map(sse).join(''), {
      headers: { 'content-type': 'text/event-stream', 'request-id': `req_${id}` },
    });
}

/** Opens the response and streams no event, not even `message_start`, until the request is aborted. */
export function stalledBeforeStart(id: string): Responder {
  return stalls(id, []);
}

/** Streams every event of a reply except `message_stop`, then stalls until the request is aborted. */
export function stalledBeforeStop(id: string, text: string, options: ReplyOptions = {}): Responder {
  return stalls(id, toStreamEvents(betaMessage(id, text, options)).slice(0, -1));
}

/** Streams `events`, then stalls until the request is aborted. */
function stalls(id: string, events: BetaRawMessageStreamEvent[]): Responder {
  return (init) => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(sse(event)));
        const abort = () => controller.error(new DOMException('The user aborted a request.', 'AbortError'));
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener('abort', abort);
      },
    });
    return new Response(body, {
      headers: { 'content-type': 'text/event-stream', 'request-id': `req_${id}` },
    });
  };
}

function sse(event: BetaRawMessageStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Responds with an API error. `errorCode` and `details` go under `error.details`. */
export function apiError(
  status: number,
  type: string,
  text: string,
  { errorCode, ...details }: { errorCode?: string; [detail: string]: unknown } = {},
): Responder {
  const error: Record<string, unknown> = { type, message: text };
  if (errorCode !== undefined) error['details'] = { error_code: errorCode, ...details };
  return () =>
    new Response(JSON.stringify({ type: 'error', error }), {
      status,
      headers: { 'content-type': 'application/json', 'x-should-retry': 'false' },
    });
}

export const serverError = () => apiError(500, 'api_error', 'Internal server error');

/** A responder factory of either kind, so a test can run once per kind. */
export type ResponderFactory = (id: string, text?: string, options?: ReplyOptions) => Responder;

/** `[name, respond, stream]` for `test.each`: the same replies as JSON and as a stream. */
export const RESPONSE_KINDS: Array<[string, ResponderFactory, boolean]> = [
  ['non-streaming', message, false],
  ['streaming', streamed, true],
];

/** Advance a runner's iterator by one turn and wait for the whole reply, which a streaming runner yields early. */
export async function nextReply(iterator: AsyncIterator<BetaMessage | BetaMessageStream>): Promise<void> {
  const { value } = await iterator.next();
  if ('finalMessage' in value) await value.finalMessage();
}

/** Drive a runner's iterator, already started with `next()`, to the end. */
export async function drain(iterator: AsyncIterator<unknown>): Promise<void> {
  while (!(await iterator.next()).done) {}
}

/** A responder that never answers, and a promise that resolves once its request has been sent. */
export function neverResponds(): { responder: Responder; requested: Promise<void> } {
  const { promise: requested, resolve } = promiseWithResolvers<void>();
  const responder: Responder = () => {
    resolve();
    return new Promise<Response>(() => {});
  };
  return { responder, requested };
}

export const THREAD_NOT_FOUND = apiError(
  404,
  'not_found_error',
  'No thread state was found for the requested `previous_message_id`.',
  { errorCode: 'thread_not_found' },
);

export const FINGERPRINT_MISMATCH = apiError(
  400,
  'invalid_request_error',
  '`tools` differs from the request that created this Thread.',
  { errorCode: 'thread_fingerprint_mismatch' },
);

export const ALREADY_CONTINUED_MESSAGE =
  'The requested `previous_message_id` has already been continued. Each response `id` may be continued at most ' +
  "once; continue from the Thread's most recent response `id`.";

export const ALREADY_CONTINUED = apiError(400, 'invalid_request_error', ALREADY_CONTINUED_MESSAGE, {
  errorCode: 'thread_already_continued',
});

export const CONTINUE_IN_FLIGHT = apiError(
  400,
  'invalid_request_error',
  'Another request is already continuing the requested `previous_message_id`.',
  { errorCode: 'thread_continue_in_flight' },
);

export function unsupported(...unsupported: string[]): Responder {
  return apiError(400, 'invalid_request_error', 'This request cannot be used with `thread`.', {
    errorCode: 'thread_unsupported_request',
    unsupported,
  });
}

/** `text` split into one delta per word, which concatenate back to `text`. */
function textDeltas(text: string): string[] {
  const [first = '', ...rest] = text.split(' ');
  return [first, ...rest.map((word) => ` ${word}`)];
}

function toStreamEvents(message: BetaMessage): BetaRawMessageStreamEvent[] {
  const events: BetaRawMessageStreamEvent[] = [
    {
      type: 'message_start',
      message: {
        ...message,
        content: [],
        stop_reason: null,
        container: null,
        usage: { ...message.usage, iterations: null },
      },
    },
  ];
  message.content.forEach((block, index) => {
    if (block.type === 'text') {
      events.push({ type: 'content_block_start', index, content_block: { ...block, text: '' } });
      for (const text of textDeltas(block.text)) {
        events.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } });
      }
    } else if (block.type === 'tool_use') {
      events.push({ type: 'content_block_start', index, content_block: { ...block, input: {} } });
      events.push({
        type: 'content_block_delta',
        index,
        delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) },
      });
    } else if (block.type === 'fallback') {
      events.push({ type: 'content_block_start', index, content_block: block });
    }
    events.push({ type: 'content_block_stop', index });
  });
  events.push({
    type: 'message_delta',
    delta: {
      stop_reason: message.stop_reason,
      stop_sequence: null,
      stop_details: null,
      container: message.container,
    },
    context_management: null,
    usage: {
      output_tokens: message.usage.output_tokens,
      input_tokens: message.usage.input_tokens,
      output_tokens_details: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      fallback_credit: null,
      server_tool_use: null,
      iterations: message.usage.iterations,
    },
  });
  events.push({ type: 'message_stop' });
  return events;
}
