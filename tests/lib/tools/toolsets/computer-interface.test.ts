/**
 * The abstract computer class without its pipeline: construction rules, override detection, the wire entry,
 * and `execute` dispatch.
 */
import type { BetaToolsetCallContext } from '@anthropic-ai/sdk/helpers/beta/toolsets';
import {
  BetaAbstractComputerToolset20260801,
  ToolsetConfigError,
  ToolsetUsageError,
  ToolError,
  UnavailableMemberError,
  UnknownMemberError,
  type BetaComputerCursorPositionResult,
  type BetaScreenshotResult,
  type BetaComputerToolsetOptions,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import { BETA_COMPUTER_MEMBER_NAME_VALUES } from '@anthropic-ai/sdk/resources/beta';
import type { BetaComputerLeftClickInput } from '@anthropic-ai/sdk/resources/beta';

const CTX = {} as BetaToolsetCallContext;
const approve = () => true;

class Base extends BetaAbstractComputerToolset20260801 {
  constructor(options: BetaComputerToolsetOptions = {}) {
    super(options);
  }
  /** Reach the protected dispatch layer from the tests. */
  dispatch(name: string, input: unknown): Promise<unknown> {
    return this.execute(CTX, name as never, input as never);
  }
}

class Click extends Base {
  protected override left_click(_ctx: BetaToolsetCallContext, input: BetaComputerLeftClickInput): string {
    return `at ${input.coordinate?.join(',')}`;
  }
}

class ClickAndShot extends Click {
  protected override async screenshot(): Promise<BetaScreenshotResult> {
    return { data: 'iVBORw0KGgo=' };
  }
  protected override cursor_position(): BetaComputerCursorPositionResult {
    return { x: 1, y: 2 };
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
  test('a class that serves no member is built with every member disabled', () => {
    class Nothing extends Base {}
    const entry = JSON.parse(JSON.stringify(new Nothing()));
    expect(entry.configs).toEqual(
      Object.fromEntries(BETA_COMPUTER_MEMBER_NAME_VALUES.map((name) => [name, { enabled: false }])),
    );
    // also built when configs turn off the one member the class implements
    expect(() => new Click({ configs: { left_click: { enabled: false } } })).not.toThrow();
    // an execute-only subclass serves every member, with or without configs
    class Remote extends Base {
      protected override async execute(): Promise<never> {
        throw new ToolError('remote is down');
      }
    }
    expect(() => new Remote({ confirm: approve })).not.toThrow();
    expect(() => new Remote({ confirm: approve, configs: { zoom: { enabled: false } } })).not.toThrow();
  });

  test('confirm is optional while none of type, key and hold_key is enabled', () => {
    expect(() => new Click()).not.toThrow();
    expect(() => new Click({ confirm: approve })).not.toThrow();
    expect(new ToolsetConfigError('x')).toBeInstanceOf(ToolsetUsageError);
  });

  describe('type, key and hold_key need a confirm callable', () => {
    class Typing extends Base {
      protected override type_(): void {}
    }
    class Keying extends Base {
      protected override key(): void {}
    }
    class Holding extends Base {
      protected override hold_key(): void {}
    }
    class Remote extends Base {
      protected override async execute(): Promise<never> {
        throw new ToolError('remote is down');
      }
    }

    test.each([
      ['type', Typing],
      ['key', Keying],
      ['hold_key', Holding],
    ] as const)('a class that serves %s is refused without one, and built with one', (name, Serving) => {
      expectConfigError(() => new Serving(), new RegExp(`\\["${name}"\\] requires a confirm callable`));
      expect(() => new Serving({ confirm: approve })).not.toThrow();
    });

    test.each([
      ['type', Typing],
      ['key', Keying],
      ['hold_key', Holding],
    ] as const)('a class that serves %s is built without one when configs turn it off', (name, Serving) => {
      expect(() => new Serving({ configs: { [name]: { enabled: false } } })).not.toThrow();
      expect(() => new Serving({ configs: { [name]: null } })).toThrow(ToolsetConfigError);
    });

    test('the message names every member that is enabled, in order', () => {
      expectConfigError(() => new Remote(), /\["hold_key","key","type"\] requires a confirm callable/);
      expectConfigError(
        () => new Remote({ configs: { key: { enabled: false } } }),
        /\["hold_key","type"\] requires a confirm callable/,
      );
    });

    test('an execute-only class is built without one only when all three are turned off', () => {
      const off = { enabled: false };
      expect(() => new Remote({ configs: { type: off, key: off, hold_key: off } })).not.toThrow();
      expectConfigError(
        () => new Remote({ configs: { type: off, key: off } }),
        /\["hold_key"\] requires a confirm callable/,
      );
      expect(() => new Remote({ confirm: approve })).not.toThrow();
    });
  });
});

describe('the wire entry', () => {
  test('unimplemented members are sent as enabled:false and nothing else leaks', () => {
    const entry = JSON.parse(JSON.stringify(new ClickAndShot()));
    expect(Object.keys(entry).sort()).toEqual(['configs', 'type']);
    expect(entry.type).toBe('computer_toolset_20260801');
    expect(entry.configs.left_click).toBeUndefined();
    expect(entry.configs.screenshot).toBeUndefined();
    expect(entry.configs.cursor_position).toBeUndefined();
    expect(entry.configs.zoom).toEqual({ enabled: false });
    expect(entry.configs.type).toEqual({ enabled: false });
    expect(Object.keys(entry.configs)).toHaveLength(14);
    // Spreading a toolset copies no callbacks: the resolved options are private.
    const toolset = new ClickAndShot({
      confirm: () => true,
      toolConfigs: { cache_control: { type: 'ephemeral' } },
    });
    expect(Object.keys({ ...toolset }).sort()).toEqual(['toolsetName', 'type']);
    expect(toolset.toJSON().cache_control).toEqual({ type: 'ephemeral' });
    expect(Object.keys({ ...new ClickAndShot() }).sort()).toEqual(['toolsetName', 'type']);
    expect(toolset.toolsetName).toBe('computer');
  });

  test("the caller's configs are copied through; enabling an unimplemented member is a config error", () => {
    const toolset = new Click({
      configs: { left_click: { defer_loading: true }, zoom: { defer_loading: false } },
      toolConfigs: { cache_control: { type: 'ephemeral' } },
    });
    const entry = JSON.parse(JSON.stringify(toolset));
    expect(entry.configs.left_click).toEqual({ defer_loading: true });
    expect(entry.configs.zoom).toEqual({ defer_loading: false, enabled: false });
    expect(entry.cache_control).toEqual({ type: 'ephemeral' });
    expect(() => new Click({ configs: { zoom: { enabled: true } } })).toThrow(/does not implement.*zoom/);
    // toolConfigs cannot set the entry's configs: the configs option does.
    expect(() => new Click({ toolConfigs: { configs: {} } as any })).toThrow(/toolConfigs sets "configs"/);
    // The wire configs are frozen and read-only.
    expect(() => ((toolset.configs as any).zoom.enabled = true)).toThrow(TypeError);
    expect(() => ((toolset as any).configs = {})).toThrow(TypeError);
    expect(toolset.configs!.zoom).toEqual({ defer_loading: false, enabled: false });
    // toJSON() returns a fresh, editable copy each call.
    const sent = toolset.toJSON() as any;
    sent.configs.zoom.enabled = true;
    expect(toolset.toJSON()).toEqual(entry);
    // A null entry is the wire type's own spelling of "defaults".
    expect((new Click({ configs: { left_click: null } }).toJSON() as any).configs.left_click).toBeNull();
  });

  test('a subclass that overrides execute serves every member and turns members off with configs', async () => {
    class Remote extends Base {
      protected override async execute(): Promise<never> {
        throw new ToolError('remote is down');
      }
    }
    expect(JSON.parse(JSON.stringify(new Remote({ confirm: approve }))).configs).toBeUndefined();
    expect(new Remote({ confirm: approve }).configs).toBeNull();
    const trimmed = JSON.parse(
      JSON.stringify(new Remote({ confirm: approve, configs: { zoom: { enabled: false } } })),
    );
    expect(trimmed.configs).toEqual({ zoom: { enabled: false } });
    class Hooked extends ClickAndShot {
      protected override async execute(...args: Parameters<Base['execute']>) {
        return super.execute(...args);
      }
    }
    expect(JSON.parse(JSON.stringify(new Hooked({ confirm: approve }))).configs).toBeUndefined();
    await expect(new Hooked({ confirm: approve }).dispatch('zoom', { region: [0, 0, 1, 1] })).rejects.toThrow(
      /not available/,
    );
  });

  test('override detection follows the prototype chain, dynamic assignment and type_', () => {
    class Grandchild extends ClickAndShot {}
    expect(JSON.parse(JSON.stringify(new Grandchild())).configs.screenshot).toBeUndefined();
    class Assigned extends Base {}
    (Assigned.prototype as unknown as Record<string, unknown>)['wait'] = () => undefined;
    expect(JSON.parse(JSON.stringify(new Assigned())).configs.wait).toBeUndefined();
    class Typer extends Base {
      protected override type_(): void {}
    }
    expect(JSON.parse(JSON.stringify(new Typer({ confirm: approve }))).configs.type).toBeUndefined();
    expect(JSON.parse(JSON.stringify(new Typer({ confirm: approve }))).configs.key).toEqual({
      enabled: false,
    });
  });
});

describe('execute', () => {
  test('dispatches to the member method and reports unimplemented members with the family named', async () => {
    const toolset = new Click();
    await expect(toolset.dispatch('left_click', { coordinate: [3, 4] })).resolves.toBe('at 3,4');
    await expect(toolset.dispatch('screenshot', {})).rejects.toThrow(
      "The computer toolset member 'screenshot' is not available in this environment.",
    );
    await expect(toolset.dispatch('screenshot', {})).rejects.toBeInstanceOf(UnavailableMemberError);
    // A model-supplied name never reaches a non-member property.
    await expect(toolset.dispatch('constructor', {})).rejects.toBeInstanceOf(ToolError);
    await expect(toolset.dispatch('toJSON', {})).rejects.toThrow("unknown computer toolset member 'toJSON'");
    await expect(toolset.dispatch('toJSON', {})).rejects.toBeInstanceOf(UnknownMemberError);
    // the browser-only member names are unknown here
    await expect(toolset.dispatch('navigate', {})).rejects.toBeInstanceOf(UnknownMemberError);
  });

  test("Symbol.asyncDispose runs the subclass's close()", async () => {
    const key = ((Symbol as { asyncDispose?: symbol }).asyncDispose ??= Symbol.for('nodejs.asyncDispose'));
    let closed = 0;
    vi.resetModules();
    const { BetaAbstractComputerToolset20260801: Fresh } = await import(
      '@anthropic-ai/sdk/helpers/beta/toolsets'
    );
    class Closing extends Fresh {
      protected override wait(): void {}
      override async close(): Promise<void> {
        closed += 1;
        await super.close();
      }
    }
    await (new Closing() as any)[key]();
    expect(closed).toBe(1);
  });
});
