// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as BetaAPI from './beta';
import * as MessagesAPI from './messages/messages';
import * as PromptCachingAPI from './prompt-caching/prompt-caching';

export class Beta extends APIResource {
  messages: MessagesAPI.Messages = new MessagesAPI.Messages(this._client);
  promptCaching: PromptCachingAPI.PromptCaching = new PromptCachingAPI.PromptCaching(this._client);
}

export type AnthropicBeta = (string & {}) | 'message-batches-2024-09-24' | 'prompt-caching-2024-07-31';

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
  export import AnthropicBeta = BetaAPI.AnthropicBeta;
  export import BetaAPIError = BetaAPI.BetaAPIError;
  export import BetaAuthenticationError = BetaAPI.BetaAuthenticationError;
  export import BetaError = BetaAPI.BetaError;
  export import BetaErrorResponse = BetaAPI.BetaErrorResponse;
  export import BetaInvalidRequestError = BetaAPI.BetaInvalidRequestError;
  export import BetaNotFoundError = BetaAPI.BetaNotFoundError;
  export import BetaOverloadedError = BetaAPI.BetaOverloadedError;
  export import BetaPermissionError = BetaAPI.BetaPermissionError;
  export import BetaRateLimitError = BetaAPI.BetaRateLimitError;
  export import Messages = MessagesAPI.Messages;
  export import BetaCacheControlEphemeral = MessagesAPI.BetaCacheControlEphemeral;
  export import BetaContentBlock = MessagesAPI.BetaContentBlock;
  export import BetaContentBlockParam = MessagesAPI.BetaContentBlockParam;
  export import BetaImageBlockParam = MessagesAPI.BetaImageBlockParam;
  export import BetaInputJSONDelta = MessagesAPI.BetaInputJSONDelta;
  export import BetaMessage = MessagesAPI.BetaMessage;
  export import BetaMessageDeltaUsage = MessagesAPI.BetaMessageDeltaUsage;
  export import BetaMessageParam = MessagesAPI.BetaMessageParam;
  export import BetaMetadata = MessagesAPI.BetaMetadata;
  export import BetaRawContentBlockDeltaEvent = MessagesAPI.BetaRawContentBlockDeltaEvent;
  export import BetaRawContentBlockStartEvent = MessagesAPI.BetaRawContentBlockStartEvent;
  export import BetaRawContentBlockStopEvent = MessagesAPI.BetaRawContentBlockStopEvent;
  export import BetaRawMessageDeltaEvent = MessagesAPI.BetaRawMessageDeltaEvent;
  export import BetaRawMessageStartEvent = MessagesAPI.BetaRawMessageStartEvent;
  export import BetaRawMessageStopEvent = MessagesAPI.BetaRawMessageStopEvent;
  export import BetaRawMessageStreamEvent = MessagesAPI.BetaRawMessageStreamEvent;
  export import BetaTextBlock = MessagesAPI.BetaTextBlock;
  export import BetaTextBlockParam = MessagesAPI.BetaTextBlockParam;
  export import BetaTextDelta = MessagesAPI.BetaTextDelta;
  export import BetaTool = MessagesAPI.BetaTool;
  export import BetaToolChoice = MessagesAPI.BetaToolChoice;
  export import BetaToolChoiceAny = MessagesAPI.BetaToolChoiceAny;
  export import BetaToolChoiceAuto = MessagesAPI.BetaToolChoiceAuto;
  export import BetaToolChoiceTool = MessagesAPI.BetaToolChoiceTool;
  export import BetaToolResultBlockParam = MessagesAPI.BetaToolResultBlockParam;
  export import BetaToolUseBlock = MessagesAPI.BetaToolUseBlock;
  export import BetaToolUseBlockParam = MessagesAPI.BetaToolUseBlockParam;
  export import BetaUsage = MessagesAPI.BetaUsage;
  export import MessageCreateParams = MessagesAPI.MessageCreateParams;
  export import MessageCreateParamsNonStreaming = MessagesAPI.MessageCreateParamsNonStreaming;
  export import MessageCreateParamsStreaming = MessagesAPI.MessageCreateParamsStreaming;
  export import PromptCaching = PromptCachingAPI.PromptCaching;
}
