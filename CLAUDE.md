# Working in this repository

Context for contributors (human or AI) on how this repository is put together, plus the things reviews most often come back to. Setup instructions live in [CONTRIBUTING.md](CONTRIBUTING.md).

## This repository's own rules

The generator writes the rest of this file. Rules about this repository's hand-written code go in this section, and a change anywhere else in the file belongs in the generator.

### Overview

- The official TypeScript SDK for the Claude API (`@anthropic-ai/sdk`). Hand-written helpers, streams, tool runners, credentials, and middleware sit on top of the generated code. The platform clients live in `packages/{aws,bedrock,foundry,google-cloud,vertex}-sdk` and are released as separate packages.
- `src/helpers/`, `src/tools/`, and `packages/` are hand-written, like `src/lib/` and `examples/`. The generator never touches them.
- `stream()`, `parse()`, and `toolRunner()` in `src/resources/beta/messages/messages.ts` are hand-written.
- An unreleased API feature has its own branch, and hand-written work for that feature targets it. Those branches get force-pushed, so rebase with `git rebase --onto <new-base> <old-base-sha>`.
- Describe a public type change in its doc comment and commit message, not in a manual `CHANGELOG.md` edit.

### Build, test, lint

- The repository is a single pnpm workspace (`pnpm-workspace.yaml`). Only the root `package.json` pins `packageManager`.
- `./scripts/test` runs vitest at the root and then in each platform package. Extra arguments go to the root run only, so `./scripts/test tests/lib/parser.test.ts` narrows that run and the platform packages' suites still follow.
- Tests talk to the mock server, a mocked `fetch`, or recorded fixtures. Tests that do call a real endpoint, such as `packages/google-cloud-sdk/tests/live.test.ts`, are skipped unless `ANTHROPIC_LIVE=1` is set.
- `pnpm test:ecosystem` runs `ecosystem-tests/cli.mts` against real runtimes and bundlers, including Deno, Bun, Cloudflare Workers, edge, browsers, and TypeScript 5.0. Mark a project `knownFailure` only when its fix is already tracked.
- `toolUseBlock` is kept as a `@deprecated` alias for `toolUse`. `unrestrictedPaths` on the environment worker throws when it's passed, because its old behavior can't be honored at all.
- `zod` is an optional peer dependency, because callers pass their own zod schemas to the helpers, so the SDK has to use the caller's copy of the library.

### Runtimes and bundling

- Every value export of a hand-written browser shim throws `<exportName> requires Node.js or a Node-compatible runtime`.
- A new Node-only subpath needs an entry in the `browser` field and in the hardcoded list in `scripts/utils/postprocess-files.cjs`. It also needs runtime and type-level parity tests, like `tests/tools/node-browser-stub.test.ts`.
- A `helpers/beta/<name>` subpath is a flat `src/helpers/beta/<name>.ts`, because the wildcard export doesn't resolve a directory.

### Code organization

- Hand-written features live in `src/lib/` (streams, tool runners, middleware, credentials, sessions, environments), `src/helpers/` and `src/helpers/beta/`, and `src/tools/`.
- Every `packages/*/src/internal` is a symlink to `src/internal`, so code in `src/internal/` can't import from `src/resources/` or `src/lib/`. Otherwise the platform packages fail to build.
- The hand-written primitives in `src/internal/utils/` are `backoff`, `async-queue`, `promise`, and `abort`.
- `Messages.BetaToolRunner` and `client.beta.messages.toolRunner()` show how a helper class hangs off the resource that creates it.
- Beta helpers are prefixed `beta` and live in `src/helpers/beta/` (`betaZodTool`, `betaTool`). GA helpers stay in `src/helpers/`.
- Cross-cutting behavior goes in middleware or request options, not in `xWithY` method variants. That way `create`, `stream`, and `toolRunner` all get it.
- Helpers that make requests accept `requestOptions`, and tag their requests with `helperHeader(...)` from `src/internal/stainless-helper-header.ts`. Those tag values are shared with the other SDKs.
- A method for a beta API appends that API's beta value to the caller's `betas` and sends the list as `anthropic-beta`. `options.headers` is merged last, so an explicit header from the caller wins. A helper that needs a beta adds it the same way, as `parse` does with `structured-outputs-2025-12-15`. It doesn't ask the caller to add it.
- A platform client keeps its own state in private fields, and carries that state into copies through its `withOptions` override. A resource the platform doesn't serve is a getter that throws an explanatory error.
- Hand-written unions that shadow generated ones, such as `BetaClientRunnableToolType`, have to be updated when a tool version ships.
- Matching the other SDKs also covers `x-stainless-helper` values and model-visible strings.
- Say in `src/_vendor/<name>/README.md` where vendored code came from and what changed locally.

### Errors

- Credentials, a workspace ID, or a project that can't be resolved from the options and the environment throw `AnthropicError`, and a failed token exchange throws `WorkloadIdentityError`.
- The client rejects `profile` together with `credentials` or `config` with a `TypeError`.
- The fix that error text names can be the beta string or the replacement option.
- Throw a typed error for content the SDK can't convert, so the caller can catch it (`UnsupportedMCPValueError`). Don't quietly turn it into text.
- In middleware, log through `ctx.logger`. A deprecation message starts with `Anthropic:`.

### Common mistakes

- **Dropping a new `message_delta` field.** When codegen adds one, handle it in both `MessageStream` and `BetaMessageStream`. Then add it to the `Record<keyof …, true>` tripwires in `tests/api-resources/MessageStream.test.ts` and `tests/api-resources/BetaMessageStream.test.ts`.
- **Hand-listing generated fields with no tripwire.** The existing tripwires are the stream-test constants above and `tests/lib/TracksToolInput.test.ts`.
- **Fixing one stream and not the other.** `MessageStream` and `BetaMessageStream` are parallel. A fix to one belongs in the other, in the same PR. Report a stream error only through `#handleError`.
- **Throwing on an unknown union member.** Handle the known cases in a `switch`, and end it with `default: checkNever(value)` from `src/internal/utils/values.ts`. `checkNever` takes a `never`, so it stops compiling when a known member is unhandled, and it does nothing at runtime.
- **Validating what the API validates.** Don't re-validate the tool input the model sent against its schema. A path outside the working directory is something the API never sees, so a client-side check covers it. `AgentToolContext.maxFileBytes` is a configurable cap.
- **Retry loops that differ from the client.** Add jitter with `applyJitter`, and cap delays with `Math.min`.
- **Leaking through abort listeners.** `makeCleanup` in `src/internal/request-signal.ts` builds its listener in a separate function, as `_makeAbort` does. Link controllers with `linkAbort`, and call the cleanup function it returns.

### Style notes

- Don't pluralize "middleware": a list of them is still `middleware`, as in the client's `middleware` option and `applyMiddleware`, never `middlewares`.
- Names use API terms (`tool`, `input_schema`, `run`).
- Date-suffix a factory for a versioned tool (`betaAgentToolset20260401`).
- Bedrock examples use inference-profile model IDs.

### Tests

- Platform-package tests live in `packages/<name>-sdk/tests/`.
- Tool-runner end-to-end tests replay decompressed `nock` fixtures from `tests/lib/tools/nockFixtures/`. They only reach the real API when `NOCK_RECORD=true` re-records them.

## Rules every SDK shares

These rules don't depend on the language. The SDKs for this API in other languages carry the same text. A helper, below, is hand-written public code built on the generated client.

### Generated and hand-written code

- Most of this repository is generated from the OpenAPI spec, and hand-written code sits on top. Generated files carry no marker comment, and hand-written methods, imports, and whole blocks sit inside many of them. So a file's location doesn't tell you who owns a given line.
- Check whether a line is generated before you change it. A commit the generator produced carries a `Stainless-Generated-From: <sha>` trailer, and a hand-written commit has none. The SHA is the generator's own output for that commit, with no hand-written code in it. Find the latest one with `git log -1 --grep='^Stainless-Generated-From: ' --format='%(trailers:key=Stainless-Generated-From,valueonly)'`, fetch it with `git fetch origin <sha>`, and diff a file against it with `git diff <sha> -- <path>`. Lines that appear only on your side are hand-written. If the line you want to change is in the generated commit, the fix probably belongs in the generator.
- New generator output is merged with hand edits, so an edit to a generated file survives regeneration but can conflict with it. What matters is where the lines go, not how many there are. Changing lines the generator writes, such as a method's parameters or how it builds the request, is likely to conflict the next time the spec changes. Adding lines of your own, such as a new file, a new method, or a block in a method body, is usually fine, even a large one.
- Fix generator-owned behavior in the generator or the spec. If a local patch has to land first, say in the PR that the real fix is upstream. A real response the generated types can't represent (a missing field, an unknown enum member, a nullability mismatch) is a spec bug. Broken generated plumbing (request building, retries, SSE decoding, serialization) is a generator bug.
- The generator also writes `REVIEW.md`, and all of this file except "This repository's own rules".
- Don't add a comment that marks code as hand-written or as generated.
- Don't commit `.stats.yml`, `scripts/mock-spec.json.gz`, or any other file only the generator writes. They conflict with the next codegen push.

### Branches

- PRs target the repository's default branch. In the public repository that is `main`. Elsewhere, don't assume its name (`gh repo view --json defaultBranchRef` shows it).
- Rebase onto the current base before you ask for review. A stale base shows up as unrelated changed files.

### Running the checks

- `./scripts/lint` and `./scripts/test` are what CI runs, so run them before you push.
- `./scripts/test` starts a mock API server on port 4010, unless one is already up or `TEST_API_BASE_URL` is set. The mock server needs Node.
- Nothing in a default run calls a real endpoint. A test that does is skipped unless an environment variable turns it on.
- Rarely silence a checker. A suppression usually means the code is doing something wrong, so fix the code or its types first. One that stays names its rule and has an obvious reason.

### Public API and compatibility

- Anything a user can reach without going through a private or internal name is public, documented or not. So new things start private, and are made public on purpose.
- Don't make something public unless users need it. Every public name has to be supported from then on. A helper, constant, or option stays private when only the SDK uses it, even if exposing it would be convenient.
- Runtime behavior is the contract. A runtime change users could depend on is breaking even when no signature changes, and no check sees it.
- With a new feature switched off, nothing changes: the requests, the responses, and the errors are the same as before the feature existed.
- New implicit behavior ships with a way to turn it off.
- A rename or removal keeps the old name as a deprecated alias. A behavior change users could depend on waits for a deprecation cycle or the next major version.
- Retiring an option before a major version means keeping it working, marking it deprecated the way this language does, and removing it at the next major. Fail when it's passed only if the old behavior can't be honored at all.
- Don't ship a deprecated alias for something that was never released. Rename it.
- A major version is rare and a maintainer's call. Describe the compatibility impact in the PR instead of asking for one.
- Where CI runs `detect-breaking-changes`, it misses most breaks in hand-written API, and all changed defaults and newly rejected inputs. Call those out yourself.
- Avoid a new runtime dependency unless it's absolutely necessary. An optional integration doesn't add its dependency for users who don't use it.

### Options

- There is one way to do each thing. Don't add a second option or function that does what an existing one already does.
- An option name can't change after release, so get it reviewed before the helper ships.
- If two settings can contradict each other, look for one setting with more values that removes that state.
- An on/off option accepts both values, so that a caller can turn a client-level setting off for one request.
- The environment never overrides a value the caller set on purpose.

### Requests and responses

- Send what the caller passed. Don't hoist, merge, reorder, default, or drop parts of a request the caller built.
- Let the API validate. It rejects media types, lengths, and formats it doesn't support, and the caller gets an actionable error. A client-side check is for something the API never sees, such as the size of a local file. If the client needs a cap for its own safety, make the cap configurable.
- Never fail on data this version doesn't recognize. The API adds enum members, union variants, and fields, and a new one has to flow through the user's process. Handle the cases you know and pass the rest through untouched, above all in streaming and middleware code, where a failure tears down the caller's response.
- A permission or security decision is the exception. It treats an unrecognized value as a denial.
- When API output goes into a new request, carry the raw data across. Rebuilding it from typed properties drops whatever this version doesn't model.
- Don't send `null` for a value you mean to omit. Leave the key out, because the API can treat the two differently.
- A helper never changes a list or map the caller passed. Copy it first.
- A header that holds a list is appended to and de-duplicated, not overwritten.
- A retry loop in a helper follows the client's rules: 408, 409, 429, and 5xx are retryable, delays have jitter, and delays are capped.

### Errors

- A failure a caller may want to handle separately has a type or value they can match on, following this SDK's existing error design.
- Reuse the existing error types before you add one. A family of related failures can have its own type.
- Keep the original error as the cause.
- Error text is actionable. It names the option, where its value came from, and the fix. Each failed check has its own message, with the actual value in it unless that value is a secret.
- Two options that conflict are an error, not a warning. Rejecting an option the SDK used to ignore is a breaking change, so deprecate it first.
- Never tell failures apart by matching the text of an error. That text changes without notice.
- Keep secrets out of errors, logs, and debug output.
- Library code never prints to stdout.

### Design

- Ask how the repository already does it. A new sibling follows the shape of the existing ones. Extend a shared helper rather than writing a copy in a feature's folder.
- Inline a helper that has one caller. When you extract a helper, move every existing caller to it in the same PR.
- Much of the hand-written logic exists more than once, for example once for each way to send the same request. A fix to one copy goes to the others in the same PR. Sharing the logic through an internal helper beats keeping copies in step.
- Prefer generated types to hand-written copies. Where this language generates constants, use them instead of string literals.
- Hand-written code that lists the fields, variants, or names of something generated needs a tripwire test (see Tests). Without one, a new field or variant is dropped quietly.
- Match the other SDKs on behavior: helper and option names, defaults, wire values, retry rules, credential precedence, and environment variables. Take structure, naming style, and API shape from this language. Put a divergence in the PR description, not in a code comment.
- Add a cache only for a cost you have measured, and give the number in the PR.
- Something presented as immutable can't be changed by the caller. Don't hand out a reference that lets them.
- A helper that makes requests hangs off the resource it belongs to.

### Comments and docs

- Write no comment by default. When one is needed, keep it to a line or two that states a non-obvious why. Prefer a clearer name to a comment.
- Never restate the code, narrate its history, record tracked work, or note what another SDK does.
- Public API gets a doc comment. Update it, and any Markdown guide that covers the feature, when the behavior changes.
- Check a claim such as "the API rejects X" against the official API docs before you write it in a comment, an error message, or a PR. A third-party page or a bug report isn't a source.
- An example is a runnable program against a real backend. It uses only the public API, reads credentials and configuration from the environment, and has no debug output or workarounds.

### Tests

- A behavior change comes with a test that fails before it and passes after. Test both sides of a guard, and check that the setup really reaches the path in the test's name.
- Test behavior through the public API with HTTP mocked. For code that shapes a request, assert on the wire request: method, path, headers, and body.
- Generated tests only check shapes against the mock server. A behavior test for hand-written code goes in a hand-written file.
- Cover every copy of logic that exists more than once.
- Build fixtures from what the server sends. Keep keys and IDs in them obviously fake.
- Cases that differ only in input share one parameterized test.
- A test that changes an environment variable or other process state puts it back.
- A tripwire test asserts no behavior. It compares a hand-written list with the generated type the list was derived from, and fails when the spec changes one without the other. Its failure message or comment names the hand-written code to update.
- Tripwires are a stopgap. The goal is for the generator to emit anything that depends on generated output, and each tripwire goes away once it does.

### Commits and pull requests

- Commit subjects and PR titles follow Conventional Commits (`feat(scope):`, `fix(scope):`, `chore`, `docs`). A `!` or a `BREAKING CHANGE:` footer marks the release as breaking (a major version, or a minor one below 1.0). Only a maintainer adds one.
- If `.github/workflows/changelog.yml` exists, every PR adds its own line to `CHANGELOG.md` or carries the `skip-changelog` label, and CI fails it otherwise. If it doesn't, release automation writes `CHANGELOG.md` and the version files from those commit subjects, and a manual edit is overwritten or conflicts with the release PR.
- Make one logical change per PR. Unrelated fixes, formatting churn, and incidental lockfile changes go elsewhere. Split a large feature into stacked PRs.
- When you replace a PR, close the old one with a link to the new one.
- Port a behavior change to the other SDKs and link the sibling PRs, or say why it is specific to this language.
- A PR description says what was wrong, with a short before and after, what changed, and how you know it works.
- It lists every new public name, parameter, and option. It calls out behavior changes, wire-level changes, breaks in hand-written API, divergence from the other SDKs, and anything you could not verify.
- Update the description when a later commit changes the scope.

## TypeScript

### Overview

- `src/lib/` and `examples/` are hand-written. The generator never touches them. The generator's own files have custom code mixed in, including `src/client.ts` and files under `src/core/`, `src/internal/`, and `src/resources/`.
- A wrong return type in `api.md` is a generator regression.
- The version lives in `package.json`, `src/version.ts`, and `.release-please-manifest.json`. Don't edit it by hand.

### Build, test, lint

- The package manager is pnpm.
- Run `./scripts/format` before you push as well. Calling `prettier`, `eslint`, `tsc`, `vitest`, or `pnpm` directly is fine for a quick, targeted check while you work.
- CI's `detect-breaking-changes` checks out the generated tests from a base and runs `./scripts/lint` to see whether they still type-check against your branch. The base is the `breaking-change-baseline` tag when the repository has one, otherwise `main`.
- Anything a user can import without reaching into `src/internal/` or `src/lib/internal/` is public, documented or not, because the package's `exports` map exposes every other module. So new things start unexported or in `src/internal/`, and are made public on purpose.
- A change that only `tsc` notices doesn't break a running program, but it can fail a user's build, so avoid it where you can and call it out in the PR where you can't.
- Deprecating a name or an option means marking it `@deprecated` in its doc comment. A deprecated option logs a deprecation message when it's passed.
- A package the SDK imports only for types can be a normal dependency. Use a platform API instead of a new runtime dependency.
- Security floors go under `pnpm.overrides`, scoped to a major version (`"pkg@N": "^N.x.y"`).

### Runtimes and bundling

The SDK runs on Node, Deno, Bun, edge runtimes, and in browsers. Bundlers follow every statically resolvable import, including a lazy `import('./relative/path')`, and a `node:` builtin in the resulting chunk fails a browser build.

- Code that references a Node builtin lives in a module named `node.ts` that the package.json `browser` field swaps for a shim. Everything else in `src/` is runtime-agnostic. eslint enforces this. `import type` of a builtin is fine anywhere, because types are erased.
- Node-only modules are best imported by the user and passed into the SDK. SDK-internal code doesn't import them, statically or dynamically.
- If an internal reference can't be avoided, go through `src/internal/node.ts` with a lazy import, and shim the module in the package.json `browser` field. The shim is a `<name>.browser.ts` with the same exports, which throw when they're used.
- Don't hide imports from bundlers with `webpackIgnore` comments, variable specifiers, or `eval`. Don't reference `process` at module scope unless a `typeof process` (or `globalThis.process?.`) guard covers it.
- Read environment variables with `readEnv`, not `process.env`. Outside Node-only modules, use `src/internal/utils/base64.ts` and `uuid4()`, not `Buffer` or `require`.
- Use async `fs/promises` in Node-only code. A `*Sync` call blocks the caller's event loop.

### Code organization

- Everything in `src/lib/` is public except `src/lib/internal/`, which the `exports` map blocks the same way it blocks `src/internal/`. SDK-only plumbing goes in `src/internal/`, and a type that's part of the public API goes in `src/core/`.
- Shared primitives, such as `sleep`, are in `src/internal/utils/`.
- Helper classes are re-exported from the resource that creates them. Like generated methods, a helper takes the resource ID as its first argument.

### Errors

- A failure that comes from SDK- or API-specific logic throws `AnthropicError` or a subclass, so callers can catch the SDK's failures in one place. API failures are `APIError` subclasses, chosen by status.
- Use the standard `TypeError`, or `RangeError` for a value out of range, where any JavaScript library would. That covers an argument of the wrong type (`buildHeaders` rejects a header name that isn't a string) and options that can't be combined. Avoid a bare `Error`, because a caller can't tell it apart from anything else.
- Format caught values with `castToError`, or with `e instanceof Error ? e.message : String(e)`. Don't write `(e as Error).message`.
- Detect an abort with `isAbortError(err)` from `src/internal/errors.ts`, not with `instanceof`.
- Log through the client's logger (`loggerFor(client)`), not `console`. A deprecation message names the replacement.

### Common mistakes

- **Hand-listing generated fields with no tripwire.** A tripwire stops compiling when the spec changes the generated type without the hand-written list. `tsc` enforces them through `./scripts/lint`, not the test runner.
- **Runtime checks that the types already cover.** Trust typed inputs. Don't add a runtime check for something the caller's types already rule out.
- **Validating what the API validates.** `null` is the only off-switch for a configurable cap.
- **Leaking through abort listeners.** A listener on the caller's signal lives as long as that signal does, and so does everything its closure captures.
  - Build the listener in a small separate function that takes only what it needs, as `_makeAbort` in `src/client.ts` does. An arrow function written inline captures the whole enclosing scope, the request body and options included, and a long-lived signal then keeps all of it from being collected.
  - Add listeners with `{ once: true }`, and also remove them when the work finishes, because `once` only removes a listener if the signal actually aborts.
- **Returning early on abort.** An async function calls `signal.throwIfAborted()`. Only an async generator returns quietly.

### Style notes

- Private members use `#name`, not the TypeScript `private` keyword.
- When the checker is the one that is wrong, use `@ts-expect-error` with a reason, not `@ts-ignore`, so the suppression fails when it's no longer needed.
- Return `unknown`, not `any`. Avoid `as never` and `as unknown as` casts unless absolutely necessary. Narrow unions with the discriminator, not a structural cast.
- Model a state that has several cases as one discriminated union, not as parallel maps.
- Derive types from a single constant (`(typeof X)[number]`), so the list and the type can't drift apart.
- Options that stay in JavaScript are camelCase. Anything sent to the API as-is keeps its snake_case wire name.
- Acronyms are capitalized (`APIError`).
- Say "promise", not "task".
- JSDoc has no `{type}` on `@param`, and it uses `@default` for defaults. Every public field gets a doc comment.
- Split a large module by concern.
- Examples keep clients inside `main()`.

### Tests

- Reuse SDK internals in tests, such as `_iterSSEMessages`. Don't write a second SSE parser.
- In a stream fixture, leave a key out rather than setting it to `null`.
- Use `test.each` for cases that differ only in input, and snapshots for large expected values.
- A new header merge rule needs a case in `tests/buildHeaders.test.ts` for each `HeadersLike` shape.
