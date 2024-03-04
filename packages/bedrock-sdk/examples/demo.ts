#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

// Note: this assumes you have configured AWS credentials in a way
// that the AWS Node SDK will recognise, typicaly a shared `~/.aws/credentials`
// file or `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` environment variables.
//
// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_credential_provider_node.html
const anthropic = new AnthropicBedrock();

async function main() {
  const completion = await anthropic.completions.create({
    model: 'anthropic.claude-3-opus-20240229-v1:0',
    prompt: `${Anthropic.HUMAN_PROMPT} how does a court case get to the Supreme Court? ${Anthropic.AI_PROMPT}`,
    stop_sequences: [Anthropic.HUMAN_PROMPT],
    max_tokens_to_sample: 800,
    temperature: 0.5,
    top_k: 250,
    top_p: 0.5,
  });
  console.log(completion);
}

main();
