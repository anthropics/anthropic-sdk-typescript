// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as BetaAPI from './beta';
import * as MessagesAPI from './messages/messages';
import * as PromptCachingAPI from './prompt-caching/prompt-caching';

export class Beta extends APIResource {
  messages: MessagesAPI.Messages = new MessagesAPI.Messages(this._client);
  promptCaching: PromptCachingAPI.PromptCaching = new PromptCachingAPI.PromptCaching(this._client);
}

export type AnthropicBeta =
  | (string & {})
  | 'message-batches-2024-09-24'
  | 'prompt-caching-2024-07-31'
  | 'computer-use-2024-10-22';

export interface BetaAPIError {
  message: string;

  type: 'api_error';
}

export interface BetaAuthenticationError {
  message: string;

  type: 'authentication_error';
}

export type BetaError =
  | BetaInvalidRequestError
  | BetaAuthenticationError
  | BetaPermissionError
  | BetaNotFoundError
  | BetaRateLimitError
  | BetaAPIError
  | BetaOverloadedError;

export interface BetaErrorResponse {
  error: BetaError;

  type: 'error';
}

export interface BetaInvalidRequestError {
  message: string;

  type: 'invalid_request_error';
}

export interface BetaNotFoundError {
  message: string;

  type: 'not_found_error';
}

export interface BetaOverloadedError {
  message: string;

  type: 'overloaded_error';
}

export interface BetaPermissionError {
  message: string;

  type: 'permission_error';
}

export interface BetaRateLimitError {
  message: string;

  type: 'rate_limit_error';
}

export namespace Beta {
  export type AnthropicBeta = BetaAPI.AnthropicBeta;
  export type BetaAPIError = BetaAPI.BetaAPIError;
  export type BetaAuthenticationError = BetaAPI.BetaAuthenticationError;
  export type BetaError = BetaAPI.BetaError;
  export type BetaErrorResponse = BetaAPI.BetaErrorResponse;
  export type BetaInvalidRequestError = BetaAPI.BetaInvalidRequestError;
  export type BetaNotFoundError = BetaAPI.BetaNotFoundError;
  export type BetaOverloadedError = BetaAPI.BetaOverloadedError;
  export type BetaPermissionError = BetaAPI.BetaPermissionError;
  export type BetaRateLimitError = BetaAPI.BetaRateLimitError;
  export import Messages = MessagesAPI.Messages;
  export type BetaCacheControlEphemeral = MessagesAPI.BetaCacheControlEphemeral;
  export type BetaContentBlock = MessagesAPI.BetaContentBlock;
  export type BetaContentBlockParam = MessagesAPI.BetaContentBlockParam;
  export type BetaImageBlockParam = MessagesAPI.BetaImageBlockParam;
  export type BetaInputJSONDelta = MessagesAPI.BetaInputJSONDelta;
  export type BetaMessage = MessagesAPI.BetaMessage;
  export type BetaMessageDeltaUsage = MessagesAPI.BetaMessageDeltaUsage;
  export type BetaMessageParam = MessagesAPI.BetaMessageParam;
  export type BetaMetadata = MessagesAPI.BetaMetadata;
  export type BetaRawContentBlockDeltaEvent = MessagesAPI.BetaRawContentBlockDeltaEvent;
  export type BetaRawContentBlockStartEvent = MessagesAPI.BetaRawContentBlockStartEvent;
  export type BetaRawContentBlockStopEvent = MessagesAPI.BetaRawContentBlockStopEvent;
  export type BetaRawMessageDeltaEvent = MessagesAPI.BetaRawMessageDeltaEvent;
  export type BetaRawMessageStartEvent = MessagesAPI.BetaRawMessageStartEvent;
  export type BetaRawMessageStopEvent = MessagesAPI.BetaRawMessageStopEvent;
  export type BetaRawMessageStreamEvent = MessagesAPI.BetaRawMessageStreamEvent;
  export type BetaTextBlock = MessagesAPI.BetaTextBlock;
  export type BetaTextBlockParam = MessagesAPI.BetaTextBlockParam;
  export type BetaTextDelta = MessagesAPI.BetaTextDelta;
  export type BetaTool = MessagesAPI.BetaTool;
  export type BetaToolBash20241022 = MessagesAPI.BetaToolBash20241022;
  export type BetaToolChoice = MessagesAPI.BetaToolChoice;
  export type BetaToolChoiceAny = MessagesAPI.BetaToolChoiceAny;
  export type BetaToolChoiceAuto = MessagesAPI.BetaToolChoiceAuto;
  export type BetaToolChoiceTool = MessagesAPI.BetaToolChoiceTool;
  export type BetaToolComputerUse20241022 = MessagesAPI.BetaToolComputerUse20241022;
  export type BetaToolResultBlockParam = MessagesAPI.BetaToolResultBlockParam;
  export type BetaToolTextEditor20241022 = MessagesAPI.BetaToolTextEditor20241022;
  export type BetaToolUnion = MessagesAPI.BetaToolUnion;
  export type BetaToolUseBlock = MessagesAPI.BetaToolUseBlock;
  export type BetaToolUseBlockParam = MessagesAPI.BetaToolUseBlockParam;
  export type BetaUsage = MessagesAPI.BetaUsage;
  export type MessageCreateParams = MessagesAPI.MessageCreateParams;
  export type MessageCreateParamsNonStreaming = MessagesAPI.MessageCreateParamsNonStreaming;
  export type MessageCreateParamsStreaming = MessagesAPI.MessageCreateParamsStreaming;
  export import PromptCaching = PromptCachingAPI.PromptCaching;
}
