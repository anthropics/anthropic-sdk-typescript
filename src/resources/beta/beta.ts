// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as MessagesAPI from './messages/messages';
import {
  BetaBase64PDFBlock,
  BetaBase64PDFSource,
  BetaCacheControlEphemeral,
  BetaContentBlock,
  BetaContentBlockParam,
  BetaImageBlockParam,
  BetaInputJSONDelta,
  BetaMessage,
  BetaMessageDeltaUsage,
  BetaMessageParam,
  BetaMessageTokensCount,
  BetaMetadata,
  BetaRawContentBlockDeltaEvent,
  BetaRawContentBlockStartEvent,
  BetaRawContentBlockStopEvent,
  BetaRawMessageDeltaEvent,
  BetaRawMessageStartEvent,
  BetaRawMessageStopEvent,
  BetaRawMessageStreamEvent,
  BetaTextBlock,
  BetaTextBlockParam,
  BetaTextDelta,
  BetaTool,
  BetaToolBash20241022,
  BetaToolChoice,
  BetaToolChoiceAny,
  BetaToolChoiceAuto,
  BetaToolChoiceTool,
  BetaToolComputerUse20241022,
  BetaToolResultBlockParam,
  BetaToolTextEditor20241022,
  BetaToolUnion,
  BetaToolUseBlock,
  BetaToolUseBlockParam,
  BetaUsage,
  MessageCountTokensParams,
  MessageCreateParams,
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  Messages,
} from './messages/messages';
import * as PromptCachingAPI from './prompt-caching/prompt-caching';
import { PromptCaching } from './prompt-caching/prompt-caching';

export class Beta extends APIResource {
  messages: MessagesAPI.Messages = new MessagesAPI.Messages(this._client);
  promptCaching: PromptCachingAPI.PromptCaching = new PromptCachingAPI.PromptCaching(this._client);
}

export type AnthropicBeta =
  | (string & {})
  | 'message-batches-2024-09-24'
  | 'prompt-caching-2024-07-31'
  | 'computer-use-2024-10-22'
  | 'pdfs-2024-09-25';

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

Beta.Messages = Messages;
Beta.PromptCaching = PromptCaching;

export declare namespace Beta {
  export {
    type AnthropicBeta as AnthropicBeta,
    type BetaAPIError as BetaAPIError,
    type BetaAuthenticationError as BetaAuthenticationError,
    type BetaError as BetaError,
    type BetaErrorResponse as BetaErrorResponse,
    type BetaInvalidRequestError as BetaInvalidRequestError,
    type BetaNotFoundError as BetaNotFoundError,
    type BetaOverloadedError as BetaOverloadedError,
    type BetaPermissionError as BetaPermissionError,
    type BetaRateLimitError as BetaRateLimitError,
  };

  export {
    Messages as Messages,
    type BetaBase64PDFBlock as BetaBase64PDFBlock,
    type BetaBase64PDFSource as BetaBase64PDFSource,
    type BetaCacheControlEphemeral as BetaCacheControlEphemeral,
    type BetaContentBlock as BetaContentBlock,
    type BetaContentBlockParam as BetaContentBlockParam,
    type BetaImageBlockParam as BetaImageBlockParam,
    type BetaInputJSONDelta as BetaInputJSONDelta,
    type BetaMessage as BetaMessage,
    type BetaMessageDeltaUsage as BetaMessageDeltaUsage,
    type BetaMessageParam as BetaMessageParam,
    type BetaMessageTokensCount as BetaMessageTokensCount,
    type BetaMetadata as BetaMetadata,
    type BetaRawContentBlockDeltaEvent as BetaRawContentBlockDeltaEvent,
    type BetaRawContentBlockStartEvent as BetaRawContentBlockStartEvent,
    type BetaRawContentBlockStopEvent as BetaRawContentBlockStopEvent,
    type BetaRawMessageDeltaEvent as BetaRawMessageDeltaEvent,
    type BetaRawMessageStartEvent as BetaRawMessageStartEvent,
    type BetaRawMessageStopEvent as BetaRawMessageStopEvent,
    type BetaRawMessageStreamEvent as BetaRawMessageStreamEvent,
    type BetaTextBlock as BetaTextBlock,
    type BetaTextBlockParam as BetaTextBlockParam,
    type BetaTextDelta as BetaTextDelta,
    type BetaTool as BetaTool,
    type BetaToolBash20241022 as BetaToolBash20241022,
    type BetaToolChoice as BetaToolChoice,
    type BetaToolChoiceAny as BetaToolChoiceAny,
    type BetaToolChoiceAuto as BetaToolChoiceAuto,
    type BetaToolChoiceTool as BetaToolChoiceTool,
    type BetaToolComputerUse20241022 as BetaToolComputerUse20241022,
    type BetaToolResultBlockParam as BetaToolResultBlockParam,
    type BetaToolTextEditor20241022 as BetaToolTextEditor20241022,
    type BetaToolUnion as BetaToolUnion,
    type BetaToolUseBlock as BetaToolUseBlock,
    type BetaToolUseBlockParam as BetaToolUseBlockParam,
    type BetaUsage as BetaUsage,
    type MessageCreateParams as MessageCreateParams,
    type MessageCreateParamsNonStreaming as MessageCreateParamsNonStreaming,
    type MessageCreateParamsStreaming as MessageCreateParamsStreaming,
    type MessageCountTokensParams as MessageCountTokensParams,
  };

  export { PromptCaching as PromptCaching };
}
