# Migration guide

This guide outlines the changes and steps needed to migrate your codebase to the latest version of the Anthropic TypeScript SDK.

The main changes are that the SDK now relies on the [builtin Web fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) instead of `node-fetch` and has zero dependencies.

## Migration CLI

Most programs will only need minimal changes, but to assist there is a migration tool that will automatically update your code for the new version.
To use it, upgrade the `@anthropic-ai/sdk` package, then run `./node_modules/.bin/anthropic-ai-sdk migrate ./your/src/folders` to update your code.
To preview the changes without writing them to disk, run the tool with `--dry`.

## Environment requirements

The minimum supported runtime and tooling versions are now:

- Node.js 20 LTS (Most recent non-EOL Node version)
- TypeScript 4.9
- Jest 28

## Breaking changes

### Web types for `withResponse`, `asResponse`, and `APIError.headers`

Because we now use the builtin Web fetch API on all platforms, if you wrote code that used `withResponse` or `asResponse` and then accessed `node-fetch`-specific properties on the result, you will need to switch to standardized alternatives.
For example, `body` is now a [Web `ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) rather than a [node `Readable`](https://nodejs.org/api/stream.html#readable-streams).

```ts
// Before:
const res = await client.example.retrieve('string/with/slash').asResponse();
res.body.pipe(process.stdout);

// After:
import { Readable } from 'node:stream';
const res = await client.example.retrieve('string/with/slash').asResponse();
Readable.fromWeb(res.body).pipe(process.stdout);
```

Additionally, the `headers` property on `APIError` objects is now an instance of the Web [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) class. It was previously defined as `Record<string, string | null | undefined>`.

### Named path parameters

Methods that take multiple path parameters typically now use named instead of positional arguments for better clarity and to prevent a footgun where it was easy to accidentally pass arguments in the incorrect order.

For example, for a method that would call an endpoint at `/v1/parents/{parent_id}/children/{child_id}`, only the _last_ path parameter is positional and the rest must be passed as named arguments.

```ts
// Before
client.parents.children.retrieve('p_123', 'c_456');

// After
client.parents.children.retrieve('c_456', { parent_id: 'p_123' });
```

This affects the following methods:

- `client.beta.skills.versions.retrieve()`
- `client.beta.skills.versions.delete()`

### URI encoded path parameters

Path params are now properly encoded by default. If you were manually encoding path parameters before giving them to the SDK, you must now stop doing that and pass the
param without any encoding applied.

For example:

```diff
- client.example.retrieve(encodeURIComponent('string/with/slash'))
+ client.example.retrieve('string/with/slash') // retrieves /example/string%2Fwith%2Fslash
```

Previously without the `encodeURIComponent()` call we would have used the path `/example/string/with/slash`; now we'll use `/example/string%2Fwith%2Fslash`.

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
- `client.models.retrieve()`
- `client.models.list()`
- `client.beta.models.retrieve()`
- `client.beta.models.list()`
- `client.beta.messages.batches.retrieve()`
- `client.beta.messages.batches.list()`
- `client.beta.messages.batches.delete()`
- `client.beta.messages.batches.cancel()`
- `client.beta.messages.batches.results()`
- `client.beta.files.list()`
- `client.beta.files.delete()`
- `client.beta.files.download()`
- `client.beta.files.retrieveMetadata()`
- `client.beta.skills.create()`
- `client.beta.skills.retrieve()`
- `client.beta.skills.list()`
- `client.beta.skills.delete()`
- `client.beta.skills.versions.create()`
- `client.beta.skills.versions.list()`

### Removed `httpAgent` in favor of `fetchOptions`

The `httpAgent` client option has been removed in favor of a [platform-specific `fetchOptions` property](https://github.com/anthropics/anthropic-sdk-typescript#fetch-options).
This change was made as `httpAgent` relied on `node:http` agents which are not supported by any runtime's builtin fetch implementation.

If you were using `httpAgent` for proxy support, check out the [new proxy documentation](https://github.com/anthropics/anthropic-sdk-typescript#configuring-proxies).

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

### Changed exports

#### Refactor of `@anthropic-ai/sdk/core`, `error`, `pagination`, `resource`, `streaming` and `uploads`

Much of the `@anthropic-ai/sdk/core` file was intended to be internal-only but it was publicly accessible, as such it has been refactored and split up into internal and public files, with public-facing code moved to a new `core` folder and internal code moving to the private `internal` folder.

At the same time, we moved some public-facing files which were previously at the top level into `core` to make the file structure cleaner and more clear:

```typescript
// Before
import '@anthropic-ai/sdk/error';
import '@anthropic-ai/sdk/pagination';
import '@anthropic-ai/sdk/resource';
import '@anthropic-ai/sdk/streaming';
import '@anthropic-ai/sdk/uploads';

// After
import '@anthropic-ai/sdk/core/error';
import '@anthropic-ai/sdk/core/pagination';
import '@anthropic-ai/sdk/core/resource';
import '@anthropic-ai/sdk/core/streaming';
import '@anthropic-ai/sdk/core/uploads';
```

If you were relying on anything that was only exported from `@anthropic-ai/sdk/core` and is also not accessible anywhere else, please open an issue and we'll consider adding it to the public API.

#### Resource classes

Previously under certain circumstances it was possible to import resource classes like `Completions` directly from the root of the package. This was never valid at the type level and only worked in CommonJS files.
Now you must always either reference them as static class properties or import them directly from the files in which they are defined.

```typescript
// Before
const { Completions } = require('@anthropic-ai/sdk');

// After
const { Anthropic } = require('@anthropic-ai/sdk');
Anthropic.Completions; // or import directly from @anthropic-ai/sdk/resources/completions
```

#### Cleaned up `uploads` exports

As part of the `core` refactor, `@anthropic-ai/sdk/uploads` was moved to `@anthropic-ai/sdk/core/uploads`
and the following exports were removed, as they were not intended to be a part of the public API:

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
import { type Uploadable, toFile } from '@anthropic-ai/sdk/core/uploads';
```

#### `APIClient`

The `APIClient` base client class has been replaced with a new `BaseAnthropic` class:

```typescript
// Before
import { APIClient } from '@anthropic-ai/sdk/core';

// After
import { BaseAnthropic } from '@anthropic-ai/sdk/client';
```

### File handling

The deprecated `fileFromPath` helper has been removed in favor of native Node.js streams:

```ts
// Before
Anthropic.fileFromPath('path/to/file');

// After
import fs from 'fs';
fs.createReadStream('path/to/file');
```

Note that this function previously only worked on Node.js. If you're using Bun, you can use [`Bun.file`](https://bun.sh/docs/api/file-io) instead.

### Shims removal

Previously you could configure the types that the SDK used like this:

```ts
// Tell TypeScript and the package to use the global Web fetch instead of node-fetch.
import '@anthropic-ai/sdk/shims/web';
import Anthropic from '@anthropic-ai/sdk';
```

The `@anthropic-ai/sdk/shims` imports have been removed. Your global types must now be [correctly configured](#minimum-types-requirements).

### Pagination changes

The `for await` syntax **is not affected**. This still works as-is:

```ts
// Automatically fetches more pages as needed.
for await (const betaMessageBatch of client.beta.messages.batches.list()) {
  console.log(betaMessageBatch);
}
```

The interface for manually paginating through list results has been simplified:

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

### `@anthropic-ai/sdk/src` directory removed

Previously IDEs may have auto-completed imports from the `@anthropic-ai/sdk/src` directory, however this
directory was only included for an improved go-to-definition experience and should not have been used at runtime.

If you have any `@anthropic-ai/sdk/src/*` imports, you will need to replace them with `@anthropic-ai/sdk/*`.

```ts
// Before
import Anthropic from '@anthropic-ai/sdk/src';

// After
import Anthropic from '@anthropic-ai/sdk';
```

## TypeScript troubleshooting

When referencing the library after updating, you may encounter new type errors related to JS features like private properties or fetch classes like Request, Response, and Headers.
To resolve these issues, configure your tsconfig.json and install the appropriate `@types` packages for your runtime environment using the guidelines below:

### Browsers

`tsconfig.json`

```jsonc
{
  "target": "ES2018", // note: we recommend ES2020 or higher
  "lib": ["DOM", "DOM.Iterable", "ES2018"]
}
```

### Node.js

`tsconfig.json`

```jsonc
{
  "target": "ES2018" // note: we recommend ES2020 or higher
}
```

`package.json`

```json
{
  "devDependencies": {
    "@types/node": ">= 20"
  }
}
```

### Cloudflare Workers

`tsconfig.json`

```jsonc
{
  "target": "ES2018", // note: we recommend ES2020 or higher
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
  "target": "ES2018" // note: we recommend ES2020 or higher
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
