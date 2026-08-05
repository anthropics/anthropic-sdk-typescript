# <img src=".github/logo.svg" alt="" width="32"> Claude SDK for TypeScript

[![NPM version](https://img.shields.io/npm/v/@anthropic-ai/sdk.svg)](https://npmjs.org/package/@anthropic-ai/sdk)

The Claude SDK for TypeScript provides access to the [Claude API](https://docs.anthropic.com/en/api/) from server-side TypeScript or JavaScript applications.

## Documentation

Full documentation is available at **[platform.claude.com/docs/en/api/sdks/typescript](https://platform.claude.com/docs/en/api/sdks/typescript)**.

## Installation

```sh
npm install @anthropic-ai/sdk
```

## Getting started

```js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'], // This is the default and can be omitted
});

const message = await client.messages.create({
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude' }],
  model: 'claude-opus-4-6',
});

console.log(message.content);
```

## Requirements

TypeScript >= 4.9 is supported.

The following runtimes are supported:

- Node.js 20 LTS or later ([non-EOL](https://endoflife.date/nodejs)) versions.
- Deno v1.28.0 or higher.
- Bun 1.0 or later.
- Cloudflare Workers.
- Vercel Edge Runtime.
- Jest 28 or greater with the `"node"` environment (`"jsdom"` is not supported at this time).
- Nitro v2.6 or greater.
- Web browsers: disabled by default to avoid exposing your secret API credentials (see [API key best practices](https://support.anthropic.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure)). Enable browser support by explicitly setting `dangerouslyAllowBrowser` to `true`.

Note that React Native is not supported at this time.

If you are interested in other runtime environments, please open or upvote an issue.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
