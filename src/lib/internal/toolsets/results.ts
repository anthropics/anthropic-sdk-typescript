/**
 * What a browser toolset member returns.
 *
 * Tabs and state changes are the generated wire types (`BetaBrowserStateTabEntry`,
 * `BetaBrowserStateChange`) returned as they are. Only the shapes with no wire type are declared here.
 *
 * @internal
 */
import type { BetaBrowserStateChange, BetaBrowserStateTabEntry } from '../../../resources/beta';
import type { BetaScreenshotResult } from './core';

/** Where a navigation landed. Rendered as `Navigated to {url} — {title} (HTTP {status})`. */
export interface BetaBrowserNavigateResult {
  /** The final URL after redirects. */
  url: string;
  status?: number | undefined;
  title?: string | undefined;
}

/**
 * A navigation the driver refused, for example a page-started navigation its request interception stopped. It has
 * no wire `state_changes` type, so the model reads one fixed line of text for any number of them in a report,
 * instead of an entry in the `browser_state` block.
 */
export interface BetaNavigationRefused {
  type: 'navigation_refused';
}

/**
 * A native dialog (`alert`, `confirm`, `prompt`) the page opened and the driver dismissed. It has no wire
 * `state_changes` type, so the SDK reports it to the model as a line of text with the next block
 * (`A confirm dialog "Delete everything?" was dismissed.`): the model then reads that the page asked and what the
 * answer was. `message` is page-supplied text, capped when rendered.
 */
export interface BetaDialogDismissed {
  type: 'dialog_dismissed';
  /** `'alert'`, `'confirm'`, `'prompt'` (or whatever the browser called it). */
  kind: string;
  message?: string | undefined;
}

/**
 * The browser after a call: what the `browserState` constructor option returns.
 *
 * `tabs` is the full inventory (the generated `BetaBrowserStateTabEntry`, the active tab marked with its
 * own `active` flag), `state_changes` what changed since the last report. The API's rules apply unchanged:
 *
 * - `tab_id` values are unique;
 * - exactly one tab is `active` when any tab is open;
 * - at most 100 tabs.
 *
 * Of the state changes, the SDK keeps the latest per `download_id` and one `tab_opened` per tab still open, so the
 * list need not be deduplicated.
 */
export interface BetaBrowserState {
  tabs: BetaBrowserStateTabEntry[];
  /**
   * Each entry is a generated `BetaBrowserStateChange`, or one of the SDK's own kinds ({@link BetaNavigationRefused},
   * {@link BetaDialogDismissed}) that reach the model as text.
   */
  state_changes?: Array<BetaBrowserStateChange | BetaNavigationRefused | BetaDialogDismissed> | undefined;
}

/** Anything a browser member may return: `execute`'s un-narrowed result type. */
export type BetaBrowserMemberResult =
  | BetaBrowserNavigateResult
  | BetaScreenshotResult
  | BetaBrowserStateTabEntry
  | BetaBrowserStateTabEntry[]
  | string
  | void;
