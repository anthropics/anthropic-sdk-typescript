## Node-only code

Bundlers follow every statically-resolvable import — including lazy `import('./relative/path')` — and fail browser builds on `node:` builtins in the resulting chunks.

- Code referencing Node builtins must live in a module named `node.ts` (or a `node/` directory). Everything else in `src/` must be runtime-agnostic.
- Strongly preferred: Node-only modules are imported by the user and passed into the SDK. SDK-internal code must not import them, statically or dynamically.
- If an internal reference is unavoidable, shim the module via the package.json `browser` field: a `<name>.browser.ts` with an identical export surface where every value export throws `<exportName> requires Node.js or a Node-compatible runtime`. Add runtime and type-level parity tests, and keep the internal import lazy.
- Never hide imports from bundlers (`webpackIgnore` comments, variable specifiers, `eval`). Never reference `process` at module scope in statically-reachable code without a `typeof process` (or `globalThis.process?.`) guard.
- `import type` of Node builtins is fine anywhere — types are erased.
