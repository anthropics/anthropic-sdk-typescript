# Computer toolset

`computer_toolset_20260801` is one `tools[]` entry that gives the model a family of desktop tools (`screenshot`, `left_click`, `type`, …), which the SDK's identifiers call _members_. The SDK ships no desktop driver: you subclass `BetaAbstractComputerToolset20260801` and implement the tools your backend supports.

## Quick start

```ts
import Anthropic from '@anthropic-ai/sdk';
import { MyDesktop, confirm } from './my-desktop'; // both shown below

const desktop = new MyDesktop(backend, { confirm });
try {
  const runner = new Anthropic().beta.messages.toolRunner({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    tools: [desktop],
    messages: [{ role: 'user', content: 'Open the calculator and compute 17 * 23.' }],
  });
  for await (const message of runner) console.log(message);
} finally {
  await desktop.close();
}
```

- You close the desktop. The runner ([helpers.md](helpers.md#tool-helpers)) never does.
- The runner runs a turn's computer actions in order and stops at the first one that fails or is refused. Other tools in the turn still run.

Without the runner, pass `desktop.toJSON()` in the `tools` of `client.beta.messages.create()` and answer each computer `tool_use` in the reply (`message` below) with `desktop.toolResult(toolUse)`. A refusal or failure comes back as an `is_error` result, and your loop must not run the turn's later computer actions:

```ts
const content = 'Not executed: an earlier computer action in this turn failed.';
const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
for (const use of message.content) {
  if (use.type !== 'tool_use' || use.toolset_name !== desktop.toolsetName) continue;
  const { id: tool_use_id, toolset_name } = use; // a skipped tool_use still needs a result
  if (!results[results.length - 1]?.is_error) results.push(await desktop.toolResult(use));
  else results.push({ type: 'tool_result', tool_use_id, toolset_name, is_error: true, content });
}
```

## Implement a driver

```ts
import {
  BetaAbstractComputerToolset20260801,
  type BetaComputerToolsetOptions,
  type BetaToolsetCallContext,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import type { BetaComputerLeftClickInput, BetaComputerTypeInput } from '@anthropic-ai/sdk/resources/beta';

export class MyDesktop extends BetaAbstractComputerToolset20260801 {
  protected backend: Backend; // whatever reaches your desktop: a VNC client, a remote-desktop API, xdotool

  constructor(backend: Backend, options: BetaComputerToolsetOptions) {
    super(options);
    this.backend = backend;
  }

  protected override async screenshot() {
    return { data: await this.backend.pngBase64() };
  }

  protected override async left_click(ctx: BetaToolsetCallContext, input: BetaComputerLeftClickInput) {
    await this.backend.click(input.coordinate, input.text); // see Coordinates
  }

  protected override async type_(ctx: BetaToolsetCallContext, input: BetaComputerTypeInput) {
    await this.backend.type(input.text);
  }

  override async close() {
    await super.close(); // first: it waits for calls in flight
    await this.backend.close();
  }
}
```

Override the tools your backend supports: `key`, `hold_key`, `type` (the method is `type_`), `cursor_position`, `mouse_move`, `left_mouse_down`, `left_mouse_up`, `left_click`, `left_click_drag`, `right_click`, `middle_click`, `double_click`, `triple_click`, `scroll`, `wait`, `screenshot`, `zoom`. `input` is what the model sent, typed as `BetaComputer<Tool>Input` from `@anthropic-ai/sdk/resources/beta`, and its doc comment is the tool's contract. A tool you don't override is sent to the API as `enabled: false`. So is one written as an arrow-function field, which compiles but is not detected: write tools as methods. From inside a tool, call another tool's method directly: `run` or `toolResult` there would wait on itself.

- **Results.** `screenshot` and `zoom` return a `BetaScreenshotResult`, and `cursor_position` a `BetaComputerCursorPositionResult`. Every other tool returns nothing, or one line of text for the model. The SDK never resizes an image, and the API rejects one over [the model's image limits](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool#handle-coordinate-scaling-for-higher-resolutions). Capture a `zoom` region at display resolution, not from the scaled screenshot.
- **Coordinates.** Every coordinate the model sends is in pixels of the full screenshot, not of the display or a `zoom` image. Your driver scales them to display pixels, reports `cursor_position` back in screenshot pixels, and keeps the capture size fixed for the session. Scale into a new array: the arrays in `input` are shared with the message history.
- **Input values.** The SDK does not check `input`. Throw `ToolError` for a missing or malformed field, a coordinate outside the display (don't clamp it), and a `duration`, `repeat` or `scroll_amount` your backend should not honor.
- **Errors.** When a tool throws `ToolError` (from `@anthropic-ai/sdk/helpers/beta/toolsets`) or any other exception, the model reads its text, unredacted, and the run continues. Keep error text to fixed phrases: an exception's message can carry screen content, a host name or a session token. A `ToolsetUsageError`, a mistake in your code or options, propagates and stops the run.
- **Try it without the API.** Pass a hand-built `BetaToolUseBlock` to `toolResult()`: `await desktop.toolResult({ type: 'tool_use', id: 'toolu_1', toolset_name: 'computer', name: 'left_click', input: { coordinate: [640, 360] } })`.

## Options

- `configs: { zoom: { enabled: false } }` turns a tool off.
- `toolConfigs: { cache_control: { type: 'ephemeral' } }` sets `cache_control` on the `tools[]` entry.
- `confirm` is asked before each call runs, and only `true` approves: any other answer refuses the call, and so does an exception (throw `ToolError` to word the refusal). Without one, nothing is asked, clicks included. The constructor requires one while `type`, `key` or `hold_key` is enabled. Show the approver the tool and its input, with every invisible character escaped: the model may be relaying screen content, and what the approver reads must be what runs.

```ts
import type { BetaComputerConfirmContext } from '@anthropic-ai/sdk/helpers/beta/toolsets';

export async function confirm(ctx: BetaComputerConfirmContext): Promise<boolean> {
  if (!['type', 'key', 'hold_key'].includes(ctx.member)) return true;
  // JSON.stringify leaves non-ASCII characters as they are: escape them all
  const escape = (ch: string) => `\\u{${ch.codePointAt(0)!.toString(16)}}`;
  return askUser(`Allow ${ctx.member}?\n${JSON.stringify(ctx.input, null, 2).replace(/[^\n -~]/gu, escape)}`);
}
```

**Hooks.** Override `execute(ctx, name, input)` and call `super.execute(...)` to run code around every call, or skip `super` to forward every call to a remote desktop. It runs after `confirm`, so nothing checks an input you change there. Overriding `execute` marks every tool as served, so the model is offered all of them: turn off the ones you don't serve in `configs`.

## Running a computer toolset safely

What is on the screen steers the model: a page, a document or a message can try to make it type into the wrong window or trigger consequential actions. Before you run a driver against anything but a throwaway machine:

1. **Isolate the desktop.** Run it in one container or VM per session, with no credentials or host mounts and egress only to the hosts the task needs. Keep the model loop, the toolset and the API key outside it.
2. **Gate consequential actions with `confirm`.** It sees the tool and its input, not what a click does on the screen. If the desktop has applications that can send, pay or delete, have a person approve clicks too. With a terminal, a run dialog or a launcher focused, whatever is typed runs as a command.
3. **Treat the screen as untrusted.** Never execute, store as trusted or forward screen contents, window titles or clipboard text unchecked.
