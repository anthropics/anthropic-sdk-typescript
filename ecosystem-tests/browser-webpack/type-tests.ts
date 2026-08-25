// Browser-only client options; the common checks are in shared/type-tests.ts.
import Anthropic from '@anthropic-ai/sdk';

export const client = new Anthropic({ dangerouslyAllowBrowser: true, fetch: window.fetch });

// @ts-expect-error dangerouslyAllowBrowser must be a boolean
new Anthropic({ dangerouslyAllowBrowser: 'yes' });

// @ts-expect-error fetch must be a fetch-compatible function
new Anthropic({ fetch: 123 });
