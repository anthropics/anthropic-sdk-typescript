// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as MessagesAPI from './messages';

export class PromptCaching extends APIResource {
  messages: MessagesAPI.Messages = new MessagesAPI.Messages(this._client);
}

export namespace PromptCaching {
  export import Messages = MessagesAPI.Messages;
  export type PromptCachingBetaCacheControlEphemeral = MessagesAPI.PromptCachingBetaCacheControlEphemeral;
  export type PromptCachingBetaImageBlockParam = MessagesAPI.PromptCachingBetaImageBlockParam;
  export type PromptCachingBetaMessage = MessagesAPI.PromptCachingBetaMessage;
  export type PromptCachingBetaMessageParam = MessagesAPI.PromptCachingBetaMessageParam;
  export type PromptCachingBetaTextBlockParam = MessagesAPI.PromptCachingBetaTextBlockParam;
  export type PromptCachingBetaTool = MessagesAPI.PromptCachingBetaTool;
  export type PromptCachingBetaToolResultBlockParam = MessagesAPI.PromptCachingBetaToolResultBlockParam;
  export type PromptCachingBetaToolUseBlockParam = MessagesAPI.PromptCachingBetaToolUseBlockParam;
  export type PromptCachingBetaUsage = MessagesAPI.PromptCachingBetaUsage;
  export type RawPromptCachingBetaMessageStartEvent = MessagesAPI.RawPromptCachingBetaMessageStartEvent;
  export type RawPromptCachingBetaMessageStreamEvent = MessagesAPI.RawPromptCachingBetaMessageStreamEvent;
  export type MessageCreateParams = MessagesAPI.MessageCreateParams;
  export type MessageCreateParamsNonStreaming = MessagesAPI.MessageCreateParamsNonStreaming;
  export type MessageCreateParamsStreaming = MessagesAPI.MessageCreateParamsStreaming;
}
