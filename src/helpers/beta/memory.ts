import { BetaRunnableTool, Promisable } from '../../lib/tools/BetaRunnableTool';
import {
  BetaMemoryTool20250818,
  BetaMemoryTool20250818Command,
  BetaToolResultContentBlockParam,
} from '../../resources/beta';

type Command = BetaMemoryTool20250818Command['command'];

export type MemoryToolHandlers = {
  [K in Command]: (
    command: Extract<BetaMemoryTool20250818Command, { command: K }>,
  ) => Promisable<string | Array<BetaToolResultContentBlockParam>>;
};

/**
 * @param extraProps Additional Claude API properties to include in the tool definition (e.g., `cache_control`)
 */
export function betaMemoryTool(
  handlers: MemoryToolHandlers,
  extraProps?: Omit<BetaMemoryTool20250818, 'type' | 'name'>,
): BetaRunnableTool<BetaMemoryTool20250818Command> {
  return {
    ...extraProps,
    type: 'memory_20250818',
    name: 'memory',
    parse: (content) => content as BetaMemoryTool20250818Command,
    run: (args) => {
      const handler = handlers[args.command];
      if (!handler) {
        throw new Error(`${args.command} not implemented`);
      }

      return handler.bind(handlers)(args as any);
    },
  };
}
