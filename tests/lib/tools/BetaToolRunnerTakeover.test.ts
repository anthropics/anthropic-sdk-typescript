import type { BetaToolRunner, BetaToolRunnerParams } from '@anthropic-ai/sdk/lib/tools/BetaToolRunner';
import type { BetaMessage, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta';
import {
  CREATE,
  MAX_TOKENS,
  WEATHER_QUESTION,
  assistant,
  continueFrom,
  makeRunner,
  message,
  mockAPI,
  serverError,
  streamed,
  toolResult,
  toolUse,
  user,
  weatherTool,
  type MockAPI,
  type Responder,
} from '../threads/helpers';

type Change = (runner: BetaToolRunner<boolean>, reply: BetaMessage) => void | Promise<void>;

const doubleMaxTokens: Change = (runner) =>
  runner.setMessagesParams((params) => ({ ...params, max_tokens: params.max_tokens * 2 }));

const OWN_RESULT = toolResult('toolu_a', 'Foggy.');
const TOOL_CALL = { toolUseId: 'toolu_a' };

describe.each([
  ['default settings', {}, message],
  ['default settings, streaming', { stream: true }, streamed],
  ['`thread: false`', { thread: false }, message],
  ['`thread: false`, streaming', { thread: false, stream: true }, streamed],
] as const)('a change to the runner during the loop body (%s)', (_mode, settings, respond) => {
  let api: MockAPI;
  let run: ReturnType<typeof vi.fn<typeof weatherTool.run>>;
  beforeEach(() => {
    api = mockAPI();
    run = vi.fn(weatherTool.run);
  });

  /** Runs a runner to its end and calls `change` while the caller handles the first reply. */
  async function runWith(replies: Responder[], change: Change, params: Partial<BetaToolRunnerParams> = {}) {
    api.queue(...replies);
    const runner = makeRunner(api, { tools: [{ ...weatherTool, run }], ...settings, ...params });
    let turn = 0;
    for await (const item of runner) {
      const reply = 'finalMessage' in item ? await item.finalMessage() : item;
      if (turn++ === 0) await change(runner, reply);
    }
    return { runner, final: await runner.done() };
  }

  const sentMessages = () => api.bodies().map((body) => body['messages']);
  const newThreads = (count: number) => Array(count).fill('thread' in settings ? null : CREATE);

  test('doubling max_tokens after a reply that was cut off sends the turn again', async () => {
    const { final } = await runWith(
      [respond('msg_a', 'Sunny and', { stopReason: 'max_tokens' }), respond('msg_b', 'Sunny and warm.')],
      (runner, reply) => {
        if (reply.stop_reason === 'max_tokens') doubleMaxTokens(runner, reply);
      },
    );

    expect(sentMessages()).toEqual([[WEATHER_QUESTION], [WEATHER_QUESTION]]);
    expect(api.bodies().map((body) => body['max_tokens'])).toEqual([MAX_TOKENS, MAX_TOKENS * 2]);
    expect(api.threads()).toEqual(newThreads(2));
    expect(final.id).toBe('msg_b');
  });

  test.each<[string, Parameters<typeof message>[2], Change, BetaMessageParam[], number]>([
    ['a changed param on a tool_use reply', TOOL_CALL, doubleMaxTokens, [], 0],
    ['a changed param on a final reply', {}, doubleMaxTokens, [], 0],
    ['a changed param on a paused reply', { stopReason: 'pause_turn' }, doubleMaxTokens, [], 0],
    [
      'a user message pushed on a tool_use reply',
      TOOL_CALL,
      (runner) => runner.pushMessages(user('Never mind.')),
      [user('Never mind.')],
      0,
    ],
    [
      'a user message pushed on a final reply',
      {},
      (runner) => runner.pushMessages(user('And tomorrow?')),
      [user('And tomorrow?')],
      0,
    ],
    [
      'a tool result pushed without the reply',
      TOOL_CALL,
      (runner) => runner.pushMessages(OWN_RESULT),
      [OWN_RESULT],
      0,
    ],
    [
      'an edited copy of the reply pushed with a tool result',
      { ...TOOL_CALL, stopReason: 'tool_use' },
      (runner, reply) =>
        runner.pushMessages(
          { role: 'assistant', content: [{ type: 'text', text: 'Checking.' }, ...reply.content] },
          OWN_RESULT,
        ),
      [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Checking.' }, ...(toolUse('toolu_a').content as [])],
        },
        OWN_RESULT,
      ],
      0,
    ],
    [
      'a tool call appended after a final reply',
      {},
      (runner) =>
        runner.setMessagesParams((params) => ({
          ...params,
          messages: [...params.messages, toolUse('toolu_own')],
        })),
      [toolUse('toolu_own'), toolResult('toolu_own')],
      1,
    ],
    [
      'a user and an assistant message pushed on a tool_use reply',
      TOOL_CALL,
      (runner) => runner.pushMessages(user('Please also consider the wind.'), assistant('I understand.')),
      [user('Please also consider the wind.'), assistant('I understand.')],
      0,
    ],
    [
      'a changed param after generateToolResponse()',
      TOOL_CALL,
      async (runner, reply) => {
        await runner.generateToolResponse();
        doubleMaxTokens(runner, reply);
      },
      [],
      1,
    ],
    [
      'a user message pushed after generateToolResponse()',
      TOOL_CALL,
      async (runner) => {
        await runner.generateToolResponse();
        runner.pushMessages(user('Never mind.'));
      },
      [user('Never mind.')],
      1,
    ],
  ])(
    '%s drops the reply and sends what the caller left',
    async (_what, firstReply, change, added, toolRuns) => {
      const { final } = await runWith([respond('msg_a', '', firstReply), respond('msg_b', 'Sunny.')], change);

      expect(sentMessages()).toEqual([[WEATHER_QUESTION], [WEATHER_QUESTION, ...added]]);
      expect(api.threads()).toEqual(newThreads(2));
      expect(run).toHaveBeenCalledTimes(toolRuns);
      expect(final.id).toBe('msg_b');
    },
  );

  test.each<[string, string, Change, BetaMessageParam[]]>([
    [
      'a changed system',
      'system',
      (runner) => runner.setMessagesParams((params) => ({ ...params, system: 'Be very brief.' })),
      [WEATHER_QUESTION],
    ],
    [
      'changed tools',
      'tools',
      (runner) => runner.setMessagesParams((params) => ({ ...params, tools: [] })),
      [WEATHER_QUESTION],
    ],
    [
      'a changed system with a rewritten history',
      'system',
      (runner) =>
        runner.setMessagesParams((params) => ({
          ...params,
          messages: [user('Start over: Oakland?')],
          system: 'Be very brief.',
        })),
      [user('Start over: Oakland?')],
    ],
  ])('%s on a tool_use reply goes out only with `thread: false`', async (_what, field, change, messages) => {
    const replies = [respond('msg_a', '', TOOL_CALL), respond('msg_b', 'Sunny.')];
    const finished = runWith(replies, change, { system: 'Be brief.' });

    if ('thread' in settings) {
      await finished;
      expect(sentMessages()).toEqual([[WEATHER_QUESTION], messages]);
      expect(api.bodies()[1]![field]).not.toEqual(api.bodies()[0]![field]);
    } else {
      await expect(finished).rejects.toThrow(`Cannot change \`${field}\` on a thread`);
      expect(api.requests).toHaveLength(1);
    }
    expect(run).not.toHaveBeenCalled();
  });

  test('the reply pushed with a tool result is kept, and the tool does not run', async () => {
    await runWith([respond('msg_a', '', TOOL_CALL), respond('msg_b', 'Foggy.')], (runner, reply) =>
      runner.pushMessages({ role: 'assistant', content: reply.content }, OWN_RESULT),
    );

    expect([api.threads()[1], sentMessages()[1]]).toEqual(
      'thread' in settings ?
        [null, [WEATHER_QUESTION, toolUse('toolu_a'), OWN_RESULT]]
      : [continueFrom('msg_a'), [OWN_RESULT]],
    );
    expect(run).not.toHaveBeenCalled();
  });

  test('the reply pushed alone is answered by the runner', async () => {
    await runWith([respond('msg_a', '', TOOL_CALL), respond('msg_b', 'Sunny.')], (runner, reply) =>
      runner.pushMessages({ role: 'assistant', content: reply.content }),
    );

    expect([api.threads()[1], sentMessages()[1]]).toEqual(
      'thread' in settings ?
        [null, [WEATHER_QUESTION, toolUse('toolu_a'), toolResult('toolu_a')]]
      : [continueFrom('msg_a'), [toolResult('toolu_a')]],
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  test('params.messages gets the reply after the loop body', async () => {
    api.queue(respond('msg_a', '', TOOL_CALL), respond('msg_b', 'Sunny.'));
    const runner = makeRunner(api, settings);

    const seen: BetaMessageParam[][] = [];
    for await (const item of runner) {
      if ('finalMessage' in item) await item.finalMessage();
      seen.push(runner.params.messages);
    }

    const afterToolTurn = [WEATHER_QUESTION, toolUse('toolu_a'), toolResult('toolu_a')];
    expect(seen).toEqual([[WEATHER_QUESTION], afterToolTurn]);
    expect(runner.params.messages).toEqual([...afterToolTurn, assistant('Sunny.')]);
  });

  test('params.messages is without the reply after a break', async () => {
    api.queue(respond('msg_a', '', TOOL_CALL));
    const runner = makeRunner(api, settings);

    for await (const item of runner) {
      if ('finalMessage' in item) await item.finalMessage();
      break;
    }

    expect(runner.params.messages).toEqual([WEATHER_QUESTION]);
  });

  test('each request after a change counts towards max_iterations', async () => {
    api.queue(respond('msg_a', 'One'), respond('msg_b', 'Two'), respond('msg_c', 'Three'));
    const runner = makeRunner(api, { ...settings, max_iterations: 2 });

    for await (const item of runner) {
      doubleMaxTokens(runner, 'finalMessage' in item ? await item.finalMessage() : item);
    }

    expect(api.bodies().map((body) => body['max_tokens'])).toEqual([MAX_TOKENS, MAX_TOKENS * 2]);
    expect((await runner.done()).id).toBe('msg_b');
  });
});

describe.each([
  ['default settings', {}],
  ['`thread: false`', { thread: false }],
] as const)('a change to a streaming runner whose reply failed (%s)', (_mode, settings) => {
  test('sends the turn again', async () => {
    const api = mockAPI();
    api.queue(serverError(), streamed('msg_b', 'Sunny.'));
    const runner = makeRunner(api, { ...settings, stream: true }) as BetaToolRunner<true>;

    for await (const stream of runner) {
      await stream.finalMessage().catch(() => runner.setMessagesParams((params) => params));
    }

    expect(api.bodies().map((body) => body['messages'])).toEqual([[WEATHER_QUESTION], [WEATHER_QUESTION]]);
    expect((await runner.done()).id).toBe('msg_b');
  });
});

describe.each([
  ['default settings', {}],
  ['`thread: false`', { thread: false }],
] as const)('the messages a runner is created with (%s)', (_mode, settings) => {
  test('go out as they were given when the caller edits them afterwards', async () => {
    const api = mockAPI();
    api.queue(message('msg_a', 'Sunny.'));
    const block = { type: 'text' as const, text: 'What is the weather in SF?' };
    const messages: BetaMessageParam[] = [{ role: 'user', content: [block] }];
    const runner = makeRunner(api, { ...settings, messages });

    block.text = 'What is the weather in NYC?';
    messages.push(user('And in Boston?'));
    await runner.runUntilDone();

    expect(api.bodies()[0]!['messages']).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'What is the weather in SF?' }] },
    ]);
  });
});
