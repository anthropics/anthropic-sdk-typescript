# Anthropic

# Completions

Types:

- <code><a href="./src/resources/completions.ts">Completion</a></code>

Methods:

- <code title="post /v1/complete">client.completions.<a href="./src/resources/completions.ts">create</a>({ ...params }) -> Completion</code>

# Beta

## Messages

Types:

- <code><a href="./src/resources/beta/messages.ts">ContentBlock</a></code>
- <code><a href="./src/resources/beta/messages.ts">ContentBlockDeltaEvent</a></code>
- <code><a href="./src/resources/beta/messages.ts">ContentBlockStartEvent</a></code>
- <code><a href="./src/resources/beta/messages.ts">ContentBlockStopEvent</a></code>
- <code><a href="./src/resources/beta/messages.ts">Message</a></code>
- <code><a href="./src/resources/beta/messages.ts">MessageDeltaEvent</a></code>
- <code><a href="./src/resources/beta/messages.ts">MessageDeltaUsage</a></code>
- <code><a href="./src/resources/beta/messages.ts">MessageParam</a></code>
- <code><a href="./src/resources/beta/messages.ts">MessageStartEvent</a></code>
- <code><a href="./src/resources/beta/messages.ts">MessageStopEvent</a></code>
- <code><a href="./src/resources/beta/messages.ts">MessageStreamEvent</a></code>
- <code><a href="./src/resources/beta/messages.ts">TextBlock</a></code>
- <code><a href="./src/resources/beta/messages.ts">TextDelta</a></code>
- <code><a href="./src/resources/beta/messages.ts">Usage</a></code>

Methods:

- <code title="post /v1/messages">client.beta.messages.<a href="./src/resources/beta/messages.ts">create</a>({ ...params }) -> Message</code>
- <code>client.beta.messages.<a href="./src/resources/beta/messages.ts">stream</a>(body, options?) -> MessageStream</code>
