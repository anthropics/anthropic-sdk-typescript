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

#### `.on('inputJson', (patialJson: string, jsonSnapshot: unknown) => …)`

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
