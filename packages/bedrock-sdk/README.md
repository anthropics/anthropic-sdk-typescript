# <img src=".github/logo.svg" alt="" width="32"> Claude SDK for AWS Bedrock

[![NPM version](https://img.shields.io/npm/v/@anthropic-ai/bedrock-sdk.svg?color=blue)](https://npmjs.org/package/@anthropic-ai/bedrock-sdk)

This library provides convenient access to the Claude API via AWS Bedrock. See the [documentation](https://platform.claude.com/docs/en/build-with-claude/claude-on-amazon-bedrock) for more details.

For the direct Claude API at api.anthropic.com, see [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript).

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
    model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
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

### Custom Credential Provider (for non-Node environments)

For non-Node environments like Vercel Edge Runtime where the default AWS credential provider chain isn't available, you can provide a custom credential resolver:

```js
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

const customCredentialProvider = async () => {
  // Return an object that implements the AwsCredentialIdentityProvider interface
  return {
    accessKeyId: 'your-aws-access-key-id',
    secretAccessKey: 'your-aws-secret-access-key',
    sessionToken: 'your-aws-session-token', // Optional, if using temporary credentials
  };
};

const client = new AnthropicBedrock({
  awsRegion: 'us-east-1',
  providerChainResolver: async () => {
    return customCredentialProvider;
  },
});
```

### Bedrock Guardrails

You can apply [Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html) to your requests by passing `guardrailIdentifier` and `guardrailVersion` to the constructor:

```js
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

const client = new AnthropicBedrock({
  guardrailIdentifier: 'your-guardrail-id', // or a full ARN
  guardrailVersion: '1', // e.g. "1", "2", or "DRAFT"
  trace: 'ENABLED', // optional: enable trace output for debugging
});
```

Or via environment variables:

```sh
export BEDROCK_GUARDRAIL_IDENTIFIER=your-guardrail-id
export BEDROCK_GUARDRAIL_VERSION=1
export BEDROCK_TRACE=ENABLED  # optional: ENABLED, DISABLED, or ENABLED_FULL
```

When configured, the SDK sends `X-Amzn-Bedrock-GuardrailIdentifier`, `X-Amzn-Bedrock-GuardrailVersion`, and optionally `X-Amzn-Bedrock-Trace` headers on invoke requests. Constructor parameters take precedence over environment variables.

Both `guardrailIdentifier` and `guardrailVersion` must be provided together — the constructor throws if only one is set. The `trace` option can be used independently to enable Bedrock invocation tracing.

For more details on how to use the SDK, see the [README.md for the main Claude SDK](https://github.com/anthropics/anthropic-sdk-typescript/tree/main#readme) which this library extends.

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
