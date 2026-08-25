// workers-types only, no lib.dom or @types/node; the common checks are in shared/type-tests.ts.
// Only tsc checks this: wrangler and vitest strip types without checking them.
import Anthropic, { toFile } from '@anthropic-ai/sdk';

export async function workersTypes() {
  const client = new Anthropic();
  // workerd's Blob, File and Response, as typed by workers-types, must satisfy the SDK's upload types
  await toFile(new Blob(['x']), 'x.txt');
  await toFile(new Response('x'), 'x.txt');
  await client.beta.files.upload({ file: new File(['x'], 'x.txt') });
  // @ts-expect-error a bare string is not an uploadable value
  await client.beta.files.upload({ file: 'hello.txt' });
}
