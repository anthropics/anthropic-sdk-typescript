import type { BetaMessageParam } from '../../../resources/beta/messages/messages';
import type { BetaMessageThreadFields } from '../../threads/params';
import type { BetaToolRunnerParams, BetaToolRunnerSettings } from '../../tools/BetaToolRunner';

/**
 * `params` split into the runner's own settings, the `thread` choice, and the params of the thread it runs over. Throws
 * on a `thread` the params type leaves out.
 */
export function splitToolRunnerParams(params: BetaToolRunnerParams): {
  settings: BetaToolRunnerSettings;
  thread: BetaToolRunnerParams['thread'];
  threadParams: BetaMessageThreadFields & { messages: BetaMessageParam[] };
} {
  const { stream, max_iterations, runToolsEagerly, thread, ...threadParams } = params;
  if (thread !== undefined && thread !== false) {
    throw new TypeError(
      '`thread` cannot be set in the params of a tool runner. The runner sets it for each request itself. ' +
        'To run without a message thread, pass `thread: false`.',
    );
  }
  return { settings: { stream, max_iterations, runToolsEagerly }, thread, threadParams };
}
