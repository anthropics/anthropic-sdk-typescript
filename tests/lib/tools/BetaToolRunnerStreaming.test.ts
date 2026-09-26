/**
 * How a tool runner with `runToolsEagerly` starts tool calls. `setup()` turns the option on.
 *
 * Most tests here assert a timeline: what the caller saw, in order, and where each tool started.
 *
 *   'a: content_block_stop'   the caller got this stream event, from a listener or a `for await`
 *   'lookup(a) STARTS'        the runner called the tool's `run()`
 *   'loop body ends'          the caller finished its `for await (const stream of runner)` body
 *
 * Every reply is made of `call('a')`, which is the model calling `lookup({ key: 'a' })` with the id
 * `toolu_a`, and `text('...')`. The first describe block is the behavior in short.
 */

import Anthropic, { APIUserAbortError } from '@anthropic-ai/sdk';
import { BetaMessageStream } from '@anthropic-ai/sdk/lib/BetaMessageStream';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import type {
  BetaMessage,
  BetaMessageParam,
  BetaStopReason,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta';
import type { BetaRawMessageStreamEvent } from '@anthropic-ai/sdk/resources/beta/messages';
import { mockFetch } from '../mock-fetch';

describe('a tool runner with `runToolsEagerly`', () => {
  it('starts each tool as soon as the model has moved on from its call', async () => {
    const { runner, timeline, see } = setup([reply(call('a'), call('b')), done()]);

    for await (const stream of runner) {
      stream.on('streamEvent', see);
      await stream.finalMessage();
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual([
      'message_start',
      'a: content_block_start',
      'a: content_block_delta',
      'a: content_block_stop',
      'b: content_block_start', // the model has moved on from a
      'lookup(a) STARTS',
      'b: content_block_delta',
      'b: content_block_stop',
      'message_delta (tool_use)', // the model has moved on from b
      'lookup(b) STARTS',
      'message_stop',
      'loop body ends',
    ]);
  });

  it('starts every tool after the loop body when not streaming, as before', async () => {
    const { runner, timeline } = setupWithoutStreaming([reply(call('a'), call('b')), done()]);

    for await (const _message of runner) {
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual(['loop body ends', 'lookup(a) STARTS', 'lookup(b) STARTS']);
  });

  it('holds a call that the caller defers until the loop body ends', async () => {
    const { runner, timeline, see } = setup([reply(call('a'), call('b'), call('c')), done()]);

    for await (const stream of runner) {
      stream.on('streamEvent', see);
      stream.on('contentBlock', (block) => {
        if (block.type === 'tool_use' && block.id === 'toolu_b') {
          runner.deferToolCall(block);
        }
      });
      await stream.finalMessage();
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual([
      'message_start',
      'a: content_block_start',
      'a: content_block_delta',
      'a: content_block_stop',
      'b: content_block_start',
      'lookup(a) STARTS',
      'b: content_block_delta',
      'b: content_block_stop', // the caller defers b here
      'c: content_block_start', // b would have started here
      'c: content_block_delta',
      'c: content_block_stop',
      'message_delta (tool_use)',
      'lookup(c) STARTS',
      'message_stop',
      'loop body ends',
      'lookup(b) STARTS',
    ]);
    // The results go back in the model's order, whatever order the calls started in.
    expect(resultsSent(runner)).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_a', content: 'value of a' },
      { type: 'tool_result', tool_use_id: 'toolu_b', content: 'value of b' },
      { type: 'tool_result', tool_use_id: 'toolu_c', content: 'value of c' },
    ]);
  });

  it('lists the calls that are being held, so that the caller can decide about them', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b')), done()]);

    for await (const stream of runner) {
      stream.on('contentBlock', (block) => {
        if (block.type === 'tool_use' && block.id === 'toolu_b') {
          runner.deferToolCall(block);
        }
      });

      await stream.finalMessage();

      const held = runner.deferredToolCalls;

      expect(held).toEqual([{ type: 'tool_use', id: 'toolu_b', name: 'lookup', input: { key: 'b' } }]);
      break; // the caller decides against b
    }

    expect(timeline).toEqual(['lookup(a) STARTS']);
  });

  it('runs each call once', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b'))]);

    for await (const stream of runner) {
      runner.deferToolCall('toolu_a');
      const message = await stream.finalMessage();

      const response = await runner.generateToolResponse();
      // pushMessages() drops the cached response, so the second call answers the reply again.
      runner.pushMessages(assistantTurn(message), response!);
      expect(await runner.generateToolResponse()).toEqual(response);
      break;
    }

    expect(timeline).toEqual(['lookup(b) STARTS', 'lookup(a) STARTS']);
  });
});

describe('without `runToolsEagerly`', () => {
  it('starts every tool after the loop body, as before', async () => {
    const { runner, timeline, see } = setupWithoutOption([reply(call('a'), call('b')), done()]);

    for await (const stream of runner) {
      stream.on('streamEvent', see);
      await stream.finalMessage();
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual([
      'message_start',
      'a: content_block_start',
      'a: content_block_delta',
      'a: content_block_stop',
      'b: content_block_start',
      'b: content_block_delta',
      'b: content_block_stop',
      'message_delta (tool_use)',
      'message_stop',
      'loop body ends',
      'lookup(a) STARTS',
      'lookup(b) STARTS',
    ]);
  });

  it('yields the stream that `messages.stream()` returns', async () => {
    const { runner } = setupWithoutOption([done()]);

    const stream = (await runner[Symbol.asyncIterator]().next()).value;
    await stream.finalMessage();

    expect(stream.constructor).toBe(BetaMessageStream);
  });

  it('has nothing to defer', async () => {
    const { runner, timeline } = setupWithoutOption([reply(call('a')), done()]);

    for await (const stream of runner) {
      runner.deferToolCall('toolu_a');
      await stream.finalMessage();
      expect(runner.deferredToolCalls).toEqual([]);
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual(['loop body ends', 'lookup(a) STARTS']);
  });

  it('runs the tools again after setMessagesParams(), as before', async () => {
    const { runner, timeline } = setupWithoutOption([reply(call('a'))]);

    for await (const _stream of runner) {
      await runner.generateToolResponse();
      runner.setMessagesParams((params) => ({ ...params, max_tokens: 2048 }));
      await runner.generateToolResponse();
      break;
    }

    expect(timeline).toEqual(['lookup(a) STARTS', 'lookup(a) STARTS']);
  });
});

describe('the `runToolsEagerly` option', () => {
  it('is not sent to the API', async () => {
    const { runner, requests } = setup([reply(call('a')), done()]);

    runner.compactBeforeNextTurn();
    await runner.runUntilDone();

    expect(requests.map(({ body }) => 'compaction' in body)).toContain(true);
    expect(requests.map(({ body }) => 'runToolsEagerly' in body)).toEqual(requests.map(() => false));
  });

  it('can be turned off between replies', async () => {
    // The second reply reuses the id of the call that started early in the first.
    const { runner, timeline } = setup([reply(call('a')), reply(call('a')), done()]);

    let replies = 0;
    for await (const stream of runner) {
      await stream.finalMessage();
      if (replies++ === 0) {
        runner.setMessagesParams((params) => ({ ...params, runToolsEagerly: false }));
      }
      timeline.push('loop body ends');
    }

    expect(timeline).toEqual([
      'lookup(a) STARTS', // while the first reply streamed
      'loop body ends',
      'request 2',
      'loop body ends',
      'lookup(a) STARTS', // after the second reply
      'request 3',
      'loop body ends',
    ]);
  });

  const needsStream = "`runToolsEagerly: true` needs `stream: true` in the tool runner's params";
  const params = {
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user' as const, content: 'Look these up.' }],
    tools: [],
  };

  it.each([
    [
      'toolRunner() gets it without `stream: true`',
      (client: Anthropic) => client.beta.messages.toolRunner({ ...params, runToolsEagerly: true }),
    ],
    [
      'setMessagesParams() turns `stream` off',
      (client: Anthropic) =>
        client.beta.messages
          .toolRunner({ ...params, stream: true, runToolsEagerly: true })
          .setMessagesParams((previous) => ({ ...previous, stream: false })),
    ],
  ])('throws a TypeError when %s', (_, act) => {
    const client = new Anthropic({ apiKey: 'test-key' });

    expect(() => act(client)).toThrow(TypeError);
    expect(() => act(client)).toThrow(needsStream);
  });

  it.each([
    ['is false', { runToolsEagerly: false }],
    ['is left out', {}],
  ])('can be used without `stream: true` when it %s', (_, option) => {
    const client = new Anthropic({ apiKey: 'test-key' });

    expect(() => client.beta.messages.toolRunner({ ...params, ...option })).not.toThrow();
  });
});

describe('when a tool call starts', () => {
  it.each(readers())(
    'waits until a `for await` over the stream that %s has handled the event',
    async (_, handleEvent) => {
      const { runner, timeline, see } = setup([reply(call('a'), call('b')), done()]);

      for await (const stream of runner) {
        for await (const event of stream) {
          see(event);
          await handleEvent();
        }
        timeline.push('loop body ends');
      }

      expect(firstReply(timeline)).toEqual([
        'message_start',
        'a: content_block_start',
        'a: content_block_delta',
        'a: content_block_stop',
        'b: content_block_start',
        'lookup(a) STARTS',
        'b: content_block_delta',
        'b: content_block_stop',
        'message_delta (tool_use)',
        'lookup(b) STARTS',
        'message_stop',
        'loop body ends',
      ]);
    },
  );

  it('waits for the slowest of two `for await` loops over the stream', async () => {
    const { runner, timeline, see } = setup([reply(call('a')), done()]);

    for await (const stream of runner) {
      const fast = (async () => {
        for await (const _event of stream) {
          // reads every event at once
        }
      })();
      for await (const event of stream) {
        see(event);
        await new Promise<void>((resolve) => setTimeout(resolve, 1));
      }
      await fast;
    }

    expect(firstReply(timeline)).toEqual([
      'message_start',
      'a: content_block_start',
      'a: content_block_delta',
      'a: content_block_stop',
      'message_delta (tool_use)',
      'lookup(a) STARTS',
      'message_stop',
    ]);
  });

  it('does not wait for the reply to end, or for anyone to read the stream', async () => {
    const paused = pauseBefore(reply(call('a'), text('Found a.'), call('b')), 'text: content_block_delta');
    const { runner, timeline } = setup([paused.reply, done()]);

    const run = runner.runUntilDone();
    await vi.waitFor(() => expect(timeline).toEqual(['lookup(a) STARTS']));
    paused.resume();
    await run;

    expect(firstReply(timeline)).toEqual(['lookup(a) STARTS', 'lookup(b) STARTS']);
  });

  it('waits for the loop body to end when a `for await` over the stream has stopped reading', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b')), done()]);

    for await (const stream of runner) {
      const events = stream[Symbol.asyncIterator]();
      await events.next(); // reads one event and no more
      await stream.finalMessage();
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual(['loop body ends', 'lookup(a) STARTS', 'lookup(b) STARTS']);
  });

  it('waits for a readable stream made from the stream to be read', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b')), done()]);

    for await (const stream of runner) {
      const reader = stream.toReadableStream().getReader();
      await stream.finalMessage();
      timeline.push('the reply has ended');

      while (!(await reader.read()).done) {
        // reads every event
      }
      timeline.push('the readable stream has been read');
    }

    expect(firstReply(timeline)).toEqual([
      'the reply has ended',
      'lookup(a) STARTS',
      'lookup(b) STARTS',
      'the readable stream has been read',
    ]);
  });

  it('does not wait for the calls before it to finish', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b')), done()], {
      lookup: (key) =>
        new Promise((resolve) => setTimeout(() => resolve(`value of ${key}`), key === 'a' ? 20 : 0)),
      logReturns: true,
    });

    await runner.runUntilDone();

    expect(firstReply(timeline)).toEqual([
      'lookup(a) STARTS',
      'lookup(b) STARTS',
      'lookup(b) returns',
      'lookup(a) returns',
    ]);
    expect(resultsSent(runner).map((result) => result.tool_use_id)).toEqual(['toolu_a', 'toolu_b']);
  });

  it('yields a BetaMessageStream and sends the request as `messages.stream()` does', async () => {
    const { runner, requests } = setup([done()]);

    const stream = (await runner[Symbol.asyncIterator]().next()).value;
    await stream.finalMessage();

    expect(stream).toBeInstanceOf(BetaMessageStream);
    expect(stream.messages).toEqual([
      { role: 'user', content: 'Look these up.' },
      expect.objectContaining({ role: 'assistant' }),
    ]);
    expect(requests[0]!.body.stream).toBe(true);
    expect(requests[0]!.headers.get('x-stainless-helper')).toContain('BetaToolRunner');
  });
});

describe('deferToolCall()', () => {
  it.each([
    ['the block', (block: BetaToolUseBlock) => block],
    ['the id', (block: BetaToolUseBlock) => block.id],
  ])('takes %s', async (_, argument) => {
    const { runner, timeline } = setup([reply(call('a'), call('b')), done()]);

    for await (const stream of runner) {
      stream.on('contentBlock', (block) => {
        if (block.type === 'tool_use' && block.id === 'toolu_a') runner.deferToolCall(argument(block));
      });
      await stream.finalMessage();
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual(['lookup(b) STARTS', 'loop body ends', 'lookup(a) STARTS']);
  });

  it('gives the timing from before when the caller defers every call', async () => {
    const { runner, timeline, see } = setup([reply(call('a'), call('b')), done()]);

    for await (const stream of runner) {
      stream.on('streamEvent', see);
      stream.on('contentBlock', (block) => {
        if (block.type === 'tool_use') runner.deferToolCall(block);
      });
      await stream.finalMessage();
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual([
      'message_start',
      'a: content_block_start',
      'a: content_block_delta',
      'a: content_block_stop',
      'b: content_block_start',
      'b: content_block_delta',
      'b: content_block_stop',
      'message_delta (tool_use)',
      'message_stop',
      'loop body ends',
      'lookup(a) STARTS',
      'lookup(b) STARTS',
    ]);
  });

  it.each(readers())(
    'holds a call deferred from a `for await` over the stream that %s',
    async (_, handleEvent) => {
      const { runner, timeline } = setup([reply(call('a'), call('b'), call('c')), done()]);

      for await (const stream of runner) {
        for await (const event of stream) {
          if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
            if (event.content_block.id === 'toolu_b') runner.deferToolCall(event.content_block);
          }
          await handleEvent();
        }
        timeline.push('loop body ends');
      }

      expect(firstReply(timeline)).toEqual([
        'lookup(a) STARTS',
        'lookup(c) STARTS',
        'loop body ends',
        'lookup(b) STARTS',
      ]);
    },
  );

  it('holds a call deferred from a `for await` over the stream after an await', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b')), done()]);

    for await (const stream of runner) {
      for await (const event of stream) {
        if (event.type === 'content_block_start' && event.index === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 5));
          runner.deferToolCall('toolu_a');
        }
      }
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual(['lookup(b) STARTS', 'loop body ends', 'lookup(a) STARTS']);
  });

  it('holds a call deferred from a listener of the very event that moves on from it', async () => {
    const { runner, timeline, see } = setup([reply(call('a'), call('b')), done()]);

    for await (const stream of runner) {
      stream.on('streamEvent', (event) => {
        see(event);
        if (event.type === 'content_block_start' && event.index === 1) runner.deferToolCall('toolu_a');
      });
      await stream.finalMessage();
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline).slice(4)).toEqual([
      'b: content_block_start', // a would have started after this event
      'b: content_block_delta',
      'b: content_block_stop',
      'message_delta (tool_use)',
      'lookup(b) STARTS',
      'message_stop',
      'loop body ends',
      'lookup(a) STARTS',
    ]);
  });

  it('can be too late in a listener that defers after an await', async () => {
    // A listener is done with an event when it returns, not when the promise it returns settles.
    const { runner, timeline } = setup([reply(call('a'), call('b'))]);

    for await (const stream of runner) {
      const deferred = new Promise<void>((resolve) => {
        stream.on('contentBlock', async (block) => {
          if (block.type !== 'tool_use' || block.id !== 'toolu_a') return;
          await stream.finalMessage();
          timeline.push('deferToolCall(a)');
          runner.deferToolCall(block);
          resolve();
        });
      });
      await deferred;
      break;
    }

    expect(timeline).toEqual(['lookup(a) STARTS', 'lookup(b) STARTS', 'deferToolCall(a)']);
  });

  it('does nothing before the loop starts, because there is no reply yet', async () => {
    const { runner, timeline } = setup([reply(call('a')), done()]);

    runner.deferToolCall('toolu_a');
    for await (const stream of runner) {
      await stream.finalMessage();
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual(['lookup(a) STARTS', 'loop body ends']);
  });

  it('changes nothing for a call that has started', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b')), done()]);

    for await (const stream of runner) {
      stream.on('streamEvent', (event) => {
        if (event.type !== 'content_block_delta' || event.index !== 1) return;
        timeline.push('deferToolCall(a)');
        runner.deferToolCall('toolu_a');
      });
      await stream.finalMessage();
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual([
      'lookup(a) STARTS',
      'deferToolCall(a)',
      'lookup(b) STARTS',
      'loop body ends',
    ]);
    expect(resultsSent(runner).map((result) => result.tool_use_id)).toEqual(['toolu_a', 'toolu_b']);
  });

  it('lasts for one reply', async () => {
    // The second reply reuses the id of the call that was held in the first.
    const { runner, timeline } = setup([reply(call('a')), reply(call('a')), done()]);

    let replies = 0;
    for await (const stream of runner) {
      if (replies++ === 0) runner.deferToolCall('toolu_a');
      await stream.finalMessage();
      timeline.push('loop body ends');
    }

    expect(timeline).toEqual([
      'loop body ends',
      'lookup(a) STARTS', // held in the first reply
      'request 2',
      'lookup(a) STARTS', // not held in the second
      'loop body ends',
      'request 3',
      'loop body ends',
    ]);
  });

  it('lets the caller refuse a held call by removing its tool', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b')), done()]);

    for await (const stream of runner) {
      for await (const event of stream) {
        if (event.type === 'content_block_start' && event.index === 1) runner.deferToolCall('toolu_b');
      }
      runner.removeTools('lookup');
    }

    expect(firstReply(timeline)).toEqual(['lookup(a) STARTS']);
    expect(resultsSent(runner)).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_a', content: 'value of a' },
      notFound('toolu_b'),
    ]);
  });

  it('starts a held call when the caller asks for the tool response', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b'))]);

    for await (const stream of runner) {
      runner.deferToolCall('toolu_a');
      await stream.finalMessage();
      timeline.push('generateToolResponse()');
      const response = await runner.generateToolResponse();

      expect(toolResults(response).map((result) => result.tool_use_id)).toEqual(['toolu_a', 'toolu_b']);
      break;
    }

    expect(timeline).toEqual(['lookup(b) STARTS', 'generateToolResponse()', 'lookup(a) STARTS']);
  });

  it('keeps a held call from running when the caller takes over the reply', async () => {
    // After pushMessages() the runner sends the caller's history, not this reply's results.
    const { runner, timeline, requests } = setup([reply(call('a'), call('b')), done()]);

    let replies = 0;
    for await (const stream of runner) {
      stream.on('contentBlock', (block) => {
        if (block.type === 'tool_use') runner.deferToolCall(block);
      });
      await stream.finalMessage();
      if (replies++ === 0) runner.pushMessages({ role: 'user', content: 'Never mind.' });
    }

    expect(timeline).toEqual(['request 2']);
    expect(requests[1]!.body.messages).toEqual([
      { role: 'user', content: 'Look these up.' },
      { role: 'user', content: 'Never mind.' },
    ]);
  });

  it('lets a tool change the params from run() without the runner dropping the reply', async () => {
    // A call that starts while the caller is still handling the reply changes the params before the runner
    // has appended the reply, which the runner takes for the caller taking over the history.
    const test = setup([reply(call('a')), done()], {
      lookup: async (key) => {
        test.runner.setMessagesParams((params) => ({ ...params, max_tokens: 2048 }));
        return `value of ${key}`;
      },
    });

    for await (const stream of test.runner) {
      stream.on('contentBlock', (block) => {
        if (block.type === 'tool_use') test.runner.deferToolCall(block);
      });
      await stream.finalMessage();
    }

    expect(test.requests[1]!.body.max_tokens).toBe(2048);
    expect(test.requests[1]!.body.messages.map((message: BetaMessageParam) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
    ]);
    expect(resultsSent(test.runner)).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_a', content: 'value of a' },
    ]);
  });

  it('does nothing when not streaming', async () => {
    const { runner, timeline } = setupWithoutStreaming([reply(call('a')), done()]);

    for await (const _message of runner) {
      runner.deferToolCall('toolu_a');
      expect(runner.deferredToolCalls).toEqual([]);
      timeline.push('loop body ends');
    }

    expect(firstReply(timeline)).toEqual(['loop body ends', 'lookup(a) STARTS']);
  });
});

describe('deferredToolCalls', () => {
  const ids = (toolUses: BetaToolUseBlock[]) => toolUses.map((toolUse) => toolUse.id);

  it("lists the held calls in the model's order, with their whole input", async () => {
    const { runner } = setup([reply(call('a'), call('b'), call('c'))]);

    for await (const stream of runner) {
      // c is deferred by id before its block has streamed, and before b.
      runner.deferToolCall('toolu_c');
      stream.on('contentBlock', (block) => {
        if (block.type === 'tool_use' && block.id === 'toolu_b') runner.deferToolCall(block);
      });
      await stream.finalMessage();

      expect(runner.deferredToolCalls).toEqual([
        { type: 'tool_use', id: 'toolu_b', name: 'lookup', input: { key: 'b' } },
        { type: 'tool_use', id: 'toolu_c', name: 'lookup', input: { key: 'c' } },
      ]);
      break;
    }
  });

  it('lists a held call from when its block has finished streaming, without waiting for the reply', async () => {
    const { runner, label } = setup([reply(call('a'), call('b'))]);
    const held: string[] = [];

    for await (const stream of runner) {
      runner.deferToolCall('toolu_a');
      runner.deferToolCall('toolu_b');
      stream.on('streamEvent', (event) => {
        held.push(`${label(event)} -> [${ids(runner.deferredToolCalls)}]`);
      });
      await stream.finalMessage();
      break;
    }

    expect(held).toEqual([
      'message_start -> []',
      'a: content_block_start -> []',
      'a: content_block_delta -> []',
      'a: content_block_stop -> [toolu_a]',
      'b: content_block_start -> [toolu_a]',
      'b: content_block_delta -> [toolu_a]',
      'b: content_block_stop -> [toolu_a,toolu_b]',
      'message_delta (tool_use) -> [toolu_a,toolu_b]',
      'message_stop -> [toolu_a,toolu_b]',
    ]);
  });

  it('lists the calls that a `for await` over the stream deferred', async () => {
    const { runner } = setup([reply(call('a'), call('b'))]);

    for await (const stream of runner) {
      for await (const event of stream) {
        if (event.type === 'content_block_start' && event.index === 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, 5));
          runner.deferToolCall('toolu_b');
        }
      }

      expect(ids(runner.deferredToolCalls)).toEqual(['toolu_b']);
      break;
    }
  });

  it('leaves out a call that had started when it was deferred', async () => {
    const { runner } = setup([reply(call('a'), call('b'))]);

    for await (const stream of runner) {
      stream.on('streamEvent', (event) => {
        if (event.type !== 'content_block_delta' || event.index !== 1) return;
        runner.deferToolCall('toolu_a'); // has started
        runner.deferToolCall('toolu_b');
      });
      await stream.finalMessage();

      expect(ids(runner.deferredToolCalls)).toEqual(['toolu_b']);
      break;
    }
  });

  it('leaves out a call that is waiting for a reader and was not deferred', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b'))]);

    for await (const stream of runner) {
      stream[Symbol.asyncIterator](); // a reader that never reads
      runner.deferToolCall('toolu_b');
      await stream.finalMessage();

      expect(ids(runner.deferredToolCalls)).toEqual(['toolu_b']);
      break;
    }

    expect(timeline).toEqual([]);
  });

  it('is empty once generateToolResponse() has started the held calls', async () => {
    const { runner } = setup([reply(call('a'))]);

    for await (const stream of runner) {
      runner.deferToolCall('toolu_a');
      await stream.finalMessage();
      expect(ids(runner.deferredToolCalls)).toEqual(['toolu_a']);

      await runner.generateToolResponse();

      expect(runner.deferredToolCalls).toEqual([]);
      break;
    }
  });

  it('is empty for the next reply', async () => {
    // The second reply reuses the id of the call that was held in the first.
    const { runner } = setup([reply(call('a')), reply(call('a')), done()]);

    const held: string[][] = [];
    for await (const stream of runner) {
      if (held.length === 0) runner.deferToolCall('toolu_a');
      await stream.finalMessage();
      held.push(ids(runner.deferredToolCalls));
    }

    expect(held).toEqual([['toolu_a'], [], []]);
  });

  it('is empty before the first reply and after the run', async () => {
    const { runner } = setup([reply(call('a')), done()]);

    runner.deferToolCall('toolu_a');
    expect(runner.deferredToolCalls).toEqual([]);

    await runner.runUntilDone();

    expect(runner.deferredToolCalls).toEqual([]);
  });

  it('lists the held calls of a reply that is cut off, which generateToolResponse() still runs', async () => {
    const { runner, timeline } = setup([replyEnding('max_tokens', call('a'), call('b', '{"key": "b'))]);

    for await (const stream of runner) {
      runner.deferToolCall('toolu_a');
      runner.deferToolCall('toolu_b');
      await stream.finalMessage();

      expect(ids(runner.deferredToolCalls)).toEqual(['toolu_a', 'toolu_b']);
      expect(timeline).toEqual([]);

      await runner.generateToolResponse();
      break;
    }

    expect(timeline).toHaveLength(2);
  });
});

describe('a reply that is cut off', () => {
  it.each([
    ['a refusal that ends the reply', replyEnding('refusal', call('a'), call('b', '{"key": "b"'))],
    [
      'a refusal that hands the reply to a fallback model',
      replyEnding('end_turn', call('a'), call('b', '{"key": "b"'), fallback(), text('Here is the answer.')),
    ],
    ['max_tokens', replyEnding('max_tokens', call('a'), call('b', '{"key": "b'))],
  ])('never starts the call cut off by %s', async (_, cutOffReply) => {
    const { runner, timeline, requests } = setup([cutOffReply]);

    await runner.runUntilDone();

    expect(timeline).toEqual(['lookup(a) STARTS']);
    expect(requests).toHaveLength(1);
  });

  it('starts the calls after a fallback block once the loop body ends, in order', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b'), fallback(), call('c')), done()]);

    for await (const stream of runner) {
      await stream.finalMessage();
      timeline.push('loop body ends');
    }

    // The fallback block started while b was still waiting for the model to move on.
    expect(firstReply(timeline)).toEqual([
      'lookup(a) STARTS',
      'loop body ends',
      'lookup(b) STARTS',
      'lookup(c) STARTS',
    ]);
    expect(resultsSent(runner).map((result) => result.tool_use_id)).toEqual([
      'toolu_a',
      'toolu_b',
      'toolu_c',
    ]);
  });

  it('does not end the run while a call that has started is still running', async () => {
    // The model moves on from a before the reply stops at `max_tokens`, so a has started but gets no tool result.
    const { runner, timeline } = setup([replyEnding('max_tokens', call('a'), call('b', '{"key": "b'))], {
      lookup: slowLookup,
      logReturns: true,
    });

    await runner.runUntilDone();

    expect(timeline).toEqual(['lookup(a) STARTS', 'lookup(a) returns']);
  });

  it('starts no later call once the caller leaves the loop', async () => {
    const paused = pauseBefore(reply(call('a'), call('b')), 'b: content_block_stop');
    const { runner, timeline, requests } = setup([paused.reply]);

    for await (const _stream of runner) {
      await vi.waitFor(() => expect(timeline).toEqual(['lookup(a) STARTS']));
      break;
    }
    paused.resume();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(timeline).toEqual(['lookup(a) STARTS']);
    expect(requests).toHaveLength(1);
  });

  it('starts no later call once the caller leaves a `for await` over the stream', async () => {
    const { runner, timeline } = setup([reply(call('a'), call('b'), call('c'))]);

    const run = (async () => {
      for await (const stream of runner) {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.index === 1) break;
        }
      }
    })();

    await expect(run).rejects.toThrow(APIUserAbortError);
    expect(timeline).toEqual(['lookup(a) STARTS']);
  });

  it('passes the abort signal to a call that has started, and starts no later call once it aborts', async () => {
    const controller = new AbortController();
    const { runner, timeline, signals } = setup([reply(call('a'), call('b'), call('c'))], {
      signal: controller.signal,
    });

    const run = (async () => {
      for await (const stream of runner) {
        stream.on('streamEvent', (event) => {
          if (event.type === 'content_block_delta' && event.index === 1) controller.abort();
        });
        await stream.finalMessage();
      }
    })();

    await expect(run).rejects.toThrow(APIUserAbortError);
    expect(timeline).toEqual(['lookup(a) STARTS']);
    expect(signals[0]?.aborted).toBe(true);
  });
});

describe('a call that has started', () => {
  it('keeps its result after removeTools(), which refuses a call that has not started', async () => {
    const paused = pauseBefore(reply(call('a'), call('b')), 'b: content_block_stop');
    const { runner, timeline } = setup([paused.reply, done()]);

    const run = runner.runUntilDone();
    await vi.waitFor(() => expect(timeline).toEqual(['lookup(a) STARTS']));
    runner.removeTools('lookup');
    paused.resume();
    await run;

    expect(firstReply(timeline)).toEqual(['lookup(a) STARTS']);
    expect(resultsSent(runner)).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_a', content: 'value of a' },
      notFound('toolu_b'),
    ]);
  });

  it('keeps its result after addTools() replaces its tool, which runs a call that has not started', async () => {
    const paused = pauseBefore(reply(call('a'), call('b')), 'b: content_block_stop');
    const { runner, timeline } = setup([paused.reply, done()]);
    const replacement: BetaRunnableTool<{ key: string }> = {
      type: 'custom',
      name: 'lookup',
      description: 'Look up a key',
      input_schema: { type: 'object', properties: { key: { type: 'string' } } },
      run: async ({ key }) => `new value of ${key}`,
      parse: (input: unknown) => input as { key: string },
    };

    const run = runner.runUntilDone();
    await vi.waitFor(() => expect(timeline).toEqual(['lookup(a) STARTS']));
    runner.addTools(replacement);
    paused.resume();
    await run;

    expect(resultsSent(runner)).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_a', content: 'value of a' },
      { type: 'tool_result', tool_use_id: 'toolu_b', content: 'new value of b' },
    ]);
  });

  it('gets a "not found" result for a tool removed earlier in the conversation', async () => {
    const { runner, timeline } = setup([reply(call('a'), text('Looking.')), done()], {
      messages: [
        { role: 'user', content: 'Look this up.' },
        {
          role: 'system',
          content: [{ type: 'tool_removal', tool: { type: 'tool_reference', name: 'lookup' } }],
        },
      ],
    });

    await runner.runUntilDone();

    expect(firstReply(timeline)).toEqual([]);
    expect(resultsSent(runner)).toEqual([notFound('toolu_a')]);
  });

  it('does not answer a later reply that reuses its id', async () => {
    // The second reply's call comes after a fallback block, so it starts after the loop body.
    const { runner, requests } = setup([
      reply(call('a')),
      reply(fallback(), call('a', JSON.stringify({ key: 'again' }))),
      done(),
    ]);

    await runner.runUntilDone();

    expect(toolResults(requests[2]!.body.messages.at(-1)).map((result) => result.content)).toEqual([
      'value of again',
    ]);
  });

  it('finishes before the next request when the caller takes over the reply', async () => {
    // After pushMessages() the runner sends the caller's history, not this reply's results.
    const { runner, timeline } = setup([reply(call('a'), text('Looking.')), done()], {
      lookup: slowLookup,
      logReturns: true,
    });

    let replies = 0;
    for await (const stream of runner) {
      await stream.finalMessage();
      if (replies++ === 0) runner.pushMessages({ role: 'user', content: 'Never mind.' });
    }

    expect(timeline).toEqual(['lookup(a) STARTS', 'lookup(a) returns', 'request 2']);
  });

  it('does not run again when a `for await` that is behind reaches it after the loop body', async () => {
    // The reader is still reading when the loop body ends, so the runner starts the calls itself. The reader
    // gets to them while they run.
    const { runner, timeline } = setup([reply(call('a'), call('b')), done()], { lookup: slowLookup });

    let reading: Promise<void> | undefined;
    for await (const stream of runner) {
      reading ??= (async () => {
        for await (const _event of stream) {
          await new Promise<void>((resolve) => setTimeout(resolve, 1));
        }
      })().catch(() => {});
      await stream.finalMessage();
      timeline.push('loop body ends');
    }
    await reading;

    expect(firstReply(timeline)).toEqual(['loop body ends', 'lookup(a) STARTS', 'lookup(b) STARTS']);
  });

  it('runs again after setMessagesParams() when not streaming, as before', async () => {
    const { runner, timeline } = setupWithoutStreaming([reply(call('a'))]);

    for await (const _message of runner) {
      await runner.generateToolResponse();
      runner.setMessagesParams((params) => ({ ...params, max_tokens: 2048 }));
      await runner.generateToolResponse();
      break;
    }

    expect(timeline).toEqual(['lookup(a) STARTS', 'lookup(a) STARTS']);
  });

  it('only fails the run if its result is sent, when it fails without an error result', async () => {
    // A value that String() can't convert makes the call reject instead of giving an error result.
    const lookup = async () => {
      throw Object.create(null);
    };
    const cutOff = setup([replyEnding('max_tokens', call('a'), text('Looking.'))], { lookup });
    const answered = setup([reply(call('a'), text('Looking.'))], { lookup });

    await expect(cutOff.runner.runUntilDone()).resolves.toMatchObject({ stop_reason: 'max_tokens' });
    await expect(answered.runner.runUntilDone()).rejects.toThrow(TypeError);
    expect(cutOff.timeline).toEqual(['lookup(a) STARTS']);
    expect(answered.timeline).toEqual(['lookup(a) STARTS']);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------------------

type StreamEvent = BetaRawMessageStreamEvent;

/** One content block of a canned reply. */
type Block =
  | { type: 'tool_use'; key: string; json: string }
  | { type: 'text'; text: string }
  | { type: 'fallback' };

type Reply = { blocks: Block[]; stopReason: BetaStopReason };

/** The model calls `lookup({ key })` with the id `toolu_<key>`. `json` is the input as sent, which may be cut off. */
function call(key: string, json = JSON.stringify({ key })): Block {
  return { type: 'tool_use', key, json };
}

function text(value: string): Block {
  return { type: 'text', text: value };
}

/** The block a refusal starts when it hands the reply to a fallback model. */
function fallback(): Block {
  return { type: 'fallback' };
}

/** A reply that asks for tool results. */
function reply(...blocks: Block[]): Reply {
  return { blocks, stopReason: 'tool_use' };
}

/** A reply that ends for another reason. */
function replyEnding(stopReason: BetaStopReason, ...blocks: Block[]): Reply {
  return { blocks, stopReason };
}

/** The reply that ends the conversation. */
function done(): Reply {
  return replyEnding('end_turn', text('Done.'));
}

/** How a `for await` over the stream handles each event: at once, or too slowly to keep up with the reply. */
function readers(): Array<[string, () => Promise<void>]> {
  return [
    ['keeps up with the reply', async () => {}],
    ['is behind the reply', () => new Promise<void>((resolve) => setTimeout(resolve, 1))],
  ];
}

function slowLookup(key: string): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve(`value of ${key}`), 20));
}

/** The reply as the caller appends it to the history. The cast is needed until the request and response types agree. */
function assistantTurn(message: BetaMessage): BetaMessageParam {
  return { role: message.role, content: message.content as BetaMessageParam['content'] };
}

function notFound(id: string): BetaToolResultBlockParam {
  return { type: 'tool_result', tool_use_id: id, content: "Error: Tool 'lookup' not found", is_error: true };
}

/** The timeline up to the second request, which is everything about the first reply. */
function firstReply(timeline: string[]): string[] {
  const end = timeline.indexOf('request 2');
  return end === -1 ? timeline : timeline.slice(0, end);
}

function toolResults(message: BetaMessageParam | null | undefined): BetaToolResultBlockParam[] {
  if (!message || typeof message.content === 'string') return [];
  return message.content.filter((block): block is BetaToolResultBlockParam => block.type === 'tool_result');
}

/** The tool results the runner sent back for the first reply. */
function resultsSent(runner: { params: { messages: BetaMessageParam[] } }): BetaToolResultBlockParam[] {
  return toolResults(runner.params.messages.find((message) => toolResults(message).length > 0));
}

/** Names each stream event after the block it belongs to, such as `a: content_block_stop`. */
function eventLabeler(): (event: StreamEvent) => string {
  const blocks: string[] = [];
  return (event) => {
    switch (event.type) {
      case 'content_block_start': {
        const block = event.content_block;
        blocks[event.index] = block.type === 'tool_use' ? block.id.replace('toolu_', '') : block.type;
        return `${blocks[event.index]}: ${event.type}`;
      }
      case 'content_block_delta':
      case 'content_block_stop':
        return `${blocks[event.index]}: ${event.type}`;
      case 'message_delta':
        return `message_delta (${event.delta.stop_reason})`;
      default:
        return event.type;
    }
  };
}

function emptyMessage(): BetaMessage {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    content: [],
    model: 'claude-haiku-4-5',
    stop_details: null,
    stop_reason: null,
    stop_sequence: null,
    container: null,
    context_management: null,
    diagnostics: null,
    usage: {
      input_tokens: 10,
      output_tokens: 0,
      output_tokens_details: null,
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      fallback_credit: null,
      server_tool_use: null,
      service_tier: null,
      inference_geo: null,
      iterations: null,
      speed: null,
    },
  };
}

/** The reply as the stream events the API sends for it. */
function toEvents({ blocks, stopReason }: Reply): StreamEvent[] {
  const events: StreamEvent[] = [{ type: 'message_start', message: emptyMessage() }];
  blocks.forEach((block, index) => {
    if (block.type === 'tool_use') {
      const start = { type: 'tool_use' as const, id: `toolu_${block.key}`, name: 'lookup', input: {} };
      events.push({ type: 'content_block_start', index, content_block: start });
      events.push({
        type: 'content_block_delta',
        index,
        delta: { type: 'input_json_delta', partial_json: block.json },
      });
    } else if (block.type === 'text') {
      events.push({
        type: 'content_block_start',
        index,
        content_block: { type: 'text', text: '', citations: null },
      });
      events.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } });
    } else {
      events.push({
        type: 'content_block_start',
        index,
        content_block: {
          type: 'fallback',
          from: { model: 'claude-haiku-4-5' },
          to: { model: 'claude-opus-4-8' },
          trigger: { type: 'refusal', category: null },
        },
      });
    }
    events.push({ type: 'content_block_stop', index });
  });
  events.push({
    type: 'message_delta',
    delta: { stop_details: null, stop_reason: stopReason, container: null, stop_sequence: null },
    context_management: null,
    usage: {
      output_tokens: 20,
      output_tokens_details: null,
      input_tokens: 10,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      fallback_credit: null,
      server_tool_use: null,
      iterations: null,
    },
  });
  events.push({ type: 'message_stop' });
  return events;
}

/** The reply as the message the API sends for it when not streaming. */
function toMessage({ blocks, stopReason }: Reply): BetaMessage {
  const content = blocks.flatMap((block): BetaMessage['content'] => {
    if (block.type === 'tool_use') {
      return [{ type: 'tool_use', id: `toolu_${block.key}`, name: 'lookup', input: JSON.parse(block.json) }];
    }
    return block.type === 'text' ? [{ type: 'text', text: block.text, citations: null }] : [];
  });
  return { ...emptyMessage(), content, stop_reason: stopReason };
}

/** Sends the reply up to the event named `label`, and the rest after `resume()`, as a server still generating would. */
function pauseBefore(pausedReply: Reply, label: string) {
  const events = toEvents(pausedReply);
  const labelOf = eventLabeler();
  const at = events.map(labelOf).indexOf(label);
  if (at === -1) throw new Error(`The reply has no event ${label}`);

  let resume = () => {};
  const resumed = new Promise<void>((resolve) => (resume = resolve));
  async function* stream(): AsyncGenerator<StreamEvent> {
    yield* events.slice(0, at);
    await resumed;
    yield* events.slice(at);
  }
  return { reply: stream(), resume };
}

type CannedReply = Reply | AsyncIterable<StreamEvent> | Response;

type Options = {
  signal?: AbortSignal;
  /** What `lookup` does once it has started. It returns `value of <key>` by default. */
  lookup?: (key: string) => Promise<string>;
  /** Whether the timeline also gets `lookup(<key>) returns`. */
  logReturns?: boolean;
  messages?: BetaMessageParam[];
};

/**
 * A client whose requests are answered by `replies`, in order, and a `lookup` tool that writes to `timeline`
 * when it starts. A `Reply` arrives in one piece, so the runner has read all of it before a `for await` over
 * the stream gets its first event.
 */
function fixture(replies: CannedReply[], stream: boolean, options: Options) {
  const { handleRequest, fetch } = mockFetch();
  const timeline: string[] = [];
  const requests: Array<{ body: any; headers: Headers }> = [];
  const signals: Array<AbortSignal | null | undefined> = [];
  const sse = (event: StreamEvent) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

  for (const canned of replies) {
    handleRequest(async (_request, init) => {
      requests.push({ body: JSON.parse(init!.body as string), headers: new Headers(init!.headers) });
      if (requests.length > 1) timeline.push(`request ${requests.length}`);

      if (canned instanceof Response) return canned;
      if (!stream) return Response.json(toMessage(canned as Reply));
      if ('blocks' in canned) {
        return new Response(toEvents(canned).map(sse).join(''), {
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      const events = canned[Symbol.asyncIterator]();
      const body = new ReadableStream({
        start(controller) {
          // As with a real fetch, aborting the request errors its body.
          const abort = () => controller.error(new DOMException('The user aborted a request.', 'AbortError'));
          init?.signal?.addEventListener('abort', abort, { once: true });
        },
        async pull(controller) {
          const next = await events.next();
          if (next.done) controller.close();
          else controller.enqueue(new TextEncoder().encode(sse(next.value)));
        },
      });
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
    });
  }

  const lookup: BetaRunnableTool<{ key: string }> = {
    type: 'custom',
    name: 'lookup',
    description: 'Look up a key',
    input_schema: { type: 'object', properties: { key: { type: 'string' } } },
    run: async ({ key }, context) => {
      timeline.push(`lookup(${key}) STARTS`);
      signals.push(context?.signal);
      const value = await (options.lookup ?? (async () => `value of ${key}`))(key);
      if (options.logReturns) timeline.push(`lookup(${key}) returns`);
      return value;
    },
    parse: (input: unknown) => input as { key: string },
  };

  const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });
  const params = {
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: options.messages ?? [{ role: 'user' as const, content: 'Look these up.' }],
    tools: [lookup],
  };
  const requestOptions = options.signal ? { signal: options.signal } : undefined;
  const labelOf = eventLabeler();

  return {
    client,
    params,
    requestOptions,
    timeline,
    requests,
    signals,
    /** Names a stream event after the block it belongs to, such as `a: content_block_stop`. */
    label: labelOf,
    /** Adds a stream event to the timeline, as the caller saw it. */
    see: (event: StreamEvent) => void timeline.push(labelOf(event)),
  };
}

/** A streaming runner that starts tool calls while the reply streams. */
function setup(replies: CannedReply[], options: Options = {}) {
  const { client, params, requestOptions, ...rest } = fixture(replies, true, options);
  const runner = client.beta.messages.toolRunner(
    { ...params, stream: true, runToolsEagerly: true },
    requestOptions,
  );
  return { runner, ...rest };
}

/** A streaming runner as it is by default, without `runToolsEagerly`. */
function setupWithoutOption(replies: CannedReply[], options: Options = {}) {
  const { client, params, requestOptions, ...rest } = fixture(replies, true, options);
  return { runner: client.beta.messages.toolRunner({ ...params, stream: true }, requestOptions), ...rest };
}

function setupWithoutStreaming(replies: Reply[], options: Options = {}) {
  const { client, params, requestOptions, ...rest } = fixture(replies, false, options);
  return { runner: client.beta.messages.toolRunner(params, requestOptions), ...rest };
}
