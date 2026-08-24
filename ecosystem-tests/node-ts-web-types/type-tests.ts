// Web-only typings: DOM upload and fetch types line up with the SDK's without @types/node.
// The common checks are in shared/type-tests.ts.
import Anthropic, { toFile } from '@anthropic-ai/sdk';

const messages = [{ role: 'user' as const, content: 'Hi' }];

export async function webTypes() {
  const browserClient = new Anthropic({ dangerouslyAllowBrowser: true, fetch });
  await browserClient.beta.files.upload({ file: new File(['x'], 'x.txt') });
  await browserClient.beta.files.upload({ file: await toFile(new Blob(['x']), 'x.txt') });
  await browserClient.beta.files.upload({ file: new Response('x') });
  // @ts-expect-error a bare string is not Uploadable; wrap it in a File/Blob or use toFile
  await browserClient.beta.files.upload({ file: 'x' });
  // @ts-expect-error nothing from node is in scope in this project
  Buffer.from('x');
  const controller = new AbortController();
  const stream = browserClient.messages.stream(
    { model: 'mock-model', max_tokens: 1, messages },
    { signal: controller.signal },
  );
  const response: Response = (await stream.withResponse()).response;
  void response;
}
