/**
 * The computer toolset through the tool runner: dispatch by family, the halt after a failed member, and a computer
 * and a browser toolset serving one request side by side.
 */
import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta';
import { FakeBrowser, toolUse } from './fakes';
import { FakeDesktop, computerUse } from './computer-fakes';
import { setupRunner } from './runner-helpers';

const NOT_EXECUTED = 'Not executed: an earlier computer action in this turn failed.';
const DONE: BetaContentBlock[] = [{ type: 'text', text: 'Done.', citations: null }];

describe('through the tool runner', () => {
  test('member calls round-trip; a failed member halts the rest of the turn', async () => {
    let closed = 0;
    class Closing extends FakeDesktop {
      override async close(): Promise<void> {
        closed += 1;
      }
    }
    const toolset = new Closing();
    toolset.desktop.fail['key'] = new Error('no keyboard');
    const { runner, respondWith, requests } = setupRunner([toolset]);
    respondWith(
      computerUse('screenshot', {}, 'toolu_shot'),
      computerUse('key', { text: 'Return' }, 'toolu_key'),
      computerUse('left_click', { coordinate: [1, 1] }, 'toolu_click'),
    );
    respondWith(...DONE);
    await runner.runUntilDone();
    expect(closed).toBe(0); // the runner never closes a toolset
    expect(requests[0]!.body.tools).toEqual([JSON.parse(JSON.stringify(toolset))]);
    expect(requests[0]!.headers.get('x-stainless-helper')).toContain('computer-toolset');
    const results = requests[1]!.body.messages.at(-1).content;
    expect(results[0]).toMatchObject({ tool_use_id: 'toolu_shot', toolset_name: 'computer' });
    expect(results[0].content.map((b: any) => b.type)).toEqual(['image']);
    expect(results[1]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_key',
      toolset_name: 'computer',
      content: [{ type: 'text', text: 'Error: no keyboard' }],
      is_error: true,
    });
    expect(results[2]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_click',
      toolset_name: 'computer',
      content: NOT_EXECUTED,
      is_error: true,
    });
    expect(toolset.desktop.calls).toEqual(['screenshot', 'key']); // the click was never dispatched
  });

  test('a computer and a browser toolset serve one request, each its own family, each its own halt', async () => {
    const desktop = new FakeDesktop();
    desktop.desktop.fail['wait'] = new Error('clock stopped');
    const browser = new FakeBrowser();
    const { runner, respondWith, requests } = setupRunner([browser, desktop]);
    respondWith(
      toolUse('screenshot', {}, 'toolu_b1'),
      computerUse('wait', { duration: 1 }, 'toolu_c1'),
      computerUse('screenshot', {}, 'toolu_c2'),
      toolUse('wait', { duration: 1 }, 'toolu_b2'),
    );
    respondWith(...DONE);
    await runner.runUntilDone();
    expect(requests[0]!.body.tools.map((t: any) => t.type)).toEqual([
      'browser_toolset_20260801',
      'computer_toolset_20260801',
    ]);
    const tags = (requests[0]!.headers.get('x-stainless-helper') ?? '').split(', ');
    expect(tags).toEqual(expect.arrayContaining(['browser-toolset', 'computer-toolset']));
    const results = requests[1]!.body.messages.at(-1).content;
    expect(results.map((r: any) => [r.tool_use_id, r.toolset_name, r.is_error ?? false])).toEqual([
      ['toolu_b1', 'browser', false],
      ['toolu_c1', 'computer', true],
      ['toolu_c2', 'computer', true],
      ['toolu_b2', 'browser', false], // the browser sequence is not halted by the computer failure
    ]);
    expect(results[2].content).toBe(NOT_EXECUTED);
    expect(browser.world.calls).toEqual(['screenshot', 'wait']);
    expect(desktop.desktop.calls).toEqual(['wait']);
  });

  test('a computer call without toolset_name says what it could not read and runs nothing', async () => {
    const desktop = new FakeDesktop();
    const { runner, respondWith, requests } = setupRunner([desktop]);
    const call = (id: string, input: Record<string, unknown>): BetaContentBlock => ({
      type: 'tool_use',
      id,
      name: 'computer',
      input,
    });
    respondWith(
      call('toolu_text', { actions: '[{"action": "screenshot", "}]' }),
      call('toolu_object', { actions: { action: 'screenshot' } }),
      call('toolu_empty', { actions: [] }),
      call('toolu_no_action', { actions: [{ action: 'screenshot' }, { coordinate: [1, 1] }] }),
      call('toolu_named', { actions: Array.from({ length: 12 }, (_, i) => ({ action: `a${i}` })) }),
      call('toolu_flat', { action: 'screenshot' }),
      { type: 'tool_use', id: 'toolu_null', name: 'computer', input: { actions: [] }, toolset_name: null },
      { type: 'tool_use', id: 'toolu_unknown', name: 'lookup', input: {} },
    );
    respondWith(...DONE);
    await runner.runUntilDone();
    const error = (id: string, content: string) => ({
      type: 'tool_result',
      tool_use_id: id,
      content,
      is_error: true,
    });
    const unread = (id: string, detail: string) =>
      error(
        id,
        `Error: the 'computer' toolset could not run this call${detail}; nothing in the batch was executed`,
      );
    expect(requests[1]!.body.messages.at(-1).content).toEqual([
      unread('toolu_text', ": 'actions' is text, not a list of actions"),
      unread('toolu_object', ": 'actions' is not a list of actions"),
      unread('toolu_empty', ": the 'actions' list is empty"),
      unread('toolu_no_action', ": action 1 must be an object with a string 'action' field"),
      unread(
        'toolu_named',
        ": its actions could not be run as sent (actions: 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', and 2 more)",
      ),
      unread('toolu_flat', ": the call has no 'actions' list (action: 'screenshot')"),
      unread('toolu_null', ": the 'actions' list is empty"),
      error('toolu_unknown', "Error: Tool 'lookup' not found"), // a name no toolset has keeps the old reply
    ]);
    expect(desktop.desktop.calls).toEqual([]);
  });

  test("a malformed computer call fails like a computer action: the toolset's later calls in the turn don't run", async () => {
    const desktop = new FakeDesktop();
    const { runner, respondWith, requests } = setupRunner([desktop]);
    respondWith(
      computerUse('screenshot', {}, 'toolu_before'),
      { type: 'tool_use', id: 'toolu_bad', name: 'computer', input: { actions: 'not a list' } },
      computerUse('key', { text: 'Return' }, 'toolu_after'),
    );
    respondWith(...DONE);
    await runner.runUntilDone();
    const results = requests[1]!.body.messages.at(-1).content;
    expect(results.map((r: any) => [r.tool_use_id, r.is_error ?? false])).toEqual([
      ['toolu_before', false],
      ['toolu_bad', true],
      ['toolu_after', true],
    ]);
    expect(results[2].content).toBe(NOT_EXECUTED);
    expect(desktop.desktop.calls).toEqual(['screenshot']);
  });
});
