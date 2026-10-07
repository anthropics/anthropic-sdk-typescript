/**
 * The browser member names and input types, read off the API types.
 *
 * @internal
 *
 * The member inputs (`BetaBrowserNavigateInput`, ...) and their union `BetaBrowserMemberInput` are in
 * `resources/beta`, and so is the list of member names, `BETA_BROWSER_MEMBER_NAME_VALUES`. The per-member input map is
 * read off the `tool_use` union, so a member added to the API shows up here without a hand edit.
 */
import type { BetaBrowserMemberName, BetaResponseBrowserToolUseBlock } from '../../../resources/beta';

// The member-name union, re-exported for the modules beside this one.
export type { BetaBrowserMemberName };

/** Each browser member's input type, by member name. */
export type BrowserMemberInputs = {
  [K in BetaBrowserMemberName]: Extract<BetaResponseBrowserToolUseBlock, { name: K }>['input'];
};
