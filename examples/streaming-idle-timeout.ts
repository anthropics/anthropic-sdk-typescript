#!/usr/bin/env node

import Anthropic from '@anthropic-ai/sdk';
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk/core/error';

const client = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY

async function main() {
  try {
    const stream = client.messages.stream(
      {
        messages: [
          {
            role: 'user',
            content: 'Explain quantum entanglement in depth.',
          },
        ],
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        output_config: {
          effort: 'high',
        },
      },
      // Configures idle timeout in milliseconds between incoming chunks
      { idleTimeoutMs: 10000 } as any,
    );

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        process.stdout.write(event.delta.text);
      }
    }

    const message = await stream.finalMessage();
    console.log('\nStream completed successfully. Total output tokens:', message.usage.output_tokens);
  } catch (error) {
    if (error instanceof APIConnectionTimeoutError) {
      console.error('\n[TIMEOUT]: Stream was safely aborted due to idle inactivity.');
    } else {
      console.error('\n[ERROR]:', error);
    }
  }
}

main();
