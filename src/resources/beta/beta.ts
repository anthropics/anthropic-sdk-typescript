// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as ModelsAPI from './models';
import { BetaModelInfo, BetaModelInfosPage, ModelListParams, ModelRetrieveParams, Models } from './models';
import * as MessagesAPI from './messages/messages';
import {
  BetaBase64ImageSource,
  BetaBase64PDFBlock,
  BetaBase64PDFSource,
  BetaCacheControlEphemeral,
  BetaCitationCharLocation,
  BetaCitationCharLocationParam,
  BetaCitationContentBlockLocation,
  BetaCitationContentBlockLocationParam,
  BetaCitationPageLocation,
  BetaCitationPageLocationParam,
  BetaCitationWebSearchResultLocationParam,
  BetaCitationsConfigParam,
  BetaCitationsDelta,
  BetaCitationsWebSearchResultLocation,
  BetaContentBlock,
  BetaContentBlockParam,
  BetaContentBlockSource,
  BetaContentBlockSourceContent,
  BetaImageBlockParam,
  BetaInputJSONDelta,
  BetaMessage,
  BetaMessageDeltaUsage,
  BetaMessageParam,
  BetaMessageTokensCount,
  BetaMetadata,
  BetaPlainTextSource,
  BetaRawContentBlockDelta,
  BetaRawContentBlockDeltaEvent,
  BetaRawContentBlockStartEvent,
  BetaRawContentBlockStopEvent,
  BetaRawMessageDeltaEvent,
  BetaRawMessageStartEvent,
  BetaRawMessageStopEvent,
  BetaRawMessageStreamEvent,
  BetaRedactedThinkingBlock,
  BetaRedactedThinkingBlockParam,
  BetaServerToolUsage,
  BetaServerToolUseBlock,
  BetaServerToolUseBlockParam,
  BetaSignatureDelta,
  BetaStopReason,
  BetaTextBlock,
  BetaTextBlockParam,
  BetaTextCitation,
  BetaTextCitationParam,
  BetaTextDelta,
  BetaThinkingBlock,
  BetaThinkingBlockParam,
  BetaThinkingConfigDisabled,
  BetaThinkingConfigEnabled,
  BetaThinkingConfigParam,
  BetaThinkingDelta,
  BetaTool,
  BetaToolBash20241022,
  BetaToolBash20250124,
  BetaToolChoice,
  BetaToolChoiceAny,
  BetaToolChoiceAuto,
  BetaToolChoiceNone,
  BetaToolChoiceTool,
  BetaToolComputerUse20241022,
  BetaToolComputerUse20250124,
  BetaToolResultBlockParam,
  BetaToolTextEditor20241022,
  BetaToolTextEditor20250124,
  BetaToolUnion,
  BetaToolUseBlock,
  BetaToolUseBlockParam,
  BetaURLImageSource,
  BetaURLPDFSource,
  BetaUsage,
  BetaWebSearchResultBlock,
  BetaWebSearchResultBlockParam,
  BetaWebSearchTool20250305,
  BetaWebSearchToolRequestError,
  BetaWebSearchToolResultBlock,
  BetaWebSearchToolResultBlockContent,
  BetaWebSearchToolResultBlockParam,
  BetaWebSearchToolResultBlockParamContent,
  BetaWebSearchToolResultError,
  MessageCountTokensParams,
  MessageCreateParams,
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  Messages,
} from './messages/messages';

export class Beta extends APIResource {
  models: ModelsAPI.Models = new ModelsAPI.Models(this._client);
  messages: MessagesAPI.Messages = new MessagesAPI.Messages(this._client);
}

export type AnthropicBeta =
  | (string & {})
  | 'message-batches-2024-09-24'
  | 'prompt-caching-2024-07-31'
  | 'computer-use-2024-10-22'
  | 'computer-use-2025-01-24'
  | 'pdfs-2024-09-25'
  | 'token-counting-2024-11-01'
  | 'token-efficient-tools-2025-02-19'
  | 'output-128k-2025-02-19';

export interface BetaAPIError {
  message: string;

  type: 'api_error';
}

export interface BetaAuthenticationError {
  message: string;

  type: 'authentication_error';
}

export interface BetaBillingError {
  message: string;

  type: 'billing_error';
}

export type BetaError =
  | BetaInvalidRequestError
  | BetaAuthenticationError
  | BetaBillingError
  | BetaPermissionError
  | BetaNotFoundError
  | BetaRateLimitError
  | BetaGatewayTimeoutError
  | BetaAPIError
  | BetaOverloadedError;

export interface BetaErrorResponse {
  error: BetaError;

  type: 'error';
}

export interface BetaGatewayTimeoutError {
  message: string;

  type: 'timeout_error';
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

Beta.Models = Models;
Beta.Messages = Messages;

export declare namespace Beta {
  export {
    type AnthropicBeta as AnthropicBeta,
    type BetaAPIError as BetaAPIError,
    type BetaAuthenticationError as BetaAuthenticationError,
    type BetaBillingError as BetaBillingError,
    type BetaError as BetaError,
    type BetaErrorResponse as BetaErrorResponse,
    type BetaGatewayTimeoutError as BetaGatewayTimeoutError,
    type BetaInvalidRequestError as BetaInvalidRequestError,
    type BetaNotFoundError as BetaNotFoundError,
    type BetaOverloadedError as BetaOverloadedError,
    type BetaPermissionError as BetaPermissionError,
    type BetaRateLimitError as BetaRateLimitError,
  };

  export {
    Models as Models,
    type BetaModelInfo as BetaModelInfo,
    type BetaModelInfosPage as BetaModelInfosPage,
    type ModelRetrieveParams as ModelRetrieveParams,
    type ModelListParams as ModelListParams,
  };

  export {
    Messages as Messages,
    type BetaBase64ImageSource as BetaBase64ImageSource,
    type BetaBase64PDFBlock as BetaBase64PDFBlock,
    type BetaBase64PDFSource as BetaBase64PDFSource,
    type BetaCacheControlEphemeral as BetaCacheControlEphemeral,
    type BetaCitationCharLocation as BetaCitationCharLocation,
    type BetaCitationCharLocationParam as BetaCitationCharLocationParam,
    type BetaCitationContentBlockLocation as BetaCitationContentBlockLocation,
    type BetaCitationContentBlockLocationParam as BetaCitationContentBlockLocationParam,
    type BetaCitationPageLocation as BetaCitationPageLocation,
    type BetaCitationPageLocationParam as BetaCitationPageLocationParam,
    type BetaCitationWebSearchResultLocationParam as BetaCitationWebSearchResultLocationParam,
    type BetaCitationsConfigParam as BetaCitationsConfigParam,
    type BetaCitationsDelta as BetaCitationsDelta,
    type BetaCitationsWebSearchResultLocation as BetaCitationsWebSearchResultLocation,
    type BetaContentBlock as BetaContentBlock,
    type BetaContentBlockParam as BetaContentBlockParam,
    type BetaContentBlockSource as BetaContentBlockSource,
    type BetaContentBlockSourceContent as BetaContentBlockSourceContent,
    type BetaImageBlockParam as BetaImageBlockParam,
    type BetaInputJSONDelta as BetaInputJSONDelta,
    type BetaMessage as BetaMessage,
    type BetaMessageDeltaUsage as BetaMessageDeltaUsage,
    type BetaMessageParam as BetaMessageParam,
    type BetaMessageTokensCount as BetaMessageTokensCount,
    type BetaMetadata as BetaMetadata,
    type BetaPlainTextSource as BetaPlainTextSource,
    type BetaRawContentBlockDelta as BetaRawContentBlockDelta,
    type BetaRawContentBlockDeltaEvent as BetaRawContentBlockDeltaEvent,
    type BetaRawContentBlockStartEvent as BetaRawContentBlockStartEvent,
    type BetaRawContentBlockStopEvent as BetaRawContentBlockStopEvent,
    type BetaRawMessageDeltaEvent as BetaRawMessageDeltaEvent,
    type BetaRawMessageStartEvent as BetaRawMessageStartEvent,
    type BetaRawMessageStopEvent as BetaRawMessageStopEvent,
    type BetaRawMessageStreamEvent as BetaRawMessageStreamEvent,
    type BetaRedactedThinkingBlock as BetaRedactedThinkingBlock,
    type BetaRedactedThinkingBlockParam as BetaRedactedThinkingBlockParam,
    type BetaServerToolUsage as BetaServerToolUsage,
    type BetaServerToolUseBlock as BetaServerToolUseBlock,
    type BetaServerToolUseBlockParam as BetaServerToolUseBlockParam,
    type BetaSignatureDelta as BetaSignatureDelta,
    type BetaStopReason as BetaStopReason,
    type BetaTextBlock as BetaTextBlock,
    type BetaTextBlockParam as BetaTextBlockParam,
    type BetaTextCitation as BetaTextCitation,
    type BetaTextCitationParam as BetaTextCitationParam,
    type BetaTextDelta as BetaTextDelta,
    type BetaThinkingBlock as BetaThinkingBlock,
    type BetaThinkingBlockParam as BetaThinkingBlockParam,
    type BetaThinkingConfigDisabled as BetaThinkingConfigDisabled,
    type BetaThinkingConfigEnabled as BetaThinkingConfigEnabled,
    type BetaThinkingConfigParam as BetaThinkingConfigParam,
    type BetaThinkingDelta as BetaThinkingDelta,
    type BetaTool as BetaTool,
    type BetaToolBash20241022 as BetaToolBash20241022,
    type BetaToolBash20250124 as BetaToolBash20250124,
    type BetaToolChoice as BetaToolChoice,
    type BetaToolChoiceAny as BetaToolChoiceAny,
    type BetaToolChoiceAuto as BetaToolChoiceAuto,
    type BetaToolChoiceNone as BetaToolChoiceNone,
    type BetaToolChoiceTool as BetaToolChoiceTool,
    type BetaToolComputerUse20241022 as BetaToolComputerUse20241022,
    type BetaToolComputerUse20250124 as BetaToolComputerUse20250124,
    type BetaToolResultBlockParam as BetaToolResultBlockParam,
    type BetaToolTextEditor20241022 as BetaToolTextEditor20241022,
    type BetaToolTextEditor20250124 as BetaToolTextEditor20250124,
    type BetaToolUnion as BetaToolUnion,
    type BetaToolUseBlock as BetaToolUseBlock,
    type BetaToolUseBlockParam as BetaToolUseBlockParam,
    type BetaURLImageSource as BetaURLImageSource,
    type BetaURLPDFSource as BetaURLPDFSource,
    type BetaUsage as BetaUsage,
    type BetaWebSearchResultBlock as BetaWebSearchResultBlock,
    type BetaWebSearchResultBlockParam as BetaWebSearchResultBlockParam,
    type BetaWebSearchTool20250305 as BetaWebSearchTool20250305,
    type BetaWebSearchToolRequestError as BetaWebSearchToolRequestError,
    type BetaWebSearchToolResultBlock as BetaWebSearchToolResultBlock,
    type BetaWebSearchToolResultBlockContent as BetaWebSearchToolResultBlockContent,
    type BetaWebSearchToolResultBlockParam as BetaWebSearchToolResultBlockParam,
    type BetaWebSearchToolResultBlockParamContent as BetaWebSearchToolResultBlockParamContent,
    type BetaWebSearchToolResultError as BetaWebSearchToolResultError,
    type MessageCreateParams as MessageCreateParams,
    type MessageCreateParamsNonStreaming as MessageCreateParamsNonStreaming,
    type MessageCreateParamsStreaming as MessageCreateParamsStreaming,
    type MessageCountTokensParams as MessageCountTokensParams,
  };
}
