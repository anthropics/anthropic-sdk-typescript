# Ecosystem tests

These tests install the SDK from an `npm pack` tarball into small projects and run them against a local mock server (`mock-server.mjs`).
This checks what users actually get across runtimes, module systems, TypeScript configs, package managers and bundlers.

```sh
pnpm test:ecosystem                          # build, pack and run every project
pnpm test:ecosystem node-ts-esm 'browser-*'  # run projects by name or glob
pnpm test:ecosystem --list                   # list projects and known failures
pnpm test:ecosystem --skip-build --skip-pack # reuse .pack/anthropic-ai-sdk.tgz
pnpm test:ecosystem --node-versions 20,22,24 # run the Node projects once per installed Node major
```

`--keep` keeps the temp copies (failed projects are always kept) and `--jobs N` runs projects in parallel.
`--node-versions` finds each major where actions/setup-node, nvm, fnm or volta install it, or in `$ECOSYSTEM_NODE_<major>` (a bin directory).
CI runs these tests from `.github/workflows/ecosystem-tests.yml`.

## Shared test cases

`shared/cases.ts` holds the SDK calls every project runs (they throw on failure and use only web-standard globals) and `shared/type-tests.ts` the `@ts-expect-error` checks every project compiles; a project's own files just register the cases with its test runner or harness and add what is specific to that project (module resolution, runtime-specific uploads, extra compiler flags).
The runner copies `shared/` into each project's temp copy as `./shared/`; it is git-ignored inside project directories, so copy or symlink it there to work on a project in place.

## Adding a project

Create `ecosystem-tests/<name>/project.json` with these fields (the runner picks up any directory that has one):

- `description`: what the project covers.
- `steps`: commands (argv arrays) to run in order after install.
- `packageManager`: `npm`, `pnpm`, `yarn` or `bun`. This decides the install command.
- `requires`: binaries that must be on `PATH`, for example `["deno"]`. If one is missing the project is skipped, unless it was named on the command line.
- `minNodeVersion`: optional. The project is skipped on older Node versions.
- `perNodeVersion`: optional. With `--node-versions`, run the project once per listed major instead of once under the current `node`.
- `knownFailure`: optional. Why the project currently fails because of an SDK bug. A failing step then reports `XFAIL` instead of failing the run (a failing install still fails it), and `XPASS` (which fails the run) once it passes, so the field gets removed. Put the failing step last so the other steps still run.

Pin every dependency to an exact version and commit the lockfile.
Do not list `@anthropic-ai/sdk` in `package.json`: the runner does a frozen install from the lockfile and then adds `../.pack/anthropic-ai-sdk.tgz` on top, so the lockfile never pins a previous build of the SDK.
Neither install step runs dependency lifecycle scripts (`--ignore-scripts` and its equivalents), so a project cannot rely on a `postinstall`; prebuilt binaries that ship as `optionalDependencies` (esbuild, workerd, rolldown) still work.
Type-check with `skipLibCheck: false` so the published types are checked too.
Steps get `ANTHROPIC_BASE_URL` (the mock server) and `ANTHROPIC_API_KEY` in their environment, so `new Anthropic()` needs no options.
Import the cases from `./shared/cases` (see above) and add the project's `shared` directory to its tsconfig `include` so `shared/type-tests.ts` is checked too.
The mock server answers a request the SDK built incorrectly with a 4xx whose message starts with `mock:`, so the test fails at the call that sent it.
Each project runs from a temp copy next to a copy of `.pack/`, so nothing resolves from the repo's `node_modules`.
