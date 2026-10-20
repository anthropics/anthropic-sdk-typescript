// The computer toolset's public surface: every name the guide documents imports from the helpers entry point, and the
// abstract class carries one method per member.
import * as surface from '@anthropic-ai/sdk/helpers/beta/toolsets';
import { BETA_COMPUTER_MEMBER_NAME_VALUES } from '@anthropic-ai/sdk/resources/beta';
import {
  BetaAbstractComputerToolset20260801,
  ConfirmDeclinedError,
  ConfirmFailedError,
  DisabledMemberError,
  ToolError,
  ToolsetUsageError,
  UnavailableMemberError,
  UnknownMemberError,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';

describe('computer toolset surface', () => {
  test('the documented names are exported from the same entry as the browser ones', () => {
    for (const name of [
      'BetaAbstractComputerToolset20260801',
      'BetaAbstractBrowserToolset20260801',
      'ToolError',
      'ToolsetUsageError',
      'ToolsetConfigError',
      'ToolsetContractError',
      'ToolsetClosedError',
      'UnknownMemberError',
      'DisabledMemberError',
      'UnavailableMemberError',
      'ConfirmDeclinedError',
      'ConfirmFailedError',
    ]) {
      expect(surface).toHaveProperty(name);
    }
    expect(surface).not.toHaveProperty('COMPUTER_DEFAULT_DISABLED_MEMBERS'); // no member is off by default
    // An internal list; not part of the public entry point.
    expect(surface).not.toHaveProperty('COMPUTER_MEMBER_NAMES');
  });

  test('the refusals that name the family say computer for a computer toolset', () => {
    const refusals: Array<[ToolError, string]> = [
      [new UnknownMemberError("tele'port", 'computer'), "Error: unknown computer toolset member 'tele port'"],
      [
        new UnavailableMemberError('zoom', 'computer'),
        "The computer toolset member 'zoom' is not available in this environment.",
      ],
      [
        new DisabledMemberError('zoom'),
        "The 'zoom' action is not permitted by this application's permissions and cannot be used in this session.",
      ],
      [
        new ConfirmDeclinedError('left_click'),
        "The user did not grant permission to run 'left_click'. Do not retry it unless the user asks you to.",
      ],
      [
        new ConfirmFailedError('left_click'),
        "Permission to run 'left_click' could not be obtained (the confirmation prompt failed). Do not retry it unless the user asks you to.",
      ],
    ];
    for (const [error, text] of refusals) {
      expect(error).toBeInstanceOf(ToolError);
      expect(error).not.toBeInstanceOf(ToolsetUsageError);
      expect(error.content).toBe(text);
      expect(error.name).toBe(error.constructor.name);
    }
  });

  test('the abstract class declares every member and the runner entry points', () => {
    const proto = BetaAbstractComputerToolset20260801.prototype as unknown as Record<string, unknown>;
    for (const member of BETA_COMPUTER_MEMBER_NAME_VALUES) {
      expect(typeof proto[member === 'type' ? 'type_' : member]).toBe('function');
    }
    for (const method of ['run', 'toolResult', 'execute', 'toJSON', 'close']) {
      expect(typeof proto[method]).toBe('function');
    }
    expect(proto).not.toHaveProperty('checkURL'); // no URL policy on a computer toolset
  });
});
