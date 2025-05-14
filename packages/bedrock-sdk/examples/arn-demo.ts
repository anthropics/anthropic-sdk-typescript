#!/usr/bin/env -S npm run tsn -T
/**
 * This example demonstrates using ARNs with slashes in the Bedrock SDK
 *
 * Usage:
 * - Set your AWS credentials and region via environment variables
 * - Run with: ts-node arn-demo.ts
 */

import { AnthropicBedrock } from '../src';

async function main() {
  // Create an AnthropicBedrock client
  const anthropic = new AnthropicBedrock({
    // AWS credentials can be provided directly or via environment variables
    // awsAccessKey: 'YOUR_AWS_ACCESS_KEY',
    // awsSecretKey: 'YOUR_AWS_SECRET_KEY',
    // awsRegion: 'us-east-1',  // Set your AWS region
  });

  // Example ARN with slashes - this now works correctly with URL encoding
  const model =
    'arn:aws:bedrock:us-east-2:1234:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0';

  console.log(`Using model: ${model}`);

  try {
    const response = await anthropic.messages['create']({
      model,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: 'Hello! How does the Bedrock SDK handle model ARNs?',
        },
      ],
    });

    console.log('Response:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
