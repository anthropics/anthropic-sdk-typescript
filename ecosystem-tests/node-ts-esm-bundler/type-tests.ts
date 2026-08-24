// What bundler resolution adds; the common checks are in shared/type-tests.ts. It honours the
// exports map: unlisted deep paths stay private, the explicit .mjs subpath carries the same types
// as the extensionless one, and the .js subpath is typed by the CommonJS .d.ts, a nominally
// separate copy (#private members) of the ESM declarations
export async function bundlerResolution() {
  // @ts-expect-error "./internal/*" is not in the exports map
  await import('@anthropic-ai/sdk/internal/headers');
  const viaMjs: typeof import('@anthropic-ai/sdk/resources/messages.mjs').Messages = (
    await import('@anthropic-ai/sdk/resources/messages')
  ).Messages;
  // @ts-expect-error mixing the CJS-typed .js subpath with ESM-typed imports does not typecheck
  const viaJs: typeof import('@anthropic-ai/sdk/resources/messages.js').Messages = viaMjs;
  void viaJs;
}
