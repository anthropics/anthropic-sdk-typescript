/**
 * Browser stub for `tools/memory/node`.
 *
 * The real module's {@link BetaLocalFilesystemMemoryTool} is implemented on top
 * of Node built-ins (`fs/promises`, `path`, `crypto`), which browser bundlers
 * cannot resolve. The `browser` field in `package.json` substitutes this stub
 * in browser builds; Node runtimes and node-target bundles ignore the mapping
 * and load the real implementation.
 *
 * `betaMemoryTool` is runtime-agnostic and is re-exported for real here; only
 * the filesystem-backed handlers throw.
 */

export { betaMemoryTool } from '../../helpers/beta/memory';
export type { MemoryToolHandlers } from '../../helpers/beta/memory';

import { AnthropicError } from '../../core/error';
import type { MemoryToolHandlers } from '../../helpers/beta/memory';
import type {
  BetaMemoryTool20250818CreateCommand,
  BetaMemoryTool20250818DeleteCommand,
  BetaMemoryTool20250818InsertCommand,
  BetaMemoryTool20250818RenameCommand,
  BetaMemoryTool20250818StrReplaceCommand,
  BetaMemoryTool20250818ViewCommand,
} from '../../resources/beta';

function nodeOnly(name: string): never {
  throw new AnthropicError(`${name} requires Node.js or a Node-compatible runtime`);
}

export class BetaLocalFilesystemMemoryTool implements MemoryToolHandlers {
  constructor(_basePath: string = './memory') {
    nodeOnly('BetaLocalFilesystemMemoryTool');
  }

  static init(_basePath: string = './memory'): Promise<BetaLocalFilesystemMemoryTool> {
    return nodeOnly('BetaLocalFilesystemMemoryTool.init');
  }

  view(_command: BetaMemoryTool20250818ViewCommand): Promise<string> {
    return nodeOnly('BetaLocalFilesystemMemoryTool');
  }

  create(_command: BetaMemoryTool20250818CreateCommand): Promise<string> {
    return nodeOnly('BetaLocalFilesystemMemoryTool');
  }

  str_replace(_command: BetaMemoryTool20250818StrReplaceCommand): Promise<string> {
    return nodeOnly('BetaLocalFilesystemMemoryTool');
  }

  insert(_command: BetaMemoryTool20250818InsertCommand): Promise<string> {
    return nodeOnly('BetaLocalFilesystemMemoryTool');
  }

  delete(_command: BetaMemoryTool20250818DeleteCommand): Promise<string> {
    return nodeOnly('BetaLocalFilesystemMemoryTool');
  }

  rename(_command: BetaMemoryTool20250818RenameCommand): Promise<string> {
    return nodeOnly('BetaLocalFilesystemMemoryTool');
  }
}
