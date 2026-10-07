/**
 * The abstract class without its pipeline: construction rules, override detection, the wire entry,
 * and `execute` dispatch.
 */
import type { BetaToolsetCallContext } from '@anthropic-ai/sdk/helpers/beta/toolsets';
import {
  BetaAbstractBrowserToolset20260801,
  ToolsetConfigError,
  ToolsetUsageError,
  ToolError,
  UnavailableMemberError,
  type BetaBrowserNavigateResult,
  type BetaScreenshotResult,
  type BetaBrowserState,
  type BetaBrowserToolsetOptions,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import type { BetaBrowserNavigateInput, BetaBrowserScreenshotInput } from '@anthropic-ai/sdk/resources/beta';

const CTX = {} as BetaToolsetCallContext;
const state = (): BetaBrowserState => ({ tabs: [] });

class Base extends BetaAbstractBrowserToolset20260801 {
  constructor(options: Omit<BetaBrowserToolsetOptions, 'browserState'> = {}) {
    super({ browserState: state, ...options });
  }
  /** Reach the protected dispatch layer from the tests. */
  dispatch(name: string, input: unknown): Promise<unknown> {
    return this.execute(CTX, name as never, input as never);
  }
}

class Nav extends Base {
  protected override navigate(
    _ctx: BetaToolsetCallContext,
    input: BetaBrowserNavigateInput,
  ): BetaBrowserNavigateResult {
    return { url: input.url, status: 200 };
  }
}

class NavAndShot extends Nav {
  protected override async screenshot(
    _ctx: BetaToolsetCallContext,
    _input: BetaBrowserScreenshotInput,
  ): Promise<BetaScreenshotResult> {
    return { data: 'iVBORw0KGgo=' };
  }
}

function expectConfigError(fn: () => unknown, match: RegExp): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ToolsetConfigError);
    expect(String((error as Error).message)).toMatch(match);
    return;
  }
  throw new Error('expected a ToolsetConfigError');
}

describe('construction', () => {
  test('enabling javascript_exec requires a confirm', () => {
    class Exec extends Nav {
      protected override async javascript_exec(): Promise<string> {
        return '1';
      }
    }
    const on = { configs: { javascript_exec: { enabled: true } } };
    expectConfigError(() => new Exec(on), /pass confirm/);
    expect(() => new Exec({ ...on, confirm: () => true })).not.toThrow();
    // a confirm that is not a function is accepted at construction
    expect(() => new Exec({ ...on, confirm: null as any })).not.toThrow();
  });

  test('urlPolicy may be sync, async or unset', () => {
    expect(() => new Nav({ urlPolicy: () => {} })).not.toThrow();
    expect(() => new Nav({ urlPolicy: async () => {} })).not.toThrow();
    expect(() => new Nav({ urlPolicy: undefined })).not.toThrow();
    expect(new ToolsetConfigError('x')).toBeInstanceOf(ToolsetUsageError); // one catch covers every kind
    expect(new ToolsetConfigError('x')).toBeInstanceOf(Error);
  });
});

describe('the wire entry', () => {
  test('unimplemented members are sent as enabled:false and nothing else leaks', () => {
    const entry = JSON.parse(JSON.stringify(new NavAndShot()));
    expect(Object.keys(entry).sort()).toEqual(['configs', 'type']);
    expect(entry.type).toBe('browser_toolset_20260801');
    expect(entry.configs.navigate).toBeUndefined();
    expect(entry.configs.screenshot).toBeUndefined();
    expect(entry.configs.left_click).toEqual({ enabled: false });
    expect(entry.configs.javascript_exec).toEqual({ enabled: false });
    expect(Object.keys(entry.configs)).toHaveLength(29);
  });

  test("the caller's configs are copied through; enabling an unimplemented member is a config error", () => {
    const browser = new Nav({
      configs: {
        navigate: { defer_loading: true },
        zoom: { defer_loading: false },
      },
      toolConfigs: { cache_control: { type: 'ephemeral' } },
    });
    const entry = JSON.parse(JSON.stringify(browser));
    expect(entry.configs.navigate).toEqual({ defer_loading: true });
    expect(entry.configs.zoom).toEqual({ defer_loading: false, enabled: false });
    // Enabling a member the class does not override would offer the model something that can only answer
    // "not available": refused at construction.
    expect(() => new Nav({ configs: { left_click: { enabled: true } } })).toThrow(
      /does not implement.*left_click/,
    );
    // Spreading a toolset copies no policies or callbacks: the resolved options are private.
    expect(Object.keys({ ...browser }).sort()).toEqual(['toolsetName', 'type']);
    expect(JSON.stringify({ ...browser })).not.toContain('Policy');
    // The wire configs are frozen: the gate reads what the API was told, and that cannot be changed afterwards.
    expect(() => (browser.configs!.javascript_exec!.enabled = true)).toThrow(TypeError);
    expect(() => (browser.configs!.screenshot = { enabled: true })).toThrow(TypeError);
    expect(() => ((browser as any).configs = { javascript_exec: { enabled: true } })).toThrow(TypeError);
    expect(browser.configs!.javascript_exec).toEqual({ enabled: false });
    expect(entry.cache_control).toEqual({ type: 'ephemeral' });
    // A null configs entry is the wire type's own spelling of "defaults": accepted, sent as given, member on.
    const nulled = new Nav({ configs: { navigate: null, screenshot: null } });
    expect(nulled.toJSON().configs?.navigate).toBeNull();
    expect(nulled.toJSON().configs?.screenshot).toEqual({ enabled: false }); // not implemented by Nav
    // What is checked and gated on is the copy that is sent: an `enabled` JSON carries (a getter included) counts, one
    // it does not (a prototype property) leaves the member at its default on the wire and in the gate alike.
    const viaGetter = new Nav({
      configs: { navigate: Object.defineProperty({}, 'enabled', { get: () => false, enumerable: true }) },
    });
    expect(viaGetter.toJSON().configs?.navigate).toEqual({ enabled: false });
    expect(
      new Nav({ configs: { navigate: Object.create({ enabled: false }) } }).toJSON().configs?.navigate,
    ).toEqual({});
    // toJSON() returns a fresh, editable copy each call: nothing done to it reaches the toolset or the next request.
    const sent = browser.toJSON();
    sent.configs!.navigate!.enabled = false;
    sent.configs!.hover = { enabled: true };
    sent.cache_control!.ttl = '1h';
    expect(browser.toJSON()).toEqual(entry);
    expect(browser.configs!.navigate).toEqual({ defer_loading: true });
    // toolConfigs fields are copied onto the entry as given, a null included.
    expect(new Nav({ toolConfigs: { cache_control: null } }).toJSON()).toHaveProperty('cache_control', null);
    // toolConfigs is copied once at construction: a later change to the object you passed never reaches a request.
    const passed: { cache_control: { type: 'ephemeral'; ttl?: '1h' } } = {
      cache_control: { type: 'ephemeral' },
    };
    const held = new Nav({ toolConfigs: passed });
    const before = held.toJSON();
    passed.cache_control.ttl = '1h';
    Object.assign(passed, { max_uses: 3 });
    expect(held.toJSON()).toEqual(before);
    expect(held.toJSON()).not.toHaveProperty('max_uses');
    // the entry's fields are on what toJSON() returns, not on the instance
    expect(held).not.toHaveProperty('cache_control');
    // each toJSON() is its own deep copy
    const first = held.toJSON();
    first.cache_control!.ttl = '1h';
    expect(held.toJSON().cache_control).toEqual({ type: 'ephemeral' });
    expect(held.toJSON().cache_control).not.toBe(held.toJSON().cache_control);
  });

  test("toolConfigs cannot set the configs of the entry, and its type is always the class's", () => {
    expectConfigError(
      () => new Nav({ toolConfigs: { configs: { navigate: { enabled: false } } } as any }),
      /toolConfigs sets "configs".*configs option/,
    );
    expectConfigError(
      () => new Nav({ toolConfigs: { cache_control: null, configs: {} } as any }),
      /toolConfigs sets "configs"/,
    );
    expect(() => new Nav({ toolConfigs: { cache_control: { type: 'ephemeral' } } })).not.toThrow();
    expect(new Nav({ toolConfigs: { type: 'x' } as any }).toJSON().type).toBe('browser_toolset_20260801');
  });

  test('a subclass that overrides execute serves every member and turns members off with configs', async () => {
    class Remote extends Base {
      protected override async execute(): Promise<never> {
        throw new ToolError('remote is down');
      }
    }
    // A class that overrides execute serves every member, whether or not it also implements member methods: the SDK
    // cannot tell which members the override answers, so it offers them all (the wire entry disables nothing) and the
    // driver turns off what it does not serve through configs.
    expect(JSON.parse(JSON.stringify(new Remote())).configs).toBeUndefined();
    expect(new Remote().configs).toBeNull();
    const trimmed = JSON.parse(
      JSON.stringify(new Remote({ configs: { screenshot: { enabled: false }, zoom: { enabled: false } } })),
    );
    expect(trimmed.configs).toEqual({ screenshot: { enabled: false }, zoom: { enabled: false } });
    // A subclass that only overrides member methods serves only those.
    expect(JSON.parse(JSON.stringify(new NavAndShot())).configs.hover).toEqual({ enabled: false });
    // One that adds hooks around super.execute also serves every member: a member it implements runs, one it does
    // not throws its "not available" ToolError inside super.execute, and configs turns off the rest.
    class Hooked extends NavAndShot {
      protected override async execute(...args: Parameters<Base['execute']>) {
        return super.execute(...args);
      }
      call(...args: Parameters<Base['execute']>) {
        return this.execute(...args);
      }
    }
    expect(JSON.parse(JSON.stringify(new Hooked())).configs).toBeUndefined();
    await expect(new Hooked().call(CTX, 'zoom', { region: [0, 0, 1, 1] })).rejects.toThrow(/not available/);
    expect(JSON.parse(JSON.stringify(new Hooked({ configs: { zoom: { enabled: false } } }))).configs).toEqual(
      {
        zoom: { enabled: false },
      },
    );
  });

  test('override detection follows the prototype chain and dynamic assignment', () => {
    class Grandchild extends NavAndShot {}
    expect(JSON.parse(JSON.stringify(new Grandchild())).configs.screenshot).toBeUndefined();
    class Assigned extends Base {}
    (Assigned.prototype as unknown as Record<string, unknown>)['hover'] = () => undefined;
    expect(JSON.parse(JSON.stringify(new Assigned())).configs.hover).toBeUndefined();
    // `type` lives under type_.
    class Typer extends Base {
      protected override type_(): void {}
    }
    expect(JSON.parse(JSON.stringify(new Typer())).configs.type).toBeUndefined();
  });
});

describe('execute', () => {
  test('dispatches to the member method and reports unimplemented members', async () => {
    const browser = new Nav();
    await expect(browser.dispatch('navigate', { url: 'https://a.test/' })).resolves.toEqual({
      url: 'https://a.test/',
      status: 200,
    });
    await expect(browser.dispatch('screenshot', {})).rejects.toThrow(
      "The browser toolset member 'screenshot' is not available in this environment.",
    );
    await expect(browser.dispatch('screenshot', {})).rejects.toBeInstanceOf(UnavailableMemberError);
  });
  test("Symbol.asyncDispose runs the subclass's close()", async () => {
    // A runtime without Symbol.asyncDispose gets it set here, so load the module again with it set.
    const key = ((Symbol as { asyncDispose?: symbol }).asyncDispose ??= Symbol.for('nodejs.asyncDispose'));
    let closed = 0;
    vi.resetModules();
    const { BetaAbstractBrowserToolset20260801: Fresh } = await import(
      '@anthropic-ai/sdk/helpers/beta/toolsets'
    );
    class Closing extends Fresh {
      protected override navigate(): BetaBrowserNavigateResult {
        return { url: '', status: 200 };
      }
      override async close(): Promise<void> {
        closed += 1;
        await super.close();
      }
    }
    // `await using browser = …` calls this at the end of the block.
    await (new Closing({ browserState: state }) as any)[key]();
    expect(closed).toBe(1);
  });
});
