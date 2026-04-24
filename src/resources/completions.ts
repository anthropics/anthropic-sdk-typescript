// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../core/resource';
import * as CompletionsAPI from './completions';
import * as BetaAPI from './beta/beta';
import * as MessagesAPI from './messages/messages';
import { APIPromise } from '../core/api-promise';
import { Stream } from '../core/streaming';
import { buildHeaders } from '../internal/headers';
import { RequestOptions } from '../internal/request-options';

export class Completions extends APIResource {
  /**
   * [Legacy] Create a Text Completion.
   *
   * The Text Completions API is a legacy API. We recommend using the
   * [Messages API](https://docs.claude.com/en/api/messages) going forward.
   *
   * Future models and features will not be compatible with Text Completions. See our
   * [migration guide](https://docs.claude.com/en/api/migrating-from-text-completions-to-messages)
   * for guidance in migrating from Text Completions to Messages.
   *
   * @example
   * ```ts
   * const completion = await client.completions.create({
   *   max_tokens_to_sample: 256,
   *   model: 'claude-2.1',
   *   prompt: '\n\nHuman: Hello, world!\n\nAssistant:',
   * });
   * ```
   */
  create(params: CompletionCreateParamsNonStreaming, options?: RequestOptions): APIPromise<Completion>;
  create(params: CompletionCreateParamsStreaming, options?: RequestOptions): APIPromise<Stream<Completion>>;
  create(
    params: CompletionCreateParamsBase,
    options?: RequestOptions,
  ): APIPromise<Stream<Completion> | Completion>;
  create(
    params: CompletionCreateParams,
    options?: RequestOptions,
  ): APIPromise<Completion> | APIPromise<Stream<Completion>> {
    const { betas, ...body } = params;
    return this._client.post('/v1/complete', {
      body,
      timeout: (this._client as any)._options.timeout ?? 600000,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
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
   * The model that will complete your prompt.\n\nSee
   * [models](https://docs.anthropic.com/en/docs/models-overview) for additional
   * details and options.
   */
  model: MessagesAPI.Model;

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
   * Body param: The maximum number of tokens to generate before stopping.
   *
   * Note that our models may stop _before_ reaching this maximum. This parameter
   * only specifies the absolute maximum number of tokens to generate.
   */
  max_tokens_to_sample: number;

  /**
   * Body param: The model that will complete your prompt.\n\nSee
   * [models](https://docs.anthropic.com/en/docs/models-overview) for additional
   * details and options.
   */
  model: MessagesAPI.Model;

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
   * See [prompt validation](https://docs.claude.com/en/api/prompt-validation) and
   * our guide to [prompt design](https://docs.claude.com/en/docs/intro-to-prompting)
   * for more details.
   */
  prompt: string;

  /**
   * Body param: An object describing metadata about the request.
   */
  metadata?: MessagesAPI.Metadata;

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
   * See [streaming](https://docs.claude.com/en/api/streaming) for details.
   */
  stream?: boolean;

  /**
   * @deprecated Deprecated. Models released after Claude Opus 4.6 do not support
   * setting temperature. A value of 1.0 of will be accepted for backwards
   * compatibility, all other values will be rejected with a 400 error.
   */
  temperature?: number;

  /**
   * @deprecated Deprecated. Models released after Claude Opus 4.6 do not accept
   * top_k; any value will be rejected with a 400 error.
   */
  top_k?: number;

  /**
   * @deprecated Deprecated. Models released after Claude Opus 4.6 do not support
   * setting top_p. A value >= 0.99 will be accepted for backwards compatibility, all
   * other values will be rejected with a 400 error.
   */
  top_p?: number;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export namespace CompletionCreateParams {
  /**
   * @deprecated use `Anthropic.Messages.Metadata` instead
   */
  export type Metadata = MessagesAPI.Metadata;

  export type CompletionCreateParamsNonStreaming = CompletionsAPI.CompletionCreateParamsNonStreaming;
  export type CompletionCreateParamsStreaming = CompletionsAPI.CompletionCreateParamsStreaming;
}

export interface CompletionCreateParamsNonStreaming extends CompletionCreateParamsBase {
  /**
   * Body param: Whether to incrementally stream the response using server-sent
   * events.
   *
   * See [streaming](https://docs.claude.com/en/api/streaming) for details.
   */
  stream?: false;
}

export interface CompletionCreateParamsStreaming extends CompletionCreateParamsBase {
  /**
   * Body param: Whether to incrementally stream the response using server-sent
   * events.
   *
   * See [streaming](https://docs.claude.com/en/api/streaming) for details.
   */
  stream: true;
}

export declare namespace Completions {
  export {
    type Completion as Completion,
    type CompletionCreateParams as CompletionCreateParams,
    type CompletionCreateParamsNonStreaming as CompletionCreateParamsNonStreaming,
    type CompletionCreateParamsStreaming as CompletionCreateParamsStreaming,
  };
}
