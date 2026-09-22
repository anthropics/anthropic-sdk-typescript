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

export const child_process: typeof node.child_process = /* @__PURE__ */ unavailable('child_process');
export const crypto: typeof node.crypto = /* @__PURE__ */ unavailable('crypto');
export const fs: typeof node.fs = /* @__PURE__ */ unavailable('fs');
export const os: typeof node.os = /* @__PURE__ */ unavailable('os');
export const path: typeof node.path = /* @__PURE__ */ unavailable('path');
export const stream: typeof node.stream = /* @__PURE__ */ unavailable('stream');
export const util: typeof node.util = /* @__PURE__ */ unavailable('util');
