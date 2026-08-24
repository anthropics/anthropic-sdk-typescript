// No node typings in this project, so no node:test either: run the shared cases plus this
// project's own through runCases and let an uncaught throw fail the step.
import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { Messages } from '@anthropic-ai/sdk/resources/messages';
import { check, equal, runCases } from '../shared/cases';

// no `process` in web typings: the client picks up ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY itself
const client = new Anthropic();

const results = await runCases(client, {
  'subpath export resolves to the same module instance as the root entrypoint': async (client) => {
    check(client.messages instanceof Messages, 'client.messages is not a resources/messages Messages');
  },
  'beta.files.upload with a DOM File, and toFile from a Blob': async (client) => {
    const direct = await client.beta.files.upload({
      file: new File(['hello world'], 'hello.txt', { type: 'text/plain' }),
    });
    equal([direct.filename, direct.mime_type, direct.size_bytes], ['hello.txt', 'text/plain', 11]);
    const viaBlob = await client.beta.files.upload({
      file: await toFile(new Blob(['abc'], { type: 'text/plain' }), 'blob.txt'),
    });
    equal([viaBlob.filename, viaBlob.size_bytes], ['blob.txt', 3]);
  },
});
for (const { name, ok, error } of results) console.log(ok ? `ok - ${name}` : `not ok - ${name}\n${error}`);
const failed = results.filter((result) => !result.ok).length;
if (failed) throw new Error(`${failed} of ${results.length} cases failed`);
