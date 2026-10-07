/**
 * The toolset families the SDK runs, and how a `tools[]` entry maps to one.
 *
 * @internal
 */
import type { BetaRunnableToolset, BetaToolsetParam } from '../../tools/BetaRunnableToolset';
import type { BetaToolRunnerParams } from '../../tools/BetaToolRunner';

export type ToolsetFamily = 'browser' | 'computer';

/** Dated `tools[]` entry `type` → the family stamped on member blocks. */
export const TOOLSET_TYPE_TO_FAMILY = {
  browser_toolset_20260801: 'browser',
  computer_toolset_20260801: 'computer',
} as const satisfies Record<string, ToolsetFamily>;

export function toolsetFamily(toolset: BetaToolsetParam): ToolsetFamily {
  return TOOLSET_TYPE_TO_FAMILY[toolset.type];
}

/** Whether a `tools` entry is a toolset the runner can execute locally. */
export function isRunnableToolset(t: BetaToolRunnerParams['tools'][number]): t is BetaRunnableToolset {
  // `in` alone would accept inherited keys such as `toString`
  return 'run' in t && t.type != null && Object.prototype.hasOwnProperty.call(TOOLSET_TYPE_TO_FAMILY, t.type);
}
