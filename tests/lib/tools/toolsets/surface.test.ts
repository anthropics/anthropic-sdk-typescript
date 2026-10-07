// The browser toolset's public surface: every name the guide documents imports from the helpers entry points, and the
// abstract class carries the constructor options and one method per member.
import * as surface from '@anthropic-ai/sdk/helpers/beta/toolsets';
import * as nodeSurface from '@anthropic-ai/sdk/helpers/beta/toolsets/node';
import {
  BROWSER_DEFAULT_DISABLED_MEMBERS,
  BROWSER_MEMBER_NAMES,
} from '@anthropic-ai/sdk/lib/internal/toolsets/registry';
import {
  BetaAbstractBrowserToolset20260801,
  ConfirmDeclinedError,
  ConfirmFailedError,
  DisabledMemberError,
  InvalidMemberInputError,
  ToolError,
  ToolsetClosedError,
  ToolsetConfigError,
  ToolsetContractError,
  ToolsetUsageError,
  URLRefusedError,
  UnavailableMemberError,
  UnknownMemberError,
  UploadRefusedError,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';

describe('browser toolset surface', () => {
  test('the documented names are exported', () => {
    for (const name of [
      'BetaAbstractBrowserToolset20260801',
      'ToolError',
      'ToolsetUsageError',
      'ToolsetConfigError',
      'ToolsetContractError',
      'ToolsetClosedError',
      'UnknownMemberError',
      'DisabledMemberError',
      'UnavailableMemberError',
      'InvalidMemberInputError',
      'URLRefusedError',
      'ConfirmDeclinedError',
      'ConfirmFailedError',
      'UploadRefusedError',
    ]) {
      expect(surface).toHaveProperty(name);
    }
    // Internal list; not part of the public entry point.
    expect(surface).not.toHaveProperty('BROWSER_DEFAULT_DISABLED_MEMBERS');
    for (const name of ['BetaNodeFilePolicy', 'betaCheckUploadPath'])
      expect(nodeSurface).toHaveProperty(name);
    expect(new ToolsetUsageError('x')).toBeInstanceOf(Error);
    for (const Kind of [ToolsetConfigError, ToolsetContractError, ToolsetClosedError]) {
      expect(new Kind('x')).toBeInstanceOf(ToolsetUsageError); // one catch covers every kind
    }
  });

  test("the SDK's eight refusal classes are exported from the entry and each is a ToolError", () => {
    const exported = surface as unknown as Record<string, { prototype: unknown }>;
    for (const name of [
      'UnknownMemberError',
      'DisabledMemberError',
      'UnavailableMemberError',
      'InvalidMemberInputError',
      'URLRefusedError',
      'ConfirmDeclinedError',
      'ConfirmFailedError',
      'UploadRefusedError',
    ]) {
      expect(exported[name]?.prototype).toBeInstanceOf(ToolError);
    }
  });

  test("the SDK's own refusals are ToolErrors the model reads, one class per kind", () => {
    const refusals: Array<[ToolError, string | undefined]> = [
      [new UnknownMemberError("tele'port", 'browser'), "Error: unknown browser toolset member 'tele port'"],
      [
        new DisabledMemberError('navigate'),
        "The 'navigate' action is not permitted by this application's permissions and cannot be used in this session.",
      ],
      [
        new UnavailableMemberError('find', 'browser'),
        "The browser toolset member 'find' is not available in this environment.",
      ],
      [
        new InvalidMemberInputError('wait', 'browser', 'expected an object'),
        "invalid input for browser member 'wait': expected an object",
      ],
      [new URLRefusedError('refused by the URL policy'), 'refused by the URL policy'],
      [new URLRefusedError(`blocked: no ${'a.'.repeat(150)}test\n`), undefined],
      [
        new ConfirmDeclinedError('left_click'),
        "The user did not grant permission to run 'left_click'. Do not retry it unless the user asks you to.",
      ],
      [
        new ConfirmFailedError('left_click'),
        "Permission to run 'left_click' could not be obtained (the confirmation prompt failed). Do not retry it unless the user asks you to.",
      ],
      [
        new UploadRefusedError('file_upload has no configured upload roots'),
        'file_upload has no configured upload roots',
      ],
    ];
    for (const [error, text] of refusals) {
      expect(error).toBeInstanceOf(ToolError); // becomes an is_error result, never stops the run
      expect(error).not.toBeInstanceOf(ToolsetUsageError);
      if (text !== undefined) {
        expect(error.content).toBe(text);
        expect(error.message).toBe(text);
      }
      expect(error.name).toBe(error.constructor.name);
    }
    // a URL refusal that echoes a model-written address is one bounded line
    const long = refusals[5]![0].message;
    expect(long.length).toBeLessThanOrEqual(200);
    expect(long).not.toMatch(/\n/);
  });

  test('the refusals that name the family require it', () => {
    // @ts-expect-error the family argument is required
    const unknown = () => new UnknownMemberError('x');
    // @ts-expect-error the family argument is required
    const unavailable = () => new UnavailableMemberError('x');
    // @ts-expect-error the family argument is required
    const invalid = () => new InvalidMemberInputError('x');
    // The @ts-expect-error lines are the checks. This line only uses the three closures.
    expect([unknown, unavailable, invalid]).toHaveLength(3);
  });

  test('the abstract class declares every member and the runner entry points', () => {
    const proto = BetaAbstractBrowserToolset20260801.prototype as unknown as Record<string, unknown>;
    for (const member of BROWSER_MEMBER_NAMES) {
      expect(typeof proto[member === 'type' ? 'type_' : member]).toBe('function');
    }
    for (const method of ['run', 'toolResult', 'execute', 'toJSON', 'close']) {
      expect(typeof proto[method]).toBe('function');
    }
    for (const name of BROWSER_DEFAULT_DISABLED_MEMBERS) expect(BROWSER_MEMBER_NAMES).toContain(name);
  });
});
