// Bundled by each bundler under test, then run with plain `node`: everything the SDK needs
// must have made it into (or been correctly externalised from) the bundle, and the error
// classes the cases check with instanceof must survive minification.
import * as fs from 'node:fs';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { equal, runCases } from '../shared/cases.js';

async function main() {
  // the SDK reads ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY from process.env at runtime; a bundler
  // that inlined process.env at build time would point at nothing
  const results = await runCases(new Anthropic(), {
    'beta.files.upload from a read stream and a Buffer': async (client) => {
      fs.writeFileSync('upload.txt', 'hello world');
      for (const file of [
        fs.createReadStream('upload.txt'),
        await toFile(Buffer.from('hello world'), 'upload.txt'),
      ]) {
        equal((await client.beta.files.upload({ file })).size_bytes, 11);
      }
    },
  });
  for (const { name, ok, error } of results) console.log(ok ? `ok - ${name}` : `not ok - ${name}\n${error}`);
  if (results.some((result) => !result.ok)) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
