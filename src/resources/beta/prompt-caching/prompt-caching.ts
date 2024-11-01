// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as MessagesAPI from './messages';
import {
  MessageCreateParams,
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  Messages,
  PromptCachingBetaCacheControlEphemeral,
  PromptCachingBetaImageBlockParam,
  PromptCachingBetaMessage,
  PromptCachingBetaMessageParam,
  PromptCachingBetaTextBlockParam,
  PromptCachingBetaTool,
  PromptCachingBetaToolResultBlockParam,
  PromptCachingBetaToolUseBlockParam,
  PromptCachingBetaUsage,
  RawPromptCachingBetaMessageStartEvent,
  RawPromptCachingBetaMessageStreamEvent,
} from './messages';

export class PromptCaching extends APIResource {
  messages: MessagesAPI.Messages = new MessagesAPI.Messages(this._client);
}

PromptCaching.Messages = Messages;

export declare namespace PromptCaching {
  export {
    Messages as Messages,
    type PromptCachingBetaCacheControlEphemeral as PromptCachingBetaCacheControlEphemeral,
    type PromptCachingBetaImageBlockParam as PromptCachingBetaImageBlockParam,
    type PromptCachingBetaMessage as PromptCachingBetaMessage,
    type PromptCachingBetaMessageParam as PromptCachingBetaMessageParam,
    type PromptCachingBetaTextBlockParam as PromptCachingBetaTextBlockParam,
    type PromptCachingBetaTool as PromptCachingBetaTool,
    type PromptCachingBetaToolResultBlockParam as PromptCachingBetaToolResultBlockParam,
    type PromptCachingBetaToolUseBlockParam as PromptCachingBetaToolUseBlockParam,
    type PromptCachingBetaUsage as PromptCachingBetaUsage,
    type RawPromptCachingBetaMessageStartEvent as RawPromptCachingBetaMessageStartEvent,
    type RawPromptCachingBetaMessageStreamEvent as RawPromptCachingBetaMessageStreamEvent,
    type MessageCreateParams as MessageCreateParams,
    type MessageCreateParamsNonStreaming as MessageCreateParamsNonStreaming,
    type MessageCreateParamsStreaming as MessageCreateParamsStreaming,
  };
}
