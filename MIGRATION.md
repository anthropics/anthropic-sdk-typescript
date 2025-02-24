# Migration guide

This guide outlines the changes and steps needed to migrate your codebase to the latest version of the Anthropic TypeScript SDK.

The main changes are that the SDK now relies on the [builtin Web fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) instead of `node-fetch` and has zero dependencies.

## Environment requirements

The minimum supported runtime and tooling versions are now:

- Node.js 18.x last LTS (Required for built-in fetch support)
  - This was previously documented as the minimum supported Node.js version but Node.js 16.x mostly worked at runtime; now it will not.
- TypeScript 4.9
- Jest 28

## Minimum types requirements

### DOM

`tsconfig.json`

```jsonc
{
  "target": "ES2015", // note: we recommend ES2020 or higher
  "lib": ["DOM", "DOM.Iterable", "ES2018"]
}
```

### Node.js

`tsconfig.json`

```jsonc
{
  "target": "ES2015" // note: we recommend ES2020 or higher
}
```

`package.json`

```json
{
  "devDependencies": {
    "@types/node": ">= 18.18.7"
  }
}
```

### Cloudflare Workers

`tsconfig.json`

```jsonc
{
  "target": "ES2015", // note: we recommend ES2020 or higher
  "lib": ["ES2020"], // <- needed by @cloudflare/workers-types
  "types": ["@cloudflare/workers-types"]
}
```

`package.json`

```json
{
  "devDependencies": {
    "@cloudflare/workers-types": ">= 0.20221111.0"
  }
}
```

### Bun

`tsconfig.json`

```jsonc
{
  "target": "ES2015" // note: we recommend ES2020 or higher
}
```

`package.json`

```json
{
  "devDependencies": {
    "@types/bun": ">= 1.2.0"
  }
}
```

### Deno

No config needed!

## Breaking changes

### URI encoded path parameters

Path params are now properly encoded by default. If you were manually encoding path parameters before giving them to the SDK, you must now stop doing that and pass the
param without any encoding applied.

For example:

```diff
- client.example.retrieve(encodeURIComponent('string/with/slash'))
+ client.example.retrieve('string/with/slash') // renders example/string%2Fwith%2Fslash
```

Previously without the `encodeURIComponent()` call we would have used the path `/example/string/with/slash`; now we'll use `/example/string%2Fwith%2Fslash`.

### Removed `httpAgent` in favor of `fetchOptions`

The `httpAgent` client option has been removed in favor of a [platform-specific `fetchOptions` property](https://github.com/stainless-sdks/anthropic-typescript#fetch-options).
This change was made as `httpAgent` relied on `node:http` agents which are not supported by any runtime's builtin fetch implementation.

If you were using `httpAgent` for proxy support, check out the [new proxy documentation](https://github.com/stainless-sdks/anthropic-typescript#configuring-proxies).

Before:

```ts
import Anthropic from '@anthropic-ai/sdk';
import http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Configure the default for all requests:
const client = new Anthropic({
  httpAgent: new HttpsProxyAgent(process.env.PROXY_URL),
});
```

After:

```ts
import Anthropic from '@anthropic-ai/sdk';
import * as undici from 'undici';

const proxyAgent = new undici.ProxyAgent(process.env.PROXY_URL);
const client = new Anthropic({
  fetchOptions: {
    dispatcher: proxyAgent,
  },
});
```

### Removed request options overloads

When making requests with no required body, query or header parameters, you must now explicitly pass `null`, `undefined` or an empty object `{}` to the params argument in order to customise request options.

```diff
client.example.list();
client.example.list({}, { headers: { ... } });
client.example.list(null, { headers: { ... } });
client.example.list(undefined, { headers: { ... } });
- client.example.list({ headers: { ... } });
+ client.example.list({}, { headers: { ... } });
```

This affects the following methods:

- `client.messages.batches.list()`
- `client.models.list()`
- `client.beta.models.list()`
- `client.beta.messages.batches.retrieve()`
- `client.beta.messages.batches.list()`
- `client.beta.messages.batches.delete()`
- `client.beta.messages.batches.cancel()`
- `client.beta.messages.batches.results()`

### Pagination changes

Note that the `for await` syntax is _not_ affected. This still works as-is:

```ts
// Automatically fetches more pages as needed.
for await (const betaMessageBatch of client.beta.messages.batches.list()) {
  console.log(betaMessageBatch);
}
```

#### Simplified interface

The pagination interface has been simplified:

```ts
// Before
page.nextPageParams();
page.nextPageInfo();
// Required manually handling { url } | { params } type

// After
page.nextPageRequestOptions();
```

#### Removed unnecessary classes

Page classes for individual methods are now type aliases:

```ts
// Before
export class BetaMessageBatchesPage extends Page<BetaMessageBatch> {}

// After
export type BetaMessageBatchesPage = Page<BetaMessageBatch>;
```

If you were importing these classes at runtime, you'll need to switch to importing the base class or only import them at the type-level.

### File handling

The deprecated `fileFromPath` helper has been removed in favor of native Node.js streams:

```ts
// Before
Anthropic.fileFromPath('path/to/file');

// After
import fs from 'fs';
fs.createReadStream('path/to/file');
```

Note that this function previously only worked on Node.j. If you're using Bun, you can use [`Bun.file`](https://bun.sh/docs/api/file-io) instead.

### Shims removal

Previously you could configure the types that the SDK used like this:

```ts
// Tell TypeScript and the package to use the global Web fetch instead of node-fetch.
import '@anthropic-ai/sdk/shims/web';
import Anthropic from '@anthropic-ai/sdk';
```

The `@anthropic-ai/sdk/shims` imports have been removed. Your global types must now be [correctly configured](#minimum-types-requirements).

### `@anthropic-ai/sdk/src` directory removed

Previously IDEs may have auto-completed imports from the `@anthropic-ai/sdk/src` directory, however this
directory was only included for an improved go-to-definition experience and should not have been used at runtime.

If you have any `@anthropic-ai/sdk/src` imports, you must replace it with `@anthropic-ai/sdk`.

```ts
// Before
import Anthropic from '@anthropic-ai/sdk/src';

// After
import Anthropic from '@anthropic-ai/sdk';
```

### Headers

The `headers` property on `APIError` objects is now an instance of the Web [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) class. It was previously just `Record<string, string | null | undefined>`.

### Removed exports

#### `Response`

```typescript
// Before
import { Response } from '@anthropic-ai/sdk';

// After
// `Response` must now come from the builtin types
```

#### Resource classes

If you were importing resource classes from the root package then you must now import them from the file they are defined in:

```typescript
// Before
import { Completions } from '@anthropic-ai/sdk';

// After
import { Completions } from '@anthropic-ai/sdk/resources/completions';
```

#### `@anthropic-ai/sdk/core`

The `@anthropic-ai/sdk/core` file was intended to be internal-only but it was publicly accessible, as such it has been refactored and split up into internal files.

If you were relying on anything that was only exported from `@anthropic-ai/sdk/core` and is also not accessible anywhere else, please open an issue and we'll consider adding it to the public API.

#### Cleaned up `@anthropic-ai/sdk/uploads` exports

The following exports have been removed from `@anthropic-ai/sdk/uploads` as they were not intended to be a part of the public API:

- `fileFromPath`
- `BlobPart`
- `BlobLike`
- `FileLike`
- `ResponseLike`
- `isResponseLike`
- `isBlobLike`
- `isFileLike`
- `isUploadable`
- `isMultipartBody`
- `maybeMultipartFormRequestOptions`
- `multipartFormRequestOptions`
- `createForm`

Note that `Uploadable` & `toFile` **are** still exported:

```typescript
import { type Uploadable, toFile } from '@anthropic-ai/sdk/uploads';
```
