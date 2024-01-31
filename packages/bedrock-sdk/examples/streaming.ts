#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

// Note: this assumes you have configured AWS credentials in a way
// that the AWS Node SDK will recognise, typicaly a shared `~/.aws/credentials`
// file or `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` environment variables.
//
// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_credential_provider_node.html
const client = new AnthropicBedrock();

async function main() {
  const question = 'Hey Claude! How can I recursively list all files in a directory in Rust?';

  const stream = await client.completions.create({
    prompt: `${Anthropic.HUMAN_PROMPT}${question}${Anthropic.AI_PROMPT}:`,
    model: 'anthropic.claude-v2:1',
    stream: true,
    max_tokens_to_sample: 500,
  });

  for await (const completion of stream) {
    process.stdout.write(completion.completion);
  }
}

main();
