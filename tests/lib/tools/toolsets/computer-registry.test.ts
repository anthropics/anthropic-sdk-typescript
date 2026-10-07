/**
 * The computer member registry against the published toolset definition.
 *
 * `computer_toolset_20260801.json` is a checked-in copy of the toolset's member set and default-disabled
 * members as the API defines them. The registry derives names and inputs from the API types and
 * keeps result kinds and templates by hand; these tests fail when either side moves without the other.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BETA_COMPUTER_MEMBER_NAME_VALUES,
  type BetaComputerToolsetConfigs,
  type BetaResponseComputerToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta';
import {
  COMPUTER_MEMBER_NAMES,
  COMPUTER_MEMBERS,
  COMPUTER_REGISTRY,
} from '@anthropic-ai/sdk/lib/internal/toolsets/computer-members';
import { isEnabled } from '@anthropic-ai/sdk/lib/internal/toolsets/core';

const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, 'computer_toolset_20260801.json'), 'utf8')) as {
  members: string[];
  default_disabled: string[];
};

// One key of the configs type per member: a member the SDK does not know could not be
// configured, and one the API does not know would be rejected. Checked at compile time.
type ConfigKeys = keyof BetaComputerToolsetConfigs;
type Names = (typeof COMPUTER_MEMBER_NAMES)[number];
const _configsCoverMembers: [Exclude<Names, ConfigKeys>, Exclude<ConfigKeys, Names>] extends [never, never] ?
  true
: never = true;
void _configsCoverMembers;

// The `tool_use` union and the registry name the same members: a member in one and not the other fails to compile.
type ToolUseNames = BetaResponseComputerToolUseBlock['name'];
const _toolUseNamesMatchList: [Exclude<ToolUseNames, Names>, Exclude<Names, ToolUseNames>] extends (
  [never, never]
) ?
  true
: never = true;
void _toolUseNamesMatchList;

describe('computer member registry', () => {
  test('member set and order match the published toolset', () => {
    expect([...COMPUTER_MEMBER_NAMES]).toEqual(SPEC.members);
    expect([...COMPUTER_MEMBER_NAMES]).toEqual([...BETA_COMPUTER_MEMBER_NAME_VALUES]);
    expect([...COMPUTER_MEMBERS.keys()]).toEqual([...COMPUTER_MEMBER_NAMES]);
    expect(new Set(COMPUTER_MEMBER_NAMES).size).toBe(17);
  });

  test('no member is off by default, as the published toolset says', () => {
    expect(SPEC.default_disabled).toEqual([]);
    expect([...COMPUTER_REGISTRY.defaultDisabled]).toEqual([]);
    for (const member of COMPUTER_MEMBERS.values()) expect(member.enabledByDefault).toBe(true);
  });

  test('every pure action has confirmation text; the image and point members have none', () => {
    for (const [name, member] of COMPUTER_MEMBERS) {
      if (member.result === 'none') expect(member.text).toBeTruthy();
      else {
        expect(member.text).toBeUndefined();
        expect(['screenshot', 'cursor_position', 'zoom']).toContain(name);
      }
    }
    expect(COMPUTER_MEMBERS.get('cursor_position')!.result).toBe('point');
    expect(COMPUTER_MEMBERS.get('zoom')!.result).toBe('screenshot');
  });

  test('isEnabled fails closed over the computer defaults', () => {
    const off = COMPUTER_REGISTRY.defaultDisabled;
    expect(isEnabled('zoom', undefined, off)).toBe(true);
    expect(isEnabled('zoom', { zoom: { enabled: false } }, off)).toBe(false);
    expect(isEnabled('zoom', { zoom: { enabled: 'yes' } }, off)).toBe(false);
    expect(isEnabled('zoom', { zoom: null }, off)).toBe(true);
    expect(isEnabled('zoom', { zoom: { defer_loading: true } }, off)).toBe(true);
  });
});
