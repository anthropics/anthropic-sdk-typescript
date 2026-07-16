# Claude SDK for Claude Platform on Google Cloud

[![NPM version](https://img.shields.io/npm/v/@anthropic-ai/google-cloud-sdk.svg?color=blue)](https://npmjs.org/package/@anthropic-ai/google-cloud-sdk)

This library provides convenient access to Claude Platform on Google Cloud — the first-party Claude API served through Google Cloud. It exposes the full Anthropic API surface and authenticates with a Google bearer token.

For the direct Claude API at api.anthropic.com, see [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript). For the `:rawPredict` publisher-model API, see [`@anthropic-ai/vertex-sdk`](https://github.com/anthropics/anthropic-sdk-typescript).

## Installation

```bash
npm install @anthropic-ai/google-cloud-sdk
```

## Usage

```ts
import { AnthropicGoogleCloud } from '@anthropic-ai/google-cloud-sdk';

const client = new AnthropicGoogleCloud({
  project: 'my-gcp-project', // or ANTHROPIC_GOOGLE_CLOUD_PROJECT
  workspaceId: 'wrkspc_...', // or ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID
});

const message = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude!' }],
});

console.log(message.content);
```

See [`examples/`](examples) for runnable basic and streaming examples.

## Configuration

| Option        | Environment variable                  | Notes                                                                                                                                                                            |
| ------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project`     | `ANTHROPIC_GOOGLE_CLOUD_PROJECT`      | GCP project id, used to derive the base URL. When neither is set (and no `baseURL` is given), it is resolved lazily from your Google credentials at or before the first request. |
| `location`    | `ANTHROPIC_GOOGLE_CLOUD_LOCATION`     | GCP location. Optional — defaults to `global`.                                                                                                                                   |
| `workspaceId` | `ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID` | Required unless `skipAuth` is set with an explicit `baseURL`.                                                                                                                    |
| `baseURL`     | `ANTHROPIC_GOOGLE_CLOUD_BASE_URL`     | Overrides the base URL derived from `project` + `location` + `workspaceId`.                                                                                                      |
| `skipAuth`    | —                                     | Skips the bearer token, for gateways that authenticate upstream. A `workspaceId` is still needed unless `baseURL` is explicit.                                                   |

When the project is resolved lazily, await `client.ready` to fail fast on misconfiguration instead of waiting for the first request.

## Authentication

Authentication uses a Google bearer token, resolved by precedence — an explicit `bearerTokenProvider`, then a [google-auth-library](https://www.npmjs.com/package/google-auth-library) `googleAuth` / `authClient`, then [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials).

This client never uses the base SDK's Anthropic credential sources: `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, and profile config files are all ignored, and the only `Authorization` header it sends is the Google bearer token.

### Application Default Credentials

Set up ADC (e.g. `gcloud auth application-default login`) and the client fetches and refreshes a bearer token for you, no auth options needed.

### Custom Google credentials

Pass a `GoogleAuth` or `AuthClient` to override the default credential chain (for example to use impersonated credentials):

```ts
import { AnthropicGoogleCloud } from '@anthropic-ai/google-cloud-sdk';
import { GoogleAuth } from 'google-auth-library';

const client = new AnthropicGoogleCloud({
  project: 'my-gcp-project',
  workspaceId: 'wrkspc_...',
  googleAuth: new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' }),
});
```

### Bearer token provider

If you already mint Google access tokens yourself, supply a `bearerTokenProvider`. It is invoked on every request and takes precedence over `googleAuth` / `authClient` and ADC:

```ts
const client = new AnthropicGoogleCloud({
  project: 'my-gcp-project',
  workspaceId: 'wrkspc_...',
  bearerTokenProvider: async () => myTokenSource.getAccessToken(),
});
```

### Pre-authenticated proxy

If a gateway or proxy authenticates upstream on your behalf, set `skipAuth` to skip the bearer token (with an explicit `baseURL`, no `workspaceId` is needed):

```ts
const client = new AnthropicGoogleCloud({
  baseURL: 'https://my-proxy.example.com',
  skipAuth: true,
});
```
