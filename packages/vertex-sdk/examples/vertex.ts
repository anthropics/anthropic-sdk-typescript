#!/usr/bin/env -S npm run tsn -T

import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { GoogleAuth, Impersonated } from 'google-auth-library';

// Example 1: Default configuration
// Reads from the `CLOUD_ML_REGION` & `ANTHROPIC_VERTEX_PROJECT_ID`
// environment variables.
const client = new AnthropicVertex();

// Example 2: Using googleAuth (existing approach)
const clientWithGoogleAuth = new AnthropicVertex({
  googleAuth: new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' }),
  region: 'us-central1',
  projectId: 'my-project',
});

// Example 3: Using authClient (new approach) with Impersonated credentials
async function createClientWithImpersonation() {
  const authClient = new Impersonated({
    sourceClient: await new GoogleAuth().getClient(),
    targetPrincipal: 'impersonated-account@projectID.iam.gserviceaccount.com',
    lifetime: 30,
    delegates: [],
    targetScopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  return new AnthropicVertex({
    authClient,
    region: 'us-central1',
    projectId: 'my-project',
  });
}

async function main() {
  const result = await client.messages.create({
    messages: [
      {
        role: 'user',
        content: 'Hello!',
      },
    ],
    model: 'claude-3-5-sonnet-v2@20241022',
    max_tokens: 300,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
