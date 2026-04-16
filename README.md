# <img src=".github/logo.svg" alt="" width="32"> Claude SDK for TypeScript

[![NPM version](https://img.shields.io/npm/v/@anthropic-ai/sdk.svg)](https://npmjs.org/package/@anthropic-ai/sdk)

The Claude SDK for TypeScript provides access to the [Claude API](https://docs.anthropic.com/en/api/) from server-side TypeScript or JavaScript applications.

## Documentation

Full documentation is available at **[platform.claude.com/docs/en/api/sdks/typescript](https://platform.claude.com/docs/en/api/sdks/typescript)**.

## Installation

```sh
npm install @anthropic-ai/sdk
```

### Runtime quickstart

The SDK uses the standard Web Fetch API, so the same package works across common server-side JavaScript runtimes:

| Runtime       | Install / import                                                                     | API key source                      | Minimal client setup                                                           |
| ------------- | ------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------ |
| Node.js       | `npm install @anthropic-ai/sdk` + `import Anthropic from '@anthropic-ai/sdk';`       | `process.env.ANTHROPIC_API_KEY`     | `const client = new Anthropic();`                                              |
| Bun           | `bun add @anthropic-ai/sdk` + `import Anthropic from '@anthropic-ai/sdk';`           | `process.env.ANTHROPIC_API_KEY`     | `const client = new Anthropic();`                                              |
| Deno          | `deno add npm:@anthropic-ai/sdk` or `import Anthropic from 'npm:@anthropic-ai/sdk';` | `Deno.env.get('ANTHROPIC_API_KEY')` | `const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });` |
| Edge runtimes | `npm install @anthropic-ai/sdk` + `import Anthropic from '@anthropic-ai/sdk';`       | `env.ANTHROPIC_API_KEY`             | `const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });`             |

These are all server-side runtimes. In browsers, keep `dangerouslyAllowBrowser` disabled unless you understand the security tradeoffs.

## Getting started

```js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'], // This is the default and can be omitted
});

async function main() {
  const message = await client.messages.create({
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, Claude' }],
    model: 'claude-opus-4-6',
  });

  console.log(message.content);
}

main().catch(console.error);
```

### Tool use examples

If you want runnable tool use examples, start here:

- [Manual tool use round-trip](examples/tools.ts)
- [Streaming tool use events](examples/tools-streaming.ts)
- [Tool runner with Zod helpers](examples/tools-helpers-zod.ts)
- [Tool runner with JSON Schema helpers](examples/tools-helpers-json-schema.ts)
- [Advanced helper with parallel tool use](examples/tools-helpers-advanced.ts)

### Migrating older API patterns

If you're still using the legacy Text Completions API, migrate new work to the Messages API.

| Older pattern                                                 | Messages API equivalent                            |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `client.completions.create({ prompt, max_tokens_to_sample })` | `client.messages.create({ messages, max_tokens })` |
| `prompt: "\n\nHuman: ...\n\nAssistant:"`                      | `messages: [{ role: 'user', content: '...' }]`     |
| A single completion string                                    | `message.content` blocks                           |

Future models and newer features target the Messages API. For API-pattern changes, see the [Text Completions migration guide](https://docs.claude.com/en/api/migrating-from-text-completions-to-messages). For SDK-level changes, see [MIGRATION.md](MIGRATION.md).

## Webhook verification

If you're receiving Anthropic webhooks, keep the endpoint server-side, read the raw request body, verify it with your webhook secret, and only then parse the JSON. The SDK does not currently provide a webhook verification helper, so use your framework or a small helper that follows the [webhooks docs](https://platform.claude.com/docs/en/api/webhooks).

Before you verify a webhook:

- Store your secret in `ANTHROPIC_WEBHOOK_SECRET`.
- Read the raw body with `request.text()`, not `request.json()`.
- Verify the signature before calling `JSON.parse(body)`.
- Reject the request immediately if verification fails.

```ts
declare function verifyAnthropicWebhook(body: string, headers: Headers, secret: string): boolean;

export async function POST(request: Request) {
  const secret = process.env['ANTHROPIC_WEBHOOK_SECRET'];
  if (!secret) {
    return new Response('Missing webhook secret', { status: 500 });
  }

  const body = await request.text();

  if (!verifyAnthropicWebhook(body, request.headers, secret)) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(body);
  console.log('Verified event:', event.type);

  return new Response('ok');
}
```

## Handling errors

When the SDK cannot connect to the API, or if the API returns a non-success status code, it throws a subclass of `APIError`:

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function main() {
  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello, Claude' }],
    });

    console.log(message.content);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(err.requestID);
      console.error(err.status); // 400
      console.error(err.name); // BadRequestError
      console.error(err.type);
      console.error(err.headers);
    } else {
      throw err;
    }
  }
}

main().catch(console.error);
```

For a runnable version of this pattern, see [examples/errors.ts](examples/errors.ts).

## Request IDs

All object responses in the SDK provide a `_request_id` property from the `request-id` response header so that you can quickly log failing requests and report them back to Anthropic.

```ts
const message = await client.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude' }],
});

console.log(message._request_id);
```

You can also access the request ID with `.withResponse()`:

```ts
const { data, request_id } = await client.messages
  .create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, Claude' }],
  })
  .withResponse();

console.log(data.content);
console.log(request_id);
```

## Retries

Connection errors, 408, 409, 429, and >=500 responses are retried twice by default. You can override that with `maxRetries`:

```ts
const client = new Anthropic({
  maxRetries: 0, // default is 2
});
```

## Timeouts

Requests time out after 10 minutes by default. You can configure this with `timeout`:

```ts
const client = new Anthropic({
  timeout: 20 * 1000, // 20 seconds
});
```

## Requirements

TypeScript >= 4.5 is supported.

The following runtimes are supported:

- Node.js 18 LTS or later ([non-EOL](https://endoflife.date/nodejs)) versions.
- Deno v1.28.0 or higher, using `import Anthropic from 'npm:@anthropic-ai/sdk'`.
- Bun 1.0 or later.
- Cloudflare Workers.
- Vercel Edge Runtime.
- Jest 28 or greater with the `"node"` environment (`"jsdom"` is not supported at this time).
- Nitro v2.6 or greater.

Note that React Native is not supported at this time.

If you are interested in other runtime environments, please open or upvote an issue on GitHub.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
