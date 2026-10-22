import { AnthropicError } from '../../../core/error';
import type { ToolsetFamily } from './family';
import { ToolError } from '../../tools/ToolError';
import { logSafe, quotedName } from './sanitize';

/**
 * Thrown when your code uses a toolset's API incorrectly. Catch it to catch all three kinds below.
 *
 * The only exception the tool runner propagates from a member call: anything else a member throws becomes an
 * `is_error` result the model can react to, and the loop continues.
 */
export class ToolsetUsageError extends AnthropicError {
  /** The wrapped error, when there is one (a driver's `browserState` that threw). Its stack is the driver's own. */
  override readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ToolsetUsageError';
    if (options && 'cause' in options) this.cause = options.cause;
  }
}

/** A construction-time mistake: an option combination the toolset cannot honour. */
export class ToolsetConfigError extends ToolsetUsageError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ToolsetConfigError';
  }
}

/** Misuse of the SDK's own API detected at call time (a `browserState` that threw, a misrouted `tool_use`). */
export class ToolsetContractError extends ToolsetUsageError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ToolsetContractError';
  }
}

/** A member run on a toolset you already closed. */
export class ToolsetClosedError extends ToolsetUsageError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ToolsetClosedError';
  }
}

// --- the SDK's own refusals ---------------------------------------------------------------------------
// Each is a `ToolError`, so the model reads it as an `is_error` result and the loop continues. The subclass lets
// your code (an `execute` override, a test) identify the refusal without comparing text.

/** The refusal the model reads for a member name the toolset does not have. */
export class UnknownMemberError extends ToolError {
  constructor(name: string, family: ToolsetFamily) {
    super(`Error: unknown ${family} toolset member '${quotedName(name)}'`);
    this.name = 'UnknownMemberError';
  }
}

/** The refusal the model reads for a member your application's `configs` disabled. */
export class DisabledMemberError extends ToolError {
  constructor(name: string) {
    super(
      `The '${name}' action is not permitted by this application's permissions and cannot be used in this session.`,
    );
    this.name = 'DisabledMemberError';
  }
}

/** The refusal the model reads for a member the driver does not implement. */
export class UnavailableMemberError extends ToolError {
  constructor(name: string, family: ToolsetFamily) {
    super(`The ${family} toolset member '${name}' is not available in this environment.`);
    this.name = 'UnavailableMemberError';
  }
}

/**
 * The refusal the model reads when its `tool_use.input` does not fit the member: `problem` is the field and what was
 * expected.
 */
export class InvalidMemberInputError extends ToolError {
  constructor(name: string, family: ToolsetFamily, problem: string) {
    super(`invalid input for ${family} member '${name}': ${problem}`);
    this.name = 'InvalidMemberInputError';
  }
}

/**
 * The refusal the model reads when your `urlPolicy` threw something other than a `ToolError` (a `ToolError` it throws
 * reaches the model as thrown). `reason` is the line it reads.
 */
export class URLRefusedError extends ToolError {
  constructor(reason: string) {
    // one bounded line: a reason may echo a model-written address of any length
    super(logSafe(reason));
    this.name = 'URLRefusedError';
  }
}

/** The refusal the model reads when your `confirm` callable answered anything but `true` for the member `name`. */
export class ConfirmDeclinedError extends ToolError {
  constructor(name: string) {
    super(`The user did not grant permission to run '${name}'. Do not retry it unless the user asks you to.`);
    this.name = 'ConfirmDeclinedError';
  }
}

/** The refusal the model reads when your `confirm` callable threw, so no answer could be obtained for `name`. */
export class ConfirmFailedError extends ToolError {
  constructor(name: string) {
    super(
      `Permission to run '${name}' could not be obtained (the confirmation prompt failed). Do not retry it unless the user asks you to.`,
    );
    this.name = 'ConfirmFailedError';
  }
}

/**
 * The refusal the model reads for a `file_upload` the file policy (or its absence) does not admit. `reason` is the line
 * it reads.
 */
export class UploadRefusedError extends ToolError {
  constructor(reason: string) {
    super(reason);
    this.name = 'UploadRefusedError';
  }
}

/** The refusal for a `file_upload` by path when no upload root is configured (no file policy, or one without roots). */
export const NO_UPLOAD_ROOTS = 'file_upload has no configured upload roots';
