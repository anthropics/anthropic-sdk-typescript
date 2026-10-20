/**
 * The member registry against the published toolset definition.
 *
 * `BROWSER_TOOLSET_MEMBERS` is the generated table of the toolset's members as the API defines them. The
 * registry derives names and inputs from the generated types and keeps result kinds, templates and
 * default-disabled flags by hand; these tests fail when either side moves without the other.
 */
import {
  type BetaBrowserToolsetConfigs,
  type BetaResponseBrowserToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta';
import { BROWSER_TOOLSET_MEMBERS } from '@anthropic-ai/sdk/internal/data';
import {
  BROWSER_DEFAULT_DISABLED_MEMBERS,
  BROWSER_MEMBERS,
  BROWSER_MEMBER_NAMES,
  STATE_ONLY_MEMBERS,
  memberEnabled,
} from '@anthropic-ai/sdk/lib/internal/toolsets/registry';

const SPEC = {
  members: Object.keys(BROWSER_TOOLSET_MEMBERS),
  default_disabled: Object.entries(BROWSER_TOOLSET_MEMBERS)
    .filter(([, member]) => !member.enabled_by_default)
    .map(([name]) => name),
};

// One key of the generated configs type per member: a member the SDK does not know could not be
// configured, and one the API does not know would be rejected. Checked at compile time.
type ConfigKeys = keyof BetaBrowserToolsetConfigs;
type Names = (typeof BROWSER_MEMBER_NAMES)[number];
const _configsCoverMembers: [Exclude<Names, ConfigKeys>, Exclude<ConfigKeys, Names>] extends [never, never] ?
  true
: never = true;
void _configsCoverMembers;

// The generated `tool_use` union and the generated name list name the same members: a member added to one and not
// the other fails to compile.
type ToolUseNames = BetaResponseBrowserToolUseBlock['name'];
const _toolUseNamesMatchList: [Exclude<ToolUseNames, Names>, Exclude<Names, ToolUseNames>] extends (
  [never, never]
) ?
  true
: never = true;
void _toolUseNamesMatchList;

describe('browser member registry', () => {
  test('member set matches the published toolset', () => {
    expect([...BROWSER_MEMBER_NAMES].sort()).toEqual([...SPEC.members].sort());
    expect([...BROWSER_MEMBERS.keys()]).toEqual([...BROWSER_MEMBER_NAMES]);
    expect(new Set(BROWSER_MEMBER_NAMES).size).toBe(31);
  });

  test('default-disabled members match the published toolset', () => {
    expect([...BROWSER_DEFAULT_DISABLED_MEMBERS].sort()).toEqual([...SPEC.default_disabled].sort());
  });

  test('every pure action has confirmation text and tab members render state only', () => {
    for (const [name, member] of BROWSER_MEMBERS) {
      if (STATE_ONLY_MEMBERS.has(name)) {
        // The API produces the text for these from the browser_state block; the SDK adds none.
        expect(member.text).toBeUndefined();
        expect(['tab', 'tabs', 'none']).toContain(member.result);
      } else if (member.result === 'none') {
        expect(member.text).toBeTruthy();
      }
    }
  });

  test('memberEnabled fails closed', () => {
    expect(memberEnabled('navigate', undefined)).toBe(true);
    expect(memberEnabled('javascript_exec', undefined)).toBe(false);
    expect(memberEnabled('javascript_exec', { javascript_exec: { enabled: true } })).toBe(true);
    expect(memberEnabled('navigate', { navigate: { enabled: false } })).toBe(false);
    // Anything but a real boolean turns the member off rather than on.
    expect(memberEnabled('javascript_exec', { javascript_exec: { enabled: 'yes' } } as any)).toBe(false);
    expect(memberEnabled('navigate', { navigate: { enabled: 1 } } as any)).toBe(false);
    expect(memberEnabled('navigate', { navigate: { defer_loading: true } })).toBe(true);
    // An entry that is not an object at all reads as off too, so `{ navigate: false }` cannot leave navigate on.
    expect(memberEnabled('navigate', { navigate: false } as any)).toBe(false);
    expect(memberEnabled('navigate', { navigate: 'off' } as any)).toBe(false);
    expect(memberEnabled('navigate', { navigate: null })).toBe(true); // null is the wire type's "defaults"
    // Own properties only.
    expect(memberEnabled('constructor', {})).toBe(true);
  });

  test('the state-only members are the ones whose row renders no content', () => {
    expect([...STATE_ONLY_MEMBERS].sort()).toEqual(['close_tab', 'list_tabs', 'new_tab', 'switch_tab']);
  });
});
