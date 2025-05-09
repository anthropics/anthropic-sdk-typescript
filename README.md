# Anthropic TypeScript API Library

[![NPM version](https://img.shields.io/npm/v/@anthropic-ai/sdk.svg)](https://npmjs.org/package/@anthropic-ai/sdk) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/@anthropic-ai/sdk)

This library provides convenient access to the Anthropic REST API from server-side TypeScript or JavaScript.

The REST API documentation can be found on [docs.anthropic.com](https://docs.anthropic.com/claude/reference/). The full API of this library can be found in [api.md](api.md).

## Installation

```sh
npm install @anthropic-ai/sdk
```

## Usage

The full API of this library can be found in [api.md](api.md).

<!-- prettier-ignore -->
```js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'], // This is the default and can be omitted
});

async function main() {
  const message = await client.messages.create({
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, Claude' }],
    model: 'claude-3-5-sonnet-latest',
  });

  console.log(message.content);
}

main();
```

## Streaming responses

We provide support for streaming responses using Server Sent Events (SSE).

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const stream = await client.messages.create({
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude' }],
  model: 'claude-3-5-sonnet-latest',
  stream: true,
});
for await (const messageStreamEvent of stream) {
  console.log(messageStreamEvent.type);
}
```

If you need to cancel a stream, you can `break` from the loop
or call `stream.controller.abort()`.

### Request & Response types

This library includes TypeScript definitions for all request params and response fields. You may import and use them like so:

<!-- prettier-ignore -->
```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'], // This is the default and can be omitted
});

async function main() {
  const params: Anthropic.MessageCreateParams = {
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, Claude' }],
    model: 'claude-3-5-sonnet-latest',
  };
  const message: Anthropic.Message = await client.messages.create(params);
}

main();
```

Documentation for each method, request param, and response field are available in docstrings and will appear on hover in most modern editors.

## Counting Tokens

You can see the exact usage for a given request through the `usage` response property, e.g.

```ts
const message = await client.messages.create(...)
console.log(message.usage)
// { input_tokens: 25, output_tokens: 13 }
```

## Streaming Helpers

This library provides several conveniences for streaming messages, for example:

```ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

async function main() {
  const stream = anthropic.messages
    .stream({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: 'Say hello there!',
        },
      ],
    })
    .on('text', (text) => {
      console.log(text);
    });

  const message = await stream.finalMessage();
  console.log(message);
}

main();
```

Streaming with `client.messages.stream(...)` exposes [various helpers for your convenience](helpers.md) including event handlers and accumulation.

Alternatively, you can use `client.messages.create({ ..., stream: true })` which only returns an async iterable of the events in the stream and thus uses less memory (it does not build up a final message object for you).

## Message Batches

This SDK provides beta support for the [Message Batches API](https://docs.anthropic.com/en/docs/build-with-claude/message-batches) under the `client.beta.messages.batches` namespace.

### Creating a batch

Message Batches takes an array of requests, where each object has a `custom_id` identifier, and the exact same request `params` as the standard Messages API:

```ts
await anthropic.beta.messages.batches.create({
  requests: [
    {
      custom_id: 'my-first-request',
      params: {
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello, world' }],
      },
    },
    {
      custom_id: 'my-second-request',
      params: {
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hi again, friend' }],
      },
    },
  ],
});
```

### Getting results from a batch

Once a Message Batch has been processed, indicated by `.processing_status === 'ended'`, you can access the results with `.batches.results()`

```ts
const results = await anthropic.beta.messages.batches.results(batch_id);
for await (const entry of results) {
  if (entry.result.type === 'succeeded') {
    console.log(entry.result.message.content);
  }
}
```

## Tool use

This SDK provides support for tool use, aka function calling. More details can be found in [the documentation](https://docs.anthropic.com/claude/docs/tool-use).

## AWS Bedrock

We provide support for the [Anthropic Bedrock API](https://aws.amazon.com/bedrock/claude/) through a [separate package](https://github.com/anthropics/anthropic-sdk-typescript/tree/main/packages/bedrock-sdk).

## Handling errors

When the library is unable to connect to the API,
or if the API returns a non-success status code (i.e., 4xx or 5xx response),
a subclass of `APIError` will be thrown:

<!-- prettier-ignore -->
```ts
async function main() {
  const message = await client.messages
    .create({
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello, Claude' }],
      model: 'claude-3-5-sonnet-latest',
    })
    .catch(async (err) => {
      if (err instanceof Anthropic.APIError) {
        console.log(err.status); // 400
        console.log(err.name); // BadRequestError
        console.log(err.headers); // {server: 'nginx', ...}
      } else {
        throw err;
      }
    });
}

main();
```

Error codes are as follows:

| Status Code | Error Type                 |
| ----------- | -------------------------- |
| 400         | `BadRequestError`          |
| 401         | `AuthenticationError`      |
| 403         | `PermissionDeniedError`    |
| 404         | `NotFoundError`            |
| 422         | `UnprocessableEntityError` |
| 429         | `RateLimitError`           |
| >=500       | `InternalServerError`      |
| N/A         | `APIConnectionError`       |

## Request IDs

> For more information on debugging requests, see [these docs](https://docs.anthropic.com/en/api/errors#request-id)

All object responses in the SDK provide a `_request_id` property which is added from the `request-id` response header so that you can quickly log failing requests and report them back to Anthropic.

```ts
const message = await client.messages.create({
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude' }],
  model: 'claude-3-5-sonnet-latest',
});
console.log(message._request_id); // req_018EeWyXxfu5pfWkrYcMdjWG
```

### Retries

Certain errors will be automatically retried 2 times by default, with a short exponential backoff.
Connection errors (for example, due to a network connectivity problem), 408 Request Timeout, 409 Conflict,
429 Rate Limit, and >=500 Internal errors will all be retried by default.

You can use the `maxRetries` option to configure or disable this:

<!-- prettier-ignore -->
```js
// Configure the default for all requests:
const client = new Anthropic({
  maxRetries: 0, // default is 2
});

// Or, configure per-request:
await client.messages.create({ max_tokens: 1024, messages: [{ role: 'user', content: 'Hello, Claude' }], model: 'claude-3-5-sonnet-latest' }, {
  maxRetries: 5,
});
```

### Timeouts

By default requests time out after 10 minutes. However if you have specified a large `max_tokens` value and are
_not_ streaming, the default timeout will be calculated dynamically using the formula:

```typescript
const minimum = 10 * 60;
const calculated = (60 * 60 * maxTokens) / 128_000;
return calculated < minimum ? minimum * 1000 : calculated * 1000;
```

which will result in a timeout up to 60 minutes, scaled by the `max_tokens` parameter, unless overriden at the request or client level.

You can configure this with a `timeout` option:

<!-- prettier-ignore -->
```ts
// Configure the default for all requests:
const client = new Anthropic({
  timeout: 20 * 1000, // 20 seconds (default is 10 minutes)
});

// Override per-request:
await client.messages.create({ max_tokens: 1024, messages: [{ role: 'user', content: 'Hello, Claude' }], model: 'claude-3-5-sonnet-latest' }, {
  timeout: 5 * 1000,
});
```

On timeout, an `APIConnectionTimeoutError` is thrown.

Note that requests which time out will be [retried twice by default](#retries).

### Long Requests

> [!IMPORTANT]
> We highly encourage you use the streaming [Messages API](#streaming-responses) for longer running requests.

We do not recommend setting a large `max_tokens` values without using streaming.
Some networks may drop idle connections after a certain period of time, which
can cause the request to fail or [timeout](#timeouts) without receiving a response from Anthropic.

This SDK will also throw an error if a non-streaming request is expected to be above roughly 10 minutes long.
Passing `stream: true` or [overriding](#timeouts) the `timeout` option at the client or request level disables this error.

An expected request latency longer than the [timeout](#timeouts) for a non-streaming request
will result in the client terminating the connection and retrying without receiving a response.

When supported by the `fetch` implementation, we set a [TCP socket keep-alive](https://tldp.org/HOWTO/TCP-Keepalive-HOWTO/overview.html)
option in order to reduce the impact of idle connection timeouts on some networks.

## Auto-pagination

List methods in the Anthropic API are paginated.
You can use the `for await … of` syntax to iterate through items across all pages:

```ts
async function fetchAllBetaMessagesBatches(params) {
  const allBetaMessagesBatches = [];
  // Automatically fetches more pages as needed.
  for await (const betaMessageBatch of client.beta.messages.batches.list({ limit: 20 })) {
    allBetaMessagesBatches.push(betaMessageBatch);
  }
  return allBetaMessagesBatches;
}
```

Alternatively, you can request a single page at a time:

```ts
let page = await client.beta.messages.batches.list({ limit: 20 });
for (const betaMessageBatch of page.data) {
  console.log(betaMessageBatch);
}

// Convenience methods are provided for manually paginating:
while (page.hasNextPage()) {
  page = await page.getNextPage();
  // ...
}
```

## Default Headers

We automatically send the `anthropic-version` header set to `2023-06-01`.

If you need to, you can override it by setting default headers on a per-request basis.

Be aware that doing so may result in incorrect types and other unexpected or undefined behavior in the SDK.

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const message = await client.messages.create(
  {
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, Claude' }],
    model: 'claude-3-5-sonnet-latest',
  },
  { headers: { 'anthropic-version': 'My-Custom-Value' } },
);
```

## Advanced Usage

### Accessing raw Response data (e.g., headers)

The "raw" `Response` returned by `fetch()` can be accessed through the `.asResponse()` method on the `APIPromise` type that all methods return.
This method returns as soon as the headers for a successful response are received and does not consume the response body, so you are free to write custom parsing or streaming logic.

You can also use the `.withResponse()` method to get the raw `Response` along with the parsed data.
Unlike `.asResponse()` this method consumes the body, returning once it is parsed.

<!-- prettier-ignore -->
```ts
const client = new Anthropic();

const response = await client.messages
  .create({
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, Claude' }],
    model: 'claude-3-5-sonnet-latest',
  })
  .asResponse();
console.log(response.headers.get('X-My-Header'));
console.log(response.statusText); // access the underlying Response object

const { data: message, response: raw } = await client.messages
  .create({
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, Claude' }],
    model: 'claude-3-5-sonnet-latest',
  })
  .withResponse();
console.log(raw.headers.get('X-My-Header'));
console.log(message.content);
```

### Logging

> [!IMPORTANT]
> All log messages are intended for debugging only. The format and content of log messages
> may change between releases.

#### Log levels

The log level can be configured in two ways:

1. Via the `ANTHROPIC_LOG` environment variable
2. Using the `logLevel` client option (overrides the environment variable if set)

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  logLevel: 'debug', // Show all log messages
});
```

Available log levels, from most to least verbose:

- `'debug'` - Show debug messages, info, warnings, and errors
- `'info'` - Show info messages, warnings, and errors
- `'warn'` - Show warnings and errors (default)
- `'error'` - Show only errors
- `'off'` - Disable all logging

At the `'debug'` level, all HTTP requests and responses are logged, including headers and bodies.
Some authentication-related headers are redacted, but sensitive data in request and response bodies
may still be visible.

#### Custom logger

By default, this library logs to `globalThis.console`. You can also provide a custom logger.
Most logging libraries are supported, including [pino](https://www.npmjs.com/package/pino), [winston](https://www.npmjs.com/package/winston), [bunyan](https://www.npmjs.com/package/bunyan), [consola](https://www.npmjs.com/package/consola), [signale](https://www.npmjs.com/package/signale), and [@std/log](https://jsr.io/@std/log). If your logger doesn't work, please open an issue.

When providing a custom logger, the `logLevel` option still controls which messages are emitted, messages
below the configured level will not be sent to your logger.

```ts
import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';

const logger = pino();

const client = new Anthropic({
  logger: logger.child({ name: 'Anthropic' }),
  logLevel: 'debug', // Send all messages to pino, allowing it to filter
});
```

### Making custom/undocumented requests

This library is typed for convenient access to the documented API. If you need to access undocumented
endpoints, params, or response properties, the library can still be used.

#### Undocumented endpoints

To make requests to undocumented endpoints, you can use `client.get`, `client.post`, and other HTTP verbs.
Options on the client, such as retries, will be respected when making these requests.

```ts
await client.post('/some/path', {
  body: { some_prop: 'foo' },
  query: { some_query_arg: 'bar' },
});
```

#### Undocumented request params

To make requests using undocumented parameters, you may use `// @ts-expect-error` on the undocumented
parameter. This library doesn't validate at runtime that the request matches the type, so any extra values you
send will be sent as-is.

```ts
client.foo.create({
  foo: 'my_param',
  bar: 12,
  // @ts-expect-error baz is not yet public
  baz: 'undocumented option',
});
```

For requests with the `GET` verb, any extra params will be in the query, all other requests will send the
extra param in the body.

If you want to explicitly send an extra argument, you can do so with the `query`, `body`, and `headers` request
options.

#### Undocumented response properties

To access undocumented response properties, you may access the response object with `// @ts-expect-error` on
the response object, or cast the response object to the requisite type. Like the request params, we do not
validate or strip extra properties from the response from the API.

### Customizing the fetch client

By default, this library expects a global `fetch` function is defined.

If you want to use a different `fetch` function, you can either polyfill the global:

```ts
import fetch from 'my-fetch';

globalThis.fetch = fetch;
```

Or pass it to the client:

```ts
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'my-fetch';

const client = new Anthropic({ fetch });
```

### Fetch options

If you want to set custom `fetch` options without overriding the `fetch` function, you can provide a `fetchOptions` object when instantiating the client or making a request. (Request-specific options override client options.)

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  fetchOptions: {
    // `RequestInit` options
  },
});
```

#### Configuring proxies

To modify proxy behavior, you can provide custom `fetchOptions` that add runtime-specific proxy
options to requests:

<img src="https://raw.githubusercontent.com/stainless-api/sdk-assets/refs/heads/main/node.svg" align="top" width="18" height="21"> **Node** <sup>[[docs](https://github.com/nodejs/undici/blob/main/docs/docs/api/ProxyAgent.md#example---proxyagent-with-fetch)]</sup>

```ts
import Anthropic from '@anthropic-ai/sdk';
import * as undici from 'undici';

const proxyAgent = new undici.ProxyAgent('http://localhost:8888');
const client = new Anthropic({
  fetchOptions: {
    dispatcher: proxyAgent,
  },
});
```

<img src="https://raw.githubusercontent.com/stainless-api/sdk-assets/refs/heads/main/bun.svg" align="top" width="18" height="21"> **Bun** <sup>[[docs](https://bun.sh/guides/http/proxy)]</sup>

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  fetchOptions: {
    proxy: 'http://localhost:8888',
  },
});
```

<img src="https://raw.githubusercontent.com/stainless-api/sdk-assets/refs/heads/main/deno.svg" align="top" width="18" height="21"> **Deno** <sup>[[docs](https://docs.deno.com/api/deno/~/Deno.createHttpClient)]</sup>

```ts
import Anthropic from 'npm:@anthropic-ai/sdk';

const httpClient = Deno.createHttpClient({ proxy: { url: 'http://localhost:8888' } });
const client = new Anthropic({
  fetchOptions: {
    client: httpClient,
  },
});
```

## Frequently Asked Questions

## Semantic versioning

This package generally follows [SemVer](https://semver.org/spec/v2.0.0.html) conventions, though certain backwards-incompatible changes may be released as minor versions:

1. Changes that only affect static types, without breaking runtime behavior.
2. Changes to library internals which are technically public but not intended or documented for external use. _(Please open a GitHub issue to let us know if you are relying on such internals.)_
3. Changes that we do not expect to impact the vast majority of users in practice.

We take backwards-compatibility seriously and work hard to ensure you can rely on a smooth upgrade experience.

We are keen for your feedback; please open an [issue](https://www.github.com/anthropics/anthropic-sdk-typescript/issues) with questions, bugs, or suggestions.

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
- Web browsers: disabled by default to avoid exposing your secret API credentials (see our help center for [best practices](https://support.anthropic.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure)). Enable browser support by explicitly setting `dangerouslyAllowBrowser` to `true`.

<details>
  <summary><b>More explanation</b></summary>
  <h3>Why is this dangerous?</h3>
  Enabling the <code>dangerouslyAllowBrowser</code> option can be dangerous because it exposes your secret API credentials in the client-side code. Web browsers are inherently less secure than server environments,
  any user with access to the browser can potentially inspect, extract, and misuse these credentials. This could lead to unauthorized access using your credentials and potentially compromise sensitive data or functionality.
  <h3>When might this not be dangerous?</h3>
  In certain scenarios where enabling browser support might not pose significant risks:
  <ul>
    <li>Internal Tools: If the application is used solely within a controlled internal environment where the users are trusted, the risk of credential exposure can be mitigated.</li>
    <li>Development or debugging purpose: Enabling this feature temporarily might be acceptable, provided the credentials are short-lived, aren't also used in production environments, or are frequently rotated.</li>
  </ul>
</details>

Note that React Native is not supported at this time.

If you are interested in other runtime environments, please open or upvote an issue on GitHub.

## Contributing

See [the contributing documentation](./CONTRIBUTING.md).
