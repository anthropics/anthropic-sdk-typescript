import Anthropic, { AnthropicError, BaseAnthropic } from '@anthropic-ai/sdk';
import { BetaMessageThread } from '@anthropic-ai/sdk/lib/threads/BetaMessageThread';
import { BetaToolRunner, type BetaToolRunnerParams } from '@anthropic-ai/sdk/lib/tools/BetaToolRunner';
import { Beta } from '@anthropic-ai/sdk/resources/beta/beta';
import type { BetaMessage, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta';
import {
  CONTEXT_MANAGEMENT_BETA,
  CREATE,
  FORECAST_FORMAT,
  MAX_TOKENS,
  MODEL,
  RESPONSE_KINDS,
  THREADS_BETA,
  THREAD_NOT_FOUND,
  WEATHER_QUESTION,
  assistant,
  continueFrom,
  drain,
  makeRunner,
  makeThread,
  message,
  mockAPI,
  streamed,
  toolResult,
  toolUse,
  unsupported,
  user,
  weatherTool,
  type MockAPI,
} from './helpers';

/** A client for a surface without message threads, built the way the Bedrock and Vertex clients are. */
class ThirdPartyClient extends BaseAnthropic {
  beta: Beta = new Beta(this);
}

/** A client class the SDK does not know. */
class CallerClient extends Anthropic {}

const LOW_EFFORT: BetaMessageParam = {
  role: 'system',
  content: 'Be brief.',
  output_config: { effort: 'low' },
};

describe('client.beta.messages.toolRunner() threading', () => {
  let api: MockAPI;
  beforeEach(() => {
    api = mockAPI();
  });

  test('runner threads by default', async () => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));

    const final = await makeRunner(api).runUntilDone();

    const [created, continued] = api.bodies();
    expect([created!['thread'], created!['messages']]).toEqual([CREATE, [WEATHER_QUESTION]]);
    expect([continued!['thread'], continued!['messages']]).toEqual([
      continueFrom('msg_a'),
      [toolResult('toolu_a')],
    ]);
    expect(continued).not.toHaveProperty('tools');
    expect(api.betas()).toEqual([[THREADS_BETA], [THREADS_BETA]]);
    expect(api.helpers()).toEqual(['BetaToolRunner, message-thread', 'BetaToolRunner, message-thread']);
    expect(final.id).toBe('msg_b');
  });

  test('runner with a caller anthropic-beta header still sends the threads beta', async () => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));

    await makeRunner(api, {}, { headers: { 'anthropic-beta': CONTEXT_MANAGEMENT_BETA } }).runUntilDone();

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a')]);
    expect(api.betas()).toEqual([
      [CONTEXT_MANAGEMENT_BETA, THREADS_BETA],
      [CONTEXT_MANAGEMENT_BETA, THREADS_BETA],
    ]);
  });

  test.each(RESPONSE_KINDS)(
    'runner resumes a paused turn on the thread (%s)',
    async (_kind, respond, stream) => {
      api.queue(respond('msg_a', 'Searching', { stopReason: 'pause_turn' }), respond('msg_b'));

      const final = await makeRunner(api, { stream }).runUntilDone();

      expect([api.bodies()[1]!['thread'], api.bodies()[1]!['messages']]).toEqual([continueFrom('msg_a'), []]);
      expect(final.id).toBe('msg_b');
    },
  );

  test('runner continues without a thread after an unsupported request', async () => {
    api.queue(
      unsupported('inference_hooks'),
      message('msg_b', '', { toolUseId: 'toolu_b' }),
      message('msg_c', 'Sunny.'),
    );

    const final = await makeRunner(api).runUntilDone();

    expect(api.threads()).toEqual([CREATE, null, null]);
    expect(api.helpers()).toEqual(Array(3).fill('BetaToolRunner, message-thread'));
    expect(api.bodies()[2]!['messages']).toEqual([
      WEATHER_QUESTION,
      toolUse('toolu_b'),
      toolResult('toolu_b'),
    ]);
    expect(final.id).toBe('msg_c');
  });

  test('runner continues without a thread when the first continue after a replay finds the thread gone too', async () => {
    api.queue(
      message('msg_a', '', { toolUseId: 'toolu_a' }),
      THREAD_NOT_FOUND,
      message('msg_c', '', { toolUseId: 'toolu_c' }),
      THREAD_NOT_FOUND,
      message('msg_e', '', { toolUseId: 'toolu_e' }),
      message('msg_f', 'Sunny.'),
    );

    const final = await makeRunner(api).runUntilDone();

    const history = [
      WEATHER_QUESTION,
      toolUse('toolu_a'),
      toolResult('toolu_a'),
      toolUse('toolu_c'),
      toolResult('toolu_c'),
    ];
    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a'), CREATE, continueFrom('msg_c'), null, null]);
    expect(api.bodies()[4]!['messages']).toEqual(history);
    expect(api.bodies()[5]!['messages']).toEqual([...history, toolUse('toolu_e'), toolResult('toolu_e')]);
    expect(final.id).toBe('msg_f');
  });

  test('runner with thread false sends the full history without a thread', async () => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));

    await makeRunner(api, { thread: false }).runUntilDone();

    expect(api.threads()).toEqual([null, null]);
    expect(api.betas()).toEqual([[], []]);
    expect(api.helpers()).toEqual(['BetaToolRunner', 'BetaToolRunner']);
    expect(api.bodies()[1]!['messages']).toEqual([
      WEATHER_QUESTION,
      toolUse('toolu_a'),
      toolResult('toolu_a'),
    ]);
  });

  test('runner with thread false keeps a refused reply in its history', async () => {
    api.queue(
      message('msg_a', '', { toolUseId: 'toolu_a' }),
      message('msg_b', 'No.', { stopReason: 'refusal' }),
    );
    const runner = makeRunner(api, { thread: false });

    await runner.runUntilDone();

    expect(runner.params.messages).toEqual([
      WEATHER_QUESTION,
      toolUse('toolu_a'),
      toolResult('toolu_a'),
      assistant('No.'),
    ]);
  });

  test('runner with thread false sends the cache markers of its history as given', async () => {
    const question: BetaMessageParam = {
      role: 'user',
      content: [{ type: 'text', text: 'What is the weather in SF?', cache_control: { type: 'ephemeral' } }],
    };
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));

    await makeRunner(api, { thread: false, messages: [question] }).runUntilDone();

    expect(api.bodies()[1]!['messages']).toEqual([question, toolUse('toolu_a'), toolResult('toolu_a')]);
  });

  test('runner with thread false keeps thread out of the body after setMessagesParams', async () => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));
    const runner = makeRunner(api, { thread: false });

    const iterator = runner[Symbol.asyncIterator]();
    await iterator.next();
    runner.setMessagesParams({ ...runner.params, thread: false, max_tokens: 512 });
    await drain(iterator);

    const [created, continued] = api.bodies();
    expect(created).not.toHaveProperty('thread');
    expect(continued).not.toHaveProperty('thread');
    expect(continued!['max_tokens']).toBe(512);
  });

  test('runner with thread false reuses the container', async () => {
    api.queue(
      message('msg_a', '', { toolUseId: 'toolu_a', container: 'container_a' }),
      message('msg_b', 'Sunny.'),
    );

    await makeRunner(api, { thread: false }).runUntilDone();

    expect(api.bodies()[1]!['container']).toBe('container_a');
  });

  test('runner keeps container skills when adopting a container', async () => {
    api.queue(
      message('msg_a', '', { toolUseId: 'toolu_a', container: 'container_a' }),
      message('msg_b', 'Sunny.'),
    );
    const skills = [{ type: 'anthropic' as const, skill_id: 'xlsx', version: 'latest' }];

    await makeRunner(api, { container: { skills } }).runUntilDone();

    const [created, continued] = api.bodies();
    expect(created!['container']).toEqual({ skills });
    expect(continued!['thread']).toEqual(continueFrom('msg_a'));
    expect(continued!['container']).toEqual({ skills, id: 'container_a' });
  });

  test.each<[string, (reply: BetaMessage) => BetaMessageParam]>([
    ['as a param', (reply) => ({ role: 'assistant', content: reply.content })],
    ['as received', (reply) => reply],
  ])(
    "runner setMessagesParams with the caller's own history continues the thread (reply %s)",
    async (_form, toParam) => {
      api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b'));
      const history = [user('A'), user('B')];
      const runner = makeRunner(api, { messages: history });
      const iterator = runner[Symbol.asyncIterator]();
      const { value: reply } = await iterator.next();

      runner.setMessagesParams((params) => ({
        ...params,
        messages: [...history, toParam(reply), toolResult('toolu_a'), user('C')],
      }));
      await drain(iterator);

      const continued = api.bodies()[1]!;
      expect(continued['thread']).toEqual(continueFrom('msg_a'));
      expect(continued['messages']).toEqual([toolResult('toolu_a'), user('C')]);
    },
  );

  test.each<[string, BetaMessageParam]>([
    ['changed', { ...LOW_EFFORT, output_config: { effort: 'high' } }],
    ['added', { ...LOW_EFFORT, clear_at: 'next_user_message' }],
    ['removed', { role: 'system', content: 'Be brief.' }],
  ])('runner setMessagesParams with a message field %s starts a new thread', async (_change, edited) => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b'));
    const runner = makeRunner(api, { messages: [WEATHER_QUESTION, LOW_EFFORT] });
    const iterator = runner[Symbol.asyncIterator]();
    await iterator.next();

    runner.setMessagesParams((params) => ({
      ...params,
      messages: [WEATHER_QUESTION, edited, toolUse('toolu_a')],
    }));
    await drain(iterator);

    const replaced = api.bodies()[1]!;
    expect(replaced['thread']).toEqual(CREATE);
    expect(replaced['messages']).toEqual([
      WEATHER_QUESTION,
      edited,
      toolUse('toolu_a'),
      toolResult('toolu_a'),
    ]);
    expect(runner.params.messages[1]).toEqual(edited);
  });

  test.each<[string, BetaMessageParam]>([
    ['a field', { ...LOW_EFFORT, output_config: { effort: 'high' } }],
    ['the content', { ...LOW_EFFORT, content: 'Be thorough.' }],
  ])(
    'runner setMessagesParams that edits %s sends a reply given as received as a param',
    async (_part, edited) => {
      api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b'));
      const runner = makeRunner(api, { messages: [WEATHER_QUESTION, LOW_EFFORT] });
      const iterator = runner[Symbol.asyncIterator]();
      const { value: reply } = await iterator.next();

      runner.setMessagesParams((params) => ({
        ...params,
        messages: [WEATHER_QUESTION, edited, reply],
      }));
      await drain(iterator);

      const replaced = api.bodies()[1]!;
      expect(replaced['thread']).toEqual(CREATE);
      expect(replaced['messages']).toEqual([
        WEATHER_QUESTION,
        edited,
        toolUse('toolu_a'),
        toolResult('toolu_a'),
      ]);
      expect(runner.params.messages[2]).toEqual(toolUse('toolu_a'));
    },
  );

  test.each<[string, BetaMessageParam]>([
    ['in another key order', { output_config: { effort: 'low' }, content: 'Be brief.', role: 'system' }],
    ['and an `undefined` one', Object.assign({ clear_at: undefined }, LOW_EFFORT)],
  ])('runner setMessagesParams with the same message fields %s continues the thread', async (_how, same) => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b'));
    const runner = makeRunner(api, { messages: [WEATHER_QUESTION, LOW_EFFORT] });
    const iterator = runner[Symbol.asyncIterator]();
    await iterator.next();

    runner.setMessagesParams((params) => ({
      ...params,
      messages: [WEATHER_QUESTION, same, toolUse('toolu_a')],
    }));
    await drain(iterator);

    const continued = api.bodies()[1]!;
    expect(continued['thread']).toEqual(continueFrom('msg_a'));
    expect(continued['messages']).toEqual([toolResult('toolu_a')]);
  });

  test('runner on a client without message threads never threads', async () => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));
    const thirdParty = new ThirdPartyClient({ apiKey: 'test-key', fetch: api.fetch, maxRetries: 0 });

    await thirdParty.beta.messages
      .toolRunner({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        tools: [weatherTool],
        messages: [WEATHER_QUESTION],
      })
      .runUntilDone();

    expect(api.threads()).toEqual([null, null]);
    expect(api.betas()).toEqual([[], []]);
    expect(api.helpers()).toEqual(['BetaToolRunner', 'BetaToolRunner']);
  });

  test('runner on a subclass of the first-party client threads', async () => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));
    const client = new CallerClient({ apiKey: 'test-key', fetch: api.fetch, maxRetries: 0 });

    await client.beta.messages
      .toolRunner({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        tools: [weatherTool],
        messages: [WEATHER_QUESTION],
      })
      .runUntilDone();

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a')]);
  });

  describe('with `runToolsEagerly`', () => {
    const EAGER = { stream: true, runToolsEagerly: true } as const;
    let timeline: string[];
    beforeEach(() => {
      timeline = [];
    });

    const tool: typeof weatherTool = {
      ...weatherTool,
      run: (input, context) => {
        timeline.push('tool starts');
        return weatherTool.run(input, context);
      },
    };

    /** Runs `runner` to its end and notes the `message_stop` of each reply in `timeline`. */
    async function run(runner: BetaToolRunner<true>): Promise<void> {
      for await (const stream of runner) {
        stream.on('streamEvent', (event) => {
          if (event.type === 'message_stop') timeline.push('message_stop');
        });
      }
    }

    test('runner starts a call while the reply streams and continues the thread with its result', async () => {
      api.queue(streamed('msg_a', '', { toolUseId: 'toolu_a' }), streamed('msg_b', 'Sunny.'));

      await run(makeRunner(api, { tools: [tool], ...EAGER }) as BetaToolRunner<true>);

      expect(timeline).toEqual(['tool starts', 'message_stop', 'message_stop']);
      expect(api.bodies().map((body) => [body['thread'], body['messages']])).toEqual([
        [CREATE, [WEATHER_QUESTION]],
        [continueFrom('msg_a'), [toolResult('toolu_a')]],
      ]);
    });

    test('runner over an existing thread continues it', async () => {
      api.queue(
        message('msg_a'),
        streamed('msg_b', '', { toolUseId: 'toolu_b' }),
        streamed('msg_c', 'Sunny.'),
      );
      const thread = makeThread(api, { tools: [tool] });
      await thread.send(user('Hello'));
      thread.append(WEATHER_QUESTION);

      await run(thread.toolRunner(EAGER));

      expect(timeline).toEqual(['tool starts', 'message_stop', 'message_stop']);
      expect(api.threads()).toEqual([CREATE, continueFrom('msg_a'), continueFrom('msg_b')]);
      expect(thread.previousMessageId).toBe('msg_c');
    });

    test('runner replays a lost thread with the result of the call, which does not run again', async () => {
      api.queue(
        streamed('msg_a', '', { toolUseId: 'toolu_a' }),
        THREAD_NOT_FOUND,
        streamed('msg_b', 'Sunny.'),
      );

      await run(makeRunner(api, { tools: [tool], ...EAGER }) as BetaToolRunner<true>);

      expect(timeline).toEqual(['tool starts', 'message_stop', 'message_stop']);
      expect(api.threads()).toEqual([CREATE, continueFrom('msg_a'), CREATE]);
      expect(api.bodies()[2]!['messages']).toEqual([
        WEATHER_QUESTION,
        toolUse('toolu_a'),
        toolResult('toolu_a'),
      ]);
    });

    test('runner starts the calls of a reply to a request that was sent again without a thread', async () => {
      api.queue(
        unsupported('inference_hooks'),
        streamed('msg_b', '', { toolUseId: 'toolu_b' }),
        streamed('msg_c', 'Sunny.'),
      );

      await run(makeRunner(api, { tools: [tool], ...EAGER }) as BetaToolRunner<true>);

      expect(timeline).toEqual(['tool starts', 'message_stop', 'message_stop']);
      expect(api.threads()).toEqual([CREATE, null, null]);
      expect(api.bodies()[2]!['messages']).toEqual([
        WEATHER_QUESTION,
        toolUse('toolu_b'),
        toolResult('toolu_b'),
      ]);
    });
  });

  test('thread() throws on a client without message threads', () => {
    const thirdParty = new ThirdPartyClient({ apiKey: 'test-key', fetch: api.fetch });

    expect(() => thirdParty.beta.messages.thread({ model: 'claude-sonnet-5', max_tokens: 1024 })).toThrow(
      'Message threads are not available on this client',
    );
    expect(
      () => new BetaMessageThread(thirdParty as any, { model: 'claude-sonnet-5', max_tokens: 1024 }),
    ).toThrow('Message threads are not available on this client');
  });
});

describe('new BetaToolRunner()', () => {
  const PARAMS: BetaToolRunnerParams = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    tools: [weatherTool],
    messages: [WEATHER_QUESTION],
  };
  const OPTIONS = { headers: { 'x-caller': 'yes' } };
  const FULL_HISTORY = [WEATHER_QUESTION, toolUse('toolu_a'), toolResult('toolu_a')];

  const firstParty = (api: MockAPI): Anthropic => api.client;
  const thirdParty = (api: MockAPI): Anthropic =>
    new ThirdPartyClient({ apiKey: 'test-key', fetch: api.fetch, maxRetries: 0 }) as any;

  /** A new mock API, after a two-turn run of the runner that `build` makes on a client of it. */
  async function run(
    makeClient: (api: MockAPI) => Anthropic,
    build: (client: Anthropic) => BetaToolRunner<boolean>,
  ): Promise<MockAPI> {
    const api = mockAPI();
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));
    await build(makeClient(api)).runUntilDone();
    return api;
  }

  const wholeRequests = (api: MockAPI) =>
    api.requests.map(({ headers, ...request }) => ({
      ...request,
      headers: Object.fromEntries(headers.entries()),
    }));

  test.each([
    [
      'threads by default',
      {
        makeClient: firstParty,
        params: PARAMS,
        threads: [CREATE, continueFrom('msg_a')],
        messages: [[WEATHER_QUESTION], [toolResult('toolu_a')]],
        betas: [THREADS_BETA],
        helper: 'BetaToolRunner, message-thread',
      },
    ],
    [
      'sends the full history without a thread with thread false',
      {
        makeClient: firstParty,
        params: { ...PARAMS, thread: false as const },
        threads: [null, null],
        messages: [[WEATHER_QUESTION], FULL_HISTORY],
        betas: [],
        helper: 'BetaToolRunner',
      },
    ],
    [
      'never threads on a client without message threads',
      {
        makeClient: thirdParty,
        params: PARAMS,
        threads: [null, null],
        messages: [[WEATHER_QUESTION], FULL_HISTORY],
        betas: [],
        helper: 'BetaToolRunner',
      },
    ],
  ])(
    'with a client %s, like the factory',
    async (_name, { makeClient, params, threads, messages, betas, helper }) => {
      const api = await run(makeClient, (client) => new BetaToolRunner(client, params, OPTIONS));

      expect(api.requests.map(({ method, path }) => [method, path])).toEqual(
        Array(2).fill(['POST', '/v1/messages']),
      );
      expect(api.threads()).toEqual(threads);
      expect(api.bodies().map((body) => body['messages'])).toEqual(messages);
      expect(api.betas()).toEqual([betas, betas]);
      expect(api.helpers()).toEqual([helper, helper]);
      expect(api.requests.map(({ headers }) => headers.get('x-caller'))).toEqual(['yes', 'yes']);
      const factory = await run(makeClient, (client) => client.beta.messages.toolRunner(params, OPTIONS));
      expect(wholeRequests(api)).toEqual(wholeRequests(factory));
    },
  );

  test.each<[string, object, new (...args: any[]) => Error, string]>([
    [
      'both output formats',
      { output_format: FORECAST_FORMAT, output_config: { format: FORECAST_FORMAT } },
      AnthropicError,
      'Both output_format and output_config.format were provided',
    ],
    ['a `thread`', { thread: CREATE }, TypeError, '`thread` cannot be set in the params of a tool runner'],
    [
      '`compaction`',
      { compaction: { type: 'enabled' } },
      AnthropicError,
      '`compaction` cannot be set on a tool runner',
    ],
    [
      '`runToolsEagerly` without `stream`',
      { runToolsEagerly: true },
      TypeError,
      '`runToolsEagerly: true` needs `stream: true`',
    ],
  ])('with a client rejects %s with the error of the factory', (_what, bad, errorClass, text) => {
    const { client } = mockAPI();
    const params = { ...PARAMS, ...bad } as BetaToolRunnerParams;
    const thrownBy = (build: () => unknown): unknown => {
      try {
        build();
      } catch (error) {
        return error;
      }
      return undefined;
    };

    const error = thrownBy(() => new BetaToolRunner(client, params));

    expect(error).toBeInstanceOf(errorClass);
    expect((error as Error).message).toContain(text);
    expect(error).toStrictEqual(thrownBy(() => client.beta.messages.toolRunner(params)));
  });

  test('with a thread runs over it, like thread.toolRunner()', async () => {
    const api = mockAPI();
    api.queue(message('msg_a'), message('msg_b', '', { toolUseId: 'toolu_b' }), message('msg_c', 'Sunny.'));
    const thread = makeThread(api, { tools: [weatherTool] });
    await thread.send(user('Hello'));
    thread.append(WEATHER_QUESTION);

    await new BetaToolRunner(thread, {}).runUntilDone();

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a'), continueFrom('msg_b')]);
    expect(api.helpers().slice(1)).toEqual(Array(2).fill('BetaToolRunner, message-thread'));
    expect(thread.previousMessageId).toBe('msg_c');
  });
});
