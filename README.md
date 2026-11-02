# <img src=".github/logo.svg" alt="" width="32"> Claude SDK for TypeScript

[![NPM version](https://img.shields.io/npm/v/@anthropic-ai/sdk.svg)](https://npmjs.org/package/@anthropic-ai/sdk)

The Claude SDK for TypeScript provides access to the [Claude API](https://docs.anthropic.com/en/api/) from server-side TypeScript or JavaScript applications.

## Documentation

SDK helpers (streaming, structured outputs, tool helpers and the tool runner) are documented in [helpers.md](helpers.md). The browser and computer toolset classes have their own guides, [browser-toolset.md](browser-toolset.md) and [computer-toolset.md](computer-toolset.md).

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
  model: 'claude-opus-5-5',
});

console.log(message.content);
```

## Requirements

TypeScript >= 5.0 is supported.

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

## OpenTelemetry

The SDK reports each API call as an OpenTelemetry span once your application has registered a tracer provider with `@opentelemetry/api`, which the SDK depends on.
Spans are on by default, so there is nothing to enable on the client.
The `openTelemetry` client option selects another tracer provider, turns the spans or the trace headers off, or, with `traces.contentMode: 'content'`, adds the content of requests and responses to them.

```ts
const client = new Anthropic({ openTelemetry: { tracerProvider } }); // a provider other than the registered one
const quiet = new Anthropic({ openTelemetry: false }); // no spans
const detailed = new Anthropic({
  openTelemetry: { traces: { contentMode: 'content', maxContentBytes: 65_536 } }, // content, up to about 64 KiB a span
});
const unpropagated = new Anthropic({ openTelemetry: { propagation: false } }); // spans, and no trace headers on the requests

await client.messages.create(params, { openTelemetry: { conversationId } }); // sets gen_ai.conversation.id
```

`traces` is a boolean, or an object with `enabled`, `contentMode` and `maxContentBytes`.
With each request the client sends the trace context of its span, as the headers that your registered propagator writes: `traceparent`, and `tracestate` and `baggage` when it writes them.
`propagation: false` sends none of them and leaves the spans as they are, for an application whose HTTP client instrumentation already propagates the trace context, so that a request does not carry it twice.
A field that the option leaves unset has its default.

A client without the option reads these environment variables once, when it is constructed: `ANTHROPIC_OPEN_TELEMETRY=false` turns its spans off, `ANTHROPIC_OPEN_TELEMETRY_PROPAGATION=false` turns `propagation` off, and `ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE` and `ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES` give `contentMode` and `maxContentBytes`.
A client with the option does not read them.

`client.openTelemetry` is the option as the client settled it.
A `withOptions()` copy that passes `openTelemetry` uses that in place of the client's whole option, so spread the settled one to change a single setting:

```ts
const { openTelemetry } = client;
const withContent = client.withOptions({
  openTelemetry: { ...openTelemetry, traces: { ...openTelemetry.traces, contentMode: 'content' } },
});
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details. Versions released before the change from the MIT License, and third-party contributions merged before it, remain under the MIT License. See [LICENSE-MIT](LICENSE-MIT).
