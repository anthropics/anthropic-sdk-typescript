# Anthropic Bedrock TypeScript API Library

[![NPM version](https://img.shields.io/npm/v/@anthropic-ai/bedrock-sdk.svg)](https://npmjs.org/package/@anthropic-ai/bedrock-sdk)

This library provides convenient access to the Anthropic Bedrock API.

For the non-Bedrock Anthropic API at api.anthropic.com, see [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript).

## Installation

```sh
npm install @anthropic-ai/bedrock-sdk
```

## Usage

<!-- prettier-ignore -->
```js
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

// Note: this assumes you have configured AWS credentials in a way
// that the AWS Node SDK will recognise, typicaly a shared `~/.aws/credentials`
// file or `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` environment variables.
//
// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html
const client = new AnthropicBedrock();

async function main() {
  const message = await client.messages.create({
    model: 'anthropic.claude-3-sonnet-20240229-v1:0',
    messages: [
      {
        role: 'user',
        content: 'Hello!',
      },
    ],
    max_tokens: 1024,
  });
  console.log(message);
}

main();
```

For more details on how to use the SDK, see the [README.md for the main Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript/tree/main#anthropic-typescript-api-library) which this library extends.

## Requirements

TypeScript >= 4.5 is supported.

The following runtimes are supported:

- Node.js 18 LTS or later ([non-EOL](https://endoflife.date/nodejs)) versions.
- Deno v1.28.0 or higher, using `import { AnthropicBedrock } from "npm:@anthropic-ai/bedrock-sdk"`.
- Bun 1.0 or later.
- Cloudflare Workers.
- Vercel Edge Runtime.
- Jest 28 or greater with the `"node"` environment (`"jsdom"` is not supported at this time).
- Nitro v2.6 or greater.

Note that React Native is not supported at this time.

If you are interested in other runtime environments, please open or upvote an issue on GitHub.
