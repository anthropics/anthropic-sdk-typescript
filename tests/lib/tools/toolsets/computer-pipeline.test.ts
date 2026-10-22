/**
 * The computer pipeline around a member call: the input copy, rendering per result kind, the driver-error rule, the
 * confirm gate, closing and one-at-a-time execution.
 */
import { APIUserAbortError } from '@anthropic-ai/sdk';
import {
  ToolError,
  ToolsetClosedError,
  ToolsetContractError,
  ToolsetUsageError,
  type BetaComputerConfirmContext,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import { COMPUTER_MEMBERS } from '@anthropic-ai/sdk/lib/internal/toolsets/computer-members';
import { FIELD_MAX } from '@anthropic-ai/sdk/lib/internal/toolsets/sanitize';
import { Desktop, FakeDesktop, computerUse, ctxFor, errorText, run, texts } from './computer-fakes';

const PNG = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } };

/** Run a member and return the ToolError the pipeline threw: the refusal's content, as the runner reads it. */
async function refusal(toolset: FakeDesktop, name: string, input: unknown = {}): Promise<ToolError> {
  try {
    await run(toolset, name, input);
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error(`${name} did not fail`);
}

describe('rendering', () => {
  test('a pure action renders its acknowledgment, filled from the input', async () => {
    const toolset = new FakeDesktop();
    expect(await run(toolset, 'left_click', { coordinate: [1, 2] })).toEqual([
      { type: 'text', text: 'Clicked.' },
    ]);
    expect(texts(await run(toolset, 'key', { text: 'ctrl+c' }))).toEqual(['Pressed ctrl+c.']);
    expect(texts(await run(toolset, 'scroll', { scroll_direction: 'down', scroll_amount: 3 }))).toEqual([
      'Scrolled down.',
    ]);
    expect(texts(await run(toolset, 'wait', { duration: 2 }))).toEqual(['Waited 2s.']);
    expect(texts(await run(toolset, 'type', { text: 'hi' }))).toEqual(['Typed.']);
    expect(texts(await run(toolset, 'mouse_move', { coordinate: [5, 6] }))).toEqual(['Moved the mouse.']);
    expect(toolset.desktop.calls).toEqual(['left_click', 'key', 'scroll', 'wait', 'type', 'mouse_move']);
    // the driver receives the input as the model sent it, coordinates in screenshot pixels
    expect(toolset.desktop.inputs[0]).toEqual({ coordinate: [1, 2] });
  });

  test('the fourteen pure actions carry these acknowledgments', async () => {
    const acks = [...COMPUTER_MEMBERS.values()]
      .filter((m) => m.result === 'none')
      .map((m) => [m.name, m.text]);
    expect(acks).toEqual([
      ['key', 'Pressed {text}.'],
      ['hold_key', 'Held {text} for {duration}s.'],
      ['type', 'Typed.'],
      ['mouse_move', 'Moved the mouse.'],
      ['left_mouse_down', 'Left mouse button pressed.'],
      ['left_mouse_up', 'Left mouse button released.'],
      ['left_click', 'Clicked.'],
      ['left_click_drag', 'Dragged.'],
      ['right_click', 'Right-clicked.'],
      ['middle_click', 'Middle-clicked.'],
      ['double_click', 'Double-clicked.'],
      ['triple_click', 'Triple-clicked.'],
      ['scroll', 'Scrolled {scroll_direction}.'],
      ['wait', 'Waited {duration}s.'],
    ]);
    class Holder extends FakeDesktop {
      protected override hold_key(): void {}
    }
    expect(texts(await run(new Holder(), 'hold_key', { text: 'ctrl', duration: 2 }))).toEqual([
      'Held ctrl for 2s.',
    ]);
  });

  test('a line a pure action returns follows the acknowledgment, folded to one line and bounded', async () => {
    const toolset = new FakeDesktop();
    toolset.desktop.lines['left_click'] = 'the button\nturned green';
    expect(texts(await run(toolset, 'left_click', {}))).toEqual(['Clicked.', 'the button turned green']);
    toolset.desktop.lines['left_click'] = 'x'.repeat(FIELD_MAX + 10);
    expect(texts(await run(toolset, 'left_click', {}))[1]).toHaveLength(FIELD_MAX);
    toolset.desktop.lines['left_click'] = '';
    expect(texts(await run(toolset, 'left_click', {}))).toEqual(['Clicked.']);
    toolset.desktop.lines['left_click'] = ' \n\t'; // whitespace only folds to nothing: no empty text block
    expect(texts(await run(toolset, 'left_click', {}))).toEqual(['Clicked.']);
    toolset.desktop.lines['left_click'] = 42; // anything but a non-empty string is no line
    expect(texts(await run(toolset, 'left_click', {}))).toEqual(['Clicked.']);
  });

  test('cursor_position renders the cursor in screenshot pixels as X=..,Y=..', async () => {
    const toolset = new FakeDesktop();
    await run(toolset, 'mouse_move', { coordinate: [10, 20] });
    expect(await run(toolset, 'cursor_position', {})).toEqual([{ type: 'text', text: 'X=10,Y=20' }]);
  });

  test('screenshot and zoom render one image block and nothing else', async () => {
    const toolset = new FakeDesktop();
    expect(await run(toolset, 'screenshot', {})).toEqual([PNG]);
    expect(await run(toolset, 'zoom', { region: [0, 0, 10, 10] })).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/webp', data: 'UklGRg==' } },
    ]);
    // null input reads as no input
    expect(await run(toolset, 'screenshot', null)).toEqual([PNG]);
  });
});

describe('input', () => {
  test("the input reaches the driver as the model sent it, and what the driver throws becomes the model's error result", async () => {
    const toolset = new FakeDesktop();
    await run(toolset, 'left_click', { coordinate: [1, 2, 3] });
    await run(toolset, 'left_click', { coordinate: ['1', '2'] });
    await run(toolset, 'key', { text: 'a', coordinate: 5 });
    expect(toolset.desktop.inputs).toEqual([
      { coordinate: [1, 2, 3] },
      { coordinate: ['1', '2'] },
      { text: 'a', coordinate: 5 },
    ]);
    // a missing coordinate reaches the driver too, and the driver's refusal is what the model reads
    toolset.desktop.fail['mouse_move'] = new ToolError('mouse_move needs a coordinate.');
    expect(await errorText(toolset, 'mouse_move', {})).toBe('mouse_move needs a coordinate.');
    expect(toolset.desktop.inputs.at(-1)).toEqual({});
  });

  test('a non-object input reaches the driver spread into an object', async () => {
    const toolset = new FakeDesktop();
    await run(toolset, 'wait', ['x']); // the API always sends an object
    expect(toolset.desktop.inputs).toEqual([{ 0: 'x' }]);
  });

  test('an own __proto__ key reaches confirm and the driver as an ordinary key', async () => {
    const seen: unknown[] = [];
    const toolset = new FakeDesktop({ confirm: (ctx) => (seen.push(ctx.input), true) });
    const input = JSON.parse('{"__proto__": {"text": "hidden", "note": "inherited"}, "text": "shown"}');
    await run(toolset, 'type', input);
    const received = toolset.desktop.inputs[0];
    expect(Object.getPrototypeOf(received)).toBe(Object.prototype);
    expect(Object.keys(received)).toEqual(['__proto__', 'text']);
    expect(received.text).toBe('shown');
    expect(received.note).toBeUndefined();
    expect(seen).toEqual([received]);
  });

  test('values are not bounded: the driver sees what the model sent', async () => {
    const toolset = new FakeDesktop();
    await run(toolset, 'wait', { duration: 1000 });
    await run(toolset, 'key', { text: 'a', repeat: 0 });
    await run(toolset, 'mouse_move', { coordinate: [-5, 99999] });
    expect(toolset.desktop.inputs).toEqual([
      { duration: 1000 },
      { text: 'a', repeat: 0 },
      { coordinate: [-5, 99999] },
    ]);
    // the model's own input object is copied, never handed over
    const input = { coordinate: [1, 1] };
    await run(toolset, 'left_click', input);
    expect(toolset.desktop.inputs.at(-1)).toEqual(input);
    expect(toolset.desktop.inputs.at(-1)).not.toBe(input);
  });
});

describe('refusals', () => {
  test('unknown, disabled and unavailable members are refused before the driver runs', async () => {
    const toolset = new FakeDesktop({ configs: { wait: { enabled: false } } });
    expect(await errorText(toolset, 'navigate', {})).toBe(
      "Error: unknown computer toolset member 'navigate'",
    );
    expect(await errorText(toolset, 'wait', { duration: 1 })).toBe(
      "The 'wait' action is not permitted by this application's permissions and cannot be used in this session.",
    );
    expect(await errorText(toolset, 'right_click', {})).toBe(
      "The computer toolset member 'right_click' is not available in this environment.",
    );
    expect(toolset.desktop.calls).toEqual([]);
  });

  test("a driver's ToolError is the model's refusal; any other exception becomes one; usage errors propagate", async () => {
    const toolset = new FakeDesktop();
    toolset.desktop.fail['left_click'] = new ToolError('nothing at that point');
    expect(await errorText(toolset, 'left_click', {})).toBe('nothing at that point');
    toolset.desktop.fail['left_click'] = new TypeError('bad');
    expect(await errorText(toolset, 'left_click', {})).toBe('Error: bad');
    toolset.desktop.fail['left_click'] = new Error('x'.repeat(FIELD_MAX * 2));
    expect(await errorText(toolset, 'left_click', {})).toHaveLength(FIELD_MAX);
    toolset.desktop.fail['left_click'] = new ToolError('');
    expect((await refusal(toolset, 'left_click')).content).toEqual([{ type: 'text', text: '' }]);
    // an empty refusal still reads as a failure
    expect(await toolset.toolResult(computerUse('left_click'))).toMatchObject({
      is_error: true,
      content: 'The tool call failed with an empty error message.',
    });
    toolset.desktop.fail['left_click'] = new ToolsetUsageError('driver misuse');
    await expect(run(toolset, 'left_click', {})).rejects.toBeInstanceOf(ToolsetUsageError);
  });

  test("run() throws a ToolError's blocks as they were thrown; toolResult keeps only the text", async () => {
    const toolset = new FakeDesktop();
    const thrown = [{ type: 'text', text: 'lone \uD800 surrogate' }, PNG as any];
    toolset.desktop.fail['left_click'] = new ToolError(thrown);
    expect((await refusal(toolset, 'left_click')).content).toEqual(thrown);
    expect((await toolset.toolResult(computerUse('left_click'))).content).toEqual([
      { type: 'text', text: 'lone \uFFFD surrogate' },
    ]);
    // a text block over the field limit is cut, and only the text is kept
    toolset.desktop.fail['left_click'] = new ToolError([
      { type: 'text', text: 'x'.repeat(FIELD_MAX * 2) },
      PNG as any,
    ]);
    expect((await refusal(toolset, 'left_click')).content).toEqual([
      { type: 'text', text: 'x'.repeat(FIELD_MAX) },
    ]);
    // a refusal out of confirm is thrown as raised too
    const refusing = new FakeDesktop({
      confirm: () => {
        throw new ToolError(thrown);
      },
    });
    expect((await refusal(refusing, 'left_click')).content).toEqual(thrown);
    expect(refusing.desktop.calls).toEqual([]);
    // and cut to the field limit like a driver's
    const long = new FakeDesktop({
      confirm: () => {
        throw new ToolError('x'.repeat(FIELD_MAX * 2));
      },
    });
    expect(await errorText(long, 'left_click', {})).toHaveLength(FIELD_MAX);
  });

  test('toolResult answers a hand-written loop with a tool_result that names the family', async () => {
    const toolset = new FakeDesktop();
    expect(await toolset.toolResult(computerUse('screenshot', {}, 'toolu_9'))).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_9',
      toolset_name: 'computer',
      content: [PNG],
    });
    toolset.desktop.fail['zoom'] = new ToolError('The display is locked.');
    expect(await toolset.toolResult(computerUse('zoom', { region: [0, 0, 1, 1] }, 'toolu_10'))).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_10',
      toolset_name: 'computer',
      content: [{ type: 'text', text: 'The display is locked.' }],
      is_error: true,
    });
    // a block of another family is a routing mistake, not something the model reads
    await expect(
      toolset.toolResult({ ...computerUse('screenshot'), toolset_name: 'browser' }),
    ).rejects.toBeInstanceOf(ToolsetContractError);
  });
});

describe('confirm gate', () => {
  test('with type, key and hold_key turned off, a call runs with no confirm at all', async () => {
    const off = { enabled: false };
    const toolset = new FakeDesktop({ confirm: undefined, configs: { type: off, key: off, hold_key: off } });
    expect(texts(await run(toolset, 'left_click', { coordinate: [1, 1] }))).toEqual(['Clicked.']);
    expect(texts(await run(toolset, 'wait', { duration: 1 }))).toEqual(['Waited 1s.']);
    expect(toolset.desktop.calls).toEqual(['left_click', 'wait']);
  });

  test('confirm sees every call that is about to run, with the member and its input only', async () => {
    const seen: BetaComputerConfirmContext[] = [];
    const toolset = new FakeDesktop({
      confirm: (ctx) => {
        seen.push(ctx);
        return ctx.member !== 'type';
      },
    });
    expect(texts(await run(toolset, 'left_click', { coordinate: [1, 1] }, 'toolu_7'))).toEqual(['Clicked.']);
    expect(await errorText(toolset, 'type', { text: 'secret' })).toBe(
      "The user did not grant permission to run 'type'. Do not retry it unless the user asks you to.",
    );
    expect(toolset.desktop.calls).toEqual(['left_click']); // the declined call never reached the driver
    // a call refused before dispatch (unknown, disabled, unavailable) is never asked about
    await refusal(toolset, 'navigate');
    await refusal(toolset, 'right_click');
    expect(seen.map((ctx) => ctx.member)).toEqual(['left_click', 'type']);
    expect(Object.keys(seen[0]!).sort()).toEqual(['input', 'member', 'toolUse', 'toolUseBlock']);
    expect(seen[0]!.input).toEqual({ coordinate: [1, 1] });
    expect(seen[0]!.toolUse?.id).toBe('toolu_7');
  });

  test('a confirm that throws refuses the call; one that answers anything but true declines it', async () => {
    const failing = new FakeDesktop({
      confirm: () => {
        throw new Error('no terminal');
      },
    });
    expect(await errorText(failing, 'left_click', {})).toBe(
      "Permission to run 'left_click' could not be obtained (the confirmation prompt failed). Do not retry it unless the user asks you to.",
    );
    const worded = new FakeDesktop({
      confirm: async () => {
        throw new ToolError('Not on this screen.');
      },
    });
    expect(await errorText(worded, 'left_click', {})).toBe('Not on this screen.');
    const wrong = new FakeDesktop({ confirm: (() => 'yes') as any });
    expect(await errorText(wrong, 'left_click', {})).toBe(
      "The user did not grant permission to run 'left_click'. Do not retry it unless the user asks you to.",
    );
    // a confirm that is not a function refuses every call
    for (const bogus of [null, false]) {
      expect(await errorText(new FakeDesktop({ confirm: bogus as any }), 'left_click', {})).toBe(
        "Permission to run 'left_click' could not be obtained (the confirmation prompt failed). Do not retry it unless the user asks you to.",
      );
    }
    const usage = new FakeDesktop({
      confirm: () => {
        throw new ToolsetUsageError('broken prompt');
      },
    });
    await expect(run(usage, 'left_click', {})).rejects.toBeInstanceOf(ToolsetUsageError);
  });
});

describe('closing and ordering', () => {
  test('calls run one at a time in arrival order; close waits for the calls already accepted', async () => {
    const desktop = new Desktop();
    const release: Record<string, () => void> = {};
    desktop.gate = (name) => new Promise((resolve) => (release[name] = resolve));
    const toolset = new FakeDesktop({ desktop });
    const first = run(toolset, 'key', { text: 'a' }, 'toolu_1');
    const second = run(toolset, 'wait', { duration: 1 }, 'toolu_2');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(desktop.calls).toEqual(['key']); // the second waits behind the first
    const closing = toolset.close();
    await expect(run(toolset, 'screenshot', {})).rejects.toBeInstanceOf(ToolsetClosedError);
    let closed = false;
    void closing.then(() => (closed = true));
    release['key']!();
    await first;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(desktop.calls).toEqual(['key', 'wait']); // accepted before close: still runs
    expect(closed).toBe(false);
    release['wait']!();
    await second;
    await closing;
    expect(closed).toBe(true);
  });

  test('toolResult on a closed toolset throws ToolsetClosedError and dispatches nothing', async () => {
    const toolset = new FakeDesktop();
    await toolset.close();
    await expect(toolset.toolResult(computerUse('screenshot'))).rejects.toBeInstanceOf(ToolsetClosedError);
    expect(toolset.desktop.calls).toEqual([]);
  });

  test('an aborted run dispatches nothing and rejects with the abort error', async () => {
    const toolset = new FakeDesktop();
    const controller = new AbortController();
    controller.abort();
    const ctx = { ...ctxFor('left_click'), signal: controller.signal };
    await expect(toolset.run(ctx, computerUse('left_click'))).rejects.toBeInstanceOf(APIUserAbortError);
    expect(toolset.desktop.calls).toEqual([]);
  });

  test('an abort while a member is in flight is not answered; a queued call leaves the queue at once', async () => {
    const desktop = new Desktop();
    const release: Record<string, () => void> = {};
    desktop.gate = (name) => new Promise((resolve) => (release[name] = resolve));
    const toolset = new FakeDesktop({ desktop });
    const controller = new AbortController();
    const ctx = (name: string, id: string) => ({ ...ctxFor(name, {}, id), signal: controller.signal });
    const inFlight = toolset.run(ctx('screenshot', 'toolu_1'), computerUse('screenshot', {}, 'toolu_1'));
    const queued = toolset.run(ctx('wait', 'toolu_2'), computerUse('wait', { duration: 1 }, 'toolu_2'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(desktop.calls).toEqual(['screenshot']);
    controller.abort();
    await expect(queued).rejects.toBeInstanceOf(APIUserAbortError); // without waiting for the screenshot
    release['screenshot']!();
    await expect(inFlight).rejects.toBeInstanceOf(APIUserAbortError); // the finished screenshot is not answered
    expect(desktop.calls).toEqual(['screenshot']);
  });
});
