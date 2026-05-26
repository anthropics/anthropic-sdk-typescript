// Custom (non-generated) regression test for the skills multipart upload endpoints.
//
// The skills API requires every uploaded file to live under a single top-level
// directory (e.g. `my-skill/SKILL.md`). Both `skills.create` and
// `skills.versions.create` must therefore send the directory-qualified filename
// verbatim in the multipart body. The default multipart helper strips the path
// to a bare basename (`SKILL.md`), which the server rejects with
// "SKILL.md must be exactly in the top-level folder", so each endpoint passes
// `stripFilenames=false`. This test guards against that flag being dropped.

import Anthropic, { toFile } from '@anthropic-ai/sdk';

/** Run `call`, intercepting the outgoing request, and return every
 *  `filename="..."` value present in the serialized multipart body. */
async function uploadedFilenames(call: (client: Anthropic) => Promise<unknown>): Promise<string[]> {
  let multipartBody: string | undefined;

  const client = new Anthropic({
    apiKey: 'test-key',
    fetch: async (url, init) => {
      // The skills upload is the only multipart POST; ignore the internal
      // `data:,` probe that supportsFormData() makes against the fetch impl.
      const body = init?.body;
      if (url.toString().includes('/v1/skills') && body != null) {
        multipartBody = await new Response(body).text();
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  await call(client);

  expect(multipartBody).toBeDefined();
  return [...multipartBody!.matchAll(/filename="([^"]*)"/g)].map((m) => m[1]!);
}

describe('skills uploads preserve directory-qualified filenames', () => {
  test('skills.versions.create sends `my-skill/SKILL.md`, not `SKILL.md`', async () => {
    const names = await uploadedFilenames(async (client) =>
      client.beta.skills.versions.create('skill_id', {
        files: [await toFile(Buffer.from('# Skill\n'), 'my-skill/SKILL.md')],
      }),
    );
    expect(names).toEqual(['my-skill/SKILL.md']);
  });

  test('skills.create sends `my-skill/SKILL.md`, not `SKILL.md`', async () => {
    const names = await uploadedFilenames(async (client) =>
      client.beta.skills.create({
        files: [await toFile(Buffer.from('# Skill\n'), 'my-skill/SKILL.md')],
      }),
    );
    expect(names).toEqual(['my-skill/SKILL.md']);
  });
});
