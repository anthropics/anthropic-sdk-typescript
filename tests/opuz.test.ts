import Anthropic from '@anthropic-ai/sdk';
import CheckBuilder from '@anthropic-ai/sdk/checkBuilder';

describe('Anthropic client with Opuz', () => {
    let client: Anthropic;

    beforeEach(() => {
        client = new Anthropic();
    });

    test('can create a basic message', async () => {
        const response = await client.messages.create({
            model: 'claude-3-5-sonnet-20240620',
            messages: [{
                role: 'user',
                content: 'You are a helpful shopping assistant. You are given a list of products and their prices. You are asked to find the cheapest product.'
            }],
            max_tokens: 100,
        }, {
            checkBuilder: new CheckBuilder()
                .contains("Shopping")
                .maxLength(500)
                .minLength(100)
        });
        expect(response).toBeDefined();
        expect(response.content).toBeTruthy();
    });

    test('can use tools in messages', async () => {
        const response = await client.messages.create({
            model: 'claude-3-5-sonnet-20240620',
            messages: [{
                role: 'user',
                content: 'What is the weather in San Francisco?'
            }],
            max_tokens: 4096,
            tools: [
                {
                    "name": "get_weather",
                    "description": "Get the current weather in a given location",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "location": {
                                "type": "string",
                                "description": "The city and state, e.g. San Francisco, CA"
                            }
                        },
                        "required": ["location"]
                    }
                }]
        });

        expect(response).toBeDefined();
    });

    test('handles multiple messages in conversation', async () => {
        const response = await client.messages.create({
            model: 'claude-3-5-sonnet-20240620',
            messages: [
                {
                    role: 'user',
                    content: 'What is the capital of France?'
                },
                {
                    role: 'assistant',
                    content: 'The capital of France is Paris.'
                },
                {
                    role: 'user',
                    content: 'What is its population?'
                }
            ],
            max_tokens: 150
        });

        expect(response).toBeDefined();
    });

    test('can request JSON-only output', async () => {
        const response = await client.messages.create({
            model: 'claude-3-5-sonnet-20240620',
            system: 'You are a helpful assistant that returns a JSON object. Response should be JSON only.',
            messages: [
                {
                    role: 'user',
                    content: 'Return a JSON object with a list of 3 fruits and their prices.'
                }
            ],
            max_tokens: 100,

        }, {
            checkBuilder: new CheckBuilder()
                .isValidJson()
        });

        expect(response).toBeDefined();

    });
});