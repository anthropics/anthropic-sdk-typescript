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
- <code><a href="./src/resources/messages.ts">Metadata</a></code>
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
- <code><a href="./src/resources/messages.ts">ToolChoice</a></code>
- <code><a href="./src/resources/messages.ts">ToolChoiceAny</a></code>
- <code><a href="./src/resources/messages.ts">ToolChoiceAuto</a></code>
- <code><a href="./src/resources/messages.ts">ToolChoiceTool</a></code>
- <code><a href="./src/resources/messages.ts">ToolResultBlockParam</a></code>
- <code><a href="./src/resources/messages.ts">ToolUseBlock</a></code>
- <code><a href="./src/resources/messages.ts">ToolUseBlockParam</a></code>
- <code><a href="./src/resources/messages.ts">Usage</a></code>

Methods:

- <code title="post /v1/messages">client.messages.<a href="./src/resources/messages.ts">create</a>({ ...params }) -> Message</code>
- <code>client.messages.<a href="./src/resources/messages.ts">stream</a>(body, options?) -> MessageStream</code>

# Beta

Types:

- <code><a href="./src/resources/beta/beta.ts">AnthropicBeta</a></code>
- <code><a href="./src/resources/beta/beta.ts">BetaAPIError</a></code>
- <code><a href="./src/resources/beta/beta.ts">BetaAuthenticationError</a></code>
- <code><a href="./src/resources/beta/beta.ts">BetaError</a></code>
- <code><a href="./src/resources/beta/beta.ts">BetaErrorResponse</a></code>
- <code><a href="./src/resources/beta/beta.ts">BetaInvalidRequestError</a></code>
- <code><a href="./src/resources/beta/beta.ts">BetaNotFoundError</a></code>
- <code><a href="./src/resources/beta/beta.ts">BetaOverloadedError</a></code>
- <code><a href="./src/resources/beta/beta.ts">BetaPermissionError</a></code>
- <code><a href="./src/resources/beta/beta.ts">BetaRateLimitError</a></code>

## Messages

Types:

- <code><a href="./src/resources/beta/messages/messages.ts">BetaCacheControlEphemeral</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaContentBlock</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaContentBlockParam</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaImageBlockParam</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaInputJSONDelta</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaMessage</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaMessageDeltaUsage</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaMessageParam</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaMetadata</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaRawContentBlockDeltaEvent</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaRawContentBlockStartEvent</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaRawContentBlockStopEvent</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaRawMessageDeltaEvent</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaRawMessageStartEvent</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaRawMessageStopEvent</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaRawMessageStreamEvent</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaTextBlock</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaTextBlockParam</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaTextDelta</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaTool</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaToolChoice</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaToolChoiceAny</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaToolChoiceAuto</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaToolChoiceTool</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaToolResultBlockParam</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaToolUseBlock</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaToolUseBlockParam</a></code>
- <code><a href="./src/resources/beta/messages/messages.ts">BetaUsage</a></code>

Methods:

- <code title="post /v1/messages?beta=true">client.beta.messages.<a href="./src/resources/beta/messages/messages.ts">create</a>({ ...params }) -> BetaMessage</code>

### Batches

Types:

- <code><a href="./src/resources/beta/messages/batches.ts">BetaMessageBatch</a></code>
- <code><a href="./src/resources/beta/messages/batches.ts">BetaMessageBatchCanceledResult</a></code>
- <code><a href="./src/resources/beta/messages/batches.ts">BetaMessageBatchErroredResult</a></code>
- <code><a href="./src/resources/beta/messages/batches.ts">BetaMessageBatchExpiredResult</a></code>
- <code><a href="./src/resources/beta/messages/batches.ts">BetaMessageBatchIndividualResponse</a></code>
- <code><a href="./src/resources/beta/messages/batches.ts">BetaMessageBatchRequestCounts</a></code>
- <code><a href="./src/resources/beta/messages/batches.ts">BetaMessageBatchResult</a></code>
- <code><a href="./src/resources/beta/messages/batches.ts">BetaMessageBatchSucceededResult</a></code>

Methods:

- <code title="post /v1/messages/batches?beta=true">client.beta.messages.batches.<a href="./src/resources/beta/messages/batches.ts">create</a>({ ...params }) -> BetaMessageBatch</code>
- <code title="get /v1/messages/batches/{message_batch_id}?beta=true">client.beta.messages.batches.<a href="./src/resources/beta/messages/batches.ts">retrieve</a>(messageBatchId, { ...params }) -> BetaMessageBatch</code>
- <code title="get /v1/messages/batches?beta=true">client.beta.messages.batches.<a href="./src/resources/beta/messages/batches.ts">list</a>({ ...params }) -> BetaMessageBatchesPage</code>
- <code title="post /v1/messages/batches/{message_batch_id}/cancel?beta=true">client.beta.messages.batches.<a href="./src/resources/beta/messages/batches.ts">cancel</a>(messageBatchId, { ...params }) -> BetaMessageBatch</code>
- <code title="get /v1/messages/batches/{message_batch_id}/results?beta=true">client.beta.messages.batches.<a href="./src/resources/beta/messages/batches.ts">results</a>(messageBatchId, { ...params }) -> Response</code>

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
