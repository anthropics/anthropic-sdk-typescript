// bun-types instead of lib.dom or @types/node; the common checks are in shared/type-tests.ts.
// Only `bun x tsc` checks this: bun test transpiles without type-checking.
import Anthropic, { toFile } from '@anthropic-ai/sdk';

export async function bunTypes() {
  const client = new Anthropic();
  // bun-types' Blob declares no slice(), so a plain Blob is not the SDK's BlobLike (fine at
  // runtime). File, Bun.file() and bytes type-check.
  // @ts-expect-error remove once bun-types' Blob has slice()
  await toFile(new Blob(['x']), 'x.txt');
  await toFile(Bun.file('package.json'), 'package.json');
  await toFile(new TextEncoder().encode('x'), 'x.txt');
  await client.beta.files.upload({ file: new File(['x'], 'x.txt') });
  // @ts-expect-error a bare string is not an uploadable value
  await client.beta.files.upload({ file: 'hello.txt' });
}
