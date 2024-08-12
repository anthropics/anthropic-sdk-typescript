// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { APIPromise } from '../../../core';
import * as Core from '../../../core';
import * as PromptCachingMessagesAPI from './messages';
import * as MessagesAPI from '../../messages';
import { Stream } from '../../../streaming';

export class Messages extends APIResource {
  /**
   * Create a Message.
   *
   * Send a structured list of input messages with text and/or image content, and the
   * model will generate the next message in the conversation.
   *
   * The Messages API can be used for either single queries or stateless multi-turn
   * conversations.
   */
  create(
    body: MessageCreateParamsNonStreaming,
    options?: Core.RequestOptions,
  ): APIPromise<PromptCachingBetaMessage>;
  create(
    body: MessageCreateParamsStreaming,
    options?: Core.RequestOptions,
  ): APIPromise<Stream<RawPromptCachingBetaMessageStreamEvent>>;
  create(
    body: MessageCreateParamsBase,
    options?: Core.RequestOptions,
  ): APIPromise<Stream<RawPromptCachingBetaMessageStreamEvent> | PromptCachingBetaMessage>;
  create(
    body: MessageCreateParams,
    options?: Core.RequestOptions,
  ): APIPromise<PromptCachingBetaMessage> | APIPromise<Stream<RawPromptCachingBetaMessageStreamEvent>> {
    return this._client.post('/v1/messages?beta=prompt_caching', {
      body,
      timeout: (this._client as any)._options.timeout ?? 600000,
      ...options,
      headers: { 'anthropic-beta': 'prompt-caching-2024-07-31', ...options?.headers },
      stream: body.stream ?? false,
    }) as APIPromise<PromptCachingBetaMessage> | APIPromise<Stream<RawPromptCachingBetaMessageStreamEvent>>;
  }
}

export interface PromptCachingBetaCacheControlEphemeral {
  type: 'ephemeral';
}

export interface PromptCachingBetaImageBlockParam {
  source: PromptCachingBetaImageBlockParam.Source;

  type: 'image';

  cache_control?: PromptCachingBetaCacheControlEphemeral | null;
}

export namespace PromptCachingBetaImageBlockParam {
  export interface Source {
    data: string;

    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    type: 'base64';
  }
}

export interface PromptCachingBetaMessage {
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
   * its shape.
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
  content: Array<MessagesAPI.ContentBlock>;

  /**
   * The model that will complete your prompt.\n\nSee
   * [models](https://docs.anthropic.com/en/docs/models-overview) for additional
   * details and options.
   */
  model: MessagesAPI.Model;

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
   * - `"tool_use"`: the model invoked one or more tools
   *
   * In non-streaming mode this value is always non-null. In streaming mode, it is
   * null in the `message_start` event and non-null otherwise.
   */
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;

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
  usage: PromptCachingBetaUsage;
}

export interface PromptCachingBetaMessageParam {
  content:
    | string
    | Array<
        | PromptCachingBetaTextBlockParam
        | PromptCachingBetaImageBlockParam
        | PromptCachingBetaToolUseBlockParam
        | PromptCachingBetaToolResultBlockParam
      >;

  role: 'user' | 'assistant';
}

export interface PromptCachingBetaTextBlockParam {
  text: string;

  type: 'text';

  cache_control?: PromptCachingBetaCacheControlEphemeral | null;
}

export interface PromptCachingBetaTool {
  /**
   * [JSON schema](https://json-schema.org/) for this tool's input.
   *
   * This defines the shape of the `input` that your tool accepts and that the model
   * will produce.
   */
  input_schema: PromptCachingBetaTool.InputSchema;

  name: string;

  cache_control?: PromptCachingBetaCacheControlEphemeral | null;

  /**
   * Description of what this tool does.
   *
   * Tool descriptions should be as detailed as possible. The more information that
   * the model has about what the tool is and how to use it, the better it will
   * perform. You can use natural language descriptions to reinforce important
   * aspects of the tool input JSON schema.
   */
  description?: string;
}

export namespace PromptCachingBetaTool {
  /**
   * [JSON schema](https://json-schema.org/) for this tool's input.
   *
   * This defines the shape of the `input` that your tool accepts and that the model
   * will produce.
   */
  export interface InputSchema {
    type: 'object';

    properties?: unknown | null;
    [k: string]: unknown;
  }
}

export interface PromptCachingBetaToolResultBlockParam {
  tool_use_id: string;

  type: 'tool_result';

  cache_control?: PromptCachingBetaCacheControlEphemeral | null;

  content?: string | Array<PromptCachingBetaTextBlockParam | PromptCachingBetaImageBlockParam>;

  is_error?: boolean;
}

export interface PromptCachingBetaToolUseBlockParam {
  id: string;

  input: unknown;

  name: string;

  type: 'tool_use';

  cache_control?: PromptCachingBetaCacheControlEphemeral | null;
}

export interface PromptCachingBetaUsage {
  /**
   * The number of input tokens used to create the cache entry.
   */
  cache_creation_input_tokens: number | null;

  /**
   * The number of input tokens read from the cache.
   */
  cache_read_input_tokens: number | null;

  /**
   * The number of input tokens which were used.
   */
  input_tokens: number;

  /**
   * The number of output tokens which were used.
   */
  output_tokens: number;
}

export interface RawPromptCachingBetaMessageStartEvent {
  message: PromptCachingBetaMessage;

  type: 'message_start';
}

export type RawPromptCachingBetaMessageStreamEvent =
  | RawPromptCachingBetaMessageStartEvent
  | MessagesAPI.RawMessageDeltaEvent
  | MessagesAPI.RawMessageStopEvent
  | MessagesAPI.RawContentBlockStartEvent
  | MessagesAPI.RawContentBlockDeltaEvent
  | MessagesAPI.RawContentBlockStopEvent;

export type MessageCreateParams = MessageCreateParamsNonStreaming | MessageCreateParamsStreaming;

export interface MessageCreateParamsBase {
  /**
   * The maximum number of tokens to generate before stopping.
   *
   * Note that our models may stop _before_ reaching this maximum. This parameter
   * only specifies the absolute maximum number of tokens to generate.
   *
   * Different models have different maximum values for this parameter. See
   * [models](https://docs.anthropic.com/en/docs/models-overview) for details.
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
   * See [examples](https://docs.anthropic.com/en/api/messages-examples#vision) for
   * more input examples.
   *
   * Note that if you want to include a
   * [system prompt](https://docs.anthropic.com/en/docs/system-prompts), you can use
   * the top-level `system` parameter — there is no `"system"` role for input
   * messages in the Messages API.
   */
  messages: Array<PromptCachingBetaMessageParam>;

  /**
   * The model that will complete your prompt.\n\nSee
   * [models](https://docs.anthropic.com/en/docs/models-overview) for additional
   * details and options.
   */
  model: MessagesAPI.Model;

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
   * See [streaming](https://docs.anthropic.com/en/api/messages-streaming) for
   * details.
   */
  stream?: boolean;

  /**
   * System prompt.
   *
   * A system prompt is a way of providing context and instructions to Claude, such
   * as specifying a particular goal or role. See our
   * [guide to system prompts](https://docs.anthropic.com/en/docs/system-prompts).
   */
  system?: string | Array<PromptCachingBetaTextBlockParam>;

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
   * How the model should use the provided tools. The model can use a specific tool,
   * any available tool, or decide by itself.
   */
  tool_choice?:
    | MessageCreateParams.ToolChoiceAuto
    | MessageCreateParams.ToolChoiceAny
    | MessageCreateParams.ToolChoiceTool;

  /**
   * Definitions of tools that the model may use.
   *
   * If you include `tools` in your API request, the model may return `tool_use`
   * content blocks that represent the model's use of those tools. You can then run
   * those tools using the tool input generated by the model and then optionally
   * return results back to the model using `tool_result` content blocks.
   *
   * Each tool definition includes:
   *
   * - `name`: Name of the tool.
   * - `description`: Optional, but strongly-recommended description of the tool.
   * - `input_schema`: [JSON schema](https://json-schema.org/) for the tool `input`
   *   shape that the model will produce in `tool_use` output content blocks.
   *
   * For example, if you defined `tools` as:
   *
   * ```json
   * [
   *   {
   *     "name": "get_stock_price",
   *     "description": "Get the current stock price for a given ticker symbol.",
   *     "input_schema": {
   *       "type": "object",
   *       "properties": {
   *         "ticker": {
   *           "type": "string",
   *           "description": "The stock ticker symbol, e.g. AAPL for Apple Inc."
   *         }
   *       },
   *       "required": ["ticker"]
   *     }
   *   }
   * ]
   * ```
   *
   * And then asked the model "What's the S&P 500 at today?", the model might produce
   * `tool_use` content blocks in the response like this:
   *
   * ```json
   * [
   *   {
   *     "type": "tool_use",
   *     "id": "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
   *     "name": "get_stock_price",
   *     "input": { "ticker": "^GSPC" }
   *   }
   * ]
   * ```
   *
   * You might then run your `get_stock_price` tool with `{"ticker": "^GSPC"}` as an
   * input, and return the following back to the model in a subsequent `user`
   * message:
   *
   * ```json
   * [
   *   {
   *     "type": "tool_result",
   *     "tool_use_id": "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
   *     "content": "259.75 USD"
   *   }
   * ]
   * ```
   *
   * Tools can be used for workflows that include running client-side tools and
   * functions, or more generally whenever you want the model to produce a particular
   * JSON structure of output.
   *
   * See our [guide](https://docs.anthropic.com/en/docs/tool-use) for more details.
   */
  tools?: Array<PromptCachingBetaTool>;

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

  /**
   * The model will automatically decide whether to use tools.
   */
  export interface ToolChoiceAuto {
    type: 'auto';
  }

  /**
   * The model will use any available tools.
   */
  export interface ToolChoiceAny {
    type: 'any';
  }

  /**
   * The model will use the specified tool with `tool_choice.name`.
   */
  export interface ToolChoiceTool {
    /**
     * The name of the tool to use.
     */
    name: string;

    type: 'tool';
  }

  export type MessageCreateParamsNonStreaming = PromptCachingMessagesAPI.MessageCreateParamsNonStreaming;
  export type MessageCreateParamsStreaming = PromptCachingMessagesAPI.MessageCreateParamsStreaming;
}

export interface MessageCreateParamsNonStreaming extends MessageCreateParamsBase {
  /**
   * Whether to incrementally stream the response using server-sent events.
   *
   * See [streaming](https://docs.anthropic.com/en/api/messages-streaming) for
   * details.
   */
  stream?: false;
}

export interface MessageCreateParamsStreaming extends MessageCreateParamsBase {
  /**
   * Whether to incrementally stream the response using server-sent events.
   *
   * See [streaming](https://docs.anthropic.com/en/api/messages-streaming) for
   * details.
   */
  stream: true;
}

export namespace Messages {
  export import PromptCachingBetaCacheControlEphemeral = PromptCachingMessagesAPI.PromptCachingBetaCacheControlEphemeral;
  export import PromptCachingBetaImageBlockParam = PromptCachingMessagesAPI.PromptCachingBetaImageBlockParam;
  export import PromptCachingBetaMessage = PromptCachingMessagesAPI.PromptCachingBetaMessage;
  export import PromptCachingBetaMessageParam = PromptCachingMessagesAPI.PromptCachingBetaMessageParam;
  export import PromptCachingBetaTextBlockParam = PromptCachingMessagesAPI.PromptCachingBetaTextBlockParam;
  export import PromptCachingBetaTool = PromptCachingMessagesAPI.PromptCachingBetaTool;
  export import PromptCachingBetaToolResultBlockParam = PromptCachingMessagesAPI.PromptCachingBetaToolResultBlockParam;
  export import PromptCachingBetaToolUseBlockParam = PromptCachingMessagesAPI.PromptCachingBetaToolUseBlockParam;
  export import PromptCachingBetaUsage = PromptCachingMessagesAPI.PromptCachingBetaUsage;
  export import RawPromptCachingBetaMessageStartEvent = PromptCachingMessagesAPI.RawPromptCachingBetaMessageStartEvent;
  export import RawPromptCachingBetaMessageStreamEvent = PromptCachingMessagesAPI.RawPromptCachingBetaMessageStreamEvent;
  export import MessageCreateParams = PromptCachingMessagesAPI.MessageCreateParams;
  export import MessageCreateParamsNonStreaming = PromptCachingMessagesAPI.MessageCreateParamsNonStreaming;
  export import MessageCreateParamsStreaming = PromptCachingMessagesAPI.MessageCreateParamsStreaming;
}
