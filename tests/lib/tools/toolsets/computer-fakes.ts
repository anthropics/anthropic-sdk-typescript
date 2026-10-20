/**
 * An in-memory computer toolset for the pipeline tests: a handful of members over a scripted desktop, with a
 * call log and a failure map the test can load before a call.
 */
import type { BetaToolRunContext } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import {
  BetaAbstractComputerToolset20260801,
  ToolError,
  type BetaComputerCursorPositionResult,
  type BetaScreenshotResult,
  type BetaComputerToolsetOptions,
  type BetaToolsetCallContext,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import type {
  BetaComputerCursorPositionInput,
  BetaComputerKeyInput,
  BetaComputerLeftClickInput,
  BetaComputerMouseMoveInput,
  BetaComputerScreenshotInput,
  BetaComputerScrollInput,
  BetaComputerTypeInput,
  BetaComputerWaitInput,
  BetaComputerZoomInput,
  BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta';

/** The desktop the fake drives: the cursor, a call log and what each member should do. */
export class Desktop {
  cursor = { x: 0, y: 0 };
  calls: string[] = [];
  inputs: any[] = [];
  contexts: BetaToolsetCallContext[] = [];
  fail: Record<string, unknown> = {};
  /** What a pure action returns: the optional line the model reads after the acknowledgment. */
  lines: Record<string, unknown> = {};
  /** Resolves each member call only when released, for the serialization tests. */
  gate: ((name: string) => Promise<void>) | undefined = undefined;

  async do(name: string, ctx: BetaToolsetCallContext, input: unknown): Promise<any> {
    this.calls.push(name);
    this.inputs.push(input);
    this.contexts.push(ctx);
    if (this.gate) await this.gate(name);
    if (name in this.fail) throw this.fail[name];
    return this.lines[name];
  }
}

export class FakeDesktop extends BetaAbstractComputerToolset20260801 {
  readonly desktop: Desktop;

  constructor(options: BetaComputerToolsetOptions & { desktop?: Desktop } = {}) {
    const { desktop = new Desktop(), ...rest } = options;
    // `key` and `type_` need a confirm callable to build
    super({ confirm: () => true, ...rest });
    this.desktop = desktop;
  }

  protected override key(ctx: BetaToolsetCallContext, input: BetaComputerKeyInput): Promise<void | string> {
    return this.desktop.do('key', ctx, input);
  }

  protected override type_(
    ctx: BetaToolsetCallContext,
    input: BetaComputerTypeInput,
  ): Promise<void | string> {
    return this.desktop.do('type', ctx, input);
  }

  protected override async mouse_move(
    ctx: BetaToolsetCallContext,
    input: BetaComputerMouseMoveInput,
  ): Promise<void> {
    await this.desktop.do('mouse_move', ctx, input);
    this.desktop.cursor = { x: input.coordinate[0]!, y: input.coordinate[1]! };
  }

  protected override left_click(
    ctx: BetaToolsetCallContext,
    input: BetaComputerLeftClickInput,
  ): Promise<void | string> {
    return this.desktop.do('left_click', ctx, input);
  }

  protected override scroll(
    ctx: BetaToolsetCallContext,
    input: BetaComputerScrollInput,
  ): Promise<void | string> {
    return this.desktop.do('scroll', ctx, input);
  }

  protected override wait(ctx: BetaToolsetCallContext, input: BetaComputerWaitInput): Promise<void | string> {
    return this.desktop.do('wait', ctx, input);
  }

  protected override async cursor_position(
    ctx: BetaToolsetCallContext,
    input: BetaComputerCursorPositionInput,
  ): Promise<BetaComputerCursorPositionResult> {
    await this.desktop.do('cursor_position', ctx, input);
    return { ...this.desktop.cursor };
  }

  protected override async screenshot(
    ctx: BetaToolsetCallContext,
    input: BetaComputerScreenshotInput,
  ): Promise<BetaScreenshotResult> {
    await this.desktop.do('screenshot', ctx, input);
    return { data: 'iVBORw0KGgo=' };
  }

  protected override async zoom(
    ctx: BetaToolsetCallContext,
    input: BetaComputerZoomInput,
  ): Promise<BetaScreenshotResult> {
    await this.desktop.do('zoom', ctx, input);
    return { data: 'UklGRg==', mediaType: 'image/webp' };
  }
}

export function computerUse(name: string, input: unknown = {}, id = 'toolu_1'): BetaToolUseBlock {
  return { type: 'tool_use', id, name, input, toolset_name: 'computer' };
}

export function ctxFor(name: string, input: unknown = {}, id = 'toolu_1'): BetaToolRunContext {
  const use = computerUse(name, input, id);
  return { toolUse: use, toolUseBlock: use };
}

export async function run(
  toolset: FakeDesktop,
  name: string,
  input: unknown = {},
  id = 'toolu_1',
): Promise<any[]> {
  return toolset.run(ctxFor(name, input, id), computerUse(name, input, id));
}

export function texts(content: Array<{ type: string; text?: string }>): string[] {
  return content.filter((b) => b.type === 'text').map((b) => b.text!);
}

/** Run a member and return the error text it was refused or failed with. */
export async function errorText(toolset: FakeDesktop, name: string, input: unknown = {}): Promise<string> {
  try {
    await run(toolset, name, input);
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    const lines = texts(error.content as any[]);
    if (lines.length !== 1) throw new Error(`expected one error line, got ${JSON.stringify(lines)}`);
    return lines[0]!;
  }
  throw new Error(`${name} did not fail`);
}
