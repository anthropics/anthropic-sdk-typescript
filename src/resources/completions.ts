// File generated from our OpenAPI spec by Stainless.

import * as Core from '@anthropic-ai/sdk/core';
import { APIPromise } from '@anthropic-ai/sdk/core';
import { APIResource } from '@anthropic-ai/sdk/resource';
import * as CompletionsAPI from '@anthropic-ai/sdk/resources/completions';
import { Stream } from '@anthropic-ai/sdk/streaming';

export class Completions extends APIResource {
  /**
   * Create a Completion
   */
  create(params: CompletionCreateParamsNonStreaming, options?: Core.RequestOptions): APIPromise<Completion>;
  create(
    params: CompletionCreateParamsStreaming,
    options?: Core.RequestOptions,
  ): APIPromise<Stream<Completion>>;
  create(
    params: CompletionCreateParamsBase,
    options?: Core.RequestOptions,
  ): APIPromise<Stream<Completion> | Completion>;
  create(
    params: CompletionCreateParams,
    options?: Core.RequestOptions,
  ): APIPromise<Completion> | APIPromise<Stream<Completion>> {
    const { 'x-api-key': xAPIKey, ...body } = params;
    const headers: Record<string, string> = {};
    if (xAPIKey !== undefined) {
      headers['x-api-key'] = xAPIKey;
    }
    return this._client.post('/v1/complete', {
      body,
      timeout: 600000,
      ...options,
      headers: { ...headers, ...options?.headers },
      stream: params.stream ?? false,
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
  stop_reason: string;

  type: 'completion';
}

export type CompletionCreateParams = CompletionCreateParamsNonStreaming | CompletionCreateParamsStreaming;

export interface CompletionCreateParamsBase {
  /**
   * Body param: The maximum number of tokens to generate before stopping.
   *
   * Note that our models may stop _before_ reaching this maximum. This parameter
   * only specifies the absolute maximum number of tokens to generate.
   */
  max_tokens_to_sample: number;

  /**
   * Body param: The model that will complete your prompt.
   *
   * As we improve Claude, we develop new versions of it that you can query. The
   * `model` parameter controls which version of Claude responds to your request.
   * Right now we offer two model families: Claude, and Claude Instant. You can use
   * them by setting `model` to `"claude-2.1"` or `"claude-instant-1.2"`,
   * respectively.
   *
   * See [models](https://docs.anthropic.com/claude/reference/selecting-a-model) for
   * additional details and options.
   */
  model: (string & {}) | 'claude-2.1' | 'claude-instant-1';

  /**
   * Body param: The prompt that you want Claude to complete.
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
   * Body param: An object describing metadata about the request.
   */
  metadata?: CompletionCreateParams.Metadata;

  /**
   * Body param: Sequences that will cause the model to stop generating.
   *
   * Our models stop on `"\n\nHuman:"`, and may include additional built-in stop
   * sequences in the future. By providing the stop_sequences parameter, you may
   * include additional strings that will cause the model to stop generating.
   */
  stop_sequences?: Array<string>;

  /**
   * Body param: Whether to incrementally stream the response using server-sent
   * events.
   *
   * See [streaming](https://docs.anthropic.com/claude/reference/streaming) for
   * details.
   */
  stream?: boolean;

  /**
   * Body param: Amount of randomness injected into the response.
   *
   * Defaults to 1. Ranges from 0 to 1. Use temp closer to 0 for analytical /
   * multiple choice, and closer to 1 for creative and generative tasks.
   */
  temperature?: number;

  /**
   * Body param: Only sample from the top K options for each subsequent token.
   *
   * Used to remove "long tail" low probability responses.
   * [Learn more technical details here](https://towardsdatascience.com/how-to-sample-from-language-models-682bceb97277).
   */
  top_k?: number;

  /**
   * Body param: Use nucleus sampling.
   *
   * In nucleus sampling, we compute the cumulative distribution over all the options
   * for each subsequent token in decreasing probability order and cut it off once it
   * reaches a particular probability specified by `top_p`. You should either alter
   * `temperature` or `top_p`, but not both.
   */
  top_p?: number;

  /**
   * Header param:
   */
  'x-api-key'?: string;
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
    user_id?: string;
  }

  export type CompletionCreateParamsNonStreaming = CompletionsAPI.CompletionCreateParamsNonStreaming;
  export type CompletionCreateParamsStreaming = CompletionsAPI.CompletionCreateParamsStreaming;
}

export interface CompletionCreateParamsNonStreaming extends CompletionCreateParamsBase {
  /**
   * Body param: Whether to incrementally stream the response using server-sent
   * events.
   *
   * See [streaming](https://docs.anthropic.com/claude/reference/streaming) for
   * details.
   */
  stream?: false;
}

export interface CompletionCreateParamsStreaming extends CompletionCreateParamsBase {
  /**
   * Body param: Whether to incrementally stream the response using server-sent
   * events.
   *
   * See [streaming](https://docs.anthropic.com/claude/reference/streaming) for
   * details.
   */
  stream: true;
}

export namespace Completions {
  export import Completion = CompletionsAPI.Completion;
  export import CompletionCreateParams = CompletionsAPI.CompletionCreateParams;
  export import CompletionCreateParamsNonStreaming = CompletionsAPI.CompletionCreateParamsNonStreaming;
  export import CompletionCreateParamsStreaming = CompletionsAPI.CompletionCreateParamsStreaming;
}
