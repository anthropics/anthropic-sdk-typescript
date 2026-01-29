# Message Helpers

## Streaming Responses

```ts
anthropic.messages.stream({ … }, options?): MessageStream
```

`anthropic.messages.stream()` returns a `MessageStream`, which emits events, has an async
iterator, and exposes helper methods to accumulate stream events into a convenient shape and make it easy to reason
about the conversation.

Alternatively, you can use `anthropic.messages.create({ stream: true, … })` which returns an async
iterable of the chunks in the stream and uses less memory (most notably, it does not accumulate a message
object for you).

If you need to cancel a stream, you can `break` from a `for await` loop or call `stream.abort()`.

See an example of streaming helpers in action in [`examples/streaming.ts`](examples/streaming.ts).

## MessageStream API

### Events

#### `.on('connect', () => …)`

The first event that is fired when the connection with the Anthropic API is established.

#### `.on('streamEvent', (event: MessageStreamEvent, snapshot: Message) => …)`

The event fired when a stream event is received from the API. Not fired when it is not streaming. The snapshot
returns an accumulated `Message` which is progressively built-up over events.

#### `.on('text', (textDelta: string, textSnapshot: string) => …)`

The event fired when a text delta is sent by the API. The second parameter returns a `textSnapshot`.

#### `.on('inputJson', (partialJson: string, jsonSnapshot: unknown) => …)`

The event fired when a json delta is sent by the API. The second parameter returns a `jsonSnapshot`.

#### `.on('message', (message: Message) => …)`

The event fired when a message is done being streamed by the API. Corresponds to the `message_stop` SSE event.

#### `.on('contentBlock', (content: ContentBlock) => …)`

The event fired when a content block is done being streamed by the API. Corresponds to the
`content_block_stop` SSE event.

#### `.on('finalMessage', (message: Message) => …)`

The event fired for the final message. Currently this is equivalent to the `message` event, but is fired after
it.

#### `.on('error', (error: AnthropicError) => …)`

The event fired when an error is encountered while streaming.

#### `.on('abort', (error: APIUserAbortError) => …)`

The event fired when the stream receives a signal to abort.

#### `.on('end', () => …)`

The last event fired in the stream.

### Methods

#### `.abort()`

Aborts the runner and the streaming request, equivalent to `.controller.abort()`. Calling `.abort()` on a
`MessageStream` will also abort any in-flight network requests.

#### `await .done()`

An empty promise which resolves when the stream is done.

#### `.currentMessage`

Returns the current state of the message that is being accumulated, or `undefined` if there is no such
message.

#### `await .finalMessage()`

A promise which resolves with the last message received from the API. Throws if no such message exists.

#### `await .finalText()`

A promise which resolves with the text of the last message received from the API.

### Fields

#### `.messages`

A mutable array of all messages in the conversation.

#### `.controller`

The underlying `AbortController` for the runner.

## Structured Outputs

The SDK provides helpers for parsing structured JSON outputs from Claude using JSON Schema or Zod validation.

### Usage with Zod

```ts
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const client = new Anthropic();

const NumbersResponse = z.object({
  primes: z.array(z.number()),
});

const message = await client.messages.parse({
  model: 'claude-sonnet-4-5',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'What are the first 3 prime numbers?' }],
  output_config: {
    format: zodOutputFormat(NumbersResponse),
  },
});

console.log(message.parsed_output?.primes); // [2, 3, 5]
```

### Usage with JSON Schema

```ts
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const NumbersResponse = {
  type: 'object',
  properties: {
    primes: { type: 'array', items: { type: 'number' } },
  },
  required: ['primes'],
} as const;

const message = await client.messages.parse({
  model: 'claude-sonnet-4-5',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'What are the first 3 prime numbers?' }],
  output_config: {
    format: jsonSchemaOutputFormat(NumbersResponse),
  },
});

console.log(message.parsed_output?.primes); // [2, 3, 5]
```

### `zodOutputFormat(zodObject)`

Creates a JSON schema output format from a Zod schema. The response will be validated and parsed using Zod.

### `jsonSchemaOutputFormat(schema, options?)`

Creates a JSON schema output format from a raw JSON schema. Options:

- `transform?: boolean` - Whether to transform the schema for Claude compatibility (default: `true`)

### Examples

See the following example files:

- [`examples/structured-outputs-zod.ts`](examples/structured-outputs-zod.ts)
- [`examples/structured-outputs-json-schema.ts`](examples/structured-outputs-json-schema.ts)
- [`examples/structured-outputs-streaming.ts`](examples/structured-outputs-streaming.ts)
- [`examples/structured-outputs-raw.ts`](examples/structured-outputs-raw.ts)

## Tool Helpers

The SDK provides helper functions to create runnable tools that can be automatically invoked by the `.toolRunner()` method. These helpers simplify tool creation with JSON Schema or Zod validation.

### Usage

```ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const weatherTool = betaZodTool({
  name: 'get_weather',
  inputSchema: z.object({
    location: z.string(),
  }),
  description: 'Get the current weather in a given location',
  run: (input) => {
    return `The weather in ${input.location} is foggy and 60°F`;
  },
});

const finalMessage = await anthropic.beta.messages.toolRunner({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'What is the weather in San Francisco?' }],
  tools: [weatherTool],
});

console.log(finalMessage.content);
```

#### Advanced usage

When you need to process intermediate messages or control the conversation flow, you can iterate through
`BetaToolRunner`.

```ts
const runner = anthropic.beta.messages.toolRunner({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'What is the weather in San Francisco?' }],
  tools: [weatherTool],
});

// Process each message as it arrives
for await (const message of runner) {
  console.log(message);
}

// Get the final result
console.log(await runner);
```

See [`examples/tools-helpers-advanced.ts`](examples/tools-helpers-advanced.ts) for a more in-depth
example.

#### Streaming

```ts
const runner = anthropic.beta.messages.toolRunner({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'What is the weather in San Francisco?' }],
  tools: [calculatorTool],
  stream: true,
});

// When streaming, the runner returns BetaMessageStream
for await (const messageStream of runner) {
  for await (const event of messageStream) {
    console.log('event:', event);
  }
  console.log('message:', await messageStream.finalMessage());
}

console.log(await runner);
```

See [`examples/tools-helpers-advanced-streaming.ts`](examples/tools-helpers-advanced-streaming.ts) for a more
in-depth example.

### `betaZodTool`

Zod schemas can be used to define the input schema for your tools:

```ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';

const weatherTool = betaZodTool({
  name: 'get_weather',
  inputSchema: z.object({
    location: z.string().describe('The city and state, e.g. San Francisco, CA'),
    unit: z.enum(['celsius', 'fahrenheit']).default('fahrenheit'),
  }),
  description: 'Get the current weather in a given location',
  run: async (input) => {
    return `The weather in ${input.location} is ${input.unit === 'celsius' ? '22°C' : '72°F'}`;
  },
});
```

### `betaTool`

You can use JSON Schema to define the input schema for your tools. `betaTool` will infer the type of `input` for you
based on the supplied JSON Schema.

```ts
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';

const calculatorTool = betaTool({
  name: 'calculator',
  input_schema: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['operation', 'a', 'b'],
  },
  description: 'Perform basic arithmetic operations',
  run: (input) => {
    const { operation, a, b } = input;
    switch (operation) {
      case 'add':
        return String(a + b);
      case 'subtract':
        return String(a - b);
      case 'multiply':
        return String(a * b);
      case 'divide':
        return String(a / b);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  },
});
```

### `client.messages.toolRunner(params): BetaToolRunner`

**Parameters:** All standard message parameters plus:

- `tools: Array<BetaToolUnion | BetaRunnableTool>` - Array of tools
- `max_iterations?: number` - Maximum number of tool execution iterations (default: no limit)

**Returns:**: `BetaToolRunner`

### `BetaToolRunner` API

#### `BetaToolRunner.done()`

Waits for the conversation to complete and returns the final message.

```ts
// Start consuming the iterator
for await (const message of runner) {
  console.log('Message:', message);
}

// Wait for completion
const finalMessage = await runner.done();
```

#### `BetaToolRunner.runUntilDone()`

Waits for the conversation and returns the final assistant message. Unlike `done()`, this will eagerly read the stream.

```ts
const finalMessage = await runner.runUntilDone();
```

#### Direct await

The BetaToolRunner is directly awaitable, which is equivalent to calling `.runUntilDone()`:

```ts
const finalMessage = await runner;
```

#### `BetaToolRunner.setMessagesParams()`

Updates the conversation parameters. Can accept new parameters or a mutator function.

```ts
// Direct parameter update
runner.setMessagesParams({
  ...runner.params,
  model: 'claude-haiku-4-5',
  max_tokens: 500,
});

// Using mutator function
runner.setMessagesParams((prevParams) => ({
  ...prevParams,
  max_tokens: prevParams.max_tokens * 2,
  messages: [...prevParams.messages, { role: 'user', content: 'Additional context' }],
}));
```

#### `BetaToolRunner.pushMessages()`

Adds messages to the conversation history.

```ts
runner.pushMessages(
  { role: 'user', content: 'Please also consider this information...' },
  { role: 'assistant', content: 'I understand, let me factor that in.' },
);
```

#### `BetaToolRunner.generateToolResponse()`

Gets the tool response for the last assistant message (if any tools need to be executed).

```ts
for await (const message of runner) {
  const toolResponse = await runner.generateToolResponse();
  if (toolResponse) {
    console.log('Tool results:', toolResponse.content);
  }
}
```

#### `BetaToolRunner.params`

Read-only access to the current conversation parameters.

```ts
console.log('Current model:', runner.params.model);
console.log('Message count:', runner.params.messages.length);
```

### `ToolError`

When a tool encounters an error, you can throw a `ToolError` to return structured content blocks as the error result instead of just a string message. The ToolRunner will catch this error and send the content back to the model with `is_error: true`.

```ts
import { ToolError } from '@anthropic-ai/sdk/resources/beta/messages';

const screenshotTool = betaZodTool({
  name: 'take_screenshot',
  inputSchema: z.object({ url: z.string() }),
  description: 'Take a screenshot of a webpage',
  run: async (input) => {
    try {
      const screenshot = await takeScreenshot(input.url);
      return [{ type: 'image', source: { type: 'base64', data: screenshot, media_type: 'image/png' } }];
    } catch (e) {
      // Return structured error content with an image showing what went wrong
      throw new ToolError([
        { type: 'text', text: `Failed to screenshot ${input.url}: ${e.message}` },
        { type: 'image', source: { type: 'base64', data: errorScreenshot, media_type: 'image/png' } },
      ]);
    }
  },
});
```

You can also throw a `ToolError` with a simple string:

```ts
throw new ToolError('Invalid input: URL must start with https://');
```

### Examples

See the following example files for more usage patterns:

- [`examples/tools-helpers-zod.ts`](examples/tools-helpers-zod.ts) - Zod-based tools
- [`examples/tools-helpers-json-schema.ts`](examples/tools-helpers-json-schema.ts) - JSON Schema tools
- [`examples/tools.ts`](examples/tools.ts) - Basic tool usage
