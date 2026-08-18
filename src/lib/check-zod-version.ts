import { AnthropicError } from '../core/error';

/**
 * The SDK's zod helpers call `z.toJSONSchema` from `zod/v4`, which only understands
 * v4-shaped schemas. Passing a v3 schema (constructed via `import { z } from 'zod'`
 * against a zod 3.x install) makes `toJSONSchema` throw a confusing internal
 * `TypeError: Cannot read properties of undefined (reading 'def')`.
 *
 * v4 schemas always have a `_zod` property; v3 schemas don't. Detect the case and
 * throw an actionable error pointing at the two unblock paths.
 */
export function assertZodV4Schema(zodObject: unknown, callerName: string): void {
  if (zodObject && typeof zodObject === 'object' && (zodObject as { _zod?: unknown })._zod !== undefined) {
    return;
  }

  throw new AnthropicError(
    `${callerName} requires a zod v4 schema, but received what appears to be a zod v3 schema. ` +
      `Either upgrade your project to zod v4, or, if you're on zod >= 3.25, import via ` +
      `\`import { z } from 'zod/v4'\` (the v4 subpath is shipped as a backport in recent zod 3.x releases).`,
  );
}
