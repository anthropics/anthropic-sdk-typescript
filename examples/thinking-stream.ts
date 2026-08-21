import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY

async function main() {
  let thinkingState = 'not-started';

  const stream = client.messages
    .stream({
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
    })
    .on('thinking', (thinking) => {
      if (thinkingState === 'not-started') {
        console.log('Thinking:\n---------');
        thinkingState = 'started';
      }

      process.stdout.write(thinking);
    })
    .on('text', (text) => {
      if (thinkingState !== 'finished') {
        console.log('\n\nText:\n-----');
        thinkingState = 'finished';
      }
      process.stdout.write(text);
    });

  const finalMessage = await stream.finalMessage();
  console.log('\n\nFinal message object:\n--------------------', finalMessage);
}

main();
