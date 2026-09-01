import { AnthropicError } from '../core/error';
import type * as node from './node';

/** Substituted for `./node` by the package.json `browser` field; every property access throws. */
function unavailable<T extends object>(module: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      if (typeof property === 'symbol') return undefined;
      throw new AnthropicError(
        `\`${module}.${property}\` is not available in this environment; it needs a Node.js-compatible runtime`,
      );
    },
  });
}

export const child_process: typeof node.child_process = unavailable('child_process');
export const crypto: typeof node.crypto = unavailable('crypto');
export const fs: typeof node.fs = unavailable('fs');
export const os: typeof node.os = unavailable('os');
export const path: typeof node.path = unavailable('path');
export const stream: typeof node.stream = unavailable('stream');
export const util: typeof node.util = unavailable('util');
