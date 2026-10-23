import { APIUserAbortError, BadRequestError, InternalServerError } from '@anthropic-ai/sdk';
import type { BetaMessageThread } from '@anthropic-ai/sdk/lib/threads/BetaMessageThread';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import type { BetaToolRunner, BetaToolRunnerParams } from '@anthropic-ai/sdk/lib/tools/BetaToolRunner';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta';
import {
  CREATE,
  FALLBACKS,
  FALLBACK_BETA,
  INLINE_TOOLS_BETA,
  MAX_TOKENS,
  MODEL,
  RESPONSE_KINDS,
  THREADS_BETA,
  TIDES_TOOL_ADDED,
  WEATHER_QUESTION,
  WEATHER_TOOL_REMOVED,
  afterFallback,
  apiError,
  betaMessage,
  continueFrom,
  drain,
  makeRunner,
  makeThread,
  message,
  mockAPI,
  nextReply,
  roles,
  serverError,
  streamed,
  assistant,
  stalledText,
  stalledToolUse,
  tidesTool,
  toolResult,
  toolUse,
  unsupported,
  user,
  weatherTool,
  type MockAPI,
  type Responder,
  type ResponderFactory,
} from './helpers';

describe('BetaToolRunner over a thread', () => {
  let api: MockAPI;
  beforeEach(() => {
    api = mockAPI();
  });

  test('runner over an existing thread continues it', async () => {
    api.queue(
      message('msg_a'),
      message('msg_b', '', { toolUseId: 'toolu_b' }),
      message('msg_c', 'Sunny.'),
      message('msg_d'),
    );
    const thread = makeThread(api, { tools: [weatherTool] });
    await thread.send(user('Hello'));
    thread.append(WEATHER_QUESTION);

    const final = await thread.toolRunner().runUntilDone();
    const rolesAfterTheRunner = roles(thread.messages);
    await thread.send(user('Thanks'));

    expect(final.id).toBe('msg_c');
    expect(rolesAfterTheRunner).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
    expect(api.threads()).toEqual([
      CREATE,
      continueFrom('msg_a'),
      continueFrom('msg_b'),
      continueFrom('msg_c'),
    ]);
    expect(api.helpers()).toEqual([
      'message-thread',
      'BetaToolRunner, message-thread',
      'BetaToolRunner, message-thread',
      'message-thread',
    ]);
  });

  test.each(RESPONSE_KINDS)(
    'runner continues the thread in the adopted container (%s)',
    async (_kind, respond, stream) => {
      api.queue(
        respond('msg_a', '', { toolUseId: 'toolu_a', container: 'container_a' }),
        respond('msg_b', 'Sunny.'),
      );
      const thread = makeThread(api, { tools: [weatherTool] });
      thread.append(WEATHER_QUESTION);

      const final = await thread.toolRunner({ stream }).runUntilDone();

      const [created, continued] = api.bodies();
      expect(created).not.toHaveProperty('container');
      expect(continued!['container']).toBe('container_a');
      expect([continued!['thread'], continued!['messages']]).toEqual([
        continueFrom('msg_a'),
        [toolResult('toolu_a')],
      ]);
      expect(thread.previousMessageId).toBe(final.id);
    },
  );

  test.each([
    ['non-streaming', message, {}],
    ['streaming', streamed, { stream: true }],
    ['streaming with `runToolsEagerly`', streamed, { stream: true, runToolsEagerly: true }],
  ])(
    "runner turns keep the thread's headers, and headers given to the runner replace them whole (%s)",
    async (_kind, respond, settings) => {
      api.queue(
        respond('msg_a', '', { toolUseId: 'toolu_a' }),
        respond('msg_b', 'Sunny.'),
        respond('msg_c', 'Foggy.'),
        message('msg_d'),
      );
      const thread = makeThread(api, { tools: [weatherTool] }, { headers: { 'X-Thread': 'thread' } });

      thread.append(WEATHER_QUESTION);
      await thread.toolRunner(settings).runUntilDone();
      thread.append(user('And tomorrow?'));
      await thread.toolRunner(settings, { headers: { 'X-Runner': 'runner' } }).runUntilDone();
      await thread.send(user('Thanks'));

      expect(api.requests.map(({ headers }) => [headers.get('x-thread'), headers.get('x-runner')])).toEqual([
        ['thread', null],
        ['thread', null],
        [null, 'runner'],
        ['thread', null],
      ]);
      expect(api.helpers()).toEqual([...Array(3).fill('BetaToolRunner, message-thread'), 'message-thread']);
    },
  );

  test.each(RESPONSE_KINDS)(
    'runner stopped at its limit after a tool turn leaves the tool results and the container on the thread (%s)',
    async (_kind, respond, stream) => {
      api.queue(respond('msg_a', '', { toolUseId: 'toolu_a', container: 'container_a' }), message('msg_b'));
      const thread = makeThread(api, { tools: [weatherTool] });
      thread.append(WEATHER_QUESTION);

      await thread.toolRunner({ stream, max_iterations: 1 }).runUntilDone();
      await thread.send(user('Thanks'));

      expect(api.bodies()[1]).toMatchObject({
        thread: continueFrom('msg_a'),
        messages: [toolResult('toolu_a'), user('Thanks')],
        container: 'container_a',
      });
    },
  );

  test.each(RESPONSE_KINDS)(
    "runner stopped at its limit after setMessagesParams during the tool turn leaves the caller's history on the thread (%s)",
    async (_kind, respond, stream) => {
      api.queue(respond('msg_a', '', { toolUseId: 'toolu_a', container: 'container_a' }), message('msg_b'));
      const thread = makeThread(api, { tools: [weatherTool] });
      thread.append(WEATHER_QUESTION);
      const runner = thread.toolRunner({ stream, max_iterations: 1 });

      for await (const reply of runner) {
        if ('finalMessage' in reply) await reply.finalMessage();
        runner.setMessagesParams((params) => ({ ...params, max_tokens: 512 }));
      }
      await thread.send(user('Thanks'));

      expect(api.bodies()[1]).toMatchObject({
        thread: CREATE,
        messages: [WEATHER_QUESTION, user('Thanks')],
        max_tokens: 512,
      });
    },
  );

  test('runner over a default thread throws on an unsupported request', async () => {
    api.queue(unsupported('inference_hooks'));
    const thread = makeThread(api, { tools: [weatherTool] });
    thread.append(WEATHER_QUESTION);

    await expect(thread.toolRunner().runUntilDone()).rejects.toThrow(BadRequestError);

    expect(api.threads()).toEqual([CREATE]);
  });

  test.each(RESPONSE_KINDS)(
    'the pushed messages and tool results of a turn that fails go out when the runner is run again: %s',
    async (_name, respond, stream) => {
      api.queue(
        serverError(),
        respond('msg_b', '', { toolUseId: 'toolu_b' }),
        serverError(),
        respond('msg_d', 'Sunny.'),
      );
      const thread = makeThread(api, { tools: [weatherTool] });
      thread.append(WEATHER_QUESTION);
      const runner = thread.toolRunner({ stream });
      runner.pushMessages(user('In Celsius, please.'));

      await expect(runner.runUntilDone()).rejects.toThrow(InternalServerError);
      await expect(runner.runUntilDone()).rejects.toThrow(InternalServerError);
      await runner.runUntilDone();

      expect(api.bodies().map((body) => [body['thread'], body['messages']])).toEqual([
        [CREATE, [WEATHER_QUESTION, user('In Celsius, please.')]],
        [CREATE, [WEATHER_QUESTION, user('In Celsius, please.')]],
        [continueFrom('msg_b'), [toolResult('toolu_b')]],
        [continueFrom('msg_b'), [toolResult('toolu_b')]],
      ]);
    },
  );

  test.each(RESPONSE_KINDS)(
    'runner ends on a refused turn, which leaves its tool results staged for a new thread: %s',
    async (_name, respond, stream) => {
      api.queue(
        respond('msg_a', '', { toolUseId: 'toolu_a' }),
        respond('msg_b', 'No.', { stopReason: 'refusal' }),
        message('msg_c'),
      );
      const thread = makeThread(api, { tools: [weatherTool] });
      thread.append(WEATHER_QUESTION);

      const final = await thread.toolRunner({ stream }).runUntilDone();
      await thread.send(user('Never mind'));

      expect(final).toMatchObject({ id: 'msg_b', stop_reason: 'refusal' });
      expect(api.bodies().map((body) => [body['thread'], body['messages']])).toEqual([
        [CREATE, [WEATHER_QUESTION]],
        [continueFrom('msg_a'), [toolResult('toolu_a')]],
        [CREATE, [WEATHER_QUESTION, toolUse('toolu_a'), toolResult('toolu_a'), user('Never mind')]],
      ]);
    },
  );

  test.each(RESPONSE_KINDS)(
    'runner answers the tool calls of a fallback model under a new thread: %s',
    async (_name, respond, stream) => {
      api.queue(
        respond('msg_a', '', { toolUseId: 'toolu_a', fallback: true }),
        respond('msg_b', '', { toolUseId: 'toolu_b' }),
        respond('msg_c', 'Sunny.'),
      );
      const thread = makeThread(api, { tools: [weatherTool], fallbacks: FALLBACKS, betas: [FALLBACK_BETA] });
      thread.append(WEATHER_QUESTION);

      const final = await thread.toolRunner({ stream }).runUntilDone();

      expect(final.id).toBe('msg_c');
      expect(
        api.bodies().map((body) => [body['thread'], body['model'], body['fallbacks'], body['messages']]),
      ).toEqual([
        [CREATE, MODEL, FALLBACKS, [WEATHER_QUESTION]],
        [
          CREATE,
          MODEL,
          FALLBACKS,
          [WEATHER_QUESTION, afterFallback(toolUse('toolu_a')), toolResult('toolu_a')],
        ],
        [continueFrom('msg_b'), MODEL, FALLBACKS, [toolResult('toolu_b')]],
      ]);
    },
  );

  test('runner over a continue_unthreaded thread continues without a thread', async () => {
    api.queue(unsupported('inference_hooks'), message('msg_b', 'Sunny.'));
    const thread = makeThread(api, {
      tools: [weatherTool],
      unsupportedRequestBehavior: 'continue_unthreaded',
    });
    thread.append(WEATHER_QUESTION);

    const final = await thread.toolRunner().runUntilDone();

    expect(api.threads()).toEqual([CREATE, null]);
    expect(final.id).toBe('msg_b');
  });

  test('streaming runner setMessagesParams that appends to the history drops the reply', async () => {
    api.queue(streamed('msg_a', '', { toolUseId: 'toolu_a' }), streamed('msg_b', 'Sunny.'));
    const thread = makeThread(api, { tools: [weatherTool] });
    thread.append(WEATHER_QUESTION);
    const runner = thread.toolRunner({ stream: true });

    const iterator = runner[Symbol.asyncIterator]();
    await nextReply(iterator);
    runner.setMessagesParams((params) => ({ ...params, messages: [...params.messages, user('One word.')] }));
    await drain(iterator);

    const replaced = api.bodies()[1]!;
    expect(replaced['thread']).toEqual(CREATE);
    expect(replaced['messages']).toEqual([WEATHER_QUESTION, user('One word.')]);
    expect(roles(thread.messages)).toEqual(['user', 'user', 'assistant']);
    expect(thread.previousMessageId).toBe('msg_b');
  });

  test.each(RESPONSE_KINDS)(
    'runner setMessagesParams replaces the history mid-loop (%s)',
    async (_kind, respond, stream) => {
      api.queue(respond('msg_a', '', { toolUseId: 'toolu_a' }), respond('msg_b', 'Sunny.'));
      const thread = makeThread(api, { tools: [weatherTool] });
      thread.append(WEATHER_QUESTION);
      const runner = thread.toolRunner({ stream });

      const iterator = runner[Symbol.asyncIterator]();
      await nextReply(iterator);
      runner.setMessagesParams((params) => ({
        ...params,
        messages: [user('Start over: Oakland?'), toolUse('toolu_a')],
      }));
      await drain(iterator);

      const replaced = api.bodies()[1]!;
      expect(replaced['thread']).toEqual(CREATE);
      expect(replaced['messages']).toEqual([
        user('Start over: Oakland?'),
        toolUse('toolu_a'),
        toolResult('toolu_a'),
      ]);
      expect(roles(thread.messages)).toEqual(['user', 'assistant', 'user', 'assistant']);
      expect(thread.previousMessageId).toBe('msg_b');
    },
  );

  test.each(RESPONSE_KINDS)(
    'runner sends tool results ahead of messages appended to the thread mid-loop (%s)',
    async (_kind, respond, stream) => {
      api.queue(respond('msg_a', '', { toolUseId: 'toolu_a' }), respond('msg_b', 'Sunny.'));
      const thread = makeThread(api, { tools: [weatherTool] });
      thread.append(WEATHER_QUESTION);
      const runner = thread.toolRunner({ stream });

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      thread.append(user('In one word.'));
      await drain(iterator);

      const continued = api.bodies()[1]!;
      expect(continued['thread']).toEqual(continueFrom('msg_a'));
      expect(continued['messages']).toEqual([toolResult('toolu_a'), user('In one word.')]);
      expect(roles(thread.messages)).toEqual(['user', 'assistant', 'user', 'user', 'assistant']);
    },
  );

  test('params returns the runnable tools as given', () => {
    const rawTool = {
      name: 'noop',
      description: 'Does nothing.',
      input_schema: { type: 'object' as const, properties: {} },
    };
    const thread = makeThread(api, { tools: [weatherTool, rawTool] });

    expect(thread.params.tools).toEqual([weatherTool, rawTool]);
    expect(api.client.beta.messages.thread(thread.params).params.tools).toEqual([weatherTool, rawTool]);
  });

  test('setMessagesParams replaces the params, so a field it leaves out is gone', async () => {
    api.queue(message('msg_a'));
    const runner = api.client.beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 1024,
      system: 'Be brief.',
      tools: [weatherTool],
      messages: [user('Hello')],
    });

    runner.setMessagesParams((params) => ({
      model: params.model,
      max_tokens: 2048,
      tools: params.tools,
      messages: params.messages,
    }));
    await runner.runUntilDone();

    const body = api.bodies()[0]!;
    expect([
      body['max_tokens'],
      body['system'],
      (body['tools'] as Array<{ name: string }>).map((t) => t.name),
    ]).toEqual([2048, undefined, ['get_weather']]);
  });

  test.each<
    [string, { system?: string }, (params: BetaToolRunnerParams) => BetaToolRunnerParams, unknown, boolean]
  >([
    ['sets an unrelated field', {}, (params) => ({ ...params, max_tokens: 12 }), 'Be brief.', false],
    [
      'sets an unrelated field on a thread with a system',
      { system: 'Be kind.' },
      (params) => ({ ...params, max_tokens: 12 }),
      'Be brief.',
      false,
    ],
    ['sets another system', {}, (params) => ({ ...params, system: 'Be verbose.' }), 'Be verbose.', true],
    ['leaves out the system', {}, ({ system, ...params }) => params, undefined, true],
  ])(
    'setMessagesParams that %s during the turn that creates the thread with a system of its own',
    async (_does, own, edit, system, refused) => {
      api.queue(streamed('msg_a'), message('msg_b'));
      const thread = makeThread(api, own);

      const stream = thread.stream(user('Hello'), { system: 'Be brief.' });
      thread.toolRunner().setMessagesParams(edit);
      await stream.done();
      const next = thread.send(user('Again'));
      await (refused ? expect(next).rejects.toThrow('Cannot change `system` on a thread') : next);

      expect(thread.params.system).toBe(system);
      expect(api.threads()).toEqual(refused ? [CREATE] : [CREATE, continueFrom('msg_a')]);
    },
  );

  test('params of a runner over a thread without tools can be written back without starting a new thread', async () => {
    api.queue(message('msg_a'), message('msg_b'));
    const thread = makeThread(api);
    await thread.send(user('Hello'));
    thread.append(user('Again'));
    const runner = thread.toolRunner();

    runner.setMessagesParams(runner.params);
    await runner.runUntilDone();

    expect(api.threads()).toEqual([CREATE, continueFrom('msg_a')]);
  });

  test.each(RESPONSE_KINDS)(
    'a changed system is refused before a tool runs (%s)',
    async (_kind, respond, stream) => {
      api.queue(respond('msg_a', '', { toolUseId: 'toolu_a' }));
      const run = vi.fn(weatherTool.run);
      const runner = makeRunner(api, { system: 'Be brief.', tools: [{ ...weatherTool, run }], stream });

      const iterator = runner[Symbol.asyncIterator]();
      await nextReply(iterator);
      runner.setMessagesParams((params) => ({ ...params, system: 'Be very brief.' }));
      await expect(drain(iterator)).rejects.toThrow('Cannot change `system` on a thread');

      expect([api.requests.length, run.mock.calls.length]).toEqual([1, 0]);
    },
  );

  test("a tool pushed onto the caller's tools list during the run is refused before the next request", async () => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }));
    const tools: BetaRunnableTool<any>[] = [];
    tools.push({
      ...weatherTool,
      run: async (input) => {
        tools.push(tidesTool);
        return weatherTool.run(input);
      },
    });

    await expect(makeRunner(api, { tools }).runUntilDone()).rejects.toThrow(
      'Cannot change `tools` on a thread',
    );

    expect(api.requests.length).toBe(1);
  });

  describe('`addTools()` and `removeTools()`', () => {
    const WEATHER_TOOL_NOT_FOUND: BetaMessageParam = {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_c',
          content: "Error: Tool 'get_weather' not found",
          is_error: true,
        },
      ],
    };

    /** The model calls `get_weather`, then `get_tides`, then `get_weather` again, then ends the run. */
    const queueRun = (respond: ResponderFactory) =>
      api.queue(
        respond('msg_a', '', { toolUseId: 'toolu_a' }),
        respond('msg_b', '', { toolUseId: 'toolu_b', toolName: 'get_tides' }),
        respond('msg_c', '', { toolUseId: 'toolu_c' }),
        respond('msg_d', 'Done.'),
      );

    /** Runs `runner`, adding `getTides` while it handles the first reply and removing `get_weather` on the second. */
    async function addThenRemove(runner: BetaToolRunner<boolean>, getTides: BetaRunnableTool<any>) {
      let replies = 0;
      for await (const _ of runner) {
        replies += 1;
        if (replies === 1) runner.addTools(getTides);
        if (replies === 2) runner.removeTools('get_weather');
      }
    }

    test.each(RESPONSE_KINDS)(
      'a runner on its own thread sends each change on a `continue`, which repeats no `tools` (%s)',
      async (_kind, respond, stream) => {
        queueRun(respond);
        const run = vi.fn(tidesTool.run);
        const runner = makeRunner(api, { betas: [INLINE_TOOLS_BETA], stream });

        await addThenRemove(runner, { ...tidesTool, run });

        expect(api.bodies().map((body) => [body['thread'], body['messages']])).toEqual([
          [CREATE, [WEATHER_QUESTION]],
          [continueFrom('msg_a'), [toolResult('toolu_a'), TIDES_TOOL_ADDED]],
          [
            continueFrom('msg_b'),
            [toolResult('toolu_b', 'High tide in San Francisco'), WEATHER_TOOL_REMOVED],
          ],
          [continueFrom('msg_c'), [WEATHER_TOOL_NOT_FOUND]],
        ]);
        expect(api.bodies()[0]!['tools']).toMatchObject([{ name: 'get_weather' }]);
        expect(api.bodies().map((body) => 'tools' in body)).toEqual([true, false, false, false]);
        expect(api.betas()).toEqual(Array(4).fill([INLINE_TOOLS_BETA, THREADS_BETA]));
        expect(run).toHaveBeenCalledTimes(1);
        expect((await runner.done()).id).toBe('msg_d');
      },
    );

    test('a runner over an existing thread sends each change on a `continue`, and the thread goes on after it', async () => {
      api.queue(message('msg_0'));
      queueRun(message);
      api.queue(message('msg_e'));
      const thread = makeThread(api, { tools: [weatherTool], betas: [INLINE_TOOLS_BETA] });
      await thread.send(user('Hello'));
      thread.append(WEATHER_QUESTION);

      await addThenRemove(thread.toolRunner(), tidesTool);
      await thread.send(user('Thanks'));

      expect(api.bodies().map((body) => [body['thread'], body['messages']])).toEqual([
        [CREATE, [user('Hello')]],
        [continueFrom('msg_0'), [WEATHER_QUESTION]],
        [continueFrom('msg_a'), [toolResult('toolu_a'), TIDES_TOOL_ADDED]],
        [continueFrom('msg_b'), [toolResult('toolu_b', 'High tide in San Francisco'), WEATHER_TOOL_REMOVED]],
        [continueFrom('msg_c'), [WEATHER_TOOL_NOT_FOUND]],
        [continueFrom('msg_d'), [user('Thanks')]],
      ]);
      expect(api.bodies().map((body) => 'tools' in body)).toEqual([true, ...Array(5).fill(false)]);
      expect(thread.messages.filter(({ role }) => role === 'system')).toEqual([
        TIDES_TOOL_ADDED,
        WEATHER_TOOL_REMOVED,
      ]);
    });
  });

  test('a compaction request the server cannot thread costs one rejected request, and the run stays unthreaded', async () => {
    const summary = {
      type: 'compaction',
      content: 'It is sunny in SF.',
      encrypted_content: null,
      signature: 'sig_a',
    };
    api.queue(
      message('msg_a', '', { toolUseId: 'toolu_a' }),
      unsupported('context_management'),
      () => Response.json({ ...betaMessage('msg_b'), content: [summary], stop_reason: 'compaction' }),
      message('msg_c', 'Sunny.'),
    );
    const runner = makeRunner(api, { betas: ['compact-2026-09-04'] });

    for await (const reply of runner) {
      if ('id' in reply && reply.id === 'msg_a') runner.compactBeforeNextTurn();
    }

    expect(api.threads()).toEqual([CREATE, CREATE, null, null]);
    expect(api.helpers()).toEqual(Array(4).fill('BetaToolRunner, message-thread'));
    expect(api.bodies().map((body) => 'compaction' in body)).toEqual([false, true, true, false]);
    expect(api.bodies()[3]!['messages']).toEqual([{ role: 'assistant', content: [summary] }]);
  });

  test('a compaction request of a run that has stopped threading keeps the helper tags', async () => {
    const summary = { type: 'compaction', content: 'Sunny.', encrypted_content: null, signature: 'sig_a' };
    api.queue(
      unsupported('inference_hooks'),
      message('msg_a', '', { toolUseId: 'toolu_a' }),
      () => Response.json({ ...betaMessage('msg_b'), content: [summary], stop_reason: 'compaction' }),
      message('msg_c', 'Sunny.'),
    );
    const runner = makeRunner(api, { betas: ['compact-2026-09-04'] });

    for await (const reply of runner) {
      if ('id' in reply && reply.id === 'msg_a') runner.compactBeforeNextTurn();
    }

    expect(api.bodies().map((body) => 'compaction' in body)).toEqual([false, false, true, false]);
    expect(api.helpers()).toEqual(Array(4).fill('BetaToolRunner, message-thread'));
  });

  test('runner sends a message appended to the thread during a compaction after the summary', async () => {
    const summary = { type: 'compaction', content: 'Sunny.', encrypted_content: null, signature: 'sig_a' };
    api.queue(
      message('msg_a', '', { toolUseId: 'toolu_a' }),
      () => Response.json({ ...betaMessage('msg_b'), content: [summary], stop_reason: 'compaction' }),
      message('msg_c', 'Sunny.'),
    );
    const thread = makeThread(api, { tools: [weatherTool], betas: ['compact-2026-09-04'] });
    thread.append(WEATHER_QUESTION);
    const runner = thread.toolRunner();

    for await (const reply of runner) {
      if (reply.id === 'msg_a') runner.compactBeforeNextTurn();
      if (reply.id === 'msg_b') {
        expect(() => runner.pushMessages(user('In one word.'))).toThrow(/being compacted/);
        thread.append(user('In one word.'));
      }
    }

    const compacted = [{ role: 'assistant', content: [summary] }, user('In one word.')];
    expect(api.bodies()[2]!['messages']).toEqual(compacted);
    expect(thread.messages).toEqual([...compacted, assistant('Sunny.')]);
  });

  test('a message appended to the thread during a compaction after the final turn stays staged', async () => {
    const summary = { type: 'compaction', content: 'Sunny.', encrypted_content: null, signature: 'sig_a' };
    api.queue(message('msg_a', 'Sunny.'), () =>
      Response.json({ ...betaMessage('msg_b'), content: [summary], stop_reason: 'compaction' }),
    );
    const thread = makeThread(api, { tools: [weatherTool], betas: ['compact-2026-09-04'] });
    thread.append(WEATHER_QUESTION);
    const runner = thread.toolRunner();

    for await (const reply of runner) {
      if (reply.id === 'msg_a') runner.compactBeforeNextTurn();
      if (reply.id === 'msg_b') thread.append(user('In one word.'));
    }

    const compacted = [{ role: 'assistant', content: [summary] }, user('In one word.')];
    expect(thread.messages).toEqual(compacted);

    api.queue(message('msg_c', 'Sunny.'));
    await thread.send();
    expect(api.bodies()[2]!['messages']).toEqual(compacted);
  });

  test('the compaction response appended to the thread again is kept once', async () => {
    const summary = { type: 'compaction', content: 'Sunny.', encrypted_content: null, signature: 'sig_a' };
    api.queue(
      message('msg_a', '', { toolUseId: 'toolu_a' }),
      () => Response.json({ ...betaMessage('msg_b'), content: [summary], stop_reason: 'compaction' }),
      message('msg_c', 'Sunny.'),
    );
    const thread = makeThread(api, { tools: [weatherTool], betas: ['compact-2026-09-04'] });
    thread.append(WEATHER_QUESTION);
    const runner = thread.toolRunner();

    for await (const reply of runner) {
      if (reply.id === 'msg_a') runner.compactBeforeNextTurn();
      thread.append(reply);
    }

    expect(api.bodies()[2]!['messages']).toEqual([{ role: 'assistant', content: [summary] }]);
  });

  test("headers set on the runner later replace its earlier ones and keep the helpers' tags", async () => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));
    const runner = makeRunner(api, {}, { headers: { 'x-stainless-helper': 'mine' } });

    for await (const _reply of runner) {
      runner.setRequestOptions({ headers: { 'X-Later': 'later' } });
    }

    expect(api.helpers()).toEqual(['BetaToolRunner, mine, message-thread', 'BetaToolRunner, message-thread']);
    expect(api.requests.map(({ headers }) => headers.get('x-later'))).toEqual([null, 'later']);
  });

  test('streaming runner iterated again after a turn ended early sends that turn again', async () => {
    api.queue(stalledText('msg_a', 'one two three', { deltas: 1 }), streamed('msg_b', 'Done.'));
    const thread = makeThread(api, { tools: [weatherTool] });
    thread.append(user('Count'));
    const runner = thread.toolRunner({ stream: true });

    const firstPass = (async () => {
      for await (const stream of runner) {
        for await (const event of stream) {
          if (event.type === 'content_block_delta') break;
        }
      }
    })();
    await expect(firstPass).rejects.toThrow(APIUserAbortError);
    const final = await runner.runUntilDone();

    expect(api.bodies().map((body) => [body['thread'], roles(body['messages'])])).toEqual([
      [CREATE, ['user']],
      [CREATE, ['user']],
    ]);
    expect(roles(thread.messages)).toEqual(['user', 'assistant']);
    expect(thread.previousMessageId).toBe(final.id);
  });

  test('streaming runner whose turn ends early after a push drops the partial reply', async () => {
    api.queue(
      stalledToolUse('msg_a', 'Let me check.', { toolUseId: 'toolu_a' }),
      streamed('msg_b', 'Sunny.'),
    );
    const thread = makeThread(api, { tools: [weatherTool] });
    thread.append(WEATHER_QUESTION);
    const runner = thread.toolRunner({ stream: true });

    const iterator = runner[Symbol.asyncIterator]();
    const { value: stream } = await iterator.next();
    runner.pushMessages(user('In Celsius, please.'));
    await new Promise<void>((resolve) => stream.once('inputJson', () => resolve(stream.abort())));
    await drain(iterator);

    expect(api.bodies().map((body) => [body['thread'], body['messages']])).toEqual([
      [CREATE, [WEATHER_QUESTION]],
      [CREATE, [WEATHER_QUESTION, user('In Celsius, please.')]],
    ]);
    expect(roles(thread.messages)).toEqual(['user', 'user', 'assistant']);
  });

  test('runner started on a thread whose stream ended early sends that turn again', async () => {
    api.queue(message('msg_a'), stalledText('msg_b', 'one two three', { deltas: 1 }), message('msg_c'));
    const thread = makeThread(api, { tools: [weatherTool] });
    await thread.send(user('Hello'));
    const stream = thread.stream(user('Count'));
    stream.once('text', () => stream.abort());
    await stream.done().catch(() => {});

    const final = await thread.toolRunner().runUntilDone();

    const retried = api.bodies()[2]!;
    expect([retried['thread'], retried['messages']]).toEqual([
      CREATE,
      [user('Hello'), assistant('Hi!'), user('Count')],
    ]);
    expect(roles(thread.messages)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(thread.previousMessageId).toBe(final.id);
  });

  test('a message pushed while that turn is sent again follows what was sent, without the partial reply', async () => {
    api.queue(
      message('msg_a'),
      stalledText('msg_b', 'one two three', { deltas: 1 }),
      message('msg_c'),
      message('msg_d'),
    );
    const thread = makeThread(api, { tools: [weatherTool] });
    await thread.send(user('Hello'));
    const stream = thread.stream(user('Count'));
    stream.once('text', () => stream.abort());
    await stream.done().catch(() => {});
    const runner = thread.toolRunner();

    const iterator = runner[Symbol.asyncIterator]();
    await iterator.next();
    runner.pushMessages(user('Slowly.'));
    await drain(iterator);

    expect(api.bodies()[3]!['messages']).toEqual([
      user('Hello'),
      assistant('Hi!'),
      user('Count'),
      user('Slowly.'),
    ]);
  });

  test('runner sends a message appended to the thread during a yield', async () => {
    api.queue(message('msg_a', 'Which city?', { stopReason: 'tool_use' }), message('msg_b', 'Sunny.'));
    const thread = makeThread(api, { tools: [weatherTool] });
    thread.append(WEATHER_QUESTION);

    const seen: string[] = [];
    for await (const reply of thread.toolRunner()) {
      seen.push(reply.id);
      if (reply.id === 'msg_a') thread.append(user('San Francisco'));
    }

    expect(seen).toEqual(['msg_a', 'msg_b']);
    expect(api.bodies()[1]!['messages']).toEqual([user('San Francisco')]);
  });

  describe.each([
    ['non-streaming', message, {}],
    ['streaming', streamed, { stream: true }],
    ['streaming with `runToolsEagerly`', streamed, { stream: true, runToolsEagerly: true }],
  ])('after a paused reply (%s)', (_kind, respond, settings) => {
    type WhilePaused = (runner: BetaToolRunner<boolean>, thread: BetaMessageThread<any>) => void;

    const ADDED = user('In one word.');
    const append: WhilePaused = (_runner, thread) => thread.append(ADDED);
    const push: WhilePaused = (runner) => runner.pushMessages(ADDED);
    const setLongerMessages: WhilePaused = (runner) =>
      runner.setMessagesParams((params) => ({ ...params, messages: [...params.messages, ADDED] }));
    const appendWhileOthersWait: WhilePaused = (runner, thread) => {
      runner.compactBeforeNextTurn();
      runner.addTools(tidesTool);
      thread.append(ADDED);
    };

    /** Runs a runner whose first reply, `msg_a`, is paused, and calls `whilePaused` once that reply has arrived. */
    async function run(replies: Responder[], whilePaused: WhilePaused) {
      api.queue(respond('msg_a', 'Searching', { stopReason: 'pause_turn' }), ...replies);
      const thread = makeThread(api, { tools: [weatherTool] });
      thread.append(WEATHER_QUESTION);
      const runner = thread.toolRunner(settings);

      const iterator = runner[Symbol.asyncIterator]();
      const { value: paused } = await iterator.next();
      if ('finalMessage' in paused) await paused.finalMessage();
      whilePaused(runner, thread);
      await drain(iterator);

      return { final: await runner.done() };
    }

    const sent = () => api.bodies().map((body) => [body['thread'], body['messages']]);

    test.each([
      ['thread.append()', append],
      ['thread.append() while a compaction and a tool change wait', appendWhileOthersWait],
    ])('a message added with %s goes out with the request that resumes the turn', async (_, add) => {
      const unexecuted = apiError(
        400,
        'invalid_request_error',
        'messages.0: `server_tool_use` was not executed',
      );

      await expect(run([unexecuted], add)).rejects.toThrow(BadRequestError);

      expect(sent()).toEqual([
        [CREATE, [WEATHER_QUESTION]],
        [continueFrom('msg_a'), [ADDED]],
      ]);
    });

    test.each([
      ['pushMessages()', push],
      ['setMessagesParams()', setLongerMessages],
    ])('a message added with %s takes the place of the paused reply', async (_, add) => {
      await run([respond('msg_b', 'Sunny.')], add);

      expect(sent()).toEqual([
        [CREATE, [WEATHER_QUESTION]],
        [CREATE, [WEATHER_QUESTION, ADDED]],
      ]);
    });

    test('a changed param drops the paused reply and sends the turn again', async () => {
      const { final } = await run([respond('msg_b', 'Sunny.')], (runner) =>
        runner.setMessagesParams((params) => ({ ...params, max_tokens: 200 })),
      );

      expect(final.id).toBe('msg_b');
      expect(sent()).toEqual([
        [CREATE, [WEATHER_QUESTION]],
        [CREATE, [WEATHER_QUESTION]],
      ]);
    });

    test.each([
      ['leaves out the paused reply', [WEATHER_QUESTION, ADDED]],
      ['has another reply in its place', [WEATHER_QUESTION, assistant('Sunny.'), ADDED]],
    ])('a history that %s is sent whole', async (_, messages) => {
      await run([respond('msg_b', 'Sunny.')], (runner) =>
        runner.setMessagesParams((params) => ({ ...params, messages })),
      );

      expect(sent()).toEqual([
        [CREATE, [WEATHER_QUESTION]],
        [CREATE, messages],
      ]);
    });
  });

  test('runner setMessagesParams trimmed history keeps one copy of the reply', async () => {
    api.queue(message('msg_a'), message('msg_b', '', { toolUseId: 'toolu_b' }), message('msg_c', 'Sunny.'));
    const thread = makeThread(api, { tools: [weatherTool] });
    await thread.send(user('Hello'));
    thread.append(WEATHER_QUESTION);
    const runner = thread.toolRunner();

    const iterator = runner[Symbol.asyncIterator]();
    await iterator.next();
    runner.setMessagesParams((params) => ({
      ...params,
      messages: [...params.messages.slice(2), toolUse('toolu_b')],
    }));
    await drain(iterator);

    const trimmed = api.bodies()[2]!;
    expect(trimmed['thread']).toEqual(CREATE);
    expect(trimmed['messages']).toEqual([WEATHER_QUESTION, toolUse('toolu_b'), toolResult('toolu_b')]);
    expect(thread.previousMessageId).toBe('msg_c');
  });

  test('streaming runner keeps messages pushed after a mid-loop rewrite', async () => {
    api.queue(streamed('msg_a', '', { toolUseId: 'toolu_a' }), streamed('msg_b', 'Sunny.'));
    const thread = makeThread(api, { tools: [weatherTool] });
    thread.append(WEATHER_QUESTION);
    const runner = thread.toolRunner({ stream: true });

    const iterator = runner[Symbol.asyncIterator]();
    const { value: stream } = await iterator.next();
    runner.setMessagesParams((params) => ({ ...params, messages: [user('Start over: Oakland?')] }));
    runner.pushMessages(user('Also Berkeley.'));
    const messagesDuringTheTurn = runner.params.messages;
    await stream.finalMessage();
    await drain(iterator);

    const rewritten = api.bodies()[1]!;
    expect(messagesDuringTheTurn).toEqual([user('Start over: Oakland?'), user('Also Berkeley.')]);
    expect(rewritten['thread']).toEqual(CREATE);
    expect(rewritten['messages']).toEqual([user('Start over: Oakland?'), user('Also Berkeley.')]);
    expect(roles(thread.messages)).toEqual(['user', 'user', 'assistant']);
    expect(thread.previousMessageId).toBe('msg_b');
  });

  test.each(RESPONSE_KINDS)(
    'runner sends the turn again after a params-only change on a final reply (%s)',
    async (_kind, respond, stream) => {
      api.queue(respond('msg_a', 'Sunny.'), respond('msg_b', 'Sunny.'));
      const thread = makeThread(api, { tools: [weatherTool] });
      thread.append(WEATHER_QUESTION);
      const runner = thread.toolRunner({ stream });

      const iterator = runner[Symbol.asyncIterator]();
      await nextReply(iterator);
      runner.setMessagesParams((params) => ({ ...params, max_tokens: 100 }));
      await drain(iterator);

      expect(api.bodies().map((body) => [body['thread'], body['messages'], body['max_tokens']])).toEqual([
        [CREATE, [WEATHER_QUESTION], MAX_TOKENS],
        [CREATE, [WEATHER_QUESTION], 100],
      ]);
      expect((await runner.done()).id).toBe('msg_b');
      expect(thread.previousMessageId).toBe('msg_b');
    },
  );

  test('runner sends a message pushed during a final reply in place of the reply', async () => {
    api.queue(message('msg_a', 'Sunny.'), message('msg_b', 'You are welcome.'));
    const thread = makeThread(api, { tools: [weatherTool] });
    thread.append(WEATHER_QUESTION);
    const runner = thread.toolRunner();

    const iterator = runner[Symbol.asyncIterator]();
    await iterator.next();
    runner.pushMessages(user('Thanks!'));
    await drain(iterator);

    const [, replaced] = api.bodies();
    expect([replaced!['thread'], replaced!['messages']]).toEqual([
      CREATE,
      [WEATHER_QUESTION, user('Thanks!')],
    ]);
    expect((await runner.done()).id).toBe('msg_b');
  });

  test('update tools replaces the runnable tools', async () => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));
    const thread = makeThread(api);

    thread.update({ tools: [weatherTool] });
    thread.append(WEATHER_QUESTION);
    const final = await thread.toolRunner().runUntilDone();

    const [created, continued] = api.bodies();
    expect((created!['tools'] as Array<{ name: string }>).map((tool) => tool.name)).toEqual(['get_weather']);
    expect(continued!['messages']).toEqual([toolResult('toolu_a')]);
    expect(final.id).toBe('msg_b');
  });

  test('runner over a fork calls the original tools', async () => {
    api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));
    const thread = makeThread(api, { tools: [weatherTool] });
    const fork = thread.fork();
    fork.append(WEATHER_QUESTION);

    const final = await fork.toolRunner().runUntilDone();

    const [created, continued] = api.bodies();
    expect(final.id).toBe('msg_b');
    expect(created!['tools']).toMatchObject([{ type: 'custom', name: 'get_weather' }]);
    expect(created!['tools'][0]).not.toHaveProperty('run');
    expect([continued!['thread'], continued!['messages']]).toEqual([
      continueFrom('msg_a'),
      [toolResult('toolu_a')],
    ]);
    expect([thread.messages, thread.previousMessageId]).toEqual([[], null]);
  });

  test.each([
    ['create', CREATE],
    ['continue', continueFrom('msg_x')],
    ['null', null],
  ])(
    'client toolRunner refuses a `thread` value (%s) before any request or tool runs',
    async (_name, value) => {
      api.queue(message('msg_a', '', { toolUseId: 'toolu_a' }), message('msg_b', 'Sunny.'));
      const refusal = new TypeError(
        '`thread` cannot be set in the params of a tool runner. The runner sets it for each request itself. ' +
          'To run without a message thread, pass `thread: false`.',
      );
      const run = vi.fn(weatherTool.run);
      const tools = [{ ...weatherTool, run }];
      const forced = { thread: value } as {};

      expect(() => makeRunner(api, { tools, ...forced })).toThrow(refusal);
      expect(api.requests).toHaveLength(0);

      const runner = makeRunner(api, { tools });
      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      expect(() => runner.setMessagesParams({ ...runner.params, max_tokens: 7, ...forced })).toThrow(refusal);
      expect([api.requests.length, run.mock.calls.length]).toEqual([1, 0]);
      await drain(iterator);

      expect(api.bodies()[1]).toMatchObject({ thread: continueFrom('msg_a'), max_tokens: MAX_TOKENS });
    },
  );

  test("the only `thread` value in the client toolRunner's params type is `false`", () => {
    // @ts-expect-error the runner sets `thread` for each request itself
    const created = () => makeRunner(api, { thread: { type: 'create' } });
    // @ts-expect-error the runner sets `thread` for each request itself
    const unset = () => makeRunner(api, { thread: null });
    // The @ts-expect-error lines are the checks. This line only uses the closures.
    expect([created, unset, () => makeRunner(api, { thread: false })]).toHaveLength(3);
  });

  test('thread.toolRunner() refuses `thread: false`, which would do nothing', () => {
    const thread = makeThread(api, { tools: [weatherTool] });

    // @ts-expect-error a runner over a thread has no `thread` param
    expect(() => thread.toolRunner({ thread: false })).toThrow(
      new TypeError('`thread` cannot be set here. The message thread sets it for each request itself.'),
    );
  });
});
