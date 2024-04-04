// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import * as Core from '@anthropic-ai/sdk/core';
import { APIPromise } from '@anthropic-ai/sdk/core';
import { APIResource } from '@anthropic-ai/sdk/resource';
import { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
export { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import * as MessagesAPI from '@anthropic-ai/sdk/resources/messages';
import { Stream } from '@anthropic-ai/sdk/streaming';

export class Messages extends APIResource {
  /**
   * Create a Message.
   *
   * Send a structured list of input messages with text and/or image content, and the
   * model will generate the next message in the conversation.
   *
   * The Messages API can be used for for either single queries or stateless
   * multi-turn conversations.
   */
  create(body: MessageCreateParamsNonStreaming, options?: Core.RequestOptions): APIPromise<Message>;
  create(
    body: MessageCreateParamsStreaming,
    options?: Core.RequestOptions,
  ): APIPromise<Stream<MessageStreamEvent>>;
  create(
    body: MessageCreateParamsBase,
    options?: Core.RequestOptions,
  ): APIPromise<Stream<MessageStreamEvent> | Message>;
  create(
    body: MessageCreateParams,
    options?: Core.RequestOptions,
  ): APIPromise<Message> | APIPromise<Stream<MessageStreamEvent>> {
    return this._client.post('/v1/messages', {
      body,
      timeout: 600000,
      ...options,
      stream: body.stream ?? false,
    }) as APIPromise<Message> | APIPromise<Stream<MessageStreamEvent>>;
  }

  /**
   * Create a Message stream
   */
  stream(body: MessageStreamParams, options?: Core.RequestOptions): MessageStream {
    return MessageStream.createMessage(this, body, options);
  }
}

export interface ContentBlock {
  text: string;

  type: 'text';
}

export interface ContentBlockDeltaEvent {
  delta: TextDelta;

  index: number;

  type: 'content_block_delta';
}

export interface ContentBlockStartEvent {
  content_block: ContentBlock;

  index: number;

  type: 'content_block_start';
}

export interface ContentBlockStopEvent {
  index: number;

  type: 'content_block_stop';
}

export interface ImageBlockParam {
  source: ImageBlockParam.Source;

  type: 'image';
}

export namespace ImageBlockParam {
  export interface Source {
    data: string;

    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    type: 'base64';
  }
}

export interface Message {
  /**
   * Unique object identifier.
   *
   * The format and length of IDs may change over time.
   */
  id: string;

  /**
   * Content generated by the model.
   *
   * This is an array of content blocks, each of which has a `type` that determines
   * its shape. Currently, the only `type` in responses is `"text"`.
   *
   * Example:
   *
   * ```json
   * [{ "type": "text", "text": "Hi, I'm Claude." }]
   * ```
   *
   * If the request input `messages` ended with an `assistant` turn, then the
   * response `content` will continue directly from that last turn. You can use this
   * to constrain the model's output.
   *
   * For example, if the input `messages` were:
   *
   * ```json
   * [
   *   {
   *     "role": "user",
   *     "content": "What's the Greek name for Sun? (A) Sol (B) Helios (C) Sun"
   *   },
   *   { "role": "assistant", "content": "The best answer is (" }
   * ]
   * ```
   *
   * Then the response `content` might be:
   *
   * ```json
   * [{ "type": "text", "text": "B)" }]
   * ```
   */
  content: Array<ContentBlock>;

  /**
   * The model that handled the request.
   */
  model: string;

  /**
   * Conversational role of the generated message.
   *
   * This will always be `"assistant"`.
   */
  role: 'assistant';

  /**
   * The reason that we stopped.
   *
   * This may be one the following values:
   *
   * - `"end_turn"`: the model reached a natural stopping point
   * - `"max_tokens"`: we exceeded the requested `max_tokens` or the model's maximum
   * - `"stop_sequence"`: one of your provided custom `stop_sequences` was generated
   *
   * Note that these values are different than those in `/v1/complete`, where
   * `end_turn` and `stop_sequence` were not differentiated.
   *
   * In non-streaming mode this value is always non-null. In streaming mode, it is
   * null in the `message_start` event and non-null otherwise.
   */
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;

  /**
   * Which custom stop sequence was generated, if any.
   *
   * This value will be a non-null string if one of your custom stop sequences was
   * generated.
   */
  stop_sequence: string | null;

  /**
   * Object type.
   *
   * For Messages, this is always `"message"`.
   */
  type: 'message';

  /**
   * Billing and rate-limit usage.
   *
   * Anthropic's API bills and rate-limits by token counts, as tokens represent the
   * underlying cost to our systems.
   *
   * Under the hood, the API transforms requests into a format suitable for the
   * model. The model's output then goes through a parsing stage before becoming an
   * API response. As a result, the token counts in `usage` will not match one-to-one
   * with the exact visible content of an API request or response.
   *
   * For example, `output_tokens` will be non-zero, even for an empty string response
   * from Claude.
   */
  usage: Usage;
}

export interface MessageDeltaEvent {
  delta: MessageDeltaEvent.Delta;

  type: 'message_delta';

  /**
   * Billing and rate-limit usage.
   *
   * Anthropic's API bills and rate-limits by token counts, as tokens represent the
   * underlying cost to our systems.
   *
   * Under the hood, the API transforms requests into a format suitable for the
   * model. The model's output then goes through a parsing stage before becoming an
   * API response. As a result, the token counts in `usage` will not match one-to-one
   * with the exact visible content of an API request or response.
   *
   * For example, `output_tokens` will be non-zero, even for an empty string response
   * from Claude.
   */
  usage: MessageDeltaUsage;
}

export namespace MessageDeltaEvent {
  export interface Delta {
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;

    stop_sequence: string | null;
  }
}

export interface MessageDeltaUsage {
  /**
   * The cumulative number of output tokens which were used.
   */
  output_tokens: number;
}

export interface MessageParam {
  content: string | Array<TextBlock | ImageBlockParam>;

  role: 'user' | 'assistant';
}

export interface MessageStartEvent {
  message: Message;

  type: 'message_start';
}

export interface MessageStopEvent {
  type: 'message_stop';
}

export type MessageStreamEvent =
  | MessageStartEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent;

export interface TextBlock {
  text: string;

  type: 'text';
}

export interface TextDelta {
  text: string;

  type: 'text_delta';
}

export interface Usage {
  /**
   * The number of input tokens which were used.
   */
  input_tokens: number;

  /**
   * The number of output tokens which were used.
   */
  output_tokens: number;
}

export type MessageCreateParams = MessageCreateParamsNonStreaming | MessageCreateParamsStreaming;

export interface MessageCreateParamsBase {
  /**
   * The maximum number of tokens to generate before stopping.
   *
   * Note that our models may stop _before_ reaching this maximum. This parameter
   * only specifies the absolute maximum number of tokens to generate.
   *
   * Different models have different maximum values for this parameter. See
   * [models](https://docs.anthropic.com/claude/docs/models-overview) for details.
   */
  max_tokens: number;

  /**
   * Input messages.
   *
   * Our models are trained to operate on alternating `user` and `assistant`
   * conversational turns. When creating a new `Message`, you specify the prior
   * conversational turns with the `messages` parameter, and the model then generates
   * the next `Message` in the conversation.
   *
   * Each input message must be an object with a `role` and `content`. You can
   * specify a single `user`-role message, or you can include multiple `user` and
   * `assistant` messages. The first message must always use the `user` role.
   *
   * If the final message uses the `assistant` role, the response content will
   * continue immediately from the content in that message. This can be used to
   * constrain part of the model's response.
   *
   * Example with a single `user` message:
   *
   * ```json
   * [{ "role": "user", "content": "Hello, Claude" }]
   * ```
   *
   * Example with multiple conversational turns:
   *
   * ```json
   * [
   *   { "role": "user", "content": "Hello there." },
   *   { "role": "assistant", "content": "Hi, I'm Claude. How can I help you?" },
   *   { "role": "user", "content": "Can you explain LLMs in plain English?" }
   * ]
   * ```
   *
   * Example with a partially-filled response from Claude:
   *
   * ```json
   * [
   *   {
   *     "role": "user",
   *     "content": "What's the Greek name for Sun? (A) Sol (B) Helios (C) Sun"
   *   },
   *   { "role": "assistant", "content": "The best answer is (" }
   * ]
   * ```
   *
   * Each input message `content` may be either a single `string` or an array of
   * content blocks, where each block has a specific `type`. Using a `string` for
   * `content` is shorthand for an array of one content block of type `"text"`. The
   * following input messages are equivalent:
   *
   * ```json
   * { "role": "user", "content": "Hello, Claude" }
   * ```
   *
   * ```json
   * { "role": "user", "content": [{ "type": "text", "text": "Hello, Claude" }] }
   * ```
   *
   * Starting with Claude 3 models, you can also send image content blocks:
   *
   * ```json
   * {
   *   "role": "user",
   *   "content": [
   *     {
   *       "type": "image",
   *       "source": {
   *         "type": "base64",
   *         "media_type": "image/jpeg",
   *         "data": "/9j/4AAQSkZJRg..."
   *       }
   *     },
   *     { "type": "text", "text": "What is in this image?" }
   *   ]
   * }
   * ```
   *
   * We currently support the `base64` source type for images, and the `image/jpeg`,
   * `image/png`, `image/gif`, and `image/webp` media types.
   *
   * See [examples](https://docs.anthropic.com/claude/reference/messages-examples)
   * for more input examples.
   *
   * Note that if you want to include a
   * [system prompt](https://docs.anthropic.com/claude/docs/system-prompts), you can
   * use the top-level `system` parameter — there is no `"system"` role for input
   * messages in the Messages API.
   */
  messages: Array<MessageParam>;

  /**
   * The model that will complete your prompt.
   *
   * See [models](https://docs.anthropic.com/claude/docs/models-overview) for
   * additional details and options.
   */
  model:
    | (string & {})
    | 'claude-3-opus-20240229'
    | 'claude-3-sonnet-20240229'
    | 'claude-3-haiku-20240307'
    | 'claude-2.1'
    | 'claude-2.0'
    | 'claude-instant-1.2';

  /**
   * An object describing metadata about the request.
   */
  metadata?: MessageCreateParams.Metadata;

  /**
   * Custom text sequences that will cause the model to stop generating.
   *
   * Our models will normally stop when they have naturally completed their turn,
   * which will result in a response `stop_reason` of `"end_turn"`.
   *
   * If you want the model to stop generating when it encounters custom strings of
   * text, you can use the `stop_sequences` parameter. If the model encounters one of
   * the custom sequences, the response `stop_reason` value will be `"stop_sequence"`
   * and the response `stop_sequence` value will contain the matched stop sequence.
   */
  stop_sequences?: Array<string>;

  /**
   * Whether to incrementally stream the response using server-sent events.
   *
   * See [streaming](https://docs.anthropic.com/claude/reference/messages-streaming)
   * for details.
   */
  stream?: boolean;

  /**
   * System prompt.
   *
   * A system prompt is a way of providing context and instructions to Claude, such
   * as specifying a particular goal or role. See our
   * [guide to system prompts](https://docs.anthropic.com/claude/docs/system-prompts).
   */
  system?: string;

  /**
   * Amount of randomness injected into the response.
   *
   * Defaults to `1.0`. Ranges from `0.0` to `1.0`. Use `temperature` closer to `0.0`
   * for analytical / multiple choice, and closer to `1.0` for creative and
   * generative tasks.
   *
   * Note that even with `temperature` of `0.0`, the results will not be fully
   * deterministic.
   */
  temperature?: number;

  /**
   * Only sample from the top K options for each subsequent token.
   *
   * Used to remove "long tail" low probability responses.
   * [Learn more technical details here](https://towardsdatascience.com/how-to-sample-from-language-models-682bceb97277).
   *
   * Recommended for advanced use cases only. You usually only need to use
   * `temperature`.
   */
  top_k?: number;

  /**
   * Use nucleus sampling.
   *
   * In nucleus sampling, we compute the cumulative distribution over all the options
   * for each subsequent token in decreasing probability order and cut it off once it
   * reaches a particular probability specified by `top_p`. You should either alter
   * `temperature` or `top_p`, but not both.
   *
   * Recommended for advanced use cases only. You usually only need to use
   * `temperature`.
   */
  top_p?: number;
}

export namespace MessageCreateParams {
  /**
   * An object describing metadata about the request.
   */
  export interface Metadata {
    /**
     * An external identifier for the user who is associated with the request.
     *
     * This should be a uuid, hash value, or other opaque identifier. Anthropic may use
     * this id to help detect abuse. Do not include any identifying information such as
     * name, email address, or phone number.
     */
    user_id?: string | null;
  }

  export type MessageCreateParamsNonStreaming = MessagesAPI.MessageCreateParamsNonStreaming;
  export type MessageCreateParamsStreaming = MessagesAPI.MessageCreateParamsStreaming;
}

export interface MessageCreateParamsNonStreaming extends MessageCreateParamsBase {
  /**
   * Whether to incrementally stream the response using server-sent events.
   *
   * See [streaming](https://docs.anthropic.com/claude/reference/messages-streaming)
   * for details.
   */
  stream?: false;
}

export interface MessageCreateParamsStreaming extends MessageCreateParamsBase {
  /**
   * Whether to incrementally stream the response using server-sent events.
   *
   * See [streaming](https://docs.anthropic.com/claude/reference/messages-streaming)
   * for details.
   */
  stream: true;
}

export interface MessageStreamParams {
  /**
   * The maximum number of tokens to generate before stopping.
   *
   * Note that our models may stop _before_ reaching this maximum. This parameter
   * only specifies the absolute maximum number of tokens to generate.
   *
   * Different models have different maximum values for this parameter. See
   * [models](https://docs.anthropic.com/claude/docs/models-overview) for details.
   */
  max_tokens: number;

  /**
   * Input messages.
   *
   * Our models are trained to operate on alternating `user` and `assistant`
   * conversational turns. When creating a new `Message`, you specify the prior
   * conversational turns with the `messages` parameter, and the model then generates
   * the next `Message` in the conversation.
   *
   * Each input message must be an object with a `role` and `content`. You can
   * specify a single `user`-role message, or you can include multiple `user` and
   * `assistant` messages. The first message must always use the `user` role.
   *
   * If the final message uses the `assistant` role, the response content will
   * continue immediately from the content in that message. This can be used to
   * constrain part of the model's response.
   *
   * Example with a single `user` message:
   *
   * ```json
   * [{ "role": "user", "content": "Hello, Claude" }]
   * ```
   *
   * Example with multiple conversational turns:
   *
   * ```json
   * [
   *   { "role": "user", "content": "Hello there." },
   *   { "role": "assistant", "content": "Hi, I'm Claude. How can I help you?" },
   *   { "role": "user", "content": "Can you explain LLMs in plain English?" }
   * ]
   * ```
   *
   * Example with a partially-filled response from Claude:
   *
   * ```json
   * [
   *   {
   *     "role": "user",
   *     "content": "What's the Greek name for Sun? (A) Sol (B) Helios (C) Sun"
   *   },
   *   { "role": "assistant", "content": "The best answer is (" }
   * ]
   * ```
   *
   * Each input message `content` may be either a single `string` or an array of
   * content blocks, where each block has a specific `type`. Using a `string` for
   * `content` is shorthand for an array of one content block of type `"text"`. The
   * following input messages are equivalent:
   *
   * ```json
   * { "role": "user", "content": "Hello, Claude" }
   * ```
   *
   * ```json
   * { "role": "user", "content": [{ "type": "text", "text": "Hello, Claude" }] }
   * ```
   *
   * Starting with Claude 3 models, you can also send image content blocks:
   *
   * ```json
   * {
   *   "role": "user",
   *   "content": [
   *     {
   *       "type": "image",
   *       "source": {
   *         "type": "base64",
   *         "media_type": "image/jpeg",
   *         "data": "/9j/4AAQSkZJRg..."
   *       }
   *     },
   *     { "type": "text", "text": "What is in this image?" }
   *   ]
   * }
   * ```
   *
   * We currently support the `base64` source type for images, and the `image/jpeg`,
   * `image/png`, `image/gif`, and `image/webp` media types.
   *
   * See [examples](https://docs.anthropic.com/claude/reference/messages-examples)
   * for more input examples.
   *
   * Note that if you want to include a
   * [system prompt](https://docs.anthropic.com/claude/docs/system-prompts), you can
   * use the top-level `system` parameter — there is no `"system"` role for input
   * messages in the Messages API.
   */
  messages: Array<MessageParam>;

  /**
   * The model that will complete your prompt.
   *
   * See [models](https://docs.anthropic.com/claude/docs/models-overview) for
   * additional details and options.
   */
  model:
    | (string & {})
    | 'claude-3-opus-20240229'
    | 'claude-3-sonnet-20240229'
    | 'claude-3-haiku-20240307'
    | 'claude-2.1'
    | 'claude-2.0'
    | 'claude-instant-1.2';

  /**
   * An object describing metadata about the request.
   */
  metadata?: MessageStreamParams.Metadata;

  /**
   * Custom text sequences that will cause the model to stop generating.
   *
   * Our models will normally stop when they have naturally completed their turn,
   * which will result in a response `stop_reason` of `"end_turn"`.
   *
   * If you want the model to stop generating when it encounters custom strings of
   * text, you can use the `stop_sequences` parameter. If the model encounters one of
   * the custom sequences, the response `stop_reason` value will be `"stop_sequence"`
   * and the response `stop_sequence` value will contain the matched stop sequence.
   */
  stop_sequences?: Array<string>;

  /**
   * System prompt.
   *
   * A system prompt is a way of providing context and instructions to Claude, such
   * as specifying a particular goal or role. See our
   * [guide to system prompts](https://docs.anthropic.com/claude/docs/system-prompts).
   */
  system?: string;

  /**
   * Amount of randomness injected into the response.
   *
   * Defaults to `1.0`. Ranges from `0.0` to `1.0`. Use `temperature` closer to `0.0`
   * for analytical / multiple choice, and closer to `1.0` for creative and
   * generative tasks.
   *
   * Note that even with `temperature` of `0.0`, the results will not be fully
   * deterministic.
   */
  temperature?: number;

  /**
   * Only sample from the top K options for each subsequent token.
   *
   * Used to remove "long tail" low probability responses.
   * [Learn more technical details here](https://towardsdatascience.com/how-to-sample-from-language-models-682bceb97277).
   *
   * Recommended for advanced use cases only. You usually only need to use
   * `temperature`.
   */
  top_k?: number;

  /**
   * Use nucleus sampling.
   *
   * In nucleus sampling, we compute the cumulative distribution over all the options
   * for each subsequent token in decreasing probability order and cut it off once it
   * reaches a particular probability specified by `top_p`. You should either alter
   * `temperature` or `top_p`, but not both.
   *
   * Recommended for advanced use cases only. You usually only need to use
   * `temperature`.
   */
  top_p?: number;
}

export namespace MessageStreamParams {
  /**
   * An object describing metadata about the request.
   */
  export interface Metadata {
    /**
     * An external identifier for the user who is associated with the request.
     *
     * This should be a uuid, hash value, or other opaque identifier. Anthropic may use
     * this id to help detect abuse. Do not include any identifying information such as
     * name, email address, or phone number.
     */
    user_id?: string | null;
  }
}

export namespace Messages {
  export import ContentBlock = MessagesAPI.ContentBlock;
  export import ContentBlockDeltaEvent = MessagesAPI.ContentBlockDeltaEvent;
  export import ContentBlockStartEvent = MessagesAPI.ContentBlockStartEvent;
  export import ContentBlockStopEvent = MessagesAPI.ContentBlockStopEvent;
  export import ImageBlockParam = MessagesAPI.ImageBlockParam;
  export import Message = MessagesAPI.Message;
  export import MessageDeltaEvent = MessagesAPI.MessageDeltaEvent;
  export import MessageDeltaUsage = MessagesAPI.MessageDeltaUsage;
  export import MessageParam = MessagesAPI.MessageParam;
  export import MessageStartEvent = MessagesAPI.MessageStartEvent;
  export import MessageStopEvent = MessagesAPI.MessageStopEvent;
  export import MessageStreamEvent = MessagesAPI.MessageStreamEvent;
  export import TextBlock = MessagesAPI.TextBlock;
  export import TextDelta = MessagesAPI.TextDelta;
  export import Usage = MessagesAPI.Usage;
  export import MessageCreateParams = MessagesAPI.MessageCreateParams;
  export import MessageCreateParamsNonStreaming = MessagesAPI.MessageCreateParamsNonStreaming;
  export import MessageCreateParamsStreaming = MessagesAPI.MessageCreateParamsStreaming;
  export import MessageStreamParams = MessagesAPI.MessageStreamParams;
}
