/**
 * URL policy and file policy enforcement in the pipeline: the `urlPolicy` hook on `navigate`, upload and download path
 * handling, and how driver-written text reaches the model.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ToolsetContractError,
  ToolsetUsageError,
  ToolError,
  type BetaToolsetCallContext,
  type BetaURLContext,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import type { BetaBrowserGetPageTextInput, BetaBrowserNavigateInput } from '@anthropic-ai/sdk/resources/beta';
import { BetaNodeFilePolicy } from '@anthropic-ai/sdk/helpers/beta/toolsets/node';
import { FIELD_MAX } from '@anthropic-ai/sdk/lib/internal/toolsets/sanitize';
import { FakeBrowser, World, errorText, run, stateBlock, stateChanges, texts } from './fakes';

const CLICK = { target: { type: 'coordinate', x: 1, y: 1 } };

function on(world: World, tabId: string, url: string, active = false): void {
  world.tabs[tabId] = { title: `title of ${url}`, url };
  if (active) world.active = tabId;
}

describe('urlPolicy', () => {
  test('the policy is called once per navigate, with the URL as written, before the driver runs', async () => {
    const seen: Array<[BetaURLContext, string, string[]]> = [];
    const world = new World();
    // a navigation to `/in` lands on `/logout`, as a redirect would
    class Redirecting extends FakeBrowser {
      protected override async navigate(ctx: BetaToolsetCallContext, input: BetaBrowserNavigateInput) {
        const result = await super.navigate(ctx, input);
        if (!input.url.endsWith('/in')) return result;
        on(this.world, this.world.active!, 'https://example.com/logout', true);
        return { url: 'https://example.com/logout', title: 'bye' };
      }
    }
    const browser = new Redirecting({
      world,
      urlPolicy: (ctx, url) => {
        seen.push([ctx, url, [...world.calls]]);
        if (url.includes('logout')) throw new ToolError('blocked: logout');
      },
    });
    const written = [
      'https://example.com/',
      'example.com/path',
      ' Http://Exa\tmple.COM./x ',
      'javascript:alert(1)',
      'backwards',
    ];
    for (const url of written) await run(browser, 'navigate', { url, tab_id: 'tab_1' }, 'toolu_9');
    // once per call, with the string exactly as the model wrote it, and before the driver heard of it; the driver then
    // receives that same string
    expect(seen.map(([, url]) => url)).toEqual(written);
    expect(seen.map(([, , calls]) => calls.length)).toEqual([0, 1, 2, 3, 4]);
    expect(world.inputs.map((i) => i.url)).toEqual(written);
    for (const [ctx] of seen) {
      expect(ctx).toEqual({ member: 'navigate', tabId: 'tab_1', toolUseId: 'toolu_9' });
    }
    // the history words are navigate's own vocabulary, not addresses: the policy is not asked, and the driver receives
    // the canonical lower-case word
    for (const url of ['back', ' Forward ', 'RELOAD']) await run(browser, 'navigate', { url });
    expect(seen).toHaveLength(5);
    expect(world.inputs.slice(-3).map((i) => i.url)).toEqual(['back', 'forward', 'reload']);
    // a ToolError it throws is the refusal the model reads, and the driver is not called
    expect(await errorText(browser, 'navigate', { url: 'https://example.com/logout' })).toBe(
      'blocked: logout',
    );
    expect(seen).toHaveLength(6);
    expect(world.calls.filter((c) => c === 'navigate')).toHaveLength(8);
    // no other member consults it, and nothing a result or a report carries does
    on(world, 'tab_2', 'https://example.com/logout');
    for (const [name, input] of [
      ['get_page_text', {}],
      ['left_click', CLICK],
      ['list_tabs', {}],
      ['new_tab', {}],
      ['switch_tab', { tab_id: 'tab_2' }],
    ] as const) {
      await run(browser, name, input);
    }
    expect(texts(await run(browser, 'navigate', { url: 'https://example.com/in' }))[0]).toBe(
      'Navigated to https://example.com/logout — bye',
    );
    expect(seen).toHaveLength(7);
    // a call without a tab_id says so
    await run(browser, 'navigate', { url: 'https://example.com/' });
    expect(seen.at(-1)![0].tabId).toBeUndefined();
  });

  test("a policy that throws something else refuses with the SDK's text; a usage error propagates", async () => {
    const browser = new FakeBrowser({
      urlPolicy: (_ctx, url) => {
        throw new TypeError(`could not parse ${url}`);
      },
    });
    // its own message (which names the URL) is not relayed
    expect(await errorText(browser, 'navigate', { url: 'https://example.com/oops' })).toBe(
      'refused by the URL policy',
    );
    expect(browser.world.calls).toEqual([]);
    // a ToolsetUsageError out of the policy is the developer's and stops the run
    const misused = new FakeBrowser({
      urlPolicy: () => {
        throw new ToolsetContractError('wired wrong');
      },
    });
    await expect(run(misused, 'navigate', { url: 'https://example.com/' })).rejects.toThrow('wired wrong');
    await expect(run(misused, 'navigate', { url: 'https://example.com/' })).rejects.toBeInstanceOf(
      ToolsetUsageError,
    );
  });

  test('a predicate-shaped policy is a contract error', async () => {
    for (const returned of [false, true, null, 'ok']) {
      const browser = new FakeBrowser({ urlPolicy: (() => returned) as never });
      await expect(run(browser, 'navigate', { url: 'https://example.com/' })).rejects.toBeInstanceOf(
        ToolsetContractError,
      );
      await expect(run(browser, 'navigate', { url: 'https://example.com/' })).rejects.toThrow(
        /return nothing to allow.*; got (boolean|null|string)/,
      );
      expect(browser.world.calls).toEqual([]);
    }
  });

  test('the policy may be sync or async', async () => {
    const seen: Array<[string, BetaURLContext, string]> = [];
    const sync = (ctx: BetaURLContext, url: string): void => {
      seen.push(['sync', ctx, url]);
      if (url.includes('internal')) throw new ToolError('blocked: internal');
    };
    const asynchronous = async (ctx: BetaURLContext, url: string): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      seen.push(['async', ctx, url]);
      if (url.includes('internal')) throw new ToolError('blocked: internal');
    };
    for (const policy of [sync, asynchronous]) {
      const browser = new FakeBrowser({ urlPolicy: policy });
      expect(await errorText(browser, 'navigate', { url: 'https://wiki.internal/', tab_id: 'tab_1' })).toBe(
        'blocked: internal',
      );
      expect(browser.world.calls).toEqual([]);
      await run(browser, 'navigate', { url: ' Example.COM/x ' });
      await run(browser, 'get_page_text', {});
      expect(browser.world.calls).toEqual(['navigate', 'get_page_text']);
      expect(browser.world.inputs[0]?.url).toBe(' Example.COM/x ');
    }
    expect(seen.map(([kind, , url]) => [kind, url])).toEqual([
      ['sync', 'https://wiki.internal/'],
      ['sync', ' Example.COM/x '],
      ['async', 'https://wiki.internal/'],
      ['async', ' Example.COM/x '],
    ]);
    expect(seen[0]![1]).toEqual({
      member: 'navigate',
      tabId: 'tab_1',
      toolUseId: 'toolu_1',
    });
    // an async predicate is a contract error too
    const predicate = new FakeBrowser({ urlPolicy: (async () => true) as never });
    await expect(run(predicate, 'navigate', { url: 'https://example.com/' })).rejects.toThrow(/got boolean/);
  });

  test('unset checks nothing', async () => {
    // left unset, navigate is not checked: whatever the model wrote reaches the driver as written
    const browser = new FakeBrowser();
    const written = [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'data:text/html,<h1>x</h1>',
      'http://10.0.0.5/',
      'chrome://settings',
      'not a url',
      '',
    ];
    for (const url of written) await run(browser, 'navigate', { url });
    expect(browser.world.inputs.map((i) => i.url)).toEqual(written);
    // a URL that is not a string is the model's input error and never reaches the driver
    expect(await errorText(browser, 'navigate', { url: ['x'] })).toMatch(/url: expected a string/);
    expect(browser.world.calls).toHaveLength(written.length);
    // and a reported address reaches the model as the driver reported it
    for (const reported of [
      'file:///etc/passwd',
      'blob:null/1',
      'view-source:http://10.0.0.5/',
      'about:blank',
      'https://user:secret@example.com/',
      '',
    ]) {
      on(browser.world, 'tab_1', reported, true);
      const content = await run(browser, 'get_page_text', {});
      expect(texts(content)).toEqual(['Hello']);
      expect(stateBlock(content).tabs[0]?.url).toBe(reported);
    }
  });
});

describe('tabs and reports', () => {
  test('a call naming a tab the last report did not list reaches the driver, which answers it', async () => {
    const browser = new FakeBrowser();
    on(browser.world, 'tab_1', 'https://example.com/', true);
    await run(browser, 'list_tabs', {});
    expect(await errorText(browser, 'navigate', { url: 'https://example.com/x', tab_id: 'tab_nope' })).toBe(
      'No open tab with tab_id "tab_nope".',
    );
    expect(browser.world.calls).toEqual(['list_tabs', 'navigate']);
  });

  test('a tab that disappears during a call still returns its result', async () => {
    // a popup that was the active tab when the call ran and closed itself before the report was read: the call's
    // result reaches the model, and the report shows what is open now
    class PopupClosesItself extends FakeBrowser {
      protected override async get_page_text(
        ctx: BetaToolsetCallContext,
        input: BetaBrowserGetPageTextInput,
      ): Promise<string> {
        const text = await super.get_page_text(ctx, input);
        delete this.world.tabs['tab_3'];
        this.world.active = 'tab_1';
        return text;
      }
    }
    const popup = new PopupClosesItself();
    on(popup.world, 'tab_1', 'https://example.com/', false);
    on(popup.world, 'tab_3', 'https://example.com/popup', true);
    await run(popup, 'list_tabs', {});
    popup.world.pageText = 'popup text';
    const unnamed = await run(popup, 'get_page_text', {});
    expect(texts(unnamed)).toEqual(['popup text']);
    expect(stateBlock(unnamed).tabs.map((t) => t.tab_id)).toEqual(['tab_1']);
    on(popup.world, 'tab_3', 'https://example.com/popup', true);
    await run(popup, 'list_tabs', {});
    expect(texts(await run(popup, 'get_page_text', { tab_id: 'tab_3' }))).toEqual(['popup text']);
  });

  test('a long reported tab URL is cut to the field limit and its controls folded', async () => {
    const browser = new FakeBrowser();
    const longUrl = 'https://' + 'u'.repeat(4090) + '@example.com/admin\n\x0bnext\u202e';
    on(browser.world, 'tab_1', 'https://example.com/', true);
    on(browser.world, 'tab_2', longUrl);
    let tabs = Object.fromEntries(
      stateBlock(await run(browser, 'list_tabs', {})).tabs.map((t) => [t.tab_id, t.url]),
    );
    expect(tabs['tab_2']).toBe('\u2026' + longUrl.slice(0, FIELD_MAX - 1));
    expect(tabs['tab_2']).toHaveLength(FIELD_MAX);
    on(browser.world, 'tab_2', 'https://exa\nmple.com/a b\x0b)\u202e\u2028c');
    tabs = Object.fromEntries(
      stateBlock(await run(browser, 'get_page_text', {})).tabs.map((t) => [t.tab_id, t.url]),
    );
    expect(tabs['tab_2']).toBe('https://exa mple.com/a b ) c');
    // the cut counts code points, so an astral character on the boundary is kept whole, never split into a lone
    // surrogate
    on(browser.world, 'tab_2', 'https://example.com/' + '\u{1F600}'.repeat(5000));
    tabs = Object.fromEntries(
      stateBlock(await run(browser, 'get_page_text', {})).tabs.map((t) => [t.tab_id, t.url]),
    );
    expect(Array.from(tabs['tab_2']!)).toHaveLength(FIELD_MAX);
    expect(tabs['tab_2']!.endsWith('\u{1F600}')).toBe(true);
  });
});

describe('error text', () => {
  test('error text from the driver reaches the model as written, local paths included', async () => {
    const browser = new FakeBrowser();
    on(browser.world, 'tab_1', 'https://example.com/', true);
    browser.world.fail['left_click'] = new Error(
      'body saved to /var/task/dl/f8a1.bin, see http://10.0.0.5/x',
    );
    expect(await errorText(browser, 'left_click', CLICK)).toBe(
      'Error: body saved to /var/task/dl/f8a1.bin, see http://10.0.0.5/x',
    );
  });

  test('error text is cut at the field limit', async () => {
    const browser = new FakeBrowser();
    on(browser.world, 'tab_1', 'https://example.com/', true);
    for (const thrown of [new Error('e'.repeat(10_000)), new ToolError('t'.repeat(10_000) + '\ud800')]) {
      browser.world.fail['left_click'] = thrown;
      const text = await errorText(browser, 'left_click', CLICK);
      expect(text).toHaveLength(FIELD_MAX);
      expect(text).not.toContain('\ud800');
    }
    // the cut counts code points: an astral character on the boundary is kept whole
    browser.world.fail['left_click'] = new ToolError('x' + '\u{1F600}'.repeat(5000));
    const astral = await errorText(browser, 'left_click', CLICK);
    expect(Array.from(astral)).toHaveLength(FIELD_MAX);
    expect(astral.endsWith('\u{1F600}')).toBe(true);
  });

  test('changes held for the next block are all kept, oldest first', async () => {
    // every change a page caused while results failed rides the next block that can carry them
    const browser = new FakeBrowser();
    on(browser.world, 'tab_1', 'https://example.com/', true);
    browser.world.fail['get_page_text'] = new ToolError('nope');
    for (let batch = 0; batch < 3; batch++) {
      browser.world.changes = Array.from({ length: 150 }, (_, n) => ({
        type: 'download_started' as const,
        download_id: `dl_${batch}_${n}`,
        url: 'https://example.com/f',
      }));
      expect(await errorText(browser, 'get_page_text', {})).toBe('nope');
    }
    const changes = stateChanges(await run(browser, 'list_tabs', {}));
    expect(changes).toHaveLength(450);
    expect(changes[0]?.download_id).toBe('dl_0_0');
    expect(changes.at(-1)?.download_id).toBe('dl_2_149');
  });
});

describe('file policy', () => {
  const UPLOAD = { target: { type: 'ref', ref: 'e1' } };
  let base: string;
  let root: string;
  beforeAll(() => {
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'toolset-enforce-')));
    root = path.join(base, 'uploads');
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(root, 'form.pdf'), 'x');
  });
  afterAll(() => fs.rmSync(base, { recursive: true, force: true }));

  test('uploads are refused without a file policy and resolved with one', async () => {
    const enable = { configs: { file_upload: { enabled: true } }, confirm: () => true };
    const bare = new FakeBrowser(enable);
    expect(await errorText(bare, 'file_upload', { ...UPLOAD, paths: [path.join(root, 'form.pdf')] })).toBe(
      'file_upload has no configured upload roots',
    );
    // A staged document is contained the same way: no policy, no upload; a policy lists the ids it allows.
    expect(await errorText(bare, 'file_upload', { ...UPLOAD, document_ids: ['doc_1'] })).toBe(
      'file_upload has no configured document allowlist',
    );

    const policy = new BetaNodeFilePolicy({ uploadRoots: [root], uploadDocumentIds: ['doc_1'] });
    const seen: BetaURLContext[] = [];
    class Watching extends BetaNodeFilePolicy {
      override resolveUploadPaths(ctx: BetaURLContext, paths: string[]): Promise<string[]> {
        seen.push(ctx);
        return policy.resolveUploadPaths(ctx, paths);
      }
      override resolveUploadDocuments(ctx: BetaURLContext, ids: string[]): string[] {
        seen.push(ctx);
        return policy.resolveUploadDocuments(ctx, ids);
      }
    }
    const browser = new FakeBrowser({ filePolicy: new Watching(), ...enable });
    expect(
      texts(
        await run(
          browser,
          'file_upload',
          { ...UPLOAD, paths: [path.join(root, 'form.pdf')], tab_id: 'tab_1' },
          'toolu_9',
        ),
      ),
    ).toEqual(['Uploaded.']);
    expect(browser.world.inputs.at(-1)?.paths).toEqual([path.join(root, 'form.pdf')]);
    // the file policy is told about the call it serves, as the URL policy is
    expect(seen.at(-1)).toEqual({
      member: 'file_upload',
      tabId: 'tab_1',
      toolUseId: 'toolu_9',
    });
    expect(texts(await run(browser, 'file_upload', { ...UPLOAD, document_ids: ['doc_1'] }))).toEqual([
      'Uploaded.',
    ]);
    expect(browser.world.inputs.at(-1)?.document_ids).toEqual(['doc_1']);
    expect(await errorText(browser, 'file_upload', { ...UPLOAD, document_ids: ['doc_1', 'doc_2'] })).toBe(
      'document not in the upload allowlist',
    );
    expect(await errorText(browser, 'file_upload', { ...UPLOAD, paths: [path.join(base, 'secret')] })).toBe(
      'file_upload path is outside the configured upload roots',
    );
    expect(await errorText(browser, 'file_upload', { ...UPLOAD, paths: [root + '/../secret'] })).toBe(
      "file_upload path must not contain a '..' component",
    );
    // A value that is not a list of strings is the model's input error, and the file policy never sees it: a deny
    // list that calls includes() would wave a nested list through.
    const policyCalls = seen.length;
    for (const [field, value] of [
      ['paths', { 0: path.join(root, 'form.pdf') }],
      ['paths', [path.join(root, 'form.pdf'), 7]],
      ['paths', [[path.join(root, 'form.pdf')]]],
      ['paths', path.join(root, 'form.pdf')],
      ['document_ids', [{ id: 'doc_1' }]],
      ['document_ids', [['doc_1']]],
    ] as const) {
      expect(await errorText(browser, 'file_upload', { ...UPLOAD, [field]: value })).toBe(
        `invalid input for browser member 'file_upload': ${field}: expected a list of strings`,
      );
    }
    expect(seen).toHaveLength(policyCalls);
    // Only the two accepted uploads reached the driver.
    expect(browser.world.calls.filter((c) => c === 'file_upload')).toHaveLength(2);
  });

  test('download paths reach the model only through an exposing file policy', async () => {
    const downloads = path.join(base, 'downloads');
    const paths = async (browser: FakeBrowser) => {
      browser.world.changes = [
        {
          type: 'download_completed',
          download_id: 'dl_1',
          url: 'https://example.com/a',
          path: path.join(downloads, 'x', 'a.bin'),
        },
        {
          type: 'download_completed',
          download_id: 'dl_2',
          url: 'https://example.com/b',
          path: '/elsewhere/b.bin',
        },
      ];
      return stateChanges(await run(browser, 'get_page_text', {})).map((c) => c.path);
    };
    expect(await paths(new FakeBrowser())).toEqual([undefined, undefined]);
    expect(
      await paths(new FakeBrowser({ filePolicy: new BetaNodeFilePolicy({ downloadDir: downloads }) })),
    ).toEqual([undefined, undefined]);
    expect(
      await paths(
        new FakeBrowser({
          filePolicy: new BetaNodeFilePolicy({ downloadDir: downloads, exposeDownloadPaths: true }),
        }),
      ),
    ).toEqual([path.join(downloads, 'x', 'a.bin'), undefined]);

    // A custom predicate that fails hides the path and the report still reaches the model.
    class Flaky extends BetaNodeFilePolicy {
      override async isPathVisible(_path: string): Promise<boolean> {
        throw new Error('disk on fire');
      }
    }
    expect(
      await paths(
        new FakeBrowser({ filePolicy: new Flaky({ downloadDir: downloads, exposeDownloadPaths: true }) }),
      ),
    ).toEqual([undefined, undefined]);
    // An exposed path reaches the block exactly as the driver reported it (spaces and parentheses included), or not at
    // all when folding to one bounded line would change it.
    const exposing = new FakeBrowser({
      filePolicy: new BetaNodeFilePolicy({ downloadDir: downloads, exposeDownloadPaths: true }),
    });
    exposing.world.changes = [
      {
        type: 'download_completed',
        download_id: 'dl_3',
        url: 'https://example.com/c',
        path: path.join(downloads, 'c\n.bin'),
      },
      {
        type: 'download_completed',
        download_id: 'dl_4',
        url: 'https://example.com/d',
        path: path.join(downloads, 'd'.repeat(5000)),
      },
      {
        type: 'download_completed',
        download_id: 'dl_5',
        url: 'https://example.com/e',
        path: path.join(downloads, 'e.bin'),
      },
      {
        type: 'download_completed',
        download_id: 'dl_6',
        url: 'https://example.com/f',
        path: path.join(downloads, 'my file (1).pdf'),
      },
    ];
    const kept = stateChanges(await run(exposing, 'get_page_text', {})).map((c) => [c.download_id, c.path]);
    expect(kept).toEqual([
      ['dl_3', undefined], // a line break in a file name would be folded
      ['dl_4', undefined], // and a longer path cut
      ['dl_5', path.join(downloads, 'e.bin')],
      ['dl_6', path.join(downloads, 'my file (1).pdf')],
    ]);
  });

  test('a file policy that fails refuses the upload', async () => {
    class Broken extends BetaNodeFilePolicy {
      override async resolveUploadPaths(): Promise<string[]> {
        throw new Error('disk on fire');
      }
    }
    const browser = new FakeBrowser({
      configs: { file_upload: { enabled: true } },
      confirm: () => true,
      filePolicy: new Broken({ uploadRoots: [base] }),
    });
    expect(await errorText(browser, 'file_upload', { ...UPLOAD, paths: [path.join(base, 'a.pdf')] })).toBe(
      'the file policy could not vet the upload',
    );
    expect(browser.world.calls.filter((c: string) => c === 'file_upload')).toEqual([]);
  });
});
