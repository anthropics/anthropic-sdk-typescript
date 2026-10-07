# Browser toolset

`browser_toolset_20260801` is a _toolset_: one `tools[]` entry that declares a family of member tools (`navigate`, `screenshot`, `left_click`, …). Each call arrives as a `tool_use` block whose `name` is the member and whose `toolset_name` is `'browser'`.

The SDK ships no browser driver and no URL policy. It ships the abstract class a driver subclasses. Before a call reaches the driver, the SDK runs your `urlPolicy` (on `navigate`), your `filePolicy` (on `file_upload`) and then your `confirm` (on every call). An example driver for the Chrome DevTools Protocol is in [claude-quickstarts](https://github.com/anthropics/claude-quickstarts).

## Quick start

```ts
import Anthropic from '@anthropic-ai/sdk';
import { MyBrowser, examplePolicy } from './my-browser'; // your driver and your URL policy, both shown below

const browser = new MyBrowser(backend, { urlPolicy: examplePolicy(['example.com', 'iana.org']) });
try {
  const runner = new Anthropic().beta.messages.toolRunner({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    tools: [browser],
    messages: [{ role: 'user', content: 'Open example.com and tell me the page heading.' }],
  });
  for await (const message of runner) console.log(message);
} finally {
  await browser.close();
}
```

- You close the browser. The runner ([helpers.md](helpers.md#tool-helpers)) never does, so one instance can serve several runs.
- The runner runs a turn's browser actions in order and stops at the first one that fails or is refused. Other tools in the turn still run.
- Before you deploy a driver, read [Running a browser toolset safely](#running-a-browser-toolset-safely).

Without the runner, pass `browser.toJSON()` in the `tools` of `client.beta.messages.create()` and answer each browser `tool_use` in the reply (`message` below) with `browser.toolResult(toolUse)`. A refusal or failure comes back as an `is_error` result, and your loop must not run the turn's later browser actions:

```ts
const content = 'Not executed: an earlier action in this turn failed.';
const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
for (const use of message.content) {
  if (use.type !== 'tool_use' || use.toolset_name !== browser.toolsetName) continue;
  const { id: tool_use_id, toolset_name } = use; // a skipped tool_use still needs a result
  if (!results[results.length - 1]?.is_error) results.push(await browser.toolResult(use));
  else results.push({ type: 'tool_result', tool_use_id, toolset_name, is_error: true, content });
}
```

## Implement a driver

```ts
import {
  BetaAbstractBrowserToolset20260801,
  type BetaBrowserToolsetOptions,
  type BetaToolsetCallContext,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import type * as Beta from '@anthropic-ai/sdk/resources/beta';

export class MyBrowser extends BetaAbstractBrowserToolset20260801 {
  protected backend: Backend; // whatever reaches your browser: a DevTools client, a hosted browser's API

  constructor(backend: Backend, options: Omit<BetaBrowserToolsetOptions, 'browserState'>) {
    const tabs = () =>
      backend.tabs().map((t) => ({ tab_id: t.id, title: t.title, url: t.url, active: t.active }));
    super({ ...options, browserState: () => ({ tabs: tabs(), state_changes: backend.drainChanges() }) });
    this.backend = backend;
  }

  protected override async navigate(ctx: BetaToolsetCallContext, input: Beta.BetaBrowserNavigateInput) {
    const page = await this.backend.goto(input.url, input.tab_id); // as the model wrote it: see Addresses
    return { url: page.url, status: page.status, title: page.title };
  }

  protected override async screenshot(ctx: BetaToolsetCallContext, input: Beta.BetaBrowserScreenshotInput) {
    return { data: await this.backend.pngBase64(input.tab_id) };
  }

  protected override async left_click(ctx: BetaToolsetCallContext, input: Beta.BetaBrowserLeftClickInput) {
    await this.backend.click(input.target, input.tab_id);
  }

  override async close() {
    await super.close(); // first: it waits for calls in flight
    await this.backend.close();
  }
}
```

Override the members your backend supports. A member you don't override is sent to the API as `enabled: false`. So is one written as an arrow-function field, which compiles but is not detected: write members as methods. From inside a member, call another member's method directly: `run` or `toolResult` there would wait on itself. `input` is what the model sent, typed as `BetaBrowser<Member>Input`, and its doc comment is the member's contract. In `file_upload`, `confirm` and your member get the `paths` and `document_ids` your file policy returned, not the model's. Import the names in this guide from `@anthropic-ai/sdk/helpers/beta/toolsets`, and the generated types from `@anthropic-ai/sdk/resources/beta`.

Members: `navigate`, `list_tabs`, `new_tab`, `switch_tab`, `close_tab`, `read_page`, `get_page_text`, `read_console`, `read_network`, `find`, `form_input`, `file_upload`, `scroll_to`, `screenshot`, `zoom`, `left_click`, `right_click`, `middle_click`, `double_click`, `triple_click`, `hover`, `left_click_drag`, `left_mouse_down`, `left_mouse_up`, `mouse_move`, `scroll`, `type` (the method is `type_`), `key`, `hold_key`, `wait`, `javascript_exec`.

- **State.** `browserState(ctx)`, the driver's report of the browser, is a required constructor option, not a method you override. The SDK calls it after every call, failed and refused ones included. Return every open tab and drain your state changes: tabs opened and downloads (the generated `BetaBrowserStateChange` types), and a `{ type: 'dialog_dismissed', kind, message }` for every native dialog you dismiss, since no member answers a dialog. Catch failures inside it: an exception from it stops the run.
- **Tabs.** Mark exactly one tab `active`, truthfully, and honor `tab_id` in every member that takes one: `confirm` is shown the tab URL from your last report, not from the browser. After `new_tab`, the new tab must be the only active one, or the call fails.
- **Results.** Each member's signature in the base class gives its return type. A string is text for the model: at most one line from an action such as a click. The SDK sends the text of a reading member such as `get_page_text` uncut, so bound its length. The model does not see what `new_tab`, `switch_tab` and `list_tabs` return: it reads the `browser_state` block.
- **Addresses.** `navigate` receives `input.url` as the model wrote it, or the word `back`, `forward` or `reload`. Read the address the way your `urlPolicy` does: add `https://` when it has no scheme, and refuse every other scheme you don't mean to open, such as `javascript:`, `view-source:`, `data:` and `file:`.
- **Coordinates.** Coordinates are viewport pixels, in the frame of a full-viewport screenshot. Capture the viewport, not the full page, at device scale factor 1, or scale the coordinates yourself. The SDK never resizes an image, and the API rejects one over [the model's image limits](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool#handle-coordinate-scaling-for-higher-resolutions).
- **Input values.** The SDK checks only that `navigate`'s `url` is a string, and that `file_upload`'s `paths` and `document_ids` are lists of strings. Throw `ToolError` for a missing or malformed field, and for a `wait` or `hold_key` `duration` longer than you support. Nested values such as `input.target` are shared with the message history: replace them, never edit them in place. If you merge `input` into another object recursively, skip the keys `__proto__`, `constructor` and `prototype`, which reach you as the model sent them.
- **Errors.** When a member throws `ToolError` or any other exception, the model reads its text, unredacted, and the run continues. Keep paths and URLs out of it and use fixed phrases, in `download_failed.error` too: never `String(err)`. A `ToolsetUsageError`, a mistake in your code or options, propagates and stops the run.
- **Try it without the API.** Pass a hand-built `BetaToolUseBlock` to `toolResult()`, which runs the policies and `confirm` too: `await browser.toolResult({ type: 'tool_use', id: 'toolu_1', toolset_name: 'browser', name: 'navigate', input: { url: 'example.com' } })`.

## Options

To change an option, build a new toolset and a new runner. An exception from `urlPolicy`, `filePolicy` or `confirm` refuses the call.

| option        | what it is                                                                              | left unset                                                                   |
| ------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `configs`     | `{ <member>: { enabled: boolean } }`, which turns a member on or off                    | `file_upload`, `read_console`, `read_network` and `javascript_exec` stay off |
| `urlPolicy`   | `(ctx, url) => void`, your check on the address of each `navigate`                      | `navigate` is not checked                                                    |
| `filePolicy`  | a `BetaFilePolicy`, such as `BetaNodeFilePolicy`                                        | uploads are refused, and download paths stay hidden                          |
| `confirm`     | `(ctx) => boolean`, asked before every call                                             | nothing is asked                                                             |
| `toolConfigs` | other fields of the `tools[]` entry, such as `{ cache_control: { type: 'ephemeral' } }` | none are sent                                                                |

**Approval.** Only `true` from `confirm(ctx)` approves: any other answer refuses the call (throw `ToolError` to word the refusal). Return `true` for the members you don't gate. `javascript_exec` and `file_upload` cannot be enabled without a `confirm`.

`ctx.tabURL` is the target tab's URL in the driver's last report. The page may have moved since, and the approved call runs wherever the tab is by then. `undefined` (the first call, a tab the report does not list) means the page is unknown, not that the tab is empty. If you remember approvals per site, ask again whenever the URL is missing or has no host (`about:blank`, a browser error page).

Show the approver the member, the page and the input, with every invisible character escaped (in `tabURL` too): the model may be relaying page content, and what the approver reads must be what runs.

```ts
import type { BetaConfirmContext } from '@anthropic-ai/sdk/helpers/beta/toolsets';

export async function confirm(ctx: BetaConfirmContext): Promise<boolean> {
  if (!['javascript_exec', 'file_upload'].includes(ctx.member)) return true;
  // JSON.stringify leaves non-ASCII characters as they are: escape them all; askUser is how you ask a person
  const escape = (ch: string) => `\\u{${ch.codePointAt(0)!.toString(16)}}`;
  const shown = (value: unknown) => JSON.stringify(value, null, 2).replace(/[^\n -~]/gu, escape);
  const page = ctx.tabURL ? shown(ctx.tabURL) : 'an unknown page';
  return askUser(`Allow ${ctx.member} on ${page}?\n${shown(ctx.input)}`);
}
```

**Hooks.** Override `execute(ctx, name, input)` and call `super.execute(...)` to run code around every call, or skip `super` to forward every call to a remote browser. It runs after the policies and `confirm`, so nothing checks an input you change there. Overriding `execute` marks every member as served, so the model is offered every member that is on by default: turn off the ones you don't serve in `configs`.

## Running a browser toolset safely

The pages the model visits steer its actions: a page can try to point the browser at internal services, pull files off the host or trigger consequential actions. Do all of this before you run a driver against anything but a throwaway profile.

1. **Pass a `urlPolicy`.** Left unset, `navigate` is not checked. See [URL policy](#url-policy).
2. **Intercept requests in the driver.** The policy sees only the address the model asks for: not a redirect, a subresource or a navigation a page starts. The toolset does not expose the policy, so keep it (`this.policy = options.urlPolicy`) and call it from your request handler as `await this.policy?.({}, url)`. An async policy refuses nothing unless you await it. Abort the request on any exception, and report a page-started navigation you refuse as a `{ type: 'navigation_refused' }` state change.
3. **Put egress rules on the browser's container.** Allow only the hosts the task needs. This is the backstop: interception does not see every request. An open DevTools port is unauthenticated full control of the browser and bypasses the policies and `confirm`, so let only the model loop's host reach it.
4. **Pass a `filePolicy`, or leave `file_upload` off.** `file_upload` lets the page the model is browsing read files from the browser host. See [File policy](#file-policy).
5. **Gate consequential members with `confirm`.** It sees the member, its input and the tab's URL, not what a click does. Ask a person for `javascript_exec` and `file_upload` everywhere, and for clicks, `type`, `key` and `form_input` on sites where purchases, messages or accepting terms can happen.
6. **Isolate the browser.** Run it in one container or VM per session, with a fresh profile, no credentials, no mounts beyond the upload roots and the download directory, and no filesystem shared with other tools the model can call. Keep the model loop, the toolset and the API key outside it.
7. **Treat everything a page returns as untrusted.** That includes titles, URLs, file names and downloaded files: never execute, store as trusted or forward them unchecked. URLs reach the model and `confirm` unredacted, with any credentials and `data:` bodies.

**Hosted browsers.** Egress rules and isolation (3, 6) are the provider's, so a request your interception misses can reach whatever the provider's network can. A hosted browser cannot mount your upload roots: refuse path uploads and use `document_ids`, or check paths where the browser runs.

### URL policy

`urlPolicy(ctx, url)` returns nothing to allow and throws `ToolError` to refuse. `url` is the string exactly as the model wrote it: not trimmed, not normalized, no scheme added. `back`, `forward` and `reload` are not put to the policy.

```ts
import { ToolError, type BetaURLPolicy } from '@anthropic-ai/sdk/helpers/beta/toolsets';

/** An example, not a production policy: http(s) pages on the allowed hosts or their subdomains. */
export function examplePolicy(allowedHosts: string[]): BetaURLPolicy {
  const hosts = allowedHosts.map((entry) => entry.trim().toLowerCase().replace(/\.$/, '')).filter(Boolean);
  return (_ctx, url) => {
    // A browser, or a trim() in your driver, drops these before the scheme is read: ' file:' would pass below.
    if (/[\s\x00-\x1f\x7f]/.test(url)) {
      throw new ToolError('blocked: the address contains whitespace or a control character');
    }
    // Judge what the browser will open: no scheme means https://, and URL reads a backslash as a slash.
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
    const { protocol, hostname: host } = new URL(withScheme); // a parse error throws, which also refuses
    const onAllowedHost = hosts.some((h) => host === h || host.endsWith('.' + h));
    if (!['http:', 'https:'].includes(protocol) || !onAllowedHost) {
      throw new ToolError(`blocked: ${url} is not on an allowed host`);
    }
  };
}
```

A production policy needs more: parse the address the way a browser reads it, and account for the many spellings one host or IP address has. This one reads a bare `localhost:3000` as a scheme and refuses it.

### File policy

`BetaNodeFilePolicy` is the `filePolicy` the SDK ships. It judges paths on the machine that runs the SDK, so mount the upload roots at the same path in the browser's container. To write your own, implement `BetaFilePolicy` and build on `betaCheckUploadPath(path, roots)`, exported beside `BetaNodeFilePolicy`.

```ts
import { BetaNodeFilePolicy } from '@anthropic-ai/sdk/helpers/beta/toolsets/node';

const browser = new MyBrowser(backend, {
  configs: { file_upload: { enabled: true } }, // MyBrowser must also implement file_upload
  confirm,
  filePolicy: new BetaNodeFilePolicy({
    uploadRoots: ['/task/uploads'],
    uploadDocumentIds: ['file_011CNha8iCJcU1wXNR6q4V8w'], // Files API documents the model may attach
    downloadDir: '/task/downloads',
  }),
});
```

- Create the upload roots first: a missing root grants nothing. Let nothing the model can reach write to them, because the check runs once, before the driver opens the file.
- Point the driver at one dedicated download directory, outside every upload root and out of reach of the model's other tools. `downloadDir` does not move downloads: it bounds the paths the model may see, and only with `exposeDownloadPaths: true`. `BetaNodeFilePolicy` compares it with the upload roots as written, ignoring letter case, so pass real paths, not symlinks.
