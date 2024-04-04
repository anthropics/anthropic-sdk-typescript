# Anthropic

# Messages

Types:

- <code><a href="./src/resources/messages.ts">ContentBlock</a></code>
- <code><a href="./src/resources/messages.ts">ContentBlockDeltaEvent</a></code>
- <code><a href="./src/resources/messages.ts">ContentBlockStartEvent</a></code>
- <code><a href="./src/resources/messages.ts">ContentBlockStopEvent</a></code>
- <code><a href="./src/resources/messages.ts">ImageBlockParam</a></code>
- <code><a href="./src/resources/messages.ts">Message</a></code>
- <code><a href="./src/resources/messages.ts">MessageDeltaEvent</a></code>
- <code><a href="./src/resources/messages.ts">MessageDeltaUsage</a></code>
- <code><a href="./src/resources/messages.ts">MessageParam</a></code>
- <code><a href="./src/resources/messages.ts">MessageStartEvent</a></code>
- <code><a href="./src/resources/messages.ts">MessageStopEvent</a></code>
- <code><a href="./src/resources/messages.ts">MessageStreamEvent</a></code>
- <code><a href="./src/resources/messages.ts">TextBlock</a></code>
- <code><a href="./src/resources/messages.ts">TextBlockParam</a></code>
- <code><a href="./src/resources/messages.ts">TextDelta</a></code>
- <code><a href="./src/resources/messages.ts">Usage</a></code>

Methods:

- <code title="post /v1/messages">client.messages.<a href="./src/resources/messages.ts">create</a>({ ...params }) -> Message</code>
- <code>client.messages.<a href="./src/resources/messages.ts">stream</a>(body, options?) -> MessageStream</code>

# Beta

## Tools

### Messages

Types:

- <code><a href="./src/resources/beta/tools/messages.ts">Tool</a></code>
- <code><a href="./src/resources/beta/tools/messages.ts">ToolResultBlockParam</a></code>
- <code><a href="./src/resources/beta/tools/messages.ts">ToolUseBlock</a></code>
- <code><a href="./src/resources/beta/tools/messages.ts">ToolUseBlockParam</a></code>
- <code><a href="./src/resources/beta/tools/messages.ts">ToolsBetaContentBlock</a></code>
- <code><a href="./src/resources/beta/tools/messages.ts">ToolsBetaMessage</a></code>
- <code><a href="./src/resources/beta/tools/messages.ts">ToolsBetaMessageParam</a></code>

Methods:

- <code title="post /v1/messages?beta=tools">client.beta.tools.messages.<a href="./src/resources/beta/tools/messages.ts">create</a>({ ...params }) -> ToolsBetaMessage</code>
