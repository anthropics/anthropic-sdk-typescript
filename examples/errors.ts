#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // gets API key from environment variable ANTHROPIC_API_KEY

async function main() {
  try {
    await client.models.retrieve('model-does-not-exist');
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.log('Caught APIError!');
      console.log('requestID:', err.requestID);
      console.log('status:', err.status);
      console.log('name:', err.name);
      console.log('type:', err.type);
      console.log('message:', err.message);
      console.log('headers:', err.headers);
    } else {
      throw err;
    }
  }
}

main().catch(console.error);
