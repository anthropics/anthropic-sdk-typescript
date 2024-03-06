// File generated from our OpenAPI spec by Stainless.

import * as Core from '@anthropic-ai/sdk/core';
import { APIPromise } from '@anthropic-ai/sdk/core';
import { APIResource } from '@anthropic-ai/sdk/resource';
import * as CompletionsAPI from '@anthropic-ai/sdk/resources/completions';
import { Stream } from '@anthropic-ai/sdk/streaming';

export class Completions extends APIResource {
  /**
   * [Legacy] Create a Text Completion.
   *
   * The Text Completions API is a legacy API. We recommend using the
   * [Messages API](https://docs.anthropic.com/claude/reference/messages_post) going
   * forward.
   *
   * Future models and features will not be compatible with Text Completions. See our
   * [migration guide](https://docs.anthropic.com/claude/reference/migrating-from-text-completions-to-messages)
   * for guidance in migrating from Text Completions to Messages.
   */
  create(body: CompletionCreateParamsNonStreaming, options?: Core.RequestOptions): APIPromise<Completion>;
  create(
    body: CompletionCreateParamsStreaming,
    options?: Core.RequestOptions,
  ): APIPromise<Stream<Completion>>;
  create(
    body: CompletionCreateParamsBase,
    options?: Core.RequestOptions,
  ): APIPromise<Stream<Completion> | Completion>;
  create(
    body: CompletionCreateParams,
    options?: Core.RequestOptions,
  ): APIPromise<Completion> | APIPromise<Stream<Completion>> {
    return this._client.post('/v1/complete', {
      body,
      timeout: 600000,
      ...options,
      stream: body.stream ?? false,
    }) as APIPromise<Completion> | APIPromise<Stream<Completion>>;
  }
}

export interface Completion {
  /**
   * Unique object identifier.
   *
   * The format and length of IDs may change over time.
   */
  id: string;

  /**
   * The resulting completion up to and excluding the stop sequences.
   */
  completion: string;

  /**
   * The model that handled the request.
   */
  model: string;

  /**
   * The reason that we stopped.
   *
   * This may be one the following values:
   *
   * - `"stop_sequence"`: we reached a stop sequence — either provided by you via the
   *   `stop_sequences` parameter, or a stop sequence built into the model
   * - `"max_tokens"`: we exceeded `max_tokens_to_sample` or the model's maximum
   */
  stop_reason: string | null;

  /**
   * Object type.
   *
   * For Text Completions, this is always `"completion"`.
   */
  type: 'completion';
}

export type CompletionCreateParams = CompletionCreateParamsNonStreaming | CompletionCreateParamsStreaming;

export interface CompletionCreateParamsBase {
  /**
   * The maximum number of tokens to generate before stopping.
   *
   * Note that our models may stop _before_ reaching this maximum. This parameter
   * only specifies the absolute maximum number of tokens to generate.
   */
  max_tokens_to_sample: number;

  /**
   * The model that will complete your prompt.
   *
   * See [models](https://docs.anthropic.com/claude/docs/models-overview) for
   * additional details and options.
   */
  model: (string & {}) | 'claude-2.0' | 'claude-2.1' | 'claude-instant-1.2';

  /**
   * The prompt that you want Claude to complete.
   *
   * For proper response generation you will need to format your prompt using
   * alternating `\n\nHuman:` and `\n\nAssistant:` conversational turns. For example:
   *
   * ```
   * "\n\nHuman: {userQuestion}\n\nAssistant:"
   * ```
   *
   * See
   * [prompt validation](https://anthropic.readme.io/claude/reference/prompt-validation)
   * and our guide to
   * [prompt design](https://docs.anthropic.com/claude/docs/introduction-to-prompt-design)
   * for more details.
   */
  prompt: string;

  /**
   * An object describing metadata about the request.
   */
  metadata?: CompletionCreateParams.Metadata;

  /**
   * Sequences that will cause the model to stop generating.
   *
   * Our models stop on `"\n\nHuman:"`, and may include additional built-in stop
   * sequences in the future. By providing the stop_sequences parameter, you may
   * include additional strings that will cause the model to stop generating.
   */
  stop_sequences?: Array<string>;

  /**
   * Whether to incrementally stream the response using server-sent events.
   *
   * See
   * [streaming](https://docs.anthropic.com/claude/reference/text-completions-streaming)
   * for details.
   */
  stream?: boolean;

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

export namespace CompletionCreateParams {
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

  export type CompletionCreateParamsNonStreaming = CompletionsAPI.CompletionCreateParamsNonStreaming;
  export type CompletionCreateParamsStreaming = CompletionsAPI.CompletionCreateParamsStreaming;
}

export interface CompletionCreateParamsNonStreaming extends CompletionCreateParamsBase {
  /**
   * Whether to incrementally stream the response using server-sent events.
   *
   * See
   * [streaming](https://docs.anthropic.com/claude/reference/text-completions-streaming)
   * for details.
   */
  stream?: false;
}

export interface CompletionCreateParamsStreaming extends CompletionCreateParamsBase {
  /**
   * Whether to incrementally stream the response using server-sent events.
   *
   * See
   * [streaming](https://docs.anthropic.com/claude/reference/text-completions-streaming)
   * for details.
   */
  stream: true;
}

export namespace Completions {
  export import Completion = CompletionsAPI.Completion;
  export import CompletionCreateParams = CompletionsAPI.CompletionCreateParams;
  export import CompletionCreateParamsNonStreaming = CompletionsAPI.CompletionCreateParamsNonStreaming;
  export import CompletionCreateParamsStreaming = CompletionsAPI.CompletionCreateParamsStreaming;
}
