# Working in this repository

Context for contributors (human or AI) on how this SDK is put together, plus the things reviews most often come back to. Setup instructions live in [CONTRIBUTING.md](CONTRIBUTING.md).

## Overview

- The official TypeScript SDK for the Claude API (`@anthropic-ai/sdk`). Most of it is generated from the OpenAPI spec. Hand-written helpers, streams, tool runners, credentials, and middleware sit on top. The platform clients live in `packages/{aws,bedrock,foundry,google-cloud,vertex}-sdk` and are released as separate packages.
- `src/lib/`, `src/helpers/`, `src/tools/`, `packages/`, and `examples/` are hand-written. The generator never touches them. Everything else comes from the generator, with custom code mixed in. Generated files carry no marker comment, and hand-written methods, imports, and whole blocks sit inside many of them, including `src/client.ts` and files under `src/core/`, `src/internal/`, and `src/resources/`. So a file's location doesn't tell you who owns a given line.
- Check whether a line is generated before you change it. Every commit the generator produced carries a `Stainless-Generated-From: <sha>` trailer, and a hand-written commit has none. The SHA is the generator's own output for that commit, with no custom code in it. Find the latest one with `git log -1 --grep='^Stainless-Generated-From: ' --format='%(trailers:key=Stainless-Generated-From,valueonly)'`, fetch it with `git fetch origin <sha>`, and diff a file against it (`git diff <sha> -- src/resources/beta/messages/messages.ts`). Lines that appear only on your side are custom code. If the line you want to change is in the generated commit, the fix probably belongs in the generator.
- New generator output is merged with hand edits, so an edit to a generated file survives regeneration but can conflict with it. What matters is where the lines go, not how many there are. Changing lines the generator writes, such as a method's parameters or how it builds the request, is likely to conflict the next time the spec changes. Adding lines of your own, such as a new method or a block in a method body, is usually fine, even a large one. `stream()`, `parse()`, and `toolRunner()` in `src/resources/beta/messages/messages.ts` are hand-written. Don't add a comment that marks code as hand-written.
- Fix generator-owned behavior in the generator or the spec, not by hand. A type that's missing a field is a spec bug, and a wrong return type in `api.md` is a generator regression.
- PRs target the repository's default branch. In the public repository that is `main`. Elsewhere, don't assume its name (`gh repo view --json defaultBranchRef` shows it). `next` is a release branch in the public repository that only automation writes to, and release-please merges it into `main` at a release. Never open a PR against `next`, and never merge or push to it by hand.
- An unreleased API feature has its own branch, and hand-written work for that feature targets it. Those branches get force-pushed, so rebase with `git rebase --onto <new-base> <old-base-sha>`.
- Release-please writes `CHANGELOG.md`, the versions, and `.release-please-manifest.json`, and it rewrites them in each release PR. A manual edit is overwritten or conflicts with that PR. Describe a public type change in its doc comment and commit message instead.

## Build, test, lint

- The package manager is pnpm, as a single workspace (`pnpm-workspace.yaml`). Only the root `package.json` pins `packageManager`.
- `./scripts/format`, `./scripts/lint`, and `./scripts/test` are what CI runs, so run them before you push. Calling `prettier`, `eslint`, `tsc`, `vitest`, or `pnpm` directly is fine for a quick, targeted check while you work.
- `./scripts/test` starts a Steady mock server on port 4010 unless `TEST_API_BASE_URL` is set. It runs vitest at the root and then in each platform package. Extra arguments go to the root run only, so `./scripts/test tests/lib/parser.test.ts` narrows that run and the platform packages' suites still follow.
- Nothing in a default run calls a real endpoint. Tests talk to the mock server, a mocked `fetch`, or recorded fixtures. Tests that do call a real endpoint, such as `packages/google-cloud-sdk/tests/live.test.ts`, are skipped unless `ANTHROPIC_LIVE=1` is set.
- `pnpm test:ecosystem` runs `ecosystem-tests/cli.mts` against real runtimes and bundlers, including Deno, Bun, Cloudflare Workers, edge, browsers, and TypeScript 5.0. Mark a project `knownFailure` only when its fix is already tracked.
- CI's `detect-breaking-changes` checks out the generated tests from a base and runs `./scripts/lint` to see whether they still type-check against your branch. The base is the `breaking-change-baseline` tag when the repository has one, otherwise `main`. It only sees the generated surface, so call out breaks in hand-written API yourself, including changed defaults and newly rejected inputs.
- Anything a user can import without reaching into `src/internal/` or `src/lib/internal/` is public, documented or not, because the package's `exports` map exposes every other module. So new things start unexported or in `src/internal/`, and are made public on purpose.
- Don't make something public unless users need it. Every public name has to be supported from then on. A helper, constant, or option stays internal when only the SDK uses it, even if exposing it would be convenient.
- Runtime behavior is the contract. A change that only `tsc` notices doesn't break a running program, but it can fail a user's build, so avoid it where you can and call it out in the PR where you can't. A runtime change users could depend on is breaking even when no type changes, and no check sees it.
- A rename or removal keeps the old name as a `@deprecated` alias, as `toolUseBlock` does for `toolUse`. A behavior change users could depend on waits for a deprecation cycle or the next major. New implicit behavior ships with a way to turn it off. A major version is rare and a maintainer's call, so describe the compatibility impact in the PR rather than asking for one.
- Retiring an option before a major means keeping it working, marking it `@deprecated` in its doc comment, logging a deprecation message, and removing it at the next major. Throw when it's passed only if the old behavior can't be honored at all, as `unrestrictedPaths` on the environment worker does.
- `zod` is an optional peer dependency, because callers pass their own zod schemas to the helpers, so the SDK has to use the caller's copy of the library. A package the SDK imports only for types can be a normal dependency. Avoid adding other runtime dependencies unless absolutely necessary. Use a platform API instead.
- Security floors go under `pnpm.overrides`, scoped to a major version (`"pkg@N": "^N.x.y"`).

## Runtimes and bundling

The SDK runs on Node, Deno, Bun, edge runtimes, and in browsers. Bundlers follow every statically resolvable import, including a lazy `import('./relative/path')`, and a `node:` builtin in the resulting chunk fails a browser build.

- Code that references a Node builtin lives in a module named `node.ts` (or a `node/` directory). Everything else in `src/` is runtime-agnostic. eslint enforces this. `import type` of a builtin is fine anywhere, because types are erased.
- Node-only modules are best imported by the user and passed into the SDK. SDK-internal code doesn't import them, statically or dynamically.
- If an internal reference can't be avoided, go through `src/internal/node.ts` with a lazy import, and shim the module in the package.json `browser` field. The shim is a `<name>.browser.ts` with the same exports, where every value export throws `<exportName> requires Node.js or a Node-compatible runtime`.
- A new Node-only subpath needs an entry in the `browser` field and in the hardcoded list in `scripts/utils/postprocess-files.cjs`. It also needs runtime and type-level parity tests, like `tests/tools/node-browser-stub.test.ts`.
- Don't hide imports from bundlers with `webpackIgnore` comments, variable specifiers, or `eval`. Don't reference `process` at module scope unless a `typeof process` (or `globalThis.process?.`) guard covers it.
- Read environment variables with `readEnv`, not `process.env`. Outside Node-only modules, use `src/internal/utils/base64.ts` and `uuid4()`, not `Buffer` or `require`.
- Use async `fs/promises` in Node-only code. A `*Sync` call blocks the caller's event loop.
- A `helpers/beta/<name>` subpath is a flat `src/helpers/beta/<name>.ts`, because the wildcard export doesn't resolve a directory.

## Code organization

- Hand-written features live in `src/lib/` (streams, tool runners, middleware, credentials, sessions, environments), `src/helpers/` and `src/helpers/beta/`, and `src/tools/`.
- Everything in `src/lib/` is public except `src/lib/internal/`, which the `exports` map blocks the same way it blocks `src/internal/`. SDK-only plumbing goes in `src/internal/`, and a type that's part of the public API goes in `src/core/`.
- Every `packages/*/src/internal` is a symlink to `src/internal`, so code in `src/internal/` can't import from `src/resources/` or `src/lib/`. Otherwise the platform packages fail to build.
- Shared primitives are in `src/internal/utils/`: `sleep`, `backoff`, `async-queue`, `promise`, and `abort`. Extend those rather than defining a copy in a feature folder. When you extract a helper, move every existing caller to it in the same PR.
- Helper classes hang off the resource that creates them, and are re-exported from there as well (`Messages.BetaToolRunner`, `client.beta.messages.toolRunner()`). Like generated methods, a helper takes the resource ID as its first argument.
- Beta helpers are prefixed `beta` and live in `src/helpers/beta/` (`betaZodTool`, `betaTool`). GA helpers stay in `src/helpers/`.
- Cross-cutting behavior goes in middleware or request options, not in `xWithY` method variants. That way `create`, `stream`, and `toolRunner` all get it.
- Helpers that make requests accept `requestOptions`, and tag their requests with `helperHeader(...)` from `src/internal/stainless-helper-header.ts`. Those tag values are shared with the other SDKs.
- A method for a beta API appends that API's beta value to the caller's `betas` and sends the list as `anthropic-beta`. `options.headers` is merged last, so an explicit header from the caller wins. A helper that needs a beta adds it the same way, as `parse` does with `structured-outputs-2025-12-15`. It doesn't ask the caller to add it.
- Send every property the caller passed. Don't strip unknown fields from a request, because the SDK's contract is to send everything.
- A platform client keeps its own state in private fields, and carries that state into copies through its `withOptions` override. A resource the platform doesn't serve is a getter that throws an explanatory error.
- Prefer generated types to hand-written copies. Hand-written unions that shadow generated ones, such as `BetaClientRunnableToolType`, have to be updated when a tool version ships.
- For anything cross-SDK, try to match the Python and Go SDKs. That covers helper and option names, defaults, `x-stainless-helper` values, model-visible strings, retry rules, credential precedence, and environment variables. Put any divergence in the PR description, not in a code comment.
- Say in `src/_vendor/<name>/README.md` where vendored code came from and what changed locally.

## Errors

- A failure that comes from SDK- or API-specific logic throws `AnthropicError` or a subclass, so callers can catch the SDK's failures in one place. API failures are `APIError` subclasses, chosen by status. Credentials, a workspace ID, or a project that can't be resolved from the options and the environment throw `AnthropicError`, and a failed token exchange throws `WorkloadIdentityError`.
- Use the standard `TypeError`, or `RangeError` for a value out of range, where any JavaScript library would. That covers an argument of the wrong type (`buildHeaders` rejects a header name that isn't a string) and options that can't be combined (the client rejects `profile` together with `credentials` or `config`). Avoid a bare `Error`, because a caller can't tell it apart from anything else.
- Error text is actionable. It names the option, where its value came from, and the fix, such as the beta string or the replacement option.
- Throw when a caller passes two options that conflict. Rejecting an option the SDK used to ignore is a breaking change, so warn first.
- Format caught values with `castToError`, or with `e instanceof Error ? e.message : String(e)`. Don't write `(e as Error).message`.
- Detect an abort with `isAbortError(err)` from `src/internal/errors.ts`, not with `instanceof`.
- Throw a typed error for content the SDK can't convert, so the caller can catch it (`UnsupportedMCPValueError`). Don't quietly turn it into text.
- Log through the client's logger (`loggerFor(client)`, or `ctx.logger` in middleware), not `console`. A deprecation message starts with `Anthropic:` and names the replacement.

## Common mistakes

- **Dropping a new `message_delta` field.** When codegen adds one, handle it in both `MessageStream` and `BetaMessageStream`. Then add it to the `Record<keyof …, true>` tripwires in `tests/api-resources/MessageStream.test.ts` and `tests/api-resources/BetaMessageStream.test.ts`.
- **Hand-listing generated fields with no tripwire.** Hand-written code that lists the fields or variants of a generated type needs a tripwire test. A tripwire asserts no behavior. It compares the hand-written list with the generated type, and stops compiling when the spec changes one without the other. Its comment names the hand-written code to update. The existing ones are the stream-test constants above and `tests/lib/TracksToolInput.test.ts`. `tsc` enforces them through `./scripts/lint`, not the test runner. Tripwires are a stopgap. The goal is for the generator to emit anything that depends on generated output, so each one goes away once the generator produces the code it guards.
- **Fixing one stream and not the other.** `MessageStream` and `BetaMessageStream` are parallel. A fix to one belongs in the other, in the same PR. Report a stream error only through `#handleError`.
- **Throwing on an unknown union member.** The API adds event and block types, and a value this SDK version doesn't know yet has to flow through the user's process, not throw. Handle the known cases in a `switch`, and end it with `default: checkNever(value)` from `src/internal/utils/values.ts`. `checkNever` takes a `never`, so it stops compiling when a known member is unhandled, and it does nothing at runtime.
- **Runtime checks that the types already cover.** Trust typed inputs. Don't add a runtime check for something the caller's types already rule out.
- **Validating what the API validates.** Let the server reject media types, lengths, and formats, and don't re-validate the tool input the model sent against its schema. A client-side check is for something the API never sees, such as the size of a local file or a path outside the working directory. If the client needs a cap for its own safety, make it configurable, as `AgentToolContext.maxFileBytes` is. `null` is the only off-switch.
- **Retry loops that differ from the client.** Treat 408, 409, and 429 as retryable, add jitter with `applyJitter`, and cap delays with `Math.min`.
- **Leaking through abort listeners.** A listener on the caller's signal lives as long as that signal does, and so does everything its closure captures.
  - Build the listener in a small separate function that takes only what it needs, as `_makeAbort` in `src/client.ts` and `makeCleanup` in `src/internal/request-signal.ts` do. An arrow function written inline captures the whole enclosing scope, the request body and options included, and a long-lived signal then keeps all of it from being collected.
  - Add listeners with `{ once: true }`, and also remove them when the work finishes, because `once` only removes a listener if the signal actually aborts.
  - Link controllers with `linkAbort`, and call the cleanup function it returns.
- **Returning early on abort.** An async function calls `signal.throwIfAborted()`. Only an async generator returns quietly.
- **Mutating the caller's data.** Clone a `messages` array before a helper appends to it.

## Style notes

- Private members use `#name`, not the TypeScript `private` keyword.
- Rarely silence a checker. In this SDK a `@ts-expect-error` or an `eslint-disable` comment usually means the code is doing something wrong, so fix the code or its types first. When the checker is the one that is wrong, use `@ts-expect-error` with a reason, not `@ts-ignore`, so the suppression fails when it's no longer needed.
- Return `unknown`, not `any`. Avoid `as never` and `as unknown as` casts unless absolutely necessary. Narrow unions with the `type` discriminator, not a structural cast.
- Model a state that has several cases as one discriminated union, not as parallel maps.
- Derive types from a single constant (`(typeof X)[number]`), so the list and the type can't drift apart.
- Options that stay in JavaScript are camelCase. Anything sent to the API as-is keeps its snake_case wire name.
- Acronyms are capitalized (`transformJSONSchema`, `APIError`). Don't pluralize "middleware": a list of them is still `middleware`, as in the client's `middleware` option and `applyMiddleware`, never `middlewares`.
- Names use API terms (`tool`, `input_schema`, `run`). Say "promise", not "task".
- Date-suffix a factory for a versioned tool (`betaAgentToolset20260401`).
- JSDoc has no `{type}` on `@param`, and it uses `@default` for defaults. Every public field gets a doc comment.
- Write a comment only for a non-obvious "why", in a line or two. Don't restate the code or record tracked work.
- Inline a helper with one caller. Split a large module by concern.
- Examples use the public API and a real backend, and read credentials from the environment. Keep clients inside `main()`. Bedrock examples use inference-profile model IDs.

## Tests

- A behavior change comes with a test that fails before it and passes after. Test both sides of a guard, and check that a test's setup really reaches the path in its name.
- Platform-package tests live in `packages/<name>-sdk/tests/`.
- Reuse SDK internals in tests, such as `_iterSSEMessages`. Don't write a second SSE parser.
- Build stream fixtures from what the server sends. Leave a key out rather than setting it to `null`.
- Use `test.each` for cases that differ only in input, and snapshots for large expected values.
- Tool-runner end-to-end tests replay decompressed `nock` fixtures from `tests/lib/tools/nockFixtures/`. They only reach the real API when `NOCK_RECORD=true` re-records them. Keep keys and organization IDs in fixtures obviously fake.
- Pin a hand-written list or union to the generated type it was derived from with a compile-time tripwire test, as `tests/lib/TracksToolInput.test.ts` does.
- A new header merge rule needs a case in `tests/buildHeaders.test.ts` for each `HeadersLike` shape.

## Commits and pull requests

- Conventional Commits drive release-please (`feat(scope):`, `fix(scope):`, `chore`, `docs`, …).
- Target the default branch, never `next` (see Overview). Make one logical change per PR. Split large features into stacked PRs. When you replace a PR, close the old one with a link to the new one.
- Don't commit `.stats.yml` or other generator-owned files from a feature branch. They conflict with the next codegen push.
- Don't ship a deprecated alias for an API that hasn't been released. Rename it.
- A PR description says what was wrong, what changed, and how you know it works. Call out behavior changes, cross-SDK divergence, and anything unverified. Update the description and the doc comments when a later commit changes the behavior.
