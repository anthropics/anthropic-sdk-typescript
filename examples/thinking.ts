import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function main() {
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: 'high' },
    messages: [
      {
        role: 'user',
        content: 'Create a haiku about Anthropic. Think carefully about syllable counts before answering.',
      },
    ],
  });

  for (const block of message.content) {
    if (block.type === 'thinking') {
      console.log(`Thinking: ${block.thinking}`);
    } else if (block.type === 'text') {
      console.log(`Text: ${block.text}`);
    }
  }
}

main();
