import { SpanStatusCode } from '@opentelemetry/api';
import { AnthropicError, APIUserAbortError, BadRequestError, InternalServerError } from '@anthropic-ai/sdk';
import type { BetaMessage, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta';
import { BetaMessageThread } from '@anthropic-ai/sdk/resources/beta/messages';
import {
  MODEL,
  MAX_TOKENS,
  ALREADY_CONTINUED,
  ALREADY_CONTINUED_MESSAGE,
  CONTEXT_MANAGEMENT_BETA,
  CONTINUE_IN_FLIGHT,
  CREATE,
  FALLBACKS,
  FALLBACK_BETA,
  FINGERPRINT_MISMATCH,
  FORECAST_FORMAT,
  INLINE_TOOLS_BETA,
  THREADS_BETA,
  THREAD_NOT_FOUND,
  WEATHER_TOOL_REMOVED,
  afterFallback,
  apiError,
  assistant,
  continueFrom,
  makeThread,
  message,
  mockAPI,
  neverResponds,
  stalledToolUse,
  stalledBeforeStart,
  stalledBeforeStop,
  stalledText,
  roles,
  serverError,
  streamed,
  truncatedText,
  unsupported,
  user,
  weatherTool,
  type MockAPI,
  type Responder,
} from './helpers';
import {
  MESSAGE,
  PARAMS,
  json,
  makeClient,
  onlySpan,
  openSpans,
  setUpTracing,
  spans,
} from '../../open-telemetry/utils';

const XLSX_SKILL = { type: 'anthropic' as const, skill_id: 'xlsx', version: 'latest' };
const NOOP_TOOL = {
  name: 'noop',
  description: 'Does nothing.',
  input_schema: { type: 'object' as const, properties: {} },
};
const EPHEMERAL = { type: 'ephemeral' as const };
const unmarked = (text: string): BetaMessageParam => ({ role: 'user', content: [{ type: 'text', text }] });
const marked = (text: string): BetaMessageParam => ({
  role: 'user',
  content: [{ type: 'text', text, cache_control: EPHEMERAL }],
});

describe('BetaMessageThread', () => {
  let api: MockAPI;
  beforeEach(() => {
    api = mockAPI();
  });

  test('first send creates a thread with the seed and the new messages', async () => {
    api.queue(message('msg_a'));
    const thread = makeThread(api, { messages: [user('Seed'), assistant('Seeded')] });

    const reply = await thread.send(user('Hello'));

    expect(api.bodies()[0]!['thread']).toEqual(CREATE);
    expect(api.bodies()[0]!['messages']).toEqual([user('Seed'), assistant('Seeded'), user('Hello')]);
    expect(thread.previousMessageId).toBe('msg_a');
    expect(reply.id).toBe('msg_a');
  });

  test('next send continues the thread with only the new messages', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api);

    await thread.send(user('Hello'));
    const second = await thread.send(user('Again'));

    expect(api.bodies()[1]!['thread']).toEqual(continueFrom('msg_a'));
    expect(api.bodies()[1]!['messages']).toEqual([user('Again')]);
    expect(thread.previousMessageId).toBe(second.id);
    expect(roles(thread.messages)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  test('continue omits the system and tools the server holds', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api, {
      model: 'claude-sonnet-5',
      system: 'You are terse.',
      tools: [NOOP_TOOL],
    });

    await thread.send(user('Hello'));
    await thread.send(user('Again'));

    const [created, continued] = api.bodies();
    expect([created!['system'], created!['tools']]).toEqual(['You are terse.', [NOOP_TOOL]]);
    expect(continued!['model']).toBe('claude-sonnet-5');
    expect(continued).not.toHaveProperty('system');
    expect(continued).not.toHaveProperty('tools');
  });

  test('replay after a continue sends system and tools again', async () => {
    api.queue(message('msg_a'), THREAD_NOT_FOUND, message('msg_c'));
    const thread = makeThread(api, { system: 'You are terse.', tools: [NOOP_TOOL] });
    await thread.send(user('Hello'));

    await thread.send(user('Again'));

    const replayed = api.bodies()[2]!;
    expect([replayed['thread'], replayed['system'], replayed['tools']]).toEqual([
      CREATE,
      'You are terse.',
      [NOOP_TOOL],
    ]);
  });

  test('send overrides apply to that turn only', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api, { max_tokens: 1024 });

    await thread.send(user('Hello'), { max_tokens: 12, speed: 'fast' });
    await thread.send(user('Again'));

    const [overridden, later] = api.bodies();
    expect([overridden!['max_tokens'], overridden!['speed']]).toEqual([12, 'fast']);
    expect(later!['max_tokens']).toBe(1024);
    expect(later).not.toHaveProperty('speed');
  });

  test.each([
    ['no betas', undefined, [THREADS_BETA]],
    ['another beta', [CONTEXT_MANAGEMENT_BETA], [CONTEXT_MANAGEMENT_BETA, THREADS_BETA]],
    [
      'the threads beta already set',
      [CONTEXT_MANAGEMENT_BETA, THREADS_BETA],
      [CONTEXT_MANAGEMENT_BETA, THREADS_BETA],
    ],
  ])('every turn sends the threads beta once after the caller betas: %s', async (_name, betas, expected) => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api, betas ? { betas } : {});

    await thread.send(user('Hello'));
    await thread.send(user('Again'));

    expect(api.betas()).toEqual([expected, expected]);
  });

  test.each([
    ['another beta', CONTEXT_MANAGEMENT_BETA],
    ['the threads beta already set', `${CONTEXT_MANAGEMENT_BETA}, ${THREADS_BETA}`],
  ])('caller anthropic-beta header gains the threads beta once: %s', async (_name, header) => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api, {}, { headers: { 'Anthropic-Beta': header } });

    await thread.send(user('Hello'));
    await thread.send(user('Again'), {}, { headers: { 'anthropic-beta': header } });

    const expected = [CONTEXT_MANAGEMENT_BETA, THREADS_BETA];
    expect(api.betas()).toEqual([expected, expected]);
  });

  test('caller anthropic-beta header is left alone once unthreaded', async () => {
    api.queue(unsupported('inference_hooks'), message('msg_b'));
    const thread = makeThread(
      api,
      { unsupportedRequestBehavior: 'continue_unthreaded' },
      { headers: { 'anthropic-beta': CONTEXT_MANAGEMENT_BETA } },
    );

    await thread.send(user('Hello'));

    expect(api.betas()).toEqual([[CONTEXT_MANAGEMENT_BETA, THREADS_BETA], [CONTEXT_MANAGEMENT_BETA]]);
  });

  test('every request names the message thread in the helper telemetry header', async () => {
    api.queue(
      message('msg_a'),
      streamed('msg_b'),
      THREAD_NOT_FOUND,
      message('msg_d'),
      unsupported('inference_hooks'),
      message('msg_f'),
      streamed('msg_g'),
      message('msg_h'),
    );
    const thread = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });

    await thread.send(user('One'));
    await thread.stream(user('Two')).finalMessage();
    await thread.send(user('Three'));
    await thread.send(user('Four'));
    await thread.stream(user('Five')).finalMessage();
    await thread.fork().send(user('Six'));

    expect(api.threads()).toEqual([
      CREATE,
      continueFrom('msg_a'),
      continueFrom('msg_b'),
      CREATE,
      continueFrom('msg_d'),
      null,
      null,
      null,
    ]);
    expect(api.helpers()).toEqual(Array(8).fill('message-thread'));
  });

  test("the message thread's helper tag follows the caller's own, and no later headers drop it", async () => {
    api.queue(message('msg_a'), message('msg_b'), message('msg_c'), message('msg_d'));
    const thread = makeThread(api, {}, { headers: { 'x-stainless-helper': 'mine' } });

    await thread.send(user('One'));
    await thread.send(user('Two'), {}, { headers: { 'X-Turn': 'turn' } });
    await thread.send(user('Three'), {}, { headers: { 'X-Stainless-Helper': 'message-thread, mine' } });
    thread.update({}, { headers: { 'x-stainless-helper': null } });
    await thread.send(user('Four'));

    expect(api.helpers()).toEqual([
      'mine, message-thread',
      'message-thread',
      'message-thread, mine',
      'message-thread',
    ]);
    expect(JSON.stringify(thread.params)).not.toContain('message-thread');
  });

  test('consecutive user messages are sent as they were appended', async () => {
    api.queue(message('msg_a'));
    const thread = makeThread(api);

    thread.append(user('part one'));
    thread.append({ role: 'user', content: [{ type: 'text', text: 'part two' }] });
    await thread.send();

    expect(api.bodies()[0]!['messages']).toEqual([
      user('part one'),
      { role: 'user', content: [{ type: 'text', text: 'part two' }] },
    ]);
  });

  test('the constructor starts the same thread as the factory', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = new BetaMessageThread(api.client, {
      model: MODEL,
      max_tokens: 64,
      system: 'Be brief.',
      messages: [user('Hello')],
    });

    await thread.send();
    await thread.send(user('Again'));

    const [first, second] = api.bodies();
    expect([first!['thread'], first!['system'], first!['messages']]).toEqual([
      CREATE,
      'Be brief.',
      [user('Hello')],
    ]);
    expect([second!['thread'], second!['messages']]).toEqual([continueFrom('msg_a'), [user('Again')]]);
  });

  test('send with nothing staged goes out, and the API answers', async () => {
    api.queue(
      message('msg_a'),
      apiError(400, 'invalid_request_error', 'messages: at least one message is required'),
    );
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    await expect(thread.send()).rejects.toThrow(BadRequestError);

    const body = api.bodies()[1]!;
    expect([body['thread'], body['messages']]).toEqual([continueFrom('msg_a'), []]);
    expect(thread.previousMessageId).toBe('msg_a');
  });

  test('send after a paused reply continues from it with no messages', async () => {
    api.queue(message('msg_a', 'Searching', { stopReason: 'pause_turn' }), message('msg_b'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    const resumed = await thread.send();

    expect(api.bodies()[1]!['thread']).toEqual(continueFrom('msg_a'));
    expect(api.bodies()[1]!['messages']).toEqual([]);
    expect(thread.previousMessageId).toBe(resumed.id);
  });

  test('a turn that pauses twice continues from the second pause with no messages', async () => {
    api.queue(
      message('msg_a', 'Searching', { stopReason: 'pause_turn' }),
      message('msg_b', 'Still searching', { stopReason: 'pause_turn' }),
      message('msg_c'),
    );
    const thread = makeThread(api);
    await thread.send(user('Hello'));
    await thread.send();

    await thread.send();

    expect(api.bodies()[2]!['thread']).toEqual(continueFrom('msg_b'));
    expect(api.bodies()[2]!['messages']).toEqual([]);
    expect(roles(thread.messages)).toEqual(['user', 'assistant', 'assistant', 'assistant']);
  });

  test('send after a resumed turn finishes continues from its last reply', async () => {
    api.queue(
      message('msg_a', 'Searching', { stopReason: 'pause_turn' }),
      message('msg_b'),
      message('msg_c'),
    );
    const thread = makeThread(api);
    await thread.send(user('Hello'));
    await thread.send();

    await thread.send(user('Again'));

    expect(api.bodies()[2]!['thread']).toEqual(continueFrom('msg_b'));
    expect(api.bodies()[2]!['messages']).toEqual([user('Again')]);
  });

  test('user message after a paused reply is sent alone and the 400 is thrown', async () => {
    const unexecuted = apiError(
      400,
      'invalid_request_error',
      'messages.0: `server_tool_use` was not executed',
    );
    api.queue(message('msg_a', 'Searching', { stopReason: 'pause_turn' }), unexecuted);
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    await expect(thread.send(user('Never mind'))).rejects.toThrow(BadRequestError);

    expect(api.bodies()[1]!['thread']).toEqual(continueFrom('msg_a'));
    expect(api.bodies()[1]!['messages']).toEqual([user('Never mind')]);
  });

  test('resume stream that ends before any content keeps the paused reply resumable', async () => {
    api.queue(
      message('msg_a', 'Searching', { stopReason: 'pause_turn' }),
      stalledText('msg_b', 'found it', { deltas: 0 }),
      message('msg_c'),
    );
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    const stream = thread.stream();
    for await (const event of stream) {
      expect(event.type).toBe('message_start');
      break;
    }
    await stream.done().catch(() => {});
    await thread.send();

    const retried = api.bodies()[2]!;
    expect([retried['thread'], retried['messages']]).toEqual([
      CREATE,
      [user('Hello'), assistant('Searching')],
    ]);
    expect(thread.previousMessageId).toBe('msg_c');
  });

  test('resume that finds the thread gone replays the history ending in the paused reply', async () => {
    api.queue(
      message('msg_a', 'Searching', { stopReason: 'pause_turn' }),
      THREAD_NOT_FOUND,
      message('msg_c'),
    );
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    await thread.send();

    expect(api.bodies()[2]!['thread']).toEqual(CREATE);
    expect(api.bodies()[2]!['messages']).toEqual([user('Hello'), assistant('Searching')]);
  });

  test.each([
    ['thread_not_found', THREAD_NOT_FOUND],
    ['thread_already_continued', ALREADY_CONTINUED],
    ['thread_continue_in_flight', CONTINUE_IN_FLIGHT],
  ])(
    'rejected previous_message_id (%s) replays the full history under a new thread',
    async (reason, rejection) => {
      api.queue(message('msg_a'), rejection, message('msg_c'));
      const thread = makeThread(api);

      await thread.send(user('Hello'));
      const second = await thread.send(user('Again'));

      const [, rejected, replayed] = api.bodies();
      expect([rejected!['thread'], rejected!['messages']]).toEqual([continueFrom('msg_a'), [user('Again')]]);
      expect([replayed!['thread'], replayed!['messages']]).toEqual([
        CREATE,
        [user('Hello'), assistant(), user('Again')],
      ]);
      expect(thread.previousMessageId).toBe(second.id);
      expect(second.id).toBe('msg_c');
      expect(api.logger.info).toHaveBeenCalledWith(
        `Replaying the full message history under a new thread: reason=${reason} previous_message_id=msg_a`,
      );
    },
  );

  test('replayed send resolves withResponse() to the response of the request that succeeded', async () => {
    api.queue(message('msg_a'), THREAD_NOT_FOUND, message('msg_c'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    const { data, response, request_id } = await thread.send(user('Again')).withResponse();

    expect(data.id).toBe('msg_c');
    expect(response.headers.get('request-id')).toBe('req_msg_c');
    expect(request_id).toBe('req_msg_c');
  });

  test.each([
    ['fingerprint mismatch', FINGERPRINT_MISMATCH],
    [
      'already continued without an error code',
      apiError(400, 'invalid_request_error', ALREADY_CONTINUED_MESSAGE),
    ],
  ])('other thread rejections throw and keep previousMessageId: %s', async (_name, rejection) => {
    api.queue(message('msg_a'), rejection);
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    await expect(thread.send(user('Again'))).rejects.toThrow(BadRequestError);

    expect(api.requests).toHaveLength(2);
    expect(thread.previousMessageId).toBe('msg_a');
    expect(thread.messages).toEqual([user('Hello'), assistant()]);
  });

  test('unsupported request throws by default and keeps previousMessageId', async () => {
    api.queue(message('msg_a'), unsupported('fallbacks'), message('msg_c'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    await expect(thread.send(user('Again'), { fallbacks: FALLBACKS })).rejects.toThrow(BadRequestError);
    await thread.send(user('Again'));

    const retried = api.bodies()[2]!;
    expect(api.requests).toHaveLength(3);
    expect([retried['thread'], retried['messages']]).toEqual([continueFrom('msg_a'), [user('Again')]]);
    expect(retried).not.toHaveProperty('fallbacks');
    expect(thread.previousMessageId).toBe('msg_c');
  });

  test.each([[['fallbacks']], [['inference_hooks']], [['fallbacks', 'thinking']], [['something_new']]])(
    'continue_unthreaded stops threading for good after an unsupported request: %j',
    async (features) => {
      api.queue(message('msg_a'), unsupported(...features), message('msg_c'), message('msg_d'));
      const thread = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });
      await thread.send(user('Hello'));

      await thread.send(user('Again'));
      await thread.send(user('Once more'));

      const [, rejected, unthreaded, later] = api.bodies();
      expect(api.threads()).toEqual([CREATE, continueFrom('msg_a'), null, null]);
      expect(api.betas().slice(2)).toEqual([[], []]);
      expect(rejected!['messages']).toEqual([user('Again')]);
      expect(unthreaded!['messages']).toEqual([user('Hello'), assistant(), user('Again')]);
      expect(roles(later!['messages'])).toEqual(['user', 'assistant', 'user', 'assistant', 'user']);
      expect(thread.previousMessageId).toBeNull();
      expect(api.logger.info).toHaveBeenCalledWith(
        `The server cannot thread this request; continuing without a thread: unsupported=${features.join(
          ',',
        )}`,
      );
    },
  );

  test('continue_unthreaded sends the turn again without a thread when the rejection names no feature', async () => {
    const unnamed = apiError(400, 'invalid_request_error', 'This request cannot be used with `thread`.', {
      errorCode: 'thread_unsupported_request',
    });
    api.queue(unnamed, message('msg_b'));
    const thread = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });

    await thread.send(user('Hello'));

    expect(api.threads()).toEqual([CREATE, null]);
    expect(api.bodies()[1]!['messages']).toEqual([user('Hello')]);
  });

  test('continue_unthreaded replay that is unsupported goes without a thread', async () => {
    api.queue(
      message('msg_a'),
      THREAD_NOT_FOUND,
      unsupported('fallbacks'),
      message('msg_d'),
      message('msg_e'),
    );
    const thread = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });
    await thread.send(user('Hello'));

    await thread.send(user('Again'), { fallbacks: FALLBACKS });
    await thread.send(user('Once more'));

    const [, , , unthreaded, later] = api.bodies();
    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a'), CREATE, null, null]);
    expect(roles(unthreaded!['messages'])).toEqual(['user', 'assistant', 'user']);
    expect(roles(later!['messages'])).toEqual(['user', 'assistant', 'user', 'assistant', 'user']);
    expect(thread.previousMessageId).toBeNull();
  });

  test('continue_unthreaded stream stops threading for good after an unsupported request', async () => {
    api.queue(message('msg_a'), unsupported('fallbacks'), streamed('msg_c', 'Fallback'), message('msg_d'));
    const thread = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });
    await thread.send(user('Hello'));

    const reply = await thread.stream(user('Again'), { fallbacks: FALLBACKS }).finalMessage();
    await thread.send(user('Once more'));

    const [, , unthreaded, later] = api.bodies();
    expect(reply.id).toBe('msg_c');
    expect(unthreaded!['stream']).toBe(true);
    expect(unthreaded).not.toHaveProperty('thread');
    expect(later).not.toHaveProperty('thread');
    expect(roles(later!['messages'])).toEqual(['user', 'assistant', 'user', 'assistant', 'user']);
    expect(thread.previousMessageId).toBeNull();
  });

  test('continue_unthreaded stops threading when the first continue after a replay finds the thread gone too', async () => {
    api.queue(message('msg_a'), THREAD_NOT_FOUND, message('msg_c'), THREAD_NOT_FOUND, message('msg_e'));
    api.queue(message('msg_f'));
    const thread = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });
    await thread.send(user('One'));
    await thread.send(user('Two'));

    await thread.send(user('Three'));
    await thread.send(user('Four'));

    const history = [user('One'), assistant(), user('Two'), assistant(), user('Three')];
    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a'), CREATE, continueFrom('msg_c'), null, null]);
    expect(api.bodies()[4]!['messages']).toEqual(history);
    expect(api.bodies()[5]!['messages']).toEqual([...history, assistant(), user('Four')]);
    expect(thread.previousMessageId).toBeNull();
  });

  test('a thread gone on the first continue after a replay is replayed again by default', async () => {
    api.queue(message('msg_a'), THREAD_NOT_FOUND, message('msg_c'), THREAD_NOT_FOUND, message('msg_e'));
    const thread = makeThread(api);
    await thread.send(user('One'));
    await thread.send(user('Two'));

    await thread.send(user('Three'));

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a'), CREATE, continueFrom('msg_c'), CREATE]);
    expect(thread.previousMessageId).toBe('msg_e');
  });

  test('continue_unthreaded replays a thread that is gone after a continue of the replay succeeded', async () => {
    api.queue(message('msg_a'), THREAD_NOT_FOUND, message('msg_c'), message('msg_d'));
    api.queue(THREAD_NOT_FOUND, message('msg_f'));
    const thread = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });
    await thread.send(user('One'));
    await thread.send(user('Two'));
    await thread.send(user('Three'));

    await thread.send(user('Four'));

    expect(api.threads().slice(2)).toEqual([CREATE, continueFrom('msg_c'), continueFrom('msg_d'), CREATE]);
    expect(thread.previousMessageId).toBe('msg_f');
  });

  test.each([
    ['thread_already_continued, then thread_not_found', ALREADY_CONTINUED, THREAD_NOT_FOUND],
    ['thread_not_found, then thread_already_continued', THREAD_NOT_FOUND, ALREADY_CONTINUED],
    ['thread_continue_in_flight, then thread_not_found', CONTINUE_IN_FLIGHT, THREAD_NOT_FOUND],
    ['thread_not_found, then thread_continue_in_flight', THREAD_NOT_FOUND, CONTINUE_IN_FLIGHT],
  ])('continue_unthreaded keeps threading after %s', async (_name, first, second) => {
    api.queue(message('msg_a'), first, message('msg_c'), second, message('msg_e'));
    const thread = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });
    await thread.send(user('One'));
    await thread.send(user('Two'));

    await thread.send(user('Three'));

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a'), CREATE, continueFrom('msg_c'), CREATE]);
  });

  test.each<[string, Responder, typeof BadRequestError | typeof InternalServerError]>([
    ['bad request', apiError(400, 'invalid_request_error', 'messages.1.content: too long'), BadRequestError],
    ['server error', serverError(), InternalServerError],
  ])('unrelated errors throw and leave the thread as it was: %s', async (_name, rejection, errorType) => {
    api.queue(message('msg_a'), rejection);
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    await expect(thread.send(user('Again'))).rejects.toThrow(errorType);

    expect(api.requests).toHaveLength(2);
    expect(thread.previousMessageId).toBe('msg_a');
    expect(thread.messages).toEqual([user('Hello'), assistant()]);
  });

  test('the message of a send that failed is not sent with the next turn', async () => {
    api.queue(
      message('msg_a'),
      apiError(400, 'invalid_request_error', 'messages.0: too long'),
      message('msg_c'),
    );
    const thread = makeThread(api);
    await thread.send(user('Hello'));
    await expect(thread.send(user('Again'))).rejects.toThrow(BadRequestError);

    await thread.send(user('Never mind'));

    expect(api.bodies()[2]!['thread']).toEqual(continueFrom('msg_a'));
    expect(api.bodies()[2]!['messages']).toEqual([user('Never mind')]);
    expect(thread.previousMessageId).toBe('msg_c');
  });

  const FAILURES = [
    'rejected with a 400',
    'rejected with a 529',
    'unable to connect',
    'timed out',
    'aborted',
    'refused for a changed system',
  ] as const;

  test.each(
    (['send', 'parse', 'stream'] as const).flatMap((method) =>
      FAILURES.map((failure) => [method, failure] as const),
    ),
  )(
    '%s() that is %s takes its message back, so the same call again sends it once',
    async (method, failure) => {
      const controller = new AbortController();
      const unanswered = () => new Promise<Response>(() => {});
      type SendArguments = Parameters<BetaMessageThread['send']>;
      type Overrides = { params?: SendArguments[1]; options?: SendArguments[2] };
      const failures: Record<(typeof FAILURES)[number], Overrides & { responder?: Responder }> = {
        'rejected with a 400': { responder: apiError(400, 'invalid_request_error', 'messages.0: too long') },
        'rejected with a 529': { responder: apiError(529, 'overloaded_error', 'Overloaded') },
        'unable to connect': {
          responder: () => {
            throw new TypeError('fetch failed');
          },
        },
        'timed out': { responder: unanswered, options: { timeout: 1 } },
        aborted: {
          responder: () => {
            controller.abort();
            return unanswered();
          },
          options: { signal: controller.signal },
        },
        'refused for a changed system': { params: { system: 'Be verbose.' } },
      };
      const { responder, ...overrides } = failures[failure];
      api.queue(
        message('msg_a'),
        ...(responder ? [responder] : []),
        method === 'stream' ? streamed('msg_c') : message('msg_c'),
      );
      const thread = makeThread(api, { system: 'Be brief.' });
      const call = ({ params, options }: Overrides = {}) =>
        method === 'stream' ?
          thread.stream(user('Count'), params, options).done()
        : thread[method](user('Count'), params, options);
      await thread.send(user('Hello'));

      await expect(call(overrides)).rejects.toThrow(AnthropicError);
      const afterFailure = [thread.messages, thread.previousMessageId];
      await call();

      const retried = api.bodies().at(-1)!;
      expect(afterFailure).toEqual([[user('Hello'), assistant()], 'msg_a']);
      expect([retried['thread'], retried['messages']]).toEqual([continueFrom('msg_a'), [user('Count')]]);
      expect(thread.previousMessageId).toBe('msg_c');
    },
  );

  test('a send that fails keeps what append() staged before and during it', async () => {
    api.queue(message('msg_a'), serverError(), message('msg_c'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    thread.append(user('Staged before'));
    const failed = thread.send(user('Again'));
    thread.append(user('Staged during'));
    await expect(failed).rejects.toThrow(InternalServerError);
    await thread.send();

    expect(api.bodies()[1]!['messages']).toEqual([user('Staged before'), user('Again')]);
    expect(api.bodies()[2]!['thread']).toEqual(continueFrom('msg_a'));
    expect(api.bodies()[2]!['messages']).toEqual([user('Staged before'), user('Staged during')]);
  });

  test.each(['send', 'parse', 'stream'] as const)(
    '%s() that is refused takes its message back, and the next turn starts a new thread',
    async (method) => {
      const respond = method === 'stream' ? streamed : message;
      api.queue(message('msg_a'), respond('msg_b', 'No.', { stopReason: 'refusal' }), message('msg_c'));
      const thread = makeThread(api, { system: 'Be brief.', tools: [NOOP_TOOL] });
      await thread.send(user('Hello'));

      const refused = await (method === 'stream' ?
        thread.stream(user('Refuse this')).finalMessage()
      : thread[method](user('Refuse this')));
      const afterRefusal = [thread.messages, thread.previousMessageId];
      await thread.send(user('Never mind'));

      expect(refused).toMatchObject({ id: 'msg_b', stop_reason: 'refusal', ...assistant('No.') });
      expect(afterRefusal).toEqual([[user('Hello'), assistant()], null]);
      expect(api.bodies()[1]!['thread']).toEqual(continueFrom('msg_a'));
      expect(api.bodies()[2]).toMatchObject({
        thread: CREATE,
        messages: [user('Hello'), assistant(), user('Never mind')],
        system: 'Be brief.',
        tools: [NOOP_TOOL],
      });
      expect(thread.previousMessageId).toBe('msg_c');
    },
  );

  test('a stream left once its reply has said it is a refusal takes its message back like a whole refusal', async () => {
    api.queue(
      message('msg_a'),
      stalledBeforeStop('msg_b', 'No.', { stopReason: 'refusal' }),
      message('msg_c'),
    );
    const thread = makeThread(api);
    await thread.send(user('Hello'));
    thread.append(user('Staged'));
    const stream = thread.stream(user('Refuse this'));
    stream.on('streamEvent', (event) => event.type === 'message_delta' && stream.abort());
    await stream.done().catch(() => {});
    const afterStream = [thread.messages, thread.previousMessageId];

    await thread.send(user('Never mind'));

    expect(afterStream).toEqual([[user('Hello'), assistant(), user('Staged')], null]);
    expect([api.bodies()[2]!['thread'], api.bodies()[2]!['messages']]).toEqual([
      CREATE,
      [user('Hello'), assistant(), user('Staged'), user('Never mind')],
    ]);
  });

  test('a refused first turn leaves the seed staged and keeps no system or tools it was given', async () => {
    api.queue(message('msg_a', 'No.', { stopReason: 'refusal' }), message('msg_b'));
    const thread = makeThread(api, { messages: [user('Seed'), assistant('Seeded')] });

    await thread.send(user('Refuse this'), { system: 'Be rude.', tools: [NOOP_TOOL] });
    await thread.send(user('Never mind'));

    const next = api.bodies()[1]!;
    expect([next['thread'], next['messages']]).toEqual([
      CREATE,
      [user('Seed'), assistant('Seeded'), user('Never mind')],
    ]);
    expect(next).not.toHaveProperty('system');
    expect(next).not.toHaveProperty('tools');
  });

  test('a refused send keeps what append() staged', async () => {
    api.queue(message('msg_a'), message('msg_b', 'No.', { stopReason: 'refusal' }), message('msg_c'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    thread.append(user('Staged'));
    await thread.send(user('Refuse this'));
    await thread.send(user('Never mind'));

    expect(api.bodies()[2]!['messages']).toEqual([
      user('Hello'),
      assistant(),
      user('Staged'),
      user('Never mind'),
    ]);
  });

  test('a refused send on a thread that has stopped threading takes its message back', async () => {
    api.queue(unsupported('fallbacks'), message('msg_b'), message('msg_c', 'No.', { stopReason: 'refusal' }));
    api.queue(message('msg_d'));
    const thread = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });
    await thread.send(user('Hello'));

    await thread.send(user('Refuse this'));
    await thread.send(user('Never mind'));

    expect(api.threads()).toEqual([CREATE, null, null, null]);
    expect(api.bodies()[3]!['messages']).toEqual([user('Hello'), assistant(), user('Never mind')]);
  });

  test('failed replay clears previousMessageId', async () => {
    api.queue(message('msg_a'), THREAD_NOT_FOUND, serverError());
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    await expect(thread.send(user('Again'))).rejects.toThrow(InternalServerError);

    expect(api.requests).toHaveLength(3);
    expect(thread.previousMessageId).toBeNull();
  });

  test('turn after a failed replay creates a thread with the full history', async () => {
    api.queue(message('msg_a'), THREAD_NOT_FOUND, serverError(), message('msg_d'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));
    await expect(thread.send(user('Again'))).rejects.toThrow(InternalServerError);

    await thread.send(user('Again'));

    const body = api.bodies()[3]!;
    expect([body['thread'], body['messages']]).toEqual([CREATE, [user('Hello'), assistant(), user('Again')]]);
    expect(thread.previousMessageId).toBe('msg_d');
  });

  test('a replay drops the cache markers of the stored messages, on the wire only', async () => {
    const texts = ['One', 'Two', 'Three', 'Four', 'Five'];
    const given = texts.map(marked);
    api.queue(...texts.map((text) => message(`msg_${text}`)), THREAD_NOT_FOUND, message('msg_replayed'));
    const thread = makeThread(api);
    for (const turn of given) await thread.send(turn);

    await thread.send(marked('Six'));

    const replayed = api.bodies().at(-1)!;
    expect([replayed['thread'], replayed['messages']]).toEqual([
      CREATE,
      [...texts.flatMap((text) => [unmarked(text), assistant()]), marked('Six')],
    ]);
    expect(thread.messages).toEqual([...texts, 'Six'].flatMap((text) => [marked(text), assistant()]));
    expect(given).toEqual(texts.map(marked));
  });

  test.each<[string, Responder[], (thread: BetaMessageThread) => Promise<BetaMessageThread>]>([
    [
      'that starts a new thread after a refusal',
      [message('msg_b', 'No.', { stopReason: 'refusal' })],
      async (thread) => {
        await thread.send(user('Refuse this'));
        return thread;
      },
    ],
    ['of a fork', [], async (thread) => thread.fork()],
    ['that goes out without a thread', [unsupported('fallbacks')], async (thread) => thread],
    [
      'after the thread has stopped threading',
      [unsupported('fallbacks'), message('msg_b')],
      async (thread) => {
        await thread.send(user('Again'));
        return thread;
      },
    ],
  ])('a request %s drops the cache markers of the stored messages', async (_name, responders, prepare) => {
    api.queue(message('msg_a'), ...responders, message('msg_z'));
    const original = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });
    await original.send(marked('One'));
    const thread = await prepare(original);
    const stored = thread.messages.slice(2);

    await thread.send(marked('Two'));

    expect(api.bodies().at(-1)!['messages']).toEqual([
      unmarked('One'),
      assistant(),
      ...stored,
      marked('Two'),
    ]);
  });

  test('the first request of a thread sends the cache markers of its messages as given', async () => {
    api.queue(message('msg_a'));
    const thread = makeThread(api, { messages: [marked('Seed'), assistant('Seeded')] });
    thread.append(marked('Staged'));

    await thread.send(marked('Hello'));

    expect(api.bodies()[0]!['messages']).toEqual([
      marked('Seed'),
      assistant('Seeded'),
      marked('Staged'),
      marked('Hello'),
    ]);
  });

  test.each([
    ['alone', []],
    ['with a new message', [marked('Aloud')]],
  ])('a turn that got no reply is sent again %s with its cache markers as given', async (_name, added) => {
    const unanswered: BetaMessageParam = {
      role: 'user',
      content: [
        { type: 'text', text: 'Count', cache_control: EPHEMERAL },
        { type: 'text', text: 'to ten', cache_control: EPHEMERAL },
      ],
    };
    api.queue(message('msg_a'), stalledText('msg_b', 'one two', { deltas: 0 }), message('msg_c'));
    const thread = makeThread(api);
    await thread.send(marked('Hello'));
    const stream = thread.stream(unanswered);
    for await (const _event of stream) break;
    await stream.done().catch(() => {});

    await thread.send(added);

    expect([api.bodies()[2]!['thread'], api.bodies()[2]!['messages']]).toEqual([
      CREATE,
      [unmarked('Hello'), assistant(), unanswered, ...added],
    ]);
  });

  test('a replay drops the cache markers of nested blocks and leaves every other value alone', async () => {
    const input = { cache_control: 'no-store' };
    const tool = (marker: { cache_control?: typeof EPHEMERAL }) => ({
      type: 'tool_definition' as const,
      definition: {
        name: 'fetch',
        input_schema: { type: 'object' as const, properties: { cache_control: { type: 'string' } } },
        input_examples: [input],
        ...marker,
      },
    });
    const toolChanges = [
      { type: 'tool_addition' as const, tool: tool({ cache_control: EPHEMERAL }), cache_control: EPHEMERAL },
    ];
    const history = (marker: { cache_control?: typeof EPHEMERAL }): BetaMessageParam[] => [
      {
        role: 'assistant',
        content: [{ type: 'compaction', content: 'Summary', tool_changes: toolChanges, ...marker }],
      },
      { role: 'system', content: [{ type: 'tool_addition', tool: tool(marker), ...marker }] },
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'content', content: [{ type: 'text', text: 'Page', ...marker }] },
            ...marker,
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          { type: 'server_tool_use', id: 'srvtoolu_a', name: 'tool_search_tool_regex', input: {}, ...marker },
          {
            type: 'tool_search_tool_result',
            tool_use_id: 'srvtoolu_a',
            content: {
              type: 'tool_search_tool_search_result',
              tool_references: [{ type: 'tool_reference', tool_name: 'fetch', ...marker }],
            },
            ...marker,
          },
          { type: 'tool_use', id: 'toolu_a', name: 'fetch', input, ...marker },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_a',
            content: [{ type: 'text', text: 'Fetched', ...marker }],
            ...marker,
          },
        ],
      },
    ];
    const given = history({ cache_control: EPHEMERAL });
    api.queue(message('msg_a'), THREAD_NOT_FOUND, message('msg_c'));
    const thread = makeThread(api, { messages: given.slice(0, -1) });
    await thread.send(given.at(-1)!);

    await thread.send(user('Again'));

    expect(api.bodies()[2]!['messages']).toEqual([...history({}), assistant(), user('Again')]);
    expect(given).toEqual(history({ cache_control: EPHEMERAL }));
  });

  test('a replay keeps the cache markers outside the messages', async () => {
    const fields = {
      system: [{ type: 'text' as const, text: 'Be brief.', cache_control: EPHEMERAL }],
      tools: [{ ...NOOP_TOOL, cache_control: EPHEMERAL }],
      cache_control: EPHEMERAL,
    };
    api.queue(message('msg_a'), THREAD_NOT_FOUND, message('msg_c'));
    const thread = makeThread(api, fields);
    await thread.send(user('Hello'));

    await thread.send(user('Again'));

    expect(api.bodies()[2]).toMatchObject({ thread: CREATE, ...fields });
  });

  test.each(['send', 'stream'] as const)(
    'a reply to %s() that a fallback model wrote starts a new thread and changes no field',
    async (method) => {
      const respond = method === 'stream' ? streamed : message;
      const fields = { model: MODEL, max_tokens: MAX_TOKENS, fallbacks: FALLBACKS };
      const createOnly = { system: 'Be brief.', tools: [NOOP_TOOL] };
      api.queue(
        respond('msg_a', 'Hi!', { fallback: true }),
        message('msg_b', 'Hi!', { fallback: true }),
        message('msg_c'),
        message('msg_d'),
      );
      const thread = makeThread(api, { ...fields, ...createOnly, betas: [FALLBACK_BETA] });

      await (method === 'stream' ? thread.stream(user('Hello')).done() : thread.send(user('Hello')));
      const afterReply = [thread.params, thread.previousMessageId];
      await thread.send(user('Again'));
      await thread.send(user('Once more'));
      await thread.send(user('Last'));

      const history = [
        user('Hello'),
        afterFallback(assistant()),
        user('Again'),
        afterFallback(assistant()),
        user('Once more'),
      ];
      expect(api.bodies().map(({ stream, ...body }) => body)).toEqual([
        { ...fields, ...createOnly, thread: CREATE, messages: history.slice(0, 1) },
        { ...fields, ...createOnly, thread: CREATE, messages: history.slice(0, 3) },
        { ...fields, ...createOnly, thread: CREATE, messages: history },
        { ...fields, thread: continueFrom('msg_c'), messages: [user('Last')] },
      ]);
      expect(api.betas()).toEqual(Array(4).fill([FALLBACK_BETA, THREADS_BETA]));
      expect(afterReply).toEqual([
        {
          ...fields,
          ...createOnly,
          betas: [FALLBACK_BETA],
          messages: history.slice(0, 2),
          unsupportedRequestBehavior: 'error',
        },
        null,
      ]);
    },
  );

  test('a refusal that a fallback model wrote counts as a refusal', async () => {
    api.queue(message('msg_a', 'No.', { fallback: true, stopReason: 'refusal' }), message('msg_b'));
    const thread = makeThread(api, { fallbacks: FALLBACKS, betas: [FALLBACK_BETA] });

    await thread.send(user('Refuse this'));
    await thread.send(user('Never mind'));

    expect(api.bodies()[1]).toMatchObject({
      thread: CREATE,
      model: MODEL,
      fallbacks: FALLBACKS,
      messages: [user('Never mind')],
    });
  });

  test('a thread that has stopped threading stays that way after a reply that a fallback model wrote', async () => {
    api.queue(unsupported('fallbacks'), message('msg_b', 'Hi!', { fallback: true }), message('msg_c'));
    const thread = makeThread(api, {
      fallbacks: FALLBACKS,
      betas: [FALLBACK_BETA],
      unsupportedRequestBehavior: 'continue_unthreaded',
    });

    await thread.send(user('Hello'));
    await thread.send(user('Again'));

    expect(api.threads()).toEqual([CREATE, null, null]);
    expect(api.bodies()[2]).toMatchObject({
      model: MODEL,
      fallbacks: FALLBACKS,
      messages: [user('Hello'), afterFallback(assistant()), user('Again')],
    });
  });

  test.each([
    ['no container', {}, 'container_a'],
    [
      'container skills without an id',
      { container: { skills: [XLSX_SKILL] } },
      { skills: [XLSX_SKILL], id: 'container_a' },
    ],
    ['a caller container id', { container: 'container_mine' }, 'container_mine'],
  ])('later turns run in the container of the last reply: %s', async (_name, fields, expected) => {
    api.queue(message('msg_a', 'Hi!', { container: 'container_a' }), message('msg_b'));
    const thread = makeThread(api, fields);

    await thread.send(user('Hello'));
    await thread.send(user('Again'));

    expect(api.bodies()[1]!['container']).toEqual(expected);
  });

  test('update changes the fields of later turns without a request', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    thread.update({ max_tokens: 77, stop_sequences: ['END'] });
    const requestsAfterUpdate = api.requests.length;
    await thread.send(user('Again'));

    const body = api.bodies()[1]!;
    expect(requestsAfterUpdate).toBe(1);
    expect([body['max_tokens'], body['stop_sequences']]).toEqual([77, ['END']]);
    expect([body['thread'], body['messages']]).toEqual([continueFrom('msg_a'), [user('Again')]]);
  });

  test('send overrides take precedence over update', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api);
    thread.update({ max_tokens: 77 });

    await thread.send(user('Hello'), { max_tokens: 12 });
    await thread.send(user('Again'));

    expect(api.bodies().map((body) => body['max_tokens'])).toEqual([12, 77]);
  });

  test('later headers replace the thread headers whole: a turn for itself, update from then on', async () => {
    api.queue(message('msg_a'), message('msg_b'), message('msg_c'));
    const thread = makeThread(api, {}, { headers: { 'X-Thread': 'thread' } });

    await thread.send(user('Hello'), {}, { headers: { 'X-Turn': 'turn' } });
    await thread.send(user('Again'));
    thread.update({}, { headers: { 'X-Update': 'update' } });
    await thread.send(user('Once more'));

    expect(
      api.requests.map(({ headers }) => [
        headers.get('x-thread'),
        headers.get('x-turn'),
        headers.get('x-update'),
      ]),
    ).toEqual([
      [null, 'turn', null],
      ['thread', null, null],
      [null, null, 'update'],
    ]);
  });

  test('a request option that is not given, or is undefined, keeps the thread value', async () => {
    api.queue(message('msg_a'), message('msg_b'), message('msg_c'));
    const thread = makeThread(api, {}, { headers: { 'X-Thread': 'thread' }, timeout: 5000 });

    await thread.send(user('Hello'), {}, { timeout: 9000, headers: undefined });
    await thread.send(user('Again'));
    thread.update({}, { headers: { 'X-Thread': 'update' } });
    await thread.send(user('Once more'));

    expect(
      api.requests.map(({ headers }) => [headers.get('x-thread'), headers.get('x-stainless-timeout')]),
    ).toEqual([
      ['thread', '9'],
      ['thread', '5'],
      ['update', '5'],
    ]);
  });

  test('a changed pinned field is sent on continue for the server to reject', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api, { tool_choice: { type: 'auto' } });
    await thread.send(user('Hello'));

    await thread.send(user('Again'), { tool_choice: { type: 'none' } });

    const body = api.bodies()[1]!;
    expect([body['thread'], body['tool_choice']]).toEqual([continueFrom('msg_a'), { type: 'none' }]);
  });

  test.each([
    ['system', { system: 'Be very brief.' }, false],
    ['tools', { tools: [NOOP_TOOL] }, true],
  ])(
    'a changed %s is refused before anything is sent, and a thread from `params` takes it',
    async (name, change, pointsAtToolChanges) => {
      api.queue(message('msg_a'), message('msg_b'));
      const thread = makeThread(api, { system: 'Be brief.' });
      await thread.send(user('Hello'));

      thread.update(change);
      const refused = await thread.send(user('Again')).catch((error: unknown) => error);
      const requestsWhenRefused = api.requests.length;
      await api.client.beta.messages.thread(thread.params).send(user('Again'));

      expect(refused).toBeInstanceOf(AnthropicError);
      expect((refused as AnthropicError).message).toContain(`Cannot change \`${name}\` on a thread`);
      expect((refused as AnthropicError).message.includes('`tool_addition` or `tool_removal` blocks')).toBe(
        pointsAtToolChanges,
      );
      expect((refused as AnthropicError).message.endsWith('blocks in a `system` message.')).toBe(
        pointsAtToolChanges,
      );
      expect(requestsWhenRefused).toBe(1);
      expect(api.bodies()[1]).toMatchObject({ ...change, thread: CREATE });
      expect(api.bodies()[1]!['messages']).toEqual([user('Hello'), assistant(), user('Again')]);
    },
  );

  test('a `system` message that removes a tool goes out on the continue as given', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api, { tools: [weatherTool], betas: [INLINE_TOOLS_BETA] });
    await thread.send(user('Hello'));

    thread.append(WEATHER_TOOL_REMOVED);
    await thread.send(user('Again'));

    const continued = api.bodies()[1]!;
    expect([continued['thread'], continued['messages']]).toEqual([
      continueFrom('msg_a'),
      [WEATHER_TOOL_REMOVED, user('Again')],
    ]);
    expect(continued).not.toHaveProperty('tools');
  });

  test("a system given to the turn that creates the thread is the thread's from then on", async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api, { system: 'Be brief.' });

    await thread.send(user('Hello'), { system: 'Be verbose.' });
    await thread.send(user('Again'));

    expect(api.bodies().map((body) => [body['thread'], body['system']])).toEqual([
      [CREATE, 'Be verbose.'],
      [continueFrom('msg_a'), undefined],
    ]);
    expect(thread.params.system).toBe('Be verbose.');
  });

  const CUT_SHORT = truncatedText('msg_a', 'one two three', { deltas: 1 });

  test.each([
    ['send', 'is rejected', serverError(), [user('Hello')], [user('Hello')]],
    ['parse', 'is rejected', serverError(), [user('Hello')], [user('Hello')]],
    ['stream', 'is rejected', serverError(), [user('Hello')], [user('Hello')]],
    ['stream', 'ends before message_stop and is sent again', CUT_SHORT, [], [user('Hello')]],
    [
      'stream',
      'ends before message_stop and is followed up',
      CUT_SHORT,
      [user('Go on')],
      [user('Hello'), assistant('one'), user('Go on')],
    ],
  ] as const)(
    "a system and tools given to a first %s() that %s are not the thread's",
    async (call, _failure, responder, next, sentNext) => {
      api.queue(responder, message('msg_b'));
      const thread = makeThread(api, { system: 'Be brief.' });
      const overrides = { system: 'Be verbose.', tools: [NOOP_TOOL] };

      await (call === 'stream' ?
        thread.stream(user('Hello'), overrides).done()
      : thread[call](user('Hello'), overrides)
      ).catch(() => {});
      const afterFailure = thread.params;
      await thread.send(next);

      expect(
        api.bodies().map((body) => [body['thread'], body['messages'], body['system'], body['tools']]),
      ).toEqual([
        [CREATE, [user('Hello')], 'Be verbose.', [NOOP_TOOL]],
        [CREATE, sentNext, 'Be brief.', undefined],
      ]);
      expect([afterFailure.system, afterFailure.tools]).toEqual(['Be brief.', undefined]);
    },
  );

  test('a system given to a turn that goes out without a thread is for that turn only', async () => {
    api.queue(unsupported('inference_hooks'), message('msg_b'), message('msg_c'));
    const thread = makeThread(api, {
      system: 'Be brief.',
      unsupportedRequestBehavior: 'continue_unthreaded',
    });

    await thread.send(user('Hello'), { system: 'Be verbose.' });
    await thread.send(user('Again'));

    expect(api.bodies().map((body) => [body['thread'], body['system']])).toEqual([
      [CREATE, 'Be verbose.'],
      [undefined, 'Be verbose.'],
      [undefined, 'Be brief.'],
    ]);
  });

  test('a system given to the turn that creates the thread gives way to an update() during that turn', async () => {
    api.queue(streamed('msg_a'));
    const thread = makeThread(api);

    const stream = thread.stream(user('Hello'), { system: 'Be verbose.' });
    thread.update({ system: 'Be brief.' });
    await stream.done();

    expect(api.bodies()[0]!['system']).toBe('Be verbose.');
    expect(thread.params.system).toBe('Be brief.');
  });

  test('an equal copy of system and tools continues the thread', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api, { system: [{ type: 'text', text: 'Be brief.' }], tools: [NOOP_TOOL] });
    await thread.send(user('Hello'));

    thread.update({ system: [{ type: 'text', text: 'Be brief.' }], tools: [{ ...NOOP_TOOL }] });
    await thread.send(user('Again'));

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a')]);
  });

  test.each([
    ['create', CREATE],
    ['continue', continueFrom('msg_x')],
    ['null', null],
  ])(
    "a `thread` value of the caller's (%s) throws, and nothing is staged, changed or sent",
    async (_name, value) => {
      api.queue(message('msg_a'), message('msg_b'));
      const refusal = '`thread` cannot be set here. The message thread sets it for each request itself.';
      // The param types leave `thread` out, so only an untyped caller or a cast gets it this far.
      const forced = { max_tokens: 7, thread: value } as { max_tokens: number };
      const thread = makeThread(api);
      await thread.send(user('Hello'));

      const attempts = [
        () => makeThread(api, forced),
        () => api.client.beta.messages.thread({ ...thread.params, ...forced }),
        () => thread.send(user('Refused'), forced),
        () => thread.parse(user('Refused'), forced),
        () => thread.stream(user('Refused'), forced),
        () => thread.update(forced),
      ];
      for (const attempt of attempts) {
        expect(attempt).toThrow(new TypeError(refusal));
      }
      await thread.send(user('Again'), { thread: undefined } as {});

      expect(api.requests).toHaveLength(2);
      expect(api.bodies()[1]).toMatchObject({
        thread: continueFrom('msg_a'),
        messages: [user('Again')],
        max_tokens: MAX_TOKENS,
      });
    },
  );

  test("a `thread` value of the caller's throws on a thread that has stopped threading", async () => {
    api.queue(unsupported('inference_hooks'), message('msg_b'));
    const thread = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });
    await thread.send(user('Hello'));

    expect(() => thread.send(user('Again'), { thread: CREATE } as {})).toThrow(TypeError);

    expect(api.requests).toHaveLength(2);
    expect(thread.messages).toEqual([user('Hello'), assistant()]);
  });

  test('params is the whole conversation as thread params', async () => {
    api.queue(message('msg_a'));
    const thread = makeThread(api, { system: 'Be brief.', betas: ['context-management-2025-06-27'] });
    await thread.send(user('Hello'));
    thread.update({ max_tokens: 2048 });
    thread.append(user('Again'));

    const params = thread.params;

    expect([params.model, params.max_tokens, params.system, params.betas]).toEqual([
      MODEL,
      2048,
      'Be brief.',
      ['context-management-2025-06-27'],
    ]);
    expect(roles(params.messages)).toEqual(['user', 'assistant', 'user']);
    expect(params).not.toHaveProperty('thread');
    expect(thread.params).not.toBe(params);
    expect(thread.params.messages).not.toBe(params.messages);
  });

  test('a thread built from params replays the conversation', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api, { system: 'Be brief.' });
    await thread.send(user('Hello'));

    const rewound = api.client.beta.messages.thread({
      ...thread.params,
      messages: thread.params.messages.slice(0, 1),
    });
    await rewound.send();

    const body = api.bodies()[1]!;
    expect([body['thread'], body['system'], body['messages']]).toEqual([
      CREATE,
      'Be brief.',
      [user('Hello')],
    ]);
  });

  test.each([
    {
      given: { unsupportedRequestBehavior: 'continue_unthreaded' },
      kept: 'continue_unthreaded',
      threads: [CREATE, CREATE, null],
    },
    { given: {}, kept: 'error', threads: [CREATE, CREATE] },
  ] as const)(
    'a thread built from params keeps unsupportedRequestBehavior: $kept',
    async ({ given, kept, threads }) => {
      api.queue(message('msg_a'), unsupported('fallbacks'), message('msg_c'));
      const thread = makeThread(api, given);
      await thread.send(user('Hello'));

      const rebuilt = api.client.beta.messages.thread(thread.params);
      const turn = rebuilt.send(user('Again'));
      await (kept === 'error' ? expect(turn).rejects.toThrow(BadRequestError) : turn);

      expect([thread.params.unsupportedRequestBehavior, rebuilt.params.unsupportedRequestBehavior]).toEqual([
        kept,
        kept,
      ]);
      expect(api.threads()).toEqual(threads);
      for (const { body, headers } of api.requests) {
        expect(JSON.stringify([body, [...headers]])).not.toMatch(
          /unsupportedRequestBehavior|continue_unthreaded/,
        );
      }
    },
  );

  test('fork returns a thread with no previousMessageId without a request', async () => {
    api.queue(message('msg_a'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    const fork = thread.fork();

    expect(fork).toBeInstanceOf(BetaMessageThread);
    expect(fork.previousMessageId).toBeNull();
    expect(fork.messages).toEqual(thread.messages);
    expect(api.requests).toHaveLength(1);
  });

  test('fork creates a thread with the full history and the same fields', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(
      api,
      { max_tokens: 1024, system: 'You are terse.' },
      { headers: { 'X-Trace': 'abc' } },
    );
    await thread.send(user('Hello'));

    await thread.fork().send(user('Fork'));

    const body = api.bodies()[1]!;
    expect([body['thread'], body['messages']]).toEqual([CREATE, [user('Hello'), assistant(), user('Fork')]]);
    expect([body['system'], body['max_tokens']]).toEqual(['You are terse.', 1024]);
    expect(api.requests[1]!.headers.get('x-trace')).toBe('abc');
    expect(api.betas()[1]).toEqual([THREADS_BETA]);
  });

  test('fork and original continue independently', async () => {
    api.queue(message('msg_a'), message('msg_b'), message('msg_c'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));
    const fork = thread.fork();

    await fork.send(user('Fork'));
    await thread.send(user('Original'));

    const body = api.bodies()[2]!;
    expect([body['thread'], body['messages']]).toEqual([continueFrom('msg_a'), [user('Original')]]);
    expect([thread.previousMessageId, fork.previousMessageId]).toEqual(['msg_c', 'msg_b']);
    expect([thread.messages[2], fork.messages[2]]).toEqual([user('Original'), user('Fork')]);
  });

  test('fork keeps the unsupported request behavior', async () => {
    api.queue(unsupported('inference_hooks'), message('msg_b'));
    const thread = makeThread(api, { unsupportedRequestBehavior: 'continue_unthreaded' });

    const fork = thread.fork();
    await fork.send(user('Hello'));

    expect(api.threads()).toEqual([CREATE, null]);
    expect(fork.previousMessageId).toBeNull();
  });

  test.each([
    ['output_format', { output_format: FORECAST_FORMAT }],
    ['output_config.format', { output_config: { format: FORECAST_FORMAT } }],
  ])('%s adds no beta beyond the threads beta', async (_name, fields) => {
    api.queue(message('msg_a'));
    const thread = makeThread(api, fields);

    await thread.send(user('Hello'));

    expect(api.betas()).toEqual([[THREADS_BETA]]);
    expect(api.bodies()[0]!['output_config']).toEqual({
      format: { type: 'json_schema', schema: FORECAST_FORMAT.schema },
    });
  });

  test('thread() rejects both output_format and output_config.format', () => {
    expect(() =>
      makeThread(api, { output_format: FORECAST_FORMAT, output_config: { format: FORECAST_FORMAT } }),
    ).toThrow('output_config.format');
  });

  test('parse continues the thread and parses each reply', async () => {
    api.queue(
      message('msg_a', JSON.stringify({ forecast: 'Sunny' })),
      message('msg_b', JSON.stringify({ forecast: 'Rain' })),
    );
    const thread = makeThread(api, { output_format: FORECAST_FORMAT });

    const first = await thread.parse(user('Today?'));
    const second = await thread.parse(user('Tomorrow?'), { max_tokens: 12 });

    const [created, continued] = api.bodies();
    expect([first.parsed_output, second.parsed_output]).toEqual([
      { forecast: 'Sunny' },
      { forecast: 'Rain' },
    ]);
    expect(created!['thread']).toEqual(CREATE);
    expect([continued!['thread'], continued!['messages'], continued!['max_tokens']]).toEqual([
      continueFrom('msg_a'),
      [user('Tomorrow?')],
      12,
    ]);
    expect(thread.previousMessageId).toBe(second.id);
  });

  test('the structured output format is given when the thread is created, and only then', async () => {
    api.queue(message('msg_a', JSON.stringify({ forecast: 'Sunny' })));
    const output_config = { format: FORECAST_FORMAT };
    const thread = api.client.beta.messages.thread({ model: MODEL, max_tokens: MAX_TOKENS, output_config });

    const later = [
      // @ts-expect-error `output_config` is fixed when the thread is created
      () => thread.send(user('Tomorrow?'), { output_config }),
      // @ts-expect-error `output_config` is fixed when the thread is created
      () => thread.parse(user('Tomorrow?'), { output_config }),
      // @ts-expect-error `output_config` is fixed when the thread is created
      () => thread.stream(user('Tomorrow?'), { output_config }),
      // @ts-expect-error `output_config` is fixed when the thread is created
      () => thread.update({ output_config }),
      // @ts-expect-error `output_format` is fixed when the thread is created
      () => thread.update({ output_format: FORECAST_FORMAT }),
    ];
    const { parsed_output } = await thread.parse(user('Today?'));

    // The @ts-expect-error lines are the checks. This line only uses the closures.
    expect(later).toHaveLength(5);
    expect(parsed_output?.forecast).toBe('Sunny');
    // @ts-expect-error `parsed_output` has the type of the format the thread was created with
    expect(parsed_output?.temperature).toBeUndefined();
  });

  test.each([
    ['output_format', { output_format: FORECAST_FORMAT }, {}],
    [
      'output_config',
      { output_config: { format: FORECAST_FORMAT, effort: 'low' as const } },
      { effort: 'low' },
    ],
  ])(
    'every turn sends the %s of the thread, and so does a thread built from params',
    async (_name, fields, rest) => {
      api.queue(message('msg_a'), message('msg_b'), message('msg_c', JSON.stringify({ forecast: 'Rain' })));
      const thread = makeThread(api, fields);
      await thread.send(user('Today?'));
      await thread.send(user('Tomorrow?'));

      const rebuilt = api.client.beta.messages.thread(thread.params);
      const reply = await rebuilt.parse(user('And after?'));

      const format = { type: 'json_schema', schema: FORECAST_FORMAT.schema };
      expect(api.threads()).toEqual([CREATE, continueFrom('msg_a'), CREATE]);
      for (const body of api.bodies()) {
        expect(body['output_config']).toEqual({ ...rest, format });
        expect(body).not.toHaveProperty('output_format');
      }
      expect(reply.parsed_output).toEqual({ forecast: 'Rain' });
    },
  );

  test('an output_config forced into a later turn is sent for the server to reject', async () => {
    api.queue(message('msg_a'), FINGERPRINT_MISMATCH);
    const thread = makeThread(api, { output_config: { format: FORECAST_FORMAT } });
    await thread.send(user('Today?'));

    const forced = { output_config: { effort: 'low' } } as {};
    await expect(thread.send(user('Tomorrow?'), forced)).rejects.toThrow(BadRequestError);

    const body = api.bodies()[1]!;
    expect([body['thread'], body['output_config']]).toEqual([continueFrom('msg_a'), { effort: 'low' }]);
  });

  test('parse without output_format returns no parsed output', async () => {
    api.queue(message('msg_a', 'Just text'));
    const thread = makeThread(api);

    const reply = await thread.parse(user('Hello'));

    expect(reply.parsed_output).toBeNull();
    expect(thread.previousMessageId).toBe('msg_a');
  });

  test('send while streaming throws and stages nothing', async () => {
    api.queue(streamed('msg_a'), message('msg_b'));
    const thread = makeThread(api);

    const stream = thread.stream(user('Hello'));
    expect(() => thread.send(user('Interrupting'))).toThrow('already in progress');
    await stream.finalMessage();
    await thread.send(user('Now'));

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a')]);
    expect(api.bodies()[1]!['messages']).toEqual([user('Now')]);
    expect(thread.previousMessageId).toBe('msg_b');
  });

  test('messages appended during a turn are staged once it finishes', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api);

    const first = thread.send(user('Hello'));
    thread.append(user('While you were out'));
    const messagesDuringTheTurn = thread.messages;
    await first;
    await thread.send();

    expect(messagesDuringTheTurn).toEqual([user('Hello'), user('While you were out')]);
    expect(api.bodies()[1]!['messages']).toEqual([user('While you were out')]);
    expect(roles(thread.messages)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  test('send records the reply even if the caller never awaits it', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api);

    void thread.send(user('Hello'));
    while (thread.previousMessageId === null) await new Promise((resolve) => setImmediate(resolve));
    await thread.send(user('Again'));

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a')]);
    expect(roles(thread.messages)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  test('failed send lets the next send run', async () => {
    api.queue(serverError(), message('msg_b'));
    const thread = makeThread(api);
    await expect(thread.send(user('Hello'))).rejects.toThrow(InternalServerError);

    const reply = await thread.send(user('Hello'));

    expect(reply.id).toBe('msg_b');
    expect([api.threads()[1], api.bodies()[1]!['messages']]).toEqual([CREATE, [user('Hello')]]);
  });

  test('stream records the reply once it reaches message_stop', async () => {
    api.queue(streamed('msg_a'));
    const thread = makeThread(api);

    const stream = thread.stream(user('Hello'));
    const final = await stream.finalMessage();

    expect([api.bodies()[0]!['stream'], api.bodies()[0]!['thread']]).toEqual([true, CREATE]);
    expect(final.id).toBe('msg_a');
    expect(thread.previousMessageId).toBe('msg_a');
    expect(roles(thread.messages)).toEqual(['user', 'assistant']);
  });

  test('stream whose structured output fails to parse still records the reply', async () => {
    api.queue(streamed('msg_a', 'not json'), message('msg_b'));
    const thread = makeThread(api, { output_format: FORECAST_FORMAT });

    await expect(thread.stream(user('Forecast?')).finalMessage()).rejects.toThrow('Failed to parse');
    await thread.send(user('Again'));

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a')]);
    expect(roles(thread.messages)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  test('send from a message listener starts the next turn', async () => {
    api.queue(streamed('msg_a', 'one two'), message('msg_b'));
    const thread = makeThread(api);

    const stream = thread.stream(user('Count'));
    const next = new Promise<BetaMessage>((resolve, reject) =>
      stream.on('message', () => thread.send(user('Thanks')).then(resolve, reject)),
    );
    await stream.done();

    expect((await next).id).toBe('msg_b');
    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a')]);
  });

  test('send from a finalMessage listener starts the next turn', async () => {
    api.queue(streamed('msg_a'), message('msg_b'));
    const thread = makeThread(api);

    const stream = thread.stream(user('Hello'));
    const next = new Promise<BetaMessage>((resolve, reject) =>
      stream.on('finalMessage', () => thread.send(user('Again')).then(resolve, reject)),
    );
    const second = await next;

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a')]);
    expect(second.id).toBe('msg_b');
  });

  test('stream that finds the thread gone replays inside the same stream', async () => {
    api.queue(message('msg_a'), THREAD_NOT_FOUND, streamed('msg_c', 'one two'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    const texts: string[] = [];
    const final = await thread
      .stream(user('Count'))
      .on('text', (text) => texts.push(text))
      .finalMessage();

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a'), CREATE]);
    expect(texts.join('')).toBe('one two');
    expect(final.id).toBe('msg_c');
    expect(thread.previousMessageId).toBe('msg_c');
  });

  test.each(['abort', 'break'])(
    'a stream that ends early (%s) records the partial reply and starts a new thread',
    async (how) => {
      api.queue(message('msg_a'), stalledText('msg_b', 'one two three', { deltas: 1 }), message('msg_c'));
      const thread = makeThread(api);
      await thread.send(user('Hello'));

      const stream = thread.stream(user('Count'));
      if (how === 'abort') {
        stream.once('text', () => stream.abort());
      } else {
        for await (const event of stream) {
          if (event.type === 'content_block_delta') break;
        }
      }
      await expect(stream.done()).rejects.toThrow(APIUserAbortError);
      const previousMessageIdAfterStream = thread.previousMessageId;
      const historyAfterStream = thread.messages;
      await thread.send(user('Just the total'));

      const later = api.bodies()[2]!;
      expect(previousMessageIdAfterStream).toBeNull();
      expect(historyAfterStream).toEqual([user('Hello'), assistant('Hi!'), user('Count'), assistant('one')]);
      expect(api.logger.info.mock.calls.flat().join(' ')).toContain('stream_ended_before_message_stop');
      expect([later['thread'], roles(later['messages'])]).toEqual([
        CREATE,
        ['user', 'assistant', 'user', 'assistant', 'user'],
      ]);
      expect(later['messages'][3]).toEqual(assistant('one'));
      expect(thread.previousMessageId).toBe('msg_c');
    },
  );

  test.each(['abort', 'break'])(
    'a stream that ends early (%s) leaves the thread free for the next turn at once',
    async (how) => {
      api.queue(stalledText('msg_a', 'one two three', { deltas: 1 }), message('msg_b'));
      const thread = makeThread(api);

      const stream = thread.stream(user('Count'));
      if (how === 'abort') {
        void stream.done().catch(() => {});
        await new Promise<void>((resolve) => stream.once('text', () => resolve()));
        stream.abort();
      } else {
        for await (const event of stream) {
          if (event.type === 'content_block_delta') break;
        }
      }
      await thread.send(user('Just the total'));

      const later = api.bodies()[1]!;
      expect([later['thread'], later['messages']]).toEqual([
        CREATE,
        [user('Count'), assistant('one'), user('Just the total')],
      ]);
      expect(thread.previousMessageId).toBe('msg_b');
    },
  );

  test('events that arrive after the caller left a stream do not touch the next turn', async () => {
    api.queue(streamed('msg_a'), neverResponds().responder);
    const thread = makeThread(api);

    const stream = thread.stream(user('Hello'));
    for await (const _ of stream) break;
    void thread.send(user('Never mind'));
    await stream.done().catch(() => {});

    expect(() => thread.send(user('Interrupting'))).toThrow('already in progress');
    expect(thread.previousMessageId).toBeNull();
  });

  const COPIES: Array<[string, (thread: BetaMessageThread<any>) => BetaMessageThread<any>]> = [
    ['on the thread', (thread) => thread],
    ['on a fork', (thread) => thread.fork()],
    ['on a fork of a fork', (thread) => thread.fork().fork()],
  ];

  test.each(COPIES)(
    'a stream whose body ends before message_stop records the partial reply, and a message sent %s follows it on a new thread',
    async (_name, copy) => {
      api.queue(message('msg_a'), truncatedText('msg_b', 'one two three', { deltas: 1 }), message('msg_c'));
      const thread = makeThread(api);
      await thread.send(user('Hello'));

      await thread
        .stream(user('Count'))
        .done()
        .catch(() => {});
      const afterStream = [thread.messages, thread.previousMessageId];
      await copy(thread).send(user('Just the total'));

      const later = api.bodies()[2]!;
      expect(afterStream).toEqual([[user('Hello'), assistant('Hi!'), user('Count'), assistant('one')], null]);
      expect([later['thread'], later['messages']]).toEqual([
        CREATE,
        [user('Hello'), assistant('Hi!'), user('Count'), assistant('one'), user('Just the total')],
      ]);
    },
  );

  test('a partial reply keeps finished blocks and drops an unfinished tool call', async () => {
    api.queue(message('msg_a'), stalledToolUse('msg_b', 'Let me check.', { toolUseId: 'toolu_b' }));
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    const stream = thread.stream(user("What's the weather in SF?"));
    stream.on('inputJson', () => stream.abort());
    await expect(stream.done()).rejects.toThrow(APIUserAbortError);

    expect(thread.messages.at(-1)).toEqual(assistant('Let me check.'));
    expect(thread.previousMessageId).toBeNull();
  });

  test('a stream that ends before any content stores the turn and send() repeats it', async () => {
    api.queue(message('msg_a'), stalledText('msg_b', 'one two', { deltas: 0 }), message('msg_c'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    const stream = thread.stream(user('Count'));
    for await (const event of stream) {
      expect(event.type).toBe('message_start');
      break;
    }
    await stream.done().catch(() => {});
    const afterStream = [roles(thread.messages), thread.previousMessageId];
    await thread.send();

    const retried = api.bodies()[2]!;
    expect(afterStream).toEqual([['user', 'assistant', 'user'], null]);
    expect([retried['thread'], retried['messages']]).toEqual([
      CREATE,
      [user('Hello'), assistant('Hi!'), user('Count')],
    ]);
  });

  test.each(
    COPIES.flatMap(([name, copy]) =>
      (['send', 'stream'] as const).map((method) => [method, name, copy] as const),
    ),
  )(
    '%s() with no messages after a partial reply sends the turn again without it %s',
    async (method, _name, copy) => {
      api.queue(
        message('msg_a'),
        stalledText('msg_b', 'one two three', { deltas: 1 }),
        method === 'stream' ? streamed('msg_c') : message('msg_c'),
      );
      const original = makeThread(api);
      await original.send(user('Hello'));
      const stream = original.stream(user('Count'));
      stream.once('text', () => stream.abort());
      await stream.done().catch(() => {});
      const thread = copy(original);

      const reply = await (method === 'stream' ? thread.stream().finalMessage() : thread.send());

      const retried = api.bodies()[2]!;
      expect([retried['thread'], retried['messages']]).toEqual([
        CREATE,
        [user('Hello'), assistant('Hi!'), user('Count')],
      ]);
      expect(roles(thread.messages)).toEqual(['user', 'assistant', 'user', 'assistant']);
      expect(thread.previousMessageId).toBe(reply.id);
    },
  );

  test('a send rejected after a partial reply leaves send() with no messages to send the turn again', async () => {
    api.queue(
      message('msg_a'),
      truncatedText('msg_b', 'one two three', { deltas: 1 }),
      apiError(400, 'invalid_request_error', 'messages.4: too long'),
      message('msg_d'),
    );
    const thread = makeThread(api);
    await thread.send(user('Hello'));
    await thread
      .stream(user('Count'))
      .done()
      .catch(() => {});
    const afterStream = thread.messages;

    await expect(thread.send(user('Just the total'))).rejects.toThrow(BadRequestError);
    const afterRejection = thread.messages;
    await thread.send();

    const retried = api.bodies()[3]!;
    expect(afterStream).toEqual([user('Hello'), assistant('Hi!'), user('Count'), assistant('one')]);
    expect(afterRejection).toEqual(afterStream);
    expect([retried['thread'], retried['messages']]).toEqual([
      CREATE,
      [user('Hello'), assistant('Hi!'), user('Count')],
    ]);
  });

  test.each([
    ['tool_use', { toolUseId: 'toolu_b' }],
    ['pause_turn', { stopReason: 'pause_turn' }],
    ['compaction', { stopReason: 'compaction' }],
  ] as const)('a stream that ends after message_delta (%s) is still a partial turn', async (_name, reply) => {
    api.queue(message('msg_a'), stalledBeforeStop('msg_b', 'Searching', reply), message('msg_c'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));
    const stream = thread.stream(user('Weather?'));
    stream.on('streamEvent', (event) => event.type === 'message_delta' && stream.abort());
    await stream.done().catch(() => {});
    const afterStream = [roles(thread.messages), thread.previousMessageId];

    await thread.send();

    const retried = api.bodies()[2]!;
    expect(afterStream).toEqual([['user', 'assistant', 'user', 'assistant'], null]);
    expect([retried['thread'], retried['messages']]).toEqual([
      CREATE,
      [user('Hello'), assistant('Hi!'), user('Weather?')],
    ]);
    expect(thread.previousMessageId).toBe('msg_c');
  });

  test('resume stream that ends mid-text keeps the paused reply resumable', async () => {
    api.queue(
      message('msg_a', 'Searching', { stopReason: 'pause_turn' }),
      stalledText('msg_b', 'found it', { deltas: 1 }),
      message('msg_c'),
    );
    const thread = makeThread(api);
    await thread.send(user('Hello'));
    const stream = thread.stream();
    stream.once('text', () => stream.abort());
    await stream.done().catch(() => {});

    await thread.send();

    const retried = api.bodies()[2]!;
    expect([retried['thread'], retried['messages']]).toEqual([
      CREATE,
      [user('Hello'), assistant('Searching')],
    ]);
    expect(thread.previousMessageId).toBe('msg_c');
  });

  test.each(['the response', 'message_start'])(
    'a stream aborted before %s arrives takes its message back',
    async (missing) => {
      const inFlight = neverResponds();
      api.queue(
        message('msg_a'),
        missing === 'the response' ? inFlight.responder : stalledBeforeStart('msg_b'),
        message('msg_c'),
      );
      const thread = makeThread(api);
      await thread.send(user('Hello'));

      const stream = thread.stream(user('Count'));
      await (missing === 'the response' ? inFlight.requested : stream.withResponse());
      stream.abort();
      await expect(stream.done()).rejects.toThrow(APIUserAbortError);
      const previousMessageIdAfterAbort = thread.previousMessageId;
      await thread.send(user('Never mind'));

      expect(previousMessageIdAfterAbort).toBe('msg_a');
      expect(api.bodies().at(-1)!['thread']).toEqual(continueFrom('msg_a'));
      expect(api.bodies().at(-1)!['messages']).toEqual([user('Never mind')]);
      expect(thread.previousMessageId).toBe('msg_c');
    },
  );

  test('thread-level signal aborts a stream, which takes its message back', async () => {
    const inFlight = neverResponds();
    api.queue(message('msg_a'), inFlight.responder);
    const controller = new AbortController();
    const thread = makeThread(api, {}, { signal: controller.signal });
    await thread.send(user('Hello'));

    const stream = thread.stream(user('Count'));
    await inFlight.requested;
    controller.abort();
    await expect(stream.done()).rejects.toThrow();

    expect(thread.previousMessageId).toBe('msg_a');
    expect(thread.messages).toEqual([user('Hello'), assistant()]);
  });

  test('stream error takes the message back', async () => {
    api.queue(message('msg_a'), serverError());
    const thread = makeThread(api);
    await thread.send(user('Hello'));

    await expect(thread.stream(user('Count')).finalMessage()).rejects.toThrow(InternalServerError);

    expect(thread.previousMessageId).toBe('msg_a');
    expect(thread.messages).toEqual([user('Hello'), assistant()]);
  });
});

describe('OpenTelemetry spans of BetaMessageThread.send()', () => {
  setUpTracing();

  const contentOf = (name: string) =>
    spans('anthropic.messages.create').map((span) => JSON.parse(String(span.attributes[name] ?? null)));

  test('a turn that is sent again has a span for each request, and the reply on the last', async () => {
    const { client } = makeClient([() => unsupported('example')(), json(MESSAGE)], {
      openTelemetry: { traces: { contentMode: 'content' } },
    });
    const thread = client.beta.messages.thread({
      ...PARAMS,
      unsupportedRequestBehavior: 'continue_unthreaded',
    });

    await thread.send();

    expect(spans('anthropic.messages.create').map((span) => span.attributes['error.type'])).toEqual([
      'invalid_request_error',
      undefined,
    ]);
    expect(contentOf('gen_ai.output.messages')).toEqual([
      null,
      [{ role: 'assistant', parts: [{ type: 'text', content: 'hello' }] }],
    ]);
    expect([...openSpans.values()]).toEqual([]);
  });

  test('content over the size limit still describes the messages a `continue` sent', async () => {
    const { client, requests } = makeClient([json(MESSAGE), json({ ...MESSAGE, id: 'msg_2' })], {
      openTelemetry: { traces: { contentMode: 'content', maxContentBytes: 150 } },
    });
    const thread = client.beta.messages.thread(PARAMS);

    await thread.send();
    await thread.send(user('And then?'));

    expect(requests[1]!.body.thread).toEqual(continueFrom('msg_1'));
    expect(contentOf('gen_ai.input.messages').map(roles)).toEqual([['user'], ['user']]);
    expect(contentOf('gen_ai.output.messages').map(roles)).toEqual([['assistant'], ['assistant']]);
  });

  test('a reply that is not JSON fails its span', async () => {
    const malformed = () => new Response('{oops', { headers: { 'content-type': 'application/json' } });
    const { client } = makeClient([malformed]);

    await expect(client.beta.messages.thread(PARAMS).send()).rejects.toThrow(SyntaxError);

    expect(onlySpan('anthropic.messages.create').status.code).toBe(SpanStatusCode.ERROR);
    expect([...openSpans.values()]).toEqual([]);
  });
});
