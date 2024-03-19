# Anthropic Vertex TypeScript API Library

[![NPM version](https://img.shields.io/npm/v/@anthropic-ai/vertex-sdk.svg)](https://npmjs.org/package/@anthropic-ai/vertex-sdk)

This library provides convenient access to the Anthropic Vertex API.

For the non-Vertex Anthropic API at api.anthropic.com, see [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript).

## Installation

```sh
npm install @anthropic-ai/vertex-sdk
```

## Usage

<!-- prettier-ignore -->
```js
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';

// Reads from the `CLOUD_ML_REGION` & `ANTHROPIC_VERTEX_PROJECT_ID` environment variables.
// Additionally goes through the standard `google-auth-library` flow.
const client = new AnthropicVertex();

async function main() {
  const result = await client.messages.create({
    messages: [
      {
        role: 'user',
        content: 'Hey Claude!',
      },
    ],
    model: 'claude-3-sonnet@20240229',
    max_tokens: 300,
  });
  console.log(JSON.stringify(result, null, 2));
}

main();
```

For more details on how to use the SDK, see the [README.md for the main Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript/tree/main#anthropic-typescript-api-library) which this library extends.

## Requirements

TypeScript >= 4.5 is supported.

The following runtimes are supported:

- Node.js 18 LTS or later ([non-EOL](https://endoflife.date/nodejs)) versions.
- Deno v1.28.0 or higher, using `import { AnthropicVertex } from "npm:@anthropic-ai/vertex-sdk"`.
- Bun 1.0 or later.
- Cloudflare Workers.
- Vercel Edge Runtime.
- Jest 28 or greater with the `"node"` environment (`"jsdom"` is not supported at this time).
- Nitro v2.6 or greater.

Note that React Native is not supported at this time.

If you are interested in other runtime environments, please open or upvote an issue on GitHub.
