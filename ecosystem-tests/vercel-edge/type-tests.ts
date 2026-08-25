// What an edge function has to hand for uploads; the common checks are in shared/type-tests.ts.
// Only tsc checks this: esbuild strips types without checking them.
import Anthropic, { toFile } from '@anthropic-ai/sdk';

export async function webUploads() {
  const client = new Anthropic();
  await toFile(new Blob(['x']), 'x.txt');
  await toFile(new Response('x'), 'x.txt');
  await client.beta.files.upload({ file: new File(['x'], 'x.txt') });
  // @ts-expect-error a bare string is not an uploadable value
  await client.beta.files.upload({ file: 'hello.txt' });
}
