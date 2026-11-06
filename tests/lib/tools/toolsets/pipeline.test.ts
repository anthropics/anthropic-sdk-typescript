/**
 * `run()` — the pipeline around `execute()` — and the renderer: what the model sees per result kind,
 * refusals, driver errors, held-back state changes, `execute` as a hook, serialization.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AnthropicError, APIUserAbortError } from '@anthropic-ai/sdk';
import type { BetaToolRunContext } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { runToolsetMember } from '@anthropic-ai/sdk/lib/internal/toolsets/run';
import type { BetaRunnableToolset } from '@anthropic-ai/sdk/lib/tools/BetaRunnableToolset';
import {
  FIELD_MAX,
  boundedTabURL,
  oneLine,
  quotedName,
} from '@anthropic-ai/sdk/lib/internal/toolsets/sanitize';
import type {
  BetaBrowserMemberResult,
  BetaToolsetCallContext,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import {
  BetaAbstractBrowserToolset20260801,
  ToolsetClosedError,
  ToolsetConfigError,
  ToolsetContractError,
  ToolsetUsageError,
  ToolError,
  type BetaBrowserToolsetOptions,
  type BetaNavigationRefused,
  type BetaDialogDismissed,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import type {
  BetaBrowserLeftClickInput,
  BetaBrowserMemberInput,
  BetaBrowserMemberName,
  BetaBrowserNewTabInput,
} from '@anthropic-ai/sdk/resources/beta';
import {
  FakeBrowser,
  World,
  ctxFor,
  errorText,
  run,
  stateBlock,
  stateChanges,
  texts,
  toolUse,
} from './fakes';
import { setupRunner } from './runner-helpers';

const CLICK = { target: { type: 'ref', ref: 'e1' } };

type PerSDK<T> = T | { py: T; ts: T };
const expandRepeats = (text: string): string =>
  text.replace(/\{(.)\*(\d+)\}/gu, (_, c: string, n: string) => c.repeat(Number(n)));
/**
 * `text_cases.json`, the table both SDKs' tests read for the text folds: `{c*N}` stands for N copies of the character
 * c, and where the SDKs differ on purpose a row gives `{ py, ts }`.
 */
const TEXT_CASES: ReadonlyArray<readonly [string, string, string]> = (
  JSON.parse(fs.readFileSync(path.join(__dirname, 'text_cases.json'), 'utf8')) as {
    fn: 'one_line' | 'quoted_name';
    input: string;
    shown: PerSDK<string>;
  }[]
).map(({ fn, input, shown }) => [
  fn,
  expandRepeats(input),
  expandRepeats(typeof shown === 'string' ? shown : shown.ts),
]);

describe('text folds', () => {
  test.each(TEXT_CASES)('page and model text is folded the same in both SDKs (%#: %s)', (fn, raw, shown) => {
    expect({ one_line: oneLine, quoted_name: quotedName }[fn as 'one_line' | 'quoted_name'](raw)).toBe(shown);
  });
});

describe('rendering', () => {
  test('navigate renders one line and attaches the browser_state block', async () => {
    const browser = new FakeBrowser();
    const content = await run(browser, 'navigate', { url: 'https://example.com/' });
    expect(content).toEqual([
      { type: 'text', text: 'Navigated to https://example.com/ — Title of https://example.com/ (HTTP 200)' },
      {
        type: 'browser_state',
        tabs: [
          {
            tab_id: 'tab_1',
            title: 'Title of https://example.com/',
            url: 'https://example.com/',
            active: true,
          },
        ],
      },
    ]);
    // The member and the state callable both saw the context of the call they answered.
    expect(browser.world.contexts[0]!.toolUse?.id).toBe('toolu_1');
    expect(browser.world.stateContexts[0]).toBe(browser.world.contexts[0]);
  });

  test('navigate line folds control characters and omits absent fields', async () => {
    class Odd extends FakeBrowser {
      protected override async navigate() {
        return { url: 'https://example.com/a\nb', title: 'x‮y' } as any;
      }
    }
    expect(texts(await run(new Odd(), 'navigate', { url: 'https://example.com/' }))[0]).toBe(
      'Navigated to https://example.com/a b — x y', // a line break in the address or the title is folded to a space
    );
    // the landed address is the page's choice through redirects: it reaches the line as the driver reported it, held
    // to the field limit
    class Redirecting extends FakeBrowser {
      protected override async navigate() {
        return { url: 'https://user@accounts.example.com/' + 'a'.repeat(5000) };
      }
    }
    expect(texts(await run(new Redirecting(), 'navigate', { url: 'https://x.test/' }))[0]).toBe(
      'Navigated to \u2026' +
        ('https://user@accounts.example.com/' + 'a'.repeat(5000)).slice(0, FIELD_MAX - 1),
    );
  });

  test('pure actions render their confirmation from the input', async () => {
    const browser = new FakeBrowser();
    expect(texts(await run(browser, 'left_click', CLICK))).toEqual(['Clicked.']);
    expect(
      texts(
        await run(browser, 'scroll', {
          scroll_direction: 'down',
          target: { type: 'coordinate', x: 1, y: 2 },
        }),
      ),
    ).toEqual(['Scrolled down.']);
    expect(texts(await run(browser, 'scroll_to', { target: { type: 'ref', ref: '{text}' } }))).toEqual([
      'Scrolled to {text}.',
    ]);
    expect(texts(await run(browser, 'key', { text: 'ctrl+ a' }))).toEqual(['Pressed ctrl+ a.']);
    expect(texts(await run(browser, 'hold_key', { text: 'shift', duration: 1.5 }))).toEqual([
      'Held shift for 1.5s.',
    ]);
  });

  test('a pure action may return one line of text, read after its acknowledgment', async () => {
    // The line is page-shaped: folded to one line like a title. It is its own text block, after the acknowledgment's.
    let returned: string | undefined = 'Opened menu\nwith 3 items from /var/task/menu.json';
    class Chatty extends BetaAbstractBrowserToolset20260801 {
      protected override async left_click(
        _ctx: BetaToolsetCallContext,
        _input: BetaBrowserLeftClickInput,
      ): Promise<void | string> {
        return returned;
      }
    }
    const world = new World();
    world.tabs['tab_1'] = { title: 'Example', url: 'https://example.com/' };
    const browser = new Chatty({ browserState: world.state });
    const click = () => browser.run(ctxFor('left_click', CLICK), toolUse('left_click', CLICK));
    const content = await click();
    expect(texts(content)).toEqual(['Clicked.', 'Opened menu with 3 items from /var/task/menu.json']);
    expect(content.map((b) => b.type)).toEqual(['text', 'text', 'browser_state']);
    // an address stays as the driver wrote it
    returned = 'Opened https://u:p@example.com/menu';
    expect(texts(await click())).toEqual(['Clicked.', 'Opened https://u:p@example.com/menu']);
    returned = undefined;
    expect(texts(await click())).toEqual(['Clicked.']);
    // an empty or blank line adds nothing; anything but a string renders as no line
    returned = ' \n ';
    expect(texts(await click())).toEqual(['Clicked.']);
    returned = 3 as unknown as string;
    expect(texts(await click())).toEqual(['Clicked.']);
    // the line is bounded like every other page-supplied value the SDK writes into its own text
    returned = 'x'.repeat(10_000);
    expect(texts(await click())).toEqual(['Clicked.', 'x'.repeat(FIELD_MAX)]);
  });

  test('screenshot renders one image block as returned', async () => {
    const [image] = await run(new FakeBrowser(), 'screenshot', {});
    expect(image).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' },
    });
  });

  test('text members render verbatim and empty text gets a placeholder', async () => {
    const browser = new FakeBrowser();
    browser.world.pageText = '  <b>hi</b>\n';
    expect(texts(await run(browser, 'get_page_text', {}))).toEqual(['  <b>hi</b>\n']);
    browser.world.pageText = '';
    expect(texts(await run(browser, 'get_page_text', {}))).toEqual(['(empty)']);
    // page text can carry an unpaired surrogate (legal in the DOM); it could not be sent, so it becomes U+FFFD
    browser.world.pageText = 'a\ud83dz';
    expect(texts(await run(browser, 'get_page_text', {}))).toEqual(['a\ufffdz']);
  });

  test('tab members render the browser_state block alone', async () => {
    const browser = new FakeBrowser();
    const opened = await run(browser, 'new_tab', {});
    expect(opened).toEqual([
      {
        type: 'browser_state',
        tabs: [
          { tab_id: 'tab_1', title: 'Blank', url: 'about:blank', active: false },
          { tab_id: 'tab_2', title: '', url: 'about:blank', active: true },
        ],
        state_changes: [{ type: 'tab_opened', tab_id: 'tab_2' }],
      },
    ]);
    expect((await run(browser, 'list_tabs', {})).map((b) => b.type)).toEqual(['browser_state']);
    expect((await run(browser, 'switch_tab', { tab_id: 'tab_1' })).map((b) => b.type)).toEqual([
      'browser_state',
    ]);
    expect((await run(browser, 'close_tab', { tab_id: 'tab_2' })).map((b) => b.type)).toEqual([
      'browser_state',
    ]);
    expect(stateBlock(await run(browser, 'list_tabs', {})).tabs.map((t) => t.tab_id)).toEqual(['tab_1']);
  });

  test('state changes pass through and download paths stay hidden without a file policy', async () => {
    const browser = new FakeBrowser();
    browser.world.changes = [
      {
        type: 'download_started',
        download_id: 'dl_1',
        url: 'https://example.com/a.pdf',
        path: '/tmp/a',
      } as any,
      {
        type: 'download_completed',
        download_id: 'dl_2',
        url: 'https://example.com/b.pdf',
        path: '/tmp/b',
        size_bytes: 3,
      },
      {
        type: 'download_failed',
        download_id: 'dl_3',
        url: 'https://example.com/c.pdf',
        path: '/tmp/c',
      } as any,
    ];
    // a path is dropped from whichever download change carries it, not only the completed one
    expect(stateBlock(await run(browser, 'get_page_text', {})).state_changes).toEqual([
      { type: 'download_started', download_id: 'dl_1', url: 'https://example.com/a.pdf' },
      { type: 'download_completed', download_id: 'dl_2', url: 'https://example.com/b.pdf', size_bytes: 3 },
      { type: 'download_failed', download_id: 'dl_3', url: 'https://example.com/c.pdf' },
    ]);
    // Nothing to report is an absent field, never an empty list.
    expect(stateBlock(await run(browser, 'get_page_text', {}))).not.toHaveProperty('state_changes');
  });

  test("the block holds copies of the driver's tab entries and state changes", async () => {
    // A driver that keeps and later mutates the objects it reported cannot change a result that was already returned
    // (the runner sends earlier tool results again with every turn).
    const browser = new FakeBrowser();
    browser.world.tabs['tab_2'] = { title: 'popup', url: 'https://example.com/popup' };
    const opened = { type: 'tab_opened' as const, tab_id: 'tab_2' };
    const started = { type: 'download_started' as const, download_id: 'dl_1', url: 'https://example.com/a' };
    browser.world.changes = [opened, started];
    const block = stateBlock(await run(browser, 'get_page_text', {}));
    const rendered = JSON.parse(JSON.stringify(block));
    (opened as any).tab_id = 'tab_9';
    (opened as any).title = 'injected';
    started.url = 'https://evil.test/b';
    expect(block).toEqual(rendered);
    expect(block.state_changes).toEqual([
      { type: 'tab_opened', tab_id: 'tab_2' },
      { type: 'download_started', download_id: 'dl_1', url: 'https://example.com/a' },
    ]);
    expect(block.state_changes?.[0]).not.toBe(opened);
    expect(block.state_changes?.[1]).not.toBe(started);
  });

  test('a download path is exposed only when the file policy answers true', async () => {
    // The answer is awaited, so an async policy answers like a sync one.
    const change = {
      type: 'download_completed',
      download_id: 'dl_1',
      url: 'https://example.com/a',
      size_bytes: 1,
    };
    const policyAnswering = (answer: unknown) => ({
      resolveUploadPaths: () => [],
      resolveUploadDocuments: () => [],
      isPathVisible: () => answer as boolean,
    });
    for (const [answer, exposed] of [
      [true, true],
      [false, false],
      [Promise.resolve(false), false],
      [Promise.resolve(true), true],
    ] as const) {
      const browser = new FakeBrowser({ filePolicy: policyAnswering(answer) });
      browser.world.changes = [{ ...change, path: '/tmp/a' } as any];
      const [reported] = stateChanges(await run(browser, 'get_page_text', {}));
      expect('path' in reported!).toBe(exposed);
    }
    // any other answer keeps the path hidden, even a truthy one, and so does a promise of one
    for (const answer of [1, undefined, null, Promise.resolve(1)]) {
      const browser = new FakeBrowser({ filePolicy: policyAnswering(answer) });
      browser.world.changes = [{ ...change, path: '/tmp/a' } as any];
      const [reported] = stateChanges(await run(browser, 'get_page_text', {}));
      expect('path' in reported!).toBe(false);
    }
    // a policy that throws on a path fails closed: the path is hidden and the change still reaches the model
    const raising = new FakeBrowser({
      filePolicy: {
        ...policyAnswering(true),
        isPathVisible: (path: string) => {
          throw new Error(path);
        },
      },
    });
    raising.world.changes = [{ ...change, path: '/tmp/a' } as any];
    expect(stateBlock(await run(raising, 'get_page_text', {})).state_changes).toEqual([change]);
    // a policy written async that rejects, or one that returns a rejected promise, fails closed the same way, and the
    // rejection is handled rather than left to end the process
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      for (const rejecting of [
        () => Promise.reject(new Error('boom')),
        async () => {
          throw new Error('boom');
        },
      ]) {
        const browser = new FakeBrowser({
          filePolicy: { ...policyAnswering(true), isPathVisible: rejecting as any },
        });
        browser.world.changes = [{ ...change, path: '/tmp/a' } as any];
        expect(stateBlock(await run(browser, 'get_page_text', {})).state_changes).toEqual([change]);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    // a policy that raises the SDK's usage error is the application's mistake and propagates
    const misusing = new FakeBrowser({
      filePolicy: {
        ...policyAnswering(true),
        isPathVisible: () => {
          throw new ToolsetConfigError('bad policy');
        },
      },
    });
    misusing.world.changes = [{ ...change, path: '/tmp/a' } as any];
    await expect(run(misusing, 'get_page_text', {})).rejects.toBeInstanceOf(ToolsetUsageError);
    // an exposed path is page-shaped (a server's Content-Disposition name): one that folding or the length bound
    // would change could name another file, so it is withheld
    const exposing = new FakeBrowser({ filePolicy: policyAnswering(true) });
    for (const path of ['/tmp/evil\n- tab_9 x\u202e', '/tmp/invoice.pdf ', '/tmp/' + 'p'.repeat(FIELD_MAX)]) {
      exposing.world.changes = [{ ...change, path } as any];
      expect(stateChanges(await run(exposing, 'get_page_text', {}))[0]).not.toHaveProperty('path');
    }
    exposing.world.changes = [{ ...change, path: '/tmp/invoice.pdf' } as any];
    expect(stateChanges(await run(exposing, 'get_page_text', {}))[0]?.path).toBe('/tmp/invoice.pdf');
  });
});

describe('refusals', () => {
  test('refusals before dispatch read as tool errors and never reach the driver', async () => {
    const browser = new FakeBrowser({ configs: { navigate: { enabled: false } } });
    expect(await errorText(browser, 'teleport', {})).toBe("Error: unknown browser toolset member 'teleport'");
    expect(await errorText(browser, "x'‮\ninjected", {})).toBe(
      "Error: unknown browser toolset member 'x injected'",
    );
    expect(await errorText(browser, 'navigate', { url: 'https://example.com/' })).toBe(
      "The 'navigate' action is not permitted by this application's permissions and cannot be used in this session.",
    );
    // Not implemented by the fake and not configured: not available, rather than not permitted.
    expect(await errorText(browser, 'javascript_exec', { text: '1' })).toBe(
      "The browser toolset member 'javascript_exec' is not available in this environment.",
    );
    expect(await errorText(browser, 'find', { query: 'q' })).toBe(
      "The browser toolset member 'find' is not available in this environment.",
    );
    expect(browser.world.calls).toEqual([]);
  });

  test("navigate's url is checked before the URL policy reads it", async () => {
    // a deny-list policy written for a string would let an array through: ['https://blocked'].includes('blocked') is false
    const browser = new FakeBrowser({
      urlPolicy: (_ctx, url) => {
        if (url.includes('blocked')) throw new ToolError('That site is blocked.');
      },
    });
    for (const url of [['https://blocked'], 42, undefined]) {
      expect(await errorText(browser, 'navigate', { url })).toBe(
        "invalid input for browser member 'navigate': url: expected a string",
      );
    }
    expect(await errorText(browser, 'navigate', { url: 'https://blocked' })).toBe('That site is blocked.');
    expect(browser.world.calls).toEqual([]);
  });

  test("a file_upload value that is not a list of strings can't skip or reach the file policy", async () => {
    const enable = { configs: { file_upload: { enabled: true } }, confirm: () => true };
    // anything but an absent or empty list of strings is refused as the model's input error
    const bare = new FakeBrowser(enable);
    for (const input of [
      { paths: 'a' },
      { paths: '' },
      { paths: [1] },
      { paths: { 0: 'a' } },
      { paths: { length: 0, 0: '/x' } },
      { document_ids: 7 },
      { document_ids: { length: 0, 0: 'doc' } },
    ]) {
      expect(await errorText(bare, 'file_upload', input)).toMatch(
        /^invalid input for browser member 'file_upload': (paths|document_ids): expected a list of strings$/,
      );
    }
    await run(bare, 'file_upload', { paths: [], document_ids: null });
    expect(bare.world.calls).toEqual(['file_upload']);
    // with a file policy too: the policy is never handed such a value
    const seen: unknown[] = [];
    const vetting = new FakeBrowser({
      ...enable,
      filePolicy: {
        resolveUploadPaths: (_ctx, paths) => (seen.push(paths), ['/vetted']),
        resolveUploadDocuments: (_ctx, ids) => (seen.push(ids), ['doc_vetted']),
        isPathVisible: () => false,
      },
    });
    expect(await errorText(vetting, 'file_upload', { paths: [['/etc/passwd']] })).toBe(
      "invalid input for browser member 'file_upload': paths: expected a list of strings",
    );
    expect(seen).toEqual([]);
    await run(vetting, 'file_upload', { paths: ['a'], document_ids: ['doc'] });
    expect(seen).toEqual([['a'], ['doc']]);
    expect(vetting.world.inputs.at(-1)).toEqual({ paths: ['/vetted'], document_ids: ['doc_vetted'] });
  });

  test('an absent or null tab_id is the active tab', async () => {
    const browser = new FakeBrowser();
    // an absent or null tab_id is the active tab; a well-formed call is unchanged
    expect(texts(await run(browser, 'navigate', { url: 'https://example.com/', tab_id: null }))).toEqual([
      'Navigated to https://example.com/ — Title of https://example.com/ (HTTP 200)',
    ]);
    expect(browser.world.inputs.at(-1)).toEqual({ url: 'https://example.com/', tab_id: null });
  });

  test("past those, a member's input reaches the driver as the model sent it; the driver's complaint is the error", async () => {
    // The SDK does not read `duration`, so `wait {}` and a string duration both reach the driver as sent.
    const browser = new FakeBrowser();
    expect(texts(await run(browser, 'wait', {}))).toEqual(['Waited s.']);
    expect(browser.world.inputs.at(-1)).toEqual({});
    expect(texts(await run(browser, 'wait', { duration: '5' }))).toEqual(['Waited 5s.']);
    expect(browser.world.inputs.at(-1)).toEqual({ duration: '5' }); // not coerced to the number
    expect(texts(await run(browser, 'left_click', { target: { type: 'ref' } }))).toEqual(['Clicked.']);
    // what a driver that hands the duration to its browser library runs into
    browser.world.fail['wait'] = new TypeError('duration: expected number, got undefined');
    expect(await errorText(browser, 'wait', {})).toBe('Error: duration: expected number, got undefined');
    delete browser.world.fail['wait'];
    // the driver gets a copy: what it writes to its input never reaches the tool_use block
    const sent = { duration: 1 };
    await run(browser, 'wait', sent);
    browser.world.inputs.at(-1)!.duration = 2;
    expect(sent).toEqual({ duration: 1 });
  });

  // The policies read only navigate's url and file_upload's paths and document_ids. On another member those keys are
  // the driver's to read or ignore, like any other key its input type does not declare.
  test.each([
    ['url', 'left_click', { ...CLICK, url: 'https://evil.example/' }],
    ['paths', 'left_click', { ...CLICK, paths: ['/etc/passwd'] }],
    ['document_ids', 'left_click', { ...CLICK, document_ids: ['file_1'] }],
  ])(
    '%s on a %s call reaches confirm and the driver as sent, and no policy is asked',
    async (_key, name, sent) => {
      const seen: unknown[] = [];
      const browser = new FakeBrowser({
        urlPolicy: (_ctx, url) => void seen.push(['policy', url]),
        confirm: (ctx) => (seen.push(['confirm', ctx.input]), true),
      });
      await run(browser, name, sent);
      expect(browser.world.inputs.at(-1)).toEqual(sent);
      expect(seen).toEqual([['confirm', sent]]);
    },
  );

  test("any other key the member's input type does not declare reaches the driver, the policies and confirm as sent", async () => {
    // The SDK checks only the fields it keys on; the rest of the input is the driver's to read or ignore.
    const seen: unknown[] = [];
    const browser = new FakeBrowser({
      urlPolicy: (_ctx, url) => void seen.push(['policy', url]),
      confirm: (ctx) => (seen.push(['confirm', ctx.input]), true),
    });
    const navigate = { url: 'https://example.com/', extra: { x: 1 }, tab_id: null };
    await run(browser, 'navigate', navigate);
    expect(browser.world.inputs.at(-1)).toEqual(navigate);
    const scroll = {
      scroll_direction: 'down',
      target: { type: 'ref', ref: 'e1' },
      scroll_amount: 2,
      modifiers: ['shift'],
    };
    await run(browser, 'scroll', scroll);
    expect(browser.world.inputs.at(-1)).toEqual(scroll);
    expect(seen).toEqual([
      ['policy', 'https://example.com/'],
      ['confirm', navigate],
      ['confirm', scroll],
    ]);
  });

  test('an enabled the types do not allow fails closed if it gets past them', async () => {
    // `{ enabled: 'yes' }` is the type checker's to catch; construction does not re-check it, and the dispatch gate
    // reads anything but `true` or null/absent as off, so it can never turn a member on.
    const browser = new FakeBrowser({ configs: { screenshot: { enabled: 'yes' } } as any });
    expect(await errorText(browser, 'screenshot', {})).toMatch(/not permitted/);
    expect(() => new FakeBrowser({ configs: { screenshot: { enabled: null } } })).not.toThrow(); // null = default
  });

  test('enabling an unimplemented member is a configuration error', async () => {
    expect(() => new FakeBrowser({ configs: { javascript_exec: { enabled: true } } })).toThrow(
      /does not implement.*javascript_exec/,
    );
  });

  test('an execute-only subclass serves every member and turns members off with configs', async () => {
    // A driver that forwards every call elsewhere overrides execute and no member method: it serves them all, and
    // switches off what it does not serve through configs like any other member.
    class Forwarder extends BetaAbstractBrowserToolset20260801 {
      constructor(options: Omit<BetaBrowserToolsetOptions, 'browserState'> = {}) {
        super({ browserState: () => ({ tabs: [] }), ...options });
      }
      protected override async execute(_ctx: BetaToolsetCallContext, name: string): Promise<string> {
        return `forwarded ${name}`;
      }
    }
    const forwarder = new Forwarder({
      configs: { screenshot: { enabled: false }, javascript_exec: { enabled: true } },
      confirm: () => true,
    });
    const call = (name: string, input: object) => forwarder.run(ctxFor(name, input), toolUse(name, input));
    expect(texts(await call('get_page_text', {}))).toEqual(['forwarded get_page_text']);
    expect(texts(await call('javascript_exec', { text: '1' }))).toEqual(['forwarded javascript_exec']);
    await expect(call('screenshot', {})).rejects.toThrow(/not permitted/);
  });

  test('enabling javascript_exec or file_upload requires a confirm callable', () => {
    // file_upload is implemented by the fake; enabling it without a confirm callable to see its calls is refused up
    // front. A confirm that approves everything is the explicit way to run it unattended; disabled, it needs none.
    expect(() => new FakeBrowser({ configs: { file_upload: { enabled: true } } })).toThrow(
      /file_upload.*confirm callable/,
    );
    new FakeBrowser({ configs: { file_upload: { enabled: true } }, confirm: () => true });
    new FakeBrowser();
  });

  test('null input is an empty object', async () => {
    expect((await run(new FakeBrowser(), 'new_tab', null)).map((b) => b.type)).toEqual(['browser_state']);
  });
});

describe('errors out of the driver', () => {
  test('a driver ToolError is the error text and any other exception reads as a function tool renders it', async () => {
    const browser = new FakeBrowser();
    browser.world.fail['left_click'] = new ToolError('element is covered');
    expect(await errorText(browser, 'left_click', CLICK)).toBe('element is covered');
    browser.world.fail['left_click'] = new TypeError('driver bug');
    expect(await errorText(browser, 'left_click', CLICK)).toBe('Error: driver bug');
    // a thrown value that is not an Error reads as a string, and a lone surrogate in it becomes U+FFFD
    browser.world.fail['left_click'] = 'bad\ud800';
    expect(await errorText(browser, 'left_click', CLICK)).toBe('Error: bad\ufffd');
    // Only text survives on an error result.
    browser.world.fail['left_click'] = new ToolError([
      { type: 'text', text: 'see image' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'x' } },
    ]);
    expect(await errorText(browser, 'left_click', CLICK)).toBe('see image');
  });

  test('the developer error class propagates out of run', async () => {
    const browser = new FakeBrowser();
    browser.world.fail['left_click'] = new ToolsetContractError('misuse');
    await expect(run(browser, 'left_click', CLICK)).rejects.toBeInstanceOf(ToolsetUsageError);
  });

  test('a browserState callable that throws or returns the wrong thing is a developer error', async () => {
    const browser = new FakeBrowser();
    browser.world.stateError = new Error('page crashed');
    const thrown = await run(browser, 'get_page_text', {}).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(ToolsetContractError);
    expect((thrown as ToolsetContractError).message).toMatch(/browserState threw Error: page crashed/);
    expect(((thrown as ToolsetContractError).cause as Error).message).toBe('page crashed'); // the driver's own error
    // a callable that returns nothing is the same developer error, never a result for the model
    const noState = new FakeBrowser({ world: Object.assign(new World(), { state: () => undefined as any }) });
    await expect(run(noState, 'get_page_text', {})).rejects.toBeInstanceOf(ToolsetContractError);
  });

  test('an aborted signal propagates as APIUserAbortError instead of being answered', async () => {
    // The same error an aborted request throws, so one catch covers a run aborted anywhere.
    const browser = new FakeBrowser();
    const controller = new AbortController();
    browser.world.gate = async () => {
      controller.abort();
      controller.signal.throwIfAborted(); // what a driver that honours the signal throws: a DOMException
    };
    const ctx = { ...ctxFor('left_click', CLICK), signal: controller.signal };
    const inFlight = await browser.run(ctx, toolUse('left_click', CLICK)).catch((e: unknown) => e);
    expect(inFlight).toBeInstanceOf(APIUserAbortError);
    expect(inFlight).toBeInstanceOf(AnthropicError);
    // A call issued on an already-aborted signal dispatches nothing.
    browser.world.gate = undefined;
    await expect(browser.run(ctx, toolUse('left_click', CLICK))).rejects.toBeInstanceOf(APIUserAbortError);
    expect(browser.world.calls).toEqual(['left_click']);
    // Through the runner's entry point too.
    await expect(
      runToolsetMember(browser, toolUse('left_click', CLICK), { signal: controller.signal }),
    ).rejects.toBeInstanceOf(APIUserAbortError);
  });

  test("a driver error named AbortError is the driver's failure while the call's signal is live", async () => {
    // A page that aborts its own request, or a driver's internal timeout, surfaces as an AbortError; that is
    // not the run's cancellation, so the model reads it bounded and the report is still consulted.
    const browser = new FakeBrowser();
    const controller = new AbortController();
    browser.world.fail['left_click'] = new DOMException('The operation was aborted', 'AbortError');
    const ctx = { ...ctxFor('left_click', CLICK), signal: controller.signal };
    const error = await browser.run(ctx, toolUse('left_click', CLICK)).catch((e) => e);
    expect(error).toBeInstanceOf(ToolError);
    expect(texts(error.content).join('\n')).toContain('Error: The operation was aborted');
    expect(browser.world.stateContexts).toHaveLength(1);
  });

  test("a member's own error thrown after the abort is still answered with the cancellation", async () => {
    for (const thrown of [new ToolError('too late'), new TypeError('too late')]) {
      const browser = new FakeBrowser();
      const controller = new AbortController();
      Object.defineProperty(browser.world.fail, 'left_click', {
        configurable: true,
        get: () => {
          controller.abort(new Error('stop now'));
          return thrown;
        },
      });
      const ctx = { ...ctxFor('left_click', CLICK), signal: controller.signal };
      await expect(browser.run(ctx, toolUse('left_click', CLICK))).rejects.toBeInstanceOf(APIUserAbortError);
      expect(browser.world.stateContexts).toHaveLength(0); // no report is read for a cancelled call
    }
  });

  test('a cancellation out of browserState propagates as one, not as a contract error', async () => {
    const browser = new FakeBrowser();
    const controller = new AbortController();
    // the run is cancelled while the driver is reporting, and the driver honours the signal
    Object.defineProperty(browser.world, 'stateError', {
      get: () => {
        controller.abort();
        return controller.signal.reason;
      },
    });
    const ctx = { ...ctxFor('get_page_text', {}), signal: controller.signal };
    const error = await browser.run(ctx, toolUse('get_page_text', {})).catch((e) => e);
    expect(error).not.toBeInstanceOf(ToolsetUsageError);
    expect(error).toBeInstanceOf(APIUserAbortError);
  });

  test('a cancellation inside urlPolicy or the file policy propagates as one, unanswered', async () => {
    const aborting = (controller: AbortController) => async () => {
      controller.abort();
      controller.signal.throwIfAborted(); // what an aborted fetch inside the hook throws
      return [];
    };
    const viaPolicy = new AbortController();
    const policed = new FakeBrowser({ urlPolicy: aborting(viaPolicy) as any });
    const nav = { url: 'https://example.com/' };
    await expect(
      policed.run({ ...ctxFor('navigate', nav), signal: viaPolicy.signal }, toolUse('navigate', nav)),
    ).rejects.toBeInstanceOf(APIUserAbortError);
    expect(policed.world.stateContexts).toHaveLength(0);
    expect(policed.world.calls).toEqual([]);
    const viaFiles = new AbortController();
    const uploading = new FakeBrowser({
      configs: { file_upload: { enabled: true } },
      confirm: () => true,
      filePolicy: {
        resolveUploadPaths: aborting(viaFiles),
        resolveUploadDocuments: (_ctx, ids) => ids,
        isPathVisible: () => false,
      },
    });
    const upload = { target: { type: 'ref', ref: 'e1' }, paths: ['/x'] };
    await expect(
      uploading.run(
        {
          ...ctxFor('file_upload', upload),
          signal: viaFiles.signal,
        },
        toolUse('file_upload', upload),
      ),
    ).rejects.toBeInstanceOf(APIUserAbortError);
    expect(uploading.world.stateContexts).toHaveLength(0);
    expect(uploading.world.calls).toEqual([]);
    // while the signal is live, the same exception out of either hook is a refusal the model reads
    const live = new FakeBrowser({ urlPolicy: aborting(new AbortController()) as any });
    expect(await errorText(live, 'navigate', nav)).toBe('refused by the URL policy');
  });

  test('an empty ToolError still reads as a failed call the API accepts', async () => {
    const browser = new FakeBrowser();
    for (const thrown of [new ToolError(''), new ToolError([{ type: 'text', text: '' }])]) {
      browser.world.fail['left_click'] = thrown;
      const result = await browser.toolResult(toolUse('left_click', CLICK));
      expect(result.is_error).toBe(true);
      const blocks =
        typeof result.content === 'string' ? [{ type: 'text', text: result.content }] : result.content!;
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks.every((b) => b.type !== 'text' || b.text !== '')).toBe(true);
    }
  });

  test('a call leaves no abort listener behind on a signal that outlives it', async () => {
    const { getEventListeners } = (await import('node:events')) as any;
    const browser = new FakeBrowser();
    const controller = new AbortController();
    for (let i = 0; i < 3; i++) {
      await browser.run(
        {
          ...ctxFor('get_page_text', {}),
          signal: controller.signal,
        },
        toolUse('get_page_text', {}),
      );
    }
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  });

  test('toolResult maps the pipeline onto a result block', async () => {
    const browser = new FakeBrowser();
    const use = toolUse('get_page_text', {});
    const result = await browser.toolResult(use);
    expect(result).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_1', toolset_name: 'browser' });
    expect(result.content?.[0]).toEqual({ type: 'text', text: 'Hello' });
    expect(result).not.toHaveProperty('is_error');
    expect(browser.world.contexts.at(-1)!.toolUse).toBe(use);
    const failed = await browser.toolResult(toolUse('teleport', {}));
    expect(failed.is_error).toBe(true);
    expect(failed.content).toEqual([
      { type: 'text', text: "Error: unknown browser toolset member 'teleport'" },
    ]);
  });

  test('an unexpected exception out of a custom toolset is answered with bounded text', async () => {
    // The exception text may carry page content: the model gets at most FIELD_MAX characters of it.
    const failing: BetaRunnableToolset = {
      type: 'browser_toolset_20260801',
      run: () => {
        throw new Error('x'.repeat(10_000));
      },
    } as BetaRunnableToolset;
    const result = await runToolsetMember(failing, toolUse('screenshot', {}));
    expect(result.is_error).toBe(true);
    expect((result.content as string).length).toBe(FIELD_MAX);
  });
});

describe('state changes across failed calls', () => {
  test('changes drained by a failed call ride the next block that reaches the model', async () => {
    const browser = new FakeBrowser();
    browser.world.changes = [
      { type: 'tab_opened', tab_id: 'tab_9' }, // its tab is not in the inventory by the next call
      { type: 'download_started', download_id: 'dl_1', url: 'https://example.com/a' },
      { type: 'download_started', download_id: 'dl_2', url: 'https://example.com/b' },
    ];
    browser.world.fail['left_click'] = new ToolError('nope');
    await expect(run(browser, 'left_click', CLICK)).rejects.toBeInstanceOf(ToolError);
    // The failed call still consulted browserState, so the driver's queue was drained.
    expect(browser.world.changes).toEqual([]);
    browser.world.changes = [
      { type: 'download_completed', download_id: 'dl_2', url: 'https://example.com/b', size_bytes: 1 },
    ];
    expect(stateBlock(await run(browser, 'get_page_text', {})).state_changes).toEqual([
      { type: 'download_started', download_id: 'dl_1', url: 'https://example.com/a' },
      // dl_2's held-back "started" is superseded by this report's "completed"; tab_9 is gone.
      { type: 'download_completed', download_id: 'dl_2', url: 'https://example.com/b', size_bytes: 1 },
    ]);
    expect(stateBlock(await run(browser, 'get_page_text', {}))).not.toHaveProperty('state_changes');
  });

  test('of the changes held for one download, the newest is the one carried forward', async () => {
    // One failed call drains both the start and the completion of dl_1; a second failed call holds them
    // again. The block that finally reaches the model carries the completion, not the stale start.
    const browser = new FakeBrowser();
    browser.world.changes = [
      { type: 'download_started', download_id: 'dl_1', url: 'https://example.com/a' },
      { type: 'download_completed', download_id: 'dl_1', url: 'https://example.com/a', size_bytes: 7 },
    ];
    browser.world.fail['left_click'] = new ToolError('nope');
    await expect(run(browser, 'left_click', CLICK)).rejects.toBeInstanceOf(ToolError);
    await expect(run(browser, 'left_click', CLICK)).rejects.toBeInstanceOf(ToolError);
    browser.world.fail = {};
    expect(stateBlock(await run(browser, 'get_page_text', {})).state_changes).toEqual([
      { type: 'download_completed', download_id: 'dl_1', url: 'https://example.com/a', size_bytes: 7 },
    ]);
  });

  test("a new_tab result carries only its own tab_opened and holds a popup's for the next block", async () => {
    // A page opened a popup (tab_2) just before the model asked for a new tab (tab_3): the API accepts exactly one
    // tab_opened on a new_tab result, so the popup's waits for the next block.
    const browser = new FakeBrowser();
    browser.world.tabs['tab_2'] = { title: 'popup', url: 'https://example.com/popup' };
    browser.world.changes = [{ type: 'tab_opened', tab_id: 'tab_2' }];
    browser.world.nextTab = 3;
    expect(stateBlock(await run(browser, 'new_tab', {})).state_changes).toEqual([
      { type: 'tab_opened', tab_id: 'tab_3' },
    ]);
    expect(stateBlock(await run(browser, 'get_page_text', {})).state_changes).toEqual([
      { type: 'tab_opened', tab_id: 'tab_2' },
    ]);
    // The same when the popup's tab_opened was held back from a failed call and merged into the new_tab block.
    browser.world.tabs['tab_4'] = { title: 'popup 2', url: 'https://example.com/p2' };
    browser.world.changes = [{ type: 'tab_opened', tab_id: 'tab_4' }];
    browser.world.fail['left_click'] = new ToolError('nope');
    await expect(run(browser, 'left_click', CLICK)).rejects.toBeInstanceOf(ToolError);
    browser.world.fail = {};
    browser.world.nextTab = 5;
    expect(stateBlock(await run(browser, 'new_tab', {})).state_changes).toEqual([
      { type: 'tab_opened', tab_id: 'tab_5' },
    ]);
    expect(stateBlock(await run(browser, 'get_page_text', {})).state_changes).toEqual([
      { type: 'tab_opened', tab_id: 'tab_4' },
    ]);
  });

  test('a new_tab result gets the tab_opened the driver left out', async () => {
    class NoTabOpened extends FakeBrowser {
      protected override async new_tab(ctx: BetaToolsetCallContext, input: BetaBrowserNewTabInput) {
        const opened = await super.new_tab(ctx, input);
        this.world.changes = [];
        return opened;
      }
    }
    expect(stateBlock(await run(new NoTabOpened(), 'new_tab', {})).state_changes).toEqual([
      { type: 'tab_opened', tab_id: 'tab_2' },
    ]);
  });

  test('a new_tab whose tab is not the active one is an error, and its tab_opened goes out with the next block', async () => {
    // The API refuses such a result. A driver that opens tabs in the background does this, and so does a popup that
    // takes focus before the report.
    class Background extends FakeBrowser {
      protected override async new_tab(ctx: BetaToolsetCallContext, input: BetaBrowserNewTabInput) {
        const opened = await super.new_tab(ctx, input);
        this.world.active = 'tab_1';
        return opened;
      }
    }
    const browser = new Background();
    expect(await errorText(browser, 'new_tab', {})).toBe(
      'new_tab opened a tab, but the browser does not report it as the only active tab. Call list_tabs to see the tabs.',
    );
    expect(stateBlock(await run(browser, 'get_page_text', {})).state_changes).toEqual([
      { type: 'tab_opened', tab_id: 'tab_2' },
    ]);
  });

  test('one report needs no deduplication: the latest change per download and one tab_opened per open tab are kept', async () => {
    const browser = new FakeBrowser();
    browser.world.tabs['tab_2'] = { title: 'popup', url: 'https://example.com/popup' };
    browser.world.changes = [
      { type: 'download_started', download_id: 'dl_1', url: 'https://example.com/a' },
      { type: 'tab_opened', tab_id: 'tab_2' },
      { type: 'tab_opened', tab_id: 'tab_9' }, // not in the report's tabs: dropped
      { type: 'download_completed', download_id: 'dl_1', url: 'https://example.com/a', size_bytes: 7 },
      { type: 'tab_opened', tab_id: 'tab_2' }, // the same open tab twice: one entry
    ];
    expect(stateBlock(await run(browser, 'get_page_text', {})).state_changes).toEqual([
      { type: 'tab_opened', tab_id: 'tab_2' },
      { type: 'download_completed', download_id: 'dl_1', url: 'https://example.com/a', size_bytes: 7 },
    ]);
  });

  test('a held change yields to a newer one for the same download in the next report', async () => {
    const browser = new FakeBrowser();
    browser.world.changes = [{ type: 'download_started', download_id: 'dl_1', url: 'https://example.com/a' }];
    browser.world.fail['left_click'] = new ToolError('nope');
    await expect(run(browser, 'left_click', CLICK)).rejects.toBeInstanceOf(ToolError);
    browser.world.fail = {};
    // the next report names the download twice itself; the block carries its last word only
    browser.world.changes = [
      { type: 'download_completed', download_id: 'dl_1', url: 'https://example.com/a', size_bytes: 7 },
      { type: 'download_failed', download_id: 'dl_1', url: 'https://example.com/a', error: 'disk full' },
    ];
    expect(stateBlock(await run(browser, 'get_page_text', {})).state_changes).toEqual([
      { type: 'download_failed', download_id: 'dl_1', url: 'https://example.com/a', error: 'disk full' },
    ]);
  });

  test('a dismissed dialog is a line of text with its message capped', async () => {
    // A driver reports a native dialog it dismissed as a dialog_dismissed change; the model reads one line per dialog
    // with the next result that can carry text, the page-supplied message capped, never in the browser_state block.
    const browser = new FakeBrowser();
    const dialog = (kind: string, message?: string): BetaDialogDismissed => ({
      type: 'dialog_dismissed',
      kind,
      message,
    });
    browser.world.changes = [dialog('confirm', 'Delete\neverything?')];
    const content = await run(browser, 'left_click', CLICK);
    expect(texts(content)).toEqual(['Clicked.', 'A confirm dialog "Delete everything?" was dismissed.']);
    expect(stateBlock(content)).not.toHaveProperty('state_changes');
    browser.world.changes = [
      dialog('alert', 'x'.repeat(500)),
      dialog('prompt'),
      dialog('\n'),
      dialog('y'.repeat(50)),
    ];
    browser.world.fail['left_click'] = new ToolError('element gone');
    const error = await run(browser, 'left_click', CLICK).catch((e) => e);
    expect(texts(error.content)).toEqual([
      'element gone',
      `An alert dialog "${'x'.repeat(200)}…" was dismissed.`,
      'A prompt dialog was dismissed.',
      'A dialog was dismissed.', // a blank kind reads as none
      '1 more dialogs were dismissed.',
    ]);
    browser.world.fail = {};
    browser.world.changes = [dialog('y'.repeat(50))];
    expect(texts(await run(browser, 'left_click', CLICK))).toEqual([
      'Clicked.',
      `A ${'y'.repeat(20)} dialog was dismissed.`,
    ]);
    browser.world.fail = {};
    // A tab member cannot carry text, so the dialogs are held; the cap applies when the lines are finally written.
    browser.world.changes = [0, 1].map((i) => dialog('confirm', String(i)));
    expect((await run(browser, 'list_tabs', {})).map((b) => b.type)).toEqual(['browser_state']);
    browser.world.changes = [2, 3, 4].map((i) => dialog('confirm', String(i)));
    expect(texts(await run(browser, 'get_page_text', {})).slice(1)).toEqual([
      'A confirm dialog "0" was dismissed.',
      'A confirm dialog "1" was dismissed.',
      'A confirm dialog "2" was dismissed.',
      '2 more dialogs were dismissed.',
    ]);
    browser.world.changes = [dialog('confirm', 'L\u00f6schen? ' + '\u{1F600}'.repeat(300))];
    const [line] = texts(await run(browser, 'get_page_text', {})).slice(1);
    expect(line!.startsWith('A confirm dialog "L\u00f6schen? ')).toBe(true);
    expect(line!.endsWith('\u{1F600}…" was dismissed.')).toBe(true); // cut by code point: no lone surrogate
  });

  test('a reported URL is folded to one line and cut to the field limit, and nothing else', async () => {
    // A tab's or download's address is page-supplied: it reaches the model as the driver reported it, line breaks,
    // controls and bidi characters folded to a space and the whole held to 4096 characters. Nothing is parsed,
    // re-encoded or dropped.
    const longUrl = 'https://evil.test/' + '('.repeat(5000);
    expect(boundedTabURL(longUrl)).toBe('\u2026' + longUrl.slice(0, FIELD_MAX - 1));
    const fits = 'https://x.test/' + 'a'.repeat(FIELD_MAX - 'https://x.test/'.length);
    expect(boundedTabURL(fits)).toBe(fits); // exactly at the limit: untouched
    expect(boundedTabURL(fits + 'b')).toBe('\u2026' + fits.slice(0, FIELD_MAX - 1));
    expect(boundedTabURL('https://exa\nmple.test/a b)\x0bc\u202e\u2028d\t')).toBe(
      'https://exa mple.test/a b) c d',
    );
    expect(boundedTabURL('https://user:secret@example.com:8443/p?to=a@b#c')).toBe(
      'https://user:secret@example.com:8443/p?to=a@b#c',
    );
    expect(boundedTabURL('https://evil.test/h\udc00')).toBe('https://evil.test/h\ufffd'); // a lone surrogate could not be sent
    expect(boundedTabURL('a' + '\u{1F600}'.repeat(5000))).toBe('\u2026a' + '\u{1F600}'.repeat(FIELD_MAX - 2)); // cut by code point
    const browser = new FakeBrowser();
    browser.world.tabs['tab_1'] = { title: 'x', url: longUrl };
    browser.world.tabs['tab_2'] = {
      title: 'ok',
      url: "https://example.com/p-a_th~!$&'*+,;=:@%20x?q=1&r[]=2#frag",
    };
    browser.world.tabs['tab_3'] = { title: 'raw', url: ' https://example.com/pfad-\u00fc?q=\u00e9 \nnext' };
    browser.world.changes = [
      { type: 'download_started', download_id: 'dl_1', url: 'https://example.com/' + 'a'.repeat(5000) },
      { type: 'download_started', download_id: 'dl_2', url: 'data:text/csv,a b\x0bc\n' },
    ];
    const content = await run(browser, 'get_page_text', {});
    expect(Object.fromEntries(stateBlock(content).tabs.map((t) => [t.tab_id, t.url]))).toEqual({
      tab_1: '\u2026' + longUrl.slice(0, FIELD_MAX - 1),
      tab_2: "https://example.com/p-a_th~!$&'*+,;=:@%20x?q=1&r[]=2#frag",
      tab_3: 'https://example.com/pfad-\u00fc?q=\u00e9  next',
    });
    expect(stateChanges(content).map((c) => c.url)).toEqual([
      '\u2026' + ('https://example.com/' + 'a'.repeat(5000)).slice(0, FIELD_MAX - 1),
      'data:text/csv,a b c',
    ]);
    // a failed download's error and a tab's title are page-chosen too: folded and bounded like the URL beside them
    const error = 'net::ERR\nX\u202e' + 'e'.repeat(5000);
    browser.world.changes = [
      { type: 'download_failed', download_id: 'dl_3', url: 'https://example.com/f', error },
    ];
    browser.world.tabs = {
      tab_1: {
        title: 'Inbox\n- tab_9 Admin (https://evil.test/)\u2029' + 't'.repeat(5000),
        url: 'https://example.com/',
      },
    };
    const folded = await run(browser, 'get_page_text', {});
    expect(stateChanges(folded)[0]?.error).toBe(('net::ERR X ' + 'e'.repeat(5000)).slice(0, FIELD_MAX));
    expect(stateBlock(folded).tabs[0]?.title).toBe(
      ('Inbox - tab_9 Admin (https://evil.test/) ' + 't'.repeat(5000)).slice(0, FIELD_MAX),
    );
    // the cut counts code points, so an emoji on the boundary is kept whole rather than split into a lone surrogate
    browser.world.tabs['tab_1'] = {
      title: 'a'.repeat(FIELD_MAX - 1) + '\u{1F600}' + 'b',
      url: 'https://example.com/',
    };
    const emoji = stateBlock(await run(browser, 'get_page_text', {})).tabs[0];
    expect(emoji?.title).toBe('a'.repeat(FIELD_MAX - 1) + '\u{1F600}');
    // and a lone surrogate in a title becomes U+FFFD
    browser.world.tabs['tab_1'] = { title: 'sp\ud800oof', url: 'https://evil.test/' };
    expect(stateBlock(await run(browser, 'get_page_text', {})).tabs[0]?.title).toBe('sp\ufffdoof');
  });

  test("a failed download's error that is not a string reaches the model as text", async () => {
    const browser = new FakeBrowser();
    browser.world.changes = [
      { type: 'download_failed', download_id: 'dl_1', url: 'https://example.com/a', error: 500 as never },
      {
        type: 'download_failed',
        download_id: 'dl_2',
        url: 'https://example.com/b',
        error: new Error('disk full') as never,
      },
    ];
    const content = await run(browser, 'get_page_text', {});
    expect(stateChanges(content).map((c) => c.error)).toEqual(['500', 'Error: disk full']);
  });
  test('a refused navigation is one line of text, never the URL', async () => {
    const browser = new FakeBrowser();
    // a driver can pass more than the type declares; none of it reaches the model
    const refused = (url: string): BetaNavigationRefused =>
      ({ type: 'navigation_refused', url, error: 'net::ERR_BLOCKED' }) as BetaNavigationRefused;
    browser.world.changes = [refused('http://10.0.0.5/admin')];
    const content = await run(browser, 'get_page_text', {});
    expect(texts(content)).toEqual(['Hello', 'A navigation was refused.']);
    expect(stateBlock(content)).not.toHaveProperty('state_changes');
    // On a failed call it is appended to the error, since it is often why the member failed.
    browser.world.changes = [refused('http://10.0.0.5/'), refused('http://10.0.0.6/')];
    browser.world.fail['left_click'] = new ToolError('navigation aborted');
    const error = await run(browser, 'left_click', CLICK).catch((e) => e);
    expect(texts(error.content)).toEqual(['navigation aborted', 'A navigation was refused.']);
    // A tab member cannot carry text, so the line waits for the next result that can.
    browser.world.fail = {};
    browser.world.changes = [refused('http://10.0.0.5/')];
    expect((await run(browser, 'list_tabs', {})).map((b) => b.type)).toEqual(['browser_state']);
    expect(texts(await run(browser, 'get_page_text', {}))).toEqual(['Hello', 'A navigation was refused.']);
    expect(texts(await run(browser, 'get_page_text', {}))).toEqual(['Hello']);
  });
});

describe('execute as a hook', () => {
  test('an execute override wraps dispatch and the pipeline wraps the override', async () => {
    const seen: string[] = [];
    class Traced extends FakeBrowser {
      protected override async execute(
        ctx: BetaToolsetCallContext,
        name: BetaBrowserMemberName,
        input: BetaBrowserMemberInput,
      ): Promise<BetaBrowserMemberResult> {
        seen.push(`before ${name}`);
        if (name === 'left_click') throw new ToolError('clicks are off');
        const result = await super.execute(
          ctx,
          name,
          name === 'navigate' && 'url' in input ? { ...input, url: input.url + '?x=1' } : input,
        );
        seen.push(`after ${name}`);
        return name === 'get_page_text' ? `[redacted ${String(result).length}]` : result;
      }
    }
    const browser = new Traced();
    expect(texts(await run(browser, 'get_page_text', {}))).toEqual(['[redacted 5]']);
    expect(texts(await run(browser, 'navigate', { url: 'https://example.com/' }))[0]).toBe(
      'Navigated to https://example.com/?x=1 — Title of https://example.com/?x=1 (HTTP 200)',
    );
    expect(await errorText(browser, 'left_click', CLICK)).toBe('clicks are off');
    // A call refused before dispatch never reaches the override.
    expect(await errorText(browser, 'teleport', {})).toMatch(/unknown/);
    expect(seen).toEqual([
      'before get_page_text',
      'after get_page_text',
      'before navigate',
      'after navigate',
      'before left_click',
    ]);
    expect(browser.world.calls).toEqual(['get_page_text', 'navigate']);
  });
});

describe('serialization', () => {
  function gated(world: World): { release: () => void; started: string[] } {
    const started: string[] = [];
    const waiters: Array<() => void> = [];
    world.gate = (name) =>
      new Promise<void>((resolve) => {
        started.push(name);
        waiters.push(resolve);
      });
    return { release: () => waiters.shift()?.(), started };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  test('calls run one at a time in arrival order by default', async () => {
    const browser = new FakeBrowser();
    const { release, started } = gated(browser.world);
    const first = run(browser, 'get_page_text', {}, 'toolu_1');
    const second = run(browser, 'left_click', CLICK, 'toolu_2');
    await tick();
    expect(started).toEqual(['get_page_text']);
    release();
    await first;
    await tick();
    expect(started).toEqual(['get_page_text', 'left_click']);
    release();
    await second;
    // A failed call does not stall the queue.
    browser.world.gate = undefined;
    browser.world.fail['left_click'] = new ToolError('x');
    await expect(run(browser, 'left_click', CLICK)).rejects.toBeInstanceOf(ToolError);
    expect(texts(await run(browser, 'get_page_text', {}))).toEqual(['Hello']);
  });

  test("the queue is the toolset's: two run() calls sharing one context object still run one at a time", async () => {
    const browser = new FakeBrowser();
    const { release, started } = gated(browser.world);
    const shared = ctxFor('get_page_text', {}, 'toolu_shared');
    const first = browser.run(shared, toolUse('get_page_text', {}, 'toolu_shared'));
    const second = browser.run(shared, toolUse('left_click', CLICK, 'toolu_shared'));
    await tick();
    expect(started).toEqual(['get_page_text']); // the second waits, same context or not
    release();
    await first;
    await tick();
    expect(started).toEqual(['get_page_text', 'left_click']);
    release();
    expect(texts(await second)[0]).toBe('Clicked.');
  });

  test('a malformed driver report is forwarded, not validated', async () => {
    // Only the three strings the SDK itself reads are checked; everything else reaches the block as given.
    const browser = new FakeBrowser();
    const oddTab: any = { tab_id: 't', title: '', url: '', active: 'yes', surprise: ['x'] };
    const oddChange: any = { type: 'made_up', download_id: null };
    browser.world.stateOverride = { tabs: [oddTab], state_changes: [oddChange] };
    const block = stateBlock(await run(browser, 'get_page_text', {}));
    expect(block.tabs).toEqual([oddTab]);
    expect(block.state_changes).toEqual([oddChange]);
  });

  test('close() lets queued calls settle first', async () => {
    const browser = new FakeBrowser();
    const { release } = gated(browser.world);
    const order: string[] = [];
    const call = run(browser, 'get_page_text', {}).then(() => order.push('call'));
    const closed = browser.close().then(() => order.push('close'));
    await tick();
    release();
    await Promise.all([call, closed]);
    expect(order).toEqual(['call', 'close']);
  });

  test('close() refuses later arrivals at once and waits for the queued call too', async () => {
    const browser = new FakeBrowser();
    const { release } = gated(browser.world);
    const order: string[] = [];
    const first = run(browser, 'get_page_text', {}).then(() => order.push('first'));
    const queued = run(browser, 'get_page_text', {}).then(() => order.push('queued'));
    await tick();
    const closed = browser.close().then(() => order.push('close'));
    // marked closed synchronously: a call that arrives now is refused, never queued
    expect(() => browser.run(ctxFor('get_page_text', {}), toolUse('get_page_text', {}))).toThrow(/is closed/);
    await tick();
    expect(order).toEqual([]); // still waiting
    release();
    await first;
    await tick();
    expect(order).toEqual(['first']); // the queued call runs before close() resolves
    release();
    await Promise.all([queued, closed]);
    expect(order).toEqual(['first', 'queued', 'close']);
  });

  test('a member that closes the toolset without awaiting releases it as soon as it returns', async () => {
    const order: string[] = [];
    class ClosesItself extends FakeBrowser {
      protected override async get_page_text(): Promise<string> {
        void this.close().then(() => order.push('close'));
        order.push('member');
        return 'closing';
      }
    }
    const browser = new ClosesItself();
    const content = await run(browser, 'get_page_text', {});
    expect(JSON.stringify(content)).toContain('closing');
    await tick();
    expect(order).toEqual(['member', 'close']);
    expect(() => browser.run(ctxFor('get_page_text', {}), toolUse('get_page_text', {}))).toThrow(/is closed/);
  });

  test('a closed toolset answers no member call: run() and toolResult() throw', async () => {
    const browser = new FakeBrowser();
    await run(browser, 'get_page_text', {});
    await browser.close();
    expect(() => browser.run(ctxFor('get_page_text', {}), toolUse('get_page_text', {}))).toThrow(/is closed/);
    await expect(browser.toolResult(toolUse('get_page_text', {}))).rejects.toThrow(ToolsetClosedError);
    expect(browser.world.calls).toEqual(['get_page_text']);
  });

  test('an abort that fires while a member runs, or while a call is queued, is not answered with a success block', async () => {
    const browser = new FakeBrowser();
    const { release } = gated(browser.world);
    const controller = new AbortController();
    const ctx: BetaToolRunContext = { ...ctxFor('get_page_text'), signal: controller.signal };
    const running = browser.run(ctx, toolUse('get_page_text', {}));
    const queuedController = new AbortController();
    const queued = browser.run(
      {
        ...ctxFor('get_page_text', {}, 'toolu_q'),
        signal: queuedController.signal,
      },
      toolUse('get_page_text', {}, 'toolu_q'),
    );
    await tick();
    queuedController.abort(new Error('stop waiting'));
    await expect(queued).rejects.toBeInstanceOf(APIUserAbortError); // left the queue at once, before its turn
    controller.abort(new Error('stop now'));
    release();
    await expect(running).rejects.toBeInstanceOf(APIUserAbortError); // the member finished; the run was aborted
    // The queue still serializes: a later call runs normally.
    browser.world.gate = undefined;
    expect(texts(await run(browser, 'get_page_text', {}))).toEqual(['Hello']);
  });
});

describe('through the tool runner', () => {
  test('member calls round-trip and the browser is left open for its owner to close', async () => {
    let closed = 0;
    class Closing extends FakeBrowser {
      override async close(): Promise<void> {
        closed += 1;
      }
    }
    const browser = new Closing();
    const { runner, respondWith, requests } = setupRunner([browser]);
    respondWith(
      toolUse('navigate', { url: 'https://example.com/' }, 'toolu_nav'),
      toolUse('teleport', {}, 'toolu_bad'),
    );
    respondWith({ type: 'text', text: 'Done.', citations: null });
    await runner.runUntilDone();
    expect(closed).toBe(0); // the runner never closes a toolset
    // The entry on the wire is exactly toJSON(): the type plus enabled:false for unimplemented members.
    expect(requests[0]!.body.tools).toEqual([JSON.parse(JSON.stringify(browser))]);
    expect(requests[0]!.headers.get('x-stainless-helper')).toContain('browser-toolset');
    const results = requests[1]!.body.messages.at(-1).content;
    expect(results[0]).toMatchObject({ tool_use_id: 'toolu_nav', toolset_name: 'browser' });
    expect(results[0].content.map((b: { type: string }) => b.type)).toEqual(['text', 'browser_state']);
    expect(results[0]).not.toHaveProperty('is_error');
    expect(results[1]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_bad',
      toolset_name: 'browser',
      content: [{ type: 'text', text: "Error: unknown browser toolset member 'teleport'" }],
      is_error: true,
    });
    expect(browser.world.contexts[0]!.toolUse?.id).toBe('toolu_nav');
  });
});
