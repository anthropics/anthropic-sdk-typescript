// `@anthropic-ai/sdk` is a bare specifier on purpose, here and in ./shared: Deno resolves it through
// package.json to the npm-installed tarball in node_modules. An `npm:@anthropic-ai/sdk` specifier
// would fetch the published package from the registry instead of the build under test.
import Anthropic from '@anthropic-ai/sdk';
import { cases } from './shared/cases.ts';

// ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY are read from Deno.env by the client itself (hence --allow-env)
const client = new Anthropic();

for (const [name, run] of Object.entries(cases)) Deno.test(name, () => run(client));
