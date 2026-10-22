/** The confirm approval gate. */
import type {
  BetaBrowserMemberResult,
  BetaToolsetCallContext,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import { ToolError, type BetaFilePolicy } from '@anthropic-ai/sdk/helpers/beta/toolsets';
import type { BetaBrowserMemberInput, BetaBrowserMemberName } from '@anthropic-ai/sdk/resources/beta';
import { FIELD_MAX } from '@anthropic-ai/sdk/lib/internal/toolsets/sanitize';
import { FakeBrowser, World, errorText, run, texts } from './fakes';

const CLICK = { target: { type: 'coordinate', x: 1, y: 1 } };
const DECLINED =
  "The user did not grant permission to run 'left_click'. Do not retry it unless the user asks you to.";
const FAILED =
  "Permission to run 'left_click' could not be obtained (the confirmation prompt failed). Do not retry it unless the user asks you to.";

describe('confirm gate', () => {
  test('confirm sees every call and a decline never reaches the driver', async () => {
    // The callable is asked before every member call that is about to run and decides by name (or anything else)
    // which ones it gates; a false never reaches the driver.
    const asked: string[] = [];
    const browser = new FakeBrowser({
      confirm: (ctx) => {
        asked.push(ctx.member);
        return ctx.member !== 'left_click' || asked.length > 2;
      },
    });
    expect(texts(await run(browser, 'get_page_text', {}))).toEqual(['Hello']);
    expect(await errorText(browser, 'left_click', CLICK)).toBe(DECLINED);
    expect(browser.world.calls).toEqual(['get_page_text']);
    expect(texts(await run(browser, 'left_click', CLICK))).toEqual(['Clicked.']);
    expect(asked).toEqual(['get_page_text', 'left_click', 'left_click']);
    // a call refused before dispatch (unknown or disabled member) is never asked about
    await expect(run(browser, 'teleport', {})).rejects.toBeInstanceOf(ToolError);
    expect(asked).toEqual(['get_page_text', 'left_click', 'left_click']);
  });

  test('enabling file_upload or javascript_exec requires confirm', async () => {
    const anyPath: BetaFilePolicy = {
      resolveUploadPaths: (_ctx, paths) => paths,
      resolveUploadDocuments: (_ctx, ids) => ids,
      isPathVisible: () => false,
    };
    const upload = { target: { type: 'ref', ref: 'e1' }, paths: ['/f'] };
    const options = { configs: { file_upload: { enabled: true } }, filePolicy: anyPath };
    expect(() => new FakeBrowser(options)).toThrow(/file_upload.*confirm/);
    // FakeBrowser does not serve javascript_exec, and enabling a member the subclass does not serve is a different error
    class Js extends FakeBrowser {
      protected override javascript_exec(): string {
        return '';
      }
    }
    expect(() => new Js({ configs: { javascript_exec: { enabled: true } } })).toThrow(
      /javascript_exec.*confirm/,
    );
    const asked: string[] = [];
    const browser = new FakeBrowser({
      ...options,
      confirm: (ctx) => {
        asked.push(ctx.member);
        return ctx.member !== 'file_upload';
      },
    });
    expect(await errorText(browser, 'file_upload', upload)).toBe(
      DECLINED.replace('left_click', 'file_upload'),
    );
    expect(asked).toEqual(['file_upload']);
    expect(browser.world.calls).toEqual([]);
    await run(new FakeBrowser({ ...options, confirm: () => true }), 'file_upload', upload); // approving is the opt-out
  });

  test('the context describes the target tab as of the last block and costs nothing unread', async () => {
    const seen: unknown[] = [];
    const byName = new FakeBrowser({
      confirm: (ctx) => {
        seen.push([ctx.member, ctx.toolUse?.id, ctx.input]);
        return true;
      },
    });
    await run(byName, 'left_click', CLICK, 'toolu_7');
    expect(seen.at(-1)).toEqual(['left_click', 'toolu_7', byName.world.inputs.at(-1)]);
    // a confirm that never looks at the tab costs no extra state read: one per call, as without confirm
    expect(byName.world.stateContexts.length).toBe(1);

    const browser = new FakeBrowser({
      confirm: (ctx) => {
        seen.push([ctx.tabURL, ctx.tabId]);
        return true;
      },
    });
    await run(browser, 'left_click', CLICK); // before any report there is no tab to describe
    expect(seen.at(-1)).toEqual([undefined, undefined]);
    await run(browser, 'navigate', { url: 'https://shop.example.com/cart?x=1' });
    await run(browser, 'left_click', CLICK);
    expect(seen.at(-1)).toEqual(['https://shop.example.com/cart?x=1', 'tab_1']);
    // reading the tab costs nothing either: it is described from the last report, with no page read
    expect(browser.world.stateContexts.length).toBe(1 + 1 + 1);
    // A call that names a tab is described by that tab, not the active one.
    browser.world.tabs['tab_2'] = { title: 'docs', url: 'https://docs.example.com/' };
    await run(browser, 'list_tabs', {});
    await run(browser, 'left_click', { ...CLICK, tab_id: 'tab_2' });
    expect(seen.at(-1)).toEqual(['https://docs.example.com/', 'tab_2']);
    await run(browser, 'navigate', { url: 'about:blank' });
    await run(browser, 'left_click', CLICK);
    expect(seen.at(-1)).toEqual(['about:blank', 'tab_1']);
    // tabURL is the URL as the model read it in the last block: the driver's string with line breaks, controls and
    // bidi characters folded to a space and the whole held to 4096 characters (a longer one is cut and begins with
    // `…`); credentials and everything else stay.
    browser.world.tabs['tab_1'] = {
      title: 't',
      url: 'https://user:pw@Example.COM/a\u202e)b \u2028' + 'c'.repeat(5000),
    };
    await run(browser, 'list_tabs', {});
    await run(browser, 'left_click', CLICK);
    const [shownUrl] = seen.at(-1) as [string];
    expect(shownUrl).toBe(
      '\u2026' + ('https://user:pw@Example.COM/a )b  ' + 'c'.repeat(5000)).slice(0, FIELD_MAX - 1),
    );
    expect(shownUrl).toHaveLength(FIELD_MAX);
    // a page can pad its URL so that the first 4,096 characters alone parse to a host other than the page's
    for (const padded of [
      'https://trusted.bank.com:' + '0'.repeat(4100) + '@evil.example/collect',
      'https://%74%72usted.bank.com' + '%C2%AD'.repeat(678) + 'zz@evil.example/collect',
    ]) {
      browser.world.tabs['tab_1'] = { title: 't', url: padded };
      await run(browser, 'list_tabs', {});
      await run(browser, 'left_click', CLICK);
      const [cutUrl] = seen.at(-1) as [string];
      expect(cutUrl.startsWith('\u2026')).toBe(true);
      expect(() => new URL(cutUrl)).toThrow();
    }
  });

  test('an approval covers the last report and the page is not read again', async () => {
    // confirm describes the tab as of the last block the model saw; the page can move after that report, and the
    // approved call runs wherever the tab is by then.
    const world = new World();
    const looked: unknown[] = [];
    const browser = new FakeBrowser({
      world,
      confirm: (ctx) => {
        looked.push(ctx.tabURL);
        return true;
      },
    });
    await run(browser, 'navigate', { url: 'https://shop.example.com/cart' });
    world.tabs['tab_1']!.url = 'https://elsewhere.example.net/next';
    expect(texts(await run(browser, 'left_click', CLICK))).toEqual(['Clicked.']);
    expect(looked.at(-1)).toBe('https://shop.example.com/cart');
    expect(browser.world.calls).toEqual(['navigate', 'left_click']);
    expect(browser.world.stateContexts.length).toBe(2); // one report per call, none for the prompt
    // The block that click produced showed the new page, so the next prompt describes it.
    await run(browser, 'left_click', CLICK);
    expect(looked.at(-1)).toBe('https://elsewhere.example.net/next');
  });

  test("what confirm reads is the report as given, not the driver's live objects", async () => {
    const live = { tab_id: 'tab_1', title: 'shop', url: 'https://shop.example.com/cart', active: true };
    const looked: unknown[] = [];
    const browser = new FakeBrowser({ confirm: (ctx) => (looked.push([ctx.tabURL, ctx.tabId]), true) });
    browser.world.stateOverride = { tabs: [live] };
    await run(browser, 'get_page_text', {});
    live.url = 'https://evil.example.net/';
    await run(browser, 'left_click', CLICK);
    expect(looked.at(-1)).toEqual(['https://shop.example.com/cart', 'tab_1']);
  });

  test('confirm is asked about a tab the last report did not list, with its id and no URL', async () => {
    const looked: unknown[] = [];
    const browser = new FakeBrowser({ confirm: (ctx) => (looked.push([ctx.tabId, ctx.tabURL]), true) });
    await run(browser, 'get_page_text', {});
    expect(await errorText(browser, 'navigate', { url: 'https://example.com/x', tab_id: 'tab_9' })).toBe(
      'No open tab with tab_id "tab_9".',
    );
    expect(looked.at(-1)).toEqual(['tab_9', undefined]);
    expect(browser.world.calls).toEqual(['get_page_text', 'navigate']);
  });

  test.each([0, false])(
    'a tab_id of %s is shown to confirm as sent, not as the active tab',
    async (tabId) => {
      const looked: unknown[] = [];
      const browser = new FakeBrowser({ confirm: (ctx) => (looked.push([ctx.tabId, ctx.tabURL]), true) });
      await run(browser, 'get_page_text', {});
      await run(browser, 'left_click', { ...CLICK, tab_id: tabId });
      expect(looked.at(-1)).toEqual([tabId, undefined]);
      expect(browser.world.inputs.at(-1)?.['tab_id']).toBe(tabId);
    },
  );

  test.each([null, ''])('a tab_id of %j names no tab, so confirm is shown the active one', async (tabId) => {
    const looked: unknown[] = [];
    const browser = new FakeBrowser({ confirm: (ctx) => (looked.push([ctx.tabId, ctx.tabURL]), true) });
    await run(browser, 'navigate', { url: 'https://shop.example.com/' });
    await run(browser, 'left_click', { ...CLICK, tab_id: tabId });
    expect(looked.at(-1)).toEqual(['tab_1', 'https://shop.example.com/']);
  });

  test('a confirm that throws refuses the call; a ToolError is relayed', async () => {
    const broken = new FakeBrowser({
      confirm: () => {
        throw new Error('tty closed');
      },
    });
    expect(await errorText(broken, 'left_click', CLICK)).toBe(FAILED);
    const refusing = new FakeBrowser({
      confirm: () => {
        throw new ToolError('clicks are disabled after 5pm');
      },
    });
    expect(await errorText(refusing, 'left_click', CLICK)).toBe('clicks are disabled after 5pm');
  });

  test('the text of a ToolError out of your confirm or urlPolicy is cut to the field limit', async () => {
    const long = 'x'.repeat(FIELD_MAX + 100);
    const confirming = new FakeBrowser({
      confirm: () => {
        throw new ToolError(long);
      },
    });
    expect(await errorText(confirming, 'left_click', CLICK)).toBe('x'.repeat(FIELD_MAX));
    const policed = new FakeBrowser({
      urlPolicy: () => {
        throw new ToolError(long);
      },
    });
    expect(await errorText(policed, 'navigate', { url: 'https://example.com/' })).toBe('x'.repeat(FIELD_MAX));
  });

  test('a confirm that does not answer true declines the call', async () => {
    const vague = new FakeBrowser({ confirm: () => 'yes' as never });
    expect(await errorText(vague, 'left_click', CLICK)).toBe(DECLINED);
    expect(vague.world.calls).toEqual([]);
  });

  test('the gate runs before an execute override', async () => {
    const reached: string[] = [];
    class Hooked extends FakeBrowser {
      protected override async execute(
        ctx: BetaToolsetCallContext,
        name: BetaBrowserMemberName,
        input: BetaBrowserMemberInput,
      ): Promise<BetaBrowserMemberResult> {
        reached.push(name);
        return super.execute(ctx, name, input);
      }
    }
    await expect(run(new Hooked({ confirm: () => false }), 'left_click', CLICK)).rejects.toBeInstanceOf(
      ToolError,
    );
    expect(reached).toEqual([]);
  });

  test('the URL policy runs before confirm', async () => {
    const asked: string[] = [];
    const browser = new FakeBrowser({
      urlPolicy: (_ctx, url) => {
        if (url.includes('internal')) throw new ToolError('blocked: internal');
      },
      confirm: (ctx) => {
        asked.push(ctx.member);
        return true;
      },
    });
    await expect(run(browser, 'navigate', { url: 'https://wiki.internal/' })).rejects.toThrow(/blocked/);
    expect(asked).toEqual([]);
  });

  test('confirm may be async', async () => {
    const browser = new FakeBrowser({ confirm: async (ctx) => ctx.member !== 'left_click' });
    expect(await errorText(browser, 'left_click', CLICK)).toBe(DECLINED);
    expect(texts(await run(browser, 'get_page_text', {}))).toEqual(['Hello']);
  });
});
