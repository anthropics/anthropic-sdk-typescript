/**
 * An in-memory browser toolset for the pipeline tests: a handful of members over a scripted tab list,
 * with a queue of state changes the test can load before a call.
 */
import type { BetaToolRunContext } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import type { BetaToolsetCallContext, BetaToolsetContent } from '@anthropic-ai/sdk/helpers/beta/toolsets';
import {
  BetaAbstractBrowserToolset20260801,
  ToolError,
  type BetaBrowserNavigateResult,
  type BetaScreenshotResult,
  type BetaBrowserState,
  type BetaBrowserToolsetOptions,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import type {
  BetaBrowserMemberInput,
  BetaBrowserStateBlockParam,
  BetaBrowserStateChange,
  BetaToolUseBlock,
  BetaBrowserCloseTabInput,
  BetaBrowserFileUploadInput,
  BetaBrowserGetPageTextInput,
  BetaBrowserHoldKeyInput,
  BetaBrowserKeyInput,
  BetaBrowserLeftClickInput,
  BetaBrowserListTabsInput,
  BetaBrowserNavigateInput,
  BetaBrowserNewTabInput,
  BetaBrowserScreenshotInput,
  BetaBrowserScrollInput,
  BetaBrowserScrollToInput,
  BetaBrowserStateTabEntry,
  BetaBrowserSwitchTabInput,
  BetaBrowserWaitInput,
} from '@anthropic-ai/sdk/resources/beta';

type FieldsOf<T> = T extends unknown ? keyof T : never;
type FieldOf<T, F extends PropertyKey> = T extends unknown ?
  F extends keyof T ?
    T[F]
  : never
: never;
/** A member input as the fake logs it: readable by every field some member declares, since the log spans members. */
export type LoggedInput = {
  [F in FieldsOf<BetaBrowserMemberInput>]?: FieldOf<BetaBrowserMemberInput, F>;
};
/** A wire state change readable by every field some change kind declares, for assertions across kinds. */
export type LoggedChange = {
  [F in FieldsOf<BetaBrowserStateChange>]?: FieldOf<BetaBrowserStateChange, F>;
};

/** The browser the fake drives: tabs, the active tab, queued state changes and a call log. */
export class World {
  tabs: Record<string, { title: string; url: string }> = { tab_1: { title: 'Blank', url: 'about:blank' } };

  active: string | undefined = 'tab_1';

  changes: NonNullable<BetaBrowserState['state_changes']> = [];

  calls: string[] = [];

  inputs: LoggedInput[] = [];

  contexts: BetaToolsetCallContext[] = [];

  stateContexts: BetaToolsetCallContext[] = [];

  pageText = 'Hello';

  fail: Record<string, unknown> = {};

  stateError: unknown = undefined;

  stateOverride: unknown = undefined;

  nextTab = 2;

  /** Resolves each member call only when released, for the serialization tests. */
  gate: ((name: string) => Promise<void>) | undefined = undefined;

  state = (ctx: BetaToolsetCallContext): BetaBrowserState => {
    this.stateContexts.push(ctx);
    if (this.stateError !== undefined) throw this.stateError;
    if (this.stateOverride !== undefined) return this.stateOverride as BetaBrowserState;
    const changes = this.changes;
    this.changes = [];
    return { tabs: this.tabEntries(), state_changes: changes };
  };

  tabEntries(): BetaBrowserStateTabEntry[] {
    return Object.entries(this.tabs).map(([tab_id, tab]) => ({
      tab_id,
      title: tab.title,
      url: tab.url,
      active: tab_id === this.active,
    }));
  }

  async do(name: string, ctx: BetaToolsetCallContext, input: LoggedInput): Promise<void> {
    this.calls.push(name);
    this.inputs.push(input);
    this.contexts.push(ctx);
    if (this.gate) await this.gate(name);
    if (name in this.fail) throw this.fail[name];
  }

  tab(tabId: string | undefined): string {
    const key = tabId ?? this.active;
    if (key === undefined || !(key in this.tabs))
      throw new ToolError(`No open tab with tab_id ${JSON.stringify(tabId)}.`);
    return key;
  }
}

export class FakeBrowser extends BetaAbstractBrowserToolset20260801 {
  readonly world: World;

  constructor(options: Omit<BetaBrowserToolsetOptions, 'browserState'> & { world?: World } = {}) {
    const { world = new World(), ...rest } = options;
    super({ browserState: world.state, ...rest });
    this.world = world;
  }

  protected override async navigate(
    ctx: BetaToolsetCallContext,
    input: BetaBrowserNavigateInput,
  ): Promise<BetaBrowserNavigateResult> {
    await this.world.do('navigate', ctx, input);
    const key = this.world.tab(input.tab_id ?? undefined);
    // A history word ("back", "forward", "reload") keeps the tab where it is, as a browser reports it.
    if (!['back', 'forward', 'reload'].includes(input.url)) {
      this.world.tabs[key] = { title: `Title of ${input.url}`, url: input.url };
    }
    const tab = this.world.tabs[key]!;
    return { url: tab.url, status: 200, title: tab.title };
  }

  protected override async screenshot(
    ctx: BetaToolsetCallContext,
    input: BetaBrowserScreenshotInput,
  ): Promise<BetaScreenshotResult> {
    await this.world.do('screenshot', ctx, input);
    return { data: 'iVBORw0KGgo=' };
  }

  protected override async left_click(
    ctx: BetaToolsetCallContext,
    input: BetaBrowserLeftClickInput,
  ): Promise<void> {
    await this.world.do('left_click', ctx, input);
  }

  protected override async scroll(ctx: BetaToolsetCallContext, input: BetaBrowserScrollInput): Promise<void> {
    await this.world.do('scroll', ctx, input);
  }

  protected override async scroll_to(
    ctx: BetaToolsetCallContext,
    input: BetaBrowserScrollToInput,
  ): Promise<void> {
    await this.world.do('scroll_to', ctx, input);
  }

  protected override async key(ctx: BetaToolsetCallContext, input: BetaBrowserKeyInput): Promise<void> {
    await this.world.do('key', ctx, input);
  }

  protected override async hold_key(
    ctx: BetaToolsetCallContext,
    input: BetaBrowserHoldKeyInput,
  ): Promise<void> {
    await this.world.do('hold_key', ctx, input);
  }

  protected override async wait(ctx: BetaToolsetCallContext, input: BetaBrowserWaitInput): Promise<void> {
    await this.world.do('wait', ctx, input);
  }

  protected override async file_upload(
    ctx: BetaToolsetCallContext,
    input: BetaBrowserFileUploadInput,
  ): Promise<void> {
    await this.world.do('file_upload', ctx, input);
  }

  protected override async get_page_text(
    ctx: BetaToolsetCallContext,
    input: BetaBrowserGetPageTextInput,
  ): Promise<string> {
    await this.world.do('get_page_text', ctx, input);
    return this.world.pageText;
  }

  protected override async new_tab(
    ctx: BetaToolsetCallContext,
    input: BetaBrowserNewTabInput,
  ): Promise<BetaBrowserStateTabEntry> {
    await this.world.do('new_tab', ctx, input);
    const tab_id = `tab_${this.world.nextTab++}`;
    this.world.tabs[tab_id] = { title: '', url: 'about:blank' };
    this.world.active = tab_id;
    this.world.changes.push({ type: 'tab_opened', tab_id });
    return { tab_id, title: '', url: 'about:blank', active: true };
  }

  protected override async list_tabs(
    ctx: BetaToolsetCallContext,
    input: BetaBrowserListTabsInput,
  ): Promise<BetaBrowserStateTabEntry[]> {
    await this.world.do('list_tabs', ctx, input);
    return this.world.tabEntries();
  }

  protected override async switch_tab(
    ctx: BetaToolsetCallContext,
    input: BetaBrowserSwitchTabInput,
  ): Promise<BetaBrowserStateTabEntry> {
    await this.world.do('switch_tab', ctx, input);
    const key = this.world.tab(input.tab_id);
    this.world.active = key;
    return { tab_id: key, ...this.world.tabs[key]!, active: true };
  }

  protected override async close_tab(
    ctx: BetaToolsetCallContext,
    input: BetaBrowserCloseTabInput,
  ): Promise<void> {
    await this.world.do('close_tab', ctx, input);
    const key = this.world.tab(input.tab_id);
    delete this.world.tabs[key];
    if (this.world.active === key) this.world.active = Object.keys(this.world.tabs)[0];
  }
}

/** A browser member `tool_use` block as the model would send it. */
export function toolUse(name: string, input: unknown = {}, id = 'toolu_1'): BetaToolUseBlock {
  return { type: 'tool_use', id, name, input, toolset_name: 'browser' };
}

export function ctxFor(name: string, input: unknown = {}, id = 'toolu_1'): BetaToolRunContext {
  const use = toolUse(name, input, id);
  return { toolUse: use, toolUseBlock: use };
}

/** Run one member call through the pipeline and return its `tool_result` content. */
export function run(
  browser: FakeBrowser,
  name: string,
  input: unknown,
  id = 'toolu_1',
): Promise<BetaToolsetContent> {
  return browser.run(ctxFor(name, input, id), toolUse(name, input, id));
}

export function texts(content: BetaToolsetContent): string[] {
  return content.flatMap((b) => (b.type === 'text' ? [b.text] : []));
}

export function stateBlock(content: BetaToolsetContent): BetaBrowserStateBlockParam {
  const blocks = content.filter((b) => b.type === 'browser_state');
  if (blocks.length !== 1) throw new Error(`expected one browser_state block, got ${blocks.length}`);
  return blocks[0]!;
}

/** The `state_changes` of the one `browser_state` block in `content` (empty when the field is absent). */
export function stateChanges(content: BetaToolsetContent): LoggedChange[] {
  return stateBlock(content).state_changes ?? [];
}

/** Run a member and return the error text it was refused or failed with. */
export async function errorText(browser: FakeBrowser, name: string, input: unknown): Promise<string> {
  try {
    await run(browser, name, input);
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    const lines = typeof error.content === 'string' ? [error.content] : texts(error.content);
    if (lines.length !== 1) throw new Error(`expected one error line, got ${JSON.stringify(lines)}`);
    return lines[0]!;
  }
  throw new Error(`${name} did not fail`);
}
