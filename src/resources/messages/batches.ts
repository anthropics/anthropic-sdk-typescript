// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';
import * as Shared from '../shared';
import * as MessagesAPI from './messages';
import { Page, type PageParams } from '../../pagination';
import { JSONLDecoder } from '../../internal/decoders/jsonl';

export class Batches extends APIResource {
  /**
   * Send a batch of Message creation requests.
   *
   * The Message Batches API can be used to process multiple Messages API requests at
   * once. Once a Message Batch is created, it begins processing immediately. Batches
   * can take up to 24 hours to complete.
   *
   * Learn more about the Message Batches API in our
   * [user guide](/en/docs/build-with-claude/batch-processing)
   */
  create(body: BatchCreateParams, options?: Core.RequestOptions): Core.APIPromise<MessageBatch> {
    return this._client.post('/v1/messages/batches', { body, ...options });
  }

  /**
   * This endpoint is idempotent and can be used to poll for Message Batch
   * completion. To access the results of a Message Batch, make a request to the
   * `results_url` field in the response.
   *
   * Learn more about the Message Batches API in our
   * [user guide](/en/docs/build-with-claude/batch-processing)
   */
  retrieve(messageBatchId: string, options?: Core.RequestOptions): Core.APIPromise<MessageBatch> {
    return this._client.get(`/v1/messages/batches/${messageBatchId}`, options);
  }

  /**
   * List all Message Batches within a Workspace. Most recently created batches are
   * returned first.
   *
   * Learn more about the Message Batches API in our
   * [user guide](/en/docs/build-with-claude/batch-processing)
   */
  list(
    query?: BatchListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<MessageBatchesPage, MessageBatch>;
  list(options?: Core.RequestOptions): Core.PagePromise<MessageBatchesPage, MessageBatch>;
  list(
    query: BatchListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<MessageBatchesPage, MessageBatch> {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return this._client.getAPIList('/v1/messages/batches', MessageBatchesPage, { query, ...options });
  }

  /**
   * Delete a Message Batch.
   *
   * Message Batches can only be deleted once they've finished processing. If you'd
   * like to delete an in-progress batch, you must first cancel it.
   *
   * Learn more about the Message Batches API in our
   * [user guide](/en/docs/build-with-claude/batch-processing)
   */
  delete(messageBatchId: string, options?: Core.RequestOptions): Core.APIPromise<DeletedMessageBatch> {
    return this._client.delete(`/v1/messages/batches/${messageBatchId}`, options);
  }

  /**
   * Batches may be canceled any time before processing ends. Once cancellation is
   * initiated, the batch enters a `canceling` state, at which time the system may
   * complete any in-progress, non-interruptible requests before finalizing
   * cancellation.
   *
   * The number of canceled requests is specified in `request_counts`. To determine
   * which requests were canceled, check the individual results within the batch.
   * Note that cancellation may not result in any canceled requests if they were
   * non-interruptible.
   *
   * Learn more about the Message Batches API in our
   * [user guide](/en/docs/build-with-claude/batch-processing)
   */
  cancel(messageBatchId: string, options?: Core.RequestOptions): Core.APIPromise<MessageBatch> {
    return this._client.post(`/v1/messages/batches/${messageBatchId}/cancel`, options);
  }

  /**
   * Streams the results of a Message Batch as a `.jsonl` file.
   *
   * Each line in the file is a JSON object containing the result of a single request
   * in the Message Batch. Results are not guaranteed to be in the same order as
   * requests. Use the `custom_id` field to match results to requests.
   *
   * Learn more about the Message Batches API in our
   * [user guide](/en/docs/build-with-claude/batch-processing)
   */
  results(
    messageBatchId: string,
    options?: Core.RequestOptions,
  ): Core.APIPromise<JSONLDecoder<MessageBatchIndividualResponse>> {
    return this._client
      .get(`/v1/messages/batches/${messageBatchId}/results`, {
        ...options,
        headers: { Accept: 'application/x-jsonl', ...options?.headers },
        __binaryResponse: true,
      })
      ._thenUnwrap((_, props) => JSONLDecoder.fromResponse(props.response, props.controller));
  }
}

export class MessageBatchesPage extends Page<MessageBatch> {}

export interface DeletedMessageBatch {
  /**
   * ID of the Message Batch.
   */
  id: string;

  /**
   * Deleted object type.
   *
   * For Message Batches, this is always `"message_batch_deleted"`.
   */
  type: 'message_batch_deleted';
}

export interface MessageBatch {
  /**
   * Unique object identifier.
   *
   * The format and length of IDs may change over time.
   */
  id: string;

  /**
   * RFC 3339 datetime string representing the time at which the Message Batch was
   * archived and its results became unavailable.
   */
  archived_at: string | null;

  /**
   * RFC 3339 datetime string representing the time at which cancellation was
   * initiated for the Message Batch. Specified only if cancellation was initiated.
   */
  cancel_initiated_at: string | null;

  /**
   * RFC 3339 datetime string representing the time at which the Message Batch was
   * created.
   */
  created_at: string;

  /**
   * RFC 3339 datetime string representing the time at which processing for the
   * Message Batch ended. Specified only once processing ends.
   *
   * Processing ends when every request in a Message Batch has either succeeded,
   * errored, canceled, or expired.
   */
  ended_at: string | null;

  /**
   * RFC 3339 datetime string representing the time at which the Message Batch will
   * expire and end processing, which is 24 hours after creation.
   */
  expires_at: string;

  /**
   * Processing status of the Message Batch.
   */
  processing_status: 'in_progress' | 'canceling' | 'ended';

  /**
   * Tallies requests within the Message Batch, categorized by their status.
   *
   * Requests start as `processing` and move to one of the other statuses only once
   * processing of the entire batch ends. The sum of all values always matches the
   * total number of requests in the batch.
   */
  request_counts: MessageBatchRequestCounts;

  /**
   * URL to a `.jsonl` file containing the results of the Message Batch requests.
   * Specified only once processing ends.
   *
   * Results in the file are not guaranteed to be in the same order as requests. Use
   * the `custom_id` field to match results to requests.
   */
  results_url: string | null;

  /**
   * Object type.
   *
   * For Message Batches, this is always `"message_batch"`.
   */
  type: 'message_batch';
}

export interface MessageBatchCanceledResult {
  type: 'canceled';
}

export interface MessageBatchErroredResult {
  error: Shared.ErrorResponse;

  type: 'errored';
}

export interface MessageBatchExpiredResult {
  type: 'expired';
}

/**
 * This is a single line in the response `.jsonl` file and does not represent the
 * response as a whole.
 */
export interface MessageBatchIndividualResponse {
  /**
   * Developer-provided ID created for each request in a Message Batch. Useful for
   * matching results to requests, as results may be given out of request order.
   *
   * Must be unique for each request within the Message Batch.
   */
  custom_id: string;

  /**
   * Processing result for this request.
   *
   * Contains a Message output if processing was successful, an error response if
   * processing failed, or the reason why processing was not attempted, such as
   * cancellation or expiration.
   */
  result: MessageBatchResult;
}

export interface MessageBatchRequestCounts {
  /**
   * Number of requests in the Message Batch that have been canceled.
   *
   * This is zero until processing of the entire Message Batch has ended.
   */
  canceled: number;

  /**
   * Number of requests in the Message Batch that encountered an error.
   *
   * This is zero until processing of the entire Message Batch has ended.
   */
  errored: number;

  /**
   * Number of requests in the Message Batch that have expired.
   *
   * This is zero until processing of the entire Message Batch has ended.
   */
  expired: number;

  /**
   * Number of requests in the Message Batch that are processing.
   */
  processing: number;

  /**
   * Number of requests in the Message Batch that have completed successfully.
   *
   * This is zero until processing of the entire Message Batch has ended.
   */
  succeeded: number;
}

/**
 * Processing result for this request.
 *
 * Contains a Message output if processing was successful, an error response if
 * processing failed, or the reason why processing was not attempted, such as
 * cancellation or expiration.
 */
export type MessageBatchResult =
  | MessageBatchSucceededResult
  | MessageBatchErroredResult
  | MessageBatchCanceledResult
  | MessageBatchExpiredResult;

export interface MessageBatchSucceededResult {
  message: MessagesAPI.Message;

  type: 'succeeded';
}

export interface BatchCreateParams {
  /**
   * List of requests for prompt completion. Each is an individual request to create
   * a Message.
   */
  requests: Array<BatchCreateParams.Request>;
}

export namespace BatchCreateParams {
  export interface Request {
    /**
     * Developer-provided ID created for each request in a Message Batch. Useful for
     * matching results to requests, as results may be given out of request order.
     *
     * Must be unique for each request within the Message Batch.
     */
    custom_id: string;

    /**
     * Messages API creation parameters for the individual request.
     *
     * See the [Messages API reference](/en/api/messages) for full documentation on
     * available parameters.
     */
    params: Request.Params;
  }

  export namespace Request {
    /**
     * Messages API creation parameters for the individual request.
     *
     * See the [Messages API reference](/en/api/messages) for full documentation on
     * available parameters.
     */
    export interface Params {
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
       * the next `Message` in the conversation. Consecutive `user` or `assistant` turns
       * in your request will be combined into a single turn.
       *
       * Each input message must be an object with a `role` and `content`. You can
       * specify a single `user`-role message, or you can include multiple `user` and
       * `assistant` messages.
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
      messages: Array<MessagesAPI.MessageParam>;

      /**
       * The model that will complete your prompt.\n\nSee
       * [models](https://docs.anthropic.com/en/docs/models-overview) for additional
       * details and options.
       */
      model: MessagesAPI.Model;

      /**
       * An object describing metadata about the request.
       */
      metadata?: MessagesAPI.Metadata;

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
      system?: string | Array<MessagesAPI.TextBlockParam>;

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
       * Configuration for enabling Claude's extended thinking.
       *
       * When enabled, responses include `thinking` content blocks showing Claude's
       * thinking process before the final answer. Requires a minimum budget of 1,024
       * tokens and counts towards your `max_tokens` limit.
       *
       * See
       * [extended thinking](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking)
       * for details.
       */
      thinking?: MessagesAPI.ThinkingConfigParam;

      /**
       * How the model should use the provided tools. The model can use a specific tool,
       * any available tool, or decide by itself.
       */
      tool_choice?: MessagesAPI.ToolChoice;

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
       * - `input_schema`: [JSON schema](https://json-schema.org/draft/2020-12) for the
       *   tool `input` shape that the model will produce in `tool_use` output content
       *   blocks.
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
      tools?: Array<MessagesAPI.ToolUnion>;

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
  }
}

export interface BatchListParams extends PageParams {}

Batches.MessageBatchesPage = MessageBatchesPage;

export declare namespace Batches {
  export {
    type DeletedMessageBatch as DeletedMessageBatch,
    type MessageBatch as MessageBatch,
    type MessageBatchCanceledResult as MessageBatchCanceledResult,
    type MessageBatchErroredResult as MessageBatchErroredResult,
    type MessageBatchExpiredResult as MessageBatchExpiredResult,
    type MessageBatchIndividualResponse as MessageBatchIndividualResponse,
    type MessageBatchRequestCounts as MessageBatchRequestCounts,
    type MessageBatchResult as MessageBatchResult,
    type MessageBatchSucceededResult as MessageBatchSucceededResult,
    MessageBatchesPage as MessageBatchesPage,
    type BatchCreateParams as BatchCreateParams,
    type BatchListParams as BatchListParams,
  };
}
