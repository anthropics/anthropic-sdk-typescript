import fs from 'node:fs';
import path from 'node:path';
import type { APIRequest } from '@anthropic-ai/sdk/core/api';
import type { MiddlewareContext } from '@anthropic-ai/sdk/core/middleware';
import { Stream } from '@anthropic-ai/sdk/core/streaming';
import {
  betaRefusalFallbackMiddleware,
  BetaFallbackState,
  type BetaRefusalFallbackOptions,
} from '@anthropic-ai/sdk/lib/middleware';
import type { BetaFallbackParam } from '@anthropic-ai/sdk/resources/beta';
import { defaultLogger } from '@anthropic-ai/sdk/internal/utils/log';

const FIXTURES = path.resolve(__dirname, 'fixtures/fable-fallback');
const FALLBACK_MODEL = 'claude-opus-4-8';
const SECOND_MODEL = 'claude-sonnet-4-6';
const FALLBACKS = [{ model: FALLBACK_MODEL }];

// Wire-shaped synthetic capture — the primary refuses after a thinking +
// partial-text block and mints a credit token; the fallback then completes
// the message.
const STREAM_A = fs.readFileSync(path.join(FIXTURES, 'stream-a-refusal.sse'), 'utf8');
const STREAM_B = fs.readFileSync(path.join(FIXTURES, 'stream-b-fallback.sse'), 'utf8');

// Server-tool wire (synthetic, wire-shaped): server_tool_use streams its input
// via input_json_delta after an empty `input:{}`, the web_search_tool_result
// arrives as a single content_block_start carrying full content, and the
// refusal terminal (message_delta + token) lands mid-tool-loop, after a
// partial text block. The token is never redeemed (next is mocked).
const STREAM_A_TOOL = fs.readFileSync(path.join(FIXTURES, 'stream-a-toolrefusal.sse'), 'utf8');

// silence the missing-fallbackState warning in tests that fall back without one
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

// --- helpers --------------------------------------------------------------

const sseResponse = (body: string, init: ResponseInit = {}): Response =>
  new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' }, ...init });

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Serialize one event payload as an SSE frame (its `type` is the event name). */
const ev = (data: Record<string, unknown>): string =>
  `event: ${data['type']}\ndata: ${JSON.stringify(data)}\n\n`;

const messageStart = () =>
  ev({
    type: 'message_start',
    message: {
      id: 'msg_a',
      type: 'message',
      role: 'assistant',
      model: 'claude-fable-5',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 12, output_tokens: 1 },
    },
  });

const refusalDelta = (token: string | null = 'tok_abc', hasPrefillClaim = true) =>
  ev({
    type: 'message_delta',
    delta: {
      stop_reason: 'refusal',
      stop_sequence: null,
      stop_details: {
        type: 'refusal',
        category: null,
        explanation: null,
        fallback_credit_token: token,
        fallback_has_prefill_claim: hasPrefillClaim,
      },
    },
    usage: { output_tokens: 20 },
  });

interface RunOptions extends BetaRefusalFallbackOptions {
  fallbacks: BetaFallbackParam[];
  fallbackState?: BetaFallbackState;
  /** Overrides the wire body of the original request (defaults to the JSON-encoded originalBody). */
  requestBody?: APIRequest['body'];
}

interface RunResult {
  out: Response;
  events: Array<{ event: string | null; data: any }>;
  requests: APIRequest[];
}

/**
 * Drive the middleware directly: `next` returns the queued responses in order
 * (A, then the fallback B) — an `Error` entry is thrown instead, like a failed
 * fetch — and we collect the spliced output stream.
 */
async function runMiddleware(
  opts: RunOptions,
  originalBody: Record<string, unknown>,
  responses: Array<Response | Error>,
  { stream = true }: { stream?: boolean } = {},
): Promise<RunResult> {
  const requests: APIRequest[] = [];
  let call = 0;
  const next = async (req: APIRequest): Promise<Response> => {
    requests.push(req);
    const res = responses[call++];
    if (!res) throw new Error(`unexpected next() call #${call}`);
    if (res instanceof Error) throw res;
    return res;
  };
  const ctx: MiddlewareContext = {
    options: {
      method: 'post',
      path: '/v1/messages?beta=true',
      body: originalBody,
      stream,
      fallbackState: opts.fallbackState,
    } as any,
    logger: defaultLogger(),
    parse: async <T>(r: Response): Promise<T> => JSON.parse(await r.clone().text()) as T,
  };

  const requestA: APIRequest = {
    url: 'https://api.anthropic.com/v1/messages?beta=true',
    method: 'post',
    headers: new Headers({ 'anthropic-beta': 'interleaved-thinking-2025-05-14' }),
    body: opts.requestBody ?? JSON.stringify(originalBody),
  };

  const out = await betaRefusalFallbackMiddleware(opts.fallbacks, {
    onError: opts.onError,
    betas: opts.betas,
  })(requestA, next, ctx);

  const events: Array<{ event: string | null; data: any }> = [];
  if (stream) {
    for await (const sse of Stream.rawEvents(out, new AbortController())) {
      events.push({ event: sse.event, data: sse.data ? JSON.parse(sse.data) : null });
    }
  }
  return { out, events, requests };
}

/** Compact structural skeleton of a spliced stream — no text content. */
function skeleton(events: Array<{ event: string | null; data: any }>): string[] {
  return events.map(({ data: d }) => {
    switch (d.type) {
      case 'content_block_start':
        return `start[${d.index}] ${
          d.content_block.type === 'fallback' ?
            `fallback{${d.content_block.from.model}->${d.content_block.to.model}}`
          : d.content_block.type
        }`;
      case 'content_block_delta':
        return `delta[${d.index}] ${d.delta.type}`;
      case 'content_block_stop':
        return `stop[${d.index}]`;
      case 'message_delta':
        return `message_delta ${d.delta.stop_reason} iter=[${(d.usage?.iterations ?? [])
          .map((i: any) => `${i.type}:${i.model}`)
          .join(',')}]`;
      default:
        return d.type;
    }
  });
}

const ORIGINAL_BODY = {
  model: 'claude-fable-5',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hey claudius! Can you tell me what a solar eclipse is?' }],
};

// --- happy path -----------------------------------------------------------

describe('betaRefusalFallbackMiddleware (streaming) — shape-B continuation', () => {
  test('splices the fallback onto the refused stream (matches server-side shape)', async () => {
    const { events } = await runMiddleware({ fallbacks: FALLBACKS }, ORIGINAL_BODY, [
      sseResponse(STREAM_A),
      sseResponse(STREAM_B),
    ]);

    expect(skeleton(events)).toMatchSnapshot();

    // A's thinking + text are forwarded, a fallback boundary block is emitted
    // at the next monotonic index, then B's blocks continue after it.
    const starts = events.filter((e) => e.data.type === 'content_block_start').map((e) => e.data);
    expect(starts.map((s) => [s.index, s.content_block.type])).toEqual([
      [0, 'thinking'],
      [1, 'text'],
      [2, 'fallback'],
      [3, 'text'],
    ]);

    // The fallback block carries the from/to model transition.
    const fallback = starts.find((s) => s.content_block.type === 'fallback')!.content_block;
    expect(fallback).toEqual({
      type: 'fallback',
      from: { model: 'claude-fable-5' },
      to: { model: FALLBACK_MODEL },
      trigger: { type: 'refusal', category: null },
    });

    // Exactly one message_start (A's) and one message_stop reach the client —
    // B's message_start is suppressed.
    expect(events.filter((e) => e.data.type === 'message_start')).toHaveLength(1);
    expect(events.filter((e) => e.data.type === 'message_stop')).toHaveLength(1);
    expect(events.filter((e) => e.data.type === 'message_delta')).toHaveLength(1);
  });

  test('usage.iterations is the 2-entry server shape, with no spurious message:undefined', async () => {
    const { events } = await runMiddleware({ fallbacks: FALLBACKS }, ORIGINAL_BODY, [
      sseResponse(STREAM_A),
      sseResponse(STREAM_B),
    ]);

    const messageDelta = events.find((e) => e.data.type === 'message_delta')!.data;
    expect(messageDelta.delta.stop_reason).toBe('end_turn');
    expect(messageDelta.usage.iterations.map((i: any) => [i.type, i.model])).toEqual([
      ['message', 'claude-fable-5'],
      ['fallback_message', FALLBACK_MODEL],
    ]);
  });

  test('builds request B as a shape-B continuation', async () => {
    const { requests } = await runMiddleware({ fallbacks: FALLBACKS }, ORIGINAL_BODY, [
      sseResponse(STREAM_A),
      sseResponse(STREAM_B),
    ]);

    expect(requests).toHaveLength(2);
    const bodyB = JSON.parse(requests[1]!.body as string);

    // Model swapped to the fallback, credit token from A's stop_details set.
    expect(bodyB.model).toBe(FALLBACK_MODEL);
    expect(typeof bodyB.fallback_credit_token).toBe('string');
    expect(bodyB.fallback_credit_token.length).toBeGreaterThan(0);

    // Mutually exclusive with server-side fallback — both spellings stripped.
    expect(bodyB).not.toHaveProperty('fallback');
    expect(bodyB).not.toHaveProperty('fallbacks');

    // max_tokens untouched (any render-shaping change would 400).
    expect(bodyB.max_tokens).toBe(1024);

    // Original turn preserved; one assistant turn appended carrying the
    // [thinking, text] partial output as-is — the prefill claim authorizes
    // it verbatim, so no client-side filtering or trimming.
    expect(bodyB.messages).toHaveLength(2);
    expect(bodyB.messages[0]).toEqual(ORIGINAL_BODY.messages[0]);
    const appended = bodyB.messages[1];
    expect(appended.role).toBe('assistant');
    expect(appended.content.map((b: any) => b.type)).toEqual(['thinking', 'text']);
    expect(appended.content[0]).toHaveProperty('signature');
  });

  test('appends the fallback-credit beta to both the original and hop requests', async () => {
    // requestA already carries a beta header; the default is appended to it.
    const { requests } = await runMiddleware({ fallbacks: FALLBACKS }, ORIGINAL_BODY, [
      sseResponse(STREAM_A),
      sseResponse(STREAM_B),
    ]);

    expect(requests.map((r) => r.headers.get('anthropic-beta'))).toEqual([
      'interleaved-thinking-2025-05-14, fallback-credit-2026-06-01',
      'interleaved-thinking-2025-05-14, fallback-credit-2026-06-01',
    ]);
  });

  test('the betas option replaces the default on every request', async () => {
    const { requests } = await runMiddleware(
      { fallbacks: FALLBACKS, betas: ['fallback-credit-2027-01-01'] },
      ORIGINAL_BODY,
      [sseResponse(STREAM_A), sseResponse(STREAM_B)],
    );

    expect(requests.map((r) => r.headers.get('anthropic-beta'))).toEqual([
      'interleaved-thinking-2025-05-14, fallback-credit-2027-01-01',
      'interleaved-thinking-2025-05-14, fallback-credit-2027-01-01',
    ]);
  });
});

// --- edge cases -----------------------------------------------------------

describe('betaRefusalFallbackMiddleware (streaming) — edge cases', () => {
  test('a refusal without a prefill claim falls back to shape-A (no appended turn)', async () => {
    // fallback_has_prefill_claim: false — the partial output may not be
    // resent, so the middleware omits the prefill and resends the original
    // body with just the token attached.
    const noClaim = [
      `event: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: 'msg_a',
          type: 'message',
          role: 'assistant',
          model: 'claude-fable-5',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 1 },
        },
      })}\n\n`,
      `event: content_block_start\ndata: ${JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'thinking', thinking: '', signature: '' },
      })}\n\n`,
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'considering the request' },
      })}\n\n`,
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'signature_delta', signature: 'sig==' },
      })}\n\n`,
      `event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`,
      refusalDelta('tok_abc', false),
      `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
    ].join('');

    const { requests } = await runMiddleware({ fallbacks: FALLBACKS }, ORIGINAL_BODY, [
      sseResponse(noClaim),
      sseResponse(STREAM_B),
    ]);

    const bodyB = JSON.parse(requests[1]!.body as string);
    expect(bodyB.fallback_credit_token).toBe('tok_abc');
    // No appended assistant turn — identical body (shape-A).
    expect(bodyB.messages).toEqual(ORIGINAL_BODY.messages);
  });

  test('refusal with no credit token passes A through and reports via onError', async () => {
    const noToken = STREAM_A.replace(/"fallback_credit_token":"[^"]*"/, '"fallback_credit_token":null');
    const onError = jest.fn();

    const { events, requests } = await runMiddleware({ fallbacks: FALLBACKS, onError }, ORIGINAL_BODY, [
      sseResponse(noToken),
    ]);

    // Only the original request was made — no fallback.
    expect(requests).toHaveLength(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'no_credit_token',
        message: expect.stringContaining('no fallback_credit_token'),
        event: expect.objectContaining({ type: 'message_delta' }),
      }),
    );

    // A passes through unchanged, ending in its own refusal (no fallback block).
    expect(
      events.some((e) => e.data.type === 'content_block_start' && e.data.content_block.type === 'fallback'),
    ).toBe(false);
    expect(events.find((e) => e.data.type === 'message_delta')!.data.delta.stop_reason).toBe('refusal');
  });

  test('a 400 on the prefill form retries the same hop without the partial', async () => {
    const onError = jest.fn();
    const { events, requests } = await runMiddleware({ fallbacks: FALLBACKS, onError }, ORIGINAL_BODY, [
      sseResponse(STREAM_A),
      jsonResponse({ type: 'error', error: { type: 'invalid_request_error', message: 'bad prefill' } }, 400),
      sseResponse(STREAM_B),
    ]);

    // Attempt 1 appends A's partial; the 400 drops it and attempt 2 redeems
    // the same token against the unchanged body.
    expect(requests).toHaveLength(3);
    const body1 = JSON.parse(requests[1]!.body as string);
    const body2 = JSON.parse(requests[2]!.body as string);
    expect(body1.messages).toHaveLength(2);
    expect(body2.model).toBe(FALLBACK_MODEL);
    expect(body2.fallback_credit_token).toBe(body1.fallback_credit_token);
    expect(body2.messages).toEqual(ORIGINAL_BODY.messages);

    // The recovered hop is not a failure: one boundary, a normal completion.
    expect(onError).not.toHaveBeenCalled();
    const boundaries = events.filter(
      (e) => e.data.type === 'content_block_start' && e.data.content_block.type === 'fallback',
    );
    expect(boundaries).toHaveLength(1);
    const messageDelta = events.find((e) => e.data.type === 'message_delta')!.data;
    expect(messageDelta.delta.stop_reason).toBe('end_turn');
  });

  test('a failed fallback request synthesizes a refusal close and reports via onError', async () => {
    const onError = jest.fn();
    // Give A's refusal a real category/explanation to prove they thread through.
    const refusedA = STREAM_A.replace(
      '"category":null,"explanation":null',
      '"category":"safety","explanation":"declined to help"',
    );
    const { events, requests } = await runMiddleware({ fallbacks: FALLBACKS, onError }, ORIGINAL_BODY, [
      sseResponse(refusedA),
      jsonResponse({ type: 'error', error: { type: 'invalid_request_error', message: 'nope' } }, 400),
      jsonResponse({ type: 'error', error: { type: 'invalid_request_error', message: 'nope' } }, 400),
    ]);

    // The prefill form 400s, the same-body retry 400s too — only then does
    // the hop count as failed.
    expect(requests).toHaveLength(3);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'request_failed',
        message: expect.stringContaining('HTTP 400'),
        model: FALLBACK_MODEL,
        status: 400,
      }),
    );

    // The fallback boundary block was already emitted, then a synthetic refusal
    // message_delta + message_stop close the stream.
    expect(
      events.some((e) => e.data.type === 'content_block_start' && e.data.content_block.type === 'fallback'),
    ).toBe(true);
    const messageDelta = events.find((e) => e.data.type === 'message_delta')!.data;
    expect(messageDelta.delta.stop_reason).toBe('refusal');
    expect(events[events.length - 1]!.data.type).toBe('message_stop');

    // The held refusal is surfaced verbatim — category/explanation and the
    // still-unredeemed credit token — with recommended_model pointing at the
    // last hop we tried.
    const stopDetails = messageDelta.delta.stop_details;
    expect(stopDetails.category).toBe('safety');
    expect(stopDetails.explanation).toBe('declined to help');
    expect(stopDetails.recommended_model).toBe(FALLBACK_MODEL);
    expect(typeof stopDetails.fallback_credit_token).toBe('string');
    expect(stopDetails.fallback_credit_token.length).toBeGreaterThan(0);
  });

  test('a fallback request that throws synthesizes a refusal close instead of erroring the stream', async () => {
    const onError = jest.fn();
    const { events } = await runMiddleware({ fallbacks: FALLBACKS, onError }, ORIGINAL_BODY, [
      sseResponse(STREAM_A),
      new Error('connection reset'),
    ]);

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'request_failed',
        model: FALLBACK_MODEL,
        status: null,
        detail: expect.any(Error),
      }),
    );

    // The stream still closes cleanly: boundary block, then a synthetic
    // refusal message_delta + message_stop — not a hard stream error.
    const messageDelta = events.find((e) => e.data.type === 'message_delta')!.data;
    expect(messageDelta.delta.stop_reason).toBe('refusal');
    expect(events[events.length - 1]!.data.type).toBe('message_stop');
  });

  test('a non-string request body passes the stream through untouched (splicing needs the JSON body)', async () => {
    const onError = jest.fn();
    const resA = sseResponse(STREAM_A);
    const { out, requests } = await runMiddleware(
      {
        fallbacks: FALLBACKS,
        onError,
        requestBody: new TextEncoder().encode(JSON.stringify(ORIGINAL_BODY)),
      },
      ORIGINAL_BODY,
      [resA],
    );

    expect(requests).toHaveLength(1);
    expect(out).toBe(resA);
    expect(onError).not.toHaveBeenCalled();
  });

  test('a non-string request body still falls back on the non-streaming path', async () => {
    const refusal = jsonResponse(
      {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-fable-5',
        content: [],
        stop_reason: 'refusal',
        stop_sequence: null,
        stop_details: {
          type: 'refusal',
          category: null,
          explanation: null,
          fallback_credit_token: 'tok_json',
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      200,
    );
    const accepted = jsonResponse(
      {
        id: 'msg_2',
        type: 'message',
        role: 'assistant',
        model: FALLBACK_MODEL,
        content: [],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      200,
    );

    // The retry body is rebuilt from ctx.options.body, so an earlier
    // middleware rewriting the wire body (compression, signing) doesn't
    // disable the fallback.
    const { requests } = await runMiddleware(
      { fallbacks: FALLBACKS, requestBody: new TextEncoder().encode(JSON.stringify(ORIGINAL_BODY)) },
      ORIGINAL_BODY,
      [refusal, accepted],
      { stream: false },
    );

    expect(requests).toHaveLength(2);
    const bodyB = JSON.parse(requests[1]!.body as string);
    expect(bodyB.model).toBe(FALLBACK_MODEL);
    expect(bodyB.fallback_credit_token).toBe('tok_json');
  });

  test('pass-through preserves SSE fields the decoder does not model (id, retry, comments)', async () => {
    const wire =
      `retry: 1500\nevent: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: 'msg_a',
          type: 'message',
          role: 'assistant',
          model: 'claude-fable-5',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 1 },
        },
      })}\n\n` +
      `: keep-alive\nid: 42\nevent: message_delta\ndata: ${JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 3 },
      })}\n\n` +
      `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`;

    const ctx: MiddlewareContext = {
      options: { method: 'post', path: '/v1/messages?beta=true', body: ORIGINAL_BODY, stream: true } as any,
      logger: defaultLogger(),
      parse: async <T>(r: Response): Promise<T> => JSON.parse(await r.clone().text()) as T,
    };
    const requestA: APIRequest = {
      url: 'https://api.anthropic.com/v1/messages?beta=true',
      method: 'post',
      headers: new Headers(),
      body: JSON.stringify(ORIGINAL_BODY),
    };

    const out = await betaRefusalFallbackMiddleware(FALLBACKS)(requestA, async () => sseResponse(wire), ctx);
    expect(await out.text()).toBe(wire);
  });

  test('a non-refusal stream is passed through untouched', async () => {
    const normal = [
      `event: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: 'msg_a',
          type: 'message',
          role: 'assistant',
          model: 'claude-fable-5',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 1 },
        },
      })}\n\n`,
      `event: content_block_start\ndata: ${JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      })}\n\n`,
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Sure!' },
      })}\n\n`,
      `event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`,
      `event: message_delta\ndata: ${JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 3 },
      })}\n\n`,
      `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
    ].join('');
    const onError = jest.fn();

    const { events, requests } = await runMiddleware({ fallbacks: FALLBACKS, onError }, ORIGINAL_BODY, [
      sseResponse(normal),
    ]);

    expect(requests).toHaveLength(1);
    expect(onError).not.toHaveBeenCalled();
    expect(skeleton(events)).toEqual([
      'message_start',
      'start[0] text',
      'delta[0] text_delta',
      'stop[0]',
      'message_delta end_turn iter=[]',
      'message_stop',
    ]);
  });

  test('a non-streaming refusal retries through the same middleware (JSON path)', async () => {
    const refusal = jsonResponse(
      {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-fable-5',
        content: [],
        stop_reason: 'refusal',
        stop_sequence: null,
        stop_details: {
          type: 'refusal',
          category: null,
          explanation: null,
          fallback_credit_token: 'tok_json',
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      200,
    );
    const accepted = jsonResponse(
      {
        id: 'msg_2',
        type: 'message',
        role: 'assistant',
        model: FALLBACK_MODEL,
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      200,
    );

    const { out, requests } = await runMiddleware(
      { fallbacks: FALLBACKS },
      ORIGINAL_BODY,
      [refusal, accepted],
      { stream: false },
    );

    expect(requests).toHaveLength(2);
    const bodyB = JSON.parse(requests[1]!.body as string);
    expect(bodyB.model).toBe(FALLBACK_MODEL);
    expect(bodyB.fallback_credit_token).toBe('tok_json');
    // The seam block is prepended ahead of the serving hop's own content —
    // non-empty content distinguishes prepend from replace.
    const served: any = await out.json();
    expect(served.content).toEqual([
      {
        type: 'fallback',
        from: { model: ORIGINAL_BODY.model },
        to: { model: FALLBACK_MODEL },
        trigger: { type: 'refusal', category: null },
      },
      { type: 'text', text: 'ok' },
    ]);
    expect(served.model).toBe(FALLBACK_MODEL);
  });

  test('a non-streaming exhausted chain surfaces the final refusal verbatim (JSON path)', async () => {
    const refusalBody = (model: string) => ({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text: "I can't help with that." }],
      stop_reason: 'refusal',
      stop_sequence: null,
      stop_details: {
        type: 'refusal',
        category: null,
        explanation: null,
        fallback_credit_token: 'tok_json',
      },
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    const lastRefusal = refusalBody(FALLBACK_MODEL);
    const { out, requests } = await runMiddleware(
      { fallbacks: FALLBACKS },
      ORIGINAL_BODY,
      [jsonResponse(refusalBody('claude-fable-5'), 200), jsonResponse(lastRefusal, 200)],
      { stream: false },
    );

    expect(requests).toHaveLength(2);
    // No seam block is added to a refusal — the last hop's body is byte-for-
    // byte the stubbed refusal.
    const final: any = await out.json();
    expect(final).toEqual(lastRefusal);
  });
});

// --- fallbackState pinning --------------------------------------------------

describe('betaRefusalFallbackMiddleware (streaming) — fallbackState', () => {
  test('pins the state to the hop that served', async () => {
    const fallbackState = new BetaFallbackState();
    await runMiddleware({ fallbacks: FALLBACKS, fallbackState }, ORIGINAL_BODY, [
      sseResponse(STREAM_A),
      sseResponse(STREAM_B),
    ]);
    expect(fallbackState.index).toBe(0);
  });

  test('a pinned state starts on the pinned entry and chains past it', async () => {
    const fallbackState = new BetaFallbackState();
    fallbackState.index = 0;

    const { requests } = await runMiddleware(
      { fallbacks: [{ model: FALLBACK_MODEL }, { model: SECOND_MODEL }], fallbackState },
      ORIGINAL_BODY,
      [sseResponse(STREAM_A), sseResponse(STREAM_B)],
    );

    expect(requests).toHaveLength(2);
    // The initial request already carries the pinned entry's params; the
    // mid-stream refusal then chains to the entry after the pin.
    expect(JSON.parse(requests[0]!.body as string).model).toBe(FALLBACK_MODEL);
    expect(JSON.parse(requests[1]!.body as string).model).toBe(SECOND_MODEL);
    expect(fallbackState.index).toBe(1);
  });

  test('warns once when falling back without a fallbackState', async () => {
    const middleware = betaRefusalFallbackMiddleware(FALLBACKS);
    // an injected logger rather than a console.warn spy: the SDK caches bound
    // console methods across tests, so per-test console spies go stale
    const warn = jest.fn();
    const ctx: MiddlewareContext = {
      options: { method: 'post', path: '/v1/messages?beta=true', body: ORIGINAL_BODY, stream: true } as any,
      logger: { error: jest.fn(), warn, info: jest.fn(), debug: jest.fn() },
      parse: async <T>(r: Response): Promise<T> => JSON.parse(await r.clone().text()) as T,
    };
    const requestA: APIRequest = {
      url: 'https://api.anthropic.com/v1/messages?beta=true',
      method: 'post',
      headers: new Headers(),
      body: JSON.stringify(ORIGINAL_BODY),
    };

    for (let i = 0; i < 2; i++) {
      const responses = [sseResponse(STREAM_A), sseResponse(STREAM_B)];
      const out = await middleware(requestA, async () => responses.shift()!, ctx);
      // drain the spliced stream so the fallback actually fires
      for await (const _ of Stream.rawEvents(out, new AbortController()));
    }

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('fallbackState'));
  });
});

// --- fallback chain ---------------------------------------------------------

describe('betaRefusalFallbackMiddleware (streaming) — fallback chain', () => {
  // A fallback hop that contributes one text block, then refuses with a fresh token.
  const hopRefusal = [
    messageStart(),
    ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
    ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Partial from B. ' } }),
    ev({ type: 'content_block_stop', index: 0 }),
    refusalDelta('tok_b'),
    ev({ type: 'message_stop' }),
  ].join('');

  test('a refused hop splices its partial and chains to the next entry', async () => {
    const { events, requests } = await runMiddleware(
      { fallbacks: [{ model: FALLBACK_MODEL }, { model: SECOND_MODEL }] },
      ORIGINAL_BODY,
      [sseResponse(STREAM_A), sseResponse(hopRefusal), sseResponse(STREAM_B)],
    );

    expect(requests).toHaveLength(3);

    // Hop 1 redeems A's token; hop 2 redeems the fresh token minted by hop 1's
    // refusal, with hop 1's partial extending the same turn as-is.
    const body1 = JSON.parse(requests[1]!.body as string);
    const body2 = JSON.parse(requests[2]!.body as string);
    expect(body1.model).toBe(FALLBACK_MODEL);
    expect(body2.model).toBe(SECOND_MODEL);
    expect(body2.fallback_credit_token).toBe('tok_b');
    expect(body2.fallback_credit_token).not.toBe(body1.fallback_credit_token);
    expect(body2.messages[1].content).toEqual([
      ...body1.messages[1].content,
      { type: 'text', text: 'Partial from B. ' },
    ]);

    // One continuous message: A's blocks, boundary, hop 1's partial, boundary,
    // hop 2's blocks — indices stay monotonic across all three streams.
    const starts = events.filter((e) => e.data.type === 'content_block_start').map((e) => e.data);
    expect(starts.map((s) => [s.index, s.content_block.type])).toEqual([
      [0, 'thinking'],
      [1, 'text'],
      [2, 'fallback'],
      [3, 'text'],
      [4, 'fallback'],
      [5, 'text'],
    ]);
    expect(starts[2]!.content_block).toEqual({
      type: 'fallback',
      from: { model: 'claude-fable-5' },
      to: { model: FALLBACK_MODEL },
      trigger: { type: 'refusal', category: null },
    });
    expect(starts[4]!.content_block).toEqual({
      type: 'fallback',
      from: { model: FALLBACK_MODEL },
      to: { model: SECOND_MODEL },
      trigger: { type: 'refusal', category: null },
    });

    // Hop 1's refusal delta is suppressed; the terminal delta carries every hop.
    const deltas = events.filter((e) => e.data.type === 'message_delta');
    expect(deltas).toHaveLength(1);
    expect(deltas[0]!.data.delta.stop_reason).toBe('end_turn');
    expect(deltas[0]!.data.usage.iterations.map((i: any) => [i.type, i.model])).toEqual([
      ['message', 'claude-fable-5'],
      ['message', FALLBACK_MODEL],
      ['fallback_message', SECOND_MODEL],
    ]);
    expect(events.filter((e) => e.data.type === 'message_stop')).toHaveLength(1);
  });

  test('a refused hop without a prefill claim drops its partial from the next request', async () => {
    const hopNoClaim = [
      messageStart(),
      ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
      ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Partial from B. ' } }),
      ev({ type: 'content_block_stop', index: 0 }),
      refusalDelta('tok_b', false),
      ev({ type: 'message_stop' }),
    ].join('');

    const { requests } = await runMiddleware(
      { fallbacks: [{ model: FALLBACK_MODEL }, { model: SECOND_MODEL }] },
      ORIGINAL_BODY,
      [sseResponse(STREAM_A), sseResponse(hopNoClaim), sseResponse(STREAM_B)],
    );

    expect(requests).toHaveLength(3);
    const body1 = JSON.parse(requests[1]!.body as string);
    const body2 = JSON.parse(requests[2]!.body as string);
    expect(body2.fallback_credit_token).toBe('tok_b');
    // Hop 2 redeems the fresh token against the body it was minted for —
    // hop 1's request, including its appended turn — without hop 1's own
    // (unclaimed) partial output.
    expect(body2.messages).toEqual(body1.messages);
  });

  test('an HTTP-failed hop is skipped; the unredeemed token carries to the next entry', async () => {
    const onError = jest.fn();
    const { events, requests } = await runMiddleware(
      { fallbacks: [{ model: FALLBACK_MODEL }, { model: SECOND_MODEL }], onError },
      ORIGINAL_BODY,
      [
        sseResponse(STREAM_A),
        jsonResponse({ type: 'error', error: { type: 'overloaded_error', message: 'later' } }, 529),
        sseResponse(STREAM_B),
      ],
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'request_failed',
        message: expect.stringContaining('HTTP 529'),
        model: FALLBACK_MODEL,
        status: 529,
      }),
    );
    expect(requests).toHaveLength(3);

    // Same token and continuation — the failed hop never redeemed them.
    const body1 = JSON.parse(requests[1]!.body as string);
    const body2 = JSON.parse(requests[2]!.body as string);
    expect(body2.model).toBe(SECOND_MODEL);
    expect(body2.fallback_credit_token).toBe(body1.fallback_credit_token);
    expect(body2.messages).toEqual(body1.messages);

    // Both boundaries are from A — the failed hop contributed no output.
    const boundaries = events
      .filter((e) => e.data.type === 'content_block_start' && e.data.content_block.type === 'fallback')
      .map((e) => e.data.content_block);
    expect(boundaries).toEqual([
      {
        type: 'fallback',
        from: { model: 'claude-fable-5' },
        to: { model: FALLBACK_MODEL },
        trigger: { type: 'refusal', category: null },
      },
      {
        type: 'fallback',
        from: { model: 'claude-fable-5' },
        to: { model: SECOND_MODEL },
        trigger: { type: 'refusal', category: null },
      },
    ]);

    // The failed hop is absent from iterations (no usage came back).
    const delta = events.find((e) => e.data.type === 'message_delta')!.data;
    expect(delta.delta.stop_reason).toBe('end_turn');
    expect(delta.usage.iterations.map((i: any) => [i.type, i.model])).toEqual([
      ['message', 'claude-fable-5'],
      ['fallback_message', SECOND_MODEL],
    ]);
  });

  test('a terminal refusal with no entries left is emitted with the full iteration chain', async () => {
    const onError = jest.fn();
    const { events, requests } = await runMiddleware({ fallbacks: FALLBACKS, onError }, ORIGINAL_BODY, [
      sseResponse(STREAM_A),
      sseResponse(hopRefusal),
    ]);

    expect(requests).toHaveLength(2);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'chain_exhausted' }));
    const delta = events.find((e) => e.data.type === 'message_delta')!.data;
    expect(delta.delta.stop_reason).toBe('refusal');
    // The fresh token reaches the client for a manual retry.
    expect(delta.delta.stop_details.fallback_credit_token).toBe('tok_b');
    expect(delta.usage.iterations.map((i: any) => [i.type, i.model])).toEqual([
      ['message', 'claude-fable-5'],
      ['fallback_message', FALLBACK_MODEL],
    ]);
  });

  test('a token-less refusal on the final hop is still reported via onError', async () => {
    const onError = jest.fn();
    const hopNoToken = [
      messageStart(),
      ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
      ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Partial. ' } }),
      ev({ type: 'content_block_stop', index: 0 }),
      refusalDelta(null),
      ev({ type: 'message_stop' }),
    ].join('');

    const { events } = await runMiddleware({ fallbacks: FALLBACKS, onError }, ORIGINAL_BODY, [
      sseResponse(STREAM_A),
      sseResponse(hopNoToken),
    ]);

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'no_credit_token' }));
    expect(events.find((e) => e.data.type === 'message_delta')!.data.delta.stop_reason).toBe('refusal');
  });

  test('an empty chain passes the stream through untouched', async () => {
    const onError = jest.fn();
    const resA = sseResponse(STREAM_A);
    const { out, events, requests } = await runMiddleware({ fallbacks: [], onError }, ORIGINAL_BODY, [resA]);

    // With nothing to hop to, the response isn't even wrapped — no per-event
    // decode/re-encode overhead, and no error: this is the steady state of an
    // exhausted or fully-pinned chain.
    expect(requests).toHaveLength(1);
    expect(out).toBe(resA);
    expect(onError).not.toHaveBeenCalled();
    expect(events.find((e) => e.data.type === 'message_delta')!.data.delta.stop_reason).toBe('refusal');
  });

  test('a hop whose request throws is skipped; the unredeemed token carries to the next entry', async () => {
    const onError = jest.fn();
    const { events, requests } = await runMiddleware(
      { fallbacks: [{ model: FALLBACK_MODEL }, { model: SECOND_MODEL }], onError },
      ORIGINAL_BODY,
      [sseResponse(STREAM_A), new Error('connection reset'), sseResponse(STREAM_B)],
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'request_failed', model: FALLBACK_MODEL, status: null }),
    );
    expect(requests).toHaveLength(3);

    // Same token — the thrown hop never redeemed it.
    const body1 = JSON.parse(requests[1]!.body as string);
    const body2 = JSON.parse(requests[2]!.body as string);
    expect(body2.model).toBe(SECOND_MODEL);
    expect(body2.fallback_credit_token).toBe(body1.fallback_credit_token);

    // The stream completes normally from the next entry.
    const delta = events.find((e) => e.data.type === 'message_delta')!.data;
    expect(delta.delta.stop_reason).toBe('end_turn');
    expect(delta.usage.iterations.map((i: any) => [i.type, i.model])).toEqual([
      ['message', 'claude-fable-5'],
      ['fallback_message', SECOND_MODEL],
    ]);
  });
});

// --- cancellation -----------------------------------------------------------

describe('betaRefusalFallbackMiddleware (streaming) — cancellation', () => {
  test('cancelling the spliced body aborts an in-flight fallback request', async () => {
    let hopSignal: AbortSignal | null | undefined;
    let call = 0;
    const next = async (req: APIRequest): Promise<Response> => {
      call += 1;
      if (call === 1) return sseResponse(STREAM_A);
      hopSignal = req.signal;
      // a hanging fetch that rejects on abort, like a real fetch would
      return new Promise<Response>((_, reject) => {
        req.signal!.addEventListener(
          'abort',
          () => reject(new DOMException('This operation was aborted', 'AbortError')),
          { once: true },
        );
      });
    };
    const ctx: MiddlewareContext = {
      options: { method: 'post', path: '/v1/messages?beta=true', body: ORIGINAL_BODY, stream: true } as any,
      logger: defaultLogger(),
      parse: async <T>(r: Response): Promise<T> => JSON.parse(await r.clone().text()) as T,
    };
    const requestA: APIRequest = {
      url: 'https://api.anthropic.com/v1/messages?beta=true',
      method: 'post',
      headers: new Headers(),
      body: JSON.stringify(ORIGINAL_BODY),
    };

    const out = await betaRefusalFallbackMiddleware(FALLBACKS)(requestA, next, ctx);
    const reader = out.body!.getReader();
    const decoder = new TextDecoder();

    // Read past the fallback boundary, then pull once more so the generator
    // advances into the (hanging) hop request.
    let seen = '';
    while (!seen.includes('"type":"fallback"')) {
      const { value, done } = await reader.read();
      if (done) throw new Error('stream ended before the fallback boundary');
      seen += decoder.decode(value, { stream: true });
    }
    const pending = reader.read();
    for (let i = 0; i < 100 && !hopSignal; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(hopSignal).toBeDefined();
    expect(hopSignal!.aborted).toBe(false);

    // cancel() must abort the in-flight hop request and resolve promptly
    // rather than waiting for the hop's headers.
    await reader.cancel();
    expect(hopSignal!.aborted).toBe(true);
    // the pending read settles (with a queued chunk or done) instead of hanging
    await pending;
  });
});

// --- tool-use refusals ----------------------------------------------------
//
// Synthetic SSE (web_search-shaped) built from the documented wire shapes:
// server_tool_use streams its input via input_json_delta after an empty
// `input:{}`, and *_tool_result blocks arrive as a single content_block_start
// with full content (no deltas). The server decides prefillability and
// signals it via `fallback_has_prefill_claim`; the client's only rewrite is
// reassembling tool inputs from their accumulated JSON deltas.

const TOOL_USE_ID = 'srvtoolu_01';

describe('betaRefusalFallbackMiddleware (streaming) — tool-use refusals', () => {
  test('refusal after a completed server tool: continuation carries [thinking, server_tool_use, result, text]', async () => {
    const streamA = [
      messageStart(),
      ev({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'thinking', thinking: '', signature: '' },
      }),
      ev({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'let me look this up' },
      }),
      ev({ type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig==' } }),
      ev({ type: 'content_block_stop', index: 0 }),
      // server_tool_use: real input arrives via input_json_delta, not content_block_start.
      ev({
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'server_tool_use', id: TOOL_USE_ID, name: 'web_search', input: {} },
      }),
      ev({
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{"query":"solar eclipse"}' },
      }),
      ev({ type: 'content_block_stop', index: 1 }),
      // web_search_tool_result: full content in the start frame, no deltas.
      ev({
        type: 'content_block_start',
        index: 2,
        content_block: {
          type: 'web_search_tool_result',
          tool_use_id: TOOL_USE_ID,
          content: [
            {
              type: 'web_search_result',
              url: 'https://example.com',
              title: 'x',
              encrypted_content: 'e',
              page_age: null,
            },
          ],
        },
      }),
      ev({ type: 'content_block_stop', index: 2 }),
      ev({ type: 'content_block_start', index: 3, content_block: { type: 'text', text: '' } }),
      ev({ type: 'content_block_delta', index: 3, delta: { type: 'text_delta', text: 'Based on that, ' } }),
      ev({ type: 'content_block_stop', index: 3 }),
      refusalDelta(),
      ev({ type: 'message_stop' }),
    ].join('');

    const { events, requests } = await runMiddleware({ fallbacks: FALLBACKS }, ORIGINAL_BODY, [
      sseResponse(streamA),
      sseResponse(STREAM_B),
    ]);

    // A's four blocks forwarded, fallback boundary at index 4, B continues at 5.
    const starts = events.filter((e) => e.data.type === 'content_block_start').map((e) => e.data);
    expect(starts.map((s) => [s.index, s.content_block.type])).toEqual([
      [0, 'thinking'],
      [1, 'server_tool_use'],
      [2, 'web_search_tool_result'],
      [3, 'text'],
      [4, 'fallback'],
      [5, 'text'],
    ]);

    const appended = JSON.parse(requests[1]!.body as string).messages[1];
    expect(appended.role).toBe('assistant');
    expect(appended.content.map((b: any) => b.type)).toEqual([
      'thinking',
      'server_tool_use',
      'web_search_tool_result',
      'text',
    ]);
    // The tool input is the parsed input_json_delta payload, not the empty
    // `{}` from content_block_start.
    expect(appended.content[1]).toEqual({
      type: 'server_tool_use',
      id: TOOL_USE_ID,
      name: 'web_search',
      input: { query: 'solar eclipse' },
    });
    // The result keeps its pairing id and content.
    expect(appended.content[2].tool_use_id).toBe(TOOL_USE_ID);
  });

  test('full tool wire fixture: continuation carries [server_tool_use, result, text]', async () => {
    const { events, requests } = await runMiddleware({ fallbacks: FALLBACKS }, ORIGINAL_BODY, [
      sseResponse(STREAM_A_TOOL),
      sseResponse(STREAM_B),
    ]);

    const starts = events.filter((e) => e.data.type === 'content_block_start').map((e) => e.data);
    expect(starts.map((s) => [s.index, s.content_block.type])).toEqual([
      [0, 'server_tool_use'],
      [1, 'web_search_tool_result'],
      [2, 'text'],
      [3, 'fallback'],
      [4, 'text'],
    ]);

    const appended = JSON.parse(requests[1]!.body as string).messages[1];
    expect(appended.content.map((b: any) => b.type)).toEqual([
      'server_tool_use',
      'web_search_tool_result',
      'text',
    ]);
    // Tool input reassembled from the accumulated input_json_delta chunks.
    expect(appended.content[0]).toEqual({
      type: 'server_tool_use',
      id: 'srvtoolu_fixture_a_0001',
      name: 'web_search',
      input: { query: 'solar eclipse viewing safety news 2026' },
    });
    // The result block keeps its pairing id.
    expect(appended.content[1].tool_use_id).toBe('srvtoolu_fixture_a_0001');
    expect(appended.content[1].type).toBe('web_search_tool_result');
  });

  test('mid-loop refusal ending in thinking is appended as-is when the claim allows it', async () => {
    // [server_tool_use, result, thinking] — the server granted a prefill
    // claim, so the middleware appends the whole partial output verbatim,
    // trailing thinking block included; deciding prefillability is the
    // server's job now.
    const streamA = [
      messageStart(),
      ev({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'server_tool_use', id: TOOL_USE_ID, name: 'web_search', input: {} },
      }),
      ev({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"query":"x"}' },
      }),
      ev({ type: 'content_block_stop', index: 0 }),
      ev({
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'web_search_tool_result', tool_use_id: TOOL_USE_ID, content: [] },
      }),
      ev({ type: 'content_block_stop', index: 1 }),
      ev({
        type: 'content_block_start',
        index: 2,
        content_block: { type: 'thinking', thinking: '', signature: '' },
      }),
      ev({ type: 'content_block_delta', index: 2, delta: { type: 'thinking_delta', thinking: 'hmm' } }),
      ev({ type: 'content_block_delta', index: 2, delta: { type: 'signature_delta', signature: 'sig==' } }),
      ev({ type: 'content_block_stop', index: 2 }),
      refusalDelta(),
      ev({ type: 'message_stop' }),
    ].join('');

    const { requests } = await runMiddleware({ fallbacks: FALLBACKS }, ORIGINAL_BODY, [
      sseResponse(streamA),
      sseResponse(STREAM_B),
    ]);

    const bodyB = JSON.parse(requests[1]!.body as string);
    expect(bodyB.fallback_credit_token).toBe('tok_abc');
    const appended = bodyB.messages[1];
    expect(appended.role).toBe('assistant');
    expect(appended.content.map((b: any) => b.type)).toEqual([
      'server_tool_use',
      'web_search_tool_result',
      'thinking',
    ]);
    expect(appended.content[2]).toEqual({ type: 'thinking', thinking: 'hmm', signature: 'sig==' });
  });
});
