/**
 * Node entry for the browser toolset helpers: `@anthropic-ai/sdk/helpers/beta/toolsets/node`.
 *
 * `BetaNodeFilePolicy` and `betaCheckUploadPath` resolve symlinks through the real filesystem, so they are kept
 * apart from the runtime-agnostic `helpers/beta/toolsets` entry. In a browser bundle the module still
 * imports (the Node built-ins are stubbed) and throws when a filesystem check is used.
 */
export {
  BetaNodeFilePolicy,
  betaCheckUploadPath,
  type BetaNodeFilePolicyOptions,
} from '../../../lib/internal/toolsets/security-node';
