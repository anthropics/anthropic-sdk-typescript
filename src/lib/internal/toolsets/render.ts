/**
 * Turns what a browser or computer member returned into `tool_result` content, and a `BetaBrowserState` into the
 * `browser_state` block.
 *
 * The registry row gives each member's result kind, and the renderer reads the fields it needs off
 * that result. A pure action renders as its fixed acknowledgment, followed by the line it
 * returned, if any. The tab-management members render no content of their own: the API accepts the
 * `browser_state` block as their whole result and produces the text the model reads from it.
 *
 * @internal
 */
import type {
  BetaBrowserStateBlockParam,
  BetaBrowserStateChange,
  BetaBrowserStateTabEntry,
  BetaImageBlockParam,
  BetaTextBlockParam,
} from '../../../resources/beta';
import type { BetaToolsetContent } from '../../tools/BetaRunnableToolset';
import { ToolsetUsageError } from './errors';
import type { ToolsetMember } from './core';
import type { BetaFilePolicy } from './hooks';
import type { ComputerTypedResult } from './computer-members';
import type { TypedResult } from './registry';
import type { BetaDialogDismissed, BetaNavigationRefused } from './results';
import { boundedTabURL, cutPoints, oneLine, wellFormed } from './sanitize';
import { checkNever } from '../../../internal/utils/values';
import type { Report } from './pipeline';

/**
 * The line the model reads, once, for any number of `BetaNavigationRefused` entries in a report. Nothing else in an
 * entry is echoed: it is shaped by the page that was refused.
 */
export const NAVIGATION_REFUSED_LINE = 'A navigation was refused.';

function inputField(input: unknown, path: string): string {
  const value = path
    .split('.')
    .reduce<unknown>((parent, part) => (parent as Record<string, unknown> | undefined)?.[part], input);
  return oneLine(String(value ?? '')); // a number or boolean as JSON spells it, so the model reads `Waited 2s.` / `true`
}

const TEMPLATE_FIELDS: Record<string, string> = {
  scroll_direction: 'scroll_direction',
  text: 'text',
  duration: 'duration',
  ref: 'target.ref',
};
const TEMPLATE_TOKEN_RE = /* @__PURE__ */ new RegExp(
  /* @__PURE__ */ Object.keys(TEMPLATE_FIELDS)
    .map((key) => `\\{${key}\\}`)
    .join('|'),
  'g',
);

/**
 * Fill a pure action's template from its input in a single pass, so a model-supplied value such as
 * `"{ref}"` stays data and is never re-read as a placeholder.
 */
function confirmation(template: string, input: unknown): string {
  return template.replace(TEMPLATE_TOKEN_RE, (token) =>
    inputField(input, TEMPLATE_FIELDS[token.slice(1, -1)]!),
  );
}

export function text(value: string): BetaTextBlockParam {
  return { type: 'text', text: value };
}

/**
 * The line a pure action returned, as written (not yet checked, folded or cut). `undefined` when it returned none (or
 * anything but a non-empty string). The browser pipeline runs the error-text check on it first; `renderResult` then
 * folds and bounds it.
 */
export function actionLine(member: ToolsetMember, result: RenderedResult | undefined): string | undefined {
  if (member.text === undefined || result?.kind !== 'none' || typeof result.value !== 'string')
    return undefined;
  return result.value || undefined;
}

/** A result the renderer reads: either family's typed result, by its result kind. */
export type RenderedResult = TypedResult | ComputerTypedResult;

/** The content blocks for a member's result, by the registry's result kind. */
export function renderResult(
  member: ToolsetMember,
  input: unknown,
  result: RenderedResult,
): BetaToolsetContent {
  switch (result.kind) {
    case 'none': {
      if (member.text === undefined) return [];
      // A line the action returned is its own block after the acknowledgment's, folded to one line and bounded here.
      const lines = [confirmation(member.text, input)];
      const line = actionLine(member, result);
      const folded = line === undefined ? '' : oneLine(line);
      if (folded) lines.push(folded); // a line that folds to nothing adds no block: the API may reject an empty text block
      return lines.map(text);
    }

    case 'tab':
    case 'tabs':
      // new_tab / switch_tab / list_tabs: the browser_state block is the whole result.
      return [];

    case 'navigate': {
      const r = result.value;

      // the final address is page-chosen through redirects: folded to one line and held to the bound, as a tab's is
      let line = `Navigated to ${boundedTabURL(r.url)}`;
      if (r.title != null) line += ` — ${oneLine(r.title)}`;
      if (r.status != null) line += ` (HTTP ${r.status})`;
      return [text(line)];
    }

    case 'screenshot': {
      const r = result.value;

      const image: BetaImageBlockParam = {
        type: 'image',
        source: { type: 'base64', media_type: r.mediaType ?? 'image/png', data: r.data },
      };
      return [image];
    }
    case 'point':
      // cursor_position: the cursor, in screenshot pixels
      return [text(`X=${result.value.x},Y=${result.value.y}`)];

    case 'text': {
      const value = wellFormed(String(result.value)); // page text: a lone surrogate in it could not be sent
      return [text(value === '' ? '(empty)' : value)];
    }

    default:
      checkNever(result);
      return [];
  }
}

export function isNavigationRefused(
  change: BetaBrowserStateChange | BetaNavigationRefused | BetaDialogDismissed,
): change is BetaNavigationRefused {
  return change.type === 'navigation_refused';
}

export function isDialogDismissed(
  change: BetaBrowserStateChange | BetaNavigationRefused | BetaDialogDismissed,
): change is BetaDialogDismissed {
  return change.type === 'dialog_dismissed';
}

/** The wire change kinds that have a page-supplied `url` (and possibly a local `path` or an `error`). */
export type DownloadChange = Exclude<BetaBrowserStateChange, { type: 'tab_opened' }>;
const DOWNLOAD_TYPES: ReadonlySet<string> = /* @__PURE__ */ new Set(
  /* @__PURE__ */ Object.keys({
    download_started: true,
    download_completed: true,
    download_failed: true,
  } satisfies Record<DownloadChange['type'], true>),
);
export function isDownloadChange(
  change: BetaBrowserStateChange | BetaNavigationRefused | BetaDialogDismissed,
): change is DownloadChange {
  return DOWNLOAD_TYPES.has(change.type);
}

const DIALOG_MESSAGE_MAX = 200;
const DIALOG_KIND_MAX = 20; // `kind` is driver-supplied and lands unquoted in the line; a real one is a word
const DIALOG_LINES_MAX = 3;

/**
 * One line per dismissed dialog the driver reported (`A confirm dialog "…" was dismissed.`), the message capped and
 * at most a few lines, then a count of the rest, because a page can open dialogs in a loop.
 */
export function dialogLines(dialogs: readonly BetaDialogDismissed[]): string[] {
  const lines: string[] = [];

  for (const dialog of dialogs.slice(0, DIALOG_LINES_MAX)) {
    const kind = cutPoints(oneLine(dialog.kind), DIALOG_KIND_MAX) || 'dialog';
    const article = 'aeiou'.includes(kind.slice(0, 1).toLowerCase()) ? 'An' : 'A';
    const noun = kind === 'dialog' ? kind : `${kind} dialog`;
    const message = oneLine(dialog.message ?? '');
    const shown = cutPoints(message, DIALOG_MESSAGE_MAX);
    const quoted = message ? ` ${JSON.stringify(shown.length < message.length ? shown + '…' : shown)}` : '';
    lines.push(`${article} ${noun}${quoted} was dismissed.`);
  }

  if (dialogs.length > DIALOG_LINES_MAX)
    lines.push(`${dialogs.length - DIALOG_LINES_MAX} more dialogs were dismissed.`);
  return lines;
}

/**
 * The state changes a block includes: those held back from an earlier call whose result never reached the model,
 * then this report's own, coalesced so the list meets the API's rules however the driver filled it. Of the download
 * changes the latest per `download_id` is kept, where it stands; of the `tab_opened` changes the first per tab, and
 * only for a tab the report still lists. The SDK's own kinds never reach here (see `reportOf`).
 */
export function coalesceChanges(
  pending: readonly BetaBrowserStateChange[],
  report: Report,
): BetaBrowserStateChange[] {
  const all = [...pending, ...report.changes];
  const liveTabs = new Set(report.tabs.map((t) => t.tab_id));

  const latest = new Map<string, number>();
  all.forEach((change, index) => {
    if ('download_id' in change) latest.set(change.download_id, index);
  });

  const opened = new Set<string>();
  return all.filter((change, index) => {
    if (change.type === 'tab_opened') {
      if (!liveTabs.has(change.tab_id) || opened.has(change.tab_id)) return false;
      opened.add(change.tab_id);
      return true;
    }
    return !('download_id' in change) || latest.get(change.download_id) === index;
  });
}

/**
 * The file policy's verdict on one download path, hidden without a policy. The answer is awaited, so the predicate
 * may be `async`. Anything but `true` keeps the path hidden. A `ToolsetUsageError` propagates. Any other exception
 * or rejection from the predicate fails closed: the path stays hidden and the report, with its changes, still goes
 * out.
 */
export async function pathVisible(filePolicy: BetaFilePolicy | undefined, path: string): Promise<boolean> {
  if (!filePolicy) return false;
  let verdict: unknown;
  try {
    verdict = await filePolicy.isPathVisible(path);
  } catch (error) {
    if (error instanceof ToolsetUsageError) throw error;
    return false;
  }
  return verdict === true;
}

/**
 * The `browser_state` block: the driver's tabs with each URL and title folded to one line and held to the API's length
 * limit, and `changes` with a download's `url` and a failed download's `error` bounded the same way and its `path`
 * removed from every download change, kept only on a `download_completed` whose path the file policy exposes to the
 * model and folding would leave unchanged.
 */
export async function renderBrowserState(
  tabs: readonly BetaBrowserStateTabEntry[],
  changes: readonly BetaBrowserStateChange[],
  filePolicy: BetaFilePolicy | undefined,
): Promise<BetaBrowserStateBlockParam> {
  const wire: BetaBrowserStateChange[] = [];

  for (let change of changes) {
    if (isDownloadChange(change)) {
      // removed from whichever kind has it, declared or not: a local path never goes out unchecked
      const { path, ...rest } = change as typeof change & { path?: unknown };
      change = { ...rest, url: boundedTabURL(change.url) };
      if (change.type === 'download_completed' && typeof path === 'string') {
        // page-shaped: a path that folding would change could name another file, so it is withheld
        if (oneLine(path) === path && (await pathVisible(filePolicy, path))) change.path = path;
      }
      if (change.type === 'download_failed' && change.error != null)
        change.error = oneLine(String(change.error));
    } else {
      // copied like the others: the block holds nothing the driver can still change after the call
      change = { ...change };
    }
    wire.push(change);
  }

  const bounded = tabs.map((tab) => ({
    ...tab,
    url: boundedTabURL(tab.url),
    title: oneLine(tab.title),
  }));

  const block: BetaBrowserStateBlockParam = { type: 'browser_state', tabs: bounded };
  // "Nothing to report" is an absent field, never an empty list.
  if (wire.length) block.state_changes = wire;
  return block;
}
