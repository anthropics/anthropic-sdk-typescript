import Anthropic, { AnthropicError, APIUserAbortError } from '@anthropic-ai/sdk';
import { toolUse } from './toolsets/fakes';
import { setupRunner } from './toolsets/runner-helpers';
import { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta';
import { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import {
  BetaRunnableToolset,
  ToolsetContractError,
  ToolsetUsageError,
  ToolsetClosedError,
  type BetaToolsetContent,
} from '@anthropic-ai/sdk/lib/tools/BetaRunnableToolset';
import { isRunnableToolset, TOOLSET_TYPE_TO_FAMILY } from '@anthropic-ai/sdk/lib/internal/toolsets/family';
import { runToolsetMember, NOT_EXECUTED } from '@anthropic-ai/sdk/lib/internal/toolsets/run';
import type { BetaToolRunContext } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { ToolError } from '@anthropic-ai/sdk/resources/beta/messages';
import { ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';

const BROWSER_ENTRY = {
  type: 'browser_toolset_20260801',
  configs: { javascript_exec: { enabled: true } },
} as const;

/** Records calls, echoes member + input, and raises on `boom` / `crash` / `misuse`. */
function echoBrowserToolset() {
  const calls: Array<[string, unknown]> = [];
  const contexts: BetaToolRunContext[] = [];
  let closed = 0;
  const toolset: BetaRunnableToolset = {
    ...BROWSER_ENTRY,
    run: (ctx, toolUse) => {
      calls.push([toolUse.name, toolUse.input]);
      contexts.push(ctx);
      if (toolUse.name === 'boom') {
        throw new ToolError([
          { type: 'text', text: 'member refused' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
        ]);
      }
      if (toolUse.name === 'blank') throw new ToolError([{ type: 'text', text: '' }]); // an empty text block only
      if (toolUse.name === 'crash') throw new Error('backend exploded');
      if (toolUse.name === 'misuse') throw new ToolsetContractError('misused the SDK surface');
      return [{ type: 'text', text: `${toolUse.name}:${JSON.stringify(toolUse.input)}` }];
    },
    close: () => {
      closed += 1;
    },
  };
  return { toolset, calls, contexts, closedCount: () => closed };
}

/** A custom tool that shares a browser member's name. */
const customNavigate: BetaRunnableTool<{ url: string }> = {
  type: 'custom',
  name: 'navigate',
  description: 'custom navigate',
  input_schema: { type: 'object', properties: { url: { type: 'string' } } },
  run: async ({ url }) => `custom:${url}`,
  parse: (input: unknown) => input as { url: string },
};

/** A function tool's `tool_use` (no `toolset_name`). */
function functionToolUse(name: string, id: string, input: Record<string, unknown> = {}): BetaContentBlock {
  return { type: 'tool_use', id, name, input };
}

/** The tool_result message the runner appended. */
function toolResults(runner: Anthropic.Beta.Messages.BetaToolRunner<boolean>) {
  return runner.params.messages.find(
    (m) => m.role === 'user' && Array.isArray(m.content) && m.content[0]?.type === 'tool_result',
  );
}

describe('BetaRunnableToolset', () => {
  it('isRunnableToolset / TOOLSET_TYPE_TO_FAMILY', () => {
    const { toolset } = echoBrowserToolset();
    expect(isRunnableToolset(toolset)).toBe(true);
    expect(isRunnableToolset(BROWSER_ENTRY)).toBe(false); // raw entry, no run
    expect(isRunnableToolset(customNavigate)).toBe(false);
    expect(TOOLSET_TYPE_TO_FAMILY).toEqual({
      browser_toolset_20260801: 'browser',
      computer_toolset_20260801: 'computer',
    });
  });

  it('serializes to exactly the nameless wire entry', () => {
    const { toolset } = echoBrowserToolset();
    expect(JSON.parse(JSON.stringify(toolset))).toEqual(BROWSER_ENTRY);
  });

  describe('runToolsetMember (raw loop)', () => {
    it('echoes toolset_name on success', async () => {
      const { toolset, calls } = echoBrowserToolset();
      await expect(runToolsetMember(toolset, toolUse('navigate', { url: 'u' }, 'toolu_1'))).resolves.toEqual({
        type: 'tool_result',
        tool_use_id: 'toolu_1',
        toolset_name: 'browser',
        content: [{ type: 'text', text: 'navigate:{"url":"u"}' }],
      });
      expect(calls).toEqual([['navigate', { url: 'u' }]]);
    });

    it('maps ToolError (text blocks only) and other errors like the runner; a developer error propagates', async () => {
      const { toolset } = echoBrowserToolset();
      await expect(runToolsetMember(toolset, toolUse('misuse', {}, 'toolu_0'))).rejects.toThrow(
        ToolsetUsageError,
      );
      await expect(runToolsetMember(toolset, toolUse('boom', {}, 'toolu_2'))).resolves.toEqual({
        type: 'tool_result',
        tool_use_id: 'toolu_2',
        toolset_name: 'browser',
        content: [{ type: 'text', text: 'member refused' }],
        is_error: true,
      });
      // a lone surrogate in a refusal's text (page text the member quoted) becomes U+FFFD so it can be sent
      const refusing = (content: string | BetaToolsetContent): BetaRunnableToolset => ({
        ...BROWSER_ENTRY,
        run: () => {
          throw new ToolError(content);
        },
      });
      await expect(
        runToolsetMember(refusing('bad\ud800'), toolUse('quote', {}, 'toolu_q')),
      ).resolves.toMatchObject({ content: 'bad\ufffd', is_error: true });
      await expect(
        runToolsetMember(refusing([{ type: 'text', text: 'bad\udc00' }]), toolUse('quote', {}, 'toolu_q')),
      ).resolves.toMatchObject({ content: [{ type: 'text', text: 'bad\ufffd' }], is_error: true });
      // an is_error result may carry neither non-text nor empty content: the empty block goes, the placeholder stands in
      await expect(runToolsetMember(toolset, toolUse('blank', {}, 'toolu_2b'))).resolves.toMatchObject({
        content: 'The tool call failed with an empty error message.',
        is_error: true,
      });
      await expect(runToolsetMember(toolset, toolUse('crash', {}, 'toolu_3'))).resolves.toEqual({
        type: 'tool_result',
        tool_use_id: 'toolu_3',
        toolset_name: 'browser',
        content: 'Error: backend exploded',
        is_error: true,
      });
    });

    it('a run aborted while a member is in flight rejects with APIUserAbortError', async () => {
      // The error an aborted request throws, not the raw AbortError the driver threw: one catch covers both.
      const aborting = (controller: AbortController): BetaRunnableToolset => ({
        ...BROWSER_ENTRY,
        run: (ctx) => {
          controller.abort();
          ctx.signal?.throwIfAborted(); // a driver that honours the signal throws a DOMException
          return [];
        },
      });
      const controller = new AbortController();
      const direct = await runToolsetMember(aborting(controller), toolUse('navigate', {}, 'toolu_ab'), {
        signal: controller.signal,
      }).catch((e: unknown) => e);
      expect(direct).toBeInstanceOf(APIUserAbortError);
      expect(direct).toBeInstanceOf(AnthropicError);

      const viaRunner = new AbortController();
      const { runner, respondWith } = setupRunner([aborting(viaRunner)], { signal: viaRunner.signal });
      respondWith(toolUse('navigate', {}, 'toolu_ab2'));
      await expect(runner.runUntilDone()).rejects.toBeInstanceOf(APIUserAbortError);
    });

    it('accepts the GA ToolUseBlock and forwards the signal', async () => {
      const controller = new AbortController();
      let seen: AbortSignal | null | undefined;
      const toolset: BetaRunnableToolset = {
        ...BROWSER_ENTRY,
        run: (ctx) => ((seen = ctx.signal), [{ type: 'text', text: 'ok' }]),
        close: () => {},
      };
      const gaBlock: ToolUseBlock = {
        type: 'tool_use',
        id: 'toolu_ga',
        name: 'screenshot',
        input: {},
        toolset_name: 'browser',
        caller: { type: 'direct' },
      };
      await expect(runToolsetMember(toolset, gaBlock, { signal: controller.signal })).resolves.toEqual({
        type: 'tool_result',
        tool_use_id: 'toolu_ga',
        toolset_name: 'browser',
        content: [{ type: 'text', text: 'ok' }],
      });
      expect(seen).toBe(controller.signal);
    });

    it('rejects a block of another family or without toolset_name', async () => {
      const { toolset, calls } = echoBrowserToolset();
      await expect(
        runToolsetMember(toolset, { ...toolUse('navigate', {}, 'toolu_4'), toolset_name: 'computer' }),
      ).rejects.toThrow('is not a member call of the "browser" toolset');
      await expect(
        runToolsetMember(toolset, { type: 'tool_use', id: 'toolu_5', name: 'navigate', input: {} }),
      ).rejects.toThrow(ToolsetContractError); // a routing mistake, catchable like every other misuse
      expect(calls).toEqual([]);
    });
  });

  describe('toolRunner routing', () => {
    it('routes a member call by family and a same-named custom tool by name', async () => {
      const { toolset, calls } = echoBrowserToolset();
      const { runner, respondWith, requests } = setupRunner([toolset, customNavigate]);
      respondWith(
        toolUse('navigate', { url: 'https://example.com' }, 'toolu_member'),
        functionToolUse('navigate', 'toolu_custom', { url: 'https://custom.test' }),
      );
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();

      expect(calls).toEqual([['navigate', { url: 'https://example.com' }]]);
      expect(toolResults(runner)).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_member',
            toolset_name: 'browser',
            content: [{ type: 'text', text: 'navigate:{"url":"https://example.com"}' }],
          },
          { type: 'tool_result', tool_use_id: 'toolu_custom', content: 'custom:https://custom.test' },
        ],
      });
      // Wire golden: the toolset goes out as its nameless entry; nothing SDK-side leaks.
      expect(requests[0]!.body.tools[0]).toEqual(BROWSER_ENTRY);
      expect(requests[0]!.body.tools[1].name).toBe('navigate');
      expect(requests[0]!.body.tools).toHaveLength(2);
    });

    it('answers an unregistered family with an is_error result carrying toolset_name', async () => {
      const { toolset, calls } = echoBrowserToolset();
      let screenshotCalled = false;
      const customScreenshot: BetaRunnableTool<{}> = {
        type: 'custom',
        name: 'screenshot',
        input_schema: { type: 'object', properties: {} },
        run: async () => {
          screenshotCalled = true;
          return 'custom';
        },
        parse: (input: unknown) => input as {},
      };
      const { runner, respondWith } = setupRunner([toolset, customScreenshot]);
      respondWith(
        { ...toolUse('screenshot', {}, 'toolu_cu'), toolset_name: 'computer' },
        { ...toolUse('left_click', {}, 'toolu_cu2'), toolset_name: 'computer' },
      );
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();

      expect(calls).toEqual([]);
      expect(screenshotCalled).toBe(false);
      // every call of the family is not found: none ran, so none is reported as skipped after a failure
      expect(toolResults(runner)).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_cu',
            toolset_name: 'computer',
            content: "Error: Toolset 'computer' member 'screenshot' not found",
            is_error: true,
          },
          {
            type: 'tool_result',
            tool_use_id: 'toolu_cu2',
            toolset_name: 'computer',
            content: "Error: Toolset 'computer' member 'left_click' not found",
            is_error: true,
          },
        ],
      });
    });

    it('folds the model-supplied names before they reach the not-found result', async () => {
      // Both names are model output: a line break, escape or bidi override in one must not forge the error text, and
      // neither may run to any length.
      const { toolset } = echoBrowserToolset();
      const { runner, respondWith } = setupRunner([toolset]);
      respondWith({
        ...toolUse('scr\u202eeen', {}, 'toolu_cu'),
        toolset_name: 'comp\nuter\x1b[2J' + 'x'.repeat(500),
      });
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();
      const content = String((toolResults(runner) as any).content[0].content);
      expect(content.startsWith("Error: Toolset 'comp uter [2J" + 'x'.repeat(20))).toBe(true);
      expect(content).not.toMatch(/[\n\x1b\u202e]/);
      expect(content.length).toBeLessThan(500);
    });

    it('answers a family-named block without toolset_name with the toolset error, a type-named one as unknown', async () => {
      // Only `toolset_name` marks a member call, so none of them runs. The `'name' in tool` guard keeps a toolset
      // from ever being matched by its `type`.
      const { toolset, calls } = echoBrowserToolset();
      const { runner, respondWith } = setupRunner([toolset]);
      respondWith(
        functionToolUse('browser', 'toolu_family'),
        functionToolUse('browser_toolset_20260801', 'toolu_type'),
        functionToolUse('computer', 'toolu_other_family'),
      );
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();

      expect(calls).toEqual([]);
      expect(toolResults(runner)).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_family',
            content:
              "Error: the 'browser' toolset could not run this call: the call has no 'actions' list; nothing in the batch was executed",
            is_error: true,
          },
          {
            type: 'tool_result',
            tool_use_id: 'toolu_type',
            content: "Error: Tool 'browser_toolset_20260801' not found",
            is_error: true,
          },
          {
            // No computer toolset is in this run, so the name is unknown.
            type: 'tool_result',
            tool_use_id: 'toolu_other_family',
            content: "Error: Tool 'computer' not found",
            is_error: true,
          },
        ],
      });
    });

    it('a raw toolset entry without run is not dispatched', async () => {
      const { runner, respondWith } = setupRunner([BROWSER_ENTRY]);
      respondWith(toolUse('navigate', {}, 'toolu_raw'));
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();

      expect(toolResults(runner)).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_raw',
            toolset_name: 'browser',
            content: "Error: Toolset 'browser' member 'navigate' not found",
            is_error: true,
          },
        ],
      });
    });

    it('member errors carry toolset_name', async () => {
      const { toolset } = echoBrowserToolset();
      const { runner, respondWith } = setupRunner([toolset]);
      respondWith(toolUse('boom', {}, 'toolu_boom'));
      respondWith(toolUse('crash', {}, 'toolu_crash'));
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();

      const results = runner.params.messages
        .filter((m) => m.role === 'user' && Array.isArray(m.content) && m.content[0]?.type === 'tool_result')
        .map((m) => m.content);
      expect(results).toEqual([
        [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_boom',
            toolset_name: 'browser',
            content: [{ type: 'text', text: 'member refused' }],
            is_error: true,
          },
        ],
        [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_crash',
            toolset_name: 'browser',
            content: 'Error: backend exploded',
            is_error: true,
          },
        ],
      ]);
    });

    it("a failed member stops the rest of the turn's members, in order, but not function tools", async () => {
      // Three browser actions in one turn, the second fails: the third is not run and says so. A function tool in
      // the same turn runs regardless, before or after the failure, and a failed function tool stops nothing.
      const { toolset, calls } = echoBrowserToolset();
      const { runner, respondWith } = setupRunner([toolset, customNavigate]);
      respondWith(
        toolUse('navigate', { url: 'a' }, 'toolu_1'),
        functionToolUse('navigate', 'toolu_fn1', { url: 'f1' }),
        toolUse('boom', {}, 'toolu_2'),
        toolUse('navigate', { url: 'c' }, 'toolu_3'),
        functionToolUse('navigate', 'toolu_fn2', { url: 'f2' }),
      );
      respondWith(functionToolUse('nope', 'toolu_fn3'), toolUse('navigate', { url: 'd' }, 'toolu_4'));
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();
      const turns = runner.params.messages
        .filter((m) => m.role === 'user' && Array.isArray(m.content) && m.content[0]?.type === 'tool_result')
        .map((m) =>
          Object.fromEntries(
            (m.content as any[]).map((r) => [r.tool_use_id, [r.is_error ?? false, r.content]]),
          ),
        );
      expect(turns[0]!['toolu_1']).toEqual([false, [{ type: 'text', text: 'navigate:{"url":"a"}' }]]);
      expect(turns[0]!['toolu_2']![0]).toBe(true);
      expect(turns[0]!['toolu_3']).toEqual([true, NOT_EXECUTED]);
      expect(turns[0]!['toolu_fn1']![0]).toBe(false);
      expect(turns[0]!['toolu_fn2']![0]).toBe(false);
      expect(calls.map(([, input]) => input)).toEqual([{ url: 'a' }, {}, { url: 'd' }]); // toolu_3 never ran
      expect(turns[1]!['toolu_fn3']![0]).toBe(true);
      expect(turns[1]!['toolu_4']![0]).toBe(false);
    });

    it('a usage error from one member stops the rest of the turn too; the run throws it', async () => {
      const { toolset, calls } = echoBrowserToolset();
      const { runner, respondWith } = setupRunner([toolset]);
      respondWith(toolUse('misuse', {}, 'toolu_1'), toolUse('navigate', { url: 'never' }, 'toolu_2'));
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await expect(runner.runUntilDone()).rejects.toThrow(ToolsetUsageError);
      // a member the runner had gone on to dispatch would reach the driver before one sent now does
      await runToolsetMember(toolset, toolUse('navigate', { url: 'probe' }, 'toolu_probe'));
      expect(calls).toEqual([
        ['misuse', {}],
        ['navigate', { url: 'probe' }],
      ]); // toolu_2 never reached the driver
    });

    it("runs a toolset's members one at a time in the order the model wrote them", async () => {
      let inFlight = 0;
      let peak = 0;
      const order: string[] = [];
      const toolset: BetaRunnableToolset = {
        ...BROWSER_ENTRY,
        run: async (_ctx, use) => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((r) => setTimeout(r, use.id === 'toolu_a' ? 30 : 1));
          order.push(use.id);
          inFlight -= 1;
          return [{ type: 'text', text: 'ok' }];
        },
        close: () => undefined,
      };
      const { runner, respondWith } = setupRunner([toolset]);
      respondWith(
        toolUse('navigate', {}, 'toolu_a'),
        toolUse('navigate', {}, 'toolu_b'),
        toolUse('navigate', {}, 'toolu_c'),
      );
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();
      expect(order).toEqual(['toolu_a', 'toolu_b', 'toolu_c']);
      expect(peak).toBe(1);
    });

    it('tool_removal of a member name withdraws the custom tool, not the toolset', async () => {
      const { toolset, calls } = echoBrowserToolset();
      const { runner, respondWith } = setupRunner([toolset, customNavigate], {
        messages: [
          { role: 'user', content: 'Open example.com' },
          {
            role: 'system',
            content: [{ type: 'tool_removal', tool: { type: 'tool_reference', name: 'navigate' } }],
          },
        ],
      });
      respondWith(
        toolUse('navigate', { url: 'u' }, 'toolu_member'),
        functionToolUse('navigate', 'toolu_custom', { url: 'u' }),
      );
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();

      expect(calls).toEqual([['navigate', { url: 'u' }]]);
      expect(toolResults(runner)).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_member',
            toolset_name: 'browser',
            content: [{ type: 'text', text: 'navigate:{"url":"u"}' }],
          },
          {
            type: 'tool_result',
            tool_use_id: 'toolu_custom',
            content: "Error: Tool 'navigate' not found",
            is_error: true,
          },
        ],
      });
    });

    it('passes the tool_use as context and never closes the toolset', async () => {
      // Whoever created the browser closes it: the runner leaves the toolset open on success, on a usage error and
      // when the caller abandons the iteration, and one instance can serve a second run.
      const { toolset, contexts, calls, closedCount } = echoBrowserToolset();
      const first = setupRunner([toolset]);
      first.respondWith(toolUse('navigate', { url: 'u' }, 'toolu_ctx'));
      first.respondWith({ type: 'text', text: 'Done.', citations: null });
      await first.runner.runUntilDone();
      expect(contexts[0]?.toolUse.id).toBe('toolu_ctx');
      const second = setupRunner([toolset]);
      second.respondWith(toolUse('misuse', {}, 'toolu_misuse'));
      second.respondWith({ type: 'text', text: 'Done.', citations: null });
      await expect(second.runner.runUntilDone()).rejects.toThrow(ToolsetUsageError);
      const third = setupRunner([toolset]);
      third.respondWith(toolUse('navigate', { url: 'v' }, 'toolu_1'));
      third.respondWith({ type: 'text', text: 'Done.', citations: null });
      for await (const _message of third.runner) {
        break;
      }
      const fourth = setupRunner([toolset]);
      fourth.respondWith(toolUse('navigate', { url: 'w' }, 'toolu_2'));
      fourth.respondWith({ type: 'text', text: 'Done.', citations: null });
      await fourth.runner.runUntilDone();
      expect(calls.filter(([name]) => name === 'navigate').map(([, input]) => input)).toEqual([
        { url: 'u' },
        { url: 'w' },
      ]);
      expect(closedCount()).toBe(0);
    });

    it("a closed toolset's ToolsetClosedError reaches your code, not the model", async () => {
      const { toolset: open } = echoBrowserToolset();
      // a closed toolset: its run() throws ToolsetClosedError
      const toolset: BetaRunnableToolset = {
        ...open,
        run: () => {
          throw new ToolsetClosedError("this 'browser' toolset is closed");
        },
      };
      await expect(
        runToolsetMember(toolset, toolUse('navigate', { url: 'u' }, 'toolu_late')),
      ).rejects.toThrow(/is closed/);
      // through the runner the same member call surfaces that error at your code rather than as a tool result
      const { runner, respondWith } = setupRunner([toolset]);
      respondWith(toolUse('navigate', { url: 'u' }, 'toolu_late2'));
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await expect(runner.runUntilDone()).rejects.toThrow(/is closed/);
    });

    it('a plain tool does not carry the browser-toolset helper tag', async () => {
      // (the positive half — a real browser toolset names itself in the header — is pipeline.test.ts's)
      const helperTags = (headers: Headers) => (headers.get('x-stainless-helper') ?? '').split(', ');
      const plain = setupRunner([customNavigate]);
      plain.respondWith({ type: 'text', text: 'Done.', citations: null });
      await plain.runner.runUntilDone();
      expect(helperTags(plain.requests[0]!.headers)).not.toContain('browser-toolset');
    });

    it('setMessagesParams can swap the toolset: the new one is sent, and its calls run on it', async () => {
      const { toolset, calls } = echoBrowserToolset();
      const other = echoBrowserToolset();
      const { runner, respondWith, requests } = setupRunner([toolset]);
      respondWith(toolUse('navigate', { url: 'a' }, 'toolu_1'));
      respondWith(
        toolUse('navigate', { url: 'b' }, 'toolu_2'),
        functionToolUse('navigate', 'toolu_fn', { url: 'f' }),
      );
      respondWith({ type: 'text', text: 'Done.', citations: null });
      let turns = 0;
      for await (const _ of runner) {
        turns += 1;
        await runner.generateToolResponse();
        if (turns === 1) {
          runner.setMessagesParams((p) => ({ ...p, tools: [other.toolset, customNavigate] }));
        }
      }
      expect(requests.map(({ body }) => body.tools.length)).toEqual([1, 2, 2]);
      expect(requests.map(({ body }) => body.tools[0].type)).toEqual(Array(3).fill(BROWSER_ENTRY.type));
      // the first turn's call ran on the toolset the runner was created with, the second on the one that replaced it
      expect(calls.map(([, input]) => input)).toEqual([{ url: 'a' }]);
      expect(other.calls.map(([, input]) => input)).toEqual([{ url: 'b' }]);
    });

    it('addTools() refuses a toolset, even alongside a function tool, and queues nothing', async () => {
      const { toolset } = echoBrowserToolset();
      const { runner, respondWith, requests } = setupRunner([toolset]);
      const other = echoBrowserToolset().toolset;
      expect(() => runner.addTools(customNavigate, other)).toThrow(ToolsetContractError);
      expect(() => runner.addTools(customNavigate, other)).toThrow(
        "addTools() can't add the 'browser' toolset: a tool runner's toolsets come only from its tools param; change them with setMessagesParams(), or build a new runner",
      );
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();
      expect(requests[0]!.body.messages.filter((m: { role: string }) => m.role === 'system')).toEqual([]);
    });

    it('addTools() refuses a raw definition of a toolset the runner has, and queues nothing', async () => {
      const { toolset } = echoBrowserToolset();
      const { runner, respondWith, requests } = setupRunner([toolset]);
      // The API would take it as replacing the runner's browser toolset.
      expect(() => runner.addTools(customNavigate, { type: 'browser_toolset_20260801' })).toThrow(
        "addTools() can't replace the 'browser' toolset: a tool runner's toolsets come only from its tools param; change them with setMessagesParams(), or build a new runner",
      );
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();
      expect(requests[0]!.body.messages.filter((m: { role: string }) => m.role === 'system')).toEqual([]);
    });

    it("addTools() sends a raw definition of a toolset the runner doesn't have", async () => {
      const { runner, respondWith, requests } = setupRunner([customNavigate]);
      runner.addTools({ type: 'browser_toolset_20260801' });
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();
      expect(requests[0]!.body.messages.at(-1)).toEqual({
        role: 'system',
        content: [
          {
            type: 'tool_addition',
            tool: { type: 'tool_definition', definition: { type: 'browser_toolset_20260801' } },
          },
        ],
      });
    });

    it("removeTools() refuses a toolset's name, and removes nothing", async () => {
      const { toolset } = echoBrowserToolset();
      const { runner, respondWith, requests } = setupRunner([toolset, customNavigate]);
      const refusal =
        "removeTools() can't remove the 'browser' toolset: a tool runner's toolsets come only from its tools param; remove it there with setMessagesParams(), or build a new runner without it";
      expect(() => runner.removeTools('navigate', 'browser')).toThrow(ToolsetContractError);
      expect(() => runner.removeTools('navigate', 'browser')).toThrow(refusal);
      respondWith(functionToolUse('navigate', 'toolu_fn', { url: 'f' }));
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();
      expect(requests[0]!.body.messages.filter((m: { role: string }) => m.role === 'system')).toEqual([]);
      expect(requests[1]!.body.messages.at(-1).content[0]).toMatchObject({
        tool_use_id: 'toolu_fn',
        content: 'custom:f',
      });
    });

    it("removeTools() still removes a function tool that shares a member's name", async () => {
      const { toolset } = echoBrowserToolset();
      const { runner, respondWith, requests } = setupRunner([toolset, customNavigate]);
      runner.removeTools('navigate');
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();
      expect(requests[0]!.body.messages.at(-1)).toEqual({
        role: 'system',
        content: [{ type: 'tool_removal', tool: { type: 'tool_reference', name: 'navigate' } }],
      });
    });

    it('removeTools() with a member name removes only the function tool of that name', async () => {
      const { toolset, calls } = echoBrowserToolset();
      const { runner, respondWith, requests } = setupRunner([toolset, customNavigate]);
      runner.removeTools('navigate');
      respondWith(
        toolUse('navigate', { url: 'a' }, 'toolu_1'),
        functionToolUse('navigate', 'toolu_fn', { url: 'f' }),
      );
      respondWith({ type: 'text', text: 'Done.', citations: null });
      await runner.runUntilDone();

      expect(calls).toEqual([['navigate', { url: 'a' }]]);
      expect(requests[0]!.body.messages.at(-1)).toEqual({
        role: 'system',
        content: [{ type: 'tool_removal', tool: { type: 'tool_reference', name: 'navigate' } }],
      });
      expect(requests[1]!.body.messages.at(-1)).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_1',
            toolset_name: 'browser',
            content: [{ type: 'text', text: 'navigate:{"url":"a"}' }],
          },
          {
            type: 'tool_result',
            tool_use_id: 'toolu_fn',
            content: "Error: Tool 'navigate' not found",
            is_error: true,
          },
        ],
      });
    });

    it("removeTools() refuses a tool object with a toolset's name", () => {
      const { toolset } = echoBrowserToolset();
      const { runner } = setupRunner([toolset]);
      expect(() => runner.removeTools({ ...customNavigate, name: 'browser' })).toThrow(
        "removeTools() can't remove the 'browser' toolset: a tool runner's toolsets come only from its tools param; remove it there with setMessagesParams(), or build a new runner without it",
      );
    });
  });
});
