# Preview structured output with Streamfold

This example uses the optional `streamfold` package to show partial JSON values
while a structured text response arrives. Each text block has its own incremental
parser. Immutable snapshots can be retained by a UI without later deltas changing
them. The SDK still validates the final result against the Zod output schema.
Partial values are previews, not schema-validated results, and must not execute
tools or trigger other actions.

From a checkout of this repository:

```sh
pnpm install --frozen-lockfile
pnpm build
ANTHROPIC_API_KEY=... node examples/streamfold/preview.ts
```

Use Node.js 22.18 or newer. In your own application, install `@anthropic-ai/sdk`,
`zod`, and `streamfold`, then copy `preview.ts`. Streamfold is only a development
dependency of this repository; the SDK does not require it for other features.
The sample's forecast is illustrative model output, not live weather data.

Each delta is passed to Streamfold once. This avoids reparsing the accumulated
text for every preview, but it is not a promise of lower end-to-end latency.
Model delivery, rendering, snapshot creation, and initial WASM compilation still
cost time. The SDK's normal streaming example remains appropriate when only raw
text and the final validated result are needed.

The scanner uses Streamfold's default 16 MiB input and 128-level nesting limits.
Its WebAssembly engine must be available in the host environment. Ctrl-C cancels
the request; parsing, schema, callback, and transport errors release the parsers
and stop the request. No API key belongs in browser code.
