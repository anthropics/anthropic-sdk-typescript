import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY

async function main() {
  let thinkingState = 'not-started';

  const stream = client.messages
    .stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3200,
      thinking: { type: 'enabled', budget_tokens: 1600 },
      messages: [{ role: 'user', content: 'Create a haiku about Anthropic.' }],
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
