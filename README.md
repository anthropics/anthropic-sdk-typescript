# Anthropic TypeScript API Library

[![NPM version](https://img.shields.io/npm/v/@anthropic-ai/sdk.svg)](https://npmjs.org/package/@anthropic-ai/sdk)

The Anthropic TypeScript library provides convenient access to the Anthropic REST API from applications written in server-side JavaScript.
It includes TypeScript definitions for all request params and response fields.

## Documentation

The API documentation can be found [here](https://docs.anthropic.com/claude/reference/).

## Installation

```sh
npm install --save @anthropic-ai/sdk
# or
yarn add @anthropic-ai/sdk
```

## Usage

```js
import Anthropic from 'anthropic';

const anthropic = new Anthropic({
  apiKey: 'my api key', // defaults to process.env["ANTHROPIC_API_KEY"]
});

async function main() {
  const completion = await anthropic.completions.create({
    model: 'claude-1',
    max_tokens_to_sample: 300,
    prompt: `${Anthropic.HUMAN_PROMPT} how does a court case get to the Supreme Court? ${Anthropic.AI_PROMPT}`,
  });
}
main().catch(console.error);
```

## Streaming Responses

We provide support for streaming responses using Server Side Events (SSE).

```ts
import Anthropic from 'anthropic';

const anthropic = new Anthropic();

const stream = await anthropic.completions.create({
  prompt: `${Anthropic.HUMAN_PROMPT} Your prompt here ${Anthropic.AI_PROMPT}`,
  model: 'claude-1',
  stream: true,
  max_tokens_to_sample: 300,
});
for await (const completion of stream) {
  console.log(completion.completion);
}
```

If you need to cancel a stream, you can `break` from the loop
or call `stream.controller.abort()`.

### Usage with TypeScript

Importing, instantiating, and interacting with the library are the same as above.
If you like, you may reference our types directly:

```ts
import Anthropic from 'anthropic';

const anthropic = new Anthropic({
  apiKey: 'my api key', // defaults to process.env["ANTHROPIC_API_KEY"]
});

async function main() {
  const params: Anthropic.CompletionCreateParams = {
    prompt: `${Anthropic.HUMAN_PROMPT} how does a court case get to the Supreme Court? ${Anthropic.AI_PROMPT}`,
    max_tokens_to_sample: 300,
    model: 'claude-1',
  };
  const completion: Anthropic.Completion = await anthropic.completions.create(params);
}
main().catch(console.error);
```

Documentation for each method, request param, and response field are available in docstrings and will appear on hover in most modern editors.

## Handling errors

When the library is unable to connect to the API,
or if the API returns a non-success status code (i.e., 4xx or 5xx response),
a subclass of `APIError` will be thrown:

```ts
async function main() {
  const completion = await anthropic.completions
    .create({
      prompt: `${Anthropic.HUMAN_PROMPT} Your prompt here ${Anthropic.AI_PROMPT}`,
      max_tokens_to_sample: 300,
      model: 'claude-1',
    })
    .catch((err) => {
      if (err instanceof Anthropic.APIError) {
        console.log(err.status); // 400
        console.log(err.name); // BadRequestError
        console.log(err.headers); // {server: 'nginx', ...}
      }
    });
}
main().catch(console.error);
```

Error codes are as followed:

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

### Retries

Certain errors will be automatically retried 2 times by default, with a short exponential backoff.
Connection errors (for example, due to a network connectivity problem), 409 Conflict, 429 Rate Limit,
and >=500 Internal errors will all be retried by default.

You can use the `maxRetries` option to configure or disable this:

<!-- prettier-ignore -->
```js
// Configure the default for all requests:
const anthropic = new Anthropic({
  maxRetries: 0, // default is 2
});

// Or, configure per-request:
await anthropic.completions.create(
  {
    prompt: `${Anthropic.HUMAN_PROMPT} Can you help me effectively ask for a raise at work? ${Anthropic.AI_PROMPT}`,
    max_tokens_to_sample: 300,
    model: 'claude-1',
  },
  {
    maxRetries: 5,
  },
);

```

### Timeouts

Requests time out after 60 seconds by default. You can configure this with a `timeout` option:

<!-- prettier-ignore -->
```ts
// Configure the default for all requests:
const anthropic = new Anthropic({
  timeout: 20 * 1000, // 20 seconds (default is 60s)
});

// Override per-request:
await anthropic.completions.create(
  {
    prompt: `${Anthropic.HUMAN_PROMPT} Where can I get a good coffee in my neighbourhood? ${Anthropic.AI_PROMPT}`,
    max_tokens_to_sample: 300,
    model: 'claude-1',
  },
  {
    timeout: 5 * 1000,
  },
);

```

On timeout, an `APIConnectionTimeoutError` is thrown.

Note that requests which time out will be [retried twice by default](#retries).

## Configuring an HTTP(S) Agent (e.g., for proxies)

By default, this library uses a stable agent for all http/https requests to reuse TCP connections, eliminating many TCP & TLS handshakes and shaving around 100ms off most requests.

If you would like to disable or customize this behavior, for example to use the API behind a proxy, you can pass an `httpAgent` which is used for all requests (be they http or https), for example:

<!-- prettier-ignore -->
```ts
import http from 'http';
import Anthropic from 'anthropic';
import HttpsProxyAgent from 'https-proxy-agent';

// Configure the default for all requests:
const anthropic = new Anthropic({
  httpAgent: new HttpsProxyAgent(process.env.PROXY_URL),
});

// Override per-request:
await anthropic.completions.create(
  {
    prompt: `${Anthropic.HUMAN_PROMPT} How does a court case get to the Supreme Court? ${Anthropic.AI_PROMPT}`,
    max_tokens_to_sample: 300,
    model: 'claude-1',
  },
  {
    baseURL: 'http://localhost:8080/test-api',
    httpAgent: new http.Agent({ keepAlive: false }),
  },
);

```

## Status

This package is in beta. Its internals and interfaces are not stable
and subject to change without a major semver bump;
please reach out if you rely on any undocumented behavior.

We are keen for your feedback; please open an [issue](https://www.github.com/anthropics/anthropic-sdk-typescript/issues) with questions, bugs, or suggestions.

## Requirements

The following runtimes are supported:

- Node.js 16 LTS or later ([non-EOL](https://endoflife.date/nodejs)) versions.
- Deno v1.28.0 or higher (experimental).
  Use `import Anthropic from "npm:@anthropic-ai/sdk"`.

If you are interested in other runtime environments, please open or upvote an issue on GitHub.
