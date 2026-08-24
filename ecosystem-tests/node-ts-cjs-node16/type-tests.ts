// CommonJS-only syntax, typed through the "require" condition (index.d.ts); the common checks
// are in shared/type-tests.ts.
import type Anthropic from '@anthropic-ai/sdk';
import sdk = require('@anthropic-ai/sdk');

export function cjsShapes() {
  const viaNamespace: Anthropic = new sdk.default({ apiKey: 'type-tests' });
  const viaNamed: Anthropic = new sdk.Anthropic();
  // @ts-expect-error `new require('@anthropic-ai/sdk')()` works at runtime for backwards compatibility but is untyped
  new sdk({ apiKey: 'type-tests' });
  const err: sdk.APIError = new sdk.BadRequestError(400, {}, undefined, new Headers());
  void [viaNamespace, viaNamed, err];
}
