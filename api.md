# Anthropic

# Messages

Types:

- <code><a href="./src/resources/messages.ts">ContentBlock</a></code>
- <code><a href="./src/resources/messages.ts">ContentBlockDeltaEvent</a></code>
- <code><a href="./src/resources/messages.ts">ContentBlockStartEvent</a></code>
- <code><a href="./src/resources/messages.ts">ContentBlockStopEvent</a></code>
- <code><a href="./src/resources/messages.ts">ImageBlockParam</a></code>
- <code><a href="./src/resources/messages.ts">InputJSONDelta</a></code>
- <code><a href="./src/resources/messages.ts">Message</a></code>
- <code><a href="./src/resources/messages.ts">MessageDeltaEvent</a></code>
- <code><a href="./src/resources/messages.ts">MessageDeltaUsage</a></code>
- <code><a href="./src/resources/messages.ts">MessageParam</a></code>
- <code><a href="./src/resources/messages.ts">MessageStartEvent</a></code>
- <code><a href="./src/resources/messages.ts">MessageStopEvent</a></code>
- <code><a href="./src/resources/messages.ts">MessageStreamEvent</a></code>
- <code><a href="./src/resources/messages.ts">Model</a></code>
- <code><a href="./src/resources/messages.ts">RawContentBlockDeltaEvent</a></code>
- <code><a href="./src/resources/messages.ts">RawContentBlockStartEvent</a></code>
- <code><a href="./src/resources/messages.ts">RawContentBlockStopEvent</a></code>
- <code><a href="./src/resources/messages.ts">RawMessageDeltaEvent</a></code>
- <code><a href="./src/resources/messages.ts">RawMessageStartEvent</a></code>
- <code><a href="./src/resources/messages.ts">RawMessageStopEvent</a></code>
- <code><a href="./src/resources/messages.ts">RawMessageStreamEvent</a></code>
- <code><a href="./src/resources/messages.ts">TextBlock</a></code>
- <code><a href="./src/resources/messages.ts">TextBlockParam</a></code>
- <code><a href="./src/resources/messages.ts">TextDelta</a></code>
- <code><a href="./src/resources/messages.ts">Tool</a></code>
- <code><a href="./src/resources/messages.ts">ToolResultBlockParam</a></code>
- <code><a href="./src/resources/messages.ts">ToolUseBlock</a></code>
- <code><a href="./src/resources/messages.ts">ToolUseBlockParam</a></code>
- <code><a href="./src/resources/messages.ts">Usage</a></code>

Methods:

- <code title="post /v1/messages">client.messages.<a href="./src/resources/messages.ts">create</a>({ ...params }) -> Message</code>
- <code>client.messages.<a href="./src/resources/messages.ts">stream</a>(body, options?) -> MessageStream</code>

# Beta

## PromptCaching

### Messages

Types:

- <code><a href="./src/resources/beta/prompt-caching/messages.ts">PromptCachingBetaCacheControlEphemeral</a></code>
- <code><a href="./src/resources/beta/prompt-caching/messages.ts">PromptCachingBetaImageBlockParam</a></code>
- <code><a href="./src/resources/beta/prompt-caching/messages.ts">PromptCachingBetaMessage</a></code>
- <code><a href="./src/resources/beta/prompt-caching/messages.ts">PromptCachingBetaMessageParam</a></code>
- <code><a href="./src/resources/beta/prompt-caching/messages.ts">PromptCachingBetaTextBlockParam</a></code>
- <code><a href="./src/resources/beta/prompt-caching/messages.ts">PromptCachingBetaTool</a></code>
- <code><a href="./src/resources/beta/prompt-caching/messages.ts">PromptCachingBetaToolResultBlockParam</a></code>
- <code><a href="./src/resources/beta/prompt-caching/messages.ts">PromptCachingBetaToolUseBlockParam</a></code>
- <code><a href="./src/resources/beta/prompt-caching/messages.ts">PromptCachingBetaUsage</a></code>
- <code><a href="./src/resources/beta/prompt-caching/messages.ts">RawPromptCachingBetaMessageStartEvent</a></code>
- <code><a href="./src/resources/beta/prompt-caching/messages.ts">RawPromptCachingBetaMessageStreamEvent</a></code>

Methods:

- <code title="post /v1/messages?beta=prompt_caching">client.beta.promptCaching.messages.<a href="./src/resources/beta/prompt-caching/messages.ts">create</a>({ ...params }) -> PromptCachingBetaMessage</code>
- <code title="post /v1/messages?beta=prompt_caching">client.beta.promptCaching.messages.<a href="./src/resources/beta/prompt-caching/messages.ts">stream</a>({ ...params }) -> PromptCachingBetaMessageStream</code>
